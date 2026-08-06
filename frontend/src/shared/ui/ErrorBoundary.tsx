import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (err: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the console so a developer can see the real stack
    // in the dev tools. The reporter in `src/auth/api.ts` also
    // captures unhandled rejections.
    if (typeof console !== 'undefined') {
      console.error('CitizenErrorBoundary caught', error, info);
    }
  }

  reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:py-10">
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-6"
          >
            <h2 className="text-base font-semibold text-rose-900">Something went wrong</h2>
            <p className="mt-1 text-sm text-rose-700">
              The citizen app hit an unexpected error. Please refresh, or report it from the
              settings page.
            </p>
            <p className="mt-2 text-xs text-rose-600">{this.state.error.message}</p>
            <button
              type="button"
              onClick={this.reset}
              className="mt-4 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
