import React from "react";

function InputField({
  id,
  label,
  type = "text",
  value,
  onChange,
  required = false,
  error,
  accept,
}) {
  return (
    <div className="settings-input-group">
      <label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </label>
      <input
        id={id}
        type={type}
        value={type === "file" ? undefined : value}
        onChange={onChange}
        required={required}
        accept={accept}
      />
      {error ? <small className="settings-input-error">{error}</small> : null}
    </div>
  );
}

export default InputField;
