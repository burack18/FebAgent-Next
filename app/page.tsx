'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation'; 
import { useAuth } from '@/context/AuthContext';
import ChatInterface from "@/components/ChatInterface";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
    );
  }

  if (isAuthenticated) {
    return (
      <main>
        <ChatInterface />
      </main>
    );
  }

  return null; 
}
