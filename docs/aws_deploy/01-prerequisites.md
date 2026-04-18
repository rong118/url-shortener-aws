# Step 1 — Prerequisites

## 1.1 AWS account

Sign in to the [AWS Console](https://console.aws.amazon.com). Choose a region and use it consistently throughout all steps (e.g. `us-east-1`).

## 1.2 Install the AWS CLI

```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install
```

Verify:

```bash
aws --version
```

## 1.3 Create an IAM user for CLI access

1. Console → **IAM** → **Users** → **Create user**
2. Username: `url-shortener-deploy`
3. Attach policies:
   - `AmazonEC2FullAccess`
   - `AmazonRDSFullAccess`
   - `AmazonElastiCacheFullAccess`
   - `AmazonVPCFullAccess`
4. After creation, go to **Security credentials** → **Create access key** (CLI use case)
5. Save the **Access Key ID** and **Secret Access Key**

## 1.4 Configure the CLI

```bash
aws configure
# AWS Access Key ID:     <your access key>
# AWS Secret Access Key: <your secret key>
# Default region name:   us-east-1
# Default output format: json
```

## 1.5 Create an EC2 key pair

```bash
aws ec2 create-key-pair \
  --key-name url-shortener-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/url-shortener-key.pem

chmod 400 ~/.ssh/url-shortener-key.pem
```
