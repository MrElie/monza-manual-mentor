-- Create a settings table for global app settings like logo
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for app settings
CREATE POLICY "Admins can manage app settings" 
ON public.app_settings 
FOR ALL 
USING (public.is_admin());

-- Insert default logo setting
INSERT INTO public.app_settings (key, value) 
VALUES ('logo_url', '"src/assets/monza-logo.png"');

-- Add trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for uploads (logos, car images)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('app-assets', 'app-assets', true);

-- Create storage policies for app assets
CREATE POLICY "Admins can upload app assets" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'app-assets' AND public.is_admin());

CREATE POLICY "Admins can update app assets" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'app-assets' AND public.is_admin());

CREATE POLICY "Public can view app assets" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'app-assets');

CREATE POLICY "Admins can delete app assets" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'app-assets' AND public.is_admin());