import React from 'react';
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import CreateAccount from '../../../src/pages/auth/CreateAccount';
import * as api from '../../../src/services/api';

// Mock the API functions
vi.mock('../../../src/services/api', () => ({
  createAccount: vi.fn(),
  loginUser: vi.fn(),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock the common components
vi.mock('../../../src/components/common', () => ({
  Button: ({ children, type, disabled, className, ...props }: any) => (
    <button type={type} disabled={disabled} className={className} {...props}>
      {children}
    </button>
  ),
  Input: ({ label, type, value, onChange, required, disabled, minLength, ...props }: any) => (
    <div>
      <label htmlFor={label.toLowerCase()}>{label}</label>
      <input
        id={label.toLowerCase()}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        minLength={minLength}
        {...props}
      />
    </div>
  ),
}));

const renderCreateAccount = () => {
  return render(
    <BrowserRouter>
      <CreateAccount />
    </BrowserRouter>
  );
};

describe('CreateAccount Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with required inputs', () => {
    renderCreateAccount();
    
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('prevents API call when passwords do not match', async () => {
    const user = userEvent.setup();
    const mockCreateAccount = api.createAccount as jest.Mock;
    
    renderCreateAccount();
    
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'differentpassword');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    
    expect(mockCreateAccount).not.toHaveBeenCalled();
  });

  it('prevents API call when password is too short', async () => {
    const user = userEvent.setup();
    const mockCreateAccount = api.createAccount as jest.Mock;
    
    renderCreateAccount();
    
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), '123');
    await user.type(screen.getByLabelText('Confirm Password'), '123');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    
    expect(mockCreateAccount).not.toHaveBeenCalled();
  });

  it('calls createAccount and loginUser APIs on successful submission', async () => {
    const user = userEvent.setup();
    const mockCreateAccount = api.createAccount as jest.Mock;
    const mockLoginUser = api.loginUser as jest.Mock;
    
    mockCreateAccount.mockResolvedValue({
      email: 'test@example.com',
      displayName: 'no name user',
      UID: 'test-uid'
    });
    
    mockLoginUser.mockResolvedValue({
      email: 'test@example.com',
      displayName: 'no name user',
      UID: 'test-uid'
    });
    
    renderCreateAccount();
    
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    
    await waitFor(() => {
      expect(mockCreateAccount).toHaveBeenCalledWith('test@example.com', 'password123');
    });
    
    await waitFor(() => {
      expect(mockLoginUser).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('calls createAccount API but does not call loginUser when API call fails', async () => {
    const user = userEvent.setup();
    const mockCreateAccount = api.createAccount as jest.Mock;
    const mockLoginUser = api.loginUser as jest.Mock;
    
    // Validation passes (passwords match), but API call fails
    mockCreateAccount.mockRejectedValue(new Error('Email already exists'));
    
    renderCreateAccount();
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123'); // Passwords match - validation passes
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockCreateAccount).toHaveBeenCalledWith('test@example.com', 'password123');
    });
    
    // Wait for error handling to complete - form should be re-enabled (finally block runs)
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
    
    // loginUser should not be called when createAccount fails (proves error path was taken)
    expect(mockLoginUser).not.toHaveBeenCalled();
  });

  it('does not navigate when login fails after successful account creation', async () => {
    const user = userEvent.setup();
    const mockCreateAccount = api.createAccount as jest.Mock;
    const mockLoginUser = api.loginUser as jest.Mock;
    
    mockCreateAccount.mockResolvedValue({
      email: 'test@example.com',
      displayName: 'no name user',
      UID: 'test-uid'
    });
    
    mockLoginUser.mockRejectedValue(new Error('Login failed'));
    
    renderCreateAccount();
    
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    
    await waitFor(() => {
      expect(mockCreateAccount).toHaveBeenCalled();
      expect(mockLoginUser).toHaveBeenCalled();
    });
    
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('disables form inputs during API call', async () => {
    const user = userEvent.setup();
    (api.createAccount as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderCreateAccount();
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(confirmPasswordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });
  });
});
