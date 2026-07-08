import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

// Local self-signed certs (gitignored) let you test camera + geolocation
// from a phone over the LAN. Browsers only expose getUserMedia and the
// Geolocation API on a secure context (https:// or localhost), so plain
// http://<lan-ip>:5173 is blocked. When the certs exist we serve HTTPS;
// otherwise we fall back to plain HTTP (localhost dev keeps working).
const devSslDir = path.resolve(__dirname, '.devssl');
const keyPath = path.join(devSslDir, 'key.pem');
const certPath = path.join(devSslDir, 'cert.pem');
const https = fs.existsSync(keyPath) && fs.existsSync(certPath)
  ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
  : undefined;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    ...(https ? { https } : {}),
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
