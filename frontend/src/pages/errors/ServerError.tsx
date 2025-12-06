import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../../components/common";

interface ServerErrorProps {
  error?: Error;
  resetError?: () => void;
}

/**
 * 500 Server Error Page
 * 
 * Displays when a server error occurs or when explicitly navigated to /500.
 * Can be used with error boundaries to catch and display React errors.
 */
function ServerError({ error, resetError }: ServerErrorProps): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { error?: Error; errorInfo?: any } | undefined;

  // Get error from props or location state
  const displayError = error || state?.error;

  const handleGoHome = () => {
    if (resetError) {
      resetError();
    }
    navigate("/");
  };

  const handleRetry = () => {
    if (resetError) {
      resetError();
    }
    window.location.reload();
  };

  const handleReportIssue = () => {
    navigate("/admin/support");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* 500 Illustration */}
        <div className="mb-8">
          <div className="text-9xl font-bold text-red-600 mb-4" aria-hidden="true">
            500
          </div>
          <div className="relative inline-block">
            <svg
              className="w-64 h-64 mx-auto text-red-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Server Error
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Something went wrong on our end. We're working to fix the issue.
          </p>

          {/* Error Details (Development) */}
          {displayError && process.env.NODE_ENV === 'development' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
              <h2 className="text-sm font-semibold text-red-800 mb-2">
                Error Details (Development Only):
              </h2>
              <p className="text-xs text-red-700 font-mono break-all">
                {displayError.message}
              </p>
              {displayError.stack && (
                <details className="mt-2">
                  <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">
                    Stack Trace
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-40">
                    {displayError.stack}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={handleRetry}
              variant="primary"
              className="w-full sm:w-auto px-8 py-3"
              aria-label="Retry loading the page"
            >
              <svg
                className="w-5 h-5 mr-2 inline-block"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Retry
            </Button>

            <Button
              onClick={handleGoHome}
              variant="secondary"
              className="w-full sm:w-auto px-8 py-3"
              aria-label="Go to home page"
            >
              <svg
                className="w-5 h-5 mr-2 inline-block"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Go Home
            </Button>
          </div>
        </div>

        {/* Help Text */}
        <div className="space-y-2">
          <p className="text-gray-600 text-sm">
            If this problem persists, please{" "}
            <button
              onClick={handleReportIssue}
              className="text-red-600 hover:text-red-800 underline font-medium"
            >
              report the issue
            </button>
            .
          </p>
          <p className="text-gray-500 text-xs">
            Error ID: {Date.now().toString(36).toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ServerError;
