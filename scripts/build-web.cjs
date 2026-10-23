const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const web = path.join(root, '.build', 'web');
const dist = path.join(root, 'dist');
fs.mkdirSync(web, { recursive: true });
fs.mkdirSync(dist, { recursive: true });
let html = fs.readFileSync(path.join(root, 'dhses4.html'), 'utf8');
const assets = [...new Set([...html.matchAll(/"([^"\r\n]+\.(?:jpg|png|mp4))"/g)].map(m => m[1]))];
for (const name of assets) {
    const stagedName = name.replace(/^微信图片_/, 'photo_');
    const staged = path.join(web, stagedName);
    if (!fs.existsSync(staged)) fs.copyFileSync(path.join(root, name), staged);
    if (stagedName !== name && fs.existsSync(path.join(web, name))) fs.unlinkSync(path.join(web, name));
    html = html.split(JSON.stringify(name)).join(JSON.stringify(stagedName));
}
fs.writeFileSync(path.join(web, 'index.html'), html);
for (const name of assets) {
    const stagedName = name.replace(/^微信图片_/, 'photo_');
    const type = name.endsWith('.jpg') ? 'image/jpeg' : name.endsWith('.png') ? 'image/png' : 'video/mp4';
    const uri = `data:${type};base64,${fs.readFileSync(path.join(web, stagedName)).toString('base64')}`;
    html = html.split(JSON.stringify(stagedName)).join(JSON.stringify(uri));
}
fs.writeFileSync(path.join(dist, 'ohno_dhses4.html'), html);
fs.writeFileSync(path.join(root, '.build', 'web-assets.json'), JSON.stringify(assets, null, 2));
console.log(`Standalone HTML: ${fs.statSync(path.join(dist, 'ohno_dhses4.html')).size} bytes; ${assets.length} embedded media assets`);

