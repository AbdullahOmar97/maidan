# Maidan — Multi-Tenant Martial Arts Academy SaaS

## Project Overview
**Maidan** is an enterprise-grade, multi-tenant SaaS platform engineered for martial arts academies (dojos) to manage operations, student lifecycles, rank progressions, automated billing, and scheduling with multi-tenant data isolation.

---

## Resume / CV Section

### Short Summary
Engineered **Maidan**, a multi-tenant SaaS platform for martial arts management using **Django REST Framework**, **Next.js**, **TypeScript**, and **PostgreSQL**. Designed a schema-per-tenant database architecture, asynchronous background task processing, and automated billing.

---

### Technical Achievements

- **Multi-Tenant System Design**: Implemented isolated PostgreSQL database schemas per organization (`django-tenants`) with dynamic domain mapping to guarantee enterprise data security and regulatory isolation.
- **Full-Stack Application Development**: Developed a high-performance **Next.js / TypeScript** frontend connected to a modular **Django REST** API backend.
- **Domain-Driven Core Modules**: Built end-to-end features including **Belt & Ranking Progression**, **Student Lifecycle & Family Linking**, **Automated Attendance Tracking**, **Class Scheduling**, and **In-App Communications**.
- **Asynchronous Workflows & Jobs**: Configured **Celery** and **Redis** workers for automated billing reminders, subscription renewals, and queued notification processing.
- **Security & Storage**: Built JWT authentication, role-based access control (RBAC for Owner, Admin, Instructor, Parent), audit logs, and secure asset storage via **MinIO / S3**.
- **Containerization & Deployment**: Packaged frontend, backend, database, cache, and reverse proxy using **Docker**, **Docker Compose**, and **Nginx**.

---

## Technical Stack

- **Backend**: Python, Django, Django REST Framework, DRF Spectacular (OpenAPI 3.0)
- **Multi-Tenancy & DB**: PostgreSQL (`django-tenants` schema separation)
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Async Processing**: Celery, Redis
- **Storage & Security**: MinIO (S3 API), SimpleJWT, Audit Logging
- **DevOps**: Docker, Docker Compose, Nginx, Makefile
