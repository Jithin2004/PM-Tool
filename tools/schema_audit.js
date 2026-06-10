const fs = require("fs");
const path = require("path");

const sqlPath = "database/production/RESOLVE_PM_V1_3_INSTALL.sql";
const frontend = "frontend/src";
const backend = "backend";

const sql = fs.readFileSync(sqlPath, "utf8");

console.log("\n=== RESOLVE PM DATABASE USAGE AUDIT ===\n");

// Find tables
const tables = [...sql.matchAll(/CREATE TABLE\s+(?:public\.)?(\w+)/gi)]
    .map(x => x[1]);

console.log(`Tables found: ${tables.length}\n`);

function scanFolder(folder, term) {
    let found = [];

    if (!fs.existsSync(folder)) return found;

    function walk(dir) {
        for (const f of fs.readdirSync(dir)) {
            const full = path.join(dir, f);

            if (fs.statSync(full).isDirectory()) {
                walk(full);
            }
            else {
                const txt = fs.readFileSync(full, "utf8");
                if (txt.includes(term)) {
                    found.push(full);
                }
            }
        }
    }

    walk(folder);
    return found;
}


let unused = [];

for (const table of tables) {

    const front =
        scanFolder(frontend, table);

    const back =
        scanFolder(backend, table);


    console.log("--------------------------------");
    console.log("TABLE:", table);

    console.log(
        "Frontend refs:",
        front.length
    );

    console.log(
        "Backend refs:",
        back.length
    );


    if (front.length === 0 && back.length === 0) {
        unused.push(table);
    }

}


console.log("\n===============================");
console.log("POSSIBLE UNUSED TABLES");
console.log("===============================\n");

unused.forEach(x => console.log("⚠", x));

console.log("\nAudit finished.");