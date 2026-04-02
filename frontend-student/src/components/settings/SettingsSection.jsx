import React from "react";

function SettingsSection({ title, children }) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      <div className="settings-section-content">{children}</div>
    </section>
  );
}

export default SettingsSection;
