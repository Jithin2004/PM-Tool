const dns = require('dns');

dns.lookup('pm-tool-server.onrender.com', (err, address, family) => {
    if (err) {
        console.error("DNS Resolution Failed:", err.message);
        process.exit(1);
    }
    console.log("DNS Resolved to:", address, "(IPv" + family + ")");
    process.exit(0);
});
