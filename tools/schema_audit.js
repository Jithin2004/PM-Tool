const fs = require("fs");
const path = require("path");

const sqlPath = "database/production/RESOLVE_PM_V1_3_INSTALL.sql";
const frontend = "frontend/src";
const backend = "backend";

const sql = fs.readFileSync(sqlPath, "utf8");

console.log("\n=== RESOLVE PM DATABASE USAGE AUDIT ===\n");


// =====================================
// Find real unique CREATE TABLE entries
// =====================================

const tables = [
    ...new Set(
        [...sql.matchAll(
            /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:public|auth|storage)\.)?["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/gi
        )]
            .map(x => x[1])
            .filter(x => x.toLowerCase() !== "if")
    )
];


console.log(`Tables found: ${tables.length}\n`);


// =====================================
// Scan project usage
// =====================================

function scanFolder(folder, term) {

    let found = [];

    if (!fs.existsSync(folder)) return found;


    function walk(dir) {

        for (const f of fs.readdirSync(dir)) {

            const full = path.join(dir, f);

            if (fs.statSync(full).isDirectory()) {

                // skip build/cache folders
                if (
                    f === "node_modules" ||
                    f === "dist" ||
                    f === ".next"
                ) continue;

                walk(full);
            }

            else {

                const txt = fs.readFileSync(
                    full,
                    "utf8"
                );

                const pattern = new RegExp(
                    `\\b${term}\\b`,
                    "i"
                );


                if (pattern.test(txt)) {
                    found.push(full);
                }
            }
        }
    }


    walk(folder);

    return found;
}



// =====================================
// Audit
// =====================================


let unused = [];


for (const table of tables) {


    const front = scanFolder(
        frontend,
        table
    );


    const back = scanFolder(
        backend,
        table
    );


    console.log("--------------------------------");

    console.log(
        "TABLE:",
        table
    );


    console.log(
        "Frontend refs:",
        front.length
    );


    console.log(
        "Backend refs:",
        back.length
    );



    if (
        front.length === 0 &&
        back.length === 0
    ) {

        unused.push(table);
    }

}



console.log("\n===============================");
console.log("POSSIBLE UNUSED TABLES");
console.log("===============================\n");


if (unused.length === 0) {

    console.log("✅ No unused tables detected");

}

else {

    unused.forEach(
        x => console.log("⚠", x)
    );

}


console.log("\nAudit finished.");