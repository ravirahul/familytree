/**
 * tools/render-emblems.mjs - rasterise the built-in emblems to PNG.
 *
 *   node tools/render-emblems.mjs
 *
 * Writes public_html/assets/emblems/{id}.png, 512x512, white on transparent;
 * emblem.php tints them to each family's colour. Needs Playwright's Chromium
 * (npx playwright install chromium, once).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// playwright from the project, or else the global install (npm i -g playwright)
let chromium;
try { ({ chromium } = await import('playwright')); }
catch {
  const g = execSync('npm root -g').toString().trim();
  ({ chromium } = await import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href));
}

const here = path.dirname(fileURLToPath(import.meta.url));
const pub  = path.join(here, '..', 'public_html');
const out  = path.join(pub, 'assets', 'emblems');
fs.mkdirSync(out, { recursive: true });
const js = fs.readFileSync(path.join(pub, 'assets', 'emblems.js'), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
await page.setContent('<!doctype html><html><body style="margin:0;background:transparent"><div id="x"></div></body></html>');
await page.addScriptTag({ content: js });
const ids = await page.evaluate(() => Object.keys(window.FT_EMBLEMS));
for (const id of ids) {
  await page.evaluate((id) => { document.getElementById('x').innerHTML = window.ftEmblemSvg(id, '#FFFFFF', 512); }, id);
  await page.locator('#x svg').screenshot({ path: path.join(out, `${id}.png`), omitBackground: true });
  console.log('rendered', id);
}
await browser.close();
console.log(ids.length, 'emblems ->', out);
