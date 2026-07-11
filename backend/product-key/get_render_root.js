const https = require('https');

console.log("Hitting Render root...");
const req = https.get('https://pm-tool-server.onrender.com/', { timeout: 45000 }, (res) => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', res.headers);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('BODY length:', data.length);
        console.log('BODY:', data.substring(0, 1000));
        process.exit(0);
    });
});

req.on('error', (err) => {
    console.error('ERROR:', err.message);
    process.exit(1);
});

req.on('timeout', () => {
    console.log('TIMEOUT');
    req.destroy();
    process.exit(1);
});
