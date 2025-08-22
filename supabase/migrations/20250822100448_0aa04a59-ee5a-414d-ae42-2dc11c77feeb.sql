-- Strengthen RLS on user_interaction_logs: admins manage all; users can only view their own
ALTER TABLE public.user_interaction_logs ENABLE ROW LEVEL SECURITY;

-- Drop previous broad admin policy to re-create with WITH CHECK as well
DROP POLICY IF EXISTS "Admins can manage interaction logs" ON public.user_interaction_logs;

-- Admins can do everything
CREATE POLICY "Admins can manage interaction logs"
ON public.user_interaction_logs
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Users can only SELECT their own logs
CREATE POLICY "Users can view their own interaction logs"
ON public.user_interaction_logs
FOR SELECT
USING (user_id = auth.uid());