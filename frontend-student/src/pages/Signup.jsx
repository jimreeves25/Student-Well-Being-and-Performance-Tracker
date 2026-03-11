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
    const requiresVerification = accountType === "parent";
    const missingBase = !form.name || !form.studentId || !form.email || !form.password;
    if (missingBase || (requiresVerification && !form.verificationCode)) {
      alert("Please fill all fields");
      return;
    }

    try {
      const payload = {
        name: form.name,
        studentId: form.studentId,
        email: form.email,
        password: form.password,
      };

      const res =
        accountType === "parent"
          ? await signupParent({ ...payload, verificationCode: form.verificationCode })
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
    <div className="container">
      <div className="card">
        <h1 className="title">Sign Up</h1>
        <p className="subtitle">Create your {accountType === "parent" ? "Parent" : "Student"} Skillspring account</p>

        <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          <button
            type="button"
            className="login-btn"
            style={{ margin: 0, opacity: accountType === "student" ? 1 : 0.65, padding: "10px 14px" }}
            onClick={() => setAccountType("student")}
          >
            Student
          </button>
          <button
            type="button"
            className="login-btn"
            style={{ margin: 0, opacity: accountType === "parent" ? 1 : 0.65, padding: "10px 14px", background: "#0d8a6a" }}
            onClick={() => setAccountType("parent")}
          >
            Parent
          </button>
        </div>

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
          <button type="submit" className="login-btn">Sign Up</button>
        </form>

        <p style={{ marginTop: "20px", color: "#666" }}>
          Already have an account?{" "}
          <span
            style={{ color: "#667eea", cursor: "pointer", fontWeight: "bold" }}
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
