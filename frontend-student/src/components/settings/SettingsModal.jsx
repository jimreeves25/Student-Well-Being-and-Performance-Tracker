import React, { useEffect, useState } from "react";
import InputField from "./InputField";
import SettingsSection from "./SettingsSection";

function SettingsModal({
  isOpen,
  onClose,
  settings,
  validationErrors,
  onFieldChange,
  onProfilePictureChange,
  themeMode,
  onThemeModeChange,
  notificationsEnabled,
  onNotificationToggle,
  onSave,
  onLogout,
  onChangePassword,
  passwordErrors,
}) {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordMessage, setPasswordMessage] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handlePasswordChange = () => {
    setPasswordMessage(null);

    // Validation
    if (!passwordForm.currentPassword.trim()) {
      setPasswordMessage({ type: "error", text: "Current password is required." });
      return;
    }

    if (!passwordForm.newPassword.trim()) {
      setPasswordMessage({ type: "error", text: "New password is required." });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    // Call the change password handler
    if (onChangePassword) {
      const result = onChangePassword(passwordForm.currentPassword, passwordForm.newPassword);
      if (result.success) {
        setPasswordMessage({ type: "success", text: "Password changed successfully!" });
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setTimeout(() => setPasswordMessage(null), 3000);
      } else {
        setPasswordMessage({ type: "error", text: result.error || "Failed to change password." });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="settings-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="settings-modal" role="dialog" aria-modal="true" aria-label="User settings">
        <div className="settings-modal-header">
          <h2>Settings</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        <div className="settings-modal-body">
          <SettingsSection title="Profile Settings">
            <InputField
              id="settings-username"
              label="Username"
              value={settings.username}
              onChange={(event) => onFieldChange("username", event.target.value)}
              required
              error={validationErrors.username}
            />
            <InputField
              id="settings-email"
              label="Email"
              type="email"
              value={settings.email}
              onChange={(event) => onFieldChange("email", event.target.value)}
              required
              error={validationErrors.email}
            />
            <InputField
              id="settings-phone"
              label="Phone"
              type="tel"
              value={settings.phone}
              onChange={(event) => onFieldChange("phone", event.target.value)}
              error={validationErrors.phone}
            />

            <div className="settings-input-group">
              <label htmlFor="settings-profile-picture">Profile Picture (optional)</label>
              <input
                id="settings-profile-picture"
                type="file"
                accept="image/*"
                onChange={onProfilePictureChange}
              />
              {settings.profilePicture ? (
                <img
                  className="settings-avatar-preview"
                  src={settings.profilePicture}
                  alt="Profile preview"
                />
              ) : null}
            </div>
          </SettingsSection>

          <SettingsSection title="Preferences">
            <div className="settings-input-group">
              <label htmlFor="settings-theme-mode">Theme</label>
              <select
                id="settings-theme-mode"
                value={themeMode}
                onChange={(event) => onThemeModeChange(event.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>

            <div className="settings-toggle-row">
              <span>Notifications</span>
              <button
                type="button"
                className={`settings-toggle ${notificationsEnabled ? "on" : "off"}`}
                onClick={() => onNotificationToggle(!notificationsEnabled)}
                aria-pressed={notificationsEnabled}
              >
                {notificationsEnabled ? "On" : "Off"}
              </button>
            </div>
          </SettingsSection>

          <SettingsSection title="Account">
            <InputField
              id="settings-current-password"
              label="Current Password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
              }
            />
            <InputField
              id="settings-new-password"
              label="New Password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
              }
            />
            <InputField
              id="settings-confirm-password"
              label="Confirm Password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
              }
            />

            {passwordMessage && (
              <small
                className={`settings-note ${passwordMessage.type === "error" ? "error" : "success"}`}
                style={{
                  color: passwordMessage.type === "error" ? "#ff8a8a" : "#4ade80",
                  display: "block",
                  marginTop: "8px",
                }}
              >
                {passwordMessage.text}
              </small>
            )}

            <button
              type="button"
              className="settings-primary-btn"
              onClick={handlePasswordChange}
              style={{ marginTop: "10px", width: "100%" }}
            >
              Change Password
            </button>

            <button type="button" className="settings-logout-btn" onClick={onLogout}>
              Logout
            </button>
          </SettingsSection>
        </div>

        <div className="settings-modal-footer">
          <button type="button" className="settings-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="settings-primary-btn" onClick={onSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
