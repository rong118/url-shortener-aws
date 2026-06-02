# Step 7 — ECR Repository + IAM Role

These two files are Docker-specific additions not present in the non-Docker Terraform deploy.

## 7.1 `ecr.tf` — ECR repository

```hcl
data "aws_caller_identity" "current" {}

resource "aws_ecr_repository" "app" {
  name         = "url-shortener-app"
  force_delete = true
  tags         = { Name = "url-shortener-app" }
}
```

> `force_delete = true` allows `terraform destroy` to remove the repository even if it contains images. Remove this flag for production.

## 7.2 `iam.tf` — IAM role for EC2 to pull from ECR

EC2 needs permission to pull Docker images from the private ECR repository. This is granted via an instance profile:

```hcl
resource "aws_iam_role" "ec2" {
  name = "url-shortener-ec2-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
  tags = { Name = "url-shortener-ec2-role" }
}

resource "aws_iam_role_policy_attachment" "ec2_ecr" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_instance_profile" "ec2" {
  name = "url-shortener-ec2-profile"
  role = aws_iam_role.ec2.name
}
```

The `iam_instance_profile` attribute is then attached to the EC2 instance (see [Step 8](08-ec2.md)), allowing the user data script and `deploy.sh update` to run `aws ecr get-login-password` and `docker pull` without managing credentials manually.
