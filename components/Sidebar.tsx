import React, { useState, useEffect, useCallback } from 'react';
import { ApiDocument } from '@/types/document'; // Uses updated type
import UploadModal from './UploadModal'; // Import the modal component
import ConfirmModal from './ConfirmModal'; // Import ConfirmModal
import { fetchWithAuth } from '@/utils/fetchWithAuth'; // Import the wrapper

const TrashIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12.576 0a48.108 48.108 0 013.478-.397m7.5 0a.75.75 0 00-.75-.75h-4.5a.75.75 0 00-.75.75M19.5 6l-2.734 12.74a.75.75 0 01-1.43.03L15 6h4.5M4.5 6l2.734 12.74a.75.75 0 001.43.03L9 6H4.5z" />
  </svg>
);

const PlusIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface ConfirmModalState {
  isOpen: boolean;
  docIdToDelete: string | null;
  docNameToDelete: string | null;
}

const Sidebar: React.FC = () => {
  const [documents, setDocuments] = useState<ApiDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); // State for modal visibility
  const [isDeleting, setIsDeleting] = useState(false); // Loading state for delete
  const [confirmModalState, setConfirmModalState] = useState<ConfirmModalState>({ // State for confirmation modal
    isOpen: false,
    docIdToDelete: null,
    docNameToDelete: null,
  });

  const fetchDocuments = useCallback(async () => {
    if (!API_URL) {
      setError('API URL is not configured.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/v1/documents`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: ApiDocument[] = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Expected an array of documents');
      }
      const sortedData = data.sort((a, b) => {
        const nameA = a.documentName || '';
        const nameB = b.documentName || '';
        return nameA.localeCompare(nameB);
      });
      setDocuments(sortedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();

  }, [fetchDocuments]);

  const filteredDocuments = documents.filter(doc =>
    doc.documentName && typeof doc.documentName === 'string' &&
    doc.documentName.toLowerCase().includes(searchTerm.toLowerCase())
  );


  const handleDeleteClick = (docId: string, docName: string) => {
    setConfirmModalState({
      isOpen: true,
      docIdToDelete: docId,
      docNameToDelete: docName,
    });
  };

  const confirmDelete = async () => {
    if (!confirmModalState.docIdToDelete || !API_URL) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetchWithAuth(`${API_URL}/api/v1/documents/${encodeURIComponent(confirmModalState.docIdToDelete)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let errorText = `Status: ${response.status}`;
        try {
          const backendError = await response.text();
          errorText = backendError || errorText;
        } catch (_) { }
        setError(`Failed to delete document: ${errorText}`);
      } else {
        setConfirmModalState({ isOpen: false, docIdToDelete: null, docNameToDelete: null });
        await fetchDocuments();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'An unexpected error occurred during deletion.');
    } finally {
      setIsDeleting(false);
    }
  };
  const refreshDocuments = async () => {
    await fetchDocuments();
  }

  const handleFileUpload = async (file: File) => {
    if (!API_URL) {
      throw new Error('API URL not configured.');
    }

    const formData = new FormData();
    formData.append(file.name, file);

    try {
      const response = await fetchWithAuth(`${API_URL}/api/v1/documents/loadDocuments`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorText = `Status: ${response.status}`;
        try {
          const backendError = await response.text();
          errorText = backendError || errorText;
        } catch (_) { }
        throw new Error(`Upload failed: ${errorText}`);
      }

      await fetchDocuments();

    } catch (uploadError) {
      throw uploadError instanceof Error ? uploadError : new Error('An unexpected error occurred during upload.');
    }
  };

  return (
    <>
      <div className={`bg-neutral-200 dark:bg-neutral-800 p-4 flex flex-col h-full hidden md:flex transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-80'}`}>
        <div className="flex items-center justify-between mb-4">
          {!isCollapsed && <h2 className="text-lg font-semibold text-gray-800 dark:text-white whitespace-nowrap">My Documents</h2>}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* Content Area - Conditionally Rendered/Styled */}
        <div className={`flex-1 flex flex-col overflow-hidden ${isCollapsed ? 'items-center' : ''}`}>
          {!isCollapsed && (
            <div className="mb-4 flex flex-col space-y-2">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center justify-center space-x-1 w-full px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                title="Upload New Document"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Add Document</span>
              </button>
            </div>
          )}
          {/* Upload button when collapsed */}
          {isCollapsed && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="mb-4 p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              title="Upload New Document"
            >
              <PlusIcon className="w-5 h-5" />
            </button>
          )}

          <div className="flex-1 overflow-y-auto pr-1 w-full"> {/* Added slight padding for scrollbar */}
            {!isCollapsed && (
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300">
                  Documents
                </h3>
                <button
                  onClick={refreshDocuments}
                  className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  title="Refresh"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 cursor-pointer"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12a7.5 7.5 0 0113.036-5.303m0 0H15m2.536 0v3"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 12a7.5 7.5 0 01-13.036 5.303m0 0H9m-2.536 0v-3"
                    />
                  </svg>
                </button>
              </div>
            )}

            {isLoading && !isCollapsed && <div className="text-gray-500 dark:text-gray-400 px-2 py-1">Loading...</div>}
            {error && !isCollapsed && <div className="text-red-500 dark:text-red-400 px-2 py-1">Error loading: {error}</div>}

            {!isLoading && !error && (
              <ul className="space-y-1">
                {filteredDocuments.map((doc) => (
                  <li key={doc.id} className={`rounded-md ${isCollapsed ? 'flex justify-center items-center w-10 h-10 hover:bg-slate-300 dark:hover:bg-slate-700' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                    <div className={`flex items-center justify-between w-full ${isCollapsed ? 'justify-center' : 'p-2'}`}>
                      <a href="#" className={`text-gray-800 dark:text-gray-200 ${isCollapsed ? 'hidden' : 'hover:text-blue-600 dark:hover:text-blue-400 text-sm truncate flex-grow mr-2 cursor-pointer'}`} title={doc.documentName}>
                        {doc.documentName}
                      </a>
                      {isCollapsed && (
                        <span title={doc.documentName} className="text-gray-700 dark:text-gray-300 font-bold cursor-pointer">{doc.documentName?.charAt(0).toUpperCase() || 'D'}</span>
                      )}
                      {!isCollapsed && (
                        <button
                          onClick={() => handleDeleteClick(doc.id, doc.documentName)}
                          className="flex-shrink-0 p-1 rounded text-gray-500 hover:text-red-600 dark:hover:text-red-500 hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                          title="Delete Document"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                {filteredDocuments.length === 0 && !isCollapsed && !isLoading && (
                  <li className="text-gray-500 dark:text-gray-400 text-sm italic px-2 py-1">No documents found.</li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>

      <UploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFileUpload={handleFileUpload}
      />

      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        onClose={() => {
          if (!isDeleting) {
            setConfirmModalState({ isOpen: false, docIdToDelete: null, docNameToDelete: null });
            setError(null);
          }
        }}
        onConfirm={confirmDelete}
        title="Confirm Deletion"
        message={
          <>Are you sure you want to delete the document: <br /> <strong className='mt-1 inline-block'>{confirmModalState.docNameToDelete ?? ''}</strong>?</>
        }
        confirmText="Delete"
        isPerformingAction={isDeleting}
      />
    </>
  );
};

export default Sidebar; 