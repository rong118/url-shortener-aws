# Step 5 — EC2 Instance Setup

## 5.1 Launch the instance

```bash
# Use Amazon Linux 2023 (us-east-1 AMI — check for latest in your region)
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-2023*-x86_64" \
             "Name=state,Values=available" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)

INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t2.micro \
  --key-name url-shortener-key \
  --security-group-ids $EC2_SG \
  --associate-public-ip-address \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "INSTANCE_ID=$INSTANCE_ID"
```

## 5.2 Wait for the instance to be running

```bash
aws ec2 wait instance-running --instance-ids $INSTANCE_ID
echo "EC2 is running."
```

## 5.3 Get the public IP

```bash
EC2_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "EC2_IP=$EC2_IP"
```

## 5.4 SSH into the instance

```bash
ssh -i ~/.ssh/url-shortener-key.pem ec2-user@$EC2_IP
```

## 5.5 Install Node.js 22 on the instance

Run the following **on the EC2 instance** (after SSH):

```bash
# Install Node.js 22 via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs git

# Verify
node --version
npm --version
```

## 5.6 Clone the repository

```bash
# Still on the EC2 instance
git clone https://github.com/<your-username>/url-shortener-aws.git
cd url-shortener-aws
npm install --omit=dev
```

> Replace `<your-username>` with your GitHub username, or use the actual repo URL.
