-- First, drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;

-- Create a security definer function to safely check user roles
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM public.user_profiles 
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a safe admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (public.get_current_user_role() = 'admin'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recreate the admin policy using the security definer function
CREATE POLICY "Admins can view all profiles" 
ON public.user_profiles 
FOR SELECT 
USING (public.is_admin());

-- Also fix the PDF documents policy to use the same pattern
DROP POLICY IF EXISTS "Admins can manage PDF documents" ON public.pdf_documents;

CREATE POLICY "Admins can manage PDF documents" 
ON public.pdf_documents 
FOR ALL 
USING (public.is_admin());

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;