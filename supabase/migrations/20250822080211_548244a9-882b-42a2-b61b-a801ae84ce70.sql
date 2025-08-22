-- Make car brands/models publicly readable (keep PDFs protected)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='car_brands' AND policyname='Public can view car brands'
  ) THEN
    CREATE POLICY "Public can view car brands"
    ON public.car_brands
    FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='car_models' AND policyname='Public can view car models'
  ) THEN
    CREATE POLICY "Public can view car models"
    ON public.car_models
    FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;

-- Ensure PDF documents are admin-only (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='pdf_documents' AND policyname='Admins can manage PDF documents'
  ) THEN
    CREATE POLICY "Admins can manage PDF documents" 
    ON public.pdf_documents 
    FOR ALL 
    TO authenticated 
    USING (
      EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    );
  END IF;
END $$;

-- Ensure storage bucket exists (idempotent)
INSERT INTO storage.buckets (id, name, public)
SELECT 'repair-manuals', 'repair-manuals', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'repair-manuals');

-- Storage policies for admin-only access to PDFs (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admins can manage repair manuals'
  ) THEN
    CREATE POLICY "Admins can manage repair manuals" 
    ON storage.objects 
    FOR ALL 
    TO authenticated 
    USING (
      bucket_id = 'repair-manuals' AND
      EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
    WITH CHECK (
      bucket_id = 'repair-manuals' AND
      EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    );
  END IF;
END $$;

-- Seed brands and models if missing
INSERT INTO public.car_brands (name, display_name) VALUES 
('voyah', 'Voyah')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.car_brands (name, display_name) VALUES 
('mhero', 'Mhero')
ON CONFLICT (name) DO NOTHING;

-- Voyah models
WITH voyah AS (
  SELECT id FROM public.car_brands WHERE name='voyah'
)
INSERT INTO public.car_models (brand_id, name, display_name)
SELECT id, 'free', 'Voyah Free' FROM voyah
ON CONFLICT (brand_id, name) DO NOTHING;

WITH voyah AS (
  SELECT id FROM public.car_brands WHERE name='voyah'
)
INSERT INTO public.car_models (brand_id, name, display_name)
SELECT id, 'passion', 'Voyah Passion' FROM voyah
ON CONFLICT (brand_id, name) DO NOTHING;

WITH voyah AS (
  SELECT id FROM public.car_brands WHERE name='voyah'
)
INSERT INTO public.car_models (brand_id, name, display_name)
SELECT id, 'dream', 'Voyah Dream' FROM voyah
ON CONFLICT (brand_id, name) DO NOTHING;

WITH voyah AS (
  SELECT id FROM public.car_brands WHERE name='voyah'
)
INSERT INTO public.car_models (brand_id, name, display_name)
SELECT id, 'courage', 'Voyah Courage' FROM voyah
ON CONFLICT (brand_id, name) DO NOTHING;

-- Mhero
WITH mhero AS (
  SELECT id FROM public.car_brands WHERE name='mhero'
)
INSERT INTO public.car_models (brand_id, name, display_name)
SELECT id, 'mhero-1', 'Mhero' FROM mhero
ON CONFLICT (brand_id, name) DO NOTHING;