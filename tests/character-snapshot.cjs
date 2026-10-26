const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
let dependency = require;
if (process.env.TT_TEST_NODE_MODULES) dependency = createRequire(path.join(process.env.TT_TEST_NODE_MODULES, '../package.json'));
const {chromium} = dependency('playwright');
const {PNG} = dependency('pngjs');
const root = path.resolve(__dirname, '..');
const outputs = process.env.TT_SNAPSHOT_OUTPUT;
const products = JSON.parse(fs.readFileSync(path.join(root, 'img/season-v283/products.json'), 'utf8')).products;
const image = Buffer.from(products.season283_devil.parts.cloth.d.split(',')[1], 'base64');

(async () => {
  let browser;
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    if (pathname === '/test-delayed.png') return setTimeout(() => {res.setHeader('Content-Type', 'image/png');res.end(image);}, 180);
    if (pathname === '/test-broken.png') {res.writeHead(404);res.end();return;}
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) {res.writeHead(403);res.end();return;}
    res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : file.endsWith('.png') ? 'image/png' : file.endsWith('.gif') ? 'image/gif' : 'text/html; charset=utf-8');
    fs.readFile(file, (e, bytes) => {if (e) {res.writeHead(404);res.end();} else res.end(bytes);});
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    browser = await chromium.launch({channel: 'chrome', headless: true});
    const page = await browser.newPage();
    const externalWrites = [];
    await page.routeWebSocket('**', ws => ws.close());
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (!['GET', 'HEAD'].includes(req.method())) {externalWrites.push(url.origin);return route.abort();}
      if (url.origin === origin || url.hostname === 'www.gstatic.com') return route.continue();
      if (url.hostname === 'tinytavern.tw') {
        const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
        if (file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.png')?'image/png':file.endsWith('.gif')?'image/gif':'application/javascript'});
      }
      return route.abort();
    });
    await page.goto(origin + '/lobby.html?preview=1&mobile=1');
    await page.waitForFunction(() => window.TinyTavernUI?.exportCharacterPng);
    await page.evaluate(cfg => {
      firebase.database().goOffline(); db = null;
      Object.defineProperty(window, '__shopCfg', {value: cfg, writable: false, configurable: true});
      window.__owned = {};
      window.qaAgent = {b:{name:'揪團測試角色',doll:{front:3,back:3,cloth:3,face:2,hair:6,skin:0}},x:.5,y:.7};
      me = () => qaAgent; myKey = 'qa-local';
      window.qaUid = 'discord_test';
      window.TTVoiceOrders = {userId: () => qaUid};
      window.toBase64 = async blob => new Promise(resolve => {const r = new FileReader();r.onload = () => resolve(r.result.split(',')[1]);r.readAsDataURL(blob);});
    }, products);
    for (const outfit of ['base', 'season283_devil']) {
      const result = await page.evaluate(async outfit => {
        if (outfit !== 'base') {
          const selected = TinyTavernUI.state().catalog.find(x => x.id === outfit);
          if (!selected) throw Error('Missing real outfit fixture');
          const parts = Object.fromEntries(selected.parts.filter(p => p.defaultEquipped !== false).map(p => [p.category === 'acc' ? TinyTavernUI.accessoryKey(p) : p.slot, {source:p.source, slot:p.slot}]));
          qaAgent.b.doll = {...TinyTavernUI.makeDoll(parts, {hair:6}), hairHex:'#ad70cf',hairHex2:'#e8b1cf',hairHighlight:'#ffe8c9'};
        }
        const before = JSON.stringify(qaAgent.b.doll);
        const blob = await TinyTavernUI.exportCharacterPng();
        const native = document.createElement('canvas');native.width = native.height = 64;
        drawDollTo(native, {...qaAgent.b.doll,_blink:false}, 'idle');
        return {before,after:JSON.stringify(qaAgent.b.doll),type:blob.type,png:await toBase64(blob),native:native.toDataURL().split(',')[1]};
      }, outfit);
      assert.equal(result.type, 'image/png');assert.equal(result.before, result.after);
      const png = PNG.sync.read(Buffer.from(result.png, 'base64')), native = PNG.sync.read(Buffer.from(result.native, 'base64'));
      assert.equal(png.width, 256);assert.equal(png.height, 256);
      assert(png.data.some((v,i) => i%4===3 && v));assert(png.data.some((v,i) => i%4===3 && v===0));
      for (let y=0;y<256;y++) for (let x=0;x<256;x++) {
        const a=(y*256+x)*4,b=(Math.floor(y/4)*64+Math.floor(x/4))*4;
        assert.deepEqual(png.data.subarray(a,a+4),native.data.subarray(b,b+4),'nearest-neighbor export preserves original pixels');
      }
      if(outputs){fs.mkdirSync(outputs,{recursive:true});fs.writeFileSync(path.join(outputs,'tt-character-'+outfit+'.png'),Buffer.from(result.png,'base64'));}
      console.log('PASS original renderer: '+outfit+' (transparent, pixel-exact, no outfit mutation)');
    }
    const checks = await page.evaluate(async () => {
      const expectError = async (fn, code) => {try{await fn();return false;}catch(e){return e.code===code;}};
      const original = structuredClone(qaAgent.b.doll), getter = csImg;
      const setFixture = suffix => {
        __shopCfg.qa = {parts:{cloth:{d:'/test-delayed.png?'+suffix,g:0}}};
        qaAgent.b.doll={...original,ps:{cloth:'qa'},uiAccessories:[]};
      };
      setFixture('success');
      const started = performance.now();await TinyTavernUI.exportCharacterPng();
      const waited = performance.now()-started>=150;
      setFixture('account');
      const changing = TinyTavernUI.exportCharacterPng();qaUid='discord_other';
      const account = await expectError(()=>changing,'CHARACTER_CHANGED');qaUid='discord_test';
      setFixture('outfit');
      const dressing = TinyTavernUI.exportCharacterPng();qaAgent.b.doll.hair=1;
      const changed = await expectError(()=>dressing,'CHARACTER_CHANGED');
      __shopCfg.qa.parts.cloth.d='/test-broken.png';
      const broken = await expectError(()=>TinyTavernUI.exportCharacterPng(),'CHARACTER_ASSET_FAILED');
      const restored = csImg===getter;
      qaAgent.b.doll=original;
      // A failed unrelated thumbnail must not poison an otherwise valid avatar.
      csImg('/test-broken.png?unrelated');
      const good = await TinyTavernUI.exportCharacterPng();
      myKey=null;
      const anonymous=await expectError(()=>TinyTavernUI.exportCharacterPng(),'CHARACTER_REQUIRED');
      return {waited,account,changed,broken,restored,unrelated:good.size>0,anonymous};
    });
    for(const [name,value] of Object.entries(checks)) assert.equal(value,true,name);
    assert.equal(externalWrites.length,0,'no external data mutations');
    console.log('PASS delayed/broken art, account/outfit changes, getter restoration, anonymous access, no external writes');
  } finally {
    if(browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => {console.error(e);process.exitCode=1;});
