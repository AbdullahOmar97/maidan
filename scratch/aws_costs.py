# AWS cost calculation helper for Maidan SaaS platform
# exchange rate: 1 USD = 0.709 JOD (Pegged)

exchange_rate = 0.709

def format_cost(usd):
    jod = usd * exchange_rate
    return f"${usd:,.2f} USD ({jod:,.2f} JOD)"

# ----------------------------------------------------
# Tier 1: Startup / Small scale (Up to 1,000 MAUs, ~10-20 clubs)
# ----------------------------------------------------
# Next.js Front-end: 1 Fargate task (0.25 vCPU, 0.5 GB RAM)
# Django Backend: 1 Fargate task (0.25 vCPU, 0.5 GB RAM)
# Celery Worker: 1 Fargate task (0.25 vCPU, 0.5 GB RAM)
# Celery Beat: 1 Fargate task (0.25 vCPU, 0.5 GB RAM)
# Database: RDS PostgreSQL db.t4g.micro (2 vCPU, 1 GB RAM, Multi-AZ: No, 20GB GP3 SSD)
# Cache/Queue: Redis running on a Fargate task (0.25 vCPU, 0.5 GB RAM) to save cost, or db.t4g.micro. Let's use Fargate for Redis to keep it cheap.
# Network: 1 ALB, Route 53, NAT Gateway (or no NAT Gateway if Fargate in public subnet with public IPs, but in production we use NAT Gateway or VPC endpoints. Let's assume standard ALB + minimal NAT/Egress).
# S3: 50 GB storage, 50 GB transfer.
# CloudFront: 100 GB transfer.

fargate_cpu_price_per_hr = 0.04048
fargate_ram_price_per_gb_hr = 0.004445

def calculate_fargate_task_cost(cpu, ram, count):
    # monthly cost for 730 hours
    cpu_cost = cpu * fargate_cpu_price_per_hr * 730 * count
    ram_cost = ram * fargate_ram_price_per_gb_hr * 730 * count
    return cpu_cost + ram_cost

# Tier 1 Components
t1_nextjs = calculate_fargate_task_cost(0.25, 0.5, 1)
t1_django = calculate_fargate_task_cost(0.25, 0.5, 1)
t1_celery_worker = calculate_fargate_task_cost(0.25, 0.5, 1)
t1_celery_beat = calculate_fargate_task_cost(0.25, 0.5, 1)
t1_redis_task = calculate_fargate_task_cost(0.25, 0.5, 1)

# RDS db.t4g.micro PostgreSQL (Single AZ for startup/dev)
# pricing approx: $0.016 per hour for db.t4g.micro, storage $0.115 per GB-month
t1_db_instance = 0.016 * 730
t1_db_storage = 20 * 0.115
t1_db = t1_db_instance + t1_db_storage

# ALB: $0.0225 per LCU-hour + $0.0225 per ALB-hour
t1_alb = (0.0225 + 0.008) * 730 # assuming 1 LCU avg

# S3: 50GB * 0.023 + transfer
t1_s3 = 50 * 0.023 + 2.0

# CloudFront + Data Transfer
t1_cf = 3.0

# Route 53, CloudWatch, ACM
t1_misc = 5.0

# NAT Gateway (highly recommended for production, $0.045 per hour + data. Or we use VPC endpoints. Let's assume we use public subnet with security groups to save NAT cost for Startup tier, but let's list NAT Gateway cost as optional).
# For Startup tier: let's keep NAT Gateway out, but for Growth tier we add NAT Gateway.

t1_total = t1_nextjs + t1_django + t1_celery_worker + t1_celery_beat + t1_redis_task + t1_db + t1_alb + t1_s3 + t1_cf + t1_misc

# ----------------------------------------------------
# Tier 2: Growth (Up to 10,000 MAUs, ~100-200 clubs)
# ----------------------------------------------------
# Next.js Front-end: 2 Fargate tasks (0.5 vCPU, 1 GB RAM) for high availability (HA)
# Django Backend: 2 Fargate tasks (1 vCPU, 2 GB RAM) for HA
# Celery Worker: 2 Fargate tasks (0.5 vCPU, 1 GB RAM)
# Celery Beat: 1 Fargate task (0.25 vCPU, 0.5 GB RAM)
# Database: RDS PostgreSQL db.t4g.small or db.t4g.medium (Multi-AZ for HA, 50GB GP3 SSD)
# db.t4g.medium Multi-AZ: ~$0.136/hr, Storage: 50GB * 0.23/GB-month (Multi-AZ storage is $0.23)
# Cache/Queue: AWS ElastiCache Redis cache.t4g.small (1.37 GB RAM, Multi-AZ primary/replica): $0.034 * 2 tasks/hr = $0.068/hr
# ALB, Route 53, CloudWatch
# NAT Gateway: 2 NAT Gateways (Multi-AZ) = 2 * 0.045 * 730 = $65.70
# S3: 200 GB storage, 200 GB transfer
# CloudFront: 500 GB transfer

t2_nextjs = calculate_fargate_task_cost(0.5, 1.0, 2)
t2_django = calculate_fargate_task_cost(1.0, 2.0, 2)
t2_celery_worker = calculate_fargate_task_cost(0.5, 1.0, 2)
t2_celery_beat = calculate_fargate_task_cost(0.25, 0.5, 1)

# RDS db.t4g.medium Multi-AZ
t2_db_instance = 0.136 * 730
t2_db_storage = 50 * 0.23
t2_db = t2_db_instance + t2_db_storage

# ElastiCache Redis Multi-AZ (cache.t4g.small * 2)
t2_redis = 0.034 * 2 * 730

t2_alb = (0.0225 + 0.016) * 730 # 2 LCUs
t2_nat = 2 * 0.045 * 730
t2_s3 = 200 * 0.023 + 10.0
t2_cf = 15.0
t2_misc = 15.0 # CloudWatch, Route 53, KMS

t2_total = t2_nextjs + t2_django + t2_celery_worker + t2_celery_beat + t2_db + t2_redis + t2_alb + t2_nat + t2_s3 + t2_cf + t2_misc

# ----------------------------------------------------
# Tier 3: Enterprise / Scale (Up to 50,000 MAUs, ~500+ clubs)
# ----------------------------------------------------
# Next.js Front-end: 4 Fargate tasks (1 vCPU, 2 GB RAM)
# Django Backend: 4 Fargate tasks (2 vCPU, 4 GB RAM)
# Celery Worker: 4 Fargate tasks (1 vCPU, 2 GB RAM)
# Celery Beat: 1 Fargate task (0.5 vCPU, 1 GB RAM)
# Database: RDS PostgreSQL db.m6g.large Multi-AZ (2 vCPU, 8 GB RAM), 200GB GP3 SSD
# db.m6g.large Multi-AZ: ~$0.394/hr. Storage: 200GB * 0.23 = $46.00
# Cache/Queue: ElastiCache Redis cache.m6g.large (6.38 GB RAM, Multi-AZ) = $0.156 * 2 * 730 = $227.76
# ALB, NAT Gateway, Route 53, CloudWatch
# S3: 1 TB storage, 1 TB transfer
# CloudFront: 2 TB transfer

t3_nextjs = calculate_fargate_task_cost(1.0, 2.0, 4)
t3_django = calculate_fargate_task_cost(2.0, 4.0, 4)
t3_celery_worker = calculate_fargate_task_cost(1.0, 2.0, 4)
t3_celery_beat = calculate_fargate_task_cost(0.5, 1.0, 1)

t3_db_instance = 0.394 * 730
t3_db_storage = 200 * 0.23
t3_db = t3_db_instance + t3_db_storage

t3_redis = 0.156 * 2 * 730

t3_alb = (0.0225 + 0.08) * 730 # 10 LCUs
t3_nat = 2 * 0.045 * 730
t3_s3 = 1000 * 0.023 + 50.0
t3_cf = 50.0
t3_misc = 50.0 # Detailed monitoring, WAF, Route 53, KMS

t3_total = t3_nextjs + t3_django + t3_celery_worker + t3_celery_beat + t3_db + t3_redis + t3_alb + t3_nat + t3_s3 + t3_cf + t3_misc

print("=== Tier 1: Startup (1,000 MAUs) ===")
print("Next.js:", format_cost(t1_nextjs))
print("Django Backend:", format_cost(t1_django))
print("Celery Worker:", format_cost(t1_celery_worker))
print("Celery Beat:", format_cost(t1_celery_beat))
print("Fargate Redis:", format_cost(t1_redis_task))
print("RDS DB:", format_cost(t1_db))
print("ALB:", format_cost(t1_alb))
print("S3:", format_cost(t1_s3))
print("CloudFront:", format_cost(t1_cf))
print("Misc:", format_cost(t1_misc))
print("Total:", format_cost(t1_total))
print()

print("=== Tier 2: Growth (10,000 MAUs) ===")
print("Next.js:", format_cost(t2_nextjs))
print("Django Backend:", format_cost(t2_django))
print("Celery Worker:", format_cost(t2_celery_worker))
print("Celery Beat:", format_cost(t2_celery_beat))
print("RDS DB:", format_cost(t2_db))
print("Redis ElastiCache:", format_cost(t2_redis))
print("ALB:", format_cost(t2_alb))
print("NAT Gateway:", format_cost(t2_nat))
print("S3:", format_cost(t2_s3))
print("CloudFront:", format_cost(t2_cf))
print("Misc:", format_cost(t2_misc))
print("Total:", format_cost(t2_total))
print()

print("=== Tier 3: Enterprise (50,000 MAUs) ===")
print("Next.js:", format_cost(t3_nextjs))
print("Django Backend:", format_cost(t3_django))
print("Celery Worker:", format_cost(t3_celery_worker))
print("Celery Beat:", format_cost(t3_celery_beat))
print("RDS DB:", format_cost(t3_db))
print("Redis ElastiCache:", format_cost(t3_redis))
print("ALB:", format_cost(t3_alb))
print("NAT Gateway:", format_cost(t3_nat))
print("S3:", format_cost(t3_s3))
print("CloudFront:", format_cost(t3_cf))
print("Misc:", format_cost(t3_misc))
print("Total:", format_cost(t3_total))
print()
