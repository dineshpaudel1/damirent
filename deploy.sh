#!/bin/bash
# DamiRent production deploy script.
# Run on your server after cloning the repo and setting up .env.production.
#
# Usage:
#   First deploy:  bash deploy.sh --init
#   Updates:       bash deploy.sh
#
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"
DOMAIN="api.damirent.com"   # ← change to your domain

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}   $*"; }
fail()    { echo -e "${RED}[error]${NC}  $*"; exit 1; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────
[[ -f backend/.env.production ]] || fail "backend/.env.production not found. Copy .env.production.example and fill in values."
command -v docker >/dev/null       || fail "Docker is not installed."
docker compose version >/dev/null  || fail "Docker Compose plugin is not installed."

# ── Initial setup (first deploy only) ────────────────────────────────────────
if [[ "${1:-}" == "--init" ]]; then
    info "First-time setup..."

    # Issue SSL certificate via Let's Encrypt
    info "Checking SSL certificate for $DOMAIN..."
    if [[ ! -d "certbot/conf/live/$DOMAIN" ]]; then
        info "Starting nginx temporarily for ACME challenge..."
        # Temporarily use an HTTP-only nginx config for the initial cert request
        docker run --rm -d --name nginx-tmp \
            -p 80:80 \
            -v "$(pwd)/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
            -v certbot_www:/var/www/certbot \
            nginx:1.25-alpine || true

        warn "Requesting certificate from Let's Encrypt for $DOMAIN..."
        warn "Make sure port 80 is open and DNS points to this server first."
        $COMPOSE run --rm certbot certonly \
            --webroot \
            --webroot-path=/var/www/certbot \
            --email admin@damirent.com \
            --agree-tos \
            --no-eff-email \
            -d "$DOMAIN"

        docker stop nginx-tmp 2>/dev/null || true
        info "SSL certificate obtained."
    else
        info "SSL certificate already exists, skipping."
    fi
fi

# ── Pull latest code ──────────────────────────────────────────────────────────
info "Pulling latest code..."
git pull origin main

# ── Build images ──────────────────────────────────────────────────────────────
info "Building Docker images..."
$COMPOSE build --no-cache web celery celery-beat

# ── Rolling restart ───────────────────────────────────────────────────────────
info "Starting services..."
$COMPOSE up -d --remove-orphans

# ── Health check ──────────────────────────────────────────────────────────────
info "Waiting for web service to become healthy..."
for i in $(seq 1 30); do
    if $COMPOSE exec -T web curl -sf http://localhost:8000/api/v1/products/ -o /dev/null 2>/dev/null; then
        info "Web service is healthy."
        break
    fi
    [[ $i -eq 30 ]] && fail "Web service did not become healthy in time. Check logs: $COMPOSE logs web"
    sleep 2
done

info "Deploy complete. Running containers:"
$COMPOSE ps
