# Maidan SaaS Project Rules

This file defines the project-specific guardrails, naming conventions, and architectural rules for the Maidan platform.

## AWS Infrastructure & Cost Tracking Guidelines

When discussing platform scaling, estimating costs, or proposing infrastructure architectures, adhere to the following rules:

1. **Exchange Rate Peg**:
   - Always use the pegged exchange rate: `1 USD = 0.709 JOD` (Jordanian Dinar) for all cost translations.

2. **Scaling Tiers**:
   - **Tier 1: Startup / Small Scale** (Up to 1,000 MAUs, ~10-20 clubs)
     - Next.js Front-end: 1 Fargate task (0.25 vCPU, 0.5 GB RAM)
     - Django Backend: 1 Fargate task (0.25 vCPU, 0.5 GB RAM)
     - Celery Worker & Beat: 1 Fargate task each (0.25 vCPU, 0.5 GB RAM)
     - Database: RDS PostgreSQL `db.t4g.micro` (Single-AZ, 20GB GP3 SSD)
     - Cache/Queue: Redis running on a Fargate task (0.25 vCPU, 0.5 GB RAM) to minimize cost.
     - Networking: 1 ALB, no NAT Gateway (tasks in public subnet with public IPs for startup).
   - **Tier 2: Growth** (Up to 10,000 MAUs, ~100-200 clubs)
     - Next.js Front-end: 2 Fargate tasks (0.5 vCPU, 1.0 GB RAM) for High Availability (HA)
     - Django Backend: 2 Fargate tasks (1.0 vCPU, 2.0 GB RAM) for HA
     - Celery Worker: 2 Fargate tasks (0.5 vCPU, 1.0 GB RAM); Beat: 1 Fargate task (0.25 vCPU, 0.5 GB RAM)
     - Database: RDS PostgreSQL `db.t4g.medium` (Multi-AZ, 50GB GP3 SSD)
     - Cache/Queue: AWS ElastiCache Redis `cache.t4g.small` (Multi-AZ primary/replica)
     - Networking: 1 ALB, 2 NAT Gateways (Multi-AZ)
   - **Tier 3: Enterprise / Scale** (Up to 50,000 MAUs, ~500+ clubs)
     - Next.js Front-end: 4 Fargate tasks (1.0 vCPU, 2.0 GB RAM)
     - Django Backend: 4 Fargate tasks (2.0 vCPU, 4.0 GB RAM)
     - Celery Worker: 4 Fargate tasks (1.0 vCPU, 2.0 GB RAM); Beat: 1 Fargate task (0.5 vCPU, 1.0 GB RAM)
     - Database: RDS PostgreSQL `db.m6g.large` (Multi-AZ, 200GB GP3 SSD)
     - Cache/Queue: AWS ElastiCache Redis `cache.m6g.large` (Multi-AZ primary/replica)
     - Networking: 1 ALB, 2 NAT Gateways (Multi-AZ)

3. **Cost Reference Script**:
   - The primary implementation and source of truth for cost calculations is located at [scratch/aws_costs.py](file:///\\wsl.localhost\Ubuntu-24.04\home\abdullah\maidan\scratch\aws_costs.py). 
   - If updates are made to infrastructure sizing or AWS prices, ensure that script is kept up to date.

## Django Migrations Guardrails

To prevent "Lazy Reference" errors, circular dependencies, or `ValueError` during database migrations when modifying models, follow these guidelines:

1. **Decouple Before Deleting**:
   - Never delete a model (`DeleteModel` operation) in the same migration step where ForeignKeys or ManyToMany fields in other models are still referencing it.
   - **Step 1**: Modify referencing fields (ForeignKeys) in other models to point to the new model (or set `null=True`, `blank=True`) and run `makemigrations`.
   - **Step 2**: Delete the target model in a subsequent, separate migration.

2. **Prevent Circular Dependencies**:
   - Ensure app migrations do not create circular dependencies in their `dependencies = [...]` block. If App A migration depends on App B, and App B depends on App A, split the migrations into separate, smaller files.

3. **Verify Migrations Locally**:
   - Always run system checks and migrations locally (`make migrate` or dry-run) to ensure Django is able to resolve the dependency graph without errors.
