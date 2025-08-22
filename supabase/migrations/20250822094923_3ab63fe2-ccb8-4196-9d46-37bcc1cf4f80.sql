-- Storage policies to allow admin to manage repair-manuals bucket
CREATE POLICY "Admins manage repair manuals objects"
ON storage.objects
FOR ALL
USING (bucket_id = 'repair-manuals' AND is_admin())
WITH CHECK (bucket_id = 'repair-manuals' AND is_admin());