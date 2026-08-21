import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

// Local self-signed certs (gitignored) let you test camera + geolocation
// from a phone over the LAN. Browsers only expose getUserMedia and the
// Geolocation API on a secure context (https:// or localhost), so plain
// http://<lan-ip>:<frontend-port> is blocked. When the certs exist we serve HTTPS;
// otherwise we fall back to plain HTTP (localhost dev keeps working).
// CIP_DEV_HTTP=1 forces plain HTTP even when certs exist. Useful for
// testing service workers / push subscriptions: browsers treat
// http://localhost as a secure context, but do NOT extend a clicked-through
// self-signed-cert warning to service worker script fetches, so push
// subscriptions silently fail over https://<lan-ip> with an untrusted cert.
const devSslDir = path.resolve(__dirname, '.devssl');
const keyPath = path.join(devSslDir, 'key.pem');
const certPath = path.join(devSslDir, 'cert.pem');
const https =
  process.env['CIP_DEV_HTTP'] !== '1' && fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
    : undefined;
const frontendPort = Number.parseInt(process.env['CIP_FRONTEND_PORT'] ?? '5173', 10);
const backendPort = process.env['CIP_BACKEND_PORT'] ?? '8000';

export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: frontendPort,
    strictPort: true,
    ...(https ? { https } : {}),
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Public source maps expose the complete application source. They are
    // opt-in for local debugging and must never be enabled by a production
    // build unless the release owner explicitly accepts that exposure.
    sourcemap: process.env['CIP_PUBLIC_SOURCEMAP'] === '1',
  },
});
