/**
 * Download a PHP runtime for the current platform into desktop/php/.
 *
 *   node scripts/fetch-php.mjs
 *
 * Windows: the official windows.php.net NTS x64 zip (php.exe + the ext DLLs we need).
 * macOS / Linux: a single static binary from the static-php-cli project (php-cli with
 * pdo_sqlite, curl, gd, mbstring, openssl, zip built in).
 * Versions are pinned below; bump them together with a test run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'php');
fs.mkdirSync(out, { recursive: true });

const WIN = 'https://windows.php.net/downloads/releases/archives/php-8.3.14-nts-Win32-vs16-x64.zip';
const SPC = (os, arch) => `https://dl.static-php.dev/static-php-cli/common/php-8.3.14-cli-${os}-${arch}.tar.gz`;

async function download(url, to) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  await pipeline(r.body, fs.createWriteStream(to));
}

if (process.platform === 'win32') {
  const zip = path.join(out, 'php.zip');
  await download(WIN, zip);
  execSync(`powershell -NoProfile -Command "Expand-Archive -Force '${zip}' '${out}'"`);
  fs.unlinkSync(zip);
  // a php.ini that turns on what FamilyTree needs
  fs.writeFileSync(path.join(out, 'php.ini'), ['extension_dir="ext"', 'extension=pdo_sqlite', 'extension=sqlite3', 'extension=curl', 'extension=openssl', 'extension=gd', 'extension=mbstring', 'extension=fileinfo', 'extension=zip', 'date.timezone=UTC', ''].join('\n'));
} else {
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
  const os = process.platform === 'darwin' ? 'macos' : 'linux';
  const tgz = path.join(out, 'php.tar.gz');
  await download(SPC(os, arch), tgz);
  execSync(`tar -xzf "${tgz}" -C "${out}"`);
  fs.unlinkSync(tgz);
  fs.chmodSync(path.join(out, 'php'), 0o755);
}
console.log('PHP ready in', out);
