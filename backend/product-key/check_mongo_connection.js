const mongoose = require('mongoose');
const dbUri = "mongodb://jithinragesh_db_user:Resolve%40pm12344@ac-3l85suz-shard-00-01.dumeo4p.mongodb.net:27017/Resolve-PM?ssl=true&authSource=admin&retryWrites=true&w=majority";

console.log("Connecting to Mongo...");
mongoose.connect(dbUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 5000
}).then(() => {
    console.log("SUCCESS: MongoDB Connected!");
    process.exit(0);
}).catch(err => {
    console.error("FAIL: MongoDB Connection Error:", err.message);
    process.exit(1);
});
