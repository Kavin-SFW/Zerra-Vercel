const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.join(__dirname, '.env');

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);
    
    if (!match) throw new Error("Key not found");
    
    const SERVICE_KEY = match[1].trim().replace(/["']/g, '');
    console.log("🔑 Key found:", SERVICE_KEY.substring(0, 5) + "...");

    const data = JSON.stringify({
        action: "AUTO_TEST",
        module: "CLI_AGENT",
        message: "Automated test log to verify storage",
        log_date: new Date().toISOString().split('T')[0],
        log_time: new Date().toISOString().split('T')[1].split('.')[0]
    });

    const options = {
        hostname: 'axnpahnmktvtmnkrgtba.supabase.co',
        path: '/rest/v1/logs',
        method: 'POST',
        headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Content-Length': data.length,
            'Prefer': 'return=minimal'
        }
    };

    console.log("🌱 Seeding a test log...");

    const req = https.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log("✅ Test Log created successfully.");
        } else {
            console.log(`❌ Log creation failed: ${res.statusCode} ${res.statusMessage}`);
             res.on('data', d => console.log(d.toString()));
        }
    });

    req.on('error', (e) => console.error(e));
    req.write(data);
    req.end();

} catch (e) {
    console.error("Setup Error:", e.message);
}