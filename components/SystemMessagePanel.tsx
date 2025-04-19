'use client';

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { fetchWithAuth } from '@/utils/fetchWithAuth';
import { useAuth } from '@/context/AuthContext'; // Assuming useAuth provides currentUser

// Define the expected shape of the SystemMessage object
interface SystemMessageData {
  id?: string; // Optional, might not be needed for POST
  message: string;
  userID: string;
}

// Simple icon for collapse/expand
const ChevronIcon: React.FC<{ isCollapsed: boolean, className?: string }> = ({ isCollapsed, className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`${className} transition-transform duration-300 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
);

// Use environment variable for API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL;
const SYSTEM_MESSAGE_ENDPOINT = `${API_URL}/api/v1/SystemMessage`;

// Component now handles sidebar structure and content
const SystemMessagePanel: React.FC = () => {
  // --- State from Sidebar --- 
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed
  // --- State for Panel Logic --- 
  const [initialMessage, setInitialMessage] = useState<string>('');
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { currentUser } = useAuth();
  const [hasFetched, setHasFetched] = useState<boolean>(false);

  const fetchSystemMessage = useCallback(async () => {
    if (!API_URL || !SYSTEM_MESSAGE_ENDPOINT || !currentUser) {
        setError('Cannot fetch: API URL not configured or user not logged in.');
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    setFeedback(null);
    setHasFetched(true);
    try {
      const response = await fetchWithAuth(SYSTEM_MESSAGE_ENDPOINT);

      // Check for 204 No Content explicitly, or if the response is OK but body might be null/empty
      if (response.status === 204) {
          // No message set, treat as empty
          setInitialMessage('');
          setCurrentMessage('');
      } else if (!response.ok) {
          // Handle actual fetch errors (like 4xx, 5xx)
          let errorText = `Failed to fetch: ${response.status}`;
          try {
              const backendError = await response.text();
              errorText = backendError?.trim() ? backendError : errorText;
          } catch (_) {}
          throw new Error(errorText);
      } else {
          // Response is OK (e.g., 200), try to parse JSON
          const data: SystemMessageData | null = await response.json(); // Allow null

          if (data && data.message) {
              // We got a valid message
              setInitialMessage(data.message);
              setCurrentMessage(data.message);
          } else {
              // Response was OK, but data is null or message is empty/missing
              // Treat as no message set
              setInitialMessage('');
              setCurrentMessage('');
          }
      }

    } catch (err) {
      console.error("Fetch system message error:", err);
      setError(err instanceof Error ? err.message : 'Failed to load system message.');
      // Ensure messages are cleared on error too
      setInitialMessage('');
      setCurrentMessage('');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // useEffect to fetch when isCollapsed becomes false (panel opens)
  useEffect(() => {
    if (!isCollapsed && !hasFetched && !isLoading) { 
      fetchSystemMessage();
    }
  }, [isCollapsed, hasFetched, isLoading, fetchSystemMessage]);

  const handleMessageChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentMessage(event.target.value);
    setFeedback(null);
  };

  const handleSave = async () => {
     if (!currentUser) {
        setError('Cannot save message: User not logged in.');
        return;
    }
    if (!SYSTEM_MESSAGE_ENDPOINT) {
         setError('API URL is not configured.');
         return;
    }

    setIsSaving(true);
    setError(null);
    setFeedback(null);

    const messageToSave: SystemMessageData = {
      message: currentMessage,
      userID: currentUser.userID,
    };

    try {
      const response = await fetchWithAuth(SYSTEM_MESSAGE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: messageToSave,
      });

      if (!response.ok) {
         let errorText = `Failed to save: ${response.status}`;
         try {
            const backendError = await response.text();
            errorText = backendError?.trim() ? backendError : errorText;
         } catch (_) {}
         throw new Error(errorText);
      }
      setInitialMessage(currentMessage);
      setFeedback('System message updated successfully!');

    } catch (err) {
      console.error("Save system message error:", err);
      setError(err instanceof Error ? err.message : 'Failed to save system message.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = currentMessage !== initialMessage;

  // --- Return structure from Sidebar, rendering panel content inside ---
  return (
    <div className={`bg-stone-200 dark:bg-stone-800 p-4 flex flex-col h-full transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-80'}`}>
        {/* Collapse Button */}
        <div className="flex items-center justify-end mb-4">
             <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-pointer"
                title={isCollapsed ? "Expand System Message" : "Collapse System Message"}
             >
                <ChevronIcon isCollapsed={isCollapsed} />
            </button>
        </div>

        {/* Conditionally render the panel content */}
        {!isCollapsed && (
             <div className="flex-1 overflow-y-auto">
                 {/* Panel Content Rendered Here */} 
                 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-0"> {/* Adjusted padding/border maybe */} 
                     {isLoading && <p className="text-gray-600 dark:text-gray-400 p-4">Loading system message...</p>}
                     {!isLoading && (
                       <>
                           <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white px-4 pt-4"> {/* Add padding back here */} 
                               System Message Configuration
                           </h2>
                            <div className="space-y-3 p-4 pt-0"> {/* Add padding back here */} 
                              <textarea
                                rows={8}
                                value={currentMessage || (!hasFetched ? initialMessage : '')}
                                onChange={handleMessageChange}
                                disabled={isSaving}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-70"
                                placeholder="Enter the system message..."
                              />
                              <div className="flex items-center justify-between">
                                <div className="h-5">
                                    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                                    {feedback && <p className="text-sm text-green-600 dark:text-green-400">{feedback}</p>}
                                </div>
                                <button
                                   onClick={handleSave}
                                   disabled={isSaving || !hasChanges}
                                   className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                 >
                                   {isSaving ? 'Saving...' : 'Save Changes'}
                                 </button>
                              </div>
                            </div>
                       </>
                     )}
                      {!isLoading && error && !feedback && (
                           <p className="text-sm text-red-600 dark:text-red-400 px-4 pb-4">{error}</p> // Added padding
                      )}
                 </div> 
             </div>
        )}
        {/* Collapsed state icon */}
        {isCollapsed && (
             <div className="flex justify-center items-center flex-1" title="System Message Settings">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-gray-600 dark:text-gray-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527c.48-.342 1.12-.342 1.6 0l.815.58c.48.343.48 1.016 0 1.358l-.737.527c-.35.25-.542.68-.542 1.11v1.093c0 .43.192.86.542 1.11l.737.527c.48.343.48 1.016 0 1.358l-.815-.58c-.48.343-1.12.343-1.6 0l-.737-.527c-.35-.25-.807-.272-1.205-.108-.396.165-.71.506-.78.93l-.149.894c-.09.542-.56.94-1.11.94h-1.093c-.55 0-1.02-.398-1.11-.94l-.149-.894c-.07-.424-.384-.764-.78-.93-.398-.164-.855-.142-1.205.108l-.737.527c-.48.343-1.12.343-1.6 0l-.815-.58c-.48-.343-.48-1.016 0-1.358l.737-.527c.35-.25.542-.68.542-1.11v-1.093c0-.43-.192-.86-.542-1.11l-.737-.527c-.48-.343-.48-1.016 0-1.358l.815-.58c.48-.343 1.12-.343 1.6 0l.737.527c.35.25.807.272 1.205.108.396-.165.71.506.78.93l.149-.894z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                 </svg>
             </div>
        )}
    </div>
  );
};

export default SystemMessagePanel; 