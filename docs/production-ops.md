# Production Ops

Short operational runbook for the production VPS.

## Backups

Create a manual backup:

```bash
cd /opt/sintezum
scripts/prod_backup.sh
```

By default the backup includes:

- PostgreSQL custom dump
- PostgreSQL globals
- MinIO volume archive
- production compose and nginx template

Backups are written to `/opt/sintezum/backups/automated` and local archives older than 14 days are removed.

To include `.env` in the archive, run:

```bash
INCLUDE_ENV=1 scripts/prod_backup.sh
```

If `.env` is included, treat the archive as secret material.

## Certificate Renewal

Run a manual renewal check:

```bash
cd /opt/sintezum
scripts/renew_cert.sh
```

The script uses the existing `letsencrypt` and `certbot_www` directories and reloads nginx after certbot finishes.

## Cron

Install cron jobs for daily backups and twice-daily certificate renewal checks:

```bash
crontab -e
```

Add:

```cron
15 3 * * * cd /opt/sintezum && /opt/sintezum/scripts/prod_backup.sh >> /opt/sintezum/backups/backup.log 2>&1
30 4,16 * * * cd /opt/sintezum && /opt/sintezum/scripts/renew_cert.sh >> /opt/sintezum/letsencrypt/renew.log 2>&1
```

Keep at least one backup copy outside the VPS.

## Maintenance Page

Nginx serves a static maintenance page when the frontend or backend is unavailable. You can also enable it manually before a planned deploy:

```bash
cd /opt/sintezum
touch maintenance/enabled
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

Disable maintenance mode:

```bash
cd /opt/sintezum
rm maintenance/enabled
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

The page itself is stored in `maintenance/index.html`.
