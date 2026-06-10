const fs = require("fs");

const file = "database/production/RESOLVE_PM_V1_3_INSTALL.sql";

let sql = fs.readFileSync(file, "utf8");

console.log("Original size:", sql.length);


// 1. Remove team_events DROP
sql = sql.replace(
    /DROP TABLE IF EXISTS team_events CASCADE;\r?\n/g,
    ""
);


// 2. Remove team_events table creation
sql = sql.replace(
    /-- 16\. team_events[\s\S]*?CREATE TABLE team_events\s*\([\s\S]*?\);\r?\n/g,
    ""
);


// 3. Remove RLS enable
sql = sql.replace(
    /ALTER TABLE team_events\s+ENABLE ROW LEVEL SECURITY;\r?\n/g,
    ""
);


// 4. Remove team_events policies
sql = sql.replace(
    /-- Wave 7\.5: Team events mutations restricted to PM\/Admin[\s\S]*?CREATE POLICY "Team events can be managed by PMs and Admins"[\s\S]*?\);\r?\n/g,
    ""
);


fs.writeFileSync(file, sql);

console.log("New size:", sql.length);
console.log("Clean complete");