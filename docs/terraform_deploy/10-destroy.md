# Step 10 — Tear Down

When you no longer need the stack, destroy all AWS resources with one command:

```bash
cd terraform
terraform destroy
```

Type `yes` when prompted. Terraform will delete in dependency order:
1. EC2 instance and Elastic IP
2. ElastiCache cluster and subnet group
3. RDS instance, parameter group, and subnet group
4. Security groups

> **Warning:** This permanently deletes all data. Back up your database first if needed:
>
> ```bash
> pg_dump -h <rds_endpoint> -U shorturl -d shorturl > backup.sql
> ```

## Partial teardown

To destroy only specific resources without touching others:

```bash
# Remove just the EC2 instance (keep RDS and Redis)
terraform destroy -target=aws_instance.app -target=aws_eip.app
```
