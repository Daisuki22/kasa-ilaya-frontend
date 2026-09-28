# Kasa Ilaya Frontend – Fixed Version

## Important Vercel setting
Production and Preview use the same-origin `/api` path, which `vercel.json` rewrites to the Render backend. Keep this variable as `/api` (the repository `.env.example` already has this value):

`VITE_API_BASE_URL=/api`

The frontend intentionally uses `/api` in production so API requests and uploads pass through the Vercel rewrites. For a non-Vercel deployment, configure that platform's proxy or set `VITE_API_BASE_URL` to its reachable backend URL before building.

## What was fixed
- Corrected the local Vite `/api` proxy to point to the Node backend on port `10000`.
- Removed the missing `/img/Logo2~no.png` default hero reference; it now uses the existing `/img/Logo.png`.
- Hardened asset URL normalization for API-returned relative image paths.
- Added a safe image fallback for hero/banner/package images so one broken URL does not leave a blank image.
- Kept the existing PHP-compatible API endpoint names because the fixed Node backend intentionally supports them (`auth.php`, `entities.php`, `inquiries.php`, `integrations.php`).

## Frontend → Backend contract verified against the fixed backend
- `/api/auth.php`
- `/api/entities.php`
- `/api/inquiries.php`
- `/api/integrations.php`
- `/api/health`

The fixed backend also supports the cleaner `/api/auth`, `/api/entities`, `/api/inquiries`, and `/api/integrations` routes.
