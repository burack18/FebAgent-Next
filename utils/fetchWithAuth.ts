// utils/fetchWithAuth.ts

// Helper function to get token 
const getTokenInfo = (): { token: string | null; expiration: string | null } => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken');
        const expiration = localStorage.getItem('authTokenExpiration'); // Key for expiration
        return { token, expiration };
    }
    return { token: null, expiration: null };
};

// Function to handle logout (can be expanded)
const logoutUser = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authTokenExpiration');
        // Redirect to login page
        //window.location.href = '/login'; // Adjust route if needed // <-- RE-ENABLED REDIRECT
        // console.log("Redirect to login page temporarily disabled for debugging."); // Removed log
    }
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

    // Check token validity unless it's a public route
    if (!options.isPublic) {
        const { token, expiration } = getTokenInfo();
        if (!token || !expiration) {
            logoutUser();
            throw new Error('User is not authenticated.'); 
        }

        try {
            const expirationDate = new Date(expiration);
            if (isNaN(expirationDate.getTime())) {
                 console.error('Invalid expiration date format stored:', expiration);
                 logoutUser();
                 throw new Error('Invalid token expiration date format.');
            }

            // Check if token is expired
            if (expirationDate <= new Date()) {
                logoutUser();
                throw new Error('Token expired.');
            }
            
            // Token is valid, proceed

        } catch (error) {
             // Handle potential errors during date parsing or comparison
             console.error('Error checking token expiration:', error);
             logoutUser(); // Log out if unsure about validity
             throw new Error('Error validating token.');
        }
    }

    // --- Original Fetch Logic (with slight adjustment for token access) --- 
    const tokenForHeader = options.isPublic ? null : getTokenInfo().token;

    const defaultHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers, 
    };

    if (tokenForHeader && !options.isPublic) { // Check again (redundant but safe)
        defaultHeaders['Authorization'] = `Bearer ${tokenForHeader}`;
    }

    let processedBody = options.body;

    if (typeof processedBody === 'object' && 
        processedBody !== null && 
        !(processedBody instanceof FormData) && 
        !(processedBody instanceof Blob) && 
        !(processedBody instanceof ArrayBuffer) && 
        !(processedBody instanceof URLSearchParams) && 
        defaultHeaders['Content-Type'] === 'application/json') 
    { 
        try {
            processedBody = JSON.stringify(processedBody);
        } catch (error) {
            console.error("Failed to stringify request body:", error);
            throw new Error("Failed to stringify request body");
        }
    }

    if (processedBody instanceof FormData) {
        delete defaultHeaders['Content-Type'];
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers: defaultHeaders,
            body: processedBody as BodyInit | null | undefined, 
        });

        // Optional: Keep 401 check as a fallback, though expiration check should catch most
        if (!options.isPublic && response.status === 401) {
            console.error('Unauthorized request (401) received despite valid token check to:', url);
            logoutUser(); // Logout if backend rejects a seemingly valid token
            // Throw specific error or let calling code handle based on status
            throw new Error('Unauthorized (401).'); 
        }

        return response;
    } catch (error) {
        console.error('Fetch error:', error);
        // Avoid re-throwing errors we already handled (like expired token)
        if (!(error instanceof Error && (error.message === 'Token expired.' || error.message === 'User is not authenticated.' || error.message === 'Invalid token expiration date format.' || error.message === 'Error validating token.' || error.message === 'Unauthorized (401).') )) {
             throw error; // Re-throw only unexpected fetch errors
        }
        // If it was one of our handled errors, we need to return something or let it bubble
        // Throwing is usually best practice here to signal failure
        throw error; 
    }
}; 