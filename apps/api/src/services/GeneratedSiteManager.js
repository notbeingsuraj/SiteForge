/**
 * GeneratedSiteManager
 *
 * Local-only lifecycle for generated Astro websites. Responsibilities:
 *  - resolve repo-root paths (templates/ and generated-sites/)
 *  - maintain a simple on-disk manifest (generated-sites/.manifest.json)
 *  - copy the reusable Astro template into generated-sites/<slug>/
 *  - allocate a free local port (base 4321 .. max)
 *  - run `npm install` + `npm run build` (Astro SSG → dist/)
 *  - start/stop a localhost static server serving the built dist/
 *  - check liveness (HTTP 200)
 *  - remove generated sites
 *
 * No cloud/deployment, no exposure beyond localhost. Bind to 127.0.0.1.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/api/src/services -> repo root (4 levels up: services → src → api → apps → root)
const REPO_ROOT = path.resolve(__dirname, '../../../../');

class GeneratedSiteManager {
  constructor() {
    this.generatedDir = config.websiteGeneration?.generatedDir
      ? path.resolve(config.websiteGeneration.generatedDir)
      : path.join(REPO_ROOT, 'generated-sites');
    this.templatesDir = config.websiteGeneration?.templatesDir
      ? path.resolve(config.websiteGeneration.templatesDir)
      : path.join(REPO_ROOT, 'apps', 'api', 'templates', 'astro-site');
    this.host = config.websiteGeneration?.host || '127.0.0.1';
    this.basePort = config.websiteGeneration?.basePort || 4321;
    this.maxPort = config.websiteGeneration?.maxPort || 4330;
    // NOTE: property name must not collide with the runInstall() method below.
    this.shouldRunInstall = config.websiteGeneration?.runInstall !== false;
    this.manifestPath = path.join(this.generatedDir, '.manifest.json');
  }

  async ensureRoots() {
    await fsp.mkdir(this.generatedDir, { recursive: true });
    await fsp.mkdir(path.dirname(this.manifestPath), { recursive: true });
    if (!fs.existsSync(this.templatesDir)) {
      throw new Error(`Astro template not found at ${this.templatesDir}`);
    }
  }

  async readManifest() {
    await this.ensureRoots();
    try {
      const raw = await fsp.readFile(this.manifestPath, 'utf8');
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }

  async writeManifest(manifest) {
    await this.ensureRoots();
    await fsp.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  siteDir(slug) {
    return path.join(this.generatedDir, slug);
  }

  /**
   * Test whether a port is free (not currently bound by another process).
   */
  isPortFree(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => server.close(() => resolve(true)));
      server.listen(port, this.host);
    });
  }

  /**
   * Allocate the next free port in [basePort, maxPort], not conflicting with
   * the manifest or currently-bound ports.
   */
  async allocatePort(excludeSlug = null) {
    const manifest = await this.readManifest();
    for (let port = this.basePort; port <= this.maxPort; port++) {
      // Skip if assigned to a different, still-managed site.
      const ownedBy = Object.entries(manifest).find(([, m]) => m?.port === port);
      if (ownedBy && ownedBy[0] !== excludeSlug) continue;
      if (await this.isPortFree(port)) return port;
    }
    throw new Error(`No free port available in range ${this.basePort}–${this.maxPort}`);
  }

  /**
   * Copy the reusable Astro template into generated-sites/<slug>/, skipping
   * build artifacts and node_modules.
   */
  async copyTemplate(slug) {
    const dest = this.siteDir(slug);
    await fsp.mkdir(dest, { recursive: true });
    await this._copyDir(this.templatesDir, dest);
    return dest;
  }

  async _copyDir(src, dest) {
    const entries = await fsp.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.astro') continue;
      // Skip lockfiles — generated sites get a clean install for their own dir.
      if (entry.name === 'package-lock.json' || entry.name === 'npm-shrinkwrap.json') continue;
      const s = path.join(src, entry.name);
      const d = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await fsp.mkdir(d, { recursive: true });
        await this._copyDir(s, d);
      } else {
        await fsp.copyFile(s, d);
      }
    }
  }

  /**
   * Write the generated site.config.json (verified facts + strategy/copy/theme).
   */
  async writeConfig(slug, siteConfig) {
    const dir = path.join(this.siteDir(slug), 'src', 'data');
    await fsp.mkdir(dir, { recursive: true });
    const file = path.join(dir, 'site.config.json');
    await fsp.writeFile(file, JSON.stringify(siteConfig, null, 2), 'utf8');
    return file;
  }

  /**
   * Run npm install (unless disabled for offline usage). A failed install that
   * leaves no node_modules throws so callers surface a clear build error;
   * an install that still leaves a usable node_modules is tolerated.
   */
  async runInstall(slug) {
    const dir = this.siteDir(slug);
    try {
      await this._run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], dir);
      return 0;
    } catch (e) {
      if (fs.existsSync(path.join(dir, 'node_modules'))) return 0;
      throw e;
    }
  }

  /**
   * Build the Astro site (SSG) into dist/.
   */
  runBuild(slug) {
    return this._run('npm', ['run', 'build'], this.siteDir(slug));
  }

  _run(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { cwd, shell: false });
      let err = '';
      child.stderr.on('data', (d) => { err += d; });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve(0);
        else {
          const e = new Error(`Command failed (${cmd} ${args.join(' ')}): ${err.slice(0, 800)}`);
          e.code = code;
          reject(e);
        }
      });
    });
  }

  /**
   * Start a localhost static server for the built dist/ output as a detached
   * child process (survives API restarts; PID tracked in the manifest).
   * Returns { port, url, pid }. Bind is 127.0.0.1 only — never exposed.
   */
  async start(slug, port) {
    const dist = path.join(this.siteDir(slug), 'dist');
    if (!fs.existsSync(dist)) {
      throw new Error(`No built output for "${slug}". Run build first.`);
    }
    await this._stopIfRunning(slug);

    // Child server script — a minimal keep-alive static file server.
    const serverScript = `
      const http = require('node:http');
      const fs = require('node:fs');
      const path = require('node:path');
      const dist = process.env.SF_DIST;
      const host = process.env.SF_HOST || '127.0.0.1';
      const port = Number(process.env.SF_PORT);
      const mime = {
        '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
        '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
        '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain',
      };
      const server = http.createServer((req, res) => {
        let urlPath;
        try { urlPath = decodeURIComponent(new URL(req.url, 'http://' + host + ':' + port).pathname); }
        catch { urlPath = '/'; }
        if (urlPath.endsWith('/')) urlPath += 'index.html';
        let filePath = path.normalize(path.join(dist, urlPath));
        if (!filePath.startsWith(dist)) { res.writeHead(403).end('Forbidden'); return; }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          filePath = path.join(dist, '404.html');
          if (!fs.existsSync(filePath)) { res.writeHead(404).end('Not Found'); return; }
        }
        fs.readFile(filePath, (err, data) => {
          if (err) { res.writeHead(404).end('Not Found'); return; }
          const ext = path.extname(filePath).toLowerCase();
          res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
          res.end(data);
        });
      });
      server.listen(port, host, () => {
        // Signal readiness on fd 3 (used by the parent spawn with pipe).
        process.stdout.write('WEBLOOM_SERVER_READY ' + port + '\n');
      });
      server.on('error', (e) => { console.error('WEBLOOM_SERVER_ERROR ' + (e && e.message)); process.exit(1); });
      process.on('SIGTERM', () => server.close(() => process.exit(0)));
      process.on('SIGINT', () => server.close(() => process.exit(0)));
    `;

    const child = spawn(process.execPath, ['-e', serverScript], {
      cwd: this.siteDir(slug),
      env: {
        ...process.env,
        SF_DIST: dist,
        SF_HOST: this.host,
        SF_PORT: String(port),
      },
      detached: true,   // survives API process restarts/shutdown
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.unref();

    // Wait for readiness (or error) — cap at ~5s.
    await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => { if (!settled) { settled = true; reject(new Error(`Server child for "${slug}" did not become ready on port ${port}`)); } }, 5000);
      child.stdout.on('data', (d) => {
        const line = String(d);
        if (line.includes('WEBLOOM_SERVER_READY') && !settled) {
          settled = true; clearTimeout(timer); resolve();
        }
      });
      child.stderr.on('data', (d) => {
        const line = String(d);
        if (line.includes('WEBLOOM_SERVER_ERROR') && !settled) {
          settled = true; clearTimeout(timer); reject(new Error(line.slice('WEBLOOM_SERVER_ERROR'.length).trim()));
        }
      });
      child.on('exit', (code) => {
        if (!settled) { settled = true; clearTimeout(timer); reject(new Error(`Server child for "${slug}" exited early with code ${code}`)); }
      });
    });

    const manifest = await this.readManifest();
    manifest[slug] = {
      ...(manifest[slug] || {}),
      port,
      url: `http://localhost:${port}`,
      status: 'running',
      pid: child.pid ?? null,
      startedAt: new Date().toISOString(),
    };
    await this.writeManifest(manifest);

    return { port, url: `http://localhost:${port}`, status: 'running', pid: child.pid };
  }

  async _stopIfRunning(slug) {
    // Terminate the tracked child process (detached server) if present.
    const manifest = await this.readManifest();
    const entry = manifest[slug];
    if (entry?.pid) {
      try { process.kill(entry.pid, 'SIGTERM'); } catch { /* already gone */ }
      // Give the child a moment to close; then SIGKILL if it lingers.
      await new Promise((r) => setTimeout(r, 150));
      try { process.kill(entry.pid, 0); process.kill(entry.pid, 'SIGKILL'); } catch { /* gone */ }
    }
    // Drop any in-process handle (legacy servers from older versions).
    if (this._servers?.has(slug)) {
      const s = this._servers.get(slug);
      await new Promise((r) => s.close?.(r) ?? r());
      this._servers.delete(slug);
    }
    if (manifest[slug]?.status === 'running') {
      manifest[slug].status = 'stopped';
      manifest[slug].pid = null;
      await this.writeManifest(manifest);
    }
  }

  async stop(slug) {
    await this._stopIfRunning(slug);
    const manifest = await this.readManifest();
    if (manifest[slug]) {
      manifest[slug].status = 'stopped';
      manifest[slug].stoppedAt = new Date().toISOString();
      await this.writeManifest(manifest);
    }
    return { slug, status: 'stopped' };
  }

  /**
   * Confirm the site is live over HTTP (HTTP 200 on /).
   */
  async isUp(slug) {
    const manifest = await this.readManifest();
    const port = manifest[slug]?.port;
    if (!port || manifest[slug]?.status !== 'running') return false;
    return new Promise((resolve) => {
      const req = http.get({ host: this.host, port, path: '/', timeout: 3000 }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
    });
  }

  /**
   * Fetch the rendered HTML at base URL.
   */
  fetchHtml(slug) {
    const manifest = this.readManifestSync();
    const port = manifest?.[slug]?.port;
    if (!port) return Promise.resolve(null);
    return this._get(`http://${this.host}:${port}/`);
  }

  _get(url) {
    return new Promise((resolve, reject) => {
      http.get(url, (res) => {
        let body = '';
        res.on('data', (d) => { body += d; });
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }).on('error', reject);
    });
  }

  readManifestSync() {
    try {
      return JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
    } catch {
      return {};
    }
  }

  /**
   * Delete a generated site (stop server first, then remove directory + manifest entry).
   */
  async remove(slug) {
    await this.stop(slug);
    const dir = this.siteDir(slug);
    if (fs.existsSync(dir)) {
      await fsp.rm(dir, { recursive: true, force: true });
    }
    const manifest = await this.readManifest();
    if (manifest[slug]) {
      delete manifest[slug];
      await this.writeManifest(manifest);
    }
    return { slug, deleted: true };
  }
}

export default new GeneratedSiteManager();
