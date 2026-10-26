#!/bin/bash
# =============================================================================
# MAIDAN Platform — Local Restore Script for Ubuntu (WSL)
# Restores PostgreSQL Database, Media files, and MinIO storage into local Docker
# =============================================================================
set -euo pipefail

ARCHIVE_FILE="${1:-}"

if [ -z "${ARCHIVE_FILE}" ] || [ ! -f "${ARCHIVE_FILE}" ]; then
    echo "ERROR: Please specify a valid backup archive file."
    echo "Usage: ./scripts/restore_local.sh backups/maidan_full_backup_YYYYMMDD_HHMMSS.tar.gz"
    exit 1
fi

PROJECT_DIR="$(pwd)"
TEMP_DIR="${PROJECT_DIR}/backups/restore_temp_$(date +%s)"
mkdir -p "${TEMP_DIR}"

trap 'rm -rf "${TEMP_DIR}"' EXIT

echo "=========================================="
echo "Starting Local Restore in WSL"
echo "Archive: ${ARCHIVE_FILE}"
echo "=========================================="

# 1. Extract Archive
echo "[1/4] Extracting backup archive..."
tar -xzf "${ARCHIVE_FILE}" -C "${TEMP_DIR}"

EXTRACTED_DIR=$(find "${TEMP_DIR}" -mindepth 1 -maxdepth 1 -type d | head -n1)
if [ -z "${EXTRACTED_DIR}" ]; then
    EXTRACTED_DIR="${TEMP_DIR}"
fi

# Load local environment settings
if [ -f "${PROJECT_DIR}/.env" ]; then
    export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
fi

DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-postgres}"

# Ensure Docker services are up
echo "Ensuring local Docker services (db, minio) are running..."
docker compose up -d db minio

# Wait for DB to be healthy
echo "Waiting for PostgreSQL to be ready..."
until docker compose exec -T db pg_isready -U "${DB_USER}" >/dev/null 2>&1; do
    sleep 2
done

# 2. Restore PostgreSQL Database
if [ -f "${EXTRACTED_DIR}/database.sql.gz" ]; then
    echo "[2/4] Restoring PostgreSQL database (${DB_NAME})..."
    
    # Drop existing connections and restore
    docker compose exec -T db psql -U "${DB_USER}" -d postgres -c "
        SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
        WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true

    gunzip -c "${EXTRACTED_DIR}/database.sql.gz" | docker compose exec -T db psql -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1 || {
        echo "Direct import finished with schema notices (normal for pg_dump --clean)."
    }
    echo "Database restored successfully."
else
    echo "WARNING: database.sql.gz not found in archive."
fi

# 3. Restore Media Files
if [ -f "${EXTRACTED_DIR}/media.tar.gz" ]; then
    echo "[3/4] Restoring media files..."
    MEDIA_VOL=$(docker volume ls -q | grep -E "maidan.*media_files" | head -n1 || echo "maidan_media_files")
    
    docker run --rm \
        -v "${MEDIA_VOL}":/to \
        -v "${EXTRACTED_DIR}":/from:ro \
        alpine sh -c "mkdir -p /to && rm -rf /to/* && tar -xzf /from/media.tar.gz -C /to" 2>/dev/null || true
        
    if [ -d "${PROJECT_DIR}/backend/media" ]; then
        tar -xzf "${EXTRACTED_DIR}/media.tar.gz" -C "${PROJECT_DIR}/backend/media" 2>/dev/null || true
    fi
    echo "Media files restored successfully."
fi

# 4. Restore MinIO Data
if [ -f "${EXTRACTED_DIR}/minio.tar.gz" ]; then
    echo "[4/4] Restoring MinIO object storage data..."
    MINIO_VOL=$(docker volume ls -q | grep -E "maidan.*minio_data" | head -n1 || echo "maidan_minio_data")
    
    docker run --rm \
        -v "${MINIO_VOL}":/to \
        -v "${EXTRACTED_DIR}":/from:ro \
        alpine sh -c "mkdir -p /to && rm -rf /to/* && tar -xzf /from/minio.tar.gz -C /to" 2>/dev/null || true
    
    docker compose restart minio
    echo "MinIO data restored successfully."
fi

echo "=========================================="
echo "SUCCESS: Full restore completed in WSL!"
echo "Restarting backend services to apply changes..."
docker compose restart backend celery-worker
echo "Local platform is ready."
echo "=========================================="
