/**
 * FamilyTree Desktop - the web app in a window, with PHP and SQLite bundled.
 *
 * On first run it asks for a folder (pick one inside Google Drive, Dropbox or
 * OneDrive for free sync), writes the app's .env there with a SQLite database,
 * starts PHP's built-in server on a free local port and opens the installer.
 * Every later run just starts the server and opens the tree.
 */
const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

const APP_DIR = app.isPackaged ? path.join(process.resourcesPath, 'app-src') : path.join(__dirname, '..', 'public_html');
const PHP_BIN = (() => {
  const bundled = path.join(app.isPackaged ? process.resourcesPath : __dirname, 'php', process.platform === 'win32' ? 'php.exe' : 'php');
  return fs.existsSync(bundled) ? bundled : 'php';          // falls back to a PHP on PATH while developing
})();
const statePath = path.join(app.getPath('userData'), 'state.json');
let php = null, win = null;

function readState() { try { return JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { return {}; } }
function writeState(s) { fs.mkdirSync(path.dirname(statePath), { recursive: true }); fs.writeFileSync(statePath, JSON.stringify(s, null, 2)); }

function freePort() { return new Promise(res => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }

async function chooseFolder() {
  const r = await dialog.showOpenDialog({ title: 'Where should your family tree live?', message: 'Pick a folder. A Google Drive, Dropbox or OneDrive folder gives you sync and backup for free.', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return r.filePaths[0];
}

function ensureEnv(dataDir, port) {
  const envFile = path.join(dataDir, '.env');
  if (fs.existsSync(envFile)) return false;
  const key = require('node:crypto').randomBytes(32).toString('hex');
  fs.writeFileSync(envFile, [
    '# FamilyTree Desktop. Your tree is the familytree.sqlite file next to this.',
    'APP_ENV=desktop', `APP_DOMAIN=127.0.0.1:${port}`, `APP_URL=http://127.0.0.1:${port}`, `APP_KEY=${key}`,
    'DB_DRIVER=sqlite', `DB_FILE=${path.join(dataDir, 'familytree.sqlite')}`,
    'MAIL_FROM_NAME=FamilyTree', '',
  ].join('\n'));
  return true;
}

async function startPhp(dataDir) {
  const port = await freePort();
  const fresh = ensureEnv(dataDir, port);
  // the app reads .env from its own folder: point it at the data folder through FT_ENV_FILE
  php = spawn(PHP_BIN, ['-S', `127.0.0.1:${port}`, '-t', APP_DIR, path.join(APP_DIR, '..', 'tools', 'router.php')], {
    env: { ...process.env, FT_DESKTOP: '1', FT_ENV_FILE: path.join(dataDir, '.env'), FT_STORAGE_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  php.stderr.on('data', d => process.stderr.write(d));
  php.on('exit', code => { if (code && win) dialog.showErrorBox('FamilyTree', 'The local server stopped (code ' + code + ').'); });
  // wait until it answers
  for (let i = 0; i < 50; i++) {
    const ok = await new Promise(res => { const s = net.connect(port, '127.0.0.1'); s.on('connect', () => { s.end(); res(true); }); s.on('error', () => res(false)); });
    if (ok) break;
    await new Promise(r => setTimeout(r, 100));
  }
  return { port, fresh };
}

async function main() {
  let state = readState();
  if (!state.dataDir || !fs.existsSync(state.dataDir)) {
    const dir = await chooseFolder();
    if (!dir) return app.quit();
    state = { dataDir: dir }; writeState(state);
  }
  const { port, fresh } = await startPhp(state.dataDir);
  win = new BrowserWindow({ width: 1280, height: 860, title: 'FamilyTree', webPreferences: { contextIsolation: true } });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  await win.loadURL(`http://127.0.0.1:${port}/${fresh ? 'install/' : 'admin/'}`);
}

app.whenReady().then(main);
app.on('window-all-closed', () => { if (php) php.kill(); app.quit(); });
app.on('before-quit', () => { if (php) php.kill(); });
