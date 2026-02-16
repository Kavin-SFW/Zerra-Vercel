import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase Client with Service Role Key
    // This gives the function permission to bypass RLS for administrative tasks
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log("Starting log archival process (Daily Text)...");

    // 1. Fetch unarchived logs from the 'logs' table
    // Reduced limit to 500 to ensure fast execution every minute and avoid timeouts
    const { data: logs, error: fetchError } = await supabaseClient
      .from('logs')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(500);

    if (fetchError) {
        throw new Error(`Error fetching logs: ${fetchError.message}`);
    }

    if (!logs || logs.length === 0) {
        return new Response(JSON.stringify({ message: 'No logs to archive' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    console.log(`Processing ${logs.length} logs...`);

    // 2. Group logs by user_id AND date
    // Key format: "userId|dateStr"
    const logsGrouped: Record<string, any[]> = {};
    
    logs.forEach(log => {
        const userId = log.user_id || 'anonymous';
        // Use log_date if available, otherwise derive from created_at, fallback to today
        let dateStr = log.log_date;
        if (!dateStr && log.created_at) {
            dateStr = log.created_at.split('T')[0];
        }
        if (!dateStr) {
            dateStr = new Date().toISOString().split('T')[0];
        }

        const key = `${userId}|${dateStr}`;
        if (!logsGrouped[key]) logsGrouped[key] = [];
        logsGrouped[key].push(log);
    });

    const results = [];

    // 3. Process each group (User + Date)
    for (const key of Object.keys(logsGrouped)) {
        const [userId, dateStr] = key.split('|');
        const groupLogs = logsGrouped[key];
        
        // Create filename based on the LOG'S date
        // Format: {userId}/logs_YYYY-MM-DD.txt
        const fileName = `${userId}/logs_${dateStr}.txt`;

        let fileContent = '';

        // Try to download existing file for that date
        try {
            const { data: existingFile, error: downloadError } = await supabaseClient.storage
                .from('user-logs')
                .download(fileName);

            if (!downloadError && existingFile) {
                fileContent = await existingFile.text();
                
                // Ensure there is a newline at the end if content exists
                if (fileContent && !fileContent.endsWith('\n')) {
                    fileContent += '\n';
                }
            }
        } catch (err) {
            // Ignore error if file doesn't exist, start fresh
        }

        // Format new logs as text lines
        const newLogsText = groupLogs.map(log => {
            // Format: [Date Time Timezone] [User] [Module] [Action] [Level] Message | Data | Stack
            const date = log.log_date || (log.created_at ? log.log_date : 'N/A');
            const time = log.log_time || (log.created_at ? log.created_at.split('T')[1]?.replace('Z','') : 'N/A');
            const timezone = log.timezone || 'UTC';
            const logUserId = log.user_id || 'anonymous';
            const module = log.module || 'System';
            
            const metadataStr = log.metadata && Object.keys(log.metadata).length > 0 
                ? ` | Data: ${JSON.stringify(log.metadata)}` 
                : '';
            
            const errorStack = log.error_stack 
                ? ` | Stack: ${log.error_stack}` 
                : '';

            return `[${date} ${time} ${timezone}] [User: ${logUserId}] [${module}] [${log.level || 'INFO'}] ${log.action}: ${log.message || ''}${metadataStr}${errorStack}`;
        }).join('\n');

        fileContent += newLogsText;

        // Upload to Supabase Storage (Upsert to overwrite/update)
        const { error: uploadError } = await supabaseClient
            .storage
            .from('user-logs')
            .upload(fileName, fileContent, {
                contentType: 'text/plain',
                upsert: true
            });

        if (uploadError) {
            console.error(`Failed to upload for ${key}:`, uploadError);
            results.push({ key, status: 'error', error: uploadError.message });
        } else {
             // 4. If upload successful, delete the logs from the database
             const idsToDelete = groupLogs.map(l => l.id);
             const deletedIds = [];
             
             // Delete in batches of 100
             let allDeleted = true;
             const deleteErrors: string[] = [];
             const BATCH_SIZE = 100;

             for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
                 const batch = idsToDelete.slice(i, i + BATCH_SIZE);
                 const { error: deleteError } = await supabaseClient
                    .from('logs')
                    .delete()
                    .in('id', batch);
                
                if (deleteError) {
                    allDeleted = false;
                    deleteErrors.push(deleteError.message);
                    console.error(`Batch delete failed for ${key} (batch ${i}):`, deleteError);
                } else {
                    deletedIds.push(...batch);
                }
             }
            
            if (!allDeleted) {
                 results.push({ 
                    userId, 
                    date: dateStr,
                    status: 'uploaded_but_failed_delete', 
                    file: fileName, 
                    errors: deleteErrors,
                    fetchedCount: groupLogs.length,
                    deletedCount: deletedIds.length,
                    summary: `Archived ${groupLogs.length} logs`
                 });
            } else {
                 results.push({ 
                    userId, 
                    date: dateStr,
                    status: 'archived', 
                    count: groupLogs.length, 
                    file: fileName,
                    summary: `Archived ${groupLogs.length} logs`,
                    debug: {
                        fetchedIds: idsToDelete.slice(0, 5), // Show first 5 IDs for debugging
                        deletedCount: deletedIds.length
                    }
                 });
            }
        }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error("Critical error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
