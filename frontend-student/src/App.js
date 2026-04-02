import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import ParentDashboard from "./pages/ParentDashboard";
import AIChatbot from "./components/AIChatbot";
import ErrorBoundary from "./components/ErrorBoundary";
import { getDashboardSummary } from "./services/api";
import "./App.css";

function App() {
  const initialHash = window.location.hash.replace("#", "");
  const initialType = initialHash.includes("parent") ? "parent" : "student";
  const [currentPage, setCurrentPage] = useState(
    initialHash.startsWith("signup") ? "signup" : "login"
  );
  const [authViewAccountType, setAuthViewAccountType] = useState(initialType);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authRole, setAuthRole] = useState("student");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const studentToken = localStorage.getItem("token");
    const parentToken = localStorage.getItem("parentToken");
    const savedRole = localStorage.getItem("authRole") || "student";

    if (studentToken || parentToken) {
      setIsAuthenticated(true);
      setAuthRole(savedRole);
      setCurrentPage("dashboard");
    }

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith("signup")) {
        setAuthViewAccountType(hash.includes("parent") ? "parent" : "student");
        setCurrentPage("signup");
      } else if (hash.startsWith("login")) {
        setAuthViewAccountType(hash.includes("parent") ? "parent" : "student");
        setCurrentPage("login");
      } else if (hash === "/analytics" || hash === "analytics") {
        if (isAuthenticated && authRole === "student") {
          setCurrentPage("analytics");
          // Fetch latest summary for analytics
          getDashboardSummary().then(setSummary).catch(console.error);
        } else {
          // Redirect to login if not authenticated
          setCurrentPage("login");
        }
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [isAuthenticated, authRole]);

  const goToSignup = (accountType = "student") => {
    setAuthViewAccountType(accountType);
    setCurrentPage("signup");
    window.location.hash = `signup-${accountType}`;
  };

  const goToLogin = (accountType = "student") => {
    setAuthViewAccountType(accountType);
    setCurrentPage("login");
    window.location.hash = `login-${accountType}`;
  };

  const handleLoginSuccess = (role = "student") => {
    setIsAuthenticated(true);
    setAuthRole(role);
    setCurrentPage("dashboard");
  };

  const handleSignupSuccess = (role = "student") => {
    setIsAuthenticated(true);
    setAuthRole(role);
    setCurrentPage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("parentToken");
    localStorage.removeItem("parentUser");
    localStorage.removeItem("authRole");
    setIsAuthenticated(false);
    setAuthRole("student");
    setCurrentPage("login");
  };

  let pageContent;

  if (isAuthenticated && currentPage === "dashboard") {
    pageContent =
      authRole === "parent" ? (
        <ParentDashboard onLogout={handleLogout} />
      ) : (
        <Dashboard onLogout={handleLogout} />
      );
  } else if (isAuthenticated && currentPage === "analytics") {
    pageContent = <Analytics summary={summary} />;
  } else if (currentPage === "signup") {
    pageContent = (
      <Signup
        initialAccountType={authViewAccountType}
        onSignupSuccess={handleSignupSuccess}
        onGoToLogin={goToLogin}
      />
    );
  } else {
    pageContent = (
      <Login
        initialAccountType={authViewAccountType}
        onLoginSuccess={handleLoginSuccess}
        onGoToSignup={goToSignup}
      />
    );
  }

  return (
    <div className="app-shell">
        <ErrorBoundary>
          <main className="app-main-content">{pageContent}</main>
        </ErrorBoundary>
      <AIChatbot />
    </div>
  );
}

export default App;
