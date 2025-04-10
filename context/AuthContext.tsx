'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// Interface for credentials passed to login
interface Credentials {
  username?: string;
  password?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: string | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedAuth = sessionStorage.getItem('isAuthenticated');
    const storedUser = sessionStorage.getItem('currentUser');
    console.log('AuthProvider useEffect: storedAuth=', storedAuth, 'storedUser=', storedUser);
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
      setCurrentUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: Credentials) => {
    if (!API_URL) {
        throw new Error("API URL not configured.");
    }
    setIsLoading(true);
    try {
      console.log(`Attempting login for user: ${credentials.username}`);
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
        } catch (_) {}
        console.error('Login API call failed:', errorText);
        throw new Error(errorText);
      }

      const username = credentials.username || "testuser";
      
      console.log(`Login successful for ${username}!`);
      setIsAuthenticated(true);
      setCurrentUser(username);
      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('currentUser', username);
      
    } catch (error) {
        console.error('Login process error:', error);
        throw error; 
    } finally {
        setIsLoading(false);
    }
  };

  const logout = () => {
    setIsLoading(true);
    setIsAuthenticated(false);
    setCurrentUser(null);
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('currentUser');
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUser, login, logout, isLoading }}>
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