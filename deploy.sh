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
echo "[$(date)] Pulling latest code from GitHub..."
git pull origin main

# 2. Build updated images first while the site remains online (uses build cache for high speed)
echo "[$(date)] Building updated docker images..."
docker compose -f docker-compose.prod.yml build

# 3. Swap containers in-place with minimal downtime (usually < 2 seconds)
echo "[$(date)] Recreating containers with new images..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans

echo "[$(date)] Reloading Nginx to refresh container DNS resolution..."
docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload

# 4. Apply database migrations
echo "[$(date)] Applying shared database migrations..."
docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate_schemas --shared

echo "[$(date)] Applying tenant database migrations..."
docker compose -f docker-compose.prod.yml exec -T backend python manage.py migrate_schemas

# 5. Collect static files (Run as root user to avoid permission errors on mounted volumes)
echo "[$(date)] Collecting Django static files..."
docker compose -f docker-compose.prod.yml exec -T -u root backend python manage.py collectstatic --noinput

# 6. Clear Redis Cache (optional but recommended on updates)
echo "[$(date)] Flushing Redis cache..."
docker compose -f docker-compose.prod.yml exec -T redis redis-cli -a "${REDIS_PASSWORD}" flushall

# 7. Verify Health Check
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
