#!/bin/bash
# =============================================================================
# MAIDAN Platform — Setup Daily Backup Cron Job
# Schedules full backup every 24 hours at 02:00 AM
# =============================================================================
set -euo pipefail

PROJECT_DIR="${1:-/home/ubuntu/maidan}"
SCRIPT_PATH="${PROJECT_DIR}/scripts/ec2_backup.sh"
LOG_PATH="${PROJECT_DIR}/backups/backup_cron.log"
CRON_SCHEDULE="0 2 * * *"
CRON_JOB="${CRON_SCHEDULE} /bin/bash ${SCRIPT_PATH} >> ${LOG_PATH} 2>&1"

# Ensure script is executable
chmod +x "${SCRIPT_PATH}"
mkdir -p "${PROJECT_DIR}/backups"

# Check if cron job already exists in crontab
CURRENT_CRON=$(crontab -l 2>/dev/null || true)

if echo "${CURRENT_CRON}" | grep -Fq "${SCRIPT_PATH}"; then
    echo "Backup cron job already installed."
else
    # Append job to crontab
    (echo "${CURRENT_CRON}"; echo "${CRON_JOB}") | crontab -
    echo "SUCCESS: 24-hour backup cron job installed successfully:"
    echo "${CRON_JOB}"
fi
