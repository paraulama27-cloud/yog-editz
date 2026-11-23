// Worker untuk "Hapus latar": foto → topeng (mask) orang/objek utama memakai MODNet (transformers.js).
// Berjalan di thread terpisah agar aplikasi tidak macet. Model diambil dari folder models/ bila ada
// (hasil UNDUH-MODEL-AI.bat → pilihan Hapus latar), kalau tidak diunduh dari internet lalu disimpan browser.
const RMBG_MODEL = 'Xenova/modnet'; // harus sama dengan download-model.js
const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/';
const LOCAL = new URL('./vendor/transformers/', self.location.href).href;
let lib = null;
const ready = (async () => {
  try { lib = await import(LOCAL + 'transformers.min.js'); } catch (_) { lib = await import(CDN + 'transformers.min.js'); }
  const { env } = lib;
  const hasLocalWasm = await fetch(LOCAL + 'ort-wasm-simd-threaded.jsep.wasm', { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
  env.backends.onnx.wasm.wasmPaths = hasLocalWasm ? LOCAL : CDN;
  const cores = (self.navigator && self.navigator.hardwareConcurrency) || 4;
  env.backends.onnx.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(8, cores - 1)) : 1;
  env.allowLocalModels = true;
  env.localModelPath = new URL('../models/', self.location.href).href;
  env.allowRemoteModels = true;
})();

let model = null, processor = null;

// pesan: { id, blob, noLocal } → { type:'done', id, mask: Uint8ClampedArray (w*h), w, h }
self.onmessage = async (e) => {
  const { id, blob, noLocal } = e.data;
  try {
    await ready;
    const { env, AutoModel, AutoProcessor, RawImage } = lib;
    env.allowLocalModels = !noLocal;
    env.useBrowserCache = !!noLocal;
    if (!model) {
      self.postMessage({ type: 'status', id, msg: 'Memuat AI hapus latar…' });
      const load = async () => {
        const progress_callback = (p) => self.postMessage({ type: 'progress', id, p });
        model = await AutoModel.from_pretrained(RMBG_MODEL, { dtype: 'fp32', device: 'wasm', progress_callback });
        processor = await AutoProcessor.from_pretrained(RMBG_MODEL, { progress_callback });
      };
      try { await load(); } catch (err) {
        if (!/network|fetch|Failed|cache/i.test(String((err && err.message) || err))) throw err;
        try { await caches.delete('transformers-cache'); } catch (_) { /* abaikan */ }
        env.useBrowserCache = false;
        await load();
      }
    }
    self.postMessage({ type: 'status', id, msg: 'Memisahkan objek dari latar…' });
    const image = await RawImage.fromBlob(blob);
    const { pixel_values } = await processor(image);
    const { output } = await model({ input: pixel_values });
    const maskImg = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height);
    const mask = new Uint8ClampedArray(maskImg.data.length === image.width * image.height ? maskImg.data : maskImg.data.filter((_, i) => i % maskImg.channels === 0));
    self.postMessage({ type: 'done', id, mask, w: image.width, h: image.height }, [mask.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', id, msg: String((err && err.message) || err) });
  }
};
