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
    # Keep only backups from the last 30 days
    find "${BACKUP_DIR}" -type f -name "maidan_backup_*.sql.gz" -mtime +30 -exec rm {} \;
    echo "[$(date)] Deleted backups older than 30 days."
else
    echo "[$(date)] ERROR: Database backup failed!"
    # Remove the empty/failed backup file if it exists
    rm -f "${BACKUP_FILE}"
    exit 1
fi
