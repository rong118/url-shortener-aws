variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "db_password" {
  description = "Master password for RDS PostgreSQL"
  type        = string
  sensitive   = true
}

variable "db_username" {
  description = "Master username for RDS PostgreSQL"
  type        = string
  default     = "shorturl"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "shorturl"
}

variable "ssh_public_key_path" {
  description = "Path to the SSH public key to register with EC2"
  type        = string
  default     = "~/.ssh/url-shortener-key.pub"
}

variable "your_ip_cidr" {
  description = "Your IP in CIDR notation for SSH access (e.g. 1.2.3.4/32)"
  type        = string
}
