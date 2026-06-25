import React from 'react';

interface Props {
  children: React.ReactNode;
  fallbackPath?: string;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <p className="text-4xl mb-4">😵</p>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
            <p className="text-gray-500 mb-6">This page ran into an error. Try reloading or go back.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition text-sm font-medium"
              >
                Reload Page
              </button>
              <a
                href={this.props.fallbackPath || '/'}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
              >
                {this.props.fallbackLabel || 'Go Home'}
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
