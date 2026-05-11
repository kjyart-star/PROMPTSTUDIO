import http from 'node:http';
import { promises as fs } from 'node:fs';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { extname, join, normalize, resolve } from 'node:path';

const argv = process.argv.slice(2);
const getArg = (name) => {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  return argv[idx + 1] ?? null;
};

const hasFlag = (name) => argv.includes(name);

const HOST = getArg('--host') ?? process.env.HOST ?? '127.0.0.1';
const PORT = Number(getArg('--port') ?? process.env.PORT ?? '4173');
const SHOULD_OPEN = hasFlag('--open');

const DIST_DIR = resolve(process.cwd(), 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const safeJoin = (base, target) => {
  // Ensure the target is always treated as a relative path.
  // If it stays absolute (starts with /), path.join(base, target) would ignore `base`.
  const targetPath = normalize(target)
    .replace(/^(\.\.(\/|\\|$))+/, '')
    .replace(/^[/\\]+/, '');
  return join(base, targetPath);
};

const fileExists = async (path) => {
  try {
    const stat = await fs.stat(path);
    return stat.isFile();
  } catch {
    return false;
  }
};

const serveFile = (res, path, contentType) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  createReadStream(path).pipe(res);
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const fsPath = safeJoin(DIST_DIR, pathname);
    const ext = extname(fsPath).toLowerCase();
    const type = MIME[ext] ?? 'application/octet-stream';

    // Serve requested file if it exists.
    if (await fileExists(fsPath)) {
      serveFile(res, fsPath, type);
      return;
    }

    // SPA fallback: return index.html for unknown routes.
    const indexPath = join(DIST_DIR, 'index.html');
    if (await fileExists(indexPath)) {
      serveFile(res, indexPath, MIME['.html']);
      return;
    }

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('dist/index.html not found. Run `npm run build` first.');
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(String(err?.message || err));
  }
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/`;
  // eslint-disable-next-line no-console
  console.log(`[serve:dist] ${DIST_DIR}`);
  // eslint-disable-next-line no-console
  console.log(`[serve:dist] listening on ${url}`);

  if (SHOULD_OPEN && process.platform === 'darwin') {
    spawn('open', [url], { stdio: 'ignore' });
  }
});
