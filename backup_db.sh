#!/bin/bash
# Backup PostgreSQL Database for Maidan Platform

PROJECT_DIR="/home/ubuntu/maidan"
BACKUP_DIR="${PROJECT_DIR}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/maidan_backup_${TIMESTAMP}.sql.gz"
DB_CONTAINER="maidan-db-1"

# Load database credentials from .env file if it exists
if [ -f "${PROJECT_DIR}/.env" ]; then
    # Filter out comments and empty lines, then export variables
    export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
fi

DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-postgres}"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting database backup for DB: ${DB_NAME} as User: ${DB_USER}..."

# Export password so pg_dump won't prompt for it
export PGPASSWORD="${POSTGRES_PASSWORD}"

# Run pg_dump inside the docker container and pipe to gzip
docker exec -e PGPASSWORD="${PGPASSWORD}" "${DB_CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"

if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "[$(date)] Backup completed successfully: ${BACKUP_FILE}"
    # Keep only the latest 3 backups
    BACKUP_COUNT=$(ls -1t "${BACKUP_DIR}"/maidan_backup_*.sql.gz 2>/dev/null | wc -l)
    if [ "${BACKUP_COUNT}" -gt 3 ]; then
        ls -1t "${BACKUP_DIR}"/maidan_backup_*.sql.gz | tail -n +4 | xargs -r rm -f
        echo "[$(date)] Deleted older backups. Retained top 3."
    fi
else
    echo "[$(date)] ERROR: Database backup failed!"
    # Remove the empty/failed backup file if it exists
    rm -f "${BACKUP_FILE}"
    exit 1
fi
