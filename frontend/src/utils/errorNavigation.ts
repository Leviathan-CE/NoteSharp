import { NavigateFunction } from "react-router-dom";

/**
 * Navigate to the 500 error page
 * 
 * Use this function to manually navigate to the server error page,
 * typically from error boundaries or catch blocks.
 * 
 * @param navigate - React Router's navigate function
 * @param error - Optional error object to pass to the error page
 * 
 * @example
 * ```tsx
 * import { useNavigate } from 'react-router-dom';
 * import { navigateTo500 } from '../utils/errorNavigation';
 * 
 * function MyComponent() {
 *   const navigate = useNavigate();
 *   
 *   try {
 *     // ... some code
 *   } catch (error) {
 *     navigateTo500(navigate, error);
 *   }
 * }
 * ```
 */
export function navigateTo500(navigate: NavigateFunction, error?: Error): void {
  navigate("/500", {
    state: {
      error,
      errorInfo: error?.stack,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Navigate to the 404 error page
 * 
 * Use this function to manually navigate to the not found page.
 * 
 * @param navigate - React Router's navigate function
 */
export function navigateTo404(navigate: NavigateFunction): void {
  navigate("/404", { replace: true });
}
