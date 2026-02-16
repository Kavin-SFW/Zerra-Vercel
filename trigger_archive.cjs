const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '.env');

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
    
    if (!match) throw new Error("Key not found");
    
    const SERVICE_KEY = match[1].trim().replace(/["']/g, '');

    const options = {
        hostname: 'axnpahnmktvtmnkrgtba.supabase.co',
        path: '/functions/v1/archive-logs',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
        }
    };

    console.log("🚀 Triggering archive-logs function...");

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`\n✅ Status Code: ${res.statusCode}`);
            console.log("📝 Response Body:");
            console.log(data);
        });
    });

    req.on('error', (error) => { console.error("❌ Error:", error); });
    req.end();

} catch (err) {
    console.error("❌ Setup Error:", err.message);
}