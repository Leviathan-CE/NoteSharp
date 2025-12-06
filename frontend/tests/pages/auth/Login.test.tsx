import React from 'react';
import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Login from '../../../src/pages/auth/Login';
import * as api from '../../../src/services/api';

// Mock the API functions
vi.mock('../../../src/services/api', () => ({
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

const renderLogin = () => {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
};

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form with required inputs', () => {
    renderLogin();
    
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });

  it('calls loginUser API on successful submission', async () => {
    const user = userEvent.setup();
    const mockLoginUser = api.loginUser as jest.Mock;
    
    mockLoginUser.mockResolvedValue({
      message: 'Login successful',
      user: {
        email: 'test@example.com',
        displayName: 'no name user',
        UID: 'test-uid'
      }
    });
    
    renderLogin();
    
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    
    await waitFor(() => {
      expect(mockLoginUser).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('navigates to /board after successful login', async () => {
    const user = userEvent.setup();
    const mockLoginUser = api.loginUser as jest.Mock;
    
    mockLoginUser.mockResolvedValue({
      message: 'Login successful',
      user: {
        email: 'test@example.com',
        displayName: 'no name user',
        UID: 'test-uid'
      }
    });
    
    renderLogin();
    
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Login' }));
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/board');
    }, { timeout: 2000 });
  });

  it('calls loginUser API and re-enables form when login fails', async () => {
    const user = userEvent.setup();
    const mockLoginUser = api.loginUser as jest.Mock;
    
    mockLoginUser.mockRejectedValue(new Error('Invalid credentials'));
    
    renderLogin();
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Login' });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockLoginUser).toHaveBeenCalledWith('test@example.com', 'password123');
    });
    
    // Wait for error handling to complete - form should be re-enabled (finally block runs)
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('disables form inputs during API call', async () => {
    const user = userEvent.setup();
    (api.loginUser as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderLogin();
    
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const submitButton = screen.getByRole('button', { name: 'Login' });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
      expect(submitButton).toBeDisabled();
    });
  });
});

