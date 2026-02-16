const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');

async function main() {
    // 1. Setup Env and Client
    const envPath = path.join(__dirname, '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
    const keyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
    
    if (!urlMatch || !keyMatch) throw new Error("Missing Env Vars");
    
    const SUPABASE_URL = urlMatch[1].trim().replace(/["']/g, '');
    const SUPABASE_KEY = keyMatch[1].trim().replace(/["']/g, '');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log("1. Creating a test log...");
    const testLog = {
        action: 'TEST_ARCHIVE',
        level: 'info',
        log_date: new Date().toISOString().split('T')[0],
        log_time: new Date().toISOString().split('T')[1],
        message: 'This is a test log to verify archival process',
        user_id: 'a28137c4-f59a-4945-838c-7a40bc62801a' // Reuse the ID we saw earlier for consistency
    };

    const { data, error } = await supabase.from('logs').insert(testLog).select();

    if (error) {
        console.error("❌ Insert Error:", error);
        return;
    }
    console.log("✅ Log inserted with ID:", data[0].id);

    // PREVIEW THE NEW FORMAT LOCALLY
    console.log("\n✨ PREVIEW: Here is how your logs will appear after you deploy:");
    const pDate = testLog.log_date;
    const pTime = testLog.log_time;
    const pLine = `[${pDate} ${pTime} UTC] [User: ${testLog.user_id}] [System] [${testLog.level}] ${testLog.action}: ${testLog.message} | Data: {} | Stack: `;
    console.log(pLine);
    console.log("----------------------------------------------------------------\n");

    console.log("2. Waiting 2 seconds before archiving...");
    await new Promise(r => setTimeout(r, 2000));

    console.log("3. Triggering archive function...");
    
    const options = {
        hostname: 'axnpahnmktvtmnkrgtba.supabase.co',
        path: '/functions/v1/archive-logs',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SUPABASE_KEY}`, // Using Anon/Service key depending on what we found. This is technically Anon key but calls function.
            'Content-Type': 'application/json'
        }
    };

    const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', c => responseData += c);
        res.on('end', () => {
            console.log("Response Status:", res.statusCode);
            console.log("Response Body:", responseData);
        });
    });
    
    req.on('error', e => console.error("Request Error:", e));
    req.end();
}

main().catch(console.error);
