#!/bin/bash

# RC19 MongoDB Data Migration Script
# Please replace the OLD_MONGO_URI and NEW_MONGO_URI with your actual credentials before running.

OLD_MONGO_URI="mongodb+srv://<OLD_USER>:<OLD_PASSWORD>@<OLD_CLUSTER>.mongodb.net/<OLD_DB>"
NEW_MONGO_URI="mongodb+srv://resolve_pm_app_user:<NEW_PASSWORD>@<NEW_CLUSTER>.mongodb.net/resolve_pm_prod"

echo "Step 1: Exporting 'licenses' and 'auditevents' from old database..."
mongodump --uri="$OLD_MONGO_URI" --collection="licenses" --out="mongo_backup"
mongodump --uri="$OLD_MONGO_URI" --collection="auditevents" --out="mongo_backup"

echo "Step 2: Importing into new 'resolve_pm_prod' database..."
# Extract the old database name from the dump directory to restore from it
OLD_DB_NAME=$(basename $(ls -d mongo_backup/* | head -n 1))
mongorestore --uri="$NEW_MONGO_URI" "mongo_backup/$OLD_DB_NAME"

echo "Migration completed. Please verify the document counts in Atlas."
