console.log("Environment variables:");
Object.keys(process.env).forEach(key => {
  if (key.toLowerCase().includes("supabase") || key.toLowerCase().includes("pass") || key.toLowerCase().includes("key") || key.toLowerCase().includes("db") || key.toLowerCase().includes("url") || key.toLowerCase().includes("secret")) {
    console.log(`${key}: ${process.env[key]}`);
  }
});
