<?php

declare(strict_types=1);

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

/**
 * cPanel front controller for the Civic Intelligence Platform.
 *
 * Directory layout on cPanel shared hosting:
 *
 *   /home/USERNAME/
 *   ├── cip/                  ← Laravel backend (app, bootstrap, config,
 *   │                             database, storage, vendor, .env)
 *   │   ├── app/
 *   │   ├── bootstrap/
 *   │   ├── config/
 *   │   ├── storage/
 *   │   ├── vendor/
 *   │   └── .env
 *   └── public_html/          ← Web root (cPanel serves this)
 *       ├── index.php         ← THIS FILE
 *       ├── .htaccess         ← Combined SPA + API routing
 *       ├── index.html        ← React SPA shell (from frontend/dist/)
 *       ├── assets/           ← Vite build output (JS/CSS chunks)
 *       ├── icons/            ← PWA icons
 *       ├── manifest.webmanifest
 *       ├── sw.js             ← Service worker
 *       └── storage -> ../cip/storage/app/public  ← Symlink (run storage:link)
 *
 * The paths below point ONE level up from public_html into the
 * cip/ directory, matching the standard cPanel Laravel deployment
 * pattern where the application root is above the web root.
 *
 * If your cPanel account has a different layout (e.g. the Laravel
 * app is in a subdirectory inside public_html), adjust the two
 * require paths below accordingly.
 */

define('LARAVEL_START', microtime(true));

// Determine if the application is in maintenance mode...
if (file_exists($maintenance = __DIR__.'/../cip/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Register the Composer autoloader...
require __DIR__.'/../cip/vendor/autoload.php';

// Bootstrap Laravel and handle the request...
/** @var Application $app */
$app = require_once __DIR__.'/../cip/bootstrap/app.php';

$app->handleRequest(Request::capture());
