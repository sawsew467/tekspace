#!/bin/bash
set -e

DOMAIN=$1
EMAIL=$2
APP_DIR=$3

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ] || [ -z "$APP_DIR" ]; then
    echo "Usage: ./setup-nginx.sh <domain> <email> <app_dir>"
    exit 1
fi

# Check if SSL cert already exists
SSL_CERT_EXISTS=false
if [ -d "/etc/letsencrypt/live/$DOMAIN" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    SSL_CERT_EXISTS=true
    echo "SSL certificate already exists for $DOMAIN"
fi

echo "Setting up Nginx for $DOMAIN..."

# Install Nginx if not installed
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    apt-get update
    apt-get install -y nginx
fi

# Install Certbot if not installed
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Create webroot directory for certbot
mkdir -p /var/www/certbot

if [ "$SSL_CERT_EXISTS" = true ]; then
    # SSL cert exists — use full HTTPS config
    echo "Configuring Nginx with existing SSL certificate..."
    cp "$APP_DIR/nginx/admin-ssl.conf.template" /etc/nginx/sites-available/$DOMAIN
    sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/$DOMAIN
else
    # No SSL cert — use HTTP-only config for certbot verification
    echo "Configuring Nginx with HTTP-only for SSL setup..."
    cp "$APP_DIR/nginx/admin.conf.template" /etc/nginx/sites-available/$DOMAIN
    sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/$DOMAIN
fi

# Remove old domain configs that are not the current domain
for conf in /etc/nginx/sites-enabled/*; do
    [ -f "$conf" ] || continue
    name=$(basename "$conf")
    if [ "$name" != "$DOMAIN" ] && [ "$name" != "default" ] && grep -q "proxy_pass http://127.0.0.1:3003" "$conf" 2>/dev/null; then
        echo "Removing old config for $name (was proxying to :3003)..."
        rm -f "/etc/nginx/sites-enabled/$name"
        rm -f "/etc/nginx/sites-available/$name"
    fi
done

# Enable site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Test and reload nginx
nginx -t
systemctl reload nginx

# Get SSL certificate if it doesn't exist
if [ "$SSL_CERT_EXISTS" = false ]; then
    echo "Obtaining SSL certificate..."
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL

    # Now switch to full SSL config
    echo "Switching to SSL config..."
    cp "$APP_DIR/nginx/admin-ssl.conf.template" /etc/nginx/sites-available/$DOMAIN
    sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/$DOMAIN

    nginx -t
    systemctl reload nginx

    # Setup auto-renewal cron job
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
        (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
        echo "Added certbot auto-renewal cron job"
    fi
fi

echo "Nginx and SSL setup completed for $DOMAIN!"
