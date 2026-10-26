#!/bin/bash
# =============================================================================
# MAIDAN Platform — Production EC2 Full Backup Script
# Backs up PostgreSQL (all tenant schemas), Media files, MinIO, and .env
# =============================================================================
set -euo pipefail

PROJECT_DIR="${1:-/home/ubuntu/maidan}"
cd "${PROJECT_DIR}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_ROOT="${PROJECT_DIR}/backups"
BACKUP_DIR="${BACKUP_ROOT}/maidan_backup_${TIMESTAMP}"
ARCHIVE_FILE="${BACKUP_ROOT}/maidan_full_backup_${TIMESTAMP}.tar.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting full backup on EC2..."
echo "[$(date)] Output directory: ${BACKUP_DIR}"

# 1. Load environment variables
if [ -f "${PROJECT_DIR}/.env" ]; then
    export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
fi

DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-postgres}"
export PGPASSWORD="${POSTGRES_PASSWORD:-}"

# 2. Backup Database (PostgreSQL dump including all tenant schemas)
echo "[$(date)] 1/4 Dumping PostgreSQL database (${DB_NAME})..."
DB_CONTAINER=$(docker compose -f docker-compose.prod.yml ps -q db 2>/dev/null || docker ps -qf "name=db" | head -n1)

if [ -n "${DB_CONTAINER}" ]; then
    docker exec -e PGPASSWORD="${PGPASSWORD}" "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "${BACKUP_DIR}/database.sql.gz"
    echo "[$(date)] Database dump complete: $(du -h "${BACKUP_DIR}/database.sql.gz" | cut -f1)"
else
    echo "[$(date)] WARNING: DB container not found, skipping database dump!"
fi

# 3. Backup Media Volume
echo "[$(date)] 2/4 Backing up media files volume..."
MEDIA_VOL=$(docker volume ls -q | grep -E "maidan.*media_files" | head -n1 || echo "maidan_media_files")
if docker volume inspect "${MEDIA_VOL}" >/dev/null 2>&1; then
    docker run --rm -v "${MEDIA_VOL}":/volume:ro -v "${BACKUP_DIR}":/backup alpine tar -czf /backup/media.tar.gz -C /volume .
    echo "[$(date)] Media volume backup complete: $(du -h "${BACKUP_DIR}/media.tar.gz" | cut -f1)"
else
    echo "[$(date)] Media volume ${MEDIA_VOL} not found, checking local media directory..."
    if [ -d "${PROJECT_DIR}/backend/media" ]; then
        tar -czf "${BACKUP_DIR}/media.tar.gz" -C "${PROJECT_DIR}/backend/media" .
    fi
fi

# 4. Backup MinIO Object Storage Volume
echo "[$(date)] 3/4 Backing up MinIO object storage volume..."
MINIO_VOL=$(docker volume ls -q | grep -E "maidan.*minio_data" | head -n1 || echo "maidan_minio_data")
if docker volume inspect "${MINIO_VOL}" >/dev/null 2>&1; then
    docker run --rm -v "${MINIO_VOL}":/volume:ro -v "${BACKUP_DIR}":/backup alpine tar -czf /backup/minio.tar.gz -C /volume .
    echo "[$(date)] MinIO volume backup complete: $(du -h "${BACKUP_DIR}/minio.tar.gz" | cut -f1)"
fi

# 5. Backup Environment file
echo "[$(date)] 4/4 Backing up .env configuration..."
if [ -f "${PROJECT_DIR}/.env" ]; then
    cp "${PROJECT_DIR}/.env" "${BACKUP_DIR}/.env.production"
fi

# 6. Bundle all components into a single archive
echo "[$(date)] Packaging full backup into archive..."
tar -czf "${ARCHIVE_FILE}" -C "${BACKUP_ROOT}" "maidan_backup_${TIMESTAMP}"
rm -rf "${BACKUP_DIR}"

echo "[$(date)] =========================================="
echo "[$(date)] SUCCESS: Full backup created successfully!"
echo "[$(date)] Backup Archive: ${ARCHIVE_FILE}"
echo "[$(date)] Size: $(du -h "${ARCHIVE_FILE}" | cut -f1)"
echo "[$(date)] =========================================="
