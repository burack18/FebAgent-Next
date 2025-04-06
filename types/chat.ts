// types/chat.ts

export interface AskRequest {
  question: string;
  sessionKey: string;
}

// --- Response Types --- 

interface Role {
  label: string;
}

interface TextContent {
  $type: "TextContent";
  text: string;
}

// Add other potential item types if needed (e.g., ImageContent)
type ContentItem = TextContent; // Extend with | ImageContent etc. if applicable

// Simplified response focusing on extracting the text item
export interface AskResponse {
  $type: string;
  role: Role;
  items: ContentItem[];
  // Include other fields like modelId, metadata if needed for other purposes
  metadata?: any; // Keep metadata flexible or define fully if used
} 