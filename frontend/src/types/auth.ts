export interface User {
  email: string;
  displayName: string;
  UID: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateAccountData {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  message: string;
  user: User;
}
