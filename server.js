// Server lokal sederhana tanpa dependensi (Node.js).
// Jalankan: node server.js   → lalu buka http://localhost:5173
// Dengan server, aplikasi bisa di-install (PWA) dan dipakai offline.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5173;
// --lan → boleh dibuka dari HP/perangkat lain di WiFi yang sama (START-HP.bat)
const LAN = process.argv.includes('--lan');
const isLocal = (req) => /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/.test(req.socket.remoteAddress || '');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// ---------- Teks otomatis online: Groq Whisper ----------
// API key disimpan di file .groq-key di folder aplikasi (tidak pernah dikirim balik ke browser),
// atau lewat variabel lingkungan GROQ_API_KEY.
const KEY_FILE = path.join(ROOT, '.groq-key');
const GROQ = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1'; // GROQ_BASE_URL hanya untuk uji
const GROQ_MODELS = ['whisper-large-v3', 'whisper-large-v3-turbo'];
function groqKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY.trim();
  try { return fs.readFileSync(KEY_FILE, 'utf8').trim(); } catch { return ''; }
}
function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const parts = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(new Error('TOO_BIG')); req.destroy(); } else parts.push(c); });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}
// pesan kesalahan Groq → bahasa Indonesia
function groqError(status, body) {
  const m = (body && body.error && body.error.message) || '';
  if (status === 401) return 'API key Groq salah atau sudah dihapus. Periksa lagi key di console.groq.com → API Keys.';
  if (status === 429) return 'Kuota gratis Groq sedang habis (batas per menit/hari). Tunggu sebentar lalu coba lagi.' + (m ? ' (' + m + ')' : '');
  if (status === 413) return 'Audio terlalu besar untuk Groq.';
  if (status >= 500) return 'Server Groq sedang bermasalah (' + status + '). Coba lagi beberapa saat lagi.';
  return 'Groq menolak permintaan (' + status + ')' + (m ? ': ' + m : '');
}
async function handleGroq(req, res, p) {
  // hanya dari halaman aplikasi ini sendiri (cegah situs lain memakai server lokal)
  // kunci Groq milik komputer ini: perangkat lain di WiFi tidak boleh memakainya
  if (!isLocal(req)) return sendJson(res, 403, { error: 'Teks otomatis Groq hanya bisa dipakai dari komputer yang menjalankan server.' });
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return sendJson(res, 403, { error: 'Ditolak' });
  try {
    if (p === '/api/groq/status' && req.method === 'GET') return sendJson(res, 200, { set: !!groqKey(), env: !!process.env.GROQ_API_KEY });
    if (p === '/api/groq/key' && req.method === 'POST') {
      const { key } = JSON.parse((await readBody(req, 4096)).toString('utf8') || '{}');
      const k = String(key || '').trim();
      if (!/^gsk_[A-Za-z0-9]{20,}$/.test(k)) return sendJson(res, 400, { error: 'Format key tidak cocok. Key Groq diawali "gsk_".' });
      let r;
      try { r = await fetch(GROQ + '/models', { headers: { Authorization: 'Bearer ' + k } }); }
      catch { return sendJson(res, 502, { error: 'Tidak bisa menghubungi Groq. Periksa koneksi internet.' }); }
      if (!r.ok) return sendJson(res, 400, { error: groqError(r.status, await r.json().catch(() => null)) });
      fs.writeFileSync(KEY_FILE, k, { mode: 0o600 });
      return sendJson(res, 200, { set: true });
    }
    if (p === '/api/groq/key' && req.method === 'DELETE') {
      try { fs.unlinkSync(KEY_FILE); } catch {}
      return sendJson(res, 200, { set: !!groqKey() });
    }
    if (p === '/api/groq/transcribe' && req.method === 'POST') {
      const key = groqKey();
      if (!key) return sendJson(res, 400, { error: 'API key Groq belum diisi. Tempel key di tab Subtitle → Mesin teks otomatis.' });
      const q = new URL(req.url, 'http://x').searchParams;
      const model = GROQ_MODELS.includes(q.get('model')) ? q.get('model') : GROQ_MODELS[0];
      let audio;
      try { audio = await readBody(req, 25 * 1024 * 1024); } catch { return sendJson(res, 413, { error: 'Potongan audio lebih dari 25 MB.' }); }
      const form = new FormData();
      form.append('file', new Blob([audio], { type: 'audio/wav' }), 'audio.wav');
      form.append('model', model);
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');
      form.append('timestamp_granularities[]', 'segment');
      form.append('temperature', '0');
      if (q.get('lang')) form.append('language', q.get('lang'));
      if (q.get('prompt')) form.append('prompt', q.get('prompt').slice(0, 800));
      let r;
      try { r = await fetch(GROQ + '/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: form }); }
      catch { return sendJson(res, 502, { error: 'Tidak bisa menghubungi Groq. Periksa koneksi internet.' }); }
      const body = await r.json().catch(() => null);
      if (!r.ok || !body) return sendJson(res, r.ok ? 502 : r.status, { error: groqError(r.status, body) });
      return sendJson(res, 200, { text: body.text || '', words: body.words || [], segments: (body.segments || []).map((x) => ({ start: x.start, end: x.end, text: x.text })), model });
    }
    return sendJson(res, 404, { error: 'Tidak ada' });
  } catch (e) {
    return sendJson(res, 500, { error: String(e.message || e) });
  }
}

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  if (p.startsWith('/api/groq/')) { handleGroq(req, res, p); return; }
  // file rahasia (mis. .groq-key) tidak dilayani
  if (/(^|\/)\./.test(p)) { res.writeHead(404); return res.end('Not found'); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
      // "cross-origin isolated" → AI subtitle boleh memakai banyak inti prosesor (multi-thread)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} sudah dipakai. Mungkin aplikasi sudah berjalan: http://localhost:${PORT}`);
    openBrowser(`http://localhost:${PORT}`);
  } else {
    console.error(e);
  }
});

function lanAddresses() {
  const out = [];
  for (const list of Object.values(require('os').networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) out.push(a.address);
  }
  return out;
}

server.listen(PORT, LAN ? '0.0.0.0' : '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`YOG-EDITZ berjalan di ${url}`);
  if (LAN) {
    const ips = lanAddresses();
    console.log('');
    console.log('=== Buka di HP (WiFi yang sama dengan komputer ini) ===');
    ips.forEach((ip) => console.log(`   http://${ip}:${PORT}`));
    if (!ips.length) console.log('   (komputer ini tidak terhubung ke WiFi/LAN)');
    console.log('');
    console.log('Agar export video & install aplikasi jalan di HP/tablet (sekali saja):');
    console.log('  1. Di Edge buka: edge://flags/#unsafely-treat-insecure-origin-as-secure');
    console.log('     (Chrome: chrome://flags/#unsafely-treat-insecure-origin-as-secure)');
    console.log(`  2. Isi kotaknya dengan: ${ips.map((ip) => `http://${ip}:${PORT}`).join(',') || 'http://IP-KOMPUTER:' + PORT}`);
    console.log('  3. Pilih Enabled, lalu tekan Restart / Relaunch.');
    console.log('  4. Buka alamat di atas. Edge: menu ··· → "Tambahkan ke ponsel" / "Install aplikasi".');
    console.log('     Chrome: menu ⋮ → "Install aplikasi" / "Tambahkan ke layar utama".');
    console.log('Bila Windows menanyakan izin firewall untuk Node.js, centang "Private networks" lalu Allow.');
    console.log('');
  }
  console.log('Tutup jendela ini untuk menghentikan server.');
  if (!process.argv.includes('--no-open')) openBrowser(url);
});

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}
