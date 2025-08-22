-- Add RLS policies for admins to manage car brands
CREATE POLICY "Admins can insert car brands" 
ON public.car_brands 
FOR INSERT 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Admins can update car brands" 
ON public.car_brands 
FOR UPDATE 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Admins can delete car brands" 
ON public.car_brands 
FOR DELETE 
USING (is_admin());

-- Add RLS policies for admins to manage car models
CREATE POLICY "Admins can insert car models" 
ON public.car_models 
FOR INSERT 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Admins can update car models" 
ON public.car_models 
FOR UPDATE 
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Admins can delete car models" 
ON public.car_models 
FOR DELETE 
USING (is_admin());