#!/bin/sh
# Entrypoint for the Daphne (web) container.
# Runs DB migrations and periodic-task setup on every deploy, then starts the server.
set -e

echo "[start] Running database migrations..."
python manage.py migrate --noinput

echo "[start] Collecting static files..."
python manage.py collectstatic --noinput

echo "[start] Registering Celery beat schedules..."
python manage.py setup_periodic_tasks

echo "[start] Starting Daphne ASGI server..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
