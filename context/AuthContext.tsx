'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (/* credentials? */) => Promise<void>; // Placeholder for actual login logic
  logout: () => void;
  isLoading: boolean; // To handle initial auth state check
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start loading

  // Simulate checking auth status on initial load (e.g., from localStorage/sessionStorage)
  useEffect(() => {
    // Replace with actual check if needed
    const storedAuth = sessionStorage.getItem('isAuthenticated');
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false); // Finished checking
  }, []);

  // Simulate login
  const login = async (/* credentials? */) => {
    setIsLoading(true);
    // TODO: Replace with actual API call to verify credentials
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    console.log("Simulating successful login");
    setIsAuthenticated(true);
    sessionStorage.setItem('isAuthenticated', 'true'); // Persist basic state
    setIsLoading(false);
  };

  const logout = () => {
    setIsLoading(true);
    // TODO: Add API call if backend session needs clearing
    setIsAuthenticated(false);
    sessionStorage.removeItem('isAuthenticated'); // Clear persisted state
    setIsLoading(false);
    // Optionally redirect to login page after logout
    // window.location.href = '/login'; // Or use Next.js router if available in this scope
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, isLoading }}>
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