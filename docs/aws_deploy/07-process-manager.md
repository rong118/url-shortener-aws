# Step 7 — Process Manager (PM2)

PM2 keeps the app running after you close the SSH session and restarts it automatically on reboot.

All commands run **on the EC2 instance**.

## 7.1 Install PM2

```bash
sudo npm install -g pm2
```

## 7.2 Start the application

```bash
cd ~/url-shortener-aws
pm2 start src/server.js --name url-shortener
```

## 7.3 Save the process list and enable startup on reboot

```bash
pm2 save

# Generate and enable the systemd startup script
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user
# Run the printed `sudo ...` command exactly as shown
```

## 7.4 Useful PM2 commands

```bash
pm2 status               # check running processes
pm2 logs url-shortener   # tail app logs
pm2 restart url-shortener
pm2 stop url-shortener
```

## 7.5 View application logs

```bash
# Real-time
pm2 logs url-shortener --lines 50

# Log files are stored at:
~/.pm2/logs/url-shortener-out.log   # stdout
~/.pm2/logs/url-shortener-error.log # stderr
```
