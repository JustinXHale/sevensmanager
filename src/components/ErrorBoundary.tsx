import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = { hasError: boolean; message: string };

/**
 * Catches render errors in child routes so a single bad view doesn’t blank the whole shell.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message || 'Something went wrong.' };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('ErrorBoundary', err, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="card error-boundary-card" role="alert">
          <h2 className="error-boundary-title">Something went wrong</h2>
          <p className="muted error-boundary-msg">{this.state.message}</p>
          <p className="muted error-boundary-hint">Try reloading the page. If this keeps happening, note what you tapped last.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Reload app
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
