'use client';

import React, { useState, FormEvent, ChangeEvent, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import { AskRequest, AskResponse } from '@/types/chat'; // Import chat types
import UserMenu from './UserMenu'; // Import UserMenu
import { fetchWithAuth } from '@/utils/fetchWithAuth'; // Import the wrapper

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = inputValue.trim();
    if (trimmedInput === '' || isSending || !API_URL) return;

    setIsSending(true);
    setError(null);

    const userMessageId = nextId.current++;
    const newUserMessage: Message = { id: userMessageId, sender: 'user', text: trimmedInput };

    // Add user message and a *placeholder* for the AI response
    const aiResponseMessageId = nextId.current++;
    const aiPlaceholderMessage: Message = { id: aiResponseMessageId, sender: 'ai', text: '', isLoading: true }; // Start with empty text

    setMessages(prevMessages => [...prevMessages, newUserMessage, aiPlaceholderMessage]);
    setInputValue('');

    try {
      const requestBody: AskRequest = {
        question: trimmedInput,
        sessionKey: SESSION_KEY,
      };

      // Use fetchWithAuth for POST request
      const response = await fetchWithAuth(`${API_URL}/api/v1/agents/ask`, {
        method: 'POST',
        headers: {
          // fetchWithAuth sets Content-Type: application/json by default
          'Accept': 'text/event-stream' // Still need this for SSE
        },
        body: requestBody, // Pass the object, fetchWithAuth handles stringify
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      if (!response.body) {
          throw new Error("Response body is null");
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let accumulatedText = '';
      let isFirstChunk = true; // Flag for first non-empty data chunk

      // Remove loading state for the placeholder message initially
      setMessages(prevMessages =>
        prevMessages.map(msg =>
            msg.id === aiResponseMessageId ? { ...msg, isLoading: false } : msg
        )
      );

      while (true) { 
          const { value, done } = await reader.read();
          if (done) {
              console.log('Stream finished.');
              break; // Exit loop when stream is done
          }

          const lines = value.split('\n\n');
          for (const line of lines) {
              if (line.startsWith('data:')) {
                  let dataPart = line.substring(5); // Get content after "data: "
                  
                  // Trim leading space ONLY for the very first non-empty chunk
                  if (isFirstChunk && dataPart.length > 0) {
                      dataPart = dataPart.trimStart(); 
                      if(dataPart.length > 0) { // Check again after trimStart
                          isFirstChunk = false; // Only trim the first one
                      }
                  }
                  
                  if (dataPart) { // Append if there's content
                    accumulatedText += dataPart;
                    setMessages(prevMessages =>
                        prevMessages.map(msg =>
                            msg.id === aiResponseMessageId
                                ? { ...msg, text: accumulatedText }
                                : msg
                        )
                    );
                  }
              }
          }
      }

    } catch (err) {
      console.error("Failed to send message or process stream:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(`Failed to get response: ${errorMessage}`);
      // Update the placeholder message to show the error
       setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === aiResponseMessageId
            ? { ...msg, text: `Error: ${errorMessage.substring(0, 150)}...`, isLoading: false }
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
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                           {/* Message Bubble */}
                           <div className={`max-w-lg px-4 py-2 rounded-lg shadow ${msg.isLoading ? 'animate-pulse text-gray-500' : ''} ${ 
                                msg.sender === 'user'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
                            } break-words`}>
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
                            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {isSending ? 'Sending...' : 'Send'}
                          </button>
                    </form>
                </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ChatInterface; 