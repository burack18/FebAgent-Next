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

const STREAM_READ_INTERVAL = 100; // ms delay between stream reads

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null); // Ref for scrolling
  const nextId = useRef(0); // Ref for generating unique message IDs
  // Refs needed for streaming
  const accumulatedTextRef = useRef(''); 
  const currentAiMessageIdRef = useRef<number | null>(null); 
  const streamReaderRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isReadingRef = useRef<boolean>(false); // Prevent overlapping reads

  // Scroll to bottom when messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        console.log('Stream read interval cleared on unmount');
      }
    };
  }, []); 

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const updateMessage = useCallback((messageId: number, newText: string, isLoading = false) => {
      console.log(`Updating message ${messageId}. isLoading: ${isLoading}. Text length: ${newText.length}`);
      setMessages(prevMessages =>
          prevMessages.map(msg =>
              msg.id === messageId
                  ? { ...msg, text: newText, isLoading: isLoading }
                  : msg
          )
      );
  }, []); 

  // --- Function to process a single stream read --- 
  const processChunk = useCallback(async () => {
    if (!streamReaderRef.current || !currentAiMessageIdRef.current) return;

    isReadingRef.current = true;
    let isDone = false;

    try {
      const { value, done } = await streamReaderRef.current.read();
      isDone = done;

      if (value) {
        let dataProcessedInValue = false;
        const lines = value.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            let dataPart = line.substring(5);
            // Simplified: Assume isFirstChunk logic isn't strictly needed with intervals
            if (dataPart) {
              accumulatedTextRef.current += dataPart;
              dataProcessedInValue = true;
            }
          }
        }
        if (dataProcessedInValue) {
          updateMessage(currentAiMessageIdRef.current, accumulatedTextRef.current, true);
        }
      }

      if (done) {
        console.log('Stream finished. Final Text:', JSON.stringify(accumulatedTextRef.current));
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (currentAiMessageIdRef.current !== null) {
           updateMessage(currentAiMessageIdRef.current, accumulatedTextRef.current, false);
        }
        currentAiMessageIdRef.current = null;
        streamReaderRef.current = null; // Clear reader ref
      }

    } catch(readError) {
        console.error("Stream read error:", readError);
        if (intervalRef.current) clearInterval(intervalRef.current);
        setError(`Stream read error: ${readError instanceof Error ? readError.message : 'Unknown error'}`);
        if (currentAiMessageIdRef.current !== null) {
            updateMessage(currentAiMessageIdRef.current, `Error reading stream: ${readError instanceof Error ? readError.message : 'Unknown error'}`, false);
        }
        currentAiMessageIdRef.current = null; 
        streamReaderRef.current = null; 
        isDone = true; // Treat error as done
    } finally {
        isReadingRef.current = false;
    }
  }, [updateMessage]); // Dependencies for the callback

  // --- Interval Callback --- 
  const intervalCallback = useCallback(() => {
    if (isReadingRef.current) {
        console.log("Interval tick skipped, still reading previous chunk.");
        return; // Don't start a new read if the previous one hasn't finished
    }
    processChunk();
  }, [processChunk]); // Dependency


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = inputValue.trim();
    if (trimmedInput === '' || isSending || !API_URL) return;

    setIsSending(true);
    setError(null);

    // Clear previous interval if any
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    isReadingRef.current = false; // Reset reading flag
    streamReaderRef.current = null; // Clear reader ref

    // Reset accumulation for new message
    accumulatedTextRef.current = '';
    currentAiMessageIdRef.current = null; 

    const userMessageId = nextId.current++;
    const newUserMessage: Message = { id: userMessageId, sender: 'user', text: trimmedInput };

    const aiMessageId = nextId.current++; 
    const aiPlaceholderMessage: Message = { id: aiMessageId, sender: 'ai', text: '', isLoading: true }; 
    currentAiMessageIdRef.current = aiMessageId; 

    setMessages(prevMessages => [...prevMessages, newUserMessage, aiPlaceholderMessage]);
    setInputValue('');
    
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

      streamReaderRef.current = response.body.pipeThrough(new TextDecoderStream()).getReader();
      // let isFirstChunk = true; // Can likely remove this if interval is slow enough

      // --- Start the interval to read chunks --- 
      intervalRef.current = setInterval(intervalCallback, STREAM_READ_INTERVAL);

      // Removed the while(true) loop

    } catch (err) {
      // Handle fetch errors (before stream reading starts)
      console.error("Fetch setup error:", err);
      if (intervalRef.current) clearInterval(intervalRef.current);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Response setup error: ${errorMessage}`);
      if (currentAiMessageIdRef.current !== null) {
          updateMessage(currentAiMessageIdRef.current, `Error: ${errorMessage.substring(0, 150)}...`, false);
      }
      currentAiMessageIdRef.current = null; 
      streamReaderRef.current = null; // Clear reader ref
    } finally {
      // Note: setIsSending(false) should ideally happen only after the stream is fully processed or errored.
      // We move this logic to the point where the stream actually finishes (in processChunk or catch blocks).
      // setIsSending(false); 
    }
  };

  // Separate effect to handle setting isSending false when the stream actually ends
  useEffect(() => {
      // Find if any AI message is still loading
      const stillLoading = messages.some(msg => msg.sender === 'ai' && msg.isLoading);
      if (!stillLoading && isSending) {
          // This condition might be too broad if multiple requests could overlap
          // But for a single request model, it works.
          console.log("No AI messages loading, setting isSending to false.");
          setIsSending(false);
      }
  }, [messages, isSending]);

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
                                {/* No pulse animation */} 
                                <div className={`max-w-lg px-4 py-2 rounded-lg shadow ${ 
                                    msg.sender === 'user'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
                                } break-words`}> 
                                    <div> 
                                        <ReactMarkdown 
                                            remarkPlugins={[remarkGfm]} 
                                        >
                                            {textToRender || ''}
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