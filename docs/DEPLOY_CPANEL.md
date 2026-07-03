# cPanel Deployment Guide

This guide covers deploying the Civic Intelligence Platform to a cPanel
shared hosting account with **MySQL + PHP** (no Redis, no MinIO).

## Architecture on cPanel

```
/home/USERNAME/
├── cip/                      ← Laravel backend (NOT web-accessible)
│   ├── app/
│   ├── bootstrap/
│   ├── config/
│   ├── database/
│   ├── storage/              ← Media files, logs, cache, sessions
│   ├── vendor/
│   └── .env                  ← Production environment config
│
└── public_html/              ← Web root (cPanel serves this)
    ├── index.php             ← Laravel front controller (API)
    ├── index.html            ← React SPA shell
    ├── .htaccess             ← Combined API + SPA routing
    ├── assets/               ← Vite JS/CSS chunks
    ├── icons/                ← PWA icons
    ├── manifest.webmanifest
    ├── sw.js                 ← Service worker
    └── storage -> ../cip/storage/app/public  ← Symlink
```

**Key principle:** The Laravel application lives above the web root
(`cip/`) so that `.env`, `vendor/`, and `storage/` are never
web-accessible. Only `public_html/` is served.

---

## Prerequisites

### On your cPanel account

- **PHP 8.4** (or 8.3 minimum) with extensions:
  - `pdo_mysql`, `mbstring`, `xml`, `ctype`, `json`, `bcmath`, `openssl`
  - `fileinfo`, `gd` (or `imagick` for thumbnail generation)
  - `simplexml`, `tokenizer`, `curl`
- **MySQL 8.0+** (MySQL 5.7 may work but spatial columns require 8.0+)
- **SSH access** (cPanel Terminal is sufficient)
- **Cron jobs** (for queue worker + scheduler)

### On your local machine

- Node.js 20+ and npm
- PHP 8.4+ and Composer (for packaging)
- `rsync` (usually pre-installed on macOS/Linux)

### Modal AI endpoint

A vision-capable model deployed on Modal.com. The text-only
`Qwen2.5-3B-Instruct` **cannot classify photos** — deploy a vision
model instead (e.g. `Qwen/Qwen2.5-VL-7B-Instruct`).

Verify your endpoint:
```bash
curl https://YOUR-MODAL-ENDPOINT.modal.run/v1/models
# The model ID should contain "VL" (vision-language)
```

---

## Step 1: Package the application (local machine)

From the repository root:

```bash
./scripts/deploy-cpanel.sh
```

This will:
1. Build the React frontend (`npm run build` → `frontend/dist/`)
2. Install backend Composer dependencies (production, no-dev, optimized)
3. Create `deploy/cip-cpanel.tar.gz`

The tarball contains two top-level directories:
- `cip/` — the full Laravel backend
- `public_html/` — the web root (SPA + Laravel front controller)

---

## Step 2: Upload to cPanel

### Option A: SCP (from terminal)

```bash
scp deploy/cip-cpanel.tar.gz USERNAME@YOUR_SERVER:~/
```

### Option B: cPanel File Manager

1. Log into cPanel
2. Open **File Manager**
3. Navigate to `/home/USERNAME/` (one level above `public_html`)
4. Click **Upload** and select `cip-cpanel.tar.gz`
5. Right-click the file → **Extract**
6. You should now have `/home/USERNAME/cip/` and the extracted
   `public_html/` contents

### If public_html already has content

The tarball's `public_html/` will be extracted alongside existing
files. To avoid conflicts:

```bash
# On the server (SSH)
cd /home/USERNAME
mv public_html public_html_backup
tar xzf cip-cpanel.tar.gz
# public_html/ now has the fresh deployment
```

---

## Step 3: Create the MySQL database

1. In cPanel, open **MySQL Database Wizard**
2. Create database: `USERNAME_cip` (cPanel prefixes with your username)
3. Create user: `USERNAME_cipuser` with a strong password
4. Grant **ALL PRIVILEGES** on the database to the user
5. Note these credentials for Step 5

---

## Step 4: Configure the environment (SSH)

```bash
cd /home/USERNAME/cip
cp .env.cpanel .env   # Already in the tarball, but safe to re-copy
nano .env
```

Edit these values:

```ini
APP_URL=https://YOUR-DOMAIN.com

DB_DATABASE=USERNAME_cip
DB_USERNAME=USERNAME_cipuser
DB_PASSWORD=your_database_password

SANCTUM_STATEFUL_DOMAINS=YOUR-DOMAIN.com
SESSION_DOMAIN=YOUR-DOMAIN.com

MAIL_FROM_ADDRESS=no-reply@YOUR-DOMAIN.com

AI_MODAL_BASE_URL=https://akshayjoshi999--cpr-chatbot-vllm-serve.modal.run
AI_MODAL_MODEL=Qwen/Qwen2.5-VL-7B-Instruct
AI_MODAL_API_KEY=
```

---

## Step 5: Generate APP_KEY and run migrations (SSH)

```bash
cd /home/USERNAME/cip
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force
php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
```

**Note on `storage:link`:** The symlink in `public_html/storage` must
point to `cip/storage/app/public`. If `storage:link` fails (cPanel
symlink permissions), create it manually:

```bash
ln -s /home/USERNAME/cip/storage/app/public /home/USERNAME/public_html/storage
```

---

## Step 6: Set up cron jobs

In cPanel → **Cron Jobs**, add these two jobs:

### Queue worker (runs every minute)

```
* * * * * cd /home/USERNAME/cip && php artisan queue:work --stop-when-empty --tries=1 --timeout=60 >> /dev/null 2>&1
```

This processes any pending background jobs (AI pipeline, notifications,
thumbnails) and exits immediately if the queue is empty. The `--timeout=60`
ensures it never exceeds cPanel's process time limit.

### Scheduler (runs every minute)

```
* * * * * cd /home/USERNAME/cip && php artisan schedule:run >> /dev/null 2>&1
```

This drives the SLA breach checker (`CheckSlaBreaches`, every 5 minutes)
and any future scheduled tasks.

---

## Step 7: Create the storage symlink

The `public_html/storage` symlink lets the web server serve media files
(thumbnails, etc.) directly:

```bash
ln -sf /home/USERNAME/cip/storage/app/public /home/USERNAME/public_html/storage
```

---

## Step 8: Verify the deployment

### Check the API health endpoint

```bash
curl https://YOUR-DOMAIN.com/api/v1/health
# Expected: {"success":true,"data":{"status":"ok"},...}
```

### Check the SPA loads

Open `https://YOUR-DOMAIN.com/` in a browser — you should see the CIP
landing page.

### Check the queue worker

Submit a test report via the citizen portal, then:

```bash
cd /home/USERNAME/cip
php artisan queue:work --stop-when-empty --tries=1 --timeout=60
# You should see the AI pipeline job process
```

### Check the AI provider

```bash
cd /home/USERNAME/cip
php artisan tinker
>>> $cfg = App\Modules\AI\Models\AiProviderConfig::where('code', 'modal-vision')->first();
>>> echo $cfg->base_url;
>>> echo $cfg->model;
>>> echo $cfg->active ? 'active' : 'inactive';
```

To test the provider connectivity:

```bash
curl https://YOUR-MODAL-ENDPOINT.modal.run/v1/models
```

---

## cPanel-specific configuration notes

### PHP version and extensions

In cPanel → **MultiPHP Manager**:
- Set the PHP version to 8.4 (or 8.3)
- Apply to your domain

In cPanel → **PHP Selector** / **Select PHP Version**:
- Enable extensions: `pdo_mysql`, `mbstring`, `gd`, `bcmath`, `ctype`,
  `curl`, `fileinfo`, `openssl`, `tokenizer`, `xml`, `simplexml`

### PHP limits

In cPanel → **MultiPHP INI Editor**, set:

```ini
memory_limit = 256M
max_execution_time = 120
upload_max_filesize = 64M
post_max_size = 64M
```

The `max_execution_time = 120` is needed because the AI pipeline job
can take up to 60 seconds. Queue jobs run via cron, which is not subject
to the web request time limit, but the `queue:work` command itself needs
headroom.

### Directory permissions

```bash
cd /home/USERNAME/cip
chmod -R 755 storage bootstrap/cache
chmod 644 .env
```

cPanel typically runs PHP as the cPanel user (not `www-data`), so
ownership should already be correct.

---

## What was adapted for cPanel

| Component | Production (Docker) | cPanel (Pilot) |
|-----------|-------------------|----------------|
| Queue | Redis + Horizon daemon | Database + cron worker |
| Cache | Redis | File (`storage/framework/cache/`) |
| Session | Redis | Database (`sessions` table) |
| File storage | MinIO (S3) | Local filesystem (`storage/app/media/`) |
| AI provider | Mock (dev default) | Modal vision endpoint |
| Virus scan | ClamAV | Log scanner (always clean) |
| SMS | Real gateway | Log driver (OTP in `laravel.log`) |
| Process manager | Supervisor | cPanel cron |
| Web server | Nginx | Apache/LiteSpeed (`.htaccess`) |

---

## Troubleshooting

### "500 Internal Server Error" on all pages

1. Check `storage/logs/laravel.log`:
   ```bash
   tail -50 /home/USERNAME/cip/storage/logs/laravel.log
   ```
2. Most common cause: `.env` has wrong DB credentials or APP_KEY is
   missing. Re-run `php artisan key:generate`.
3. Clear the config cache after editing `.env`:
   ```bash
   php artisan config:clear
   php artisan config:cache
   ```

### API returns 404 but SPA loads fine

The `.htaccess` is not routing `/api/*` to Laravel. Verify:
- `public_html/.htaccess` exists and has the `RewriteCond %{REQUEST_URI} ^/api`
  rule
- Apache `mod_rewrite` is enabled (it is on virtually all cPanel hosts)
- `public_html/index.php` exists and the paths point to `../cip/`

### Queue jobs not processing

1. Check the cron job is running:
   ```bash
   cd /home/USERNAME/cip && php artisan queue:work --stop-when-empty --tries=1 --timeout=60
   ```
2. Check the `jobs` table has rows:
   ```bash
   php artisan tinker
   >>> DB::table('jobs')->count();
   ```
3. Check `failed_jobs`:
   ```bash
   >>> DB::table('failed_jobs')->latest()->first();
   ```

### AI classification fails

1. Verify the Modal endpoint is reachable from the server:
   ```bash
   curl https://YOUR-MODAL-ENDPOINT.modal.run/v1/models
   ```
2. Check the provider config:
   ```bash
   php artisan tinker
   >>> App\Modules\AI\Models\AiProviderConfig::where('code', 'modal-vision')->first()->toArray();
   ```
3. Check `ai_jobs` for error details:
   ```bash
   >>> App\Modules\AI\Models\AiJob::latest()->first();
   ```
4. The Modal endpoint must be able to fetch the media URL. Verify
   `APP_URL` in `.env` is set to your public domain — the signed URL
   is generated relative to `APP_URL`.

### Media upload fails

1. Check `storage/app/media/` is writable:
   ```bash
   touch /home/USERNAME/cip/storage/app/media/test.txt && rm test.txt
   ```
2. Check PHP `upload_max_filesize` and `post_max_size` in MultiPHP INI Editor
3. Check the `public_html/storage` symlink exists

### Blank white screen (SPA)

1. Check browser console for 404s on `assets/` files
2. Verify `public_html/index.html` exists and references `/assets/...`
3. If assets are served from a subpath, set `base` in `vite.config.ts`
   before rebuilding

---

## Re-deploying updates

```bash
# Local machine
./scripts/deploy-cpanel.sh
scp deploy/cip-cpanel.tar.gz USERNAME@YOUR_SERVER:~/

# Server (SSH)
cd /home/USERNAME
tar xzf cip-cpanel.tar.gz   # Overwrites existing files
cd cip
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
php artisan queue:restart   # Pick up new job code
```

---

## Security checklist for pilot

- [ ] `APP_DEBUG=false` in `.env`
- [ ] `APP_KEY` generated and set
- [ ] `APP_URL` set to your real domain (needed for signed media URLs)
- [ ] HTTPS enabled (cPanel → AutoSSL)
- [ ] `.env` file permissions: `chmod 644 .env`
- [ ] `storage/` directory not web-accessible (lives in `cip/`, not `public_html/`)
- [ ] Database user has permissions only on the CIP database
- [ ] Cron job email output disabled (`>> /dev/null 2>&1`)
- [ ] `storage/logs/laravel.log` periodically checked/cleared
