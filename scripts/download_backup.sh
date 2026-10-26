#!/bin/bash
# =============================================================================
# MAIDAN Platform — Download Backup from EC2 to Ubuntu (WSL)
# =============================================================================
set -euo pipefail

# Configuration with defaults
EC2_HOST="${1:-maidanjo.duckdns.org}"
EC2_USER="${2:-ubuntu}"
SSH_KEY="${3:-~/.ssh/maidan-spot-frankfurt.pem}"
REMOTE_PATH="/home/ubuntu/maidan/backups"
LOCAL_BACKUP_DIR="$(pwd)/backups"

mkdir -p "${LOCAL_BACKUP_DIR}"

# Expand tilde if present in SSH_KEY
SSH_KEY="${SSH_KEY/#\~/$HOME}"

echo "=========================================="
echo "Pulling latest backup from EC2 to WSL"
echo "Host: ${EC2_USER}@${EC2_HOST}"
echo "Key:  ${SSH_KEY}"
echo "Dest: ${LOCAL_BACKUP_DIR}"
echo "=========================================="

# Check if SSH key exists
if [ ! -f "${SSH_KEY}" ]; then
    echo "ERROR: SSH Key not found at ${SSH_KEY}"
    echo "Usage: ./scripts/download_backup.sh [EC2_HOST] [EC2_USER] [PATH_TO_SSH_KEY]"
    exit 1
fi

# Run backup on remote server first (optional trigger)
echo "Triggering backup creation on EC2..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" \
    "bash -s" < ./scripts/ec2_backup.sh

# Find the latest archive name on EC2
LATEST_BACKUP=$(ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" \
    "ls -t ${REMOTE_PATH}/maidan_full_backup_*.tar.gz 2>/dev/null | head -n1")

if [ -z "${LATEST_BACKUP}" ]; then
    echo "ERROR: No backup archives found in ${REMOTE_PATH} on EC2!"
    exit 1
fi

BACKUP_FILENAME=$(basename "${LATEST_BACKUP}")

echo "Downloading ${BACKUP_FILENAME}..."
rsync -avz --progress -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no" \
    "${EC2_USER}@${EC2_HOST}:${LATEST_BACKUP}" "${LOCAL_BACKUP_DIR}/"

echo "=========================================="
echo "SUCCESS: Backup downloaded to WSL!"
echo "File: ${LOCAL_BACKUP_DIR}/${BACKUP_FILENAME}"
echo "To restore locally, run:"
echo "./scripts/restore_local.sh ${LOCAL_BACKUP_DIR}/${BACKUP_FILENAME}"
echo "=========================================="
