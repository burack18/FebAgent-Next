// utils/fetchWithAuth.ts

// Helper function to get token (avoids direct context dependency here)
const getToken = (): string | null => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('authToken'); // Use the same key as in AuthContext
    }
    return null;
};

// Define a type for the options to avoid ambiguity with fetch's RequestInit
type FetchOptions = Omit<RequestInit, 'headers' | 'body'> & {
    headers?: Record<string, string>;
    body?: BodyInit | null | Record<string, any>; // Allow object for body
    isPublic?: boolean; // Flag to bypass adding Authorization header
};

export const fetchWithAuth = async (
    url: string,
    options: FetchOptions = {}
): Promise<Response> => {
    const token = getToken();
    const defaultHeaders: Record<string, string> = {
        // Default to JSON, but allow override
        'Content-Type': 'application/json',
        ...options.headers, // Merge provided headers early
    };

    // Add Authorization header if token exists and it's not a public route
    if (token && !options.isPublic) {
        defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    let processedBody = options.body;

    // Stringify body if it's an object and Content-Type is JSON
    if (typeof processedBody === 'object' && 
        processedBody !== null && 
        !(processedBody instanceof FormData) && // Don't stringify FormData
        !(processedBody instanceof Blob) && // Don't stringify Blob
        !(processedBody instanceof ArrayBuffer) && // Don't stringify ArrayBuffer
        !(processedBody instanceof URLSearchParams) && // Don't stringify URLSearchParams
        defaultHeaders['Content-Type'] === 'application/json') 
    { 
        try {
            processedBody = JSON.stringify(processedBody);
        } catch (error) {
            console.error("Failed to stringify request body:", error);
            throw new Error("Failed to stringify request body");
        }
    }

    // Handle FormData - remove Content-Type as browser sets it
    if (processedBody instanceof FormData) {
        delete defaultHeaders['Content-Type'];
    }

    try {
        const response = await fetch(url, {
            // Spread options but override headers and body
            ...options,
            headers: defaultHeaders,
            body: processedBody as BodyInit | null | undefined, // Cast refined body
        });

        // Optional: Add global error handling for common auth errors
        // if (response.status === 401) {
        //     // Handle unauthorized error, e.g., redirect to login
        //     console.error('Unauthorized request to:', url);
        //     // Potentially call logout() or redirect here
        // }

        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error; // Re-throw the error to be handled by the calling code
    }
}; 