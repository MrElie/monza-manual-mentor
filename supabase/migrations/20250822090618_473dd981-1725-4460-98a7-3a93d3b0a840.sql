DO $$
DECLARE
  v_email text := 'elie@meouchi.net';
  v_user_id uuid;
BEGIN
  -- Find the user id by email (case-insensitive)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', v_email;
  END IF;

  -- Try to update existing profile
  UPDATE public.user_profiles
  SET role = 'admin'::user_role,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- If no profile was updated, insert a new one
  IF NOT FOUND THEN
    INSERT INTO public.user_profiles (user_id, username, role)
    VALUES (v_user_id, v_email, 'admin'::user_role);
  END IF;

  RAISE NOTICE 'Granted admin role to user % (id=%)', v_email, v_user_id;
END;
$$;