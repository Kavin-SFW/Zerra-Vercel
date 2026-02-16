const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://axnpahnmktvtmnkrgtba.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4bnBhaG5ta3R2dG1ua3JndGJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkzMTM2MCwiZXhwIjoyMDg0NTA3MzYwfQ.3V5kwmm2q4C9CepgAlTEmFQ3tFK-lvBHeuhEaFw68h8';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkLogs() {
  console.log('🔍 Checking Logs Table...');
  
  const { count, error } = await supabase
    .from('logs')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('❌ Error fetching count:', error.message);
    return;
  }

  console.log(`📊 Total Logs in Table: ${count}`);

  // Fetch top 5 latest logs to see what's there
  const { data: latestLogs, error: dataError } = await supabase
    .from('logs')
    .select('id, created_at, user_id, message')
    .order('created_at', { ascending: false })
    .limit(5);

  if (latestLogs && latestLogs.length > 0) {
      console.log('📝 Latest 5 Logs in DB:');
      console.table(latestLogs);
  } else {
      console.log('📭 No logs found in DB.');
  }
}

checkLogs();
