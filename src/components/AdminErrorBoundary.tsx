import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props { onBack: () => void; children: ReactNode; }
interface State { hasError: boolean; error: string; }

/**
 * Error boundary that wraps <AdminDashboard>.
 * Any runtime crash inside the dashboard is caught here and shows a clean
 * fallback UI, so the home page / menu is never affected.
 */
export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error) {
    console.error('[AdminErrorBoundary] Dashboard crashed:', error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: '' });
    this.props.onBack();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
          <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-lg border border-red-100 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
              ⚠️
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Dashboard Error</h2>
            <p className="text-xs text-left text-gray-500 font-mono bg-gray-50 p-3 rounded-lg border break-all mb-6">
              {this.state.error || 'Unknown error'}
            </p>
            <button
              onClick={this.handleReset}
              className="px-6 py-3 bg-gray-900 text-white rounded-full text-sm font-semibold hover:bg-black transition-colors"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
