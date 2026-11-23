// Worker untuk "Teks ke suara": kata-kata → suara AI bahasa Indonesia (VITS / MMS, transformers.js).
// Berjalan di thread terpisah agar aplikasi tidak macet. Model diambil dari folder models/ bila ada
// (hasil UNDUH-MODEL-AI.bat → pilihan Teks ke suara), kalau tidak diunduh dari internet lalu disimpan browser.
const TTS_MODEL = 'souba67/mms-tts-ind-ONNX'; // harus sama dengan download-model.js
const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/';
const LOCAL = new URL('./vendor/transformers/', self.location.href).href;
let pipeline, env;
const ready = (async () => {
  let lib;
  try { lib = await import(LOCAL + 'transformers.min.js'); } catch (_) { lib = await import(CDN + 'transformers.min.js'); }
  ({ pipeline, env } = lib);
  const hasLocalWasm = await fetch(LOCAL + 'ort-wasm-simd-threaded.jsep.wasm', { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
  env.backends.onnx.wasm.wasmPaths = hasLocalWasm ? LOCAL : CDN;
  const cores = (self.navigator && self.navigator.hardwareConcurrency) || 4;
  env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(8, cores - 1)) : 1;
  env.allowLocalModels = true;
  env.localModelPath = new URL('../models/', self.location.href).href;
  env.allowRemoteModels = true;
})();

let tts = null;

// pesan: { id, parts: [string] } → per bagian kirim {type:'part', id, i, audio, sr}, lalu {type:'done', id}
self.onmessage = async (e) => {
  const { id, parts, noLocal } = e.data;
  try {
    await ready;
    env.allowLocalModels = !noLocal; // server lokal mati → model dari internet
    env.useBrowserCache = !!noLocal; // model lokal tidak perlu (dan rawan rusak) bila disalin ke cache browser
    if (!tts) {
      self.postMessage({ type: 'status', id, msg: 'Memuat suara AI…' });
      // model ini hanya benar dalam fp32 (versi fp16/int8 menghasilkan bising)
      const make = () => pipeline('text-to-speech', TTS_MODEL, {
        dtype: 'fp32', device: 'wasm',
        progress_callback: (p) => self.postMessage({ type: 'progress', id, p }),
      });
      try {
        tts = await make();
      } catch (err) {
        if (!/network|fetch|Failed|cache/i.test(String((err && err.message) || err))) throw err;
        self.postMessage({ type: 'status', id, msg: 'Membersihkan cache AI yang rusak, mencoba lagi…' });
        try { await caches.delete('transformers-cache'); } catch (_) { /* abaikan */ }
        env.useBrowserCache = false;
        tts = await make();
      }
    }
    for (let i = 0; i < parts.length; i++) {
      self.postMessage({ type: 'status', id, msg: `Membuat suara ${i + 1}/${parts.length}…`, frac: i / parts.length });
      const out = await tts(parts[i]);
      const audio = out.audio instanceof Float32Array ? out.audio : Float32Array.from(out.audio);
      self.postMessage({ type: 'part', id, i, audio, sr: out.sampling_rate }, [audio.buffer]);
    }
    self.postMessage({ type: 'done', id });
  } catch (err) {
    self.postMessage({ type: 'error', id, msg: String((err && err.message) || err) });
  }
};
