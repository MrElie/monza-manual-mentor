-- Create car brands table
CREATE TABLE public.car_brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create car models table
CREATE TABLE public.car_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.car_brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  image_url TEXT,
  vector_store_id TEXT, -- OpenRouter.ai vector store ID
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(brand_id, name)
);

-- Create PDF documents table
CREATE TABLE public.pdf_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES public.car_models(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  storage_path TEXT NOT NULL, -- Supabase storage path
  vector_store_document_id TEXT, -- ID in the vector store
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat sessions table
CREATE TABLE public.chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id UUID NOT NULL REFERENCES public.car_models(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB, -- Store PDF sources and citations
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user roles table for admin access
CREATE TYPE public.user_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  username TEXT UNIQUE,
  role public.user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.car_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for car_brands and car_models (readable by authenticated users)
CREATE POLICY "Authenticated users can view car brands" 
ON public.car_brands FOR SELECT 
TO authenticated USING (true);

CREATE POLICY "Authenticated users can view car models" 
ON public.car_models FOR SELECT 
TO authenticated USING (true);

-- RLS Policies for PDF documents (only admins can manage, users cannot see)
CREATE POLICY "Admins can manage PDF documents" 
ON public.pdf_documents FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policies for chat sessions (users can only see their own)
CREATE POLICY "Users can manage their own chat sessions" 
ON public.chat_sessions FOR ALL 
TO authenticated 
USING (user_id = auth.uid());

-- RLS Policies for chat messages (users can only see messages from their sessions)
CREATE POLICY "Users can manage messages from their sessions" 
ON public.chat_messages FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.chat_sessions 
    WHERE id = session_id AND user_id = auth.uid()
  )
);

-- RLS Policies for user profiles
CREATE POLICY "Users can view their own profile" 
ON public.user_profiles FOR SELECT 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" 
ON public.user_profiles FOR UPDATE 
TO authenticated 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles" 
ON public.user_profiles FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert initial data
INSERT INTO public.car_brands (name, display_name) VALUES 
('voyah', 'Voyah'),
('mhero', 'Mhero');

-- Insert Voyah models
INSERT INTO public.car_models (brand_id, name, display_name) 
SELECT id, 'free', 'Voyah Free' FROM public.car_brands WHERE name = 'voyah'
UNION ALL
SELECT id, 'passion', 'Voyah Passion' FROM public.car_brands WHERE name = 'voyah'
UNION ALL
SELECT id, 'dream', 'Voyah Dream' FROM public.car_brands WHERE name = 'voyah'
UNION ALL
SELECT id, 'courage', 'Voyah Courage' FROM public.car_brands WHERE name = 'voyah';

-- Insert Mhero model (assuming one main model for now)
INSERT INTO public.car_models (brand_id, name, display_name) 
SELECT id, 'mhero-1', 'Mhero' FROM public.car_brands WHERE name = 'mhero';

-- Create function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, username)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for PDF files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('repair-manuals', 'repair-manuals', false);

-- Storage policies for PDF documents (only admins can access)
CREATE POLICY "Admins can manage repair manuals" 
ON storage.objects FOR ALL 
TO authenticated 
USING (
  bucket_id = 'repair-manuals' AND
  EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at columns
CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();