-- Table: user_logs (Permanent Archive)
-- Duplicate of the 'logs' table structure for permanent storage
CREATE TABLE IF NOT EXISTS public.user_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    log_date TEXT NOT NULL,
    log_time TEXT NOT NULL,
    timezone TEXT,
    level TEXT DEFAULT 'info',
    action TEXT NOT NULL,
    module TEXT,
    message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    error_stack TEXT
);

-- Enable RLS
ALTER TABLE public.user_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own user_logs" ON public.user_logs;
CREATE POLICY "Users can view their own user_logs" ON public.user_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_logs_user_id ON public.user_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_logs_date ON public.user_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_user_logs_created_at ON public.user_logs(created_at DESC);

-- Optional: Create a trigger to automatically copy data from 'logs' to 'user_logs'
-- if you want to use 'logs' as a buffer and 'user_logs' as storage.
-- Uncomment the following block if desired:

/*
CREATE OR REPLACE FUNCTION copy_log_to_user_logs()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_logs (
        id, user_id, created_at, log_date, log_time, timezone, 
        level, action, module, message, metadata, error_stack
    ) VALUES (
        NEW.id, NEW.user_id, NEW.created_at, NEW.log_date, NEW.log_time, NEW.timezone,
        NEW.level, NEW.action, NEW.module, NEW.message, NEW.metadata, NEW.error_stack
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_archive_log
AFTER INSERT ON public.logs
FOR EACH ROW
EXECUTE FUNCTION copy_log_to_user_logs();
*/
