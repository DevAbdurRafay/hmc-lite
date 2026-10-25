import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Button from './Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl glass-card text-center space-y-4 border border-rose-500/30">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white light:text-slate-900">
              {this.props.fallbackTitle || 'Something went wrong on this view'}
            </h3>
            <p className="text-xs text-slate-400 light:text-slate-600 leading-relaxed">
              {this.state.error?.message || 'A transient rendering issue occurred. Your data is safe.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="glass"
                size="sm"
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={this.handleReset}
              >
                Reload Page
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Home className="w-4 h-4" />}
                onClick={this.handleGoHome}
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
