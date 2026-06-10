const fs = require("fs");

const file = "database/production/RESOLVE_PM_V1_3_INSTALL.sql";

let sql = fs.readFileSync(file, "utf8");

const marker = "CREATE TABLE IF NOT EXISTS workspace_license";

const first = sql.indexOf(marker);
const second = sql.indexOf(marker, first + marker.length);

if (second === -1) {
    console.log("No duplicate workspace_license found.");
    process.exit(0);
}

console.log("First occurrence:", first);
console.log("Second occurrence:", second);


// Find previous comment before second block
let start = sql.lastIndexOf("--", second);


// Find next section boundary after second block
let end = sql.indexOf("\n--", second + marker.length);


if (start === -1 || end === -1) {
    throw new Error("Could not safely detect duplicate boundaries");
}


const removed = sql.substring(start, end);

console.log("\nRemoving block preview:");
console.log("--------------------------------");
console.log(removed.substring(0, 500));
console.log("--------------------------------");


sql =
    sql.substring(0, start)
    +
    sql.substring(end);


fs.writeFileSync(file, sql);

console.log("\nDuplicate workspace_license block removed safely.");