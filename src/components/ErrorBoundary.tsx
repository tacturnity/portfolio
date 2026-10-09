import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Shared error boundary. Rendered defensively around expensive, fallible
 * subtrees (the WebGL wall, the DOM masonry, etc.) so a single feature crash
 * can never take down the whole portfolio.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught rendering error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-[#111] text-red-400 font-mono min-h-screen z-50 relative">
          <h1 className="text-2xl font-bold mb-4">🚨 Rendering exception caught</h1>
          <p className="text-white text-lg mb-2">{this.state.error?.toString()}</p>
          <pre className="bg-black/80 p-4 rounded border border-zinc-800 text-xs text-zinc-300 overflow-auto">
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;