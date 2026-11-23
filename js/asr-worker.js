// Worker untuk "Teks otomatis": transkripsi suara → teks dengan waktu PER KATA (Whisper, transformers.js).
// Berjalan di thread terpisah agar aplikasi tidak macet. Model diambil dari folder models/ bila ada
// (hasil UNDUH-MODEL-AI.bat), kalau tidak diunduh dari internet lalu disimpan browser.
// Pustaka AI diutamakan dari folder aplikasi (js/vendor/transformers) agar bisa offline dan bisa
// memakai BANYAK inti prosesor (multi-thread butuh file dari server yang sama). Kalau tidak ada,
// diambil dari internet (CDN).
const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/';
const LOCAL = new URL('./vendor/transformers/', self.location.href).href;
let pipeline, env;
// Disiapkan di latar; pesan yang masuk lebih dulu menunggu (tidak hilang)
const ready = (async () => {
  let lib;
  try { lib = await import(LOCAL + 'transformers.min.js'); } catch (_) { lib = await import(CDN + 'transformers.min.js'); }
  ({ pipeline, env } = lib);
  const hasLocalWasm = await fetch(LOCAL + 'ort-wasm-simd-threaded.jsep.wasm', { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
  env.backends.onnx.wasm.wasmPaths = hasLocalWasm ? LOCAL : CDN;
  // multi-thread: banyak inti prosesor, hanya bila halaman "cross-origin isolated" (dibuka lewat START.bat)
  const cores = (self.navigator && self.navigator.hardwareConcurrency) || 4;
  env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(8, cores - 1)) : 1;
  env.allowLocalModels = true;
  env.localModelPath = new URL('../models/', self.location.href).href;
  env.allowRemoteModels = true;
})();

let asr = null;
let loadedKey = '';

async function load(model, dtype, preferGpu) {
  const progress_callback = (p) => self.postMessage({ type: 'progress', p });
  // GPU (WebGPU) jauh lebih cepat untuk model besar; jika gagal, pakai CPU (wasm)
  if (preferGpu && self.navigator && self.navigator.gpu) {
    try {
      const adapter = await self.navigator.gpu.requestAdapter();
      if (adapter) {
        const p = await pipeline('automatic-speech-recognition', model, { dtype, device: 'webgpu', progress_callback });
        self.postMessage({ type: 'status', msg: 'Memakai GPU (WebGPU)…' });
        return p;
      }
    } catch (_) { /* lanjut ke CPU */ }
  }
  const p = await pipeline('automatic-speech-recognition', model, { dtype, device: 'wasm', progress_callback });
  const n = env.backends.onnx.wasm.numThreads;
  self.postMessage({ type: 'status', msg: `Memakai CPU (${n} thread)…` });
  return p;
}

self.onmessage = async (e) => {
  const { audio, model, dtype, language, preferGpu, noLocal } = e.data;
  try {
    await ready;
    // server lokal mati → lewati folder models/ dan ambil model dari internet (disimpan browser).
    // Model dari folder models/ tidak disalin ke cache browser: sudah ada di disk, dan salinan cache
    // yang rusak (mis. dari unduhan yang dulu putus) membuat "network error" terus-menerus.
    env.allowLocalModels = !noLocal;
    env.useBrowserCache = !!noLocal;
    const key = `${model}|${dtype}|${noLocal ? 'r' : 'l'}`;
    if (!asr || loadedKey !== key) {
      self.postMessage({ type: 'status', msg: 'Memuat model AI…' });
      try {
        asr = await load(model, dtype, preferGpu);
      } catch (err) {
        if (!/network|fetch|Failed|cache/i.test(String((err && err.message) || err))) throw err;
        // cache AI rusak → hapus lalu coba sekali lagi tanpa cache
        self.postMessage({ type: 'status', msg: 'Membersihkan cache AI yang rusak, mencoba lagi…' });
        try { await caches.delete('transformers-cache'); } catch (_) { /* abaikan */ }
        env.useBrowserCache = false;
        asr = await load(model, dtype, preferGpu);
      }
      loadedKey = key;
    }
    self.postMessage({ type: 'status', msg: 'Mendengarkan & mentranskrip suara…' });
    const opts = {
      return_timestamps: 'word', // waktu per kata → subtitle pas dengan ucapan
      chunk_length_s: 30,
      stride_length_s: 5,
      task: 'transcribe',
    };
    if (language && language !== 'auto') opts.language = language;
    const out = await asr(audio, opts);
    self.postMessage({ type: 'done', out: { text: out.text, chunks: out.chunks || [] } });
  } catch (err) {
    self.postMessage({ type: 'error', msg: String((err && err.message) || err) });
  }
};
