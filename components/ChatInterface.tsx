'use client';

import React, { useState, FormEvent, ChangeEvent, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import { AskRequest, AskResponse } from '@/types/chat'; // Import chat types
import { useAuth } from '@/context/AuthContext'; // Import useAuth

// Use environment variable for API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const SESSION_KEY = "b9d1f620-23c7-4c6e-8d8b-90e2f78c4b44"; // Hardcoded session key for now

interface Message {
  id: number; // Add unique id for messages
  sender: 'user' | 'ai';
  text: string;
  isLoading?: boolean; // Flag for AI thinking message
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null); // Ref for scrolling
  const nextId = useRef(0); // Ref for generating unique message IDs
  const { logout } = useAuth(); // Get logout function

  // Scroll to bottom when messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = inputValue.trim();
    if (trimmedInput === '' || isSending || !API_URL) return;

    setIsSending(true);
    setError(null);

    // Add user message
    const userMessageId = nextId.current++;
    const newUserMessage: Message = { id: userMessageId, sender: 'user', text: trimmedInput };

    // Add temporary AI thinking message
    const aiThinkingMessageId = nextId.current++;
    const aiThinkingMessage: Message = { id: aiThinkingMessageId, sender: 'ai', text: '...', isLoading: true };

    setMessages(prevMessages => [...prevMessages, newUserMessage, aiThinkingMessage]);
    setInputValue(''); // Clear input field immediately

    try {
      const requestBody: AskRequest = {
        question: trimmedInput,
        sessionKey: SESSION_KEY,
      };

      const response = await fetch(`${API_URL}/api/v1/agents/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data: AskResponse = await response.json();

      // Find the text content from the response items
      const aiTextItem = data.items?.find(item => item.$type === 'TextContent');
      const aiResponseText = aiTextItem ? aiTextItem.text : "Sorry, I couldn't get a proper response.";

      // Update the thinking message with the actual response
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === aiThinkingMessageId
            ? { ...msg, text: aiResponseText, isLoading: false }
            : msg
        )
      );

    } catch (err) {
      console.error("Failed to send message or get AI response:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(`Failed to get response: ${errorMessage}`);
      // Update the thinking message to show an error
       setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === aiThinkingMessageId
            ? { ...msg, text: `Error: ${errorMessage.substring(0, 100)}...`, isLoading: false }
            : msg
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
        {/* Chat box */} 
        <div className="relative flex flex-col w-full max-w-3xl h-full max-h-[calc(100vh-4rem)] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
          
          {/* Logout Button (Example Placement: Top Right) */}
          <button 
            onClick={logout}
            className="absolute top-2 right-2 z-10 px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 cursor-pointer"
            title="Logout"
          >
            Logout
          </button>

          {/* Message display area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-10"> {/* Added pt-10 for button space */}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-lg px-4 py-2 rounded-lg shadow ${msg.isLoading ? 'animate-pulse text-gray-500' : ''} ${
                  msg.sender === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {/* Error Display */} 
             {error && (
                <div className="flex justify-start">
                    <div className="max-w-lg px-4 py-2 rounded-lg shadow bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200">
                        <strong>Error:</strong> {error}
                    </div>
                </div>
             )}
            <div ref={messageEndRef} /> {/* Element to scroll to */}
          </div>

          {/* Input area */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <form onSubmit={handleSubmit} className="flex space-x-3">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                placeholder={isSending ? "Waiting for response..." : "Type your message..."}
                disabled={isSending}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isSending || inputValue.trim() === ''}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface; 