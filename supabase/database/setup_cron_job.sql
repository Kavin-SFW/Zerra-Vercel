-- =========================================================
-- 1. Enable required extensions
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =========================================================
-- 2. Remove existing jobs safely (idempotent cleanup)
-- =========================================================

-- Remove all previous variations of the job to prevent conflicts
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN (
  'archive-logs-every-10-minutes', 
  'archive-logs-every-minute', 
  'archive-logs-daily',
  'archive-logs-hourly'
);

-- =========================================================
-- 3. Schedule new job (runs EVERY MINUTE)
-- =========================================================

SELECT
  cron.schedule(
    'archive-logs-every-minute',
    '* * * * *',  -- This means "Every Minute"
    $$
    SELECT
      net.http_post(
        url := 'https://axnpahnmktvtmnkrgtba.supabase.co/functions/v1/archive-logs',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4bnBhaG5ta3R2dG1ua3JndGJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkzMTM2MCwiZXhwIjoyMDg0NTA3MzYwfQ.3V5kwmm2q4C9CepgAlTEmFQ3tFK-lvBHeuhEaFw68h8'
        )
      ) AS request_id;
    $$
  );
