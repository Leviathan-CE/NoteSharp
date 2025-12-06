import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/common";

/**
 * 404 Not Found Page
 * 
 * Displays when users navigate to a route that doesn't exist.
 * Provides navigation options to get users back on track.
 */
function NotFound(): React.ReactElement {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate("/");
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="text-9xl font-bold text-indigo-600 mb-4" aria-hidden="true">
            404
          </div>
          <div className="relative inline-block">
            <svg
              className="w-64 h-64 mx-auto text-indigo-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Page Not Found
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Oops! The page you're looking for doesn't exist. It might have been moved or deleted.
          </p>

          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={handleGoHome}
              variant="primary"
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

            <Button
              onClick={handleGoBack}
              variant="secondary"
              className="w-full sm:w-auto px-8 py-3"
              aria-label="Go back to previous page"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Go Back
            </Button>
          </div>
        </div>

        {/* Help Text */}
        <p className="text-gray-600 text-sm">
          If you believe this is an error, please{" "}
          <a
            href="/admin/support"
            className="text-indigo-600 hover:text-indigo-800 underline font-medium"
          >
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default NotFound;
