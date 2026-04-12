# Genesis Wildcard Hosting Setup

This document explains how deployed apps become reachable at:

https://<app-name>.genesisapp.in

## Root Cause of "Server Not Found"

The URL can fail with "Server Not Found" when wildcard DNS is missing or points to the wrong IP.
In earlier behavior, the API could return a deployment URL before runtime + health checks were complete.

## What Is Implemented Now

1. DNS preflight before deploy starts
- Deploy API validates wildcard DNS resolution for *.genesisapp.in.
- If DNS is missing or mismatched, deploy returns HTTP 503 and no URL is returned.

2. URL is gated on health
- Deploy API waits (configurable timeout) for deployment completion.
- URL is returned only after frontend and backend health checks pass.
- If still deploying after timeout, API returns HTTP 202 with deploymentUrl = null.

3. Subdomain reverse routing
- Incoming requests for *.genesisapp.in are handled by server middleware.
- Middleware extracts subdomain, resolves project mapping from deployment_domains table, and proxies to active managed runtime.

4. Deployment mapping source of truth
- deployment_domains stores subdomain -> project mapping.
- projects stores deploy_frontend_url, deploy_backend_url, deploy_url, and status.

## DNS Setup (Required)

Configure wildcard DNS at your DNS provider:

- A record: *.genesisapp.in -> <your server public IPv4>
- Optional AAAA: *.genesisapp.in -> <your server public IPv6>

Validation command examples:

- nslookup test.genesisapp.in
- dig +short test.genesisapp.in

## Reverse Proxy (Nginx)

Use:

- server/config/nginx/genesis-wildcard.conf

This config:

- redirects HTTP to HTTPS
- terminates TLS for *.genesisapp.in
- forwards all wildcard host traffic to Genesis API server (127.0.0.1:5000)

## SSL for Wildcard Domain

Use DNS challenge to issue wildcard certificate:

- certbot certonly --manual --preferred-challenges dns -d genesisapp.in -d '*.genesisapp.in'

Then set certificate paths in Nginx config and reload:

- nginx -t
- systemctl reload nginx

## Environment Variables

Set in server/.env:

- GENESIS_DEPLOY_BASE_DOMAIN=genesisapp.in
- GENESIS_REQUIRE_WILDCARD_DNS=true
- GENESIS_WILDCARD_TARGET_IPV4=<optional expected IP list>
- GENESIS_WILDCARD_TARGET_IPV6=<optional expected IPv6 list>
- DEPLOY_SYNC_TIMEOUT_MS=240000

## Deployment Flow

1. User requests deployment.
2. Server validates DNS/gateway infrastructure readiness.
3. Server reserves subdomain mapping.
4. Runtime is built and started.
5. Frontend and backend health checks must pass.
6. Project status is set to deployed.
7. Deployment URL is returned.

If any step fails:

- deployment is marked failed
- URL is withheld
- retry job is queued with failure reason

## Docker Cloud Mode (Free Stack)

Genesis now supports `platform = docker-cloud` in deploy API.

This path provisions and deploys through your own VPS (AWS Free Tier EC2, DigitalOcean credits, or generic VPS) using:

- Docker + Docker Compose
- Nginx reverse proxy (via `nginx-proxy` image)
- Automatic SSL (Let's Encrypt via ACME companion)
- GitHub Actions CI/CD workflow generation
- Optional Kubernetes bootstrap (k3s + HPA manifests)

### Required Settings

Save in app settings under Deployment Providers:

- VPS Host/IP
- VPS SSH User
- VPS SSH Port
- VPS SSH Private Key
- App Domain (for example `app.example.com`)
- API Domain (for example `api.example.com`)
- SSL Email
- Optional: Enable Kubernetes bootstrap

### DNS Requirements

Before deploying, create DNS records:

- `A app.genesisapp.in -> <vps-ip>`
- `A api.genesisapp.in -> <vps-ip>`

### Deployment Output

On successful deployment:

- API stores deployment status as `deployed`
- URL is returned as `https://<app-domain>`
- Repo on VPS is synced and updated
- Docker stack is running through Compose
- SSL certificates are requested and renewed automatically

### Optional Kubernetes

When enabled, deployment also:

- installs k3s (if missing)
- applies frontend/backend HPA manifests in namespace `genesis`

This provides autoscaling primitives on low-cost/free infrastructure without requiring a managed Kubernetes plan.

## Zero-Config Managed Deploy (Vercel-Like)

Genesis also supports an internal managed deployment mode where users do not provide VPS/SSH credentials.

### Product Behavior

1. User clicks Deploy.
2. Genesis reserves or reuses a subdomain (for example `project-x.genesisapp.in`).
3. Genesis writes generated files to an isolated runtime directory.
4. Runtime is launched by internal engine (`PM2` or `Docker`) based on server env.
5. Health checks gate success before status becomes `deployed`.
6. Status and runtime metadata are persisted in `deployments`.

### Managed Runtime Modes

- `GENESIS_MANAGED_RUNTIME=pm2` (default)
- `GENESIS_MANAGED_RUNTIME=docker`

Optional runtime limits:

- `GENESIS_MANAGED_MEMORY_LIMIT=768m`
- `GENESIS_MANAGED_CPU_LIMIT=1.0`
- `GENESIS_MANAGED_PIDS_LIMIT=256`

### API Contract

- `POST /api/deploy/deploy`
	- body: `{ projectId, subdomain? }`
	- response: deployment queued (`202`)
- `GET /api/deploy/status/:deployId`
	- response: deployment status object
- `GET /api/deploy/logs/:deployId`
	- response: latest runtime logs (PM2 or Docker)
- `POST /api/deploy/redeploy/:projectId`
	- response: redeploy queued (`202`)
- `POST /api/deploy/stop/:deployId`
	- response: deployment marked `stopped`

### Deployment Registry Fields

Stored in `deployments`:

- `project_id`
- `user_id`
- `subdomain`
- `runtime_type` (`pm2` or `docker`)
- `runtime_id` (pm2 name or container id/name)
- `runtime_port`
- `status`

### Wildcard Routing

Ingress path:

- Nginx terminates TLS for `*.genesisapp.in` and forwards traffic to Genesis API.
- Genesis middleware resolves subdomain -> runtime port mapping.
- Request is proxied to runtime on loopback.

Nginx reference config:

- `server/config/nginx/genesis-wildcard.conf`
