import React from "react";

/**
 * ErrorBoundary - Catches component errors and displays fallback UI
 * Prevents the entire app from crashing if one component fails
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "20px",
            margin: "10px",
            backgroundColor: "#fee",
            border: "1px solid #fcc",
            borderRadius: "4px",
            color: "#c00",
          }}
        >
          <h3>Something went wrong</h3>
          <p>A component encountered an error. The app is still working, but this section may not display correctly.</p>
          <details style={{ marginTop: "10px", color: "#666" }}>
            <summary>Error details (click to expand)</summary>
            <pre style={{ marginTop: "10px", fontSize: "12px", overflow: "auto" }}>
              {this.state.error?.toString()}
            </pre>
          </details>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: "10px",
              padding: "8px 16px",
              backgroundColor: "#059",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
