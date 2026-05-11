# Runbook — StatusBrasil Production

Operational reference for the production VPS deployment.

---

## VPS initial setup

### 1. Install Docker + Compose plugin

```bash
# Ubuntu 24.04 LTS
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin
```

### 2. Create deploy user and directory

```bash
useradd -m -s /bin/bash deploy
usermod -aG docker deploy

mkdir -p /opt/statusbrasil
chown deploy:deploy /opt/statusbrasil
```

### 3. Authorize the deploy SSH key

Generate a dedicated Ed25519 key pair locally (never reuse your personal key):

```bash
ssh-keygen -t ed25519 -C "statusbrasil-deploy" -f ~/.ssh/statusbrasil_deploy -N ""
```

Add the **public** key to the VPS:

```bash
# On the VPS as root:
mkdir -p /home/deploy/.ssh
echo "<PUBLIC_KEY_CONTENTS>" >> /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

Add the **private** key to GitHub → Settings → Secrets → `SSH_DEPLOY_KEY`.

### 4. Configure GitHub Actions secrets and variables

| Kind | Name | Value |
|------|------|-------|
| Secret | `SSH_DEPLOY_KEY` | Private key from step 3 |
| Variable | `VPS_HOST` | VPS IP or hostname (e.g. `123.45.67.89`) |
| Variable | `VPS_USER` | `deploy` |
| Variable | `PROD_URL` | `https://statusbrasil.org` (no trailing slash) |

`CRON_SECRET` and other app secrets live on the VPS only (see below) — **never** put them in GitHub secrets.

### 5. Create the production environment file

```bash
# On the VPS as root:
mkdir -p /etc/statusbrasil
cat > /etc/statusbrasil/env << 'EOF'
DATABASE_URL=postgres://user:strongpassword@db-host:5432/statusbrasil
CRON_SECRET=<generate with: openssl rand -hex 32>
METRICS_SECRET=<generate with: openssl rand -hex 32>
UPSTASH_REDIS_REST_URL=https://your-upstash-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=<upstash token>
NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/project-id
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=statusbrasil.org
EOF

chmod 600 /etc/statusbrasil/env
chown root:docker /etc/statusbrasil/env
```

### 6. Place the production compose file on the VPS

```bash
# /opt/statusbrasil/compose.yaml
cat > /opt/statusbrasil/compose.yaml << 'EOF'
services:
  app:
    image: ghcr.io/thiagorech/statusbrasil:latest
    restart: unless-stopped
    env_file: /etc/statusbrasil/env
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
EOF
chown deploy:deploy /opt/statusbrasil/compose.yaml
```

Cloudflare proxies port 443 → 3000. No nginx reverse proxy needed.

### 7. Pull and start the first deployment manually

```bash
# On the VPS as deploy:
cd /opt/statusbrasil
docker compose pull
docker compose up -d
```

From this point, every `git push --tags v*.*.*` triggers `deploy.yml` automatically.

---

## Secrets rotation

### Rotate CRON_SECRET

```bash
# 1. Generate new value
NEW_SECRET=$(openssl rand -hex 32)

# 2. Update the env file on the VPS (as root)
sed -i "s|^CRON_SECRET=.*|CRON_SECRET=${NEW_SECRET}|" /etc/statusbrasil/env

# 3. Restart the app to pick up the new value
cd /opt/statusbrasil && docker compose up -d app

# 4. Update the CRON_SECRET GitHub Actions secret
#    → GitHub repo → Settings → Secrets → CRON_SECRET → Update value
#    (The cron.yml workflow reads it from there to send the X-Cron-Secret header)
```

### Rotate METRICS_SECRET

Same steps as CRON_SECRET — replace `CRON_SECRET` with `METRICS_SECRET` above.
No GitHub secret to update (METRICS_SECRET is VPS-only; the `/api/metrics` endpoint checks it server-side).

### Rotate DATABASE_URL

```bash
# 1. Provision new Postgres credentials at your DB provider
# 2. Verify connectivity: psql "NEW_DATABASE_URL" -c "SELECT 1"
# 3. Update the env file (as root):
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=NEW_VALUE|" /etc/statusbrasil/env
# 4. Restart:
cd /opt/statusbrasil && docker compose up -d app
# 5. Verify health: curl https://statusbrasil.org/api/health
```

---

## Checking logs

```bash
# On the VPS as deploy:
docker compose -f /opt/statusbrasil/compose.yaml logs --tail=100 -f app
```

## Rolling back to a previous release

```bash
# On the VPS as deploy:
docker compose -f /opt/statusbrasil/compose.yaml pull app \
  --image ghcr.io/thiagorech/statusbrasil:0.0.9   # replace with target version
docker compose -f /opt/statusbrasil/compose.yaml up -d --no-deps app
```
