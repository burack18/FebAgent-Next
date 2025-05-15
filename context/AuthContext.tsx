'use client';

import { Service } from '@/types/chat';
import { User } from '@/types/user';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Interface for credentials passed to login
interface Credentials {
  username?: string;
  password?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser?: User;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  getToken: () => string | null;
  service: Service; // Added service to the context,
  setService: React.Dispatch<React.SetStateAction<Service>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const TOKEN_STORAGE_KEY = 'authToken';
const EXPIRATION_STORAGE_KEY = 'authTokenExpiration';
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User>();
  const [isLoading, setIsLoading] = useState(true);
  const [service , setService] = useState(Service.ChatGPT); 

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const currentUserString = sessionStorage.getItem('currentUser')||'';

    
    if (storedToken) {
      try {
        const user: User = JSON.parse(currentUserString) || '{}';
        setIsAuthenticated(true);
        setCurrentUser(user);
      } catch (error) {
        setIsAuthenticated(false);
        setCurrentUser(undefined);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(EXPIRATION_STORAGE_KEY);
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('currentUser');
      }
    } else {
      setIsAuthenticated(false);
      setCurrentUser(undefined);
    }
    setIsLoading(false);
  }, [service]);

  const getToken = (): string | null => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    }
    return null;
  };

  const login = async (credentials: Credentials) => {
    if (!API_URL) {
      throw new Error("API URL not configured.");
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/Auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        let errorText = `Login failed with status: ${response.status}`;
        try {
          const backendError = await response.text();
          errorText = backendError?.trim() ? backendError : errorText;
        } catch (_) { }
        throw new Error(errorText);
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error("Login successful, but token was not provided by the server.");
      }

      const user = data;

      setIsAuthenticated(true);
      setCurrentUser(user);
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      localStorage.setItem(EXPIRATION_STORAGE_KEY, data.expiration);
      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('currentUser', JSON.stringify(user)); // Store username in session storage

    } catch (error) {
      setIsAuthenticated(false);
      setCurrentUser(undefined);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(EXPIRATION_STORAGE_KEY);
      sessionStorage.removeItem('isAuthenticated');
      sessionStorage.removeItem('currentUser');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setIsLoading(true);
    setIsAuthenticated(false);
    setCurrentUser(undefined);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(EXPIRATION_STORAGE_KEY);
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('currentUser');
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUser, login, logout, isLoading, getToken,service,setService }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 