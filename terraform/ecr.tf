data "aws_caller_identity" "current" {}

# ── ECR repository ───────────────────────────────────────────────────────────
resource "aws_ecr_repository" "app" {
  name         = "url-shortener-app"
  force_delete = true
  tags         = { Name = "url-shortener-app" }
}
