'use client';

import React, { useState, FormEvent, ChangeEvent, useRef, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import SystemMessagePanel from './SystemMessagePanel';
import { AskRequest, AskResponse, Service } from '@/types/chat';
import UserMenu from './UserMenu';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/button';
import { privateDecrypt } from 'crypto';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const SESSION_KEY = "b9d1f620-23c7-4c6e-8d8b-90e2f78c4b44";

interface Message {
  id: number;
  sender: 'user' | 'ai';
  text: string;
  isLoading?: boolean;
  aiProcess: boolean;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [smartMessages, setSmartMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { service } = useAuth(); // Ensure AuthContext is used to get the service
  const messageEndRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, smartMessages]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };
  const clearMessages = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsSending(true);
    setError(null);
    try {

      const response = await fetchWithAuth(`${API_URL}/api/v1/agents/clearhistory`, {
        method: 'POST',
        headers: {
          'Accept': 'text/plain',
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        let errorText = `HTTP error! status: ${response.status}`;
        try {

          const errText = await response.text();
          errorText = errText || errorText;
        } catch (_) {
        }
        throw new Error(errorText);
      }
      setMessages([]);
      setSmartMessages([])
      setInputValue('');
      setIsSending(false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Response error: ${errorMessage}`);
    }
  }
  const updateStandartMessage = useCallback((messageId: number, newText: string, isLoading = false, aiprocess: boolean = false) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === messageId
          ? { ...msg, text: newText, isLoading: isLoading, aiProcess: aiprocess }
          : msg
      )
    );
  }, []);

  const updateSmartdatMessage = useCallback((messageId: number, newText: string, isLoading = false, aiProcess: boolean = false) => {
    setSmartMessages(prevMessages => {
      return prevMessages.map(msg =>
        msg.id === messageId
          ? { ...msg, text: newText, isLoading: isLoading, aiProcess: aiProcess }
          : msg
      )
    });
  }, []);

  const streamEx = async (question: string) => {
    const requestBody: AskRequest = { question: question, sessionKey: SESSION_KEY, service: service };
    const userMessageId = nextId.current++;
    const newUserMessage: Message = { id: userMessageId, sender: 'user', text: question, aiProcess: false };

    const aiSmartMessageId = nextId.current++;
    const aiSmartPlaceholderMessage: Message = { id: aiSmartMessageId, sender: 'ai', text: '', isLoading: true, aiProcess: true };
    setSmartMessages(prevMessages => [...prevMessages, newUserMessage, aiSmartPlaceholderMessage]);
    let fullText = '';
    let aiProcess = true;
    const response = await fetchWithAuth(`${API_URL}/api/v1/agents/ask-smart-stream`, {
      method: 'POST',
      headers: {
        'Accept': 'text/plain',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok || !response.body) {
      console.error('Failed to fetch stream');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;

      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        
        if (chunk.indexOf('PREQUESTIONEND') >= 0 ) {
          const responseStart = chunk.indexOf('PREQUESTIONEND') + 'PREQUESTIONEND'.length;
          fullText = chunk.slice(responseStart);
          aiProcess = false;
        }
        if (fullText.indexOf('PREQUESTIONEND') >= 0 ) {
          const responseStart = fullText.indexOf('PREQUESTIONEND') + 'PREQUESTIONEND'.length;
          fullText = fullText.slice(responseStart);
          aiProcess = false;
        }
        updateSmartdatMessage(aiSmartMessageId, fullText, false, aiProcess)
      }
    }
    setIsSending(false)

  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = inputValue.trim();
    if (trimmedInput === '' || isSending || !API_URL) return;

    setIsSending(true);
    setError(null);
    setInputValue('');

    // fetchSmartResponse(trimmedInput);
    fetchStadartResponse(trimmedInput);
    streamEx(trimmedInput)
  };
  const fetchSmartResponse = async (question: string) => {
    const userMessageId = nextId.current++;
    const newUserMessage: Message = { id: userMessageId, sender: 'user', text: question, aiProcess: false };

    const aiSmartMessageId = nextId.current++;
    const aiSmartPlaceholderMessage: Message = { id: aiSmartMessageId, sender: 'ai', text: '', isLoading: true, aiProcess: true };
    setSmartMessages(prevMessages => [...prevMessages, newUserMessage, aiSmartPlaceholderMessage]);

    try {
      const requestBody: AskRequest = { question: question, sessionKey: SESSION_KEY, service: service };

      const response = await fetchWithAuth(`${API_URL}/api/v1/agents/ask-smart`, {
        method: 'POST',
        headers: {
          'Accept': 'text/plain',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
      });


      if (!response.ok) {
        let errorText = `HTTP error! status: ${response.status}`;
        try {
          const errText = await response.text();
          errorText = errText || errorText;
        } catch (_) {
        }
        throw new Error(errorText);
      }

      const aiSmartResponseText = await response.text();
      updateSmartdatMessage(aiSmartMessageId, aiSmartResponseText, false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Response error: ${errorMessage}`);
      updateSmartdatMessage(aiSmartMessageId, `Error: ${errorMessage.substring(0, 150)}...`, false);
    } finally {
      setIsSending(false);
    }

  }
  const fetchStadartResponse = async (question: string) => {
    const userMessageId = nextId.current++;
    const newUserMessage: Message = { id: userMessageId, sender: 'user', text: question, aiProcess: false };
    const aiMessageId = nextId.current++;
    const aiPlaceholderMessage: Message = { id: aiMessageId, sender: 'ai', text: '', isLoading: true, aiProcess: true };
    setMessages(prevMessages => [...prevMessages, newUserMessage, aiPlaceholderMessage]);

    try {
      const requestBody: AskRequest = { question: question, sessionKey: SESSION_KEY, service: service };

      const response = await fetchWithAuth(`${API_URL}/api/v1/agents/ask`, {
        method: 'POST',
        headers: {
          'Accept': 'text/plain',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
      });

      const aiResponseText = await response.text();

      updateStandartMessage(aiMessageId, aiResponseText, false);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Response error: ${errorMessage}`);
      updateStandartMessage(aiMessageId, `Error: ${errorMessage.substring(0, 150)}...`, false);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">

        <header className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center">
          <UserMenu />
        </header>

        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          <div className="flex flex-col w-full max-w-3xl h-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className='flex w-full max-w-3xl h-full'>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 border-r-2">
                <h1>Standart</h1>
                {messages.map((msg) => {
                  const textToRender = msg.text;

                  return (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-lg px-4 py-2 rounded-lg shadow ${msg.isLoading ? 'animate-pulse bg-gray-400 dark:bg-gray-700' : ''} ${!msg.isLoading && msg.sender === 'user'
                        ? 'bg-blue-500 text-white'
                        : !msg.isLoading && msg.sender === 'ai'
                          ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
                          : ''
                        } break-words`}>
                        {!msg.isLoading && (
                          <div>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                            >
                              {textToRender || ''}
                            </ReactMarkdown>
                          </div>
                        )}
                        {msg.isLoading && <div className="h-4">Thinking...</div>}
                      </div>
                    </div>
                  );
                })}
                {error && (
                  <div className="flex justify-start">
                    <div className="max-w-lg px-4 py-2 rounded-lg shadow bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200">
                      <strong>Error:</strong> {error}
                    </div>
                  </div>
                )}
                <div ref={messageEndRef} />
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <h1>Smart</h1>
                {smartMessages.map((msg) => {
                  const textToRender = msg.text;

                  return (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} ${msg.aiProcess ? 'opacity-50' : 'opacity-100'}`}>
                      <div className={`max-w-lg px-4 py-2 rounded-lg shadow ${msg.isLoading ? 'animate-pulse bg-gray-400 dark:bg-gray-700' : ''} ${!msg.isLoading && msg.sender === 'user'
                        ? 'bg-blue-500 text-white'
                        : !msg.isLoading && msg.sender === 'ai'
                          ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
                          : ''
                        } break-words`}>
                        {!msg.isLoading && (
                          <div>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                            >
                              {textToRender || ''}
                            </ReactMarkdown>
                          </div>
                        )}
                        {msg.isLoading && <div className="h-4">Thinking...</div>}
                      </div>
                    </div>
                  );
                })}
                {error && (
                  <div className="flex justify-start">
                    <div className="max-w-lg px-4 py-2 rounded-lg shadow bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200">
                      <strong>Error:</strong> {error}
                    </div>
                  </div>
                )}
                <div ref={messageEndRef} />
              </div>
            </div>
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
                <Button
                  type='button'
                  onClick={(e) => clearMessages(e)}
                  disabled={isSending || messages.length === 0}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  Clear Chat
                </Button>
                <Button
                  type="submit"
                  disabled={isSending || inputValue.trim() === ''}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSending ? 'Sending...' : 'Send'}
                </Button>
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