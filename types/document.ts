export interface ApiDocument {
  id: string;
  documentName: string;
  userID: string;
  partitionKey: string;
  url: string | null;
  createdOn: string; // Or Date if you plan to parse it
} 