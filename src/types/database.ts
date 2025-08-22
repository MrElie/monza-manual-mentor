export interface CarBrand {
  id: string;
  name: string;
  display_name: string;
  created_at: string;
}

export interface CarModel {
  id: string;
  brand_id: string;
  name: string;
  display_name: string;
  image_url?: string;
  vector_store_id?: string;
  created_at: string;
  brand?: CarBrand;
}

export interface UserProfile {
  id: string;
  user_id: string;
  username?: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  model_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
  model?: CarModel;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: any;
  created_at: string;
}

export interface PdfDocument {
  id: string;
  model_id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  vector_store_document_id?: string;
  uploaded_by?: string;
  created_at: string;
}