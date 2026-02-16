const URL = 'https://axnpahnmktvtmnkrgtba.supabase.co/functions/v1/archive-logs';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4bnBhaG5ta3R2dG1ua3JndGJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkzMTM2MCwiZXhwIjoyMDg0NTA3MzYwfQ.3V5kwmm2q4C9CepgAlTEmFQ3tFK-lvBHeuhEaFw68h8';

async function trigger() {
  console.log('🚀 Triggering Log Archival...');
  try {
    const response = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      }
    });

    const data = await response.json();
    console.log('✅ Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

trigger();
