import React, { useEffect, useMemo, useState } from "react";
import AssignmentCard from "./AssignmentCard";
import AssignmentFormModal from "./AssignmentFormModal";
import SmartSchedulerModal from "./SmartSchedulerModal";
import "../../styles/AssignmentPlanner.css";

const FILTER_LABELS = {
  all: "All",
  pending: "Pending",
  "in-progress": "In Progress",
  completed: "Completed",
  overdue: "Overdue",
};

function AssignmentPlanner({
  assignments,
  allAssignments,
  analytics,
  filter,
  sortBy,
  sortDirection,
  setFilter,
  setSortBy,
  addAssignment,
  updateAssignment,
  deleteAssignment,
  toggleComplete,
  updateProgress,
  schedulerContext,
  openSchedulerSignal,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSmartSchedulerOpen, setIsSmartSchedulerOpen] = useState(false);

  const emptyStateMessage = useMemo(() => {
    if (!allAssignments.length) {
      return "No assignments yet. Create your first assignment to start tracking progress, priority, and deadlines.";
    }
    const label = FILTER_LABELS[filter] || filter;
    return `No ${label.toLowerCase()} assignments match the current filters. Try a different filter or sort option.`;
  }, [allAssignments.length, filter]);

  const openCreateModal = () => {
    setEditingAssignment(null);
    setIsModalOpen(true);
  };

  const openEditModal = (assignment) => {
    setEditingAssignment(assignment);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAssignment(null);
  };

  const handleSave = (payload) => {
    if (editingAssignment) {
      updateAssignment(editingAssignment.id, payload);
    } else {
      addAssignment(payload);
    }
    closeModal();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteAssignment(deleteTarget.id);
    setDeleteTarget(null);
  };

  useEffect(() => {
    if (!openSchedulerSignal) return;
    setIsSmartSchedulerOpen(true);
  }, [openSchedulerSignal]);

  return (
    <section className="assignment-planner-shell" aria-label="Assignment Planner">
      <div className="assignment-planner-header">
        <div>
          <h2>Assignment Planner</h2>
          <p>Track deadlines, manage priorities, and update progress without losing state on refresh.</p>
        </div>
        <div className="assignment-header-actions">
          <button type="button" className="assignment-smart-btn" onClick={() => setIsSmartSchedulerOpen(true)}>
            <span className="assignment-smart-icon" aria-hidden="true">🧠</span>
            <span>AI Smart Scheduler</span>
          </button>
          <button type="button" className="assignment-primary-btn" onClick={openCreateModal}>
            + Add Assignment
          </button>
        </div>
      </div>

      <div className="assignment-analytics-strip">
        <article className="assignment-analytics-card">
          <span>Total</span>
          <strong>{analytics.total}</strong>
        </article>
        <article className="assignment-analytics-card">
          <span>Completed</span>
          <strong>{analytics.completed}</strong>
        </article>
        <article className="assignment-analytics-card">
          <span>Overdue</span>
          <strong>{analytics.overdue}</strong>
        </article>
        <article className="assignment-analytics-card">
          <span>Completion Rate</span>
          <strong>{analytics.completionRate}%</strong>
        </article>
      </div>

      <div className="assignment-toolbar">
        <div className="assignment-filter-group" role="tablist" aria-label="Assignment filters">
          {Object.entries(FILTER_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`assignment-filter-btn ${filter === value ? "active" : ""}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="assignment-sort-group">
          <span>Sort</span>
          <button type="button" className={`assignment-sort-btn ${sortBy === "dueDate" ? "active" : ""}`} onClick={() => setSortBy("dueDate")}>
            Due Date {sortBy === "dueDate" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
          </button>
          <button type="button" className={`assignment-sort-btn ${sortBy === "priority" ? "active" : ""}`} onClick={() => setSortBy("priority")}>
            Priority {sortBy === "priority" ? (sortDirection === "asc" ? "↑" : "↓") : ""}
          </button>
        </div>
      </div>

      {assignments.length ? (
        <div className="assignment-grid">
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              onEdit={openEditModal}
              onDelete={setDeleteTarget}
              onToggleComplete={toggleComplete}
              onUpdateProgress={updateProgress}
              onUpdateStatus={(id, status) => updateAssignment(id, { ...assignment, status, progress: status === "completed" ? 100 : assignment.progress })}
            />
          ))}
        </div>
      ) : (
        <div className="assignment-empty-state">
          <div className="assignment-empty-icon" aria-hidden="true">
            ✨
          </div>
          <h3>Nothing to show here yet</h3>
          <p>{emptyStateMessage}</p>
          <button type="button" className="assignment-primary-btn" onClick={openCreateModal}>
            Create your first assignment
          </button>
        </div>
      )}

      <AssignmentFormModal
        isOpen={isModalOpen}
        mode={editingAssignment ? "edit" : "create"}
        assignment={editingAssignment}
        onClose={closeModal}
        onSave={handleSave}
      />

      <SmartSchedulerModal
        isOpen={isSmartSchedulerOpen}
        assignments={allAssignments}
        schedulerContext={schedulerContext}
        onClose={() => setIsSmartSchedulerOpen(false)}
      />

      {deleteTarget ? (
        <div className="assignment-modal-overlay" role="presentation" onMouseDown={() => setDeleteTarget(null)}>
          <div className="assignment-confirmation-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <h3>Delete assignment?</h3>
            <p>
              This will permanently remove <strong>{deleteTarget.title}</strong> from your planner.
            </p>
            <div className="assignment-form-actions">
              <button type="button" className="assignment-secondary-btn" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="assignment-danger-btn" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default AssignmentPlanner;
