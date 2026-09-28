# Kasa Ilaya Frontend – Fixed Version

## Important Vercel setting
Set this Environment Variable in Vercel for **Production** (and Preview if needed):

`VITE_API_BASE_URL=https://kasa-ilaya-resort-back-end.onrender.com/api`

After changing it, redeploy the frontend. Vite embeds `VITE_*` variables during build time.

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
