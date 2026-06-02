# Step 1 — Prerequisites

## 1.1 Install Terraform

**macOS (Homebrew)**

```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
terraform -version
```

**Linux (APT)**

```bash
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

Or download the binary directly from [developer.hashicorp.com/terraform/downloads](https://developer.hashicorp.com/terraform/downloads).

## 1.2 Install Docker

Terraform doesn't manage Docker — install it on your local machine for building images:

**Linux**

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect
```

**macOS:** Download [Docker Desktop](https://www.docker.com/products/docker-desktop/) or `brew install --cask docker`.

**Windows:** Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) or `choco install docker-desktop`.

Verify:

```bash
docker --version
```

## 1.3 Configure AWS credentials

```bash
aws configure
# AWS Access Key ID: <your key>
# AWS Secret Access Key: <your secret>
# Default region name: us-east-1
# Default output format: json
```

Alternatively, set environment variables:

```bash
export AWS_ACCESS_KEY_ID=<your key>
export AWS_SECRET_ACCESS_KEY=<your secret>
export AWS_DEFAULT_REGION=us-east-1
```

## 1.4 Create an SSH key pair

```bash
ssh-keygen -t ed25519 -f ~/.ssh/url-shortener-key -C "url-shortener"
```

This creates:
- `~/.ssh/url-shortener-key` — private key
- `~/.ssh/url-shortener-key.pub` — public key (uploaded to AWS)

## 1.5 Required IAM permissions

Your AWS user/role needs at minimum:

- `AmazonEC2FullAccess`
- `AmazonRDSFullAccess`
- `AmazonElastiCacheFullAccess`
- `AmazonVPCFullAccess`
- `AmazonEC2ContainerRegistryFullAccess`

For a quick sandbox, `AdministratorAccess` is acceptable.
