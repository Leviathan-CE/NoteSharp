export const AUTH_STATE_CHANGED_EVENT = 'auth-state-changed';

export function dispatchAuthStateChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
  }
}
