-- Tighten access to sensitive user_interaction_logs while preserving functionality
-- 1) Ensure RLS is enabled
ALTER TABLE public.user_interaction_logs ENABLE ROW LEVEL SECURITY;

-- 2) Restrict direct SELECT to admins only by removing user SELECT policy
DROP POLICY IF EXISTS "Users can view their own interaction logs" ON public.user_interaction_logs;

-- Keep admin policy as-is (assumes it exists). If it doesn't, recreate it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_interaction_logs'
      AND policyname = 'Admins can manage interaction logs'
  ) THEN
    CREATE POLICY "Admins can manage interaction logs"
    ON public.user_interaction_logs
    FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
  END IF;
END$$;

-- 3) Create a safe RPC to return sanitized logs for the current user only
CREATE OR REPLACE FUNCTION public.get_my_interaction_logs(
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  session_id uuid,
  model_name text,
  interaction_type text,
  message_content text,
  ai_response text
) AS $$
  SELECT
    uil.id,
    uil.created_at,
    uil.session_id,
    uil.model_name,
    uil.interaction_type,
    uil.message_content,
    uil.ai_response
  FROM public.user_interaction_logs uil
  WHERE uil.user_id = auth.uid()
  ORDER BY uil.created_at DESC
  LIMIT GREATEST(_limit, 0)
  OFFSET GREATEST(_offset, 0);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4) Allow authenticated users to execute the RPC
GRANT EXECUTE ON FUNCTION public.get_my_interaction_logs(integer, integer) TO authenticated;