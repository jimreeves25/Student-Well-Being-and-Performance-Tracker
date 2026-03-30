import { useEffect, useState } from "react";
import { signupParent, signupUser } from "../services/api";
import "../styles/Login.css";

export default function Signup({ initialAccountType = "student", onSignupSuccess, onGoToLogin }) {
  const [accountType, setAccountType] = useState(initialAccountType);
  useEffect(() => {
    setAccountType(initialAccountType === "parent" ? "parent" : "student");
  }, [initialAccountType]);

  const [form, setForm] = useState({
    name: "",
    studentId: "",
    email: "",
    password: "",
    verificationCode: "",
  });

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedForm = {
      name: form.name.trim(),
      studentId: form.studentId.trim(),
      email: form.email.trim(),
      password: form.password,
      verificationCode: form.verificationCode.trim(),
    };
    const requiresVerification = accountType === "parent";
    const missingBase = !normalizedForm.name || !normalizedForm.studentId || !normalizedForm.email || !normalizedForm.password;
    if (missingBase || (requiresVerification && !normalizedForm.verificationCode)) {
      alert("Please fill all fields");
      return;
    }

    try {
      const payload = {
        name: normalizedForm.name,
        studentId: normalizedForm.studentId,
        email: normalizedForm.email,
        password: normalizedForm.password,
      };

      const res =
        accountType === "parent"
          ? await signupParent({ ...payload, verificationCode: normalizedForm.verificationCode })
          : await signupUser(payload);

      if (res.token) {
        alert(res.message || "Signup successful!");
        onSignupSuccess(accountType);
      } else {
        alert(res.message || (accountType === "parent" ? "Parent signup submitted for approval" : "Signup failed"));
        if (accountType === "parent") {
          if (typeof onGoToLogin === "function") {
            onGoToLogin("parent");
          } else {
            window.location.hash = "login-parent";
          }
        }
      }
    } catch (err) {
      alert("Signup failed: " + err.message);
    }
  };

  return (
    <div className={`container ${accountType === "parent" ? "parent-mode" : "student-mode"}`}>
      <div className="card">
        <h1 className="title">Join Skillspring</h1>
        <p className="subtitle">Create your {accountType === "parent" ? "Parent" : "Student"} account</p>

        <div className="account-switch">
          <button
            type="button"
            className={`account-pill ${accountType === "student" ? "active" : ""}`}
            onClick={() => setAccountType("student")}
          >
            Student
          </button>
          <button
            type="button"
            className={`account-pill ${accountType === "parent" ? "active" : ""}`}
            onClick={() => setAccountType("parent")}
          >
            Parent
          </button>
        </div>

        {accountType === "parent" && (
          <p className="mode-hint">
            Use the student-provided verification code to link your account and unlock live guardian monitoring.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <input 
            name="name" 
            type="text"
            placeholder="Full Name" 
            value={form.name}
            onChange={handleChange} 
            required
          />
          <input 
            name="studentId" 
            type="text"
            placeholder={accountType === "parent" ? "Child Student ID" : "Student ID"}
            value={form.studentId}
            onChange={handleChange} 
            required
          />
          <input 
            name="email" 
            type="email"
            placeholder="Email" 
            value={form.email}
            onChange={handleChange} 
            required
          />
          <input 
            type="password" 
            name="password" 
            placeholder="Password" 
            value={form.password}
            onChange={handleChange} 
            required
          />
          {accountType === "parent" && (
            <input
              name="verificationCode"
              type="text"
              placeholder="Verification Code from Student"
              value={form.verificationCode}
              onChange={handleChange}
              required
            />
          )}
          <button type="submit" className="login-btn">
            {accountType === "parent" ? "Create Parent Account" : "Create Student Account"}
          </button>
        </form>

        <p className="signup-text">
          Already have an account?{" "}
          <span
            className="signup-link"
            onClick={() => {
              if (typeof onGoToLogin === "function") {
                onGoToLogin(accountType);
                return;
              }
              window.location.hash = `login-${accountType}`;
            }}
          >
            Login here
          </span>
        </p>
      </div>
    </div>
  );
}
