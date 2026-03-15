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
    <div className="container">
      <div className="card">
        <h1 className="title">Skillspring</h1>
        <p className="subtitle">Smart Skill & Performance Manager</p>

        <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          <button
            type="button"
            className="login-btn"
            style={{
              margin: 0,
              opacity: accountType === "student" ? 1 : 0.65,
              padding: "10px 14px",
            }}
            onClick={() => setAccountType("student")}
          >
            Student
          </button>
          <button
            type="button"
            className="login-btn"
            style={{
              margin: 0,
              opacity: accountType === "parent" ? 1 : 0.65,
              padding: "10px 14px",
              background: "#0d8a6a",
            }}
            onClick={() => setAccountType("parent")}
          >
            Parent
          </button>
        </div>

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

        <p style={{ marginTop: "20px", color: "#666" }}>
          Don't have an account?{" "}
          <span
            style={{ color: "#667eea", cursor: "pointer", fontWeight: "bold" }}
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
