// Unduh model AI "Teks otomatis" (Whisper dengan waktu per kata) ke folder models/
// agar bisa dipakai offline dan tidak bergantung pada koneksi browser ke server model.
// Pemakaian:  node download-model.js            → "Akurat"  (whisper-small, ±250 MB)
//             node download-model.js base       → "Cepat"   (whisper-base,  ±77 MB)
//             node download-model.js turbo      → "Terbaik" (whisper-large-v3-turbo, ±620 MB)
//             node download-model.js tts        → "Teks ke suara" (suara AI bahasa Indonesia, ±115 MB)
//             node download-model.js rmbg       → "Hapus latar" (MODNet, ±25 MB)
//             node download-model.js all        → semuanya
const fs = require('fs');
const path = require('path');

// Harus sama dengan MODEL_CONFIG di js/app.js
const MODELS = {
  base: { id: 'onnx-community/whisper-base_timestamped', suffix: '_quantized' },
  small: { id: 'onnx-community/whisper-small_timestamped', suffix: '_quantized' },
  turbo: { id: 'onnx-community/whisper-large-v3-turbo_timestamped', suffix: '_q4' },
  // Teks ke suara (VITS / MMS bahasa Indonesia). Harus sama dengan TTS_MODEL di js/tts-worker.js
  // Hapus latar (MODNet, potret/orang, Apache-2.0). Harus sama dengan RMBG_MODEL di js/rmbg-worker.js
  rmbg: { id: 'Xenova/modnet', files: ['config.json', 'preprocessor_config.json', 'onnx/model.onnx'] },
  tts: { id: 'souba67/mms-tts-ind-ONNX', files: ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'vocab.json', 'added_tokens.json', 'onnx/model.onnx'] },
};
const COMMON = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
];

async function download({ id, suffix, files: own }) {
  console.log(`\n== ${id} ==`);
  const files = own || [...COMMON, `onnx/encoder_model${suffix}.onnx`, `onnx/decoder_model_merged${suffix}.onnx`];
  for (const f of files) {
    const dest = path.join(__dirname, 'models', id, f);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { console.log(`  ✓ ${f} (sudah ada)`); continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const url = `https://huggingface.co/${id}/resolve/main/${f}`;
    process.stdout.write(`  ↓ ${f} … `);
    const size = await fetchWithResume(url, dest + '.part');
    fs.renameSync(dest + '.part', dest);
    console.log(`${(size / 1048576).toFixed(1)} MB`);
  }
}

// Unduh dengan coba ulang; bila koneksi terputus, lanjutkan dari byte terakhir (HTTP Range)
async function fetchWithResume(url, partPath, tries = 12) {
  let total = 0;
  for (let attempt = 1; attempt <= tries; attempt++) {
    const have = fs.existsSync(partPath) ? fs.statSync(partPath).size : 0;
    if (total && have >= total) return have;
    try {
      const res = await fetch(url, { redirect: 'follow', headers: have ? { Range: `bytes=${have}-` } : {} });
      if (res.status === 416) return have; // sudah lengkap
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const resumed = res.status === 206;
      const len = Number(res.headers.get('content-length')) || 0;
      total = resumed ? have + len : len;
      const out = fs.createWriteStream(partPath, { flags: resumed ? 'a' : 'w' });
      for await (const chunk of res.body) {
        if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      }
      await new Promise((r, j) => out.end((e) => (e ? j(e) : r())));
      const now = fs.statSync(partPath).size;
      if (!total || now >= total) return now;
      throw new Error('unduhan belum lengkap');
    } catch (e) {
      if (attempt === tries) throw new Error(`${e.message} (${url})`);
      process.stdout.write(`(putus, lanjut ${attempt}) `);
      await new Promise((r) => setTimeout(r, 1500 * Math.min(attempt, 5)));
    }
  }
  return 0;
}

(async () => {
  const arg = (process.argv[2] || 'small').toLowerCase();
  const list = arg === 'all' ? Object.values(MODELS) : [MODELS[arg]];
  if (!list[0]) { console.error(`Pilihan tidak dikenal: ${arg}. Gunakan base, small, turbo, tts, rmbg, atau all.`); process.exit(1); }
  try {
    for (const m of list) await download(m);
    console.log('\nSelesai. Model tersimpan di folder models/ dan akan dipakai otomatis oleh aplikasi.');
  } catch (e) {
    console.error('\nGagal mengunduh:', e.message);
    process.exit(1);
  }
})();
