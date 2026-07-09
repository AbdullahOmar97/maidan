#!/bin/bash
# =============================================================================
# MAIDAN Sports Club Management System — Automated Deployment Script
# =============================================================================

PROJECT_DIR="/home/ubuntu/maidan"
cd "${PROJECT_DIR}" || exit 1

echo "[$(date)] =========================================="
echo "[$(date)] Starting Automated Deployment..."
echo "[$(date)] =========================================="

# Load environment variables from .env if it exists
if [ -f "${PROJECT_DIR}/.env" ]; then
    export $(grep -v '^#' "${PROJECT_DIR}/.env" | xargs)
fi

# 1. Pull the latest code
echo "[$(date)] Configuring safe directory for Git..."
git config --global --add safe.directory /home/ubuntu/maidan

echo "[$(date)] Pulling latest code from GitHub..."
git pull origin main

# 2. Rebuild and restart the container services
echo "[$(date)] Pruning docker builder cache..."
docker builder prune -f

echo "[$(date)] Rebuilding frontend container without cache..."
docker compose -f docker-compose.prod.yml build --no-cache frontend

echo "[$(date)] Rebuilding and starting docker containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "[$(date)] Reloading Nginx to refresh container DNS resolution..."
docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload

# 3. Apply database migrations
echo "[$(date)] Applying shared database migrations..."
docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate_schemas --shared

echo "[$(date)] Applying tenant database migrations..."
docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate_schemas

# 4. Collect static files (Run as root user to avoid permission errors on mounted volumes)
echo "[$(date)] Collecting Django static files..."
docker compose -f docker-compose.prod.yml exec -T -u root backend python manage.py collectstatic --noinput

# 5. Clear Redis Cache (optional but recommended on updates)
echo "[$(date)] Flushing Redis cache..."
docker compose -f docker-compose.prod.yml exec -T redis redis-cli -a "${REDIS_PASSWORD}" flushall

# 6. Verify Health Check
echo "[$(date)] Waiting 5 seconds for services to settle..."
sleep 5
echo "[$(date)] Verifying system health status..."
HEALTH_STATUS=$(docker compose -f docker-compose.prod.yml exec -T backend curl -H "X-Forwarded-Proto: https" -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health/)

if [ "$HEALTH_STATUS" -eq 200 ]; then
    echo "[$(date)] SUCCESS: Deployment completed successfully! Health status: 200 OK"
else
    echo "[$(date)] WARNING: Health check returned status: ${HEALTH_STATUS}. Please run 'docker compose ps' to inspect containers."
    exit 1
fi
