const fs = require("fs");

const file = "database/production/RESOLVE_PM_V1_3_INSTALL.sql";

let sql = fs.readFileSync(file, "utf8");


const remove = [
    "'employee_contracts',",
    "'task_handoff_requests'"
];


for (const item of remove) {

    if (sql.includes(item)) {
        sql = sql.replaceAll(item, "");
        console.log("Removed:", item);
    } else {
        console.log("Not found:", item);
    }

}


fs.writeFileSync(file, sql);

console.log("\nReference cleanup complete.");