fetch('http://localhost:5000/test')
  .then(async r => {
    console.log("Status:", r.status);
    console.log("Response:", await r.text());
  })
  .catch(err => {
    console.error("Ping error:", err.message);
  });
