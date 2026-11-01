// Run after `expo export --platform web`. Adds to the website folder (dist/):
//   - the privacy pages (from legal/)
//   - what makes the site installable like an app (from web-static/): manifest, icons, service worker
// so one deploy publishes the app, the pages the stores ask for, and the "Install app" option.
// (Static pages live in legal/ and web-static/, NOT public/: Expo treats public/index.html as the web page template.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIgnored } from './lib/ignore.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const indexPath = path.join(dist, 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('dist/index.html was not found. Run "npm run build-web" first.');
  process.exit(1);
}

for (const file of ['privacy.html', 'delete-account.html']) {
  fs.copyFileSync(path.join(root, 'legal', file), path.join(dist, file));
}
for (const file of fs.readdirSync(path.join(root, 'web-static'))) {
  fs.copyFileSync(path.join(root, 'web-static', file), path.join(dist, file));
}

// The hosted Google sign-in page needs the same public Firebase settings as the app: write them from src/config/firebase.js.
const cfgSource = fs.readFileSync(path.join(root, 'src/config/firebase.js'), 'utf8');
const block = cfgSource.match(/export const firebaseConfig = \{([\s\S]*?)\};/);
if (!block) { console.error('Could not read firebaseConfig from src/config/firebase.js'); process.exit(1); }
const cfg = Object.fromEntries([...block[1].matchAll(/(\w+):\s*'([^']*)'/g)].map((m) => [m[1], m[2]]));
if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId) { console.error('firebaseConfig is missing apiKey, authDomain or projectId'); process.exit(1); }
fs.writeFileSync(path.join(dist, 'google-auth-config.js'), `export default ${JSON.stringify(cfg, null, 2)};\n`);

// The website's barcode reader (iPhone Safari has none of its own) needs its engine file beside the site.
const engine = path.join(root, 'node_modules', 'zxing-wasm', 'dist', 'reader', 'zxing_reader.wasm');
if (!fs.existsSync(engine)) {
  console.error('The barcode reader engine was not found (node_modules/zxing-wasm). Run "npm install" first: without it, scanning with the camera will not work on the website / iPhone icon.');
  process.exit(1);
}
fs.copyFileSync(engine, path.join(dist, 'zxing_reader.wasm'));

// Everything in dist/ must actually be uploaded. (Once, the icon fonts were silently skipped because firebase.json told Firebase
// to ignore anything inside "node_modules", and the icon fonts live in assets/node_modules/... so every icon showed as an empty square.)
const walkFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const allFiles = walkFiles(dist).map((f) => path.relative(dist, f).split(path.sep).join('/'));
const ignorePatterns = (JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8')).hosting || {}).ignore || [];
const skipped = allFiles.filter((f) => isIgnored(f, ignorePatterns));
if (skipped.length) {
  console.error(`\nSTOP: firebase.json would make Firebase skip ${skipped.length} of the website's ${allFiles.length} files (for example ${skipped[0]}).`);
  console.error('The app would publish with missing icons or images. Remove the matching pattern from "ignore" in firebase.json, then run this again.\n');
  process.exit(1);
}
if (!allFiles.some((f) => /\/Ionicons\.[0-9a-f]+\.ttf$/i.test(f))) {
  console.error('STOP: the icon font (Ionicons) is not in the website build, so every icon would show as an empty square. Run "npm run build-web" again.');
  process.exit(1);
}

// Make the page installable. Safe to run twice: it only adds the tags once.
const MARK = 'data-pt-install';
let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes(MARK)) {
  const head = [
    `<link rel="manifest" href="/manifest.webmanifest" ${MARK}>`,
    '<style>html,body{background:#050805;overscroll-behavior:none;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent;touch-action:manipulation}</style>',
    '<meta name="theme-color" content="#050805">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-title" content="Product Trust">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black">',
    '<link rel="apple-touch-icon" href="/icon-192.png">',
  ].join('\n    ');
  const script = "<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}</script>";
  if (!html.includes('</head>') || !html.includes('</body>')) {
    console.error('dist/index.html has an unexpected shape; could not add the install tags.');
    process.exit(1);
  }
  html = html.replace('</head>', `    ${head}\n  </head>`).replace('</body>', `    ${script}\n  </body>`);
  fs.writeFileSync(indexPath, html);
}

// Page zoom: iPhone Safari zooms into any text box smaller than 16px and then stays zoomed (screens look cut off).
// Locking the scale stops that, and viewport-fit=cover lets the app use the whole screen on notched iPhones.
{
  const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />';
  let page = fs.readFileSync(indexPath, 'utf8');
  page = /<meta name="viewport"[^>]*>/i.test(page) ? page.replace(/<meta name="viewport"[^>]*>/i, VIEWPORT) : page.replace('</head>', `    ${VIEWPORT}\n  </head>`);
  fs.writeFileSync(indexPath, page);
}

const policy = fs.readFileSync(path.join(root, 'legal', 'privacy.html'), 'utf8');
if (/class="todo"/.test(policy)) {
  console.warn('\nWARNING: the privacy pages still contain yellow [placeholders] (company name, contact email...).');
  console.warn('That is fine for a classroom demo, but fill them in before you submit to Google Play or the App Store.\n');
}
console.log('Website ready in dist/: app + privacy pages + install-as-app support.');
