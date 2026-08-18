
CREATE POLICY "prod images read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'production-images');
CREATE POLICY "prod images upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'production-images' AND owner = auth.uid());
CREATE POLICY "prod images delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'production-images' AND (owner = auth.uid() OR public.is_admin()));
