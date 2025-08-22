-- Fix RLS to allow admins to manage brands and models

-- Car Brands
CREATE POLICY "Admins can insert car brands"
ON public.car_brands
FOR INSERT
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

-- Car Models
CREATE POLICY "Admins can insert car models"
ON public.car_models
FOR INSERT
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