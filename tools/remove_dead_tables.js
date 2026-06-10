const fs = require("fs");

const file =
    "database/production/RESOLVE_PM_V1_3_INSTALL.sql";

let sql = fs.readFileSync(file, "utf8");


function removeCreateBlock(table) {

    const regex = new RegExp(
        `\\n?CREATE TABLE IF NOT EXISTS (?:public\\.)?${table}[\\s\\S]*?;`,
        "i"
    );

    if (regex.test(sql)) {
        sql = sql.replace(regex, "");
        console.log("Removed table:", table);
    }
    else {
        console.log("Not found:", table);
    }
}


[
    "employee_contracts",
    "task_handoff_requests"

].forEach(removeCreateBlock);


fs.writeFileSync(file, sql);

console.log("\nDead table cleanup complete.");