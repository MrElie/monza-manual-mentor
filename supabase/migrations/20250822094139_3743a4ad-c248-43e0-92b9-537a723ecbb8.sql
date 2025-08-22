-- Add approved field to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN approved BOOLEAN NOT NULL DEFAULT false;

-- Create RLS policies for user approval management
CREATE POLICY "Admins can update user approval status" 
ON public.user_profiles 
FOR UPDATE 
USING (is_admin())
WITH CHECK (is_admin());

-- Update the existing handle_new_user function to set approved to false by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, username, approved)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;