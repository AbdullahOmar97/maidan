# 🥋 Maidan — Modern Martial Arts Management Platform

Maidan is a comprehensive Django-based multi-tenant web application for managing martial arts schools (dojos). It provides tools for student lifecycle management, attendance tracking, belt progression, billing, scheduling, and secure multi-tenant data isolation.

## 🚀 Key Features

- **Multi-Tenancy** — Every school has its own isolated PostgreSQL schema with domain mapping (e.g., `myschool.localhost`).
- **User Roles & Permissions** — Full-featured access control with Owner, Administrator, Instructor, and Parent roles.
- **Student Management** — Comprehensive student profiles with family linking and photo uploads.
- **Attendance Tracking** — Daily check-in, automated follow-ups, and class attendance.
- **Belt & Ranking System** — Manage student belt levels, promotions, and prerequisites.
- **Billing & Payments** — Subscription-based billing, payment tracking, and automated reminders.
- **Scheduling** — Class and appointment scheduling with availability management.
- **Communications** — Integrated messaging between staff, students, and families.
- **Security** — JWT-based authentication, audit logging, and secure file storage.
- **Modern Tech Stack** — Django Rest Framework, DRF Spectacular (OpenAPI), Celery, PostgreSQL, and MinIO.

## 🏗️ Project Architecture

```
maidan/
├── backend/              # Django backend
│   ├── config/           # Main Django configuration
│   │   ├── settings/     # Base, local, production, etc.
│   │   ├── urls.py       # Main URLs (public schema)
│   │   └── urls_public.py  # Tenant URLs (per schema)
│   ├── apps/             # Reusable Django apps
│   │   ├── accounts/     # User authentication & profiles
│   │   ├── students/     # Student management
│   │   ├── families/     # Family management
│   │   ├── attendance/   # Attendance tracking
│   │   ├── belts/        # Belt management
│   │   ├── billing/      # Billing & subscriptions
│   │   ├── payments/     # Payment processing
│   │   ├── scheduling/   # Class & appointment scheduling
│   │   ├── messaging/    # In-app messaging
│   │   ├── reporting/    # Reports & analytics
│   │   ├── staff/        # Staff management
│   │   └── audit/        # Audit logging
│   └── shared/           # Shared code & utilities
│
├── frontend/             # Next.js frontend
│
├── docker-compose.yml    # Docker services orchestration
└── nginx/                # Nginx reverse proxy configuration
```

## ⚙️ Development Setup

### Prerequisites
- Docker
- Docker Compose

### Running Locally

1. **Build and start all services**:
   ```bash
   make up
   ```

2. **Apply database migrations** (public schema):
   ```bash
   make migrate
   ```

3. **Create a superuser** (optional):
   ```bash
   make superuser
   ```

4. **Access the application**:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - API: [http://localhost:8000](http://localhost:8000)
   - Swagger Docs: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)

### Stopping Services

```bash
make down
```

## 🔧 Testing a New Tenant

You can create tenants programmatically using the Django shell or via API.

**Option 1: Using Django Shell**

```bash
# Get into Django shell
make shell

# Create a tenant and domain
from tenants.models import Tenant, Domain

t = Tenant.objects.create(name="Test School", schema_name="testschool")
d = Domain.objects.create(
    domain="testschool.localhost",
    tenant=t,
    is_primary=True,
)

# Run migrations for the new tenant
t.run_sync_schema(schema_name="testschool")
```

Now access [http://testschool.localhost:3000](http://testschool.localhost:3000) (you may need to update your `/etc/hosts` file to map `testschool.localhost` to `[IP_ADDRESS]` for local development).

## 🔐 Authentication

Use the following credentials to test:
- **Email**: [EMAIL_ADDRESS]`
- **Password**: `password123` (or your custom password)
- **Tenant**: `default` (for the main platform)

## 📁 Code Structure

### Backend (`backend/`)
- `config/`: Django settings and URL configurations
- `apps/`: Modular Django apps (per-feature)
- `shared/`: Reusable components across apps
- `tenants/`: Multi-tenancy models and utilities

### Frontend (`frontend/`)
- `src/app/`: Next.js application pages
- `src/components/`: Reusable React components
- `src/hooks/`: Custom React hooks
- `src/lib/`: Utility functions and API clients
- `src/types/`: TypeScript type definitions

## 📡 API Documentation

The API is documented using OpenAPI (Swagger) with Drf Spectacular:

1. Access the schema:
   ```
   http://localhost:8000/api/schema/
   ```

2. View interactive Swagger UI:
   ```
   http://localhost:8000/api/docs/
   ```

3. View Redoc documentation:
   ```
   http://localhost:8000/api/redoc/
   ```

## 🧪 Testing

### Running Tests
```bash
# Run backend tests
make test

# Run frontend tests
npm run test
```

### Health Checks
- Backend health: [http://localhost:8000/api/health/](http://localhost:8000/api/health/)

## 🚀 Deploying

To deploy to production, update the `.env` file with your production settings and use:
```bash
docker compose up -d --build
```

## 📝 License

Private project - All rights reserved