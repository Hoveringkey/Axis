# Deployment readiness

Axis is prepared for a provider-neutral deployment path. This phase does not
choose a cloud provider, create provider-specific configuration, or perform a
real deployment.

## Target architecture

Static frontend -> Django API -> PostgreSQL/Supabase

- Frontend: React/Vite static build, configured with `VITE_API_URL`.
- Backend: Django/DRF API, JWT SimpleJWT auth, PostgreSQL via `DATABASE_URL`.
- Database: PostgreSQL. Supabase may be used only as managed PostgreSQL.

## Phase 1 readiness

- Backend accepts deployment settings from environment variables.
- Backend can serve static files with WhiteNoise after `collectstatic`.
- Backend exposes a simple public `/health/` endpoint for platform checks.
- Required RBAC groups can be created with `bootstrap_roles`.
- Backend has a portable Dockerfile for Docker-capable providers or VPS usage.

## Phase 2 decisions

- Frontend hosting provider.
- Backend hosting provider or VPS/Coolify setup.
- Production database instance and backup policy.
- Domain, HTTPS, CORS, CSRF, and proxy values.
- Build, migration, collectstatic, and release command orchestration.

## Backend variables

- `SECRET_KEY`: required secret value.
- `DEBUG`: `False` in production.
- `DATABASE_URL`: PostgreSQL connection string.
- `ALLOWED_HOSTS`: comma-separated backend hostnames.
- `CORS_ALLOWED_ORIGINS`: comma-separated frontend origins.
- `CSRF_TRUSTED_ORIGINS`: comma-separated trusted HTTPS origins when needed.
- `SECURE_SSL_REDIRECT`: enable only behind production HTTPS.
- `SESSION_COOKIE_SECURE`: enable with production HTTPS.
- `CSRF_COOKIE_SECURE`: enable with production HTTPS.
- `USE_X_FORWARDED_PROTO`: enable when the proxy sets `X-Forwarded-Proto`.

## Frontend variables

- `VITE_API_URL`: public backend URL with no trailing slash.

Do not place secrets in `VITE_*` variables because they are exposed in the
browser bundle.

## Generic deployment steps

1. Configure backend and frontend environment variables.
2. Install backend dependencies and frontend dependencies.
3. Build the frontend static assets.
4. Run backend migrations explicitly: `python manage.py migrate`.
5. Create required groups: `python manage.py bootstrap_roles`.
6. Create an admin user when needed: `python manage.py createsuperuser`.
7. Collect backend static files: `python manage.py collectstatic --noinput`.
8. Start the backend with gunicorn:
   `gunicorn backend.wsgi:application --bind 0.0.0.0:8000`.

## Production prohibitions

- Do not run `seed_dev` in production.
- Do not call Supabase directly from the frontend for payroll data.
- Do not use `DEBUG=True` in production.
- Do not commit real `.env` files.

## Cost options

A possible zero-cost path is Cloudflare Pages for the frontend, Koyeb Free for
the backend, and Supabase Free for PostgreSQL.

Zero-cost risks include low limits, variable performance, limited backups, and
no meaningful SLA.

A future semi-robust path is Cloudflare Pages plus a small paid backend service
or VPS/Coolify, with Supabase Pro for PostgreSQL.

## Smoke checklist

- `/health/` returns 200 with `{"status": "ok"}`.
- `/api/auth/me/` without a token returns 401.
- Login returns valid JWT tokens.
- Dashboard loads.
- Payroll preview works.
- Payroll commit is allowed only for finance users.
- A second commit for the same period returns 409.
- Payroll snapshots are visible.
