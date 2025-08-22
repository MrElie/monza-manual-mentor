-- Ensure RLS is enabled and policies are strictly scoped to conversation owners

-- 1) Enable RLS on chat tables
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 2) Remove existing policies on these tables to avoid overly-permissive access
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (
    SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_sessions'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_sessions', r.polname);
  END LOOP;

  FOR r IN (
    SELECT polname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chat_messages'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_messages', r.polname);
  END LOOP;
END $$;

-- 3) Re-create least-privilege policies

-- chat_sessions: a user can only access their own sessions
CREATE POLICY "Users can select their own chat sessions"
ON public.chat_sessions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own chat sessions"
ON public.chat_sessions
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own chat sessions"
ON public.chat_sessions
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own chat sessions"
ON public.chat_sessions
FOR DELETE
USING (user_id = auth.uid());

-- chat_messages: a user can only access messages that belong to their sessions
CREATE POLICY "Users can select messages from their sessions"
ON public.chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_sessions s
    WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages into their sessions"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_sessions s
    WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update messages from their sessions"
ON public.chat_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_sessions s
    WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_sessions s
    WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete messages from their sessions"
ON public.chat_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_sessions s
    WHERE s.id = chat_messages.session_id AND s.user_id = auth.uid()
  )
);
