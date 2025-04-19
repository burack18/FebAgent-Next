'use client';

import React, { useState, FormEvent, ChangeEvent, useRef, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import SystemMessagePanel from './SystemMessagePanel';
import { AskRequest, AskResponse } from '@/types/chat'; // Import chat types
import UserMenu from './UserMenu'; // Import UserMenu
import { fetchWithAuth } from '@/utils/fetchWithAuth'; // Import the wrapper
import ReactMarkdown from 'react-markdown'; // Ensure this is imported
import remarkGfm from 'remark-gfm'; // Ensure this is imported

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

  // Scroll to bottom when messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const updateMessage = useCallback((messageId: number, newText: string, isLoading = false) => {
      setMessages(prevMessages =>
          prevMessages.map(msg =>
              msg.id === messageId
                  ? { ...msg, text: newText, isLoading: isLoading }
                  : msg
          )
      );
  }, []); 

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = inputValue.trim();
    if (trimmedInput === '' || isSending || !API_URL) return;

    setIsSending(true);
    setError(null);

    const userMessageId = nextId.current++;
    const newUserMessage: Message = { id: userMessageId, sender: 'user', text: trimmedInput };

    const aiMessageId = nextId.current++; 
    const aiPlaceholderMessage: Message = { id: aiMessageId, sender: 'ai', text: '', isLoading: true }; 

    setMessages(prevMessages => [...prevMessages, newUserMessage, aiPlaceholderMessage]);
    setInputValue('');
    
    try {
      const requestBody: AskRequest = { question: trimmedInput, sessionKey: SESSION_KEY };

      // --- Requesting JSON body, Accepting plain text response ---
      const response = await fetchWithAuth(`${API_URL}/api/v1/agents/ask`, {
        method: 'POST',
        headers: { 
            'Accept': 'text/plain', // Expecting a raw string response
            'Content-Type': 'application/json' // Sending request body as JSON
        },
        body: JSON.stringify(requestBody), 
      });

      if (!response.ok) {
        let errorText = `HTTP error! status: ${response.status}`;
        try {
          // Try to get error details as text
          const errText = await response.text(); 
          errorText = errText || errorText;
        } catch (_) {
          // Ignore if error response cannot be read as text
        }
        throw new Error(errorText);
      }

      // --- Process plain text response --- 
      const aiResponseText = await response.text(); 
      
      updateMessage(aiMessageId, aiResponseText, false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Response error: ${errorMessage}`);
      updateMessage(aiMessageId, `Error: ${errorMessage.substring(0, 150)}...`, false);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Header/Menu Bar */}
          <header className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center">
              {/* Optional: Add Title or Logo here */}
              {/* <h1 className="text-lg font-semibold text-gray-800 dark:text-white">Chat</h1> */}

              {/* Replace Logout button with UserMenu */}
              <UserMenu />
          </header>

          {/* Main Content Area (Chat Box Wrapper) */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden"> 
              {/* Chat box - Removed relative positioning */}
              <div className="flex flex-col w-full max-w-3xl h-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"> 
                
                {/* Message display area - Removed pt-10 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg) => {
                        const textToRender = msg.text;
                        
                        return (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {/* Apply pulse if loading, otherwise show final content */} 
                                <div className={`max-w-lg px-4 py-2 rounded-lg shadow ${msg.isLoading ? 'animate-pulse bg-gray-400 dark:bg-gray-700' : ''} ${ 
                                    !msg.isLoading && msg.sender === 'user'
                                        ? 'bg-blue-500 text-white'
                                        : !msg.isLoading && msg.sender === 'ai'
                                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
                                        : '' // Rely on pulsing background if loading
                                } break-words`}> 
                                    {/* Render text only when not loading */} 
                                    {!msg.isLoading && (
                                        <div> 
                                            <ReactMarkdown 
                                                remarkPlugins={[remarkGfm]} 
                                            >
                                                {textToRender || ''}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                    {/* Optional: Minimum height placeholder during load */} 
                                    {msg.isLoading && <div className="h-4"></div>} 
                                </div>
                            </div>
                        );
                    })}
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
                            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {isSending ? 'Sending...' : 'Send'}
                          </button>
                    </form>
                </div>
              </div>
          </div>
      </div>
      
      <SystemMessagePanel />
    </div>
  );
};

export default ChatInterface; 