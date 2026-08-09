
import { StrictMode, Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

interface RootState {
  hasError: boolean;
  error: Error | null;
}

// Root-Level Error Boundary for fallback representation on complete crashes
class RootErrorBoundary extends Component<{ children: ReactNode }, RootState> {
  override state: RootState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): RootState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Root Crash:", error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "30px", background: "#111", color: "#ff4a4a", fontFamily: "monospace", minHeight: "100vh" }}>
          <h1 style={{ fontSize: "24px" }}>🚨 Fatal Application Crash Caught!</h1>
          <p style={{ color: "#eee" }}>{this.state.error?.toString()}</p>
          <p style={{ color: "#888" }}>Open your browser console (F12) for the full stack trace.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
