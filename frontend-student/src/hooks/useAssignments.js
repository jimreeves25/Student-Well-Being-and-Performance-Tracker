import { useEffect, useMemo, useReducer } from "react";

const STORAGE_KEY = "studentAssignments";

const PRIORITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2,
};

const FILTERS = ["all", "pending", "in-progress", "completed", "overdue"];
const SORT_OPTIONS = ["dueDate", "priority"];

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `assignment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const toValidDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeStatus = (status, progress) => {
  if (String(status) === "completed" || Number(progress) >= 100) return "completed";
  if (String(status) === "in-progress" || String(status) === "in_progress") return "in-progress";
  return "pending";
};

const normalizePriority = (priority) => {
  const value = String(priority || "medium").toLowerCase();
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
};

const normalizeAssignment = (assignment = {}) => {
  const dueDate = toValidDate(assignment.dueDate);
  const progress = Math.max(0, Math.min(100, Number(assignment.progress) || 0));
  const status = normalizeStatus(assignment.status, progress);

  return {
    id: assignment.id || createId(),
    title: String(assignment.title || "").trim(),
    subject: String(assignment.subject || "").trim(),
    description: String(assignment.description || "").trim(),
    dueDate: dueDate ? dueDate.toISOString() : "",
    priority: normalizePriority(assignment.priority),
    status,
    progress: status === "completed" ? 100 : progress,
    createdAt: assignment.createdAt || new Date().toISOString(),
    updatedAt: assignment.updatedAt || new Date().toISOString(),
    completedAt: assignment.completedAt || (status === "completed" ? new Date().toISOString() : null),
  };
};

const loadAssignments = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw.map(normalizeAssignment) : [];
  } catch {
    return [];
  }
};

const persistAssignments = (assignments) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
};

const evaluateAssignment = (assignment, now = new Date()) => {
  const dueDate = toValidDate(assignment.dueDate);
  const normalizedStatus = normalizeStatus(assignment.status, assignment.progress);
  const completed = normalizedStatus === "completed";
  const isOverdue = Boolean(dueDate && dueDate < now && !completed);
  const daysDiff = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / 86400000) : null;

  let dueLabel = "No due date";
  if (dueDate) {
    const absDays = Math.abs(daysDiff || 0);
    if (daysDiff === 0) {
      dueLabel = "Due today";
    } else if (daysDiff > 0) {
      dueLabel = `Due in ${absDays} day${absDays === 1 ? "" : "s"}`;
    } else {
      dueLabel = `Overdue by ${absDays} day${absDays === 1 ? "" : "s"}`;
    }
  }

  const statusLabel = isOverdue ? "overdue" : normalizedStatus;
  const progress = completed ? 100 : Math.max(0, Math.min(100, Number(assignment.progress) || 0));
  const dueSoon = Boolean(dueDate && !completed && daysDiff !== null && daysDiff >= 0 && daysDiff <= 2);

  return {
    ...assignment,
    status: normalizedStatus,
    computedStatus: statusLabel,
    progress,
    isOverdue,
    dueSoon,
    dueLabel,
    dueDateValue: dueDate,
  };
};

const sortAssignments = (assignments, sortBy, sortDirection) => {
  const direction = sortDirection === "desc" ? -1 : 1;
  const list = [...assignments];

  list.sort((left, right) => {
    if (sortBy === "priority") {
      const priorityDiff = (PRIORITY_ORDER[left.priority] ?? 1) - (PRIORITY_ORDER[right.priority] ?? 1);
      if (priorityDiff !== 0) return priorityDiff * direction;
      return (left.dueDateValue?.getTime?.() || 0) - (right.dueDateValue?.getTime?.() || 0);
    }

    const leftTime = left.dueDateValue?.getTime?.() || Number.POSITIVE_INFINITY;
    const rightTime = right.dueDateValue?.getTime?.() || Number.POSITIVE_INFINITY;
    return (leftTime - rightTime) * direction;
  });

  return list;
};

const getAnalytics = (assignments) => {
  const total = assignments.length;
  const completed = assignments.filter((item) => item.computedStatus === "completed").length;
  const overdue = assignments.filter((item) => item.computedStatus === "overdue").length;
  const inProgress = assignments.filter((item) => item.computedStatus === "in-progress").length;
  const pending = assignments.filter((item) => item.computedStatus === "pending").length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;

  return { total, completed, overdue, inProgress, pending, completionRate };
};

const initialState = {
  assignments: [],
  filter: "all",
  sortBy: "dueDate",
  sortDirection: "asc",
};

function reducer(state, action) {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        assignments: action.payload,
      };
    case "add":
      return {
        ...state,
        assignments: [action.payload, ...state.assignments],
      };
    case "update":
      return {
        ...state,
        assignments: state.assignments.map((assignment) =>
          assignment.id === action.payload.id
            ? { ...assignment, ...action.payload.updates, updatedAt: new Date().toISOString() }
            : assignment
        ),
      };
    case "delete":
      return {
        ...state,
        assignments: state.assignments.filter((assignment) => assignment.id !== action.payload),
      };
    case "set_filter":
      return { ...state, filter: action.payload };
    case "set_sort":
      return {
        ...state,
        sortBy: action.payload,
        sortDirection:
          state.sortBy === action.payload
            ? state.sortDirection === "asc"
              ? "desc"
              : "asc"
            : action.payload === "priority"
              ? "asc"
              : "asc",
      };
    case "set_sort_direction":
      return { ...state, sortDirection: action.payload };
    default:
      return state;
  }
}

export function useAssignments() {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    dispatch({ type: "hydrate", payload: loadAssignments() });
  }, []);

  useEffect(() => {
    persistAssignments(state.assignments);
  }, [state.assignments]);

  const normalizedAssignments = useMemo(
    () => state.assignments.map((assignment) => evaluateAssignment(normalizeAssignment(assignment))),
    [state.assignments]
  );

  const visibleAssignments = useMemo(() => {
    const now = new Date();
    const enriched = normalizedAssignments.map((assignment) => evaluateAssignment(assignment, now));

    const filtered = enriched.filter((assignment) => {
      if (state.filter === "all") return true;
      if (state.filter === "overdue") return assignment.computedStatus === "overdue";
      return assignment.computedStatus === state.filter;
    });

    return sortAssignments(filtered, state.sortBy, state.sortDirection);
  }, [normalizedAssignments, state.filter, state.sortBy, state.sortDirection]);

  const analytics = useMemo(() => getAnalytics(normalizedAssignments), [normalizedAssignments]);

  const addAssignment = (input) => {
    const normalized = normalizeAssignment({
      ...input,
      id: createId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    dispatch({ type: "add", payload: normalized });
    return normalized;
  };

  const updateAssignment = (id, updates) => {
    dispatch({
      type: "update",
      payload: {
        id,
        updates: normalizeAssignment({
          ...state.assignments.find((assignment) => assignment.id === id),
          ...updates,
          id,
          updatedAt: new Date().toISOString(),
        }),
      },
    });
  };

  const deleteAssignment = (id) => {
    dispatch({ type: "delete", payload: id });
  };

  const setFilter = (filter) => {
    if (!FILTERS.includes(filter)) return;
    dispatch({ type: "set_filter", payload: filter });
  };

  const setSortBy = (sortBy) => {
    if (!SORT_OPTIONS.includes(sortBy)) return;
    dispatch({ type: "set_sort", payload: sortBy });
  };

  const toggleComplete = (id) => {
    const target = state.assignments.find((assignment) => assignment.id === id);
    if (!target) return;
    updateAssignment(id, {
      ...target,
      status: target.status === "completed" ? "pending" : "completed",
      progress: target.status === "completed" ? Math.min(Number(target.progress) || 0, 99) : 100,
      completedAt: target.status === "completed" ? null : new Date().toISOString(),
    });
  };

  const updateProgress = (id, progress) => {
    const value = Math.max(0, Math.min(100, Number(progress) || 0));
    const target = state.assignments.find((assignment) => assignment.id === id);
    if (!target) return;
    updateAssignment(id, {
      ...target,
      progress: value,
      status: value >= 100 ? "completed" : target.status === "completed" ? "in-progress" : target.status,
      completedAt: value >= 100 ? new Date().toISOString() : target.completedAt || null,
    });
  };

  const refreshAssignments = () => {
    dispatch({ type: "hydrate", payload: loadAssignments() });
  };

  return {
    assignments: visibleAssignments,
    allAssignments: normalizedAssignments,
    rawAssignments: state.assignments,
    filter: state.filter,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
    analytics,
    addAssignment,
    updateAssignment,
    deleteAssignment,
    toggleComplete,
    updateProgress,
    setFilter,
    setSortBy,
    refreshAssignments,
  };
}

export default useAssignments;
