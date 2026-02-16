-- 1. Create a private bucket for user logs
-- This bucket will store the JSON log files.
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-logs', 'user-logs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Policies
-- We skip 'ALTER TABLE' because RLS is already on.

-- Drop old policies if they exist so we can recreate them cleanly
DROP POLICY IF EXISTS "Users can view their own log files" ON storage.objects;
DROP POLICY IF EXISTS "Service Role full access" ON storage.objects;

-- Policy: Allow Users to View THEIR OWN log files
CREATE POLICY "Users can view their own log files"
ON storage.objects FOR SELECT
USING ( bucket_id = 'user-logs' AND (storage.foldername(name))[1] = auth.uid()::text );

-- Policy: Service Role (Edge Function) Full Access
CREATE POLICY "Service Role full access"
ON storage.objects
TO service_role
USING ( bucket_id = 'user-logs' )
WITH CHECK ( bucket_id = 'user-logs' );