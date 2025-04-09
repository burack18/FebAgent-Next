'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Use App Router's navigation
import { useAuth } from '@/context/AuthContext';
import ChatInterface from "@/components/ChatInterface";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If loading is finished and user is not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
    );
  }

  // Only render the ChatInterface if authenticated
  if (isAuthenticated) {
    return (
      <main>
        <ChatInterface />
      </main>
    );
  }

  // Render null or a placeholder if redirecting (avoids flash of unauthenticated content)
  return null; 
}
