-- Add user interaction logging table
CREATE TABLE public.user_interaction_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  session_id UUID,
  message_content TEXT NOT NULL,
  ai_response TEXT,
  model_name TEXT,
  interaction_type TEXT DEFAULT 'chat',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on interaction logs
ALTER TABLE public.user_interaction_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admins only
CREATE POLICY "Admins can manage interaction logs"
ON public.user_interaction_logs
FOR ALL
USING (is_admin());

-- Add login tracking columns to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN last_login TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_ip_address TEXT;

-- Create index for better performance on logs
CREATE INDEX idx_user_interaction_logs_user_id ON public.user_interaction_logs(user_id);
CREATE INDEX idx_user_interaction_logs_created_at ON public.user_interaction_logs(created_at DESC);