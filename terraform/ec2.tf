# ── SSH key pair ──────────────────────────────────────────────────────────────
resource "aws_key_pair" "deployer" {
  key_name   = "url-shortener-key"
  public_key = file(var.ssh_public_key_path)
}

# ── Latest Amazon Linux 2023 AMI ──────────────────────────────────────────────
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023*-x86_64"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

# ── EC2 instance ──────────────────────────────────────────────────────────────
resource "aws_instance" "app" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = "t3.micro"
  key_name                    = aws_key_pair.deployer.key_name
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  associate_public_ip_address = true

  user_data = templatefile("${path.module}/user_data_docker.sh.tpl", {
    ecr_repo_url  = aws_ecr_repository.app.repository_url
    ecr_registry  = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    aws_region    = var.aws_region
    db_host       = aws_db_instance.main.address
    db_name       = var.db_name
    db_user       = var.db_username
    db_password   = var.db_password
    redis_host    = aws_elasticache_cluster.redis.cache_nodes[0].address
    url_ttl_days  = "7"
  })

  tags = { Name = "url-shortener-app" }
}

# ── Elastic IP ────────────────────────────────────────────────────────────────
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = { Name = "url-shortener-eip" }
}
