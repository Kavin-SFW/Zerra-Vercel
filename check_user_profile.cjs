const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://axnpahnmktvtmnkrgtba.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4bnBhaG5ta3R2dG1ua3JndGJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkzMTM2MCwiZXhwIjoyMDg0NTA3MzYwfQ.3V5kwmm2q4C9CepgAlTEmFQ3tFK-lvBHeuhEaFw68h8';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkProfiles() {
  console.log('🔍 Checking User Profiles...');

  // Get all profiles
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('*');

  if (error) {
    console.error('❌ Error fetching profiles:', error.message);
    return;
  }

  console.log(`📊 Found ${profiles.length} profiles.`);
  console.table(profiles);

  // Get recent logs to compare
  const { data: logs } = await supabase
    .from('logs')
    .select('user_id')
    .limit(10);
  
  if (logs && logs.length > 0) {
      const logUserIds = [...new Set(logs.map(l => l.user_id))];
      console.log('🆔 User IDs found in Logs:', logUserIds);
      
      logUserIds.forEach(uid => {
          const found = profiles.find(p => p.id === uid);
          if (found) {
              console.log(`✅ User ${uid} has profile: ${found.email}`);
          } else {
              console.log(`❌ User ${uid} MISSING profile!`);
          }
      });
  }
}

checkProfiles();
