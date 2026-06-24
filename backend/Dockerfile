# =============================================================================
# Django Backend Dockerfile — Multi-stage build
# =============================================================================

# --- Base Stage ---
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libmagic1 \
    libcairo2 \
    libffi-dev \
    curl \
    gettext \
    && rm -rf /var/lib/apt/lists/*

# --- Development Stage ---
FROM base AS development

COPY requirements/base.txt requirements/development.txt ./requirements/
RUN pip install -r requirements/development.txt

COPY . .

EXPOSE 8000

# --- Production Stage ---
FROM base AS production

COPY requirements/base.txt requirements/production.txt ./requirements/
RUN pip install -r requirements/production.txt

COPY . .

# Create directories for media and static files
RUN mkdir -p /app/media /app/staticfiles

# Create non-root user
RUN addgroup --system django && adduser --system --ingroup django django
RUN chown -R django:django /app
USER django

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", \
     "--workers", "4", "--worker-class", "gevent", "--timeout", "120", \
     "--access-logfile", "-", "--error-logfile", "-"]
