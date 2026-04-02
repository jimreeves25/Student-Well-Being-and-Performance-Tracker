import React, { useEffect, useMemo, useState } from "react";

const defaultForm = {
  title: "",
  subject: "",
  description: "",
  dueDate: "",
  priority: "medium",
  status: "pending",
  progress: 0,
};

const toFormValue = (assignment) => {
  if (!assignment) return defaultForm;
  return {
    title: assignment.title || "",
    subject: assignment.subject || "",
    description: assignment.description || "",
    dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 16) : "",
    priority: assignment.priority || "medium",
    status: assignment.status || "pending",
    progress: Number.isFinite(Number(assignment.progress)) ? Number(assignment.progress) : 0,
  };
};

function AssignmentFormModal({ isOpen, mode, assignment, onClose, onSave }) {
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      setForm(toFormValue(assignment));
      setErrors({});
    }
  }, [assignment, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const title = useMemo(() => (mode === "edit" ? "Edit Assignment" : "Add Assignment"), [mode]);

  if (!isOpen) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = {};

    if (!form.title.trim()) nextErrors.title = "Title is required.";
    if (!form.dueDate || Number.isNaN(new Date(form.dueDate).getTime())) nextErrors.dueDate = "Enter a valid due date.";

    const nextProgress = Math.max(0, Math.min(100, Number(form.progress) || 0));

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    onSave({
      ...form,
      title: form.title.trim(),
      subject: form.subject.trim(),
      description: form.description.trim(),
      dueDate: new Date(form.dueDate).toISOString(),
      priority: form.priority,
      status: nextProgress >= 100 ? "completed" : form.status,
      progress: nextProgress,
    });
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  return (
    <div className="assignment-modal-overlay" role="presentation" onMouseDown={onClose}>
      <div className="assignment-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="assignment-modal-header">
          <div>
            <h3 id="assignment-modal-title">{title}</h3>
            <p>{mode === "edit" ? "Update details, status, or progress." : "Create a new assignment and track it immediately."}</p>
          </div>
          <button type="button" className="assignment-modal-close" onClick={onClose} aria-label="Close assignment form">
            ✕
          </button>
        </div>

        <form className="assignment-form" onSubmit={handleSubmit}>
          <div className="assignment-form-grid">
            <div className="assignment-field assignment-field-full">
              <label htmlFor="assignment-title">Title *</label>
              <input id="assignment-title" name="title" value={form.title} onChange={handleChange} placeholder="Assignment title" />
              {errors.title ? <span className="assignment-field-error">{errors.title}</span> : null}
            </div>

            <div className="assignment-field">
              <label htmlFor="assignment-subject">Subject</label>
              <input id="assignment-subject" name="subject" value={form.subject} onChange={handleChange} placeholder="Math, IoT, English" />
            </div>

            <div className="assignment-field">
              <label htmlFor="assignment-priority">Priority</label>
              <select id="assignment-priority" name="priority" value={form.priority} onChange={handleChange}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="assignment-field assignment-field-full">
              <label htmlFor="assignment-description">Description</label>
              <textarea id="assignment-description" name="description" rows="3" value={form.description} onChange={handleChange} placeholder="Short notes, instructions, links, or rubric details" />
            </div>

            <div className="assignment-field">
              <label htmlFor="assignment-duedate">Due date *</label>
              <input id="assignment-duedate" type="datetime-local" name="dueDate" value={form.dueDate} onChange={handleChange} />
              {errors.dueDate ? <span className="assignment-field-error">{errors.dueDate}</span> : null}
            </div>

            <div className="assignment-field">
              <label htmlFor="assignment-status">Status</label>
              <select id="assignment-status" name="status" value={form.status} onChange={handleChange}>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="assignment-field assignment-field-full">
              <div className="assignment-range-head">
                <label htmlFor="assignment-progress">Progress</label>
                <strong>{form.progress}%</strong>
              </div>
              <input id="assignment-progress" type="range" min="0" max="100" name="progress" value={form.progress} onChange={handleChange} />
            </div>
          </div>

          <div className="assignment-form-actions">
            <button type="button" className="assignment-secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="assignment-primary-btn">
              {mode === "edit" ? "Save Changes" : "Create Assignment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AssignmentFormModal;
