
export enum Sender {
  USER = 'user',
  BOT = 'model',
  SYSTEM = 'system'
}

export interface BrandContext {
  name: string;
  industry: string; // New: Context Industry
  niche: string;    // New: Specific Market
  description: string;
  audience: string;
  painPoints: string; // New: Audience Problems
  usp: string;        // New: Unique Selling Point
  contentPillars: string; // New: Main Topics
  voice: string;
  goal: string;
}

export interface ChartData {
  type: 'bar' | 'line' | 'pie';
  title: string;
  data: Array<Record<string, string | number>>;
  dataKey: string;
  categoryKey: string;
}

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
  chartData?: ChartData;
  imageUrl?: string;
  attachmentName?: string;
}

export interface Attachment {
  file: File;
  previewUrl: string;
  base64?: string;
  mimeType: string;
  textContent?: string;
}
