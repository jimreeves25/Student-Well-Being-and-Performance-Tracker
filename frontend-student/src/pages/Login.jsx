import React, { useEffect, useState } from "react";
import { loginParent, loginUser } from "../services/api";
import "../styles/Login.css";

function Login({ initialAccountType = "student", onLoginSuccess, onGoToSignup }) {
  const [accountType, setAccountType] = useState(initialAccountType);
    useEffect(() => {
      setAccountType(initialAccountType === "parent" ? "parent" : "student");
    }, [initialAccountType]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const normalizedEmail = email.trim();
    const normalizedPassword = password;

    if (!normalizedEmail || !normalizedPassword) {
      alert("Please fill all fields");
      return;
    }

    setLoading(true);
    try {
      const res =
        accountType === "parent"
          ? await loginParent({ email: normalizedEmail, password: normalizedPassword })
          : await loginUser({ email: normalizedEmail, password: normalizedPassword });

      if (res.token) {
        alert(res.message || "Login successful!");
        onLoginSuccess(accountType);
      } else {
        alert(res.message || "Login failed");
      }
    } catch (err) {
      alert("Login failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`container ${accountType === "parent" ? "parent-mode" : "student-mode"}`}>
      <div className="card">
        <h1 className="title">Skillspring</h1>
        <p className="subtitle">
          {accountType === "parent"
            ? "Guardian Access for live learning insights"
            : "Smart Skill & Performance Manager"}
        </p>

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
            Monitor attendance, focus shifts, and alert timelines from your parent dashboard.
          </p>
        )}

        <input
          type="email"
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? "Logging in..." : `Login as ${accountType === "parent" ? "Parent" : "Student"}`}
        </button>

        <p className="signup-text">
          Don't have an account?{" "}
          <span
            className="signup-link"
            onClick={() => {
              if (typeof onGoToSignup === "function") {
                onGoToSignup(accountType);
                return;
              }
              window.location.hash = `signup-${accountType}`;
            }}
          >
            Sign up here {accountType === "parent" ? "as Parent" : "as Student"}
          </span>
        </p>
      </div>
    </div>
  );
}

export default Login;
