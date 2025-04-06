export interface ApiDocument {
  documentName: string;
  userID: string;
  parentDocumentId: string | null;
  partitionKey: string;
  url: string | null;
  createdOn: string; // Or Date if you plan to parse it
  chunkIndex: number;
  content: string; // Consider if you actually need the full content in the sidebar
} 