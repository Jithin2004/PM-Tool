const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(path.join(__dirname, '../frontend/src'));
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Replace is_sandbox with environment
    if (content.includes('is_sandbox')) {
        content = content.replace(/is_sandbox\?: boolean;/g, "environment?: 'production' | 'sandbox' | 'staging' | 'demo' | 'training';");
        content = content.replace(/is_sandbox: row\.is_sandbox,/g, "environment: row.environment,");
        content = content.replace(/workspace\?\.is_sandbox/g, "workspace?.environment === 'sandbox'");
        changed = true;
    }
    
    // Fix status type
    if (content.includes(" | 'sandbox'")) {
        content = content.replace(/ \| 'sandbox'/g, '');
        changed = true;
    }

    // Fix manual checks for status === 'sandbox'
    if (content.includes("status === 'sandbox'")) {
        content = content.replace(/status === 'sandbox'/g, "environment === 'sandbox'");
        changed = true;
    }

    if (content.includes("status: 'sandbox'")) {
        content = content.replace(/status: 'sandbox'/g, "environment: 'sandbox'");
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content);
        console.log('Updated ' + file);
    }
});

// Update seed scripts
const seedFiles = walk(path.join(__dirname, '../frontend/scripts'));
seedFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    if (content.includes("status: 'sandbox'")) {
        content = content.replace(/status: 'sandbox'/g, "environment: 'sandbox'");
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content);
        console.log('Updated ' + file);
    }
});

