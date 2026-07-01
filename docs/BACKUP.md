# Backup & Recovery Guide

## Database Backups
Resolve PM Enterprise data is entirely housed within a PostgreSQL database.

### Automated Backups
It is highly recommended to use a managed database provider (such as Supabase Cloud or AWS RDS) that provides Point-in-Time Recovery (PITR) and daily snapshot backups.

### Manual Backups
If managing your own PostgreSQL cluster, perform regular backups using `pg_dump`:

```bash
pg_dump -U postgres -h <host> -p 5432 -F c -b -v -f "resolve_pm_backup_$(date +%Y%m%d).backup" postgres
```

## Restoration
To restore a manual backup:
```bash
pg_restore -U postgres -h <host> -p 5432 -d postgres -v "resolve_pm_backup.backup"
```

## Storage Backups
If your deployment utilizes Supabase Storage buckets for attachments and document management, ensure you regularly sync the physical bucket data using standard S3 API tools (e.g. `aws s3 sync`).
