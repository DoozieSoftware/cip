# Local Development (Native — No Docker)

This guide runs the Civic Intelligence Platform (CIP) on your machine using
native services instead of Docker Compose. It uses a local MySQL/MariaDB
server, a local Redis server, and a natively installed MinIO binary.

Use this when you want to develop against native services rather than `docker compose up`.

> The repo ships `start.sh`, which is already written for this native mode:
> it assumes MySQL on `127.0.0.1:3306`, Redis on `127.0.0.1:6379`,
> and runs `php artisan serve` + Vite (no containers).

---

## 1. Prerequisites

| Tool        | Version        | Notes |
| ----------- | -------------- | ----- |
| PHP         | >= 8.4        | `php8.4` binary preferred, else `php` >= 8.4. (8.5 works with a composer flag — see §6.) |
| Composer    | 2.x            | |
| Node        | >= 18          | |
| npm         | >= 9           | |
| MySQL 8.4 / MariaDB | server running | Any local MySQL/MariaDB reachable on `127.0.0.1:3306` |
| Redis       | server running | Reachable on `127.0.0.1:6379` |

Verify:

```bash
php -v            # >= 8.4
composer -V
node -v           # >= 18
mysqladmin ping -h 127.0.0.1 -uroot -p"root" --silent   # DB reachable
redis-cli ping     # PONG
```

---

## 2. Database (native MySQL/MariaDB)

Create the application database and a dedicated user. (Replace the root
credentials with whatever your local server uses.)

```bash
mysql -uroot -p'YOUR_ROOT_PASSWORD' <<'SQL'
CREATE DATABASE IF NOT EXISTS cip
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'cip'@'localhost'  IDENTIFIED BY 'cip';
CREATE USER IF NOT EXISTS 'cip'@'127.0.0.1' IDENTIFIED BY 'cip';
GRANT ALL PRIVILEGES ON cip.* TO 'cip'@'localhost';
GRANT ALL PRIVILEGES ON cip.* TO 'cip'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
```

> In this environment the local server is MariaDB 11.8. The root account
> required a password (not unix-socket auth). The `skip-grant-tables`
> reset was used only if root access is ever lost — it is not needed for
> a normal setup.

---

## 3. Redis (native)

Start the local Redis server (already running in this environment on
`127.0.0.1:6379`). No schema setup is required.

```bash
redis-server --daemonize yes
redis-cli ping   # PONG
```

---

## 4. MinIO (native object storage for media)

CIP stores citizen evidence (photos/videos) in an S3-compatible bucket.
Install the MinIO server binary natively (no Docker):

```bash
sudo curl -fsSL https://dl.min.io/server/minio/release/linux-amd64/minio \
  -o /usr/local/bin/minio
sudo chmod +x /usr/local/bin/minio

# Data dir + run (credentials must match backend/.env)
mkdir -p /var/lib/minio-data
MINIO_ROOT_USER=cipminio MINIO_ROOT_PASSWORD=cipminio-secret \
  /usr/local/bin/minio server /var/lib/minio-data \
  --address 127.0.0.1:9000 --console-address 127.0.0.1:9001
```

Create the `cip-evidence` bucket with the `mc` client:

```bash
sudo curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc \
  -o /usr/local/bin/mc && sudo chmod +x /usr/local/bin/mc

mc alias set cipminio http://127.0.0.1:9000 cipminio cipminio-secret
mc mb cipminio/cip-evidence
```

The default credentials (`cipminio` / `cipminio-secret`) come from
`backend/.env.example` and already match the backend config.

---

## 5. Backend configuration

```bash
cd backend
cp .env.example .env
```

Point the env at the native services (the example ships Docker hostnames):

```bash
# Replace Docker hostnames with localhost
sed -i 's/^DB_HOST=mysql$/DB_HOST=127.0.0.1/' .env
sed -i 's/^REDIS_HOST=redis$/REDIS_HOST=127.0.0.1/' .env
sed -i 's#^AWS_ENDPOINT=http://minio:9000#AWS_ENDPOINT=http://127.0.0.1:9000#' .env
sed -i 's#^AWS_URL=http://localhost:9000/cip-evidence#AWS_URL=http://127.0.0.1:9000/cip-evidence#' .env
```

Install dependencies and set up the schema + seed data:

```bash
composer install --no-dev --no-scripts
php artisan key:generate --force
php artisan migrate --force
php artisan db:seed --force
php artisan storage:link
```

> **PHP 8.5 note:** the locked `phpoffice/phpspreadsheet` requires
> `php < 8.5`. On PHP 8.5, add `--ignore-platform-req=php` to the
> `composer install` (app runs fine on 8.5). For a clean match to the
> spec (PHP 8.4), install PHP 8.4 and re-run without the flag.

---

## 6. Frontend configuration

```bash
cd frontend
cp .env.example .env
```

Point the SPA at the local backend (the example ships a remote host):

```bash
sed -i 's#^VITE_API_BASE=.*#VITE_API_BASE=http://localhost:8000/api/v1#' .env
sed -i 's#^VITE_API_BASE_URL=.*#VITE_API_BASE_URL=http://localhost:8000/api/v1#' .env
```

```bash
npm install
npm approve-scripts esbuild   # allow esbuild postinstall (needed by Vite)
```

---

## 7. Run the stack

Start each process (use `nohup ... &` or a terminal multiplexer so they
survivе shell detach):

```bash
# Backend API (Laravel)
cd backend
nohup php artisan serve --port=8000 --host=0.0.0.0 > /tmp/cip-backend.log 2>&1 &
nohup php artisan queue:work --tries=1 --sleep=1   > /tmp/cip-queue.log   2>&1 &

# Frontend (Vite)
cd frontend
nohup npx vite --host --port=5173 > /tmp/cip-frontend.log 2>&1 &
```

Alternatively, `./start.sh` performs the same: it creates the DB (when
run with `--setup`), migrates/seeds, and launches backend + queue + Vite.

Verify:

```bash
curl http://localhost:8000/api/v1/health   # {"success":true,...}
curl -sf http://127.0.0.1:9000/minio/health/live && echo " minio ok"
redis-cli ping
```

---

## 8. URLs

| Service        | URL |
| -------------- | --- |
| Backend API    | `http://localhost:8000/api/v1` |
| API docs       | `http://localhost:8000/api/documentation` |
| Frontend (SPA) | `http://localhost:5173` |
| MinIO console  | `http://127.0.0.1:9001` |

Demo accounts (OTP is returned in the API response — see `start.sh`):

| Role       | Mobile       |
| ---------- | ------------ |
| Citizen    | `9999900001` |
| Moderator  | `9999900002` |
| Department | `9999900003` |
| Admin      | `9999900004` |

---

## 9. Persistence caveat

MariaDB, Redis, and MinIO, plus the `artisan serve` / `queue:work` /
Vite processes, were started manually in this session and do **not**
auto-start on reboot. Add them to your init system (systemd user units,
or a small startup script) if you want them to persist.
