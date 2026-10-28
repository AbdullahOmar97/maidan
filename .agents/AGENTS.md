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

<!-- BEGIN AWS Agent Toolkit rules -->
# AWS Guidance

- Where these AWS rules conflict with the project's own instructions, the
  project's instructions take precedence.
- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- For any AWS task or question — building, configuring, migrating, debugging,
  or operating a service, writing SDK code, authoring CDK/CloudFormation, or
  answering how a service works — first call `aws___search_documentation` with
  topic `agent_skills` and load the matching skill with `aws___retrieve_skill`.
  Do this even when you believe you know the answer: skills carry current
  service behavior that your training may not. Prefer the skill's guidance over
  general knowledge. Skip it only for work that does not involve AWS.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- Before reporting a count, a total, or that something does not exist, read
  every page of the results and search every Region and scope where it could
  be. If you could not, say the result is partial and name what you checked.
- To say what a system currently does, read what the runtime uses: the
  completed deployment, the alias or version that is invoked, the template the
  stack is running. A newer stored version, a draft, or a description field is
  not evidence of live behavior.
- Present a cause as confirmed only if data, configuration, or logs you read
  show it. Label anything else as unverified, and say what you would check
  next.
- When the user asks a specific question or names a suspected cause, confirm
  or rule out each cause they raised, and do not offer alternatives your evidence
  does not support.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

## Before you conclude

- Before deciding the AWS account can't hold what the request asks for,
  look. List the places it could live, such as S3 buckets, databases, and
  log groups, and read what is there.
- Don't conclude that records are missing from metadata, such as a
  creation date or a stored-bytes count, or from one query that failed or
  came back empty. Read the records another way, across the full time
  range, before reporting them absent.

## Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.
<!-- END AWS Agent Toolkit rules -->

