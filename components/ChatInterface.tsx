'use client';

import React, { useState, FormEvent, ChangeEvent, useRef, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
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
  // State for the ID of the AI message currently being streamed
  const [activeAiMessageId, setActiveAiMessageId] = useState<number | null>(null); 
  // State for the text currently being displayed for the streaming message
  const [streamingAiText, setStreamingAiText] = useState<string>(''); 
  const accumulatedTextRef = useRef('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const displayedLengthRef = useRef(0); // Track visually displayed length

  // Scroll to bottom when messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Top-level useEffect for cleaning up the animation interval on unmount
  useEffect(() => {
    // Return a cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        console.log('Animation interval cleared on unmount');
      }
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  // Function to update a specific message in the main list (memoized)
  const updateMessage = useCallback((messageId: number, newText: string, isLoading = false) => {
      setMessages(prevMessages =>
          prevMessages.map(msg =>
              msg.id === messageId
                  ? { ...msg, text: newText, isLoading: isLoading }
                  : msg
          )
      );
  }, []); // Empty dependency array, setMessages is stable

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = inputValue.trim();
    if (trimmedInput === '' || isSending || !API_URL) return;

    setIsSending(true);
    setError(null);
    // Clear previous streaming state before starting new request
    if (intervalRef.current) clearInterval(intervalRef.current);
    accumulatedTextRef.current = '';
    displayedLengthRef.current = 0; // Reset displayed length
    setStreamingAiText('');
    setActiveAiMessageId(null);

    const userMessageId = nextId.current++;
    const newUserMessage: Message = { id: userMessageId, sender: 'user', text: trimmedInput };

    // Get ID for the *next* AI message placeholder
    const currentAiMessageId = nextId.current++; 
    const aiPlaceholderMessage: Message = { id: currentAiMessageId, sender: 'ai', text: '', isLoading: true }; 

    setMessages(prevMessages => [...prevMessages, newUserMessage, aiPlaceholderMessage]);
    setInputValue('');
    
    // Set this as the active streaming message ID
    setActiveAiMessageId(currentAiMessageId); 

    try {
      const requestBody: AskRequest = { question: trimmedInput, sessionKey: SESSION_KEY };

      const response = await fetchWithAuth(`${API_URL}/api/v1/agents/ask`, {
        method: 'POST',
        headers: { 'Accept': 'text/event-stream' },
        body: requestBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      if (!response.body) { throw new Error("Response body is null"); }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let isFirstChunk = true;
      updateMessage(currentAiMessageId, '', false); // Remove loading state

      // --- Smoother Character Animation Logic --- 
      const animationInterval = 50; // Update UI faster (e.g., every 50ms)
      const charsPerInterval = 3; // Render N chars per interval
      // Clear any *existing* interval before starting a new one
      if (intervalRef.current) clearInterval(intervalRef.current);
      
      intervalRef.current = setInterval(() => {
        // Check if there's new text accumulated that hasn't been displayed
        if (displayedLengthRef.current < accumulatedTextRef.current.length) {
          const nextCharIndex = displayedLengthRef.current;
          const charsToAdd = Math.min(
            charsPerInterval,
            accumulatedTextRef.current.length - displayedLengthRef.current
          );
          const nextTextChunk = accumulatedTextRef.current.substring(nextCharIndex, nextCharIndex + charsToAdd);
          
          setStreamingAiText((prev) => prev + nextTextChunk);
          displayedLengthRef.current += charsToAdd;
        } else {
          // Optional: If buffer caught up, could temporarily slow down interval?
          // For now, it just checks again quickly.
        }
      }, animationInterval);
      // --- End Animation Logic --- 

      while (true) { 
          const { value, done } = await reader.read();
          
          // Append received data to the ref (doesn't trigger render)
          if (value) {
              const lines = value.split('\n\n');
              for (const line of lines) {
                  if (line.startsWith('data:')) {
                      let dataPart = line.substring(5);
                      if (isFirstChunk && dataPart.length > 0) {
                          dataPart = dataPart.trimStart();
                          if (dataPart.length > 0) { isFirstChunk = false; }
                      }
                      if (dataPart) {
                          accumulatedTextRef.current += dataPart;
                      }
                  }
              }
          }
          
          if (done) {
              console.log('Stream finished.');
              // Ensure interval finishes rendering remaining text
              const finalCheckInterval = setInterval(() => {
                  if (displayedLengthRef.current >= accumulatedTextRef.current.length) {
                      clearInterval(finalCheckInterval);
                      if (intervalRef.current) clearInterval(intervalRef.current); // Clear main interval
                      intervalRef.current = null; // Set ref to null after clearing
                      updateMessage(currentAiMessageId, accumulatedTextRef.current, false); 
                      setActiveAiMessageId(null);
                      console.log('Animation complete.');
                  }
              }, animationInterval / 2);
              break; // Exit the reading loop
          }
      }

    } catch (err) {
      if (intervalRef.current) clearInterval(intervalRef.current); 
      intervalRef.current = null; // Set ref to null after clearing
      console.error("Stream error:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Response error: ${errorMessage}`);
      // Update the specific message that failed
      updateMessage(currentAiMessageId, `Error: ${errorMessage.substring(0, 150)}...`, false); 
      setActiveAiMessageId(null); // Stop highlighting as active
    } finally {
      setIsSending(false);
      // --- REMOVED INVALID useEffect CALL FROM HERE --- 
      // We still need to potentially clear the interval if the try block 
      // finishes but the 'done' condition wasn't met yet, although the 
      // finalCheckInterval logic should handle most cases.
      // The top-level useEffect handles unmount cleanup.
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
                        // Log the text being passed to ReactMarkdown
                        const textToRender = (msg.sender === 'ai' && msg.id === activeAiMessageId) 
                                            ? streamingAiText 
                                            : msg.text;
                        if (msg.sender === 'ai') { // Only log AI messages
                            console.log(`Rendering AI Msg ID ${msg.id}:`, JSON.stringify(textToRender));
                        }
                        
                        return (
                            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-lg px-4 py-2 rounded-lg shadow ${msg.isLoading ? 'animate-pulse' : ''} ${ 
                                    msg.sender === 'user'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
                                } break-words`}>
                                    {/* Restoring ReactMarkdown, NO prose class on wrapper */}
                                    <div> {/* Simple wrapper div, no prose */}
                                        <ReactMarkdown 
                                            remarkPlugins={[remarkGfm]} 
                                        >
                                            {textToRender}
                                        </ReactMarkdown>
                                    </div>
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
    </div>
  );
};

export default ChatInterface; 