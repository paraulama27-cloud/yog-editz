/* =========================================================
   YOG-EDITZ — editor video di browser
   Render ke <canvas>, preview, lalu export video
   memakai canvas.captureStream() + MediaRecorder.
   ========================================================= */
(() => {
  'use strict';

  // ---------- Konstanta ----------
  const STORAGE_KEY = 'editor-video-kata-kata:v1';

  const RATIOS = {
    '9:16': [1080, 1920],
    '4:5': [1080, 1350],
    '1:1': [1080, 1080],
    '16:9': [1920, 1080],
  };

  const GRADIENTS = [
    ['#0f2027', '#2c5364'], ['#41295a', '#2f0743'], ['#ff7e5f', '#feb47b'],
    ['#1a2a6c', '#b21f1f'], ['#141e30', '#243b55'], ['#c94b4b', '#4b134f'],
    ['#00b09b', '#96c93d'], ['#232526', '#414345'], ['#ee9ca7', '#ffdde1'],
    ['#4568dc', '#b06ab3'], ['#f7971e', '#ffd200'], ['#000428', '#004e92'],
  ];
  const GRADIENT_NAMES = [
    'Laut Malam', 'Ungu Gelap', 'Senja', 'Merah Biru', 'Biru Malam', 'Merah Ungu',
    'Hijau Segar', 'Abu Gelap', 'Pink Lembut', 'Biru Ungu', 'Oranye Cerah', 'Biru Dalam',
  ];
  const SCENE_COLORS = [['#000000', 'Hitam'], ['#ffffff', 'Putih'], ['#f3ead7', 'Krem']];

  const SAMPLE_QUOTES = [
    ['Tidak apa-apa berjalan *pelan*, asal tidak berhenti.', ''],
    ['Hari ini mungkin berat, tapi kamu jauh lebih *kuat* dari yang kamu kira.', ''],
    ['Bersyukur bukan karena semuanya baik, tapi karena kita masih diberi *kesempatan*.', ''],
    ['Mimpi besar dimulai dari *langkah kecil* yang dilakukan setiap hari.', ''],
    ['Jangan bandingkan *prosesmu* dengan hasil orang lain.', ''],
    ['Tenang. Yang ditakdirkan untukmu *tidak akan tertukar*.', ''],
    ['Lelah boleh, *menyerah jangan*.', ''],
    ['Jadilah versi *terbaik* dirimu, bukan salinan orang lain.', ''],
    ['Pelan-pelan saja, semua akan *indah* pada waktunya.', ''],
    ['Orang hebat bukan yang tidak pernah jatuh, tapi yang selalu *bangkit*.', ''],
  ];

  const QUALITY_BITRATE = { medium: 4e6, high: 8e6, max: 16e6, ultra: 28e6 };
  // bitrate menyesuaikan resolusi & frame rate (nilai dasar untuk 1080p 30 fps)
  function exportBitrate(w, h) {
    const base = QUALITY_BITRATE[state.export.quality] || 8e6, fps = +state.export.fps || 30;
    const px = (w * h) / (1080 * 1920);
    return Math.round(Math.min(120e6, Math.max(1.5e6, base * px * Math.sqrt(fps / 30))));
  }

  const PARTICLE_BASE = { snow: 120, bokeh: 22, stars: 90, rain: 140, dust: 60, hearts: 18 };

  const defaultStyle = () => ({
    font: 'Poppins', weight: '600', color: '#ffffff', authorColor: '#ffd166', highlightColor: '#ffd166',
    size: 76, lineHeight: 1.35, posY: 0.5, align: 'center', letterSpacing: 0,
    shadow: true, uppercase: false, italic: false,
    boxBg: false, boxColor: '#000000', boxOpacity: 0.45,
    stroke: false, strokeColor: '#000000', strokeWidth: 6, glow: false, float: false,
    hlStyle: 'color', textGradient: false, color2: '#ffd166',
  });
  // inDur / outDur: lama animasi masuk / keluar teks dalam detik (0 = otomatis)
  const defaultAnim = () => ({ type: 'fade', transition: 'fade', speed: 1, inDur: 0, outDur: 0 });
  const defaultEffects = () => ({
    particles: 'none', amount: 1, vignette: 0, grain: false, progressBar: false,
    quoteMark: false, frame: 'none', fadeBlack: false, visualizer: 'none',
  });

  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const defaultState = () => ({
    id: newId(),
    name: 'Project baru',
    header: { text: '', style: 'plain', size: 42, y: 0.12, color: '#ffffff' },
    voice: { volume: 1, delay: 0, duck: true, pitch: 0, fx: 'none' },
    // suara asli video latar (bisa dibisukan semua, atau per video lewat item.muted)
    vsound: { on: true, volume: 1 },
    // subtitle / teks otomatis (waktu dalam detik pada timeline video)
    captions: {
      items: [], show: true, y: 0.78, size: 56, color: '#ffffff', hl: '#ffd166',
      style: 'box', karaoke: true, upper: false, maxWords: 6,
      source: 'voice', lang: 'indonesian', model: 'small', ref: 'none', offset: 0,
      engine: 'local', groqModel: 'whisper-large-v3',
      // tampilan lengkap
      font: '', weight: 800, italic: false, spacing: 0, width: 0.84,
      boxColor: '#000000', boxOpacity: 0.62, strokeColor: '#000000', strokeW: 0.18,
      anim: 'pop', animOut: 'none', hlMode: 'color', glow: false, rot: 0, template: '',
    },
    viz: {
      x: 0.5, y: 0.88, width: 0.8, height: 1, bars: 48, thickness: 1,
      color: 'highlight', customColor: '#ffffff', opacity: 0.85, glow: false,
    },
    ratio: '9:16',
    // susunan: 'free' = lapisan teks bebas (waktu & posisi bebas), 'scenes' = scene berurutan
    layout: 'free',
    duration: 10, // durasi video pada susunan teks bebas (bila tidak ikut latar)
    durFromBg: true, // teks bebas: durasi video = total durasi foto/video latar
    texts: [],
    segs: [], // lapisan efek / filter di timeline
    scenes: [
      { text: 'Tidak apa-apa berjalan *pelan*,\nasal tidak berhenti.', author: '', duration: 5, emoji: '', bg: '' },
      { text: 'Lelah boleh, *menyerah jangan*.', author: '', duration: 4, emoji: '', bg: '' },
    ],
    logo: { pos: 'tr', size: 0.16, opacity: 0.9 },
    bg: {
      type: 'color', preset: 0, animate: true, color: '#000000', kenburns: true, overlay: 0, blur: 0,
      // foto / video: 'single' = satu media untuk semua scene, 'slideshow' = bergantian per scene
      mediaMode: 'timed', mediaId: '', slideDur: 3,
      // filter warna & efek animasi untuk latar (klip bisa punya sendiri)
      filter: 'none', filterAmt: 100, fx: 'none', fxAmt: 60,
      // transisi antar scene / slideshow (bukan urutan klip)
      xTrans: 'fade', xDur: 0.6,
      bright: 1, contrast: 1, sat: 1,
    },
    // pustaka foto & video (file-nya disimpan di IndexedDB, di sini hanya pengaturannya)
    media: [],
    // urutan klip latar (seperti editor video): potongan media dengan trim, durasi, kecepatan, transisi
    clips: [],
    // track audio tambahan (lagu / efek suara): posisi, trim, volume, fade, efek suara
    audios: [],
    style: defaultStyle(),
    anim: defaultAnim(),
    effects: defaultEffects(),
    watermark: '',
    // kepala track timeline: sembunyikan / kunci / bisukan
    tracks: { textHide: false, textLock: false, videoLock: false, audioMute: false, audioLock: false, musicMute: false, voiceMute: false, voiceLock: false },
    // caption untuk posting ke media sosial (tab Export)
    share: { caption: '' },
    music: { volume: 0.8, start: 0, fade: true },
    // ketukan musik: sumber, periode (dtk), posisi ketukan pertama di file sumber
    beat: { src: '', period: 0, off: 0, show: true, snap: true, every: 2, nudge: 0 },
    export: { fps: '30', quality: 'high', res: '1', mode: 'auto', fileName: '' },
    markers: [], // penanda di timeline: { id, t, color, label }
  });

  // ---------- Template siap pakai ----------
  const TEMPLATES = [
    { name: 'Minimal', bg: { type: 'gradient', preset: 7, overlay: 0.2 }, style: {}, anim: { type: 'fade' }, effects: {} },
    { name: 'Senja', bg: { type: 'gradient', preset: 2, overlay: 0.25 },
      style: { font: 'Playfair Display', weight: '700', italic: true, highlightColor: '#fff3b0', size: 80 },
      anim: { type: 'slideUp' }, effects: { particles: 'bokeh', vignette: 0.35 } },
    { name: 'Malam Tenang', bg: { type: 'gradient', preset: 11, overlay: 0.15 },
      style: { font: 'Lora', weight: '600', highlightColor: '#9ad1ff', authorColor: '#9ad1ff' },
      anim: { type: 'word' }, effects: { particles: 'stars', vignette: 0.3 } },
    { name: 'Motivasi', bg: { type: 'gradient', preset: 3, overlay: 0.35 },
      style: { font: 'Bebas Neue', weight: '400', uppercase: true, size: 130, lineHeight: 1.08, letterSpacing: 3, highlightColor: '#ffd200' },
      anim: { type: 'zoom' }, effects: { grain: true, vignette: 0.45, progressBar: true } },
    { name: 'Romantis', bg: { type: 'gradient', preset: 8, overlay: 0.15 },
      style: { font: 'Dancing Script', weight: '700', size: 100, highlightColor: '#ff4d6d', authorColor: '#ffffff' },
      anim: { type: 'fade', speed: 0.8 }, effects: { particles: 'hearts' } },
    { name: 'Hujan Galau', bg: { type: 'gradient', preset: 4, overlay: 0.35 },
      style: { font: 'Lora', weight: '400', italic: true, color: '#dfe7f2', highlightColor: '#8fb8ff', authorColor: '#8fb8ff' },
      anim: { type: 'typewriter' }, effects: { particles: 'rain', vignette: 0.5 } },
    { name: 'Neon', bg: { type: 'color', color: '#07070c', overlay: 0 },
      style: { font: 'Montserrat', weight: '800', uppercase: true, size: 84, color: '#00f0ff', highlightColor: '#ff2bd6', authorColor: '#ff2bd6', glow: true, shadow: false },
      anim: { type: 'blur' }, effects: { particles: 'dust', amount: 0.6 } },
    { name: 'Salju', bg: { type: 'gradient', preset: 0, overlay: 0.2 },
      style: { font: 'Montserrat', weight: '600', highlightColor: '#bfe9ff' },
      anim: { type: 'slideUp' }, effects: { particles: 'snow' } },
    { name: 'Tulisan Tangan', bg: { type: 'color', color: '#f3ead7', overlay: 0 },
      style: { font: 'Caveat', weight: '700', size: 100, color: '#2b2b2b', shadow: false, highlightColor: '#d1495b', authorColor: '#7a5c3e' },
      anim: { type: 'typewriter' }, effects: { grain: true, vignette: 0.2 } },
    { name: 'Kotak Bersih', bg: { type: 'gradient', preset: 9, overlay: 0.1 },
      style: { boxBg: true, boxOpacity: 0.5, float: true, highlightColor: '#ffd166' },
      anim: { type: 'fade' }, effects: {} },
    { name: 'Outline', bg: { type: 'gradient', preset: 10, overlay: 0.1 },
      style: { font: 'Poppins', weight: '800', uppercase: true, stroke: true, strokeWidth: 8, shadow: false, size: 84, highlightColor: '#ffffff', color: '#ffffff' },
      anim: { type: 'zoom' }, effects: { progressBar: true } },
    { name: 'Debu Emas', bg: { type: 'gradient', preset: 1, overlay: 0.25 },
      style: { font: 'Merriweather', weight: '700', highlightColor: '#f5c451', authorColor: '#f5c451', float: true },
      anim: { type: 'word' }, effects: { particles: 'dust', vignette: 0.4 } },
    { name: 'Bioskop', bg: { type: 'gradient', preset: 7, overlay: 0.35 },
      style: { font: 'Playfair Display', weight: '400', italic: true, size: 70, color: '#f1e9d8', highlightColor: '#e9b44c', authorColor: '#e9b44c' },
      anim: { type: 'fade', speed: 0.7 }, effects: { frame: 'film', grain: true, vignette: 0.5, fadeBlack: true } },
    { name: 'Kutipan Klasik', bg: { type: 'color', color: '#1d2b36', overlay: 0 },
      style: { font: 'Merriweather', weight: '400', size: 66, highlightColor: '#f2c14e', authorColor: '#f2c14e', align: 'left' },
      anim: { type: 'slideLeft' }, effects: { quoteMark: true, frame: 'double' } },
    { name: 'Karaoke', bg: { type: 'gradient', preset: 5, overlay: 0.3 },
      style: { font: 'Montserrat', weight: '800', size: 80, highlightColor: '#ffe066' },
      anim: { type: 'karaoke' }, effects: { visualizer: 'bars', frame: 'corner' } },
    { name: 'Aurora', bg: { type: 'aurora', preset: 9, overlay: 0.1 },
      style: { font: 'Montserrat', weight: '600', size: 74, highlightColor: '#9be7ff', textGradient: true, color2: '#c9b6ff' },
      anim: { type: 'blur' }, effects: { particles: 'stars', amount: 0.6 } },
    { name: 'Stabilo', bg: { type: 'waves', preset: 6, overlay: 0.15 },
      style: { font: 'Poppins', weight: '800', size: 78, highlightColor: '#fff176', hlStyle: 'marker' },
      anim: { type: 'pop' }, effects: {} },
  ];

  // ---------- Bank kata-kata (ditulis khusus untuk aplikasi ini) ----------
  const QUOTE_BANK = {
    'Motivasi': [
      'Mulai saja dulu. *Sempurna* bisa menyusul.',
      'Kegagalan bukan akhir, tapi *guru* yang paling jujur.',
      'Kerja keras hari ini adalah *hadiah* untuk dirimu di masa depan.',
      'Tidak ada yang instan. Nikmati setiap *prosesnya*.',
      'Langkah kecil yang konsisten mengalahkan *semangat besar* yang cepat padam.',
      'Jatuh itu biasa. *Bangkit* itu pilihan.',
      'Jangan berhenti saat lelah, berhentilah saat *selesai*.',
      'Usaha tidak akan *mengkhianati* hasil.',
    ],
    'Religi': [
      'Jika doamu belum terjawab, mungkin Allah sedang menyiapkan yang *lebih baik*.',
      'Sabar dan syukur, dua kunci *hati yang tenang*.',
      'Dekatkan dirimu pada-Nya, maka *urusanmu* akan dimudahkan.',
      'Tidak ada yang sia-sia dari setiap *doa* yang kau panjatkan.',
      'Rezeki tidak akan *tertukar*, tugas kita hanya berikhtiar.',
      'Sujud adalah tempat terbaik untuk *mengadu*.',
      'Perbaiki salatmu, maka hidupmu akan ikut *diperbaiki*.',
      'Bersyukurlah, karena yang kau keluhkan bisa jadi *doa* orang lain.',
    ],
    'Cinta': [
      'Cinta yang baik tidak membuatmu *kehilangan dirimu sendiri*.',
      'Yang tepat akan datang di waktu yang *tepat*.',
      'Mencintai itu sederhana: *peduli* tanpa diminta.',
      'Kamu adalah alasan aku *tersenyum* hari ini.',
      'Jaga yang ada, sebelum ia jadi *kenangan*.',
      'Cinta bukan tentang siapa yang datang duluan, tapi siapa yang *bertahan*.',
      'Bersamamu, hal biasa terasa *istimewa*.',
      'Sayangi dirimu dulu, sebelum *menyayangi* orang lain.',
    ],
    'Galau': [
      'Ada yang pergi agar kamu belajar *melepaskan*.',
      'Tidak semua yang kita *genggam* ditakdirkan untuk kita simpan.',
      'Menangislah jika perlu, lalu *bangkit* lagi.',
      'Rindu ini tidak salah, hanya *waktunya* yang belum tepat.',
      'Terkadang diam adalah cara terbaik untuk *menjaga hati*.',
      'Luka hari ini akan jadi *cerita* yang menguatkan nanti.',
      'Aku baik-baik saja, hanya sedang *belajar ikhlas*.',
      'Tidak apa-apa tidak dipilih. Kamu tetap *berharga*.',
    ],
    'Sukses': [
      'Fokus pada *tujuan*, bukan pada omongan orang.',
      'Disiplin adalah jembatan antara *mimpi* dan kenyataan.',
      'Orang sukses bukan yang tidak pernah gagal, tapi yang *tidak menyerah*.',
      'Investasi terbaik adalah *dirimu sendiri*.',
      'Kesempatan datang pada mereka yang *siap*.',
      'Kerja cerdas, kerja keras, dan kerja *ikhlas*.',
      'Sukses itu bukan kebetulan, tapi hasil dari *kebiasaan*.',
      'Jangan tunggu motivasi, bangun *kebiasaan*.',
    ],
    'Kehidupan': [
      'Hidup ini singkat, jangan habiskan untuk *membenci*.',
      'Bahagia itu sederhana, asal kita tahu cara *bersyukur*.',
      'Tidak semua hal harus *dijelaskan*. Biarkan waktu yang menjawab.',
      'Orang baik tidak selalu dibalas baik, tapi tetaplah *baik*.',
      'Jadilah seperti padi, makin berisi makin *merunduk*.',
      'Ketenangan adalah *kekayaan* yang sering dilupakan.',
      'Hari kemarin adalah pelajaran, hari ini adalah *kesempatan*.',
      'Kurangi mengeluh, perbanyak *bersyukur*.',
    ],
    'Sabar': [
      'Sabar bukan berarti diam, tapi *tetap berusaha* tanpa mengeluh.',
      'Ikhlas itu berat, tapi *melegakan*.',
      'Semua ada waktunya. *Tenang* saja.',
      'Badai pasti *berlalu*.',
      'Yang terbaik tidak selalu datang *cepat*.',
      'Ikhlaskan yang pergi, *syukuri* yang tetap tinggal.',
      'Pelan-pelan, hati juga butuh waktu untuk *sembuh*.',
      'Beban yang datang tidak pernah melebihi *kemampuanmu*.',
    ],
    'Keluarga': [
      'Rumah bukan soal tempat, tapi tentang *siapa* yang menunggumu pulang.',
      'Doa ibu adalah *pelindung* yang tak terlihat.',
      'Ayah memang jarang bicara, tapi *cintanya* tak pernah berkurang.',
      'Selagi orang tua masih ada, *bahagiakan* mereka.',
      'Keluarga adalah tempat pertama untuk *pulang*.',
      'Tidak ada cinta yang seluas *cinta ibu*.',
      'Lelah ayah adalah *senyummu* hari ini.',
      'Peluk mereka hari ini, karena waktu tidak bisa *diulang*.',
    ],
  };

  // ---------- State ----------
  let state = loadState() || defaultState();
  const media = { logo: null };
  const mediaEls = new Map(); // id → { el, ready, missing, url }

  // ---------- DOM ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const canvas = $('#canvas');
  let ctx = canvas.getContext('2d'); // bisa dialihkan sementara ke kanvas bantu (efek komposisi latar)
  const music = $('#music');
  const voice = $('#voice');
  const hasAudio = () => !!(music.src || voice.src || (state.audios && state.audios.length));
  // suara video latar terdengar? (global aktif & video tidak dibisukan)
  const videoAudible = (item) => !!(item && item.kind === 'video' && state.vsound.on && !item.muted && +state.vsound.volume > 0);
  // ada video bersuara yang dipakai di salah satu scene?
  const hasVideoSound = () => videoSoundSegments().length > 0;
  const anyAudio = () => hasAudio() || hasVideoSound();
  // preferensi tampilan (bukan bagian project)
  const ui = { guides: false, capturing: false, selMedia: '', selText: '', selClip: '', selAudio: '', textBoxes: [] };
  try { ui.guides = localStorage.getItem('evkk:guides') === '1'; } catch (_) { /* abaikan */ }
  const btnPlay = $('#btnPlay');

  // ---------- Util ----------
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const fract = (v) => v - Math.floor(v);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const freeMode = () => state.layout === 'free';
  const scenesDuration = () => state.scenes.reduce((a, s) => a + Math.max(0.5, +s.duration || 0), 0);
  const totalDuration = () => {
    if (!freeMode()) return scenesDuration();
    const bd = state.durFromBg ? bgDuration() : 0;
    return bd > 0 ? bd : Math.max(1, +state.duration || 10);
  };
  const FREE_SCENE = { text: '', author: '', bg: '' }; // "scene" tunggal untuk susunan teks bebas
  const r1 = (v) => Math.round(v * 10) / 10;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => (String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'yog-editz').slice(0, 60);

  // ---------- Notifikasi (toast) ----------
  function toast(msg, type = 'info', ms = 3500) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
  }

  function setSaveState(saving) {
    const el = $('#saveState');
    if (!el) return;
    el.textContent = saving ? 'Menyimpan…' : 'Tersimpan ✓';
    el.classList.toggle('saving', saving);
  }

  function isLight(hex) {
    const n = parseInt(String(hex).slice(1), 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6;
  }

  function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mergeDeep(base, extra) {
    for (const k of Object.keys(extra || {})) {
      if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k] && typeof base[k] === 'object') {
        mergeDeep(base[k], extra[k]);
      } else {
        base[k] = extra[k];
      }
    }
    return base;
  }
  // Gabungkan data tersimpan dengan bawaan + migrasi format lama
  function fromJSON(obj) {
    const s = mergeDeep(defaultState(), obj);
    if (s.bg.type === 'image' || s.bg.type === 'video') s.bg.type = 'media';
    // project lama (sebelum ada teks bebas) tetap memakai susunan scene
    if (!obj || !obj.layout) { s.layout = 'scenes'; s.texts = []; }
    if (!Array.isArray(s.texts)) s.texts = [];
    if (!Array.isArray(s.audios)) s.audios = [];
    if (!Array.isArray(s.segs)) s.segs = [];
    if (!Array.isArray(s.markers)) s.markers = [];
    // project sebelum ada klip: tiap media jadi satu klip
    if (!obj || !Array.isArray(obj.clips)) s.clips = s.media.map((m) => newClip(m.id));
    if (!Array.isArray(s.media)) s.media = [];
    return s;
  }

  // ---------- Penyimpanan file media (IndexedDB) ----------
  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((res, rej) => {
        const r = indexedDB.open('evkk-media', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('files');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    return dbPromise;
  }
  async function idb(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction('files', mode);
      const req = fn(tx.objectStore('files'));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  }
  const idbPut = (id, blob) => idb('readwrite', (s) => s.put(blob, id));
  const idbGet = (id) => idb('readonly', (s) => s.get(id));
  const idbDel = (id) => idb('readwrite', (s) => s.delete(id));
  const idbKeys = () => idb('readonly', (s) => s.getAllKeys());

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      // project lama: efek Ken Burns dimatikan → tanpa gerak
      if (saved.bg && saved.bg.motion === undefined && saved.bg.kenburns === false) saved.bg.motion = 'none';
      return fromJSON(saved);
    } catch (_) { return null; }
  }

  // ---------- Simpan + Undo/Redo ----------
  const history = { undo: [], redo: [], last: null };
  let saveTimer = null;

  let savePending = false;
  function snapshot() {
    savePending = false;
    clearTimeout(saveTimer);
    setSaveState(false);
    const s = JSON.stringify(state);
    if (s === history.last) return;
    if (history.last !== null) {
      history.undo.push(history.last);
      if (history.undo.length > 100) history.undo.shift();
      history.redo.length = 0;
    }
    history.last = s;
    try { localStorage.setItem(STORAGE_KEY, s); } catch (_) { /* abaikan */ }
    saveToGallery(s);
    updateUndoButtons();
  }
  function resetHistory() {
    history.undo = [];
    history.redo = [];
    history.last = null;
    updateUndoButtons();
  }

  // ---------- Galeri "Project Saya" (disimpan di browser) ----------
  const GALLERY_KEY = 'evkk:projects:v1';
  let thumbAt = 0, quotaWarned = false;
  function readGallery() {
    try { return JSON.parse(localStorage.getItem(GALLERY_KEY) || '{}') || {}; } catch (_) { return {}; }
  }
  function writeGallery(all) {
    try { localStorage.setItem(GALLERY_KEY, JSON.stringify(all)); return true; } catch (_) {
      if (!quotaWarned) { quotaWarned = true; toast('Penyimpanan browser penuh. Hapus beberapa project di "Project Saya".', 'error', 7000); }
      return false;
    }
  }
  function makeThumb() {
    if (player.playing || player.exporting || !canvas.width) return '';
    const r0 = partRanges()[0];
    ui.capturing = true;
    render(r0 ? r0.a + (r0.b - r0.a) * 0.6 : 0.5);
    const c = document.createElement('canvas');
    c.width = 108;
    c.height = Math.round((108 * canvas.height) / canvas.width);
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    ui.capturing = false;
    render(player.t);
    try { return c.toDataURL('image/jpeg', 0.7); } catch (_) { return ''; }
  }
  function saveToGallery(json) {
    const all = readGallery();
    const prev = all[state.id];
    let thumb = prev && prev.thumb;
    if (!thumb || Date.now() - thumbAt > 4000) { thumb = makeThumb() || thumb || ''; thumbAt = Date.now(); }
    all[state.id] = { id: state.id, name: state.name, updated: Date.now(), thumb, data: json };
    writeGallery(all);
  }
  // aksi baru (klik tombol, pintasan, seret di timeline) → perubahan sebelumnya jadi langkah undo sendiri
  function flushPendingSave() { if (savePending) snapshot(); }
  function save() {
    savePending = true;
    clearTimeout(saveTimer);
    setSaveState(true);
    saveTimer = setTimeout(snapshot, 400);
  }
  function undo() {
    snapshot();
    if (!history.undo.length) return;
    history.redo.push(history.last);
    restoreFromHistory(history.undo.pop());
  }
  function restoreFromHistory(json) {
    state = fromJSON(JSON.parse(json));
    history.last = JSON.stringify(state);
    try { localStorage.setItem(STORAGE_KEY, history.last); } catch (_) { /* abaikan */ }
    afterStateReplaced(true);
    updateUndoButtons();
  }
  function redo() {
    snapshot();
    if (!history.redo.length) return;
    history.undo.push(history.last);
    restoreFromHistory(history.redo.pop());
  }
  function updateUndoButtons() {
    $('#btnUndo').disabled = !history.undo.length;
    $('#btnRedo').disabled = !history.redo.length;
  }

  // =========================================================
  //  RENDER
  // =========================================================
  ui.previewScale = 1;
  try { ui.previewScale = clamp(+localStorage.getItem('yog:pq') || 1, 0.25, 1); } catch (_) { /* abaikan */ }
  function resizeCanvas() {
    const [bw, bh] = RATIOS[state.ratio] || RATIOS['9:16'];
    const s = player.exporting ? (+state.export.res || 1) : ui.previewScale; // pratinjau boleh lebih ringan, export tetap penuh
    const w = Math.round((bw * s) / 2) * 2, h = Math.round((bh * s) / 2) * 2;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const rb = document.getElementById('ratioBadge'), rt = `${state.ratio} • ${bw}×${bh}`;
    if (rb && rb.textContent !== rt) rb.textContent = rt;
  }

  function sceneAt(t) {
    if (freeMode()) return { index: 0, scene: FREE_SCENE, local: t, dur: totalDuration() };
    let acc = 0;
    for (let i = 0; i < state.scenes.length; i++) {
      const d = Math.max(0.5, +state.scenes[i].duration || 0);
      if (t < acc + d || i === state.scenes.length - 1) {
        return { index: i, scene: state.scenes[i], local: t - acc, dur: d };
      }
      acc += d;
    }
    return null;
  }

  function sceneStart(i) {
    if (freeMode()) return 0;
    let acc = 0;
    for (let k = 0; k < i; k++) acc += Math.max(0.5, +state.scenes[k].duration || 0);
    return acc;
  }

  const mediaItem = (id) => state.media.find((m) => m.id === id);

  // Foto / video background. `item` berisi posisi, zoom, putar, cermin, mode tampil & gerak;
  // `bg` berisi blur & warna; `p` = progres 0..1 untuk gerak foto.
  function drawMedia(src, sw, sh, item, bg, p, animated, g = ctx, extraFilter = '', lt = 0) {
    if (!sw || !sh) return;
    const W = canvas.width, H = canvas.height;
    // pengaturan per klip: crop, putar 90°, balik, zoom/geser (keyframe), atur warna
    const clip = bg.clip;
    const cr = clipCrop(clip);
    const sx = sw * cr.l, sy = sh * cr.t, cw = Math.max(1, sw * (1 - cr.l - cr.r)), ch = Math.max(1, sh * (1 - cr.t - cr.b));
    const rot90 = clip ? ((Math.round((+clip.rot || 0) / 90) * 90) % 360 + 360) % 360 : 0;
    const swap = rot90 === 90 || rot90 === 270;
    const kv = clipView(clip, lt);
    const adj = clipAdj(clip);
    const fit = item.fit || 'cover';
    let mZoom = 1, mDx = 0;
    if (animated) {
      const m = item.motion || 'none';
      if (m === 'zoomIn') mZoom = 1 + 0.12 * p;
      else if (m === 'zoomOut') mZoom = 1.12 - 0.12 * p;
      else if (m === 'panLeft') { mZoom = 1.12; mDx = (0.5 - p) * 0.08 * W; }
      else if (m === 'panRight') { mZoom = 1.12; mDx = (p - 0.5) * 0.08 * W; }
    }
    const blurPad = bg.blur > 0 && fit === 'cover' ? 1.04 : 1; // sembunyikan tepi transparan akibat blur
    const user = Math.max(0.1, +item.zoom || 1) * kv.z;
    const cx = W * (0.5 + (+item.x || 0) + kv.x) + mDx;
    const cy = H * (0.5 + (+item.y || 0) + kv.y);

    // filter warna (+ blur dari pengaturan)
    const parts = [];
    if (bg.blur > 0) parts.push(`blur(${bg.blur}px)`);
    if ((+bg.bright || 1) !== 1) parts.push(`brightness(${bg.bright})`);
    if ((+bg.contrast || 1) !== 1) parts.push(`contrast(${bg.contrast})`);
    if ((+bg.sat ?? 1) !== 1) parts.push(`saturate(${bg.sat})`);
    if (adj.bright) parts.push(`brightness(${(1 + adj.bright / 200).toFixed(3)})`);
    if (adj.contrast) parts.push(`contrast(${(1 + adj.contrast / 200).toFixed(3)})`);
    if (adj.sat) parts.push(`saturate(${(1 + adj.sat / 100).toFixed(3)})`);
    if (extraFilter) parts.push(extraFilter);
    const baseFilter = parts.join(' ') || 'none';

    const place = (scale, filter, tone = true) => {
      const dw = cw * scale, dh = ch * scale;
      g.save();
      g.filter = filter;
      g.translate(cx, cy);
      if (kv.r) g.rotate((kv.r * Math.PI) / 180);
      if (kv.o < 100) g.globalAlpha *= clamp(kv.o / 100);
      if (+item.rotate) g.rotate((+item.rotate * Math.PI) / 180);
      if (rot90) g.rotate((rot90 * Math.PI) / 180);
      if (item.flip) g.scale(-1, 1);
      if (clip && (clip.flipH || clip.flipV)) g.scale(clip.flipH ? -1 : 1, clip.flipV ? -1 : 1);
      g.drawImage(src, sx, sy, cw, ch, -dw / 2, -dh / 2, dw, dh);
      if (adj.smooth > 0) { // haluskan (retouch): salinan lembut ditumpuk tipis
        const sb = (1 + adj.smooth / 22) * (W / 1080);
        const ga = g.globalAlpha;
        g.globalAlpha = ga * Math.min(0.75, (adj.smooth / 100) * 0.75);
        g.filter = `${filter === 'none' ? '' : filter + ' '}blur(${sb.toFixed(2)}px)`;
        g.drawImage(src, sx, sy, cw, ch, -dw / 2, -dh / 2, dw, dh);
        g.globalAlpha = ga; g.filter = filter;
      }
      if (tone && (adj.temp || adj.tint)) { // suhu & rona: lapisan warna lembut di atas gambar
        g.filter = 'none';
        g.globalCompositeOperation = 'soft-light';
        if (adj.temp) { g.globalAlpha = Math.abs(adj.temp) / 100 * 0.75; g.fillStyle = adj.temp > 0 ? '#ff8a1e' : '#1e7bff'; g.fillRect(-dw / 2, -dh / 2, dw, dh); }
        if (adj.tint) { g.globalAlpha = Math.abs(adj.tint) / 100 * 0.6; g.fillStyle = adj.tint > 0 ? '#d42cff' : '#2cff5a'; g.fillRect(-dw / 2, -dh / 2, dw, dh); }
      }
      g.restore();
    };

    const ew = swap ? ch : cw, eh = swap ? cw : ch; // ukuran tampil setelah crop & putar
    const cover = Math.max(W / ew, H / eh);
    const contain = Math.min(W / ew, H / eh);
    if (fit === 'blurfill') {
      // latar: versi penuh layar yang diblur & digelapkan, lalu foto utuh di atasnya
      const s = cover * 1.1;
      const dw = ew * s, dh = eh * s;
      g.save();
      g.filter = `blur(${Math.round(W / 30)}px) brightness(0.65)`;
      g.translate(W / 2, H / 2);
      if (rot90) g.rotate((rot90 * Math.PI) / 180);
      g.drawImage(src, sx, sy, cw, ch, -(swap ? dh : dw) / 2, -(swap ? dw : dh) / 2, swap ? dh : dw, swap ? dw : dh);
      g.restore();
      place(contain * user * mZoom, baseFilter);
    } else if (fit === 'contain') {
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      place(contain * user * mZoom, baseFilter);
    } else {
      place(cover * user * mZoom * blurPad, baseFilter);
    }
  }

  // latar gradasi/warna dengan efek komposisi (kaleidoskop, bagi layar, dll.): digambar dulu ke kanvas bantu
  function drawBgLayerFx(t, bg) {
    const look = bg.type !== 'media' ? lookOf(bg) : null;
    if (!look || !OFFSCREEN_FX.has(look.fx)) { drawBgLayerRaw(t, bg); return; }
    look.lt = t;
    const main = ctx, b = fxBuf(7);
    b.g.setTransform(1, 0, 0, 1, 0, 0); b.g.globalAlpha = 1; b.g.filter = 'none'; b.g.globalCompositeOperation = 'source-over';
    b.g.clearRect(0, 0, b.c.width, b.c.height);
    ctx = b.g;
    try { drawBgLayerRaw(t, bg); } finally { ctx = main; }
    ctx.save(); fxComposite(look, b.c); ctx.restore();
  }
  function drawBgLayerRaw(t, bg) {
    const W = canvas.width, H = canvas.height;
    ctx.save();
    if (bg.blur > 0) ctx.filter = `blur(${bg.blur}px)`;

    if (bg.type === 'media') {
      ctx.filter = 'none'; // filter diatur di drawMedia
      const item = mediaItem(bg.mediaId) || state.media[0];
      const e = item && mediaEls.get(item.id);
      if (e && e.ready) {
        const prog = clamp((t - (bg.mStart || 0)) / (bg.mDur || totalDuration() || 1));
        drawLookMedia(t, bg, item, e, prog);
      } else {
        ctx.fillStyle = '#111318';
        ctx.fillRect(0, 0, W, H);
      }
    } else if (bg.type === 'color') {
      lookPrepare(t, bg);
      ctx.fillStyle = bg.color;
      ctx.fillRect(0, 0, W, H);
    } else if (bg.type === 'aurora') {
      lookPrepare(t, bg);
      drawAurora(t, bg);
    } else if (bg.type === 'waves') {
      lookPrepare(t, bg);
      drawWaves(t, bg);
    } else {
      lookPrepare(t, bg);
      const [c1, c2] = GRADIENTS[bg.preset] || GRADIENTS[0];
      const ang = (bg.animate ? t * 0.25 : 0) + Math.PI / 4;
      const r = Math.hypot(W, H) / 2;
      const cx = W / 2, cy = H / 2;
      const g = ctx.createLinearGradient(cx - Math.cos(ang) * r, cy - Math.sin(ang) * r, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    if (bg.type !== 'media') lookFinish(t, bg);
  }

  // =========================================================
  //  FILTER & EFEK VISUAL (latar / per klip)
  // =========================================================
  // b=brightness c=contrast s=saturate sepia gray hue(deg); tint = [warna, kekuatan, blend]
  const FILTERS = {
    none: ['Tanpa filter', null],
    cinematic: ['Sinematik', { c: 1.15, s: 0.85, b: 0.95, tint: ['#0f6f7f', 0.22, 'soft-light'] }],
    vintage: ['Vintage', { sepia: 0.45, c: 1.05, s: 0.85, b: 1.05, tint: ['#ffb36b', 0.16, 'soft-light'] }],
    bw: ['Hitam putih', { gray: 1, c: 1.15 }],
    noir: ['Noir', { gray: 1, c: 1.55, b: 0.85 }],
    warm: ['Hangat', { sepia: 0.2, s: 1.2, tint: ['#ff9a3c', 0.2, 'soft-light'] }],
    cool: ['Sejuk', { s: 1.05, hue: -8, tint: ['#3c8dff', 0.2, 'soft-light'] }],
    vivid: ['Cerah hidup', { s: 1.55, c: 1.1 }],
    matte: ['Matte', { c: 0.82, b: 1.08, s: 0.8, tint: ['#8a8a8a', 0.14, 'lighten'] }],
    dramatic: ['Dramatis', { c: 1.45, s: 1.15, b: 0.9 }],
    dreamy: ['Lembut pink', { b: 1.08, s: 1.1, tint: ['#ff8fd1', 0.22, 'soft-light'] }],
    sunset: ['Senja', { s: 1.2, tint: ['#ff6a3d', 0.24, 'overlay'] }],
    forest: ['Hutan', { s: 1.1, c: 1.05, tint: ['#2e8b57', 0.18, 'soft-light'] }],
    retro: ['Retro', { sepia: 0.3, hue: -10, c: 1.2, s: 1.3 }],
  };
  const EFFECTS = {
    none: 'Tanpa efek', shake: 'Getar', zoomPulse: 'Zoom denyut', heartbeat: 'Detak jantung', glitch: 'Glitch',
    rgb: 'RGB split', vhs: 'VHS', pixelate: 'Piksel', mirror: 'Cermin', blurPulse: 'Blur denyut', flash: 'Kilat (strobo)', leak: 'Cahaya bocor',
    // gerakan kamera
    sway: 'Goyang', bounce: 'Memantul', zoomIn: 'Zoom pelan masuk', zoomOut: 'Zoom pelan keluar', dutch: 'Miring bergoyang',
    drift: 'Melayang', quake: 'Gempa', spinSlow: 'Putar pelan',
    // warna
    rainbow: 'Pelangi (ganti warna)', flicker: 'Kedip lampu', invertBeat: 'Negatif berkedip', contrastPulse: 'Kontras denyut', oldFilm: 'Film lama',
    // lapisan cahaya
    scanline: 'Garis TV', filmBurn: 'Film terbakar', spotlight: 'Lampu sorot', prism: 'Prisma pelangi', shine: 'Kilau menyapu',
    redPulse: 'Denyut merah', tvNoise: 'Semut TV', sparkle: 'Kilauan bintang',
    // komposisi
    kaleido: 'Kaleidoskop', mirrorV: 'Cermin atas-bawah', split3: 'Bagi 3 layar', split4: 'Bagi 4 layar', glow: 'Bersinar (dreamy)',
    wave: 'Gelombang', echo: 'Bayangan ganda', zoomBlur: 'Zoom blur',
  };
  const OFFSCREEN_FX = new Set(['glitch', 'rgb', 'vhs', 'pixelate', 'mirror', 'kaleido', 'mirrorV', 'split3', 'split4', 'glow', 'wave', 'echo', 'zoomBlur']);
  // filter & efek yang berlaku untuk satu lapisan latar (klip bisa menimpa pengaturan global)
  function lookOf(spec) {
    const c = spec.clip;
    const useCF = c && c.filter, useCX = c && c.fx;
    return {
      filter: spec.segFilter || (useCF ? c.filter : spec.filter) || 'none',
      amt: clamp((spec.segFilter ? spec.segFilterAmt : useCF ? (c.filterAmt == null ? 100 : +c.filterAmt) : (spec.filterAmt == null ? 100 : +spec.filterAmt)) / 100),
      fx: spec.segFx || (useCX ? c.fx : spec.fx) || 'none',
      fxAmt: clamp((spec.segFx ? spec.segFxAmt : useCX ? (c.fxAmt == null ? 60 : +c.fxAmt) : (spec.fxAmt == null ? 60 : +spec.fxAmt)) / 100),
      lt: 0,
    };
  }
  function filterCss(look) {
    const f = FILTERS[look.filter] && FILTERS[look.filter][1];
    const k = look.amt, out = [];
    if (f && k > 0) {
      if (f.b) out.push(`brightness(${1 + (f.b - 1) * k})`);
      if (f.c) out.push(`contrast(${1 + (f.c - 1) * k})`);
      if (f.s) out.push(`saturate(${1 + (f.s - 1) * k})`);
      if (f.sepia) out.push(`sepia(${f.sepia * k})`);
      if (f.gray) out.push(`grayscale(${f.gray * k})`);
      if (f.hue) out.push(`hue-rotate(${f.hue * k}deg)`);
    }
    const lt0 = look.lt, k0 = look.fxAmt;
    if (look.fx === 'rainbow') out.push(`hue-rotate(${((lt0 * (40 + 160 * k0)) % 360).toFixed(1)}deg) saturate(${1 + 0.4 * k0})`);
    else if (look.fx === 'flicker') {
      const r = mulberry32(Math.floor(lt0 * 14) * 131 + 7)();
      out.push(`brightness(${(1 - k0 * 0.45 * (r < 0.3 ? r / 0.3 : 0.15 * r)).toFixed(3)})`);
    } else if (look.fx === 'invertBeat') {
      if ((lt0 * 2) % 1 < 0.12 * (0.4 + k0)) out.push('invert(1)');
    } else if (look.fx === 'contrastPulse') {
      const q = k0 * Math.pow(Math.max(0, Math.sin(lt0 * Math.PI * 2)), 4);
      out.push(`contrast(${(1 + 0.7 * q).toFixed(3)}) saturate(${(1 + 0.5 * q).toFixed(3)})`);
    } else if (look.fx === 'oldFilm') {
      const r = mulberry32(Math.floor(lt0 * 18) * 977 + 3)();
      out.push(`sepia(${0.4 + 0.5 * k0}) contrast(1.1) brightness(${(0.95 + 0.12 * r * k0).toFixed(3)})`);
    }
    if (look.fx === 'blurPulse') {
      const px = (2 + look.fxAmt * 14) * (canvas.width / 1080) * Math.pow(Math.abs(Math.sin(look.lt * 2.2)), 2);
      if (px > 0.3) out.push(`blur(${px.toFixed(1)}px)`);
    }
    return out.join(' ');
  }
  // gerakan kamera (getar, zoom denyut, detak jantung)
  function fxTransform(look) {
    const W = canvas.width, H = canvas.height, k = look.fxAmt, lt = look.lt;
    if (look.fx === 'shake') {
      const amp = (5 + k * 28) * (W / 1080);
      const dx = (Math.sin(lt * 41) + Math.sin(lt * 23.7) * 0.6) * amp, dy = (Math.cos(lt * 37) + Math.sin(lt * 19.3) * 0.6) * amp;
      ctx.translate(W / 2 + dx, H / 2 + dy); ctx.scale(1.06, 1.06); ctx.translate(-W / 2, -H / 2);
    } else if (look.fx === 'zoomPulse' || look.fx === 'heartbeat') {
      let z;
      if (look.fx === 'zoomPulse') z = 1 + (0.03 + 0.09 * k) * Math.pow(Math.max(0, Math.sin(lt * Math.PI * 2)), 6);
      else { const ph = lt % 1; z = 1 + (0.03 + 0.08 * k) * (Math.exp(-Math.pow((ph - 0.1) / 0.05, 2)) + 0.7 * Math.exp(-Math.pow((ph - 0.32) / 0.05, 2))); }
      ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    } else if (look.fx === 'sway' || look.fx === 'dutch' || look.fx === 'spinSlow') {
      const a = look.fx === 'sway' ? Math.sin(lt * 1.6) * (0.01 + 0.05 * k)
        : look.fx === 'dutch' ? 0.06 + Math.sin(lt * 0.8) * (0.03 + 0.08 * k) : lt * (0.05 + 0.25 * k);
      const ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
      const z = Math.max((W * ca + H * sa) / W, (W * sa + H * ca) / H); // tetap menutup layar
      ctx.translate(W / 2, H / 2); ctx.rotate(a); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    } else if (look.fx === 'bounce') {
      const h = (20 + 70 * k) * (W / 1080), y = -Math.abs(Math.sin(lt * Math.PI * 1.5)) * h, z = 1 + (h / H) * 1.2;
      ctx.translate(W / 2, H / 2 + y + h / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    } else if (look.fx === 'zoomIn' || look.fx === 'zoomOut') {
      const q = clamp(lt / 8), m = 0.08 + 0.3 * k, z = look.fx === 'zoomIn' ? 1 + m * q : 1 + m * (1 - q);
      ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    } else if (look.fx === 'drift') {
      const amp = (10 + 40 * k) * (W / 1080), z = 1.04 + (amp / W) * 2;
      ctx.translate(W / 2 + Math.sin(lt * 0.5) * amp, H / 2 + Math.cos(lt * 0.37) * amp); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    } else if (look.fx === 'quake') {
      const burst = Math.pow(Math.max(0, Math.sin(lt * 1.3)), 8), amp = (8 + 50 * k) * (W / 1080) * burst;
      const r = mulberry32(Math.floor(lt * 30) * 31 + 1);
      ctx.translate(W / 2 + (r() - 0.5) * 2 * amp, H / 2 + (r() - 0.5) * 2 * amp); ctx.scale(1.08, 1.08); ctx.translate(-W / 2, -H / 2);
    }
  }
  // lapisan di atas media: warna filter, kilat, cahaya bocor
  function fxOverlay(look) {
    const W = canvas.width, H = canvas.height;
    const f = FILTERS[look.filter] && FILTERS[look.filter][1];
    if (f && f.tint && look.amt > 0) {
      ctx.save();
      ctx.globalCompositeOperation = f.tint[2];
      ctx.globalAlpha *= f.tint[1] * look.amt * 2.2;
      ctx.fillStyle = f.tint[0];
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const k = look.fxAmt, lt = look.lt;
    if (look.fx === 'flash') {
      const a = k * Math.max(0, 1 - ((lt * 2) % 1) * 5);
      if (a > 0.01) { ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    } else if (look.fx === 'leak') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const x = W * (0.5 + 0.55 * Math.sin(lt * 0.7)), y = H * (0.35 + 0.3 * Math.cos(lt * 0.5));
      const r = Math.max(W, H) * (0.55 + 0.15 * Math.sin(lt * 1.3));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,150,60,${0.55 * k})`);
      g.addColorStop(0.45, `rgba(255,60,90,${0.25 * k})`);
      g.addColorStop(1, 'rgba(255,60,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    } else if (look.fx && look.fx !== 'none') fxOverlay2(look.fx, W, H, k, lt);
  }
  function fxOverlay2(fx, W, H, k, lt) {
    const sc = W / 1080;
    ctx.save();
    if (fx === 'scanline') {
      ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.3 * k})`;
      const step = Math.max(2, Math.round(3 * sc)), off = Math.floor(lt * 30) % (step * 2);
      for (let y = -step * 2 + off; y < H; y += step * 2) ctx.fillRect(0, y, W, step);
      const by = ((lt * 0.3) % 1.2 - 0.1) * H;
      const g = ctx.createLinearGradient(0, by - H * 0.05, 0, by + H * 0.05);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${0.1 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, by - H * 0.05, W, H * 0.1);
    } else if (fx === 'filmBurn') {
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 3; i++) {
        const ph = lt * (0.35 + i * 0.13) + i * 2.1;
        const x = W * (i === 1 ? 1.05 : -0.05) + Math.sin(ph) * W * 0.15, y = H * (0.2 + 0.3 * i) + Math.cos(ph * 0.7) * H * 0.2;
        const r = Math.max(W, H) * (0.35 + 0.2 * Math.sin(ph * 1.3));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const a = (0.4 + 0.5 * k) * (0.6 + 0.4 * Math.sin(ph * 2.3));
        g.addColorStop(0, `rgba(255,240,200,${a})`); g.addColorStop(0.3, `rgba(255,120,20,${a * 0.8})`);
        g.addColorStop(0.7, `rgba(200,20,0,${a * 0.35})`); g.addColorStop(1, 'rgba(200,20,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    } else if (fx === 'spotlight') {
      const x = W * (0.5 + 0.3 * Math.sin(lt * 0.6)), y = H * (0.45 + 0.2 * Math.cos(lt * 0.45)), r = Math.min(W, H) * (0.55 - 0.2 * k);
      const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 1.6);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.5 + 0.45 * k})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (fx === 'prism') {
      ctx.globalCompositeOperation = 'screen';
      const o = (lt * 0.15) % 1, g = ctx.createLinearGradient(0, 0, W, H);
      const cols = ['255,0,80', '255,160,0', '255,255,0', '0,255,120', '0,160,255', '160,0,255'];
      const stops = cols.map((c, i) => [((i / 6) + o) % 1, c]).sort((a, b) => a[0] - b[0]);
      stops.forEach(([s, c]) => g.addColorStop(s, `rgba(${c},${0.12 + 0.25 * k})`));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (fx === 'shine') {
      const ph = (lt / 2.5) % 1, x = (ph * 1.8 - 0.4) * (W + H);
      ctx.globalCompositeOperation = 'screen';
      ctx.translate(x, 0); ctx.rotate(0.35);
      const bw = W * (0.08 + 0.15 * k), g = ctx.createLinearGradient(-bw, 0, bw, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${0.35 + 0.35 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(-bw, -H, bw * 2, H * 3);
    } else if (fx === 'redPulse') {
      const ph = lt % 1, a = (0.3 + 0.5 * k) * (Math.exp(-Math.pow((ph - 0.1) / 0.06, 2)) + 0.6 * Math.exp(-Math.pow((ph - 0.32) / 0.06, 2)));
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(200,0,30,0)'); g.addColorStop(1, `rgba(200,0,30,${clamp(a)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (fx === 'tvNoise') {
      const r = mulberry32(Math.floor(lt * 24) * 4099 + 11);
      const cell = Math.max(2, Math.round(6 * sc)), n = Math.round(((W * H) / (cell * cell)) * 0.06 * (0.3 + k));
      const light = `rgba(255,255,255,${0.25 + 0.3 * k})`, dark = `rgba(0,0,0,${0.25 + 0.3 * k})`;
      for (let i = 0; i < n; i++) { ctx.fillStyle = r() < 0.5 ? light : dark; ctx.fillRect(Math.floor((r() * W) / cell) * cell, Math.floor((r() * H) / cell) * cell, cell, cell); }
    } else if (fx === 'oldFilm') {
      const r = mulberry32(Math.floor(lt * 18) * 4099 + 11);
      ctx.strokeStyle = `rgba(30,20,10,${0.25 + 0.4 * k})`;
      for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) {
        const x = r() * W; ctx.lineWidth = (1 + r() * 2) * sc;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (r() - 0.5) * 30 * sc, H); ctx.stroke();
      }
      ctx.fillStyle = `rgba(20,15,5,${0.3 + 0.4 * k})`;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(r() * W, r() * H, (1 + r() * 4) * sc, 0, Math.PI * 2); ctx.fill(); }
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(40,25,10,${0.35 + 0.3 * k})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    } else if (fx === 'sparkle') {
      ctx.globalCompositeOperation = 'screen';
      const n = Math.round(10 + 40 * k);
      for (let i = 0; i < n; i++) {
        const r = mulberry32(i * 7919 + 17), x = r() * W, y = r() * H, sp = 0.8 + r() * 2, ph = r() * 6.28;
        const a = Math.pow(Math.max(0, Math.sin(lt * sp + ph)), 6), s = (6 + r() * 18) * sc * a;
        if (s < 0.5) continue;
        ctx.fillStyle = `rgba(255,255,240,${a})`;
        ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
        ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
      }
    }
    ctx.restore();
  }
  // kanvas bantu untuk efek berbasis piksel
  const fxBufs = [];
  function fxBuf(i) {
    if (!fxBufs[i]) { const c = document.createElement('canvas'); fxBufs[i] = { c, g: c.getContext('2d') }; }
    const b = fxBufs[i];
    if (b.c.width !== canvas.width || b.c.height !== canvas.height) { b.c.width = canvas.width; b.c.height = canvas.height; }
    return b;
  }
  // salinan satu kanal warna (r/g/b) dari kanvas sumber
  function channel(src, color) {
    const b = fxBuf(2);
    b.g.globalCompositeOperation = 'copy';
    b.g.drawImage(src, 0, 0);
    b.g.globalCompositeOperation = 'multiply';
    b.g.fillStyle = color;
    b.g.fillRect(0, 0, b.c.width, b.c.height);
    b.g.globalCompositeOperation = 'destination-in';
    b.g.drawImage(src, 0, 0);
    b.g.globalCompositeOperation = 'source-over';
    return b.c;
  }
  function rgbSplit(src, dx, dy = 0) {
    const W = canvas.width, H = canvas.height;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(channel(src, '#ff0000'), dx, dy);
    ctx.drawImage(channel(src, '#00ff00'), 0, 0);
    ctx.drawImage(channel(src, '#0000ff'), -dx, -dy);
    ctx.restore();
  }
  function fxComposite(look, src) {
    const W = canvas.width, H = canvas.height, k = look.fxAmt, lt = look.lt, sc = W / 1080;
    if (look.fx === 'pixelate') {
      const block = Math.max(2, Math.round((4 + k * 40) * sc));
      const sb = fxBuf(1), w = Math.ceil(W / block), h = Math.ceil(H / block);
      sb.g.clearRect(0, 0, W, H);
      sb.g.imageSmoothingEnabled = true;
      sb.g.drawImage(src, 0, 0, w, h);
      ctx.save(); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sb.c, 0, 0, w, h, 0, 0, W, H);
      ctx.restore();
    } else if (look.fx === 'mirror') {
      ctx.drawImage(src, 0, 0, W / 2, H, 0, 0, W / 2, H);
      ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1);
      ctx.drawImage(src, 0, 0, W / 2, H, 0, 0, W / 2, H);
      ctx.restore();
    } else if (look.fx === 'rgb') {
      rgbSplit(src, (3 + k * 22) * sc * (0.65 + 0.35 * Math.sin(lt * 3)));
    } else if (look.fx === 'glitch') {
      const rnd = mulberry32(Math.floor(lt * 12) * 7919 + 13);
      const active = rnd() < 0.25 + 0.45 * k;
      if (active) rgbSplit(src, (6 + 18 * k) * sc * (rnd() - 0.3)); else ctx.drawImage(src, 0, 0);
      if (active) {
        const n = 2 + Math.floor(rnd() * 6);
        for (let i = 0; i < n; i++) {
          const y = rnd() * H, h = (0.01 + rnd() * 0.08) * H, dx = (rnd() - 0.5) * W * 0.18 * k;
          ctx.drawImage(src, 0, y, W, h, dx, y, W, h);
        }
      }
    } else if (look.fx === 'vhs') {
      rgbSplit(src, (2 + 4 * k) * sc);
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${0.12 + 0.18 * k})`;
      const step = Math.max(2, Math.round(4 * sc));
      for (let y = 0; y < H; y += step * 2) ctx.fillRect(0, y, W, step);
      // pita gangguan yang bergerak turun
      const by = ((lt * 0.25) % 1) * H, bh = H * (0.03 + 0.04 * k);
      ctx.drawImage(src, 0, by, W, bh, (Math.sin(lt * 50) * 12 + 8) * sc * k, by, W, bh);
      ctx.fillStyle = `rgba(255,255,255,${0.08 * k})`;
      ctx.fillRect(0, by, W, bh);
      ctx.restore();
    } else if (look.fx === 'mirrorV') {
      ctx.drawImage(src, 0, 0, W, H / 2, 0, 0, W, H / 2);
      ctx.save(); ctx.translate(0, H); ctx.scale(1, -1);
      ctx.drawImage(src, 0, 0, W, H / 2, 0, 0, W, H / 2);
      ctx.restore();
    } else if (look.fx === 'kaleido') {
      const w2 = W / 2, h2 = H / 2;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.translate(i % 2 ? W : 0, i > 1 ? H : 0); ctx.scale(i % 2 ? -1 : 1, i > 1 ? -1 : 1);
        ctx.drawImage(src, W * 0.25, H * 0.25, w2, h2, 0, 0, w2, h2);
        ctx.restore();
      }
    } else if (look.fx === 'split3') {
      const h3 = H / 3, sh = Math.min(H, h3 * 1.4);
      for (let i = 0; i < 3; i++) ctx.drawImage(src, 0, (H - sh) / 2, W, sh, 0, i * h3, W, h3);
    } else if (look.fx === 'split4') {
      for (let i = 0; i < 4; i++) ctx.drawImage(src, 0, 0, W, H, (i % 2) * W / 2, Math.floor(i / 2) * H / 2, W / 2, H / 2);
    } else if (look.fx === 'glow') {
      ctx.drawImage(src, 0, 0);
      const sb = fxBuf(1), w = Math.ceil(W / 8), h = Math.ceil(H / 8);
      sb.g.clearRect(0, 0, W, H);
      sb.g.drawImage(src, 0, 0, w, h);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha *= 0.35 + 0.5 * k * (0.85 + 0.15 * Math.sin(lt * 2));
      ctx.filter = `blur(${(6 * sc).toFixed(1)}px)`;
      ctx.drawImage(sb.c, 0, 0, w, h, 0, 0, W, H);
      ctx.restore();
    } else if (look.fx === 'wave') {
      const step = Math.max(2, Math.round(4 * sc)), amp = (6 + 34 * k) * sc;
      for (let y = 0; y < H; y += step) ctx.drawImage(src, 0, y, W, step, Math.sin((y / H) * 12 + lt * 3) * amp, y, W, step);
    } else if (look.fx === 'echo') {
      ctx.drawImage(src, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 1; i <= 2; i++) {
        ctx.globalAlpha = (0.25 + 0.25 * k) / i;
        const o = Math.sin(lt * 1.7 - i * 0.6) * (10 + 40 * k) * sc * i;
        ctx.drawImage(src, o, o * 0.4);
      }
      ctx.restore();
    } else if (look.fx === 'zoomBlur') {
      ctx.drawImage(src, 0, 0);
      ctx.save();
      const amt = (0.02 + 0.06 * k) * (0.6 + 0.4 * Math.sin(lt * 2.5));
      ctx.globalAlpha = 0.22;
      for (let i = 1; i <= 4; i++) {
        const z = 1 + amt * i;
        ctx.drawImage(src, W / 2 - (W * z) / 2, H / 2 - (H * z) / 2, W * z, H * z);
      }
      ctx.restore();
    } else ctx.drawImage(src, 0, 0);
  }
  // Foto/video latar dengan filter & efek
  function drawLookMedia(t, bg, item, e, prog) {
    const look = lookOf(bg);
    look.lt = t - (bg.mStart || 0);
    const fcss = filterCss(look);
    const draw = (g) => (item.kind === 'image'
      ? drawMedia(e.el, e.el.naturalWidth, e.el.naturalHeight, item, bg, prog, true, g, fcss, look.lt)
      : drawMedia(e.el, e.el.videoWidth, e.el.videoHeight, item, bg, prog, false, g, fcss, look.lt));
    ctx.save();
    fxTransform(look);
    if (OFFSCREEN_FX.has(look.fx)) {
      const b = fxBuf(0);
      b.g.setTransform(1, 0, 0, 1, 0, 0);
      b.g.globalAlpha = 1;
      b.g.clearRect(0, 0, b.c.width, b.c.height);
      draw(b.g);
      fxComposite(look, b.c);
    } else draw(ctx);
    ctx.restore();
    drawClipVignette(clipAdj(bg.clip).vig);
    fxOverlay(look);
  }
  function drawClipVignette(v) {
    if (!(v > 0)) return;
    const W = canvas.width, H = canvas.height, r = Math.hypot(W, H) / 2;
    const gr = ctx.createRadialGradient(W / 2, H / 2, r * (0.75 - 0.4 * v / 100), W / 2, H / 2, r);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(0,0,0,${(0.95 * v / 100).toFixed(3)})`);
    ctx.save(); ctx.filter = 'none'; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  // latar non-foto (gradasi/warna/animasi): filter warna + gerakan; overlay digambar sesudahnya
  function lookPrepare(t, bg) {
    const look = lookOf(bg);
    look.lt = t;
    const css = filterCss(look);
    if (css) ctx.filter = ((ctx.filter && ctx.filter !== 'none') ? ctx.filter + ' ' : '') + css;
    fxTransform(look);
  }
  function lookFinish(t, bg) {
    const look = lookOf(bg);
    look.lt = t;
    fxOverlay(look);
  }

  // Background animasi: cahaya aurora yang bergerak pelan
  // Digambar di kanvas kecil (1/6) lalu diperbesar: cahayanya lembut, jadi hasil sama tapi jauh lebih ringan.
  let auroraCanvas = null;
  function drawAurora(t, bg) {
    const W = canvas.width, H = canvas.height;
    const w = Math.ceil(W / 6), h = Math.ceil(H / 6);
    if (!auroraCanvas) auroraCanvas = document.createElement('canvas');
    if (auroraCanvas.width !== w || auroraCanvas.height !== h) { auroraCanvas.width = w; auroraCanvas.height = h; }
    const a = auroraCanvas.getContext('2d');
    const [c1, c2] = GRADIENTS[bg.preset] || GRADIENTS[0];
    const sp = bg.animate ? 1 : 0;
    a.globalCompositeOperation = 'source-over';
    a.fillStyle = '#05060d';
    a.fillRect(0, 0, w, h);
    a.globalCompositeOperation = 'lighter';
    [[c1, 0.3, 0.3, 0.6], [c2, 0.7, 0.6, 0.55], [c1, 0.5, 0.85, 0.5], [c2, 0.2, 0.7, 0.45], ['#ffffff', 0.6, 0.25, 0.25]].forEach(([c, x, y, r], i) => {
      const cx = w * (x + 0.15 * Math.sin(t * 0.3 * sp + i * 1.7));
      const cy = h * (y + 0.1 * Math.cos(t * 0.25 * sp + i * 2.3));
      const R = Math.max(w, h) * r;
      const g = a.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, hexToRgba(c, i === 4 ? 0.12 : 0.55));
      g.addColorStop(1, hexToRgba(c, 0));
      a.fillStyle = g;
      a.fillRect(0, 0, w, h);
    });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(auroraCanvas, 0, 0, W, H);
  }

  // Background animasi: gelombang berlapis
  function drawWaves(t, bg) {
    const W = canvas.width, H = canvas.height;
    const [c1, c2] = GRADIENTS[bg.preset] || GRADIENTS[0];
    const sp = bg.animate ? 1 : 0;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 4; k++) {
      const base = H * (0.55 + k * 0.1), amp = H * (0.025 + 0.01 * k), len = W * (0.9 - k * 0.12);
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W + 1; x += W / 60) {
        ctx.lineTo(x, base + Math.sin((x / len) * Math.PI * 2 + t * (0.6 + k * 0.25) * sp + k) * amp);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,255,255,${0.06 + k * 0.03})`;
      ctx.fill();
    }
  }

  // Background tiap scene: khusus scene (gradasi / warna / media) atau ikut global.
  // Untuk media per scene, video & gerak foto dimulai dari awal scene (mStart, mDur).
  function bgSpec(index) {
    const o = !freeMode() && state.scenes[index] && state.scenes[index].bg;
    const perScene = (mediaId) => ({
      ...state.bg, type: 'media', mediaId,
      mStart: sceneStart(index), mDur: Math.max(0.5, +state.scenes[index].duration || 0),
    });
    if (o) {
      if (o[0] === 'g') return { ...state.bg, type: 'gradient', preset: +o.slice(1) || 0 };
      if (o[0] === '#') return { ...state.bg, type: 'color', color: o };
      if (o.startsWith('m:') && mediaItem(o.slice(2))) return perScene(o.slice(2));
    }
    if (!freeMode() && state.bg.type === 'media' && state.bg.mediaMode === 'slideshow' && state.media.length) {
      return perScene(state.media[index % state.media.length].id);
    }
    return state.bg;
  }

  // ---- Slideshow berwaktu: media berganti tiap N detik, lepas dari scene ----
  // (pada susunan teks bebas, "per scene" juga berarti tiap N detik)
  const timedSlides = () => state.bg.type === 'media' && state.media.length > 0 && clipList().length > 0
    && (state.bg.mediaMode === 'timed' || (freeMode() && state.bg.mediaMode === 'slideshow'));
  const slideDur = () => Math.max(0.5, +state.bg.slideDur || 3);
  const hasOwnBg = (i) => { if (freeMode()) return false; const o = state.scenes[i] && state.scenes[i].bg; return !!o && (o[0] === 'g' || o[0] === '#' || (o.startsWith('m:') && !!mediaItem(o.slice(2)))); };
  // ---- Klip latar ----
  function newClip(mediaId, extra) {
    return { id: newId(), mediaId, in: 0, dur: 0, speed: 1, trans: 'fade', transDur: 0.6, ...extra };
  }
  // ---- Pengaturan visual per klip ----
  const ADJ_KEYS = ['bright', 'contrast', 'sat', 'temp', 'tint', 'vig', 'smooth'];
  function clipAdj(c) {
    const a = (c && c.adj) || {}, o = {};
    ADJ_KEYS.forEach((k) => { o[k] = +a[k] || 0; });
    return o;
  }
  function clipCrop(c) {
    const k = (c && c.crop) || {}, f = (v) => clamp((+v || 0) / 100, 0, 0.45);
    return { l: f(k.l), t: f(k.t), r: f(k.r), b: f(k.b) };
  }
  // zoom (1 = 100%) & geser (pecahan lebar/tinggi layar) pada waktu lokal lt di dalam klip
  function clipView(c, lt) {
    const base = { z: Math.max(0.1, (+(c && c.z) || 100) / 100), x: (+(c && c.x) || 0) / 100, y: (+(c && c.y) || 0) / 100, r: +(c && c.rr) || 0, o: c && c.op != null ? +c.op : 100 };
    const ks = c && c.kf && c.kf.length ? c.kf : null;
    if (!ks) return base;
    const pick = (k) => ({ z: Math.max(0.1, (+k.z || 100) / 100), x: (+k.x || 0) / 100, y: (+k.y || 0) / 100, r: +k.r || 0, o: k.o == null ? 100 : +k.o });
    if (lt <= ks[0].t) return pick(ks[0]);
    const last = ks[ks.length - 1];
    if (lt >= last.t) return pick(last);
    let i = 0;
    while (i < ks.length - 2 && ks[i + 1].t <= lt) i++;
    const a = pick(ks[i]), b = pick(ks[i + 1]), f = easeInOut((lt - ks[i].t) / Math.max(1e-6, ks[i + 1].t - ks[i].t));
    return { z: a.z + (b.z - a.z) * f, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, r: a.r + (b.r - a.r) * f, o: a.o + (b.o - a.o) * f };
  }
  // nilai keyframe dalam satuan slider (z 100..300, x/y -50..50)
  const kfVals = (c, lt) => { const v = clipView(c, lt); return { z: Math.round(v.z * 100), x: Math.round(v.x * 100), y: Math.round(v.y * 100), r: Math.round(v.r), o: Math.round(v.o) }; };
  // salinan pengaturan tampilan klip (untuk potong / beku). Keyframe digeser dengan "shift" detik.
  function clipVisual(c, shift = null, upTo = null) {
    const o = { filter: c.filter, filterAmt: c.filterAmt, fx: c.fx, fxAmt: c.fxAmt, rot: c.rot, flipH: c.flipH, flipV: c.flipV, z: c.z, x: c.x, y: c.y };
    if (c.adj) o.adj = { ...c.adj };
    if (c.crop) o.crop = { ...c.crop };
    ['mask', 'maskSize', 'maskFeather', 'maskX', 'maskY', 'maskInvert', 'animCombo', 'animComboDur', 'mute', 'vol', 'rr', 'op', 'canvasBg', 'canvasColor', 'canvasBlur'].forEach((k) => { if (c[k] != null) o[k] = c[k]; });
    if (shift != null && c.animOut) { o.animOut = c.animOut; o.animOutDur = c.animOutDur; } // potongan kedua: animasi keluar ikut pindah
    if (c.kf && c.kf.length && shift != null) {
      const at0 = { t: 0, ...kfVals(c, shift) };
      o.kf = [at0, ...c.kf.filter((k) => k.t > shift + 0.05).map((k) => ({ ...k, t: r1Fine(k.t - shift) }))];
      if (upTo != null) o.kf = o.kf.filter((k) => k.t <= upTo + 1e-6);
    } else if (c.kf && c.kf.length) Object.assign(o, kfVals(c, 0));
    return o;
  }
  const clipList = () => state.clips.filter((c) => mediaItem(c.mediaId));
  const clipById = (id) => state.clips.find((c) => c.id === id);
  // panjang file video (0 = foto / belum termuat)
  function srcDuration(item) {
    const e = item && mediaEls.get(item.id);
    return item && item.kind === 'video' && e && e.el && isFinite(e.el.duration) && e.el.duration > 0 ? e.el.duration : 0;
  }
  // Durasi klip di timeline: diatur sendiri, atau bawaan (video = sisa video setelah trim ÷ kecepatan)
  function clipDur(c) {
    if (+c.dur > 0) return Math.max(0.3, +c.dur);
    const it = mediaItem(c.mediaId);
    if (!it) return slideDur();
    if (+it.dur > 0) return Math.max(0.5, +it.dur);
    const sd = srcDuration(it);
    if (sd) return Math.max(0.3, Math.round(((sd - (+c.in || 0)) / (+c.speed || 1)) * 100) / 100);
    return slideDur();
  }
  // Durasi tampil satu media: diatur sendiri, atau bawaan (video = panjang videonya, foto = durasi bawaan)
  function mediaDur(item) {
    if (!item) return slideDur();
    if (+item.dur > 0) return Math.max(0.5, +item.dur);
    const e = mediaEls.get(item.id);
    if (item.kind === 'video' && e && e.el && isFinite(e.el.duration) && e.el.duration > 0) return Math.round(e.el.duration * 100) / 100;
    return slideDur();
  }
  const cycleDur = () => clipList().reduce((a, c) => a + clipDur(c), 0);
  // Durasi video menurut latar (0 = latar bukan foto/video)
  function bgDuration() {
    if (state.bg.type !== 'media' || !state.media.length) return 0;
    if (timedSlides()) return Math.max(1, cycleDur());
    return Math.max(1, mediaDur(mediaItem(state.bg.mediaId) || state.media[0]));
  }
  // Media slideshow yang tampil pada t: {k, id, a, b} (berulang dari awal bila video lebih panjang)
  function slideAt(t) {
    const list = clipList(), C = cycleDur(), n = list.length;
    t = Math.max(0, t);
    const cyc = C > 0 ? Math.floor(t / C) : 0;
    let a = cyc * C;
    for (let j = 0; j < n; j++) {
      const d = clipDur(list[j]);
      if (t < a + d || j === n - 1) return { k: cyc * n + j, j, id: list[j].mediaId, clip: list[j], a, b: a + d };
      a += d;
    }
    return { k: 0, j: 0, id: list[0].mediaId, clip: list[0], a: 0, b: C };
  }
  const slideSpec = (sl) => ({ ...state.bg, type: 'media', mediaId: sl.id, mStart: sl.a, mDur: sl.b - sl.a, clip: sl.clip });
  // posisi waktu di file video untuk spec pada waktu t (trim + kecepatan; berulang bila habis)
  function srcTimeAt(s, t, d) {
    const c = s.clip;
    if (c && c.freeze) return clamp(+c.in || 0, 0, Math.max(0, d - 0.05));
    if (c && c.rev) { // mundur: dari ujung akhir bagian klip ke titik mulai
      const raw = (+c.in || 0) + Math.max(0, clipDur(c) - (t - (s.mStart || 0)) - 1 / 60) * (+c.speed || 1);
      return clamp(raw, 0, Math.max(0, d - 0.05));
    }
    const raw = c ? (curvePts(c) ? curveSrc(c, t - (s.mStart || 0)) : (+c.in || 0) + (t - (s.mStart || 0)) * (+c.speed || 1)) : t - (s.mStart || 0);
    return ((raw % d) + d) % d;
  }
  const BG_X = 0.6; // durasi crossfade antar background
  const specKey = (s) => [s.type, s.mediaId, s.mStart, s.preset, s.color, s.clip && s.clip.id, s.sceneLook || ''].join('|');
  const xfade = () => ({ type: state.bg.xTrans || 'fade', dur: state.bg.xDur == null ? BG_X : +state.bg.xDur });
  const TRANS_DUR = (spec) => {
    if (spec.clip) return spec.clip.trans === 'none' ? 0 : clamp(+spec.clip.transDur || 0.6, 0.1, 5);
    const x = xfade(); return x.type === 'none' ? 0 : clamp(x.dur, 0.1, 5);
  };
  // Background pada waktu t (memperhitungkan scene & slideshow berwaktu)
  function specAt(t) { return withSegs(specAtBase(t), t); }
  function specAtBase(t) {
    if (state.bg.type === 'media' && freeMode() && !clipList().length) return { ...state.bg, type: 'color', color: state.bg.color || '#000000' };
    const info = sceneAt(t);
    if (!info) return state.bg;
    const spec = timedSlides() && !hasOwnBg(info.index) ? slideSpec(slideAt(t)) : bgSpec(info.index);
    return withSceneLook(spec, info.index);
  }
  // ---- Pengaturan per scene (kosong = ikut pengaturan global) ----
  const sceneOf = (i) => (!freeMode() && state.scenes[i]) || null;
  // filter & efek latar khusus scene (klip yang punya filter sendiri tetap menang, lihat lookOf)
  function withSceneLook(spec, i) {
    const sc = sceneOf(i);
    if (!sc || (!sc.filter && !sc.fx)) return spec;
    const o = { ...spec, sceneLook: `${sc.filter || ''}/${sc.fx || ''}` };
    if (sc.filter) { o.filter = sc.filter; o.filterAmt = 100; }
    if (sc.fx) { o.fx = sc.fx; o.fxAmt = spec.fx === sc.fx && spec.fxAmt != null ? spec.fxAmt : 60; }
    return o;
  }
  // transisi latar saat MASUK ke scene i (null = ikut global / klip)
  function sceneTrans(i) {
    const sc = sceneOf(i);
    return sc && sc.xTrans ? sc.xTrans : null;
  }
  // animasi teks khusus scene
  function sceneAnim(sc) {
    const an = state.anim;
    if (!sc || (!sc.animIn && !sc.animOut && !sc.animInDur && !sc.animOutDur)) return an;
    return { ...an, type: sc.animIn || an.type, transition: sc.animOut || an.transition, inDur: +sc.animInDur > 0 ? +sc.animInDur : an.inDur, outDur: +sc.animOutDur > 0 ? +sc.animOutDur : an.outDur };
  }
  // Titik pergantian background terakhir sebelum/pada t
  function bgBoundary(t, info) {
    let b = sceneStart(info.index);
    if (timedSlides() && !hasOwnBg(info.index)) b = Math.max(b, slideAt(t).a);
    return b;
  }
  // Lapisan background yang tampil pada t: [{spec, alpha}] (2 lapisan saat crossfade)
  function bgLayersAt(t) {
    const info = sceneAt(t);
    if (!info) return [{ spec: state.bg, alpha: 1 }];
    const cur = specAt(t);
    const b = bgBoundary(t, info), local = t - b;
    // transisi khusus scene berlaku tepat di awal scene itu
    const own = Math.abs(b - sceneStart(info.index)) < 1e-6 ? sceneTrans(info.index) : null;
    const X = own ? (own === 'none' ? 0 : clamp(xfade().dur, 0.1, 5)) : TRANS_DUR(cur);
    if (b > 0 && X > 0 && local < X) {
      const prev = specAt(b - 1e-4);
      if (specKey(prev) !== specKey(cur)) {
        const p = clamp(local / X);
        return [{ spec: prev, alpha: 1 }, { spec: cur, alpha: p, trans: own || (cur.clip ? cur.clip.trans : xfade().type), p }];
      }
    }
    return [{ spec: cur, alpha: 1 }];
  }
  // Seluruh timeline dibagi per background: [{a, b, spec}]
  function bgIntervals() {
    const total = totalDuration();
    const cuts = new Set([0]);
    if (!freeMode()) state.scenes.forEach((_, i) => cuts.add(+sceneStart(i).toFixed(4)));
    if (timedSlides() && cycleDur() > 0) for (let sl = slideAt(0); sl.b < total - 1e-4; sl = slideAt(sl.b + 1e-6)) cuts.add(+sl.b.toFixed(4));
    const pts = [...cuts].filter((x) => x < total).sort((a, b) => a - b);
    return pts.map((a, i) => {
      const b = i + 1 < pts.length ? pts[i + 1] : total;
      return { a, b, spec: specAt((a + b) / 2) };
    });
  }

  // Video yang sedang terlihat pada waktu t (termasuk yang sedang crossfade) + posisi waktunya
  function visibleVideos(t) {
    const out = [];
    for (const { spec: s } of bgLayersAt(t)) {
      if (s.type !== 'media') continue;
      const item = mediaItem(s.mediaId) || state.media[0];
      const e = item && mediaEls.get(item.id);
      if (!e || !e.ready || item.kind !== 'video' || !e.el.duration) continue;
      const d = e.el.duration;
      const cp = s.clip && curvePts(s.clip);
      const crate = cp ? curveRate(cp, (t - (s.mStart || 0)) / clipDur(s.clip)) : 1;
      out.push({ el: e.el, item, time: srcTimeAt(s, t, d), rate: s.clip ? clamp((+s.clip.speed || 1) * crate, 0.0625, 16) : 1, still: !!(s.clip && (s.clip.rev || s.clip.freeze)), cvol: s.clip ? clipVolAt(s.clip, t - (s.mStart || 0)) : 1 });
    }
    if (freeMode()) for (const l of state.texts) {
      if (!isOverlay(l) || l.media !== 'video') continue;
      const [a, b] = textRange(l);
      if (t < a || t >= b) continue;
      const e = mediaEls.get(l.fileId);
      if (!e || !e.ready || !e.el.duration) continue;
      out.push({ el: e.el, item: null, ov: l, time: ovTime(l, t - a, e.el.duration), rate: 1 });
    }
    return out;
  }

  // Sinkronkan pemutaran video background dengan timeline preview
  function syncVideos(t, force = false) {
    const vis = visibleVideos(t);
    const active = new Set(vis.map((v) => v.el));
    for (const e of mediaEls.values()) {
      if (e.el instanceof HTMLVideoElement && !active.has(e.el) && !e.el.paused) e.el.pause();
    }
    for (const { el, item, time, rate, ov, still, cvol } of vis) {
      if (Math.abs(el.playbackRate - rate) > 1e-3) el.playbackRate = rate;
      // suara asli video: ikut terdengar kecuali dibisukan
      el.muted = still || (ov ? !ovAudible(ov) : !videoAudible(item) || cvol === 0);
      el.volume = clamp(ov ? +ovv(ov, 'vol') : +state.vsound.volume * (cvol == null ? 1 : cvol), 0, 1);
      if (player.playing && still) { // mundur / beku: frame dipilih manual
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - time) > 0.03 && !el.seeking) el.currentTime = time;
      } else if (player.playing) {
        if (el.paused) { el.currentTime = time; el.play().catch(() => {}); }
        else if (force || Math.abs(el.currentTime - time) > 0.3) el.currentTime = time;
      } else {
        if (!el.paused) el.pause();
        if (Math.abs(el.currentTime - time) > 0.02) el.currentTime = time;
      }
    }
  }

  function drawBackground(t, info) {
    const W = canvas.width, H = canvas.height;
    const layers = bgLayersAt(t);
    const inc = layers[1];
    for (const { spec, alpha, trans, p } of layers) {
      if (!trans || trans === 'fade') {
        // latar lama ikut bergerak pada transisi dorong / tembus
        if (inc && inc.trans && OUT_MOVE[inc.trans] && !trans) {
          ctx.save(); OUT_MOVE[inc.trans](easeIO(inc.p), W, H); drawBgLayer(t, spec); ctx.restore(); continue;
        }
        ctx.globalAlpha = alpha; drawBgLayer(t, spec); ctx.globalAlpha = 1; continue;
      }
      drawTransition(t, spec, trans, p);
    }
    ctx.globalAlpha = 1;
    if (state.bg.overlay > 0) {
      ctx.fillStyle = `rgba(0,0,0,${state.bg.overlay})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Transisi masuk klip (p = 0..1)
  // [nilai, nama, kelompok]
  const TRANSITIONS = [
    ['none', 'Tanpa transisi', 'Dasar'], ['fade', 'Pudar', 'Dasar'], ['flash', 'Kilat putih', 'Dasar'], ['black', 'Lewat hitam', 'Dasar'],
    ['colorFlash', 'Kilat warna-warni', 'Dasar'], ['filmBurn', 'Film terbakar', 'Dasar'], ['lightLeak', 'Cahaya bocor', 'Dasar'],
    ['slideLeft', 'Geser dari kanan', 'Geser'], ['slideRight', 'Geser dari kiri', 'Geser'], ['slideUp', 'Geser dari bawah', 'Geser'],
    ['slideDown', 'Geser dari atas', 'Geser'], ['bounceSlide', 'Geser memantul', 'Geser'], ['dropBounce', 'Jatuh memantul', 'Geser'],
    ['pushLeft', 'Dorong ke kiri', 'Dorong'], ['pushRight', 'Dorong ke kanan', 'Dorong'], ['pushUp', 'Dorong ke atas', 'Dorong'],
    ['pushDown', 'Dorong ke bawah', 'Dorong'], ['zoomThrough', 'Zoom tembus', 'Dorong'], ['slideAway', 'Lama menjauh', 'Dorong'],
    ['zoom', 'Zoom masuk', 'Zoom & putar'], ['zoomOut', 'Zoom keluar', 'Zoom & putar'], ['spin', 'Putar', 'Zoom & putar'],
    ['zoomSpin', 'Pusaran', 'Zoom & putar'], ['flip', 'Balik kartu', 'Zoom & putar'], ['flipV', 'Balik atas-bawah', 'Zoom & putar'],
    ['swing', 'Ayun', 'Zoom & putar'], ['stretch', 'Regang', 'Zoom & putar'],
    ['wipe', 'Sapu dari kiri', 'Sapu & bentuk'], ['wipeLeft', 'Sapu dari kanan', 'Sapu & bentuk'], ['wipeUp', 'Sapu dari bawah', 'Sapu & bentuk'],
    ['wipeDown', 'Sapu dari atas', 'Sapu & bentuk'], ['wipeDiag', 'Sapu diagonal', 'Sapu & bentuk'], ['splitV', 'Buka tengah', 'Sapu & bentuk'],
    ['splitH', 'Buka tengah (datar)', 'Sapu & bentuk'], ['circle', 'Lingkaran', 'Sapu & bentuk'], ['rectIris', 'Kotak membesar', 'Sapu & bentuk'],
    ['diamond', 'Belah ketupat', 'Sapu & bentuk'], ['heart', 'Hati', 'Sapu & bentuk'], ['star', 'Bintang', 'Sapu & bentuk'],
    ['clock', 'Jarum jam', 'Sapu & bentuk'], ['blinds', 'Tirai mendatar', 'Sapu & bentuk'], ['blindsV', 'Tirai tegak', 'Sapu & bentuk'],
    ['checker', 'Kotak-kotak', 'Sapu & bentuk'], ['dissolve', 'Larut (butiran)', 'Sapu & bentuk'],
    ['blurIn', 'Blur', 'Efek'], ['zoomBlur', 'Zoom blur', 'Efek'], ['pixelIn', 'Piksel', 'Efek'], ['glitchIn', 'Glitch', 'Efek'],
    ['rgbIn', 'RGB split', 'Efek'], ['shakeIn', 'Gempa', 'Efek'],
  ];
  const transOptions = () => {
    let html = '', grp = '';
    for (const [v, n, g] of TRANSITIONS) {
      if (g !== grp) { html += `${grp ? '</optgroup>' : ''}<optgroup label="${g}">`; grp = g; }
      html += `<option value="${v}">${n}</option>`;
    }
    return html + '</optgroup>';
  };
  const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOutBounce = (x) => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  };
  // gerakan latar lama pada transisi dorong (e = 0..1)
  const OUT_MOVE = {
    pushLeft: (e, W) => ctx.translate(-e * W, 0), pushRight: (e, W) => ctx.translate(e * W, 0),
    pushUp: (e, W, H) => ctx.translate(0, -e * H), pushDown: (e, W, H) => ctx.translate(0, e * H),
    zoomThrough: (e, W, H) => { const z = 1 + 1.5 * e; ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); ctx.globalAlpha = 1 - e; },
    slideAway: (e, W, H) => { const z = 1 - 0.25 * e; ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); ctx.globalAlpha = 1 - 0.6 * e; },
  };
  const OFF_TRANS = new Set(['blurIn', 'zoomBlur', 'pixelIn', 'glitchIn', 'rgbIn']);
  function starPath(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  // transisi berbasis piksel: latar baru digambar dulu ke kanvas bantu, lalu digabung dengan efek
  function drawOffTransition(t, spec, trans, p) {
    const W = canvas.width, H = canvas.height, sc = W / 1080, e = easeOut(p);
    const A = fxBuf(5), B = fxBuf(6);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    A.g.globalCompositeOperation = 'copy'; A.g.drawImage(canvas, 0, 0); A.g.globalCompositeOperation = 'source-over';
    ctx.restore();
    ctx.save(); drawBgLayer(t, spec); ctx.restore();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    B.g.globalCompositeOperation = 'copy'; B.g.drawImage(canvas, 0, 0); B.g.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'copy'; ctx.drawImage(A.c, 0, 0); ctx.globalCompositeOperation = 'source-over';
    const src = B.c;
    if (trans === 'blurIn') {
      ctx.globalAlpha = clamp(p * 1.5);
      const px = (1 - e) * 40 * sc;
      if (px > 0.3) ctx.filter = `blur(${px.toFixed(1)}px)`;
      ctx.drawImage(src, 0, 0);
    } else if (trans === 'zoomBlur') {
      ctx.globalAlpha = clamp(p * 1.4);
      ctx.drawImage(src, 0, 0);
      const amt = (1 - e) * 0.12;
      ctx.globalAlpha = clamp(p * 1.4) * 0.3;
      for (let i = 1; i <= 5 && amt > 0.002; i++) {
        const z = 1 + amt * i;
        ctx.drawImage(src, W / 2 - (W * z) / 2, H / 2 - (H * z) / 2, W * z, H * z);
      }
    } else if (trans === 'pixelIn') {
      // makin kasar menuju tengah transisi, latar baru masuk di tengah
      const q = 1 - Math.abs(p * 2 - 1), block = Math.max(1, Math.round((2 + q * 60) * sc));
      const from = p < 0.5 ? A.c : src, sb = fxBuf(1), w = Math.ceil(W / block), h = Math.ceil(H / block);
      sb.g.clearRect(0, 0, W, H);
      sb.g.drawImage(from, 0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sb.c, 0, 0, w, h, 0, 0, W, H);
    } else if (trans === 'glitchIn') {
      const rnd = mulberry32(Math.floor(p * 40) * 7919 + 5);
      ctx.globalAlpha = 1;
      ctx.drawImage(rnd() < p ? src : A.c, 0, 0);
      const n = 4 + Math.floor(rnd() * 8), amp = (1 - Math.abs(p * 2 - 1)) * W * 0.25;
      for (let i = 0; i < n; i++) {
        const y = rnd() * H, h = (0.01 + rnd() * 0.1) * H, dx = (rnd() - 0.5) * amp;
        ctx.drawImage(rnd() < p ? src : A.c, 0, y, W, h, dx, y, W, h);
      }
      if (rnd() < 0.5) { ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.3 * (1 - Math.abs(p * 2 - 1)); ctx.drawImage(channel(src, '#ff0000'), amp * 0.1, 0); }
    } else if (trans === 'rgbIn') {
      ctx.globalAlpha = clamp(p * 1.3);
      const dx = (1 - e) * 60 * sc;
      if (dx < 0.5) ctx.drawImage(src, 0, 0);
      else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(channel(src, '#ff0000'), dx, 0);
        ctx.drawImage(channel(src, '#00ff00'), 0, 0);
        ctx.drawImage(channel(src, '#0000ff'), -dx, 0);
      }
    }
    ctx.restore();
  }
  function drawTransition(t, spec, trans, p) {
    if (OFF_TRANS.has(trans)) { drawOffTransition(t, spec, trans, p); return; }
    const W = canvas.width, H = canvas.height, e = easeOut(p), ei = easeIO(p);
    ctx.save();
    if (trans === 'slideLeft') ctx.translate((1 - e) * W, 0);
    else if (trans === 'slideRight') ctx.translate(-(1 - e) * W, 0);
    else if (trans === 'slideUp') ctx.translate(0, (1 - e) * H);
    else if (trans === 'slideDown') ctx.translate(0, -(1 - e) * H);
    else if (trans === 'bounceSlide') ctx.translate((1 - easeOutBack(p)) * W, 0);
    else if (trans === 'dropBounce') ctx.translate(0, -(1 - easeOutBounce(p)) * H);
    else if (trans === 'pushLeft') ctx.translate((1 - ei) * W, 0);
    else if (trans === 'pushRight') ctx.translate(-(1 - ei) * W, 0);
    else if (trans === 'pushUp') ctx.translate(0, (1 - ei) * H);
    else if (trans === 'pushDown') ctx.translate(0, -(1 - ei) * H);
    else if (trans === 'zoomThrough' || trans === 'slideAway') {
      const z = trans === 'zoomThrough' ? 0.5 + 0.5 * ei : 1;
      if (trans === 'slideAway') ctx.translate((1 - ei) * W, 0);
      ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
      if (trans === 'zoomThrough') ctx.globalAlpha = clamp(p * 1.5);
    } else if (trans === 'zoomSpin') {
      const z = 2.5 - 1.5 * e;
      ctx.translate(W / 2, H / 2); ctx.rotate(-(1 - e) * Math.PI * 1.5); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
      ctx.globalAlpha = clamp(p * 2);
    } else if (trans === 'flip' || trans === 'flipV' || trans === 'stretch') {
      const s = trans === 'stretch' ? easeOutBack(p) : e;
      ctx.translate(W / 2, H / 2);
      if (trans === 'flipV') ctx.scale(1, Math.max(0.001, s)); else if (trans === 'flip') ctx.scale(Math.max(0.001, s), 1);
      else ctx.scale(Math.max(0.001, 1 + (1 - s) * 0.6), Math.max(0.001, s));
      ctx.translate(-W / 2, -H / 2);
      ctx.globalAlpha = clamp(p * 2);
    } else if (trans === 'swing') {
      ctx.rotate(-(1 - easeOutBack(p)) * Math.PI / 2);
      ctx.globalAlpha = clamp(p * 2);
    } else if (trans === 'shakeIn') {
      const amp = (1 - p) * 60 * (W / 1080), r = mulberry32(Math.floor(p * 60) * 31 + 7);
      ctx.translate((r() - 0.5) * 2 * amp, (r() - 0.5) * 2 * amp);
      ctx.globalAlpha = clamp(p * 1.6);
    } else if (trans === 'zoom' || trans === 'zoomOut' || trans === 'spin') {
      const z = trans === 'zoom' ? 1.35 - 0.35 * e : trans === 'zoomOut' ? 0.6 + 0.4 * e : 0.3 + 0.7 * e;
      ctx.translate(W / 2, H / 2);
      if (trans === 'spin') ctx.rotate((1 - e) * Math.PI);
      ctx.scale(z, z);
      ctx.translate(-W / 2, -H / 2);
      ctx.globalAlpha = clamp(p * 1.6);
    } else if (trans === 'wipe') {
      ctx.beginPath(); ctx.rect(0, 0, W * e, H); ctx.clip();
    } else if (trans === 'circle') {
      ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * e, 0, Math.PI * 2); ctx.clip();
    } else if (trans === 'wipeLeft') { ctx.beginPath(); ctx.rect(W * (1 - e), 0, W * e, H); ctx.clip(); }
    else if (trans === 'wipeUp') { ctx.beginPath(); ctx.rect(0, H * (1 - e), W, H * e); ctx.clip(); }
    else if (trans === 'wipeDown') { ctx.beginPath(); ctx.rect(0, 0, W, H * e); ctx.clip(); }
    else if (trans === 'wipeDiag') {
      const s = e * (W + H);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s, 0); ctx.lineTo(s - H, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip();
    } else if (trans === 'splitV') { ctx.beginPath(); ctx.rect((W / 2) * (1 - e), 0, W * e, H); ctx.clip(); }
    else if (trans === 'splitH') { ctx.beginPath(); ctx.rect(0, (H / 2) * (1 - e), W, H * e); ctx.clip(); }
    else if (trans === 'rectIris') { ctx.beginPath(); ctx.rect((W / 2) * (1 - e), (H / 2) * (1 - e), W * e, H * e); ctx.clip(); }
    else if (trans === 'diamond') {
      const r = e * (W + H) / 2;
      ctx.beginPath(); ctx.moveTo(W / 2, H / 2 - r); ctx.lineTo(W / 2 + r, H / 2); ctx.lineTo(W / 2, H / 2 + r); ctx.lineTo(W / 2 - r, H / 2); ctx.closePath(); ctx.clip();
    } else if (trans === 'heart') {
      const s = e * Math.max(W, H) * 2.6;
      heartPath(W / 2, H / 2 - s * 0.45, s); ctx.clip();
    } else if (trans === 'star') { starPath(W / 2, H / 2, e * Math.max(W, H) * 1.7); ctx.clip(); }
    else if (trans === 'clock') {
      const r = Math.hypot(W, H);
      ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.arc(W / 2, H / 2, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ei); ctx.closePath(); ctx.clip();
    } else if (trans === 'blinds' || trans === 'blindsV') {
      const n = 10;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (trans === 'blinds') ctx.rect(0, (i * H) / n, W, (H / n) * ei + 0.5);
        else ctx.rect((i * W) / n, 0, (W / n) * ei + 0.5, H);
      }
      ctx.clip();
    } else if (trans === 'checker') {
      const cols = 6, rows = Math.max(1, Math.round((cols * H) / W)), cw = W / cols, ch = H / rows;
      ctx.beginPath();
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const q = clamp(p * 1.8 - ((i + j) / (cols + rows - 2 || 1)) * 0.8);
        if (q <= 0) continue;
        const w = cw * q + 0.5, h = ch * q + 0.5;
        ctx.rect(i * cw + (cw - w) / 2, j * ch + (ch - h) / 2, w, h);
      }
      ctx.clip();
    } else if (trans === 'dissolve') {
      const cell = Math.max(8, Math.round(W / 60)), cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
      ctx.beginPath();
      for (let j = 0; j < rows; j++) {
        const r = mulberry32(j * 92821 + 3);
        for (let i = 0; i < cols; i++) if (r() < p) ctx.rect(i * cell, j * cell, cell + 0.5, cell + 0.5);
      }
      ctx.clip();
    } else if (trans === 'flash' || trans === 'black' || trans === 'colorFlash') {
      if (p < 0.5) { ctx.restore(); flashOverlay(trans, p * 2, t); return; }
    } else if (trans === 'filmBurn' || trans === 'lightLeak') ctx.globalAlpha = clamp((p - 0.25) * 2);
    else ctx.globalAlpha = p;
    drawBgLayer(t, spec);
    ctx.restore();
    if (trans === 'flash' || trans === 'black' || trans === 'colorFlash') flashOverlay(trans, (1 - p) * 2, t);
    else if (trans === 'filmBurn' || trans === 'lightLeak') burnOverlay(trans, p);
  }
  function flashOverlay(trans, a, t = 0) {
    ctx.save();
    ctx.globalAlpha = clamp(a);
    ctx.fillStyle = trans === 'flash' ? '#ffffff' : trans === 'colorFlash' ? `hsl(${Math.floor(t * 12) * 47 % 360},100%,60%)` : '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  // nyala oranye (film terbakar) / cahaya bocor yang memuncak di tengah transisi
  function burnOverlay(trans, p) {
    const W = canvas.width, H = canvas.height, a = Math.sin(Math.PI * p);
    if (a < 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const x = trans === 'filmBurn' ? W * (1.1 - 1.2 * p) : W * (0.2 + 0.6 * p), y = H * (trans === 'filmBurn' ? 0.5 : 0.3);
    const r = Math.max(W, H) * (0.4 + 0.8 * a);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    if (trans === 'filmBurn') {
      g.addColorStop(0, `rgba(255,250,220,${a})`); g.addColorStop(0.35, `rgba(255,140,20,${a * 0.9})`); g.addColorStop(0.7, `rgba(180,20,0,${a * 0.5})`);
    } else {
      g.addColorStop(0, `rgba(255,200,120,${a * 0.9})`); g.addColorStop(0.5, `rgba(255,80,120,${a * 0.5})`);
    }
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ---------- Partikel ----------
  const particleCache = { key: '', list: [] };
  function getParticles(type, count) {
    const key = `${type}:${count}`;
    if (particleCache.key !== key) {
      const rng = mulberry32(1234);
      particleCache.key = key;
      particleCache.list = Array.from({ length: count }, () => ({
        x: rng(), y: rng(), s: rng(), sp: rng(), ph: rng() * Math.PI * 2,
      }));
    }
    return particleCache.list;
  }

  function heartPath(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
    ctx.closePath();
  }

  function drawParticles(t) {
    const type = state.effects.particles;
    if (!type || type === 'none' || !PARTICLE_BASE[type]) return;
    const W = canvas.width, H = canvas.height, sc = W / 1080;
    const count = Math.max(1, Math.round(PARTICLE_BASE[type] * (+state.effects.amount || 1)));
    const list = getParticles(type, count);
    ctx.save();
    for (const p of list) {
      if (type === 'snow') {
        const r = (2 + p.s * 6) * sc;
        const y = fract(p.y + t * (0.03 + p.sp * 0.05)) * (H + 20 * sc) - 10 * sc;
        const x = p.x * W + Math.sin(t * (0.5 + p.sp) + p.ph) * 30 * sc;
        ctx.globalAlpha = 0.45 + 0.45 * p.s;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      } else if (type === 'bokeh') {
        const r = (40 + p.s * 110) * sc;
        const y = fract(p.y - t * (0.008 + p.sp * 0.015)) * (H + 2 * r) - r;
        const x = p.x * W + Math.sin(t * 0.3 + p.ph) * 40 * sc;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const a = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.8 + p.ph));
        g.addColorStop(0, `rgba(255,225,190,${a})`);
        g.addColorStop(0.7, `rgba(255,225,190,${a * 0.6})`);
        g.addColorStop(1, 'rgba(255,225,190,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      } else if (type === 'stars') {
        const r = (1 + p.s * 2.8) * sc;
        ctx.globalAlpha = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * (1 + p.sp * 3) + p.ph));
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, r, 0, Math.PI * 2); ctx.fill();
      } else if (type === 'rain') {
        const len = (35 + p.s * 55) * sc;
        const y = fract(p.y + t * (0.7 + p.sp * 0.6)) * (H + len) - len;
        const x = p.x * W;
        ctx.globalAlpha = 0.18 + 0.25 * p.s;
        ctx.strokeStyle = '#cfe0ff';
        ctx.lineWidth = (1 + p.s * 1.5) * sc;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * 0.12, y + len); ctx.stroke();
      } else if (type === 'dust') {
        const r = (1.5 + p.s * 3.5) * sc;
        const y = fract(p.y - t * (0.01 + p.sp * 0.02)) * H;
        const x = p.x * W + Math.sin(t * (0.4 + p.sp * 0.6) + p.ph) * 50 * sc;
        ctx.globalAlpha = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + p.ph));
        ctx.shadowColor = '#ffd77a';
        ctx.shadowBlur = 12 * sc;
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      } else if (type === 'hearts') {
        const s = (22 + p.s * 34) * sc;
        const y = fract(p.y - t * (0.02 + p.sp * 0.03)) * (H + 2 * s) - s;
        const x = p.x * W + Math.sin(t * (0.6 + p.sp) + p.ph) * 40 * sc;
        ctx.globalAlpha = 0.25 + 0.35 * p.s;
        ctx.fillStyle = '#ff5c8a';
        heartPath(x, y, s); ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawVignette() {
    const v = +state.effects.vignette || 0;
    if (v <= 0) return;
    const W = canvas.width, H = canvas.height;
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${v})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  let noiseCanvas = null;
  function drawGrain() {
    if (!state.effects.grain) return;
    if (!noiseCanvas) {
      noiseCanvas = document.createElement('canvas');
      noiseCanvas.width = noiseCanvas.height = 256;
      const nctx = noiseCanvas.getContext('2d');
      const img = nctx.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      nctx.putImageData(img, 0, 0);
    }
    const W = canvas.width, H = canvas.height;
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.globalCompositeOperation = 'overlay';
    const ox = Math.floor(Math.random() * 256), oy = Math.floor(Math.random() * 256);
    ctx.translate(-ox, -oy);
    ctx.fillStyle = ctx.createPattern(noiseCanvas, 'repeat');
    ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
  }

  function drawProgressBar(t) {
    if (!state.effects.progressBar) return;
    const W = canvas.width, H = canvas.height;
    const h = 10 * (W / 1080);
    const p = clamp(t / (totalDuration() || 1));
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(0, H - h, W, h);
    ctx.fillStyle = state.style.highlightColor;
    ctx.fillRect(0, H - h, W * p, h);
    ctx.restore();
  }

  function drawFrame() {
    const f = state.effects.frame;
    if (!f || f === 'none') return;
    const W = canvas.width, H = canvas.height, sc = W / 1080;
    const m = 50 * sc;
    ctx.save();
    ctx.strokeStyle = hexToRgba(state.style.color, 0.7);
    ctx.lineWidth = 4 * sc;
    if (f === 'simple' || f === 'double') ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
    if (f === 'double') {
      const g = 16 * sc;
      ctx.lineWidth = 2 * sc;
      ctx.strokeRect(m + g, m + g, W - 2 * (m + g), H - 2 * (m + g));
    }
    if (f === 'corner') {
      const L = 110 * sc;
      ctx.lineCap = 'round';
      ctx.beginPath();
      [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, dx, dy]) => {
        ctx.moveTo(x + L * dx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + L * dy);
      });
      ctx.stroke();
    }
    if (f === 'film') {
      const bh = H * 0.09;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, bh);
      ctx.fillRect(0, H - bh, W, bh);
    }
    ctx.restore();
  }

  function drawFadeBlack(t) {
    if (!state.effects.fadeBlack) return;
    const total = totalDuration();
    const a = clamp(Math.max(1 - t / 0.6, 1 - (total - t) / 0.8));
    if (a <= 0) return;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawLogo() {
    const img = media.logo;
    if (!img) return;
    const L = state.logo, W = canvas.width, H = canvas.height;
    const w = W * L.size, h = (w * img.naturalHeight) / img.naturalWidth;
    const m = W * 0.045;
    const x = L.pos[1] === 'l' ? m : L.pos[1] === 'r' ? W - m - w : (W - w) / 2;
    const y = L.pos[0] === 't' ? m : H - m - h;
    ctx.save();
    ctx.globalAlpha = L.opacity;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  }

  // Saat export WebCodecs, data visualizer dihitung dari audio yang sudah dirender (bukan realtime)
  let offlineAudio = null;
  const HANN = Float32Array.from({ length: 256 }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 255));
  function vizFromBuffer() {
    const { data, sr, t } = offlineAudio;
    const n = 256;
    const s0 = Math.max(0, Math.min(data.length - n, Math.floor(t * sr) - n));
    for (let i = 0; i < n; i++) audio.wave[i] = clamp(128 + (data[s0 + i] || 0) * 127, 0, 255);
    for (let k = 0; k < 128; k++) {
      let re = 0, im = 0;
      const w = (2 * Math.PI * k) / n;
      for (let i = 0; i < n; i++) {
        const v = (data[s0 + i] || 0) * HANN[i];
        re += v * Math.cos(w * i);
        im -= v * Math.sin(w * i);
      }
      const db = 20 * Math.log10(Math.sqrt(re * re + im * im) / n + 1e-9);
      audio.freq[k] = clamp((db + 100) / 70) * 255;
    }
  }

  // Panduan area aman platform (hanya di preview, tidak ikut export)
  function drawGuides() {
    const W = canvas.width, H = canvas.height, sc = W / 1080;
    ctx.save();
    ctx.lineWidth = 2 * sc;
    ctx.setLineDash([14 * sc, 10 * sc]);
    ctx.font = `600 ${30 * sc}px Poppins, sans-serif`;
    ctx.textBaseline = 'top';
    const zone = (x, y, w, h, label) => {
      ctx.fillStyle = 'rgba(255,60,90,0.16)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255,90,120,0.8)';
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(label, x + 12 * sc, y + 10 * sc);
    };
    if (state.ratio === '9:16') {
      zone(0, 0, W, H * 0.11, 'Area atas (judul/akun)');
      zone(0, H * 0.78, W, H * 0.22, 'Area caption & tombol');
      zone(W * 0.86, H * 0.42, W * 0.14, H * 0.36, '');
    }
    // area aman judul (10%)
    ctx.strokeStyle = 'rgba(120,200,255,0.8)';
    ctx.strokeRect(W * 0.1, H * 0.1, W * 0.8, H * 0.8);
    // garis tengah
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H);
    ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- Visualizer musik ----------
  const CIRCULAR_VIZ = ['circle', 'ring', 'sun'];

  // Data contoh saat dijeda, supaya posisi/ukuran visualizer mudah diatur
  function vizDemo(t) {
    for (let k = 0; k < 128; k++) {
      const v = (0.85 - (k / 128) * 0.55) * (0.55 + 0.45 * Math.sin(k * 0.37 + t * 2.1) * Math.cos(k * 0.11 - t * 1.3));
      audio.freq[k] = clamp(v) * 255;
    }
    for (let i = 0; i < 256; i++) {
      audio.wave[i] = 128 + 70 * Math.sin((i / 256) * Math.PI * 6 + t * 4) * Math.sin((i / 256) * Math.PI);
    }
  }

  // Ambil data audio terbaru. false = tidak ada yang perlu digambar.
  function vizData(t) {
    if (!audio.freq) { audio.freq = new Uint8Array(128); audio.wave = new Uint8Array(256); }
    if (offlineAudio) { vizFromBuffer(); return true; }
    if (audio.analyser && player.playing && anyAudio()) {
      audio.analyser.getByteFrequencyData(audio.freq);
      audio.analyser.getByteTimeDomainData(audio.wave);
      return true;
    }
    if (!player.playing && !player.exporting && !ui.capturing) { vizDemo(t); return true; }
    return false;
  }

  // nilai 0..1 untuk n batang (frekuensi rendah → tinggi)
  function vizBands(n) {
    const out = new Array(n);
    const maxBin = audio.freq.length * 0.72;
    for (let i = 0; i < n; i++) {
      const a = Math.floor((i / n) * maxBin), b = Math.max(a + 1, Math.floor(((i + 1) / n) * maxBin));
      let s = 0;
      for (let k = a; k < b; k++) s += audio.freq[k];
      out[i] = clamp((s / (b - a) / 255) * (+state.viz.height || 1));
    }
    return out;
  }

  // Ukuran & posisi visualizer di kanvas (juga dipakai untuk menarik/drag)
  function vizGeom() {
    const W = canvas.width, H = canvas.height, v = state.viz;
    const cx = W * v.x, cy = H * v.y;
    const w = W * v.width;
    const maxH = H * 0.12 * (+v.height || 1);
    const R = w * 0.22;
    const circular = CIRCULAR_VIZ.includes(state.effects.visualizer);
    const ext = circular ? R + maxH * 0.8 : 0;
    return {
      cx, cy, w, maxH, R, circular,
      box: circular
        ? { x: cx - ext, y: cy - ext, w: ext * 2, h: ext * 2 }
        : { x: cx - w / 2, y: cy - maxH, w, h: maxH * 2 },
    };
  }

  function vizFill(i, n, g) {
    const v = state.viz;
    if (v.color === 'rainbow') return `hsl(${Math.round((i / Math.max(1, n)) * 300)},90%,62%)`;
    if (v.color === 'custom') return v.customColor;
    if (v.color === 'text') return state.style.color;
    if (v.color === 'gradient') {
      const grad = ctx.createLinearGradient(g.cx - g.w / 2, 0, g.cx + g.w / 2, 0);
      grad.addColorStop(0, state.style.color);
      grad.addColorStop(1, state.style.highlightColor);
      return grad;
    }
    return state.style.highlightColor;
  }

  function drawVisualizer(t) {
    const type = state.effects.visualizer;
    if (!type || type === 'none' || !vizData(t)) return;
    const W = canvas.width, sc = W / 1080;
    const v = state.viz;
    const g = vizGeom();
    const { cx, cy, w, maxH, R } = g;
    const n = Math.round(clamp(+v.bars || 48, 8, 128));
    const thick = Math.max(1, (+v.thickness || 1) * 4 * sc);
    const perBar = v.color === 'rainbow';
    const solid = perBar ? null : vizFill(0, n, g);
    ctx.save();
    ctx.globalAlpha = clamp(+v.opacity || 0.85);
    ctx.fillStyle = ctx.strokeStyle = solid || '#fff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (v.glow) { ctx.shadowColor = typeof solid === 'string' ? solid : state.style.highlightColor; ctx.shadowBlur = 18 * sc; }
    const color = (i) => { if (perBar) ctx.fillStyle = ctx.strokeStyle = vizFill(i, n, g); };
    const left = cx - w / 2;

    if (type === 'bars' || type === 'mirror' || type === 'blocks' || type === 'dots') {
      const bands = vizBands(n);
      const gap = Math.min(6 * sc, (w / n) * 0.3);
      const bw = (w - gap * (n - 1)) / n;
      bands.forEach((val, i) => {
        color(i);
        const x = left + i * (bw + gap);
        const h = Math.max(bw * 0.6, val * maxH);
        if (type === 'bars') { roundRect(x, cy - h, bw, h, Math.min(bw, h) / 2); ctx.fill(); }
        else if (type === 'mirror') { roundRect(x, cy - h * 0.75, bw, h * 1.5, Math.min(bw, h) / 2); ctx.fill(); }
        else if (type === 'blocks') {
          const seg = bw * 0.8, segs = Math.round(maxH / (seg + gap)), on = Math.max(1, Math.round(val * segs));
          for (let k = 0; k < on; k++) {
            ctx.globalAlpha = clamp(+v.opacity || 0.85) * (0.45 + 0.55 * (k / Math.max(1, segs)));
            ctx.fillRect(x, cy - (k + 1) * (seg + gap) + gap, bw, seg);
          }
          ctx.globalAlpha = clamp(+v.opacity || 0.85);
        } else if (type === 'dots') {
          const r = bw / 2, step = bw * 1.25, dots = Math.max(1, Math.round((val * maxH) / step));
          for (let k = 0; k < dots; k++) { ctx.beginPath(); ctx.arc(x + r, cy - r - k * step, r * 0.85, 0, Math.PI * 2); ctx.fill(); }
        }
      });
    } else if (type === 'area') {
      const bands = vizBands(n);
      const pts = bands.map((val, i) => [left + (i / (n - 1)) * w, cy - val * maxH]);
      ctx.beginPath();
      ctx.moveTo(left, cy);
      ctx.lineTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1][0] + pts[i][0]) / 2, my = (pts[i - 1][1] + pts[i][1]) / 2;
        ctx.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], mx, my);
      }
      ctx.lineTo(left + w, cy);
      ctx.closePath();
      const base = typeof solid === 'string' ? solid : state.style.highlightColor;
      const fg = ctx.createLinearGradient(0, cy - maxH, 0, cy);
      fg.addColorStop(0, hexToRgba(base.startsWith('#') ? base : '#ffffff', 0.9));
      fg.addColorStop(1, hexToRgba(base.startsWith('#') ? base : '#ffffff', 0.1));
      ctx.fillStyle = v.color === 'rainbow' || v.color === 'gradient' ? vizFill(0, n, g) : fg;
      ctx.fill();
    } else if (type === 'wave' || type === 'wave2') {
      ctx.lineWidth = thick;
      const lines = type === 'wave2' ? 3 : 1;
      for (let L = 0; L < lines; L++) {
        ctx.globalAlpha = clamp(+v.opacity || 0.85) * (L === 0 ? 1 : 0.45);
        ctx.beginPath();
        const N = audio.wave.length;
        for (let i = 0; i < N; i++) {
          const x = left + (i / (N - 1)) * w;
          const amp = ((audio.wave[i] - 128) / 128) * maxH * (L === 0 ? 1 : L === 1 ? 0.6 : -0.6);
          const y = cy + amp * (+v.height || 1) * 0.9;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    } else if (type === 'circle' || type === 'sun') {
      const bands = vizBands(n);
      ctx.lineWidth = Math.max(2 * sc, ((2 * Math.PI * R) / n) * 0.55);
      bands.forEach((val, i) => {
        color(i);
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const len = Math.max(4 * sc, val * maxH * 0.8);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.lineTo(cx + Math.cos(a) * (R + len), cy + Math.sin(a) * (R + len));
        ctx.stroke();
      });
      if (type === 'sun') {
        const avg = bands.reduce((s, x) => s + x, 0) / bands.length;
        ctx.globalAlpha = clamp(+v.opacity || 0.85) * 0.35;
        ctx.beginPath();
        ctx.arc(cx, cy, R * (0.85 + avg * 0.25), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (type === 'ring') {
      ctx.lineWidth = thick;
      const N = audio.wave.length;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const k = i % N;
        const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
        const r = R + ((audio.wave[k] - 128) / 128) * maxH * 0.6;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    // garis bantu saat sedang menarik visualizer
    if (vizDrag && !player.exporting && !ui.capturing) {
      const b = g.box;
      ctx.save();
      ctx.setLineDash([12 * sc, 8 * sc]);
      ctx.lineWidth = 2 * sc;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.restore();
    }
  }

  // ---------- Teks ----------
  // Pecah teks menjadi token kata. *kata* = disorot (highlight).
  function tokenize(text) {
    let inHl = false;
    return text.split('\n').map((par) => par.split(/\s+/).filter(Boolean).map((raw) => {
      const stars = (raw.match(/\*/g) || []).length;
      const hl = inHl || stars > 0;
      if (stars % 2 === 1) inHl = !inHl;
      return { w: raw.replace(/\*/g, ''), hl };
    }).filter((tk) => tk.w));
  }

  function wrapTokens(paragraphs, maxW) {
    const lines = [];
    for (const words of paragraphs) {
      if (!words.length) { lines.push([]); continue; }
      let line = [words[0]];
      for (let i = 1; i < words.length; i++) {
        const test = [...line, words[i]].map((x) => x.w).join(' ');
        if (ctx.measureText(test).width > maxW) { lines.push(line); line = [words[i]]; }
        else line.push(words[i]);
      }
      lines.push(line);
    }
    return lines;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function setLetterSpacing(px) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
  }

  // teks melengkung: teks digambar ke kanvas bantu lalu ditempel per irisan tegak yang digeser mengikuti busur
  function drawText(info) {
    const cv = info && info.scene ? +textStyleOf(info.scene).curve || 0 : 0;
    if (!cv) { drawTextRaw(info); return; }
    const W = canvas.width, H = canvas.height, buf = clipBuf(2), main = ctx;
    ctx = buf.g;
    try { drawTextRaw(info); } finally { ctx = main; }
    const b = info.box;
    const cx = b && b.x1 != null ? (b.x0 + b.x1) / 2 : W / 2;
    const hw = Math.max(W * 0.08, b && b.x1 != null ? (b.x1 - b.x0) / 2 + W * 0.04 : W * 0.4);
    const amp = (cv / 100) * hw * 0.55, step = Math.max(2, Math.round(W / 540));
    for (let x = 0; x < W; x += step) {
      const u = (x + step / 2 - cx) / hw;
      const dy = -amp * (1 - u * u);
      ctx.drawImage(buf.c, x, 0, step, H, x, dy, step, H);
    }
  }
  function drawTextRaw(info) {
    if (!info) return;
    // "Masuk di detik": teks scene bisa muncul belakangan (jeda dari awal scene)
    const delay = Math.max(0, +info.scene.delay || 0);
    if (delay > 0) {
      if (info.local < delay) return;
      info = { ...info, local: info.local - delay, dur: Math.max(0.3, info.dur - delay) };
    }
    // "Hilang di detik": teks bisa hilang sebelum scene berakhir (animasi keluar tetap jalan)
    const hold = +info.scene.hold || 0;
    if (hold > 0 && hold < info.dur) {
      if (info.local >= hold) return;
      info = { ...info, dur: hold };
    }
    const W = canvas.width, H = canvas.height;
    const st = textStyleOf(info.scene), an = sceneAnim(info.scene);
    const scale = W / 1080; // ukuran font relatif terhadap lebar 1080
    const size = st.size * scale;
    const lh = size * st.lineHeight;
    const maxW = W * 0.82;

    let text = info.scene.text || '';
    let author = (info.scene.author || '').trim();
    if (st.uppercase) { text = text.toUpperCase(); author = author.toUpperCase(); }

    const fontStr = `${st.italic ? 'italic ' : ''}${st.weight} ${size}px "${st.font}", sans-serif`;
    ctx.save();
    // teks bebas: digeser ke posisi x-nya (posisi y lewat centerY)
    const offX = info.pos ? (clamp(+info.pos.x, 0, 1) - 0.5) * W : 0;
    if (offX) ctx.translate(offX, 0);
    ctx.font = fontStr;
    setLetterSpacing((+st.letterSpacing || 0) * scale);
    const lines = wrapTokens(tokenize(text), maxW);
    const authorSize = size * 0.5;
    const authorGap = author ? size * 0.8 : 0;
    const emoji = (info.scene.emoji || '').trim();
    const emojiSize = size * 1.5;
    const emojiH = emoji ? emojiSize * 1.35 : 0;
    const blockH = lines.length * lh + (author ? authorGap + authorSize : 0);

    // ---- progres animasi masuk ----
    const speed = +an.speed || 1;
    const totalWords = lines.reduce((a, l) => a + l.length, 0);
    const totalChars = lines.reduce((a, l) => a + l.reduce((b, tk) => b + tk.w.length + 1, 0), 0);
    let inDur;
    if (an.type === 'typewriter') inDur = Math.min(info.dur * 0.7, (totalChars * 0.045) / speed);
    else if (an.type === 'word') inDur = Math.min(info.dur * 0.7, (totalWords * 0.22) / speed);
    else if (an.type === 'karaoke') inDur = info.dur * 0.8;
    else if (an.type === 'charPop' || an.type === 'charRise') inDur = Math.min(info.dur * 0.7, (totalChars * 0.05) / speed);
    else inDur = Math.min(info.dur * 0.45, 0.9 / speed);
    // lama animasi masuk diatur sendiri (detik); karaoke tetap mengikuti durasi teks
    if (+an.inDur > 0 && an.type !== 'karaoke') inDur = Math.min(+an.inDur, info.dur * 0.9);
    const p = inDur > 0 ? clamp(info.local / inDur) : 1;
    const pe = easeOut(p);

    // ---- animasi keluar ----
    const tr = an.transition;
    let outAlpha = 1, outP = 0;
    if (tr && tr !== 'none') {
      let outDur = Math.min(tr === 'fade' ? 0.5 : 0.6, info.dur * 0.2);
      if (+an.outDur > 0) outDur = Math.min(+an.outDur, Math.max(0.1, info.dur - Math.min(inDur, info.dur * 0.5)));
      outP = 1 - clamp((info.dur - info.local) / outDur);
      outAlpha = 1 - outP;
    }

    let alpha = 1, dx = 0, dy = 0, zoom = 1, blur = 0, rot = 0, sx = 1, sy = 1;
    // animasi masuk tambahan
    const at = an.type;
    if (at === 'slideDown') { alpha = pe; dy = -(1 - pe) * 120 * scale; }
    else if (at === 'slideRight') { alpha = pe; dx = (1 - pe) * 140 * scale; }
    else if (at === 'zoomBig') { alpha = pe; zoom = 1.6 - 0.6 * pe; }
    else if (at === 'spinIn') { alpha = pe; rot = -(1 - pe) * Math.PI; zoom = 0.4 + 0.6 * pe; }
    else if (at === 'drop') { alpha = clamp(p * 4); dy = -(1 - easeOutBounce(p)) * 260 * scale; }
    else if (at === 'flipIn') { alpha = clamp(p * 2); sx = Math.max(0.001, pe); }
    else if (at === 'stretchIn') { alpha = clamp(p * 3); sy = Math.max(0.001, easeOutBack(p)); sx = 1 + (1 - pe) * 0.5; }
    else if (at === 'riseBlur') { alpha = pe; dy = (1 - pe) * 160 * scale; blur = (1 - pe) * 20; zoom = 0.92 + 0.08 * pe; }
    else if (at === 'glitchIn') {
      const r = mulberry32(Math.floor(info.local * 30) * 977 + 1);
      alpha = p < 1 ? (r() < 0.25 + 0.75 * p ? 1 : 0.15) : 1;
      dx = p < 1 ? (r() - 0.5) * 80 * scale * (1 - p) : 0;
    } else if (at === 'flickerIn') {
      alpha = p < 1 ? clamp(p * 1.2) * (Math.sin(info.local * 60) > -0.2 + 0.8 * (1 - p) ? 1 : 0.1) : 1;
    }
    // animasi keluar tambahan
    if (outP > 0) {
      const oq = outP * outP;
      if (tr === 'slideDown') dy += oq * 120 * scale;
      else if (tr === 'slideLeftOut') dx -= oq * 160 * scale;
      else if (tr === 'slideRightOut') dx += oq * 160 * scale;
      else if (tr === 'shrink') zoom *= 1 - 0.6 * outP;
      else if (tr === 'spinOut') { rot += outP * Math.PI; zoom *= 1 - 0.6 * outP; }
      else if (tr === 'popOut') { zoom *= outP < 0.3 ? 1 + outP * 0.5 : Math.max(0.01, 1.15 * (1 - (outP - 0.3) / 0.7)); outAlpha = outP < 0.3 ? 1 : 1 - (outP - 0.3) / 0.7; }
      else if (tr === 'flipOut') { sx *= Math.max(0.001, 1 - outP); }
      else if (tr === 'dropOut') { dy += oq * 400 * scale; rot += oq * 0.4; }
      else if (tr === 'glitchOut') {
        const r = mulberry32(Math.floor(info.local * 30) * 389 + 2);
        outAlpha = r() < 1 - outP * 0.8 ? 1 - outP * 0.5 : 0.05; dx += (r() - 0.5) * 90 * scale * outP;
      } else if (tr === 'flickerOut') outAlpha = (1 - outP) * (Math.sin(info.local * 60) > -0.2 + 0.8 * outP ? 1 : 0.1);
    }
    if (an.type === 'fade') alpha = pe;
    if (an.type === 'charWave' || an.type === 'charBounce' || an.type === 'charFlicker') alpha = pe;
    if (an.type === 'slideUp') { alpha = pe; dy = (1 - pe) * 90 * scale; }
    if (an.type === 'zoom') { alpha = pe; zoom = 0.85 + 0.15 * pe; }
    if (an.type === 'blur') { alpha = pe; blur = (1 - pe) * 18; }
    if (an.type === 'pop') { alpha = clamp(p * 3); zoom = 0.6 + 0.4 * easeOutBack(p); }
    if (an.type === 'slideLeft') { alpha = pe; dx = -(1 - pe) * 140 * scale; }
    if (an.type === 'karaoke') alpha = clamp(info.local / 0.3);
    if (tr === 'slideUp') dy -= outP * outP * 90 * scale;
    if (tr === 'zoomOut') zoom *= 1 + 0.2 * outP;
    if (tr === 'blur') blur += outP * 18;
    if (st.float) dy += Math.sin(info.local * 1.6) * 8 * scale;

    const centerY = H * (info.pos ? clamp(+info.pos.y, 0, 1) : st.posY);
    const tS = info.pos && info.pos.s != null ? +info.pos.s : 1, tR = info.pos ? +info.pos.r || 0 : 0;
    if (info.pos && info.pos.o != null) outAlpha *= clamp(+info.pos.o);
    const blockTop = centerY - (blockH + emojiH) / 2 + dy;
    const top = blockTop + emojiH;
    // kotak teks (untuk ditarik di preview)
    if (info.box) {
      let wd = Math.max(0, ...lines.map((l) => ctx.measureText(l.map((x) => x.w).join(' ')).width));
      if (author) wd = Math.max(wd, ctx.measureText('— ' + author).width * 0.5);
      if (emoji) wd = Math.max(wd, emojiSize);
      wd = Math.max(wd, size);
      const cx = (st.align === 'left' ? (W - maxW) / 2 + wd / 2 : st.align === 'right' ? (W + maxW) / 2 - wd / 2 : W / 2) + offX;
      const y0 = blockTop - dy;
      Object.assign(info.box, { x0: cx - wd / 2, x1: cx + wd / 2, y0, y1: y0 + Math.max(blockH + emojiH, size) });
      if (tS !== 1) { // kotak ikut skala (terhadap titik tengah teks)
        const b = info.box, my = centerY;
        Object.assign(b, { x0: cx - (cx - b.x0) * tS, x1: cx + (b.x1 - cx) * tS, y0: my - (my - b.y0) * tS, y1: my + (b.y1 - my) * tS });
      }
    }
    if (tS !== 1 || tR) {
      ctx.translate(W / 2, centerY);
      if (tR) ctx.rotate((tR * Math.PI) / 180);
      if (tS !== 1) ctx.scale(tS, tS);
      ctx.translate(-W / 2, -centerY);
    }

    ctx.globalAlpha = outAlpha;
    if (dx) ctx.translate(dx, 0);
    if (zoom !== 1 || rot || sx !== 1 || sy !== 1) {
      ctx.translate(W / 2, centerY);
      if (rot) ctx.rotate(rot);
      ctx.scale(zoom * sx, zoom * sy);
      ctx.translate(-W / 2, -centerY);
    }
    // Blur teks dibuat dengan bayangan (shadowBlur) yang hanya mengenai area huruf;
    // ctx.filter memblur seluruh kanvas per kata dan sangat lambat.
    const blurPx = blur > 0.3 ? blur * scale : 0;

    // emoji / stiker di atas teks
    if (emoji) {
      ctx.save();
      ctx.globalAlpha = outAlpha * clamp(p * 2);
      ctx.font = `${emojiSize}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
      setLetterSpacing(0);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const ex = st.align === 'left' ? (W - maxW) / 2 + emojiSize / 2 : st.align === 'right' ? (W + maxW) / 2 - emojiSize / 2 : W / 2;
      const ey = blockTop + emojiSize * 0.6 + Math.sin(info.local * 2) * 6 * scale;
      const es = 0.4 + 0.6 * easeOutBack(p);
      ctx.translate(ex, ey);
      ctx.scale(es, es);
      ctx.fillStyle = '#000'; // pekat (lihat drawSticker)
      ctx.fillText(emoji, 0, 0);
      ctx.restore();
    }

    // tanda kutip besar dekoratif
    if (state.effects.quoteMark && text.trim() && lines.length) {
      const qs = size * 2.6;
      const lw0 = ctx.measureText(lines[0].map((x) => x.w).join(' ')).width;
      const qx = st.align === 'left' ? (W - maxW) / 2 : st.align === 'right' ? (W + maxW) / 2 - lw0 : (W - lw0) / 2;
      ctx.save();
      ctx.globalAlpha = outAlpha * alpha * 0.35;
      ctx.font = `700 ${qs}px "Playfair Display", serif`;
      setLetterSpacing(0);
      ctx.fillStyle = st.highlightColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('“', qx - qs * 0.5, top + qs * 0.5);
      ctx.restore();
    }

    // kotak belakang
    if (st.boxBg && text.trim()) {
      let widest = Math.max(0, ...lines.map((l) => ctx.measureText(l.map((x) => x.w).join(' ')).width));
      if (author) {
        ctx.font = `italic 400 ${authorSize}px "${st.font}", sans-serif`;
        widest = Math.max(widest, ctx.measureText('— ' + author).width);
        ctx.font = fontStr;
      }
      const pad = size * 0.6;
      const bw = widest + pad * 2;
      const bx = st.align === 'left' ? (W - maxW) / 2 - pad : st.align === 'right' ? (W + maxW) / 2 - widest - pad : (W - bw) / 2;
      ctx.save();
      ctx.globalAlpha = outAlpha * alpha;
      ctx.fillStyle = hexToRgba(st.boxColor, st.boxOpacity);
      roundRect(bx, top - pad * 0.7, bw, blockH + pad * 1.4, size * 0.35);
      ctx.fill();
      ctx.restore();
    }

    const applyShadow = (color) => {
      if (st.glow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 28 * scale;
        ctx.shadowOffsetY = 0;
      } else if (st.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 18 * scale;
        ctx.shadowOffsetY = 4 * scale;
      }
    };

    // ---- teks utama, digambar per kata agar bisa dianimasikan ----
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = st.strokeColor;
    ctx.lineWidth = (+st.strokeWidth || 0) * scale;
    const spaceW = ctx.measureText(' ').width;
    let textGrad = null;
    if (st.textGradient) {
      textGrad = ctx.createLinearGradient(0, top, 0, top + lines.length * lh);
      textGrad.addColorStop(0, st.color);
      textGrad.addColorStop(1, st.color2);
    }
    const charsVisible = an.type === 'typewriter' ? Math.floor(p * totalChars) : Infinity;
    let charCount = 0, wordIdx = 0;

    lines.forEach((words, li) => {
      const lineW = ctx.measureText(words.map((x) => x.w).join(' ')).width;
      let x = st.align === 'left' ? (W - maxW) / 2 : st.align === 'right' ? (W + maxW) / 2 - lineW : (W - lineW) / 2;
      const y = top + li * lh + lh / 2;
      words.forEach((tk) => {
        let a = alpha, wy = y, str = tk.w;
        const hlMode = tk.hl && an.type !== 'karaoke' ? st.hlStyle || 'color' : '';
        let color = hlMode === 'marker' ? (isLight(st.highlightColor) ? '#141414' : '#ffffff') : tk.hl ? st.highlightColor : st.color;
        if (an.type === 'karaoke') {
          const lit = p * totalWords - wordIdx;
          a = alpha * (lit >= 0 ? 1 : 0.3);
          if (lit >= 0) color = st.highlightColor;
          if (lit >= 0 && lit < 1) wy = y - Math.sin(lit * Math.PI) * 12 * scale;
        }
        if (an.type === 'typewriter') {
          const remain = charsVisible - charCount;
          str = remain <= 0 ? '' : tk.w.slice(0, remain);
        }
        if (an.type === 'word') {
          const wp = easeOut(clamp(p * totalWords - wordIdx));
          a = wp;
          wy = y + (1 - wp) * 30 * scale;
        }
        if (str && a > 0 && ['charPop', 'charRise', 'charWave', 'charBounce', 'charFlicker'].includes(an.type)) {
          // animasi per huruf: tiap huruf digambar sendiri
          let cx = x;
          for (let ci = 0; ci < str.length; ci++) {
            const ch = str[ci], gi = charCount + ci, cw = ctx.measureText(ch).width;
            let ca = a, cy = wy, cs = 1;
            if (an.type === 'charPop') { const k = clamp((p * (totalChars + 3) - gi) / 3); ca = a * clamp(k * 2); cs = Math.max(0.01, easeOutBack(k)); }
            else if (an.type === 'charRise') { const k = easeOut(clamp((p * (totalChars + 4) - gi) / 4)); ca = a * k; cy = wy + (1 - k) * size * 0.8; }
            else if (an.type === 'charWave') cy = wy - Math.sin(info.local * 6 - gi * 0.55) * size * 0.14;
            else if (an.type === 'charBounce') cy = wy - Math.abs(Math.sin(info.local * 4.5 - gi * 0.35)) * size * 0.22;
            else if (an.type === 'charFlicker') ca = a * (Math.sin(info.local * 17 + gi * 2.7) > -0.2 ? 1 : 0.25);
            if (ca > 0.001 && ch !== ' ') {
              ctx.save();
              ctx.globalAlpha = outAlpha * ca;
              ctx.translate(cx + cw / 2, cy); if (cs !== 1) ctx.scale(cs, cs); ctx.translate(-(cx + cw / 2), -cy);
              applyShadow(color);
              if (st.stroke && ctx.lineWidth > 0) { ctx.strokeText(ch, cx, cy); ctx.shadowColor = 'transparent'; }
              ctx.fillStyle = textGrad && color === st.color ? textGrad : color;
              ctx.fillText(ch, cx, cy);
              ctx.restore();
            }
            cx += cw;
          }
        } else if (str && a > 0 && blurPx) {
          // teks digambar di luar kanvas, hanya bayangan blur-nya yang tampil
          ctx.globalAlpha = outAlpha * a;
          const OFF = W * 3;
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = blurPx * 2;
          ctx.shadowOffsetX = OFF * ctx.getTransform().a;
          ctx.shadowOffsetY = 0;
          ctx.fillStyle = '#000';
          ctx.fillText(str, x - OFF, wy);
          ctx.restore();
        } else if (str && a > 0) {
          ctx.globalAlpha = outAlpha * a;
          const strW = ctx.measureText(str).width;
          if (hlMode === 'marker') {
            // efek stabilo di belakang kata
            ctx.save();
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = st.highlightColor;
            const px = spaceW * 0.55;
            roundRect(x - px, wy - size * 0.52, strW + px * 2, size * 1.04, size * 0.12);
            ctx.fill();
            ctx.restore();
          }
          applyShadow(color);
          if (st.stroke && ctx.lineWidth > 0) {
            ctx.strokeText(str, x, wy);
            ctx.shadowColor = 'transparent';
          }
          ctx.fillStyle = textGrad && color === st.color ? textGrad : color;
          ctx.fillText(str, x, wy);
          if (hlMode === 'underline') {
            ctx.save();
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = st.highlightColor;
            ctx.fillRect(x, wy + size * 0.45, strW, Math.max(3, size * 0.08));
            ctx.restore();
          }
        }
        x += ctx.measureText(tk.w).width + spaceW;
        charCount += tk.w.length + 1;
        wordIdx++;
      });
    });

    // ---- penulis ----
    if (author) {
      const authorP = an.type === 'typewriter' || an.type === 'word' ? clamp((info.local - inDur) / 0.5) : pe;
      ctx.globalAlpha = outAlpha * easeOut(authorP);
      ctx.font = `italic 400 ${authorSize}px "${st.font}", sans-serif`;
      setLetterSpacing(0);
      applyShadow(st.authorColor);
      ctx.fillStyle = st.authorColor;
      const s = '— ' + author;
      const aw = ctx.measureText(s).width;
      const ax = st.align === 'left' ? (W - maxW) / 2 : st.align === 'right' ? (W + maxW) / 2 - aw : (W - aw) / 2;
      ctx.fillText(s, ax, top + lines.length * lh + authorGap + authorSize / 2);
    }
    ctx.restore();
  }

  // Subtitle (teks otomatis) yang sedang aktif, dengan efek karaoke per kata
  // ---------- Subtitle: template, efek masuk/keluar, mode sorot kata ----------
  // [kunci, nama, pengaturan]
  const CAP_TEMPLATES = [
    ['klasik', 'Klasik kotak', { style: 'box', font: '', weight: 800, italic: false, upper: false, color: '#ffffff', hl: '#ffd166', boxColor: '#000000', boxOpacity: 0.62, anim: 'pop', animOut: 'none', hlMode: 'color', glow: false, karaoke: true, maxWords: 6, size: 56, spacing: 0, rot: 0 }],
    ['tiktok', 'TikTok tebal', { style: 'outline', font: 'Montserrat', weight: 800, italic: false, upper: true, color: '#ffffff', hl: '#ffe14d', strokeColor: '#000000', strokeW: 0.22, anim: 'pop', animOut: 'none', hlMode: 'scale', glow: false, karaoke: true, maxWords: 3, size: 70, spacing: 0, rot: 0 }],
    ['hormozi', 'Kata per kata', { style: 'stroke3d', font: 'Montserrat', weight: 800, italic: false, upper: true, color: '#ffffff', hl: '#3dff6e', strokeColor: '#000000', strokeW: 0.16, anim: 'wordByWord', animOut: 'none', hlMode: 'color', glow: false, karaoke: true, maxWords: 4, size: 74, spacing: 0, rot: 0 }],
    ['sorot', 'Sorot kotak', { style: 'shadow', font: 'Poppins', weight: 800, italic: false, upper: false, color: '#ffffff', hl: '#ff3d7f', anim: 'slideUp', animOut: 'fade', hlMode: 'box', glow: false, karaoke: true, maxWords: 5, size: 60, spacing: 0, rot: 0 }],
    ['kapsul', 'Kapsul putih', { style: 'pill', font: 'Poppins', weight: 800, italic: false, upper: false, color: '#111111', hl: '#e5007d', boxColor: '#ffffff', boxOpacity: 0.95, anim: 'zoom', animOut: 'fade', hlMode: 'color', glow: false, karaoke: true, maxWords: 5, size: 54, spacing: 0, rot: 0 }],
    ['neon', 'Neon', { style: 'neon', font: 'Poppins', weight: 800, italic: false, upper: true, color: '#ffffff', hl: '#00f0ff', anim: 'fade', animOut: 'fade', hlMode: 'progressive', glow: true, karaoke: true, maxWords: 4, size: 62, spacing: 2, rot: 0 }],
    ['ketik', 'Mesin ketik', { style: 'box', font: 'Montserrat', weight: 600, italic: false, upper: false, color: '#ffffff', hl: '#ffd166', boxColor: '#000000', boxOpacity: 0.75, anim: 'typewriter', animOut: 'none', hlMode: 'none', glow: false, karaoke: false, maxWords: 8, size: 50, spacing: 0, rot: 0 }],
    ['karaoke', 'Karaoke lagu', { style: 'outline', font: 'Poppins', weight: 800, italic: false, upper: false, color: '#ffffff', hl: '#ffb000', strokeColor: '#1a0a33', strokeW: 0.2, anim: 'fade', animOut: 'fade', hlMode: 'progressive', glow: false, karaoke: true, maxWords: 7, size: 58, spacing: 0, rot: 0 }],
    ['bioskop', 'Bioskop', { style: 'shadow', font: 'Lora', weight: 600, italic: true, upper: false, color: '#fff6dc', hl: '#ffd166', anim: 'fade', animOut: 'fade', hlMode: 'none', glow: false, karaoke: false, maxWords: 9, size: 48, spacing: 0, rot: 0 }],
    ['bebas', 'Judul besar', { style: 'stroke3d', font: 'Bebas Neue', weight: 400, italic: false, upper: true, color: '#ffffff', hl: '#ff4d4d', strokeColor: '#000000', strokeW: 0.12, anim: 'bounce', animOut: 'none', hlMode: 'color', glow: false, karaoke: true, maxWords: 3, size: 96, spacing: 2, rot: 0 }],
    ['garis', 'Garis bawah', { style: 'shadow', font: 'Montserrat', weight: 800, italic: false, upper: false, color: '#ffffff', hl: '#ffd166', anim: 'slideUp', animOut: 'none', hlMode: 'underline', glow: false, karaoke: true, maxWords: 5, size: 58, spacing: 0, rot: 0 }],
    ['santai', 'Tulisan tangan', { style: 'shadow', font: 'Caveat', weight: 700, italic: false, upper: false, color: '#ffffff', hl: '#ffd6e8', anim: 'fade', animOut: 'fade', hlMode: 'color', glow: false, karaoke: true, maxWords: 6, size: 72, spacing: 0, rot: -3 }],
    ['meme', 'Meme', { style: 'outline', font: 'Bebas Neue', weight: 400, italic: false, upper: true, color: '#ffffff', hl: '#ffffff', strokeColor: '#000000', strokeW: 0.28, anim: 'none', animOut: 'none', hlMode: 'none', glow: false, karaoke: false, maxWords: 8, size: 84, spacing: 1, rot: 0 }],
    ['berita', 'Berita', { style: 'box', font: 'Montserrat', weight: 800, italic: false, upper: true, color: '#ffffff', hl: '#ffe14d', boxColor: '#c4161c', boxOpacity: 0.95, anim: 'slideUp', animOut: 'none', hlMode: 'color', glow: false, karaoke: true, maxWords: 6, size: 48, spacing: 1, rot: 0 }],
    ['lembut', 'Lembut pastel', { style: 'pill', font: 'Poppins', weight: 600, italic: false, upper: false, color: '#5a2a49', hl: '#c2185b', boxColor: '#ffe0ef', boxOpacity: 0.92, anim: 'pop', animOut: 'fade', hlMode: 'color', glow: false, karaoke: true, maxWords: 5, size: 52, spacing: 0, rot: 0 }],
    ['emas', 'Emas mewah', { style: 'shadow', font: 'Playfair Display', weight: 700, italic: false, upper: false, color: '#f5d77a', hl: '#ffffff', anim: 'zoom', animOut: 'fade', hlMode: 'progressive', glow: true, karaoke: true, maxWords: 6, size: 58, spacing: 1, rot: 0 }],
  ];
  const CAP_ANIMS = [['pop', 'Pop'], ['fade', 'Pudar'], ['slideUp', 'Naik dari bawah'], ['slideDown', 'Turun dari atas'], ['zoom', 'Zoom keluar'], ['bounce', 'Memantul'], ['typewriter', 'Mesin ketik'], ['wordByWord', 'Kata per kata (ikut ucapan)'], ['blur', 'Blur ke tajam'], ['swing', 'Berayun'], ['none', 'Tanpa animasi']];
  const CAP_OUTS = [['none', 'Langsung hilang'], ['fade', 'Pudar'], ['slideDown', 'Turun'], ['zoom', 'Mengecil'], ['blur', 'Blur']];
  const CAP_HL = [['color', 'Warna'], ['scale', 'Membesar + warna'], ['box', 'Kotak di belakang kata'], ['underline', 'Garis bawah'], ['progressive', 'Kata terucap ikut berwarna'], ['none', 'Tanpa sorot']];
  const CAP_STYLES = [['box', 'Kotak'], ['pill', 'Kapsul'], ['outline', 'Garis tepi'], ['shadow', 'Bayangan'], ['stroke3d', 'Tepi tebal 3D'], ['neon', 'Neon'], ['none', 'Polos']];
  const lumOf = (hex) => { const n = parseInt(String(hex || '#000').slice(1, 7), 16) || 0; return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

  // kata + tanda sorotan dari teks "*kata*" (bintang tidak ditampilkan)
  function capWords(text) {
    let on = false;
    return text.split(/\s+/).filter(Boolean).map((raw) => {
      let w = raw, mark = on;
      if (w.startsWith('*')) { mark = true; w = w.slice(1); }
      const ends = w.endsWith('*');
      if (ends) w = w.slice(0, -1);
      on = mark && !ends;
      return { w: w || raw, mark };
    });
  }
  function drawCaptions(t) {
    const c = state.captions;
    if (!c || !c.show || !c.items.length) return;
    t -= +c.offset || 0; // geser waktu subtitle (koreksi manual)
    const seg = c.items.find((s) => t >= s.start && t < s.end);
    if (!seg || !String(seg.text || '').trim()) return;
    drawCaptionSeg(seg, t, c);
  }
  // juga dipakai pratinjau template (g = konteks lain, opsional)
  function drawCaptionSeg(seg, t, c, g = ctx, Wc = canvas.width, Hc = canvas.height) {
    const W = Wc, H = Hc, sc = W / 1080;
    const size = (+c.size || 56) * sc;
    let text = String(seg.text).trim();
    if (c.upper) text = text.toUpperCase();
    const wordsAll = capWords(text);
    const words = wordsAll.map((x) => x.w);
    const dur = Math.max(0.05, seg.end - seg.start), local = t - seg.start;
    const anim = c.anim || 'pop', out = c.animOut || 'none';

    // kata yang sedang diucapkan: waktu per kata dari AI bila ada, kalau tidak diperkirakan
    let current = words.length - 1;
    if (seg.words && seg.words.length === words.length) {
      current = 0;
      seg.words.forEach((w, i) => { if (t >= w.s - 0.03) current = i; });
    } else {
      const p = clamp(local / (dur * 0.92));
      const total = words.reduce((a, w) => a + w.length + 1, 0);
      let acc = 0;
      for (let i = 0; i < words.length; i++) { acc += words[i].length + 1; if (acc / total > p) { current = i; break; } }
      if (p >= 1) current = words.length - 1;
    }

    g.save();
    const fam = c.font || state.style.font;
    g.font = `${c.italic ? 'italic ' : ''}${+c.weight || 800} ${size}px "${fam}", sans-serif`;
    const sp = (+c.spacing || 0) * sc;
    try { g.letterSpacing = `${sp}px`; } catch (_) { /* browser lama */ }
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    const maxW = W * clamp(+c.width || 0.84, 0.3, 0.98);
    const lines = [];
    let line = [];
    words.forEach((w, i) => {
      const test = [...line.map((x) => x.w), w].join(' ');
      if (line.length && g.measureText(test).width > maxW) { lines.push(line); line = []; }
      line.push({ w, i, mark: wordsAll[i].mark });
    });
    if (line.length) lines.push(line);

    // ---- efek masuk & keluar ----
    const aIn = anim === 'none' || anim === 'typewriter' || anim === 'wordByWord' ? 1 : clamp(local / (anim === 'fade' || anim === 'blur' ? 0.25 : 0.3));
    const outDur = 0.22, aOut = out === 'none' ? 1 : clamp((seg.end - t) / outDur);
    let alpha = 1, scl = 1, dy = 0, blur = 0, rot = (+c.rot || 0) * Math.PI / 180;
    const eIn = easeOutCubic(aIn);
    if (anim === 'pop') { scl = 0.82 + 0.18 * easeOutBack(aIn); alpha = clamp(aIn * 1.6); }
    else if (anim === 'fade') alpha = aIn;
    else if (anim === 'slideUp') { dy = (1 - eIn) * size * 0.9; alpha = aIn; }
    else if (anim === 'slideDown') { dy = -(1 - eIn) * size * 0.9; alpha = aIn; }
    else if (anim === 'zoom') { scl = 1.45 - 0.45 * eIn; alpha = aIn; }
    else if (anim === 'bounce') { dy = -(1 - easeOutBounce(aIn)) * size * 1.4; alpha = clamp(aIn * 3); }
    else if (anim === 'blur') { blur = (1 - eIn) * 14 * sc; alpha = aIn; }
    else if (anim === 'swing') { rot += (1 - easeOutBack(aIn)) * 0.35; alpha = clamp(aIn * 2); }
    if (aOut < 1) {
      const eo = 1 - aOut;
      alpha *= aOut;
      if (out === 'slideDown') dy += eo * size * 0.8;
      else if (out === 'zoom') scl *= 1 - 0.3 * eo;
      else if (out === 'blur') blur += eo * 12 * sc;
    }
    // mesin ketik: huruf muncul satu per satu (± 18 huruf/detik, selesai paling lambat di 70% durasi)
    const totalChars = words.join(' ').length;
    const shownChars = anim === 'typewriter' ? Math.floor(totalChars * clamp(local / Math.min(dur * 0.7, totalChars / 18))) : Infinity;

    const lh = size * 1.25;
    const cy = H * c.y;
    const top = cy - (lines.length * lh) / 2 + dy;
    g.translate(W / 2, cy);
    if (rot) g.rotate(rot);
    if (scl !== 1) g.scale(scl, scl);
    g.translate(-W / 2, -cy);
    g.globalAlpha = clamp(alpha);
    if (blur > 0.3) g.filter = `blur(${blur.toFixed(1)}px)`;
    const spaceW = g.measureText(' ').width;
    const hlOn = c.karaoke && c.hlMode !== 'none';
    const style = c.style || 'box';
    const boxRGBA = hexToRgba(c.boxColor || '#000000', c.boxOpacity == null ? 0.62 : +c.boxOpacity);
    let charIdx = 0;

    lines.forEach((ln, li) => {
      // kata yang tampil pada baris ini (kata per kata / mesin ketik)
      const vis = ln.map((x) => {
        const start = charIdx; charIdx += x.w.length + 1;
        if (anim === 'wordByWord' && x.i > current) return null;
        if (shownChars !== Infinity) { const n = clamp(shownChars - start, 0, x.w.length); return n > 0 ? { ...x, txt: x.w.slice(0, n) } : null; }
        return { ...x, txt: x.w };
      });
      const full = g.measureText(ln.map((x) => x.w).join(' ')).width; // posisi tetap walau kata belum muncul
      let x = (W - full) / 2;
      const y = top + li * lh + lh / 2;
      if ((style === 'box' || style === 'pill') && vis.some(Boolean)) {
        // kotak selebar kata yang sudah tampil
        const shown = vis.filter(Boolean);
        const wShown = g.measureText(shown.map((v) => v.txt).join(' ')).width;
        const bx = anim === 'wordByWord' || anim === 'typewriter' ? x : x;
        const bw = anim === 'wordByWord' || anim === 'typewriter' ? wShown : full;
        g.save();
        g.filter = 'none';
        g.fillStyle = boxRGBA;
        const padX = size * (style === 'pill' ? 0.5 : 0.35);
        roundRectOn(g, bx - padX, y - lh / 2 + 2 * sc, bw + padX * 2, lh - 4 * sc, style === 'pill' ? (lh - 4 * sc) / 2 : size * 0.22);
        g.fill();
        g.restore();
      }
      ln.forEach(({ w, i, mark }, k) => {
        const v = vis[k];
        const ww = g.measureText(w).width;
        if (v) {
          const lit = hlOn && (c.hlMode === 'progressive' ? i <= current : i === current);
          const col = mark ? c.hl : lit && c.hlMode !== 'box' && c.hlMode !== 'underline' ? c.hl : c.color;
          g.save();
          if (lit && c.hlMode === 'box') { // kotak warna di belakang kata aktif
            g.save(); g.filter = 'none';
            g.fillStyle = c.hl;
            roundRectOn(g, x - size * 0.14, y - size * 0.62, ww + size * 0.28, size * 1.24, size * 0.2);
            g.fill(); g.restore();
          }
          if (lit && (c.hlMode === 'scale' || c.hlMode === 'color')) {
            const k2 = c.hlMode === 'scale' ? 1.16 : 1.04;
            g.translate(x + ww / 2, y); g.scale(k2, k2); g.translate(-(x + ww / 2), -y);
          }
          const fill = lit && c.hlMode === 'box' ? (lumOf(c.hl) > 0.6 ? '#111111' : '#ffffff') : col;
          if (style === 'outline' || style === 'stroke3d' || style === 'neon') {
            g.lineJoin = 'round';
            if (style === 'stroke3d') { // tepi tebal + bayangan padat ke bawah
              g.fillStyle = c.strokeColor || '#000';
              for (let d = 1; d <= 6; d++) g.fillText(v.txt, x + d * sc * 0.8, y + d * sc * 1.2);
            }
            g.lineWidth = size * (style === 'neon' ? 0.06 : (+c.strokeW || 0.18));
            g.strokeStyle = style === 'neon' ? (lit ? c.hl : c.color) : (c.strokeColor || '#000');
            if (style === 'neon') { g.shadowColor = c.hl; g.shadowBlur = 24 * sc; }
            g.strokeText(v.txt, x, y);
          }
          if (style === 'shadow') { g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 14 * sc; g.shadowOffsetY = 3 * sc; }
          if (c.glow || style === 'neon') { g.shadowColor = lit || mark ? c.hl : (style === 'neon' ? c.hl : c.color); g.shadowBlur = (style === 'neon' ? 30 : 20) * sc; g.shadowOffsetY = 0; }
          g.fillStyle = style === 'neon' && !lit ? '#ffffff' : fill;
          g.fillText(v.txt, x, y);
          if (lit && c.hlMode === 'underline') {
            g.shadowBlur = 0;
            g.fillStyle = c.hl;
            const uw = g.measureText(v.txt).width;
            roundRectOn(g, x, y + size * 0.52, uw, Math.max(3, size * 0.1), size * 0.05);
            g.fill();
          }
          g.restore();
        }
        x += ww + spaceW;
      });
    });
    g.restore();
  }
  function roundRectOn(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // Judul tetap di atas (tampil di semua scene)
  function drawHeader(t) {
    const h = state.header;
    const txt = ((h && h.text) || '').trim();
    if (!txt) return;
    const W = canvas.width, H = canvas.height, sc = W / 1080;
    const st = state.style;
    const size = h.size * sc;
    const y = H * h.y;
    ctx.save();
    ctx.globalAlpha = state.effects.fadeBlack ? 1 : clamp(t / 0.6);
    ctx.font = `700 ${size}px "${st.font}", sans-serif`;
    setLetterSpacing(sc);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(txt).width;
    if (h.style === 'pill') {
      const padX = size * 0.8, ph = size * 1.8;
      ctx.fillStyle = st.highlightColor;
      roundRect(W / 2 - tw / 2 - padX, y - ph / 2, tw + padX * 2, ph, ph / 2);
      ctx.fill();
      ctx.fillStyle = isLight(st.highlightColor) ? '#141414' : '#ffffff';
    } else {
      ctx.fillStyle = h.color;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10 * sc;
      if (h.style === 'line') {
        const gap = size * 0.6, L = size * 2.2;
        ctx.fillRect(W / 2 - tw / 2 - gap - L, y - 1.5 * sc, L, 3 * sc);
        ctx.fillRect(W / 2 + tw / 2 + gap, y - 1.5 * sc, L, 3 * sc);
      }
    }
    ctx.fillText(txt, W / 2, y);
    ctx.restore();
  }

  function drawWatermark() {
    const wm = (state.watermark || '').trim();
    if (!wm) return;
    const W = canvas.width, H = canvas.height;
    const size = 30 * (W / 1080);
    ctx.save();
    ctx.font = `600 ${size}px "Poppins", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.fillText(wm, W / 2, H - size * 2);
    ctx.restore();
  }

  function render(t) {
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // kanvas selalu berwarna dasar (bukan transparan): klip yang memudar / mask berujung halus tetap benar di hasil export
    ctx.fillStyle = state.bg.type === 'media' ? (state.bg.color || '#000000') : '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const info = sceneAt(t);
    drawBackground(t, info);
    drawParticles(t);
    drawVignette();
    drawVisualizer(t);
    if (!state.tracks.textHide) { if (freeMode()) drawFreeTexts(t); else drawText(info); }
    drawHeader(t);
    drawCaptions(t);
    drawGrain();
    drawFrame();
    drawLogo();
    drawWatermark();
    drawProgressBar(t);
    drawFadeBlack(t);
    if (ui.guides && !player.exporting && !ui.capturing) drawGuides();
  }

  // ---------- Teks bebas & stiker (lapisan) ----------
  const isSticker = (l) => l && (l.kind === 'sticker' || l.kind === 'overlay'); // lapisan non-teks
  const isOverlay = (l) => l && l.kind === 'overlay';
  const stickerCount = () => { const nS = state.texts.filter((x) => x.kind === 'sticker').length, nO = state.texts.filter(isOverlay).length; return `${nS ? ` • ${nS} stiker` : ''}${nO ? ` • ${nO} overlay` : ''}`; };
  const ovAudible = (l) => l.media === 'video' && l.sound !== false && +(l.vol == null ? 1 : l.vol) > 0;
  function ovTime(l, lt, d) {
    const x = (+l.in || 0) + lt;
    return l.loop === false ? Math.min(x, Math.max(0, d - 0.05)) : ((x % d) + d) % d;
  }
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  // nilai dasar lapisan: posisi x/y (0..1), s = skala, r = putar (derajat), o = transparansi
  const baseProps = (l) => ({
    x: l.x == null ? 0.5 : +l.x, y: l.y == null ? (isSticker(l) ? 0.35 : +state.style.posY) : +l.y,
    s: l.s == null ? 1 : +l.s, r: +l.r || 0, o: l.o == null ? 1 : +l.o,
  });
  const PROPS = ['x', 'y', 's', 'r', 'o'];
  // posisi/skala/putar/transparansi pada detik lt (relatif awal lapisan), dengan keyframe
  function layerProps(l, lt) {
    const ks = l.keys && l.keys.length ? [...l.keys].sort((a, b) => a.t - b.t) : null;
    if (!ks) return baseProps(l);
    const pick = (k) => ({ x: +k.x, y: +k.y, s: +k.s, r: +k.r, o: +k.o });
    if (lt <= ks[0].t) return pick(ks[0]);
    const last = ks[ks.length - 1];
    if (lt >= last.t) return pick(last);
    let i = 0;
    while (i < ks.length - 2 && ks[i + 1].t <= lt) i++;
    const a = ks[i], b = ks[i + 1], f = easeInOut((lt - a.t) / Math.max(1e-6, b.t - a.t));
    const out = {};
    PROPS.forEach((k) => { out[k] = +a[k] + (+b[k] - +a[k]) * f; });
    return out;
  }
  const layerLocal = (l) => player.t - Math.max(0, +l.start || 0);
  // ubah posisi/skala/dll: tanpa keyframe → nilai dasar; dengan keyframe → keyframe di playhead (dibuat bila belum ada)
  function editLayer(l, patch) {
    if (l.keys && l.keys.length) {
      const lt = r1Fine(clamp(layerLocal(l), 0, textRange(l)[1] - textRange(l)[0]));
      const cur = layerProps(l, lt);
      upsertKey(l, lt, { ...cur, ...patch });
    } else Object.assign(l, patch);
  }
  const r1Fine = (v) => Math.round(v * 100) / 100;
  function upsertKey(l, lt, props) {
    l.keys = l.keys || [];
    const k = l.keys.find((q) => Math.abs(q.t - lt) < 0.06);
    const vals = {};
    PROPS.forEach((p) => { vals[p] = +(+props[p]).toFixed(4); });
    if (k) Object.assign(k, vals); else l.keys.push({ t: lt, ...vals });
    l.keys.sort((a, b) => a.t - b.t);
  }
  const textById = (id) => state.texts.find((x) => x.id === id);
  const textRange = (tx) => { const a = Math.max(0, +tx.start || 0); return [a, Math.max(a + 0.3, +tx.end || 0)]; };
  function drawFreeTexts(t) {
    ui.textBoxes = [];
    for (const l of state.texts) {
      const [a, b] = textRange(l);
      if (t < a || t >= b) continue;
      const P = layerProps(l, t - a);
      const box = { id: l.id };
      if (isOverlay(l)) drawOverlay(l, t - a, b - a, P, box);
      else if (isSticker(l)) drawSticker(l, t - a, b - a, P, box);
      else drawText({ index: 0, scene: l, local: t - a, dur: b - a, pos: P, box });
      if (box.x1 != null) ui.textBoxes.push(box);
    }
    // bingkai lapisan yang dipilih (hanya di preview, tidak ikut export)
    if (player.exporting || ui.capturing || player.playing) return;
    const sel = ui.textBoxes.find((b) => b.id === ui.selText);
    if (!sel) return;
    const pad = canvas.width * 0.015;
    ctx.save();
    ctx.strokeStyle = 'rgba(124,92,255,.95)';
    ctx.lineWidth = Math.max(2, canvas.width / 400);
    ctx.setLineDash([canvas.width / 90, canvas.width / 140]);
    ctx.strokeRect(sel.x0 - pad, sel.y0 - pad, sel.x1 - sel.x0 + pad * 2, sel.y1 - sel.y0 + pad * 2);
    ctx.restore();
  }

  const STICKER_ANIMS = [['pop', 'Muncul membal'], ['fade', 'Pudar'], ['bounce', 'Memantul'], ['spin', 'Berputar'], ['pulse', 'Berdenyut'], ['swing', 'Berayun'], ['none', 'Tanpa animasi']];
  const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  function stickerAnim(anim, lt, dur, sc) {
    const pin = clamp(lt / 0.45), pout = clamp((dur - lt) / 0.3);
    let a = 1, z = 1, rot = 0, dy = 0;
    if (anim === 'pop') { z = 0.3 + 0.7 * easeOutBack(pin); a = clamp(pin * 3); }
    else if (anim === 'fade') a = pin;
    else if (anim === 'bounce') { dy = -Math.abs(Math.sin(lt * 3.2)) * 40 * sc; a = clamp(pin * 3); }
    else if (anim === 'spin') { rot = lt * 90; a = clamp(pin * 3); }
    else if (anim === 'pulse') { z = 1 + 0.08 * Math.sin(lt * 6); a = clamp(pin * 3); }
    else if (anim === 'swing') { rot = Math.sin(lt * 3) * 14; a = clamp(pin * 3); }
    else if (anim === 'slide') { dy = (1 - easeOut(pin)) * 160 * sc; a = clamp(pin * 2); }
    if (anim !== 'none') a *= pout;
    return { a, z, rot, dy };
  }
  function drawSticker(l, lt, dur, P, box) {
    const W = canvas.width, H = canvas.height, sc = W / 1080;
    const { a, z, rot, dy } = stickerAnim(l.anim || 'pop', lt, dur, sc);
    const cx = P.x * W, cy = P.y * H + dy;
    let w, h, draw;
    if (l.fileId) {
      const e = mediaEls.get(l.fileId);
      if (!e || !e.ready || !e.el.naturalWidth) return;
      w = W * 0.4 * P.s; h = (w * e.el.naturalHeight) / e.el.naturalWidth;
      draw = () => ctx.drawImage(e.el, -w / 2, -h / 2, w, h);
    } else {
      const fs = 200 * sc * P.s;
      w = h = fs * 1.15;
      draw = () => {
        ctx.font = `${fs}px ${EMOJI_FONT}`;
        setLetterSpacing(0);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000'; // warna isi harus pekat: Chrome ikut memakai transparansinya untuk emoji berwarna
        ctx.fillText(l.emoji || '⭐', 0, fs * 0.06);
      };
    }
    ctx.save();
    ctx.globalAlpha = clamp(a * P.o);
    ctx.translate(cx, cy);
    ctx.rotate(((P.r + rot) * Math.PI) / 180);
    ctx.scale(z, z);
    if (l.shadow) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 24 * sc; ctx.shadowOffsetY = 8 * sc; }
    draw();
    ctx.restore();
    Object.assign(box, { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 });
  }

  // ---------- Overlay video/foto (picture-in-picture), chroma key, masking ----------
  const OV_ANIMS = [['none', 'Tanpa animasi'], ['fade', 'Pudar'], ['pop', 'Muncul membal'], ['slide', 'Naik masuk'], ['pulse', 'Berdenyut'], ['swing', 'Berayun'], ['bounce', 'Memantul'], ['spin', 'Berputar']];
  const OV_MASKS = [['none', 'Tanpa (persegi panjang)'], ['rounded', 'Sudut bulat'], ['circle', 'Lingkaran'], ['ellipse', 'Oval'], ['square', 'Persegi'], ['heart', 'Hati'], ['star', 'Bintang'], ['diamond', 'Belah ketupat']];
  const OV_BLENDS = [['source-over', 'Normal'], ['screen', 'Layar (terangkan)'], ['multiply', 'Kalikan (gelapkan)'], ['overlay', 'Overlay'], ['soft-light', 'Cahaya lembut'], ['lighten', 'Lebih terang'], ['darken', 'Lebih gelap'], ['difference', 'Selisih']];
  const OV_DEF = { anim: 'fade', blend: 'source-over', mask: 'none', feather: 0, border: 0, borderColor: '#ffffff', shadow: false, filter: 'none', filterAmt: 100,
    chroma: false, keyColor: '#00ff00', tol: 0.3, soft: 0.12, spill: 0.6, sound: true, vol: 1, in: 0, loop: true, flip: false };
  const ovv = (l, k) => (l[k] == null ? OV_DEF[k] : l[k]);
  const ovBufs = {};
  function ovCanvas(k, w, h) {
    if (!ovBufs[k]) { const c = document.createElement('canvas'); ovBufs[k] = { c, g: c.getContext('2d', { willReadFrequently: k !== 'm' }) }; }
    const b = ovBufs[k];
    if (b.c.width !== w) b.c.width = w;
    if (b.c.height !== h) b.c.height = h;
    return b;
  }
  function maskPath(g, shape, w, h, inset) {
    const cx = w / 2, cy = h / 2, m = Math.max(1, Math.min(w, h) / 2 - inset);
    g.beginPath();
    if (shape === 'circle') g.arc(cx, cy, m, 0, Math.PI * 2);
    else if (shape === 'ellipse') g.ellipse(cx, cy, Math.max(1, w / 2 - inset), Math.max(1, h / 2 - inset), 0, 0, Math.PI * 2);
    else if (shape === 'square') g.rect(cx - m, cy - m, m * 2, m * 2);
    else if (shape === 'rounded') g.roundRect(inset, inset, Math.max(1, w - inset * 2), Math.max(1, h - inset * 2), Math.min(w, h) * 0.12);
    else if (shape === 'diamond') { g.moveTo(cx, cy - m); g.lineTo(cx + m, cy); g.lineTo(cx, cy + m); g.lineTo(cx - m, cy); g.closePath(); }
    else if (shape === 'star') {
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? m * 0.45 : m, an = -Math.PI / 2 + (i * Math.PI) / 5;
        g[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(an), cy + r * Math.sin(an) + m * 0.08);
      }
      g.closePath();
    } else if (shape === 'heart') {
      const s = m / 16.5;
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        g[i ? 'lineTo' : 'moveTo'](cx + x * s, cy - y * s - s);
      }
      g.closePath();
    } else g.rect(inset, inset, Math.max(1, w - inset * 2), Math.max(1, h - inset * 2));
  }
  const hexRgb = (hex) => { const n = parseInt(String(hex || '#00ff00').slice(1), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  // hapus warna kunci (jarak warna di bidang CbCr) + kurangi pantulan warna kunci di tepi
  function chromaKey(g, w, h, l) {
    const img = g.getImageData(0, 0, w, h), p = img.data;
    const [kr, kg, kb] = hexRgb(ovv(l, 'keyColor'));
    const kcb = -0.168736 * kr - 0.331264 * kg + 0.5 * kb, kcr = 0.5 * kr - 0.418688 * kg - 0.081312 * kb;
    const tol = clamp(+ovv(l, 'tol')) * 128, soft = Math.max(1, clamp(+ovv(l, 'soft')) * 128), spill = clamp(+ovv(l, 'spill'));
    const ch = kg >= kr && kg >= kb ? 1 : kb >= kr ? 2 : 0, o1 = (ch + 1) % 3, o2 = (ch + 2) % 3;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i], gg = p[i + 1], b = p[i + 2];
      const dcb = -0.168736 * r - 0.331264 * gg + 0.5 * b - kcb, dcr = 0.5 * r - 0.418688 * gg - 0.081312 * b - kcr;
      const a = (Math.sqrt(dcb * dcb + dcr * dcr) - tol) / soft;
      if (a <= 0) { p[i + 3] = 0; continue; }
      if (a < 1) p[i + 3] = p[i + 3] * a;
      if (spill > 0) {
        const lim = Math.max(p[i + o1], p[i + o2]);
        if (p[i + ch] > lim) p[i + ch] = lim + (p[i + ch] - lim) * (1 - spill);
      }
    }
    g.putImageData(img, 0, 0);
  }
  // gambar sumber + chroma key + mask + bingkai ke kanvas bantu (resolusi diproses dibatasi agar tetap lancar)
  function ovProcess(l, el, w, h) {
    const k = Math.min(1, (player.exporting ? 1080 : 720) / Math.max(w, h));
    const pw = Math.max(2, Math.round(w * k)), ph = Math.max(2, Math.round(h * k));
    const A = ovCanvas('a', pw, ph), g = A.g;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, pw, ph);
    g.drawImage(el, 0, 0, pw, ph);
    if (ovv(l, 'chroma')) chromaKey(g, pw, ph, l);
    const mask = ovv(l, 'mask'), bw = +ovv(l, 'border') * Math.min(pw, ph) / 200;
    if (mask !== 'none' || +ovv(l, 'feather') > 0) {
      const M = ovCanvas('m', pw, ph), f = clamp(+ovv(l, 'feather')) * Math.min(pw, ph) * 0.08;
      M.g.clearRect(0, 0, pw, ph);
      M.g.filter = f > 0.5 ? `blur(${f}px)` : 'none';
      M.g.fillStyle = '#fff';
      maskPath(M.g, mask, pw, ph, f * 1.3);
      M.g.fill();
      M.g.filter = 'none';
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(M.c, 0, 0);
      g.globalCompositeOperation = 'source-over';
    }
    if (bw > 0) {
      g.strokeStyle = ovv(l, 'borderColor');
      g.lineWidth = bw;
      maskPath(g, mask, pw, ph, bw / 2);
      g.stroke();
    }
    return A.c;
  }
  function ovSource(l) {
    const e = mediaEls.get(l.fileId);
    if (!e || !e.ready || !e.el) return null;
    const isV = e.el instanceof HTMLVideoElement;
    const nw = isV ? e.el.videoWidth : e.el.naturalWidth, nh = isV ? e.el.videoHeight : e.el.naturalHeight;
    if (!nw || !nh || (isV && e.el.readyState < 2)) return null;
    return { el: e.el, nw, nh, isV };
  }
  function drawOverlay(l, lt, dur, P, box) {
    const W = canvas.width, H = canvas.height, sc = W / 1080;
    const s = ovSource(l);
    if (!s) return;
    const { a, z, rot, dy } = stickerAnim(ovv(l, 'anim'), lt, dur, sc);
    const w = W * 0.5 * P.s, h = (w * s.nh) / s.nw;
    const cx = P.x * W, cy = P.y * H + dy;
    const processed = ovv(l, 'chroma') || ovv(l, 'mask') !== 'none' || +ovv(l, 'border') > 0 || +ovv(l, 'feather') > 0;
    const src = processed ? ovProcess(l, s.el, w, h) : s.el;
    ctx.save();
    ctx.globalAlpha = clamp(a * P.o);
    ctx.globalCompositeOperation = ovv(l, 'blend');
    ctx.translate(cx, cy);
    ctx.rotate(((P.r + rot) * Math.PI) / 180);
    ctx.scale(z * (ovv(l, 'flip') ? -1 : 1), z);
    const fl = filterCss({ filter: ovv(l, 'filter'), amt: clamp(+ovv(l, 'filterAmt') / 100) });
    if (fl && fl !== 'none') ctx.filter = fl;
    if (ovv(l, 'shadow')) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30 * sc; ctx.shadowOffsetY = 10 * sc; }
    ctx.drawImage(src, -w / 2, -h / 2, w, h);
    ctx.restore();
    Object.assign(box, { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 });
  }
  // warna kunci otomatis: rata-rata piksel di tepi gambar (biasanya layar hijau/biru)
  function autoKeyColor(l) {
    const s = ovSource(l);
    if (!s) return false;
    const N = 48, B = ovCanvas('k', N, N);
    B.g.clearRect(0, 0, N, N);
    B.g.drawImage(s.el, 0, 0, N, N);
    const d = B.g.getImageData(0, 0, N, N).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (x > 2 && x < N - 3 && y > 2 && y < N - 3) continue;
      const i = (y * N + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    const hx = (v) => Math.round(v / n).toString(16).padStart(2, '0');
    l.keyColor = `#${hx(r)}${hx(g)}${hx(b)}`;
    return true;
  }
  // overlay mengisi seluruh layar (cover)
  function ovFill(l) {
    const s = ovSource(l);
    const W = canvas.width, H = canvas.height;
    const ar = s ? s.nw / s.nh : 16 / 9;
    const w = Math.max(W, H * ar);
    editLayer(l, { x: 0.5, y: 0.5, s: +((2 * w) / W).toFixed(3), r: 0 });
  }
  function addOverlayFiles(files) {
    for (const f of [...files].filter((x) => /^(image|video)\//.test(x.type))) {
      const isV = f.type.startsWith('video/');
      const fileId = newId();
      const entry = { el: null, ready: false, missing: false, url: '' };
      mediaEls.set(fileId, entry);
      attachBlob({ id: fileId, kind: isV ? 'video' : 'image' }, entry, f);
      idbPut(fileId, f).catch(() => {});
      const l = addSticker({ kind: 'overlay', fileId, media: isV ? 'video' : 'image', name: f.name, anim: 'fade', x: 0.5, y: 0.5, s: 1 });
      if (isV) {
        entry.el.addEventListener('loadedmetadata', () => {
          const d = entry.el.duration;
          if (!d || !isFinite(d)) return;
          l.end = r1(l.start + d);
          if (state.durFromBg && state.bg.type === 'media') l.end = r1(Math.min(l.end, Math.max(l.start + 0.5, totalDuration())));
          if (l.end > totalDuration()) state.duration = l.end;
          renderTexts(); refresh();
        }, { once: true });
      }
    }
  }

  // =========================================================
  //  PLAYBACK
  // =========================================================
  const player = { playing: false, t: 0, startedAt: 0, raf: 0, exporting: false, onEnd: null };

  function updateTimeUI() {
    const total = totalDuration();
    $('#tlPlayhead').style.left = `calc(8px + (100% - 16px) * ${clamp(player.t / (tl.scale || total || 1))})`;
    const tcs = `<b>${timecode(player.t)}</b> / ${timecode(total)}`;
    if (tcs !== tl.tcLast) { $('#timeLabel').innerHTML = tcs; tl.tcLast = tcs; }
    followPlayhead();
    // slider zoom/geser klip ikut nilai keyframe di posisi playhead
    if (!player.playing && ui.selClip) { const sc = clipById(ui.selClip); if (sc && sc.kf && sc.kf.length) updateClipBar(); }
    const cur = sceneAt(player.t);
    if (freeMode()) {
      $$('#sceneList .scene').forEach((el) => {
        const tx = textById(el.dataset.id);
        const on = tx && player.t >= textRange(tx)[0] && player.t < textRange(tx)[1];
        el.classList.toggle('current', el.dataset.id === ui.selText);
        el.classList.toggle('live', !!on);
      });
      syncLayerCard();
      if (!player.playing && ui.selText && ui.focus === 'text') updateTextBar();
    } else $$('.scene').forEach((el, i) => el.classList.toggle('current', !!cur && cur.index === i));
  }

  function syncMediaTo(t) {
    syncVideos(t, true);
    if (music.src && music.duration) {
      music.currentTime = ((+state.music.start || 0) + t) % music.duration;
    }
    syncVoice(t, true);
    syncAudioTracks(t, true);
  }

  // ---------- Voice-over ----------
  const recState = { mr: null, stream: null };
  const voiceActive = (t) => {
    if (!voice.src || !voice.duration) return false;
    const vt = t - (+state.voice.delay || 0);
    return vt >= 0 && vt < voice.duration;
  };
  // level musik saat ini (ducking saat ada suara, hening saat merekam)
  const DUCK = 0.3;
  function musicLevel(t) {
    if (recState.mr) return 0;
    const vol = state.tracks.musicMute ? 0 : +state.music.volume;
    return state.voice.duck && voiceActive(t) ? vol * DUCK : vol;
  }

  function syncVoice(t, force = false) {
    if (!voice.src || !voice.duration) return;
    const vt = t - (+state.voice.delay || 0);
    const inside = vt >= 0 && vt < voice.duration;
    if (!player.playing || !inside || recState.mr) {
      if (!voice.paused) voice.pause();
      if (inside) voice.currentTime = vt;
      return;
    }
    if (voice.paused) { voice.currentTime = vt; voice.play().catch(() => {}); }
    else if (force) voice.currentTime = vt;
  }

  function play(fromStart = false) {
    if (player.playing) return;
    const total = totalDuration();
    if (fromStart || player.t >= total - 0.05) player.t = 0;
    fadeStarted = false;
    syncMediaTo(player.t);
    if (hasAudio()) {
      ensureAudioGraph();
      audio.ctx.resume();
      audio.vgain.gain.value = voiceVol();
      lastLevel = musicLevel(player.t);
      setGain(lastLevel, 0);
      if (music.src) music.play().catch(() => {});
    } else if (audio.ctx) audio.ctx.resume();
    player.playing = true;
    player.startedAt = performance.now() - player.t * 1000;
    btnPlay.textContent = '❚❚';
    syncVideos(player.t, true);
    loop();
  }

  function pause() {
    player.playing = false;
    cancelAnimationFrame(player.raf);
    for (const e of mediaEls.values()) if (e.el instanceof HTMLVideoElement) e.el.pause();
    music.pause();
    voice.pause();
    for (const e of mediaEls.values()) if (e.el instanceof HTMLAudioElement && !e.el.paused) e.el.pause();
    btnPlay.textContent = '▶';
  }

  let fadeStarted = false;
  let lastLevel = -1;
  function loop() {
    if (!player.playing) return;
    const total = totalDuration();
    player.t = (performance.now() - player.startedAt) / 1000;

    // fade out musik 1.5 detik terakhir
    if (music.src && state.music.fade && audio.gain && !fadeStarted && player.t > total - 1.5) {
      fadeStarted = true;
      setGain(0, Math.max(0.1, total - player.t));
    }
    // ducking musik saat voice-over berbunyi
    if (music.src && audio.gain && !fadeStarted) {
      const lv = musicLevel(player.t);
      if (lv !== lastLevel) { lastLevel = lv; setGain(lv, 0.3); }
    }
    syncVoice(player.t);
    syncVideos(player.t);
    syncAudioTracks(player.t);

    if (player.t >= total) {
      player.t = total;
      render(Math.max(0, total - 0.001));
      updateTimeUI();
      pause();
      fadeStarted = false;
      if (player.onEnd) { const cb = player.onEnd; player.onEnd = null; cb(); }
      return;
    }
    render(player.t);
    updateTimeUI();
    player.raf = requestAnimationFrame(loop);
  }

  function seekTo(t) {
    player.t = clamp(t, 0, totalDuration());
    fadeStarted = false;
    if (player.playing) {
      player.startedAt = performance.now() - player.t * 1000;
      syncMediaTo(player.t);
      if (audio.gain) { lastLevel = musicLevel(player.t); setGain(lastLevel, 0); }
    } else {
      syncMediaTo(player.t);
      render(player.t);
    }
    updateTimeUI();
  }

  // =========================================================
  //  TIMELINE
  // =========================================================
  const tl = { scale: 0, drag: null };

  function blockBg(sc) {
    const o = sc.bg;
    if (o && o[0] === 'g') { const [a, b] = GRADIENTS[+o.slice(1)] || GRADIENTS[0]; return `linear-gradient(135deg, ${a}, ${b})`; }
    if (o && o[0] === '#') return o;
    return '';
  }

  function renderTimeline(scaleTotal) {
    const total = totalDuration();
    const scale = scaleTotal || total || 1;
    tl.scale = scaleTotal || 0;
    const track = $('#tlTrack');
    layoutTimeline();
    let heads = '';
    track.classList.toggle('free', freeMode());
    if (freeMode()) {
      const maxEnd = Math.max(0, ...state.texts.map((x) => textRange(x)[1]), ...segList().map((x) => +x.end));
      if (!scaleTotal && maxEnd > total + 0.05) { tl.scale = maxEnd; return renderTimeline(maxEnd); }
      // lapisan teks: yang bertumpuk waktunya ditaruh di baris berbeda
      const order = state.texts.map((tx, i) => ({ tx, i, r: textRange(tx) })).sort((a, b) => a.r[0] - b.r[0]);
      const laneEnd = [], oEnd = [];
      // overlay di track sendiri (di atas track utama), teks & stiker di track Teks
      order.filter((o) => isOverlay(o.tx)).forEach((o) => {
        let l = oEnd.findIndex((e) => e <= o.r[0] + 1e-6);
        if (l < 0) { l = oEnd.length; oEnd.push(0); }
        oEnd[l] = o.r[1]; o.lane = l; o.ov = true;
      });
      order.filter((o) => !isOverlay(o.tx)).forEach((o) => {
        let l = laneEnd.findIndex((e) => e <= o.r[0] + 1e-6);
        if (l < 0) { l = laneEnd.length; laneEnd.push(0); }
        laneEnd[l] = o.r[1];
        o.lane = l;
      });
      const lanes = Math.max(1, laneEnd.length);
      const showBg = timedSlides() || (state.bg.type === 'media' && state.media.length > 0);
      const LH = lanes > 2 ? 30 : lanes === 2 ? 34 : showBg ? 36 : 44;
      // lapisan efek & filter (baris sendiri di atas, yang bertumpuk turun ke baris berikut)
      const sgs = segList().map((sg) => ({ sg })).sort((x, y) => x.sg.start - y.sg.start);
      const sEnd = [];
      sgs.forEach((o) => { let l = sEnd.findIndex((e) => e <= o.sg.start + 1e-6); if (l < 0) { l = sEnd.length; sEnd.push(0); } sEnd[l] = o.sg.end; o.lane = l; });
      const SH = 24, O = sEnd.length ? sEnd.length * (SH + 2) + 2 : 0;
      const segRow = sgs.map(({ sg, lane }) => `<div class="tl-block tl-seg ${sg.kind === 'fx' ? 'is-fx' : 'is-filter'}${ui.focus === 'seg' && sg.id === ui.selSeg ? ' current' : ''}" data-seg="${esc(sg.id)}" style="left:${(sg.start / scale) * 100}%;width:${((sg.end - sg.start) / scale) * 100}%;top:${lane * (SH + 2)}px;height:${SH}px" title="${sg.kind === 'fx' ? 'Efek' : 'Filter'}: ${esc(segName(sg))} • geser / tarik tepi">
            <div class="tl-handle l" data-side="l"></div><span class="tl-num">${sg.kind === 'fx' ? '✦' : '◑'}</span><span class="tl-label">${esc(segName(sg))}</span><span class="tl-dur">${(sg.end - sg.start).toFixed(1)}s</span><div class="tl-handle" data-side="r"></div></div>`).join('');
      if (O) heads += `<div class="tl-head" style="top:0;height:${O - 4}px" title="Lapisan efek & filter (seluruh layar)"><b>✦</b><span>Efek</span></div>`;
      const OH = 34, OL = oEnd.length ? oEnd.length * OH + 2 : 0, TL = lanes * LH + OL;
      const BH = 42; // track utama (klip latar) lebih tinggi, seperti editor video desktop
      track.style.height = `${O + TL + (showBg ? BH + 4 : 0)}px`;
      // baris latar: tiap media dengan durasinya; tepi kanan bisa ditarik
      let bgRow = '';
      if (showBg) {
        const top = O + TL + 2;
        const cells = [];
        if (timedSlides()) {
          for (let sl = slideAt(0); sl.a < total - 1e-4 && cells.length < 400; sl = slideAt(sl.b + 1e-6)) cells.push(sl);
        } else {
          const it = mediaItem(state.bg.mediaId) || state.media[0];
          cells.push({ id: it.id, a: 0, b: Math.min(total, mediaDur(it)) });
        }
        bgRow = cells.map((sl) => {
          const m = mediaItem(sl.id);
          const b = Math.min(sl.b, total);
          const c = sl.clip;
          const sel = c ? c.id === ui.selClip : m && m.id === ui.selMedia;
          const badges = c ? `${c.freeze ? '<span class="tl-badge">❄</span>' : ''}${c.rev ? '<span class="tl-badge">⏪</span>' : ''}${c.mute ? '<span class="tl-badge" title="Klip dibisukan">🔇</span>' : ''}${c.animIn || c.animOut || c.animCombo ? '<span class="tl-badge" title="Animasi klip">✧</span>' : ''}${c.mask && c.mask !== 'none' ? '<span class="tl-badge" title="Mask">◐</span>' : ''}${c.curve ? `<span class="tl-badge" title="Kurva kecepatan">〰</span>` : +c.speed !== 1 && !c.freeze ? `<span class="tl-badge">${+c.speed}x</span>` : ''}${c.trans !== 'none' && sl.a > 0 ? '<span class="tl-badge">⇢</span>' : ''}${c.adj && Object.values(c.adj).some((v) => +v) ? '<span class="tl-badge" title="Warna diatur">◐</span>' : ''}${(c.crop && Object.values(c.crop).some((v) => +v)) || +c.rot || c.flipH || c.flipV ? '<span class="tl-badge" title="Crop / putar / balik">⌗</span>' : ''}` : '';
          const kfs = c && c.kf && c.kf.length ? c.kf.filter((k) => k.t <= b - sl.a + 1e-6).map((k) => `<i class="tl-kf" style="left:${(k.t / Math.max(0.01, b - sl.a)) * 100}%" title="Keyframe ${(+k.t).toFixed(2)} dtk"></i>`).join('') : '';
          return `<div class="tl-block tl-bgblk${sel ? ' current' : ''}" data-mid="${esc(sl.id)}" data-cid="${c ? esc(c.id) : ''}" style="left:${(sl.a / scale) * 100}%;width:${((b - sl.a) / scale) * 100}%;top:${top}px;height:${BH}px;${thumbStyle(m, c, b - sl.a)}" title="${esc(m ? m.name : '')} • tarik untuk mengubah urutan, tarik tepi untuk trim/durasi">
            ${c ? '<div class="tl-handle l" data-side="cl" title="Tarik untuk memotong awal klip"></div>' : ''}
            <span class="tl-num">${m && m.kind === 'video' ? '🎬' : '🖼'}${c ? sl.j + 1 : ''}</span>${badges}<span class="tl-label">${esc(m ? m.name : '')}</span><span class="tl-dur">${(sl.b - sl.a).toFixed(1)}s</span>${kfs}
            <div class="tl-handle" data-side="${c ? 'cr' : 'm'}" title="Tarik untuk mengubah durasi"></div></div>`;
        }).join('');
      }
      heads += `<div class="tl-head" style="top:${O}px;height:${lanes * LH - 3}px" title="Teks, stiker & overlay"><b>T</b><span>Teks</span>${trackBtns(['textHide', 'textLock'])}</div>`;
      if (OL) heads += `<div class="tl-head" style="top:${O + lanes * LH}px;height:${OL - 4}px" title="Overlay video / foto (picture-in-picture)"><b>▣</b><span>Overlay</span></div>`;
      if (showBg) heads += `<div class="tl-head main" style="top:${O + TL + 2}px;height:${BH}px" title="Track utama: foto & video latar"><b>▶</b><span>Video</span>${trackBtns(['vsound', 'videoLock'])}</div>`;
      // baris audio (di bawah latar)
      const auds = (state.audios || []).map((a, i) => ({ a, i, r: audioRange(a) })).sort((x, y) => x.r[0] - y.r[0]);
      const aEnd = [];
      auds.forEach((o) => { let l = aEnd.findIndex((e) => e <= o.r[0] + 1e-6); if (l < 0) { l = aEnd.length; aEnd.push(0); } aEnd[l] = o.r[1]; o.lane = l; });
      const AH = 28, aTop = O + TL + (showBg ? BH + 4 : 0) + 2;
      if (auds.length) track.style.height = `${aTop + aEnd.length * (AH + 2)}px`;
      if (auds.length) heads += `<div class="tl-head" style="top:${aTop}px;height:${aEnd.length * (AH + 2) - 2}px" title="Track audio tambahan"><b>♫</b><span>Audio</span>${trackBtns(['audioMute', 'audioLock'])}</div>`;
      // musik latar & voice-over sebagai balok tersendiri
      let yMV = aTop + (auds.length ? aEnd.length * (AH + 2) : 0);
      let mvRow = '';
      const MH = 26;
      if (music.src && isFinite(music.duration) && music.duration > 0) {
        mvRow += `<div class="tl-block tl-music${ui.focus === 'music' ? ' current' : ''}" data-kind="music" style="left:0;width:${(Math.min(total, scale) / scale) * 100}%;top:${yMV}px;height:${MH}px;${mvWaveStyle('music', music.src, music.duration, +state.music.start || 0, total, true)}" title="Musik latar • klik untuk mengatur">
          <span class="tl-num">♪</span><span class="tl-label">${esc(($('#audioName').textContent || 'Musik').replace(/^🎵\s*/, ''))}</span>${state.tracks.musicMute ? '<span class="tl-badge">bisu</span>' : ''}</div>`;
        heads += `<div class="tl-head" style="top:${yMV}px;height:${MH}px" title="Musik latar"><b>♪</b><span>Musik</span>${trackBtns(['musicMute'])}</div>`;
        yMV += MH + 2;
      }
      if (voice.src && isFinite(voice.duration) && voice.duration > 0) {
        const vd = +state.voice.delay || 0;
        mvRow += `<div class="tl-block tl-voice${ui.focus === 'voice' ? ' current' : ''}" data-kind="voice" style="left:${(vd / scale) * 100}%;width:${(Math.max(0.05, Math.min(voice.duration, scale - vd)) / scale) * 100}%;top:${yMV}px;height:${MH}px;${mvWaveStyle('voice', voice.src, voice.duration, 0, voice.duration, false)}" title="Voice-over • geser untuk mengubah waktu mulai">
          <span class="tl-num">🎙</span><span class="tl-label">${esc(($('#voiceName').textContent || 'Voice-over'))}</span>${state.tracks.voiceMute ? '<span class="tl-badge">bisu</span>' : ''}</div>`;
        heads += `<div class="tl-head" style="top:${yMV}px;height:${MH}px" title="Voice-over"><b>🎙</b><span>Suara</span>${trackBtns(['voiceMute', 'voiceLock'])}</div>`;
        yMV += MH + 2;
      }
      if (mvRow) track.style.height = `${yMV}px`;
      const audRow = auds.map(({ a, r, lane }) => {
        const e = Math.min(r[1], scale);
        return `<div class="tl-block tl-audio${a.id === ui.selAudio ? ' current' : ''}" data-aid="${esc(a.id)}" style="left:${(r[0] / scale) * 100}%;width:${(Math.max(0.05, e - r[0]) / scale) * 100}%;top:${aTop + lane * (AH + 2)}px;height:${AH}px;${waveStyle(a, r[1] - r[0])}" title="${esc(a.name || 'audio')}">
          <div class="tl-handle l" data-side="al"></div><span class="tl-num">🎵</span>${a.fx && a.fx !== 'none' ? '<span class="tl-badge">fx</span>' : ''}${+a.pitch ? `<span class="tl-badge">${+a.pitch > 0 ? '+' : ''}${+a.pitch}</span>` : ''}<span class="tl-label">${esc(a.name || 'audio')}</span><span class="tl-dur">${(r[1] - r[0]).toFixed(1)}s</span>
          <div class="tl-handle" data-side="ar"></div></div>`;
      }).join('');
      track.innerHTML = segRow + mvRow + audRow + bgRow + order.map(({ tx, i, r, lane, ov }) => {
        const label = isOverlay(tx) ? esc(`${tx.media === 'video' ? '🎞' : '🖼'} ${tx.name || 'overlay'}`) : isSticker(tx) ? esc(`${tx.fileId ? '🖼 ' + (tx.name || 'gambar') : tx.emoji || '⭐'} stiker`)
          : esc((tx.emoji ? tx.emoji + ' ' : '') + (tx.text || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim() || '(kosong)');
        const keys = (tx.keys || []).map((k) => `<i class="tl-key" style="left:${clamp(k.t / (r[1] - r[0])) * 100}%"></i>`).join('');
        return `<div class="tl-block${tx.id === ui.selText ? ' current' : ''}${isSticker(tx) ? ' tl-sticker' : ''}${isOverlay(tx) ? ' tl-overlay' : ''}" data-id="${esc(tx.id)}" style="left:${(r[0] / scale) * 100}%;width:${((r[1] - r[0]) / scale) * 100}%;top:${ov ? O + lanes * LH + lane * OH : O + lane * LH}px;height:${(ov ? OH : LH) - 3}px">
          <div class="tl-handle l" data-side="l" title="Tarik untuk mengubah waktu muncul"></div>
          <span class="tl-num">${i + 1}</span><span class="tl-label">${label}</span><span class="tl-dur">${(r[1] - r[0]).toFixed(1)}s</span>${keys}
          <div class="tl-handle" data-side="r" title="Tarik untuk mengubah waktu hilang"></div></div>`;
      }).join('');
    } else {
      track.style.height = '';
      heads = '<div class="tl-head main" style="top:0;height:46px" title="Scene berurutan"><b>▶</b><span>Scene</span></div>';
    }
    $('#tlHeads').innerHTML = heads;
    const cur = sceneAt(player.t);
    if (!freeMode()) $('#tlTrack').innerHTML = state.scenes.map((sc, i) => {
      const d = Math.max(0.5, +sc.duration || 0);
      const label = esc((sc.emoji ? sc.emoji + ' ' : '') + (sc.text || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim() || '(kosong)');
      const bg = blockBg(sc);
      const own = SCENE_STYLE_KEYS.some((k) => sc[k]);
      return `<div class="tl-block${cur && cur.index === i ? ' current' : ''}${ui.focus === 'scene' && ui.selScene === i ? ' sel' : ''}${bg ? ' custom' : ''}" data-i="${i}" style="width:${(d / scale) * 100}%;${bg ? `background:${bg}` : ''}" title="Klik untuk mengatur scene ${i + 1} di panel Properti • tarik tepi kanan untuk mengubah durasi">
        <span class="tl-num">${i + 1}</span>${own ? '<span class="tl-badge" title="Punya transisi/efek sendiri">🎬</span>' : ''}<span class="tl-label">${label}</span><span class="tl-dur">${d.toFixed(1)}s</span>
        <div class="tl-handle" data-i="${i}" title="Tarik untuk mengubah durasi"></div></div>`;
    }).join('');
    const pps = Math.max(1, $('#tlRuler').getBoundingClientRect().width || 600) / scale;
    const step = [0.5, 1, 2, 5, 10, 15, 30, 60, 120].find((v) => v * pps >= 70) || 300;
    let ticks = '';
    for (let s = 0; s <= scale + 0.001; s += step) {
      ticks += `<span style="left:${(s / scale) * 100}%">${fmtTime(s)}${step < 1 && s % 1 ? '.5' : ''}</span>`;
      for (let m = 1; m < 5; m++) { const x = s + (step * m) / 5; if (x < scale) ticks += `<i style="left:${(x / scale) * 100}%"></i>`; }
    }
    $('#tlRuler').innerHTML = ticks;
    renderMarkers();
    markGroups();
    markMulti();
    const every = +state.beat.every || 2;
    const bts = state.beat.show !== false ? beatTimes(scale) : [];
    const base = beatBase(), P = +state.beat.period;
    $('#tlBeats').innerHTML = bts.length > 600 ? '' : bts.map((b) => {
      const k = base != null ? Math.round((b - base) / P) : 0;
      return `<i class="${((k % every) + every) % every === 0 ? 'on' : ''}" style="left:calc(8px + (100% - 16px) * ${b / scale})"></i>`;
    }).join('');
  }

  // ---------- Timeline: zoom, ikuti playhead, timecode ----------
  const HEADW_DESKTOP = 118;
  const headW = () => { const el = document.getElementById('tlHeads'); return (el && el.offsetWidth) || HEADW_DESKTOP; };
  tl.zoom = 1;
  function layoutTimeline() {
    const box = $('#timeline'), inner = $('#tlInner');
    const w = Math.max(200, box.clientWidth - headW() - 2);
    const want = `${Math.round(w * tl.zoom)}px`;
    if (inner.style.width !== want) inner.style.width = want;
  }
  function setZoom(z, anchorX) {
    const box = $('#timeline'), track = $('#tlTrack');
    const old = track.getBoundingClientRect();
    const ax = anchorX == null ? old.left + Math.min(old.width, box.clientWidth - headW()) / 2 : anchorX;
    const frac = old.width ? (ax - old.left) / old.width : 0;
    tl.zoom = clamp(z, 1, 40);
    $('#tlZoom').value = String(Math.round((Math.log2(tl.zoom) / Math.log2(40)) * 100));
    renderTimeline(tl.scale || undefined);
    const nw = track.getBoundingClientRect();
    box.scrollLeft += nw.left + frac * nw.width - ax;
    updateTimeUI();
  }
  function followPlayhead() {
    if (!player.playing || tl.drag || tl.zoom <= 1) return;
    const box = $('#timeline'), ph = $('#tlPlayhead').getBoundingClientRect(), b = box.getBoundingClientRect();
    const left = b.left + headW(), right = b.right - 30;
    if (ph.left > right || ph.left < left) box.scrollLeft += ph.left - left - 40;
  }
  // 00:00:05:12 (jam:menit:detik:frame)
  function timecode(t) {
    const fps = +state.export.fps || 30, f = Math.floor(Math.max(0, t) * fps + 1e-6);
    const p = (v) => String(v).padStart(2, '0');
    return `${p(Math.floor(f / fps / 3600))}:${p(Math.floor(f / fps / 60) % 60)}:${p(Math.floor(f / fps) % 60)}:${p(f % fps)}`;
  }

  // ---------- Thumbnail strip klip & gelombang suara ----------
  const thumbCache = new Map(); // mediaId -> { url, n, ready }
  const waveCache = new Map(); // fileId -> { url, dur, ready }
  let thumbBusy = false;
  const thumbQueue = [];
  function queueThumb(item) {
    if (!item || thumbCache.has(item.id)) return;
    thumbCache.set(item.id, { ready: false });
    thumbQueue.push(item);
    if (!thumbBusy) runThumbs();
  }
  async function runThumbs() {
    thumbBusy = true;
    while (thumbQueue.length) {
      const item = thumbQueue.shift();
      try { await makeStrip(item); } catch (_) { thumbCache.set(item.id, { ready: false, failed: true }); }
      await new Promise((r) => setTimeout(r, 0)); // beri jeda agar halaman tetap responsif
    }
    thumbBusy = false;
    if (!tl.drag) renderTimeline(tl.scale || undefined);
    mediaLibKey = ''; renderMediaLib();
  }
  async function makeStrip(item) {
    const e = mediaEls.get(item.id);
    if (!e || !e.url) { thumbCache.delete(item.id); return; }
    const H = 48, cv = document.createElement('canvas'), g = cv.getContext('2d');
    if (item.kind === 'image') {
      const img = e.el;
      // tunggu foto selesai dimuat dulu (jangan langsung gagal → antre ulang tanpa henti = halaman macet)
      if (img && !img.naturalWidth) await new Promise((res) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); setTimeout(res, 15000); });
      if (!img || !img.naturalWidth) { thumbCache.set(item.id, { ready: false, failed: true }); return; }
      cv.height = H; cv.width = Math.max(8, Math.round((H * img.naturalWidth) / img.naturalHeight));
      g.drawImage(img, 0, 0, cv.width, H);
      thumbCache.set(item.id, { ready: true, url: cv.toDataURL('image/jpeg', 0.7), n: 0 });
      return;
    }
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto'; v.src = e.url;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = rej; setTimeout(res, 8000); });
    if (!v.videoWidth || !v.duration) { thumbCache.set(item.id, { ready: false, failed: true }); return; }
    // sampul untuk kartu perpustakaan (frame di 10% durasi, lebar 200px)
    let poster = '';
    try {
      v.currentTime = Math.min(v.duration * 0.1, 1.5);
      await new Promise((res) => { v.onseeked = res; setTimeout(res, 1500); });
      const pc = document.createElement('canvas'), pw = 200, phh = Math.round((pw * v.videoHeight) / v.videoWidth);
      pc.width = pw; pc.height = phh; pc.getContext('2d').drawImage(v, 0, 0, pw, phh);
      poster = pc.toDataURL('image/jpeg', 0.75);
    } catch (_) { /* abaikan */ }
    const n = clamp(Math.round(v.duration / 1.5), 4, 16), tw = Math.round((H * v.videoWidth) / v.videoHeight);
    cv.width = tw * n; cv.height = H;
    for (let i = 0; i < n; i++) {
      v.currentTime = ((i + 0.5) / n) * v.duration;
      await new Promise((res) => { v.onseeked = res; setTimeout(res, 1500); });
      g.drawImage(v, i * tw, 0, tw, H);
    }
    v.removeAttribute('src'); v.load();
    thumbCache.set(item.id, { ready: true, url: cv.toDataURL('image/jpeg', 0.65), n, dur: v.duration, poster });
  }
  // gaya latar balok klip: strip mewakili seluruh video, digeser sesuai titik mulai klip
  function thumbStyle(m, c, len) {
    if (!m) return '';
    const t = thumbCache.get(m.id);
    if (!t) { const e = mediaEls.get(m.id); if (e && e.url) queueThumb(m); return ''; }
    if (!t.ready) return '';
    if (m.kind === 'image' || !t.dur) return `background-image:url(${t.url});background-size:auto 100%;background-repeat:repeat-x`;
    const span = Math.min(t.dur, Math.max(0.1, c && !c.freeze ? len * (+c.speed || 1) : len));
    const inn = c ? clamp(+c.in || 0, 0, Math.max(0, t.dur - span)) : 0;
    const size = (t.dur / span) * 100, pos = t.dur - span > 0.01 ? (inn / (t.dur - span)) * 100 : 0;
    return `background-image:url(${t.url});background-size:${size.toFixed(2)}% 100%;background-position:${pos.toFixed(2)}% 0;background-repeat:no-repeat`;
  }
  async function makeWave(a) {
    const e = mediaEls.get(a.fileId);
    if (!e || !e.url) { waveCache.delete(a.fileId); return; }
    const buf = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(await (await fetch(e.url)).arrayBuffer());
    const W = Math.min(4000, Math.max(300, Math.round(buf.duration * 40))), H = 40;
    const ch = buf.getChannelData(0), per = Math.max(1, Math.floor(ch.length / W));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.fillStyle = 'rgba(255,255,255,0.55)';
    let mx = 1e-4; const peaks = new Float32Array(W);
    for (let x = 0; x < W; x++) { let p = 0; for (let i = x * per, end = Math.min(ch.length, i + per); i < end; i += 4) p = Math.max(p, Math.abs(ch[i])); peaks[x] = p; mx = Math.max(mx, p); }
    for (let x = 0; x < W; x++) { const h = Math.max(1, (peaks[x] / mx) * (H - 4)); g.fillRect(x, (H - h) / 2, 1, h); }
    waveCache.set(a.fileId, { ready: true, url: cv.toDataURL('image/png'), dur: buf.duration });
    if (!tl.drag) renderTimeline(tl.scale || undefined);
  }
  function waveStyle(a, len) {
    const w = waveCache.get(a.fileId);
    if (!w) { waveCache.set(a.fileId, { ready: false }); makeWave(a).catch(() => waveCache.delete(a.fileId)); return ''; }
    if (!w.ready) return '';
    const span = Math.min(w.dur, Math.max(0.05, len)), inn = clamp(+a.in || 0, 0, Math.max(0, w.dur - span));
    const size = (w.dur / span) * 100, pos = w.dur - span > 0.01 ? (inn / (w.dur - span)) * 100 : 0;
    return `background-image:url(${w.url});background-size:${size.toFixed(2)}% 70%;background-position:${pos.toFixed(2)}% 75%;background-repeat:no-repeat`;
  }

  // ---------- Kepala track: tombol sembunyikan / kunci / bisukan ----------
  const TRACK_BTN = {
    textHide: ['eye', 'Sembunyikan / tampilkan semua teks & stiker'], textLock: ['lock', 'Kunci track teks (tidak bisa digeser)'],
    vsound: ['sound', 'Bisukan / bunyikan suara asli video'], videoLock: ['lock', 'Kunci track video'],
    audioMute: ['sound', 'Bisukan track audio'], audioLock: ['lock', 'Kunci track audio'],
    musicMute: ['sound', 'Bisukan musik latar'], voiceMute: ['sound', 'Bisukan voice-over'], voiceLock: ['lock', 'Kunci voice-over'],
  };
  const ICON_PATHS = {
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    sound: '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 010 7"/>',
  };
  // aktif = sedang disembunyikan / dikunci / dibisukan
  const trackOn = (k) => (k === 'vsound' ? state.vsound.on === false : !!state.tracks[k]);
  const trackBtns = (keys) => `<span class="th-btns">${keys.map((k) => `<button class="th-btn${trackOn(k) ? ' on' : ''}" data-tr="${k}" title="${TRACK_BTN[k][1]}"><svg viewBox="0 0 24 24">${ICON_PATHS[TRACK_BTN[k][0]]}</svg></button>`).join('')}</span>`;
  function toggleTrack(k) {
    if (k === 'vsound') { state.vsound.on = state.vsound.on === false; syncControls(); syncVideos(player.t); renderMediaLib(); }
    else state.tracks[k] = !state.tracks[k];
    if (audio.ctx) {
      if (audio.vgain) audio.vgain.gain.value = voiceVol();
      lastLevel = -1;
      if (player.playing) { setGain(musicLevel(player.t), 0.05); syncAudioTracks(player.t, true); }
    }
    const names = { textHide: 'Teks', textLock: 'Teks', vsound: 'Suara video', videoLock: 'Video', audioMute: 'Audio', audioLock: 'Audio', musicMute: 'Musik', voiceMute: 'Voice-over', voiceLock: 'Voice-over' };
    const on = trackOn(k), act = /Lock/.test(k) ? (on ? 'dikunci' : 'tidak dikunci') : k === 'textHide' ? (on ? 'disembunyikan' : 'ditampilkan') : (on ? 'dibisukan' : 'dibunyikan');
    toast(`${names[k]} ${act}`);
    refresh();
  }
  const blockTrack = (b) => (b.dataset.aid ? 'audioLock' : b.dataset.cid || b.dataset.mid ? 'videoLock' : b.dataset.kind === 'voice' ? 'voiceLock' : b.dataset.id ? 'textLock' : '');

  // gelombang suara musik / voice-over (dari file yang sedang dipakai)
  function mvWaveStyle(key, url, dur, inn, len, loop) {
    const ck = key + '|' + url;
    const w = waveCache.get(ck);
    if (!w) {
      waveCache.set(ck, { ready: false });
      waveFromUrl(url).then((r) => { waveCache.set(ck, { ready: true, ...r }); if (!tl.drag) renderTimeline(tl.scale || undefined); }).catch(() => waveCache.delete(ck));
      return '';
    }
    if (!w.ready) return '';
    if (loop && dur < inn + len) return `background-image:url(${w.url});background-size:${((dur / len) * 100).toFixed(2)}% 70%;background-position:0 75%;background-repeat:repeat-x`;
    const span = Math.min(dur, len), size = (dur / span) * 100, pos = dur - span > 0.01 ? (clamp(inn, 0, dur - span) / (dur - span)) * 100 : 0;
    return `background-image:url(${w.url});background-size:${size.toFixed(2)}% 70%;background-position:${pos.toFixed(2)}% 75%;background-repeat:no-repeat`;
  }
  async function waveFromUrl(url) {
    const buf = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(await (await fetch(url)).arrayBuffer());
    const W = Math.min(4000, Math.max(300, Math.round(buf.duration * 40))), H = 40;
    const ch = buf.getChannelData(0), per = Math.max(1, Math.floor(ch.length / W));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.fillStyle = 'rgba(255,255,255,0.55)';
    let mx = 1e-4; const pk = new Float32Array(W);
    for (let x = 0; x < W; x++) { let p = 0; for (let i = x * per, e = Math.min(ch.length, i + per); i < e; i += 4) p = Math.max(p, Math.abs(ch[i])); pk[x] = p; mx = Math.max(mx, p); }
    for (let x = 0; x < W; x++) { const h = Math.max(1, (pk[x] / mx) * (H - 4)); g.fillRect(x, (H - h) / 2, 1, h); }
    return { url: cv.toDataURL('image/png'), dur: buf.duration };
  }

  // panel properti musik / voice-over: kontrolnya meneruskan ke pengaturan asli di kategori Audio
  function updateMvBar() {
    const bar = $('#mvBar'), f = ui.focus;
    const show = (f === 'music' && !!music.src) || (f === 'voice' && !!voice.src);
    bar.classList.toggle('hidden', !show);
    if (!show) return;
    const m = f === 'music';
    $('#mvName').textContent = m ? `♪ Musik: ${($('#audioName').textContent || '').replace(/^🎵\s*/, '')}` : `🎙 Voice-over: ${$('#voiceName').textContent}`;
    const set = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = v; };
    const vol = m ? +state.music.volume : +state.voice.volume;
    $('#mvVol').max = m ? '1' : '2';
    set('#mvVol', vol); $('#mvVolOut').textContent = `${Math.round(vol * 100)}%`;
    $('#mvStartLbl').textContent = m ? 'Mulai dari detik ke- (di lagu)' : 'Mulai di detik ke- (video)';
    set('#mvStart', m ? +state.music.start || 0 : +state.voice.delay || 0);
    $('#mvExtraLbl').textContent = m ? 'Fade out di akhir video' : 'Kecilkan musik saat ada suara';
    $('#mvExtra').checked = m ? !!state.music.fade : !!state.voice.duck;
  }
  function bindMvBar() {
    const m = () => ui.focus === 'music';
    const proxy = (id, val, ev = 'input') => { const el = $(id); if (!el) return; if (el.type === 'checkbox') el.checked = val; else el.value = val; el.dispatchEvent(new Event(ev, { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    $('#mvVol').addEventListener('input', (e) => { proxy(m() ? '#volume' : '#voiceVolume', e.target.value); updateMvBar(); });
    $('#mvStart').addEventListener('change', (e) => { proxy(m() ? '#audioStart' : '#voiceDelay', Math.max(0, +e.target.value || 0)); refresh(); });
    $('#mvExtra').addEventListener('change', (e) => { const id = m() ? '#audioFade' : '#voiceDuck'; proxy(id, e.target.checked, 'change'); });
    $('#mvReplace').addEventListener('click', () => $(m() ? '#fileAudio' : '#fileVoice').click());
    $('#mvRemove').addEventListener('click', () => { $(m() ? '#btnRemoveAudio' : '#btnRemoveVoice').click(); ui.focus = ''; refresh(); });
    $('#mvMore').addEventListener('click', () => document.querySelector('[data-tab=musik]').click());
    // tombol kepala track
    $('#tlHeads').addEventListener('click', (e) => { const b = e.target.closest('[data-tr]'); if (b) toggleTrack(b.dataset.tr); });
    // balok musik / voice-over: pilih, geser voice-over, dan hormati track yang dikunci
    $('#tlTrack').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.tl-block');
      if (!b) return;
      const lockKey = blockTrack(b);
      const trackEl = $('#tlTrack'), r = trackEl.getBoundingClientRect(), scale = tl.scale || totalDuration();
      if (b.dataset.kind === 'music' || b.dataset.kind === 'voice') {
        ui.focus = b.dataset.kind; ui.selClip = ''; ui.selAudio = ''; ui.selText = '';
        updateClipBar(); updateAudioBar(); updateTextBar(); updateMvBar();
      }
      if (lockKey && state.tracks[lockKey]) {
        e.stopPropagation(); e.preventDefault();
        seekTo(clamp((e.clientX - r.left) / r.width) * scale);
        if (b.dataset.id) selectText(b.dataset.id, false);
        toast('Track ini dikunci 🔒 • buka kuncinya di kepala track untuk menggeser');
        return;
      }
      if (b.dataset.kind === 'music') return; // klik biasa = lompat waktu (ditangani timeline)
      if (b.dataset.kind !== 'voice') return;
      e.stopPropagation(); e.preventDefault();
      const x0 = e.clientX, d0 = +state.voice.delay || 0, pps = r.width / scale;
      let moved = false;
      const move = (ev) => {
        const dx = ev.clientX - x0;
        if (Math.abs(dx) > 3) moved = true;
        if (!moved) return;
        state.voice.delay = r1Fine(Math.max(0, snapBeat(d0 + dx / pps, pps)));
        b.style.left = `${(state.voice.delay / scale) * 100}%`;
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        if (!moved) seekTo(clamp((ev.clientX - r.left) / r.width) * scale);
        else { syncControls(); lastLevel = -1; syncVoice(player.t, true); }
        refresh();
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    }, true);
  }

  // ---------- Sub-menu panel kiri (dibuat dari judul bagian tiap kategori) ----------
  function bindSubnav() {
    const panel = $('.panel'), nav = document.createElement('nav'), body = document.createElement('div');
    nav.className = 'subnav'; body.className = 'panel-body';
    const tabs = $$('.panel .tab-body');
    tabs[0].before(body); body.append(nav, ...tabs);
    const build = () => {
      const tb = $('.panel .tab-body.active');
      const hs = tb ? [...tb.querySelectorAll(':scope > h3')] : [];
      body.classList.toggle('no-sub', hs.length < 2);
      nav.innerHTML = hs.map((h, i) => `<button class="sub-item${i === 0 ? ' active' : ''}" data-i="${i}">${esc(h.textContent.replace(/^[^\p{L}\p{N}]+/u, '').trim())}</button>`).join('');
      nav.onclick = (e) => { const b = e.target.closest('.sub-item'); if (b) { tb.scrollTo({ top: hs[+b.dataset.i].offsetTop - tb.offsetTop - 6, behavior: 'smooth' }); } };
      if (tb) tb.onscroll = () => {
        let k = 0;
        hs.forEach((h, i) => { if (h.offsetTop - tb.offsetTop - tb.scrollTop <= 40) k = i; });
        if (tb.scrollTop + tb.clientHeight >= tb.scrollHeight - 4) k = hs.length - 1;
        $$('.sub-item', nav).forEach((x, i) => x.classList.toggle('active', i === k));
      };
    };
    $$('.panel .tab').forEach((t) => t.addEventListener('click', () => setTimeout(build)));
    build();
    void panel;
  }

  // ---------- Panel Properti: teks / stiker / overlay ----------
  // ---------- Properti scene (susunan scene berurutan) ----------
  ui.selScene = -1;
  let sceneBarKey = '';
  function selectScene(i, seek = true) {
    if (freeMode() || !state.scenes[i]) return;
    const ae = document.activeElement;
    if (ae && $('#sceneBar').contains(ae)) ae.blur(); // pindah scene: panel boleh dibangun ulang
    ui.selScene = i; ui.focus = 'scene';
    ui.selClip = ''; ui.selAudio = ''; ui.selText = '';
    sceneBarKey = '';
    updateClipBar(); updateAudioBar(); updateTextBar(); updateMvBar();
    if (seek) goToScene(i);
    if (!tl.drag) renderTimeline(tl.scale || undefined);
    // kartu scene di tab Teks ikut ditandai
    $$('#sceneList .scene').forEach((c, k) => c.classList.toggle('current', k === i));
  }
  function updateSceneBar() {
    const bar = $('#sceneBar');
    if (!bar) return;
    const i = ui.selScene, sc = !freeMode() && ui.focus === 'scene' ? state.scenes[i] : null;
    bar.classList.toggle('hidden', !sc);
    if (!sc) { sceneBarKey = ''; return; }
    const key = [i, state.scenes.length, state.media.length, sc.text, sc.author, sc.duration, sc.emoji, sc.bg, ...SCENE_STYLE_KEYS.map((k) => sc[k] || '')].join('|');
    const typing = bar.contains(document.activeElement) && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName);
    if (key === sceneBarKey || typing) return; // jangan ganggu yang sedang diketik
    sceneBarKey = key;
    const n = state.scenes.length;
    bar.innerHTML = `
      <div class="sb-head">
        <span class="clip-name">🎞 Scene ${i + 1} dari ${n}</span>
        <button data-sb="prev" class="tool ghost mini" title="Scene sebelumnya"${i === 0 ? ' disabled' : ''}>‹</button>
        <button data-sb="next" class="tool ghost mini" title="Scene berikutnya"${i === n - 1 ? ' disabled' : ''}>›</button>
      </div>
      <label>Teks <textarea data-f="text" rows="3" placeholder="Tulis teks… *kata* = disorot"></textarea></label>
      <label>Nama penulis <input data-f="author" type="text" placeholder="opsional" /></label>
      <label class="half">Durasi (dtk) <input data-f="duration" type="number" min="0.5" max="60" step="0.5" /></label>
      <label class="half">Emoji <input data-f="emoji" type="text" maxlength="12" placeholder="✨" /></label>
      <label>Latar scene ini <select data-f="bg">
        <option value="">Ikut global</option>
        ${GRADIENT_NAMES.map((nm, k) => `<option value="g${k}">Gradasi: ${nm}</option>`).join('')}
        ${SCENE_COLORS.map(([c, nm]) => `<option value="${c}">Warna: ${nm}</option>`).join('')}
        ${state.media.map((m, k) => `<option value="m:${esc(m.id)}">${m.kind === 'video' ? '🎬' : '🖼'} ${k + 1}. ${esc(m.name)}</option>`).join('')}
      </select></label>
      <span class="clip-sep"></span>
      <div class="clip-sec">🎬 Transisi &amp; efek scene ini</div>
      ${sceneStyleHtml(sc, i, true)}
      <span class="clip-sep"></span>
      <div class="sb-actions">
        <button data-sb="up" class="tool ghost" title="Pindah ke depan"${i === 0 ? ' disabled' : ''}>↑ Naik</button>
        <button data-sb="down" class="tool ghost" title="Pindah ke belakang"${i === n - 1 ? ' disabled' : ''}>↓ Turun</button>
        <button data-sb="dup" class="tool ghost" title="Duplikat scene">⧉ Duplikat</button>
        <button data-sb="del" class="tool ghost" title="Hapus scene"${n === 1 ? ' disabled' : ''}>🗑 Hapus</button>
      </div>`;
    const f = (k) => bar.querySelector(`[data-f=${k}]`);
    f('text').value = sc.text || ''; f('author').value = sc.author || ''; f('duration').value = sc.duration;
    f('emoji').value = sc.emoji || ''; f('bg').value = sc.bg || '';
    const cardSync = () => {
      const card = $$('#sceneList .scene')[i];
      if (!card) return;
      const [ta] = $$('textarea', card), ins = $$('input', card);
      if (ta) ta.value = sc.text || '';
      if (ins[0]) ins[0].value = sc.author || '';
      if (ins[3]) ins[3].value = sc.duration;
      if (ins[4]) ins[4].value = sc.emoji || '';
      const bs = $('select', card); if (bs) bs.value = sc.bg || '';
    };
    f('text').addEventListener('input', (e) => { sc.text = e.target.value; cardSync(); refresh(); });
    f('author').addEventListener('input', (e) => { sc.author = e.target.value; cardSync(); refresh(); });
    f('emoji').addEventListener('input', (e) => { sc.emoji = e.target.value; cardSync(); refresh(); });
    f('duration').addEventListener('change', (e) => { sc.duration = clamp(+e.target.value || 0.5, 0.5, 60); e.target.value = sc.duration; renderScenes(); refresh(); goToScene(i); });
    f('bg').addEventListener('change', (e) => { sc.bg = e.target.value; cardSync(); refresh(); goToScene(i); });
    bindSceneStyle(bar, sc, i);
    bar.querySelector('.sb-head').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sb]'); if (!b) return;
      selectScene(b.dataset.sb === 'prev' ? i - 1 : i + 1);
    });
    bar.querySelector('.sb-actions').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sb]'); if (!b) return;
      const a = b.dataset.sb, L = state.scenes;
      let to = i;
      if (a === 'up' && i > 0) { [L[i - 1], L[i]] = [L[i], L[i - 1]]; to = i - 1; }
      if (a === 'down' && i < L.length - 1) { [L[i + 1], L[i]] = [L[i], L[i + 1]]; to = i + 1; }
      if (a === 'dup') { L.splice(i + 1, 0, JSON.parse(JSON.stringify(sc))); to = i + 1; }
      if (a === 'del') {
        if (L.length < 2 || !confirm(`Hapus scene ${i + 1}?`)) return;
        L.splice(i, 1); to = Math.min(i, L.length - 1);
      }
      renderScenes(); refresh(); selectScene(to);
    });
  }
  function updateTextBar() {
    updateSceneBar();
    updateSegBar();
    const bar = $('#textBar'), insp = $('.inspector');
    const tx = freeMode() ? textById(ui.selText) : null;
    if (insp) insp.dataset.focus = ui.focus || '';
    bar.classList.toggle('hidden', !tx);
    if (!tx) return;
    const st = isSticker(tx), ov = isOverlay(tx);
    $('#tbName').textContent = ov ? `🎞 ${tx.name || 'Overlay'}` : st ? `😀 Stiker ${tx.emoji || tx.name || ''}` : 'T Teks';
    $('#tbTextWrap').classList.toggle('hidden', st);
    const set = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = v; };
    const [a, b] = textRange(tx);
    const p = layerProps(tx, r1Fine(clamp(layerLocal(tx), 0, b - a)));
    if (!st) set('#tbText', tx.text || '');
    set('#tbStart', a.toFixed(1)); set('#tbEnd', b.toFixed(1));
    set('#tbS', p.s); set('#tbR', p.r); set('#tbO', p.o); set('#tbX', p.x); set('#tbY', p.y);
    $('#tbXOut').textContent = `${Math.round(p.x * 100)}%`; $('#tbYOut').textContent = `${Math.round(p.y * 100)}%`;
    const ks = tx.keys || [], lt = layerLocal(tx), here = ks.some((k) => Math.abs(k.t - lt) < 0.06);
    $('#tbKfAdd').classList.toggle('on', here);
    $('#tbKfAdd').title = here ? 'Hapus keyframe di playhead' : 'Tambah keyframe di playhead';
    $('#tbKfInfo').textContent = ks.length ? `${ks.length} keyframe${here ? ' • di playhead' : ''}` : 'belum ada';
    $('#tbKfPrev').disabled = !ks.some((k) => k.t < lt - 0.06);
    $('#tbKfNext').disabled = !ks.some((k) => k.t > lt + 0.06);
    $('#tbKfClear').disabled = !ks.length;
    $('#tbSOut').textContent = `${Math.round(p.s * 100)}%`;
    $('#tbROut').textContent = `${Math.round(p.r)}°`;
    $('#tbOOut').textContent = `${Math.round(p.o * 100)}%`;
    $('#tbKeyNote').classList.toggle('hidden', !(tx.keys && tx.keys.length));
    renderTextStylePanes(tx);
    $('#tbRmbg').classList.toggle('hidden', !(tx.fileId && tx.media !== 'video') || !!tx.origFileId);
    $('#tbRmbgUndo').classList.toggle('hidden', !tx.origFileId);
  }
  // =========================================================
  //  YOG-EDITZ: gaya & animasi per lapisan teks (panel Properti)
  // =========================================================
  // gaya efektif sebuah teks: gaya bawaan (tab Teks) + gaya miliknya sendiri
  const textStyleOf = (l) => (l && l.style && Object.keys(l.style).length ? { ...state.style, ...l.style } : state.style);
  // gaya cepat (preset)
  const TEXT_PRESETS = [
    ['Polos', { color: '#ffffff', stroke: false, boxBg: false, shadow: false, glow: false, textGradient: false }],
    ['Bayangan', { color: '#ffffff', stroke: false, boxBg: false, shadow: true, glow: false, textGradient: false }],
    ['Garis hitam', { color: '#ffffff', stroke: true, strokeColor: '#000000', strokeWidth: 8, boxBg: false, shadow: false, glow: false, textGradient: false, weight: '800' }],
    ['Kuning tebal', { color: '#ffd400', stroke: true, strokeColor: '#000000', strokeWidth: 10, boxBg: false, shadow: true, glow: false, textGradient: false, weight: '800', uppercase: true }],
    ['Kotak hitam', { color: '#ffffff', stroke: false, boxBg: true, boxColor: '#000000', boxOpacity: 0.7, shadow: false, glow: false, textGradient: false }],
    ['Kotak putih', { color: '#111111', stroke: false, boxBg: true, boxColor: '#ffffff', boxOpacity: 0.95, shadow: false, glow: false, textGradient: false, weight: '800' }],
    ['Neon', { color: '#7df9ff', stroke: false, boxBg: false, shadow: false, glow: true, textGradient: false }],
    ['Gradasi', { color: '#ffffff', color2: '#ff5fa2', textGradient: true, stroke: false, boxBg: false, shadow: true, glow: false, weight: '800' }],
    ['Merah judul', { color: '#ffffff', stroke: true, strokeColor: '#e11d48', strokeWidth: 10, boxBg: false, shadow: true, glow: false, textGradient: false, weight: '800', uppercase: true, font: 'Bebas Neue' }],
    ['Tulisan tangan', { color: '#ffffff', font: 'Caveat', weight: '700', stroke: false, boxBg: false, shadow: true, glow: false, textGradient: false }],
  ];
  const STYLE_FIELDS = [
    // [kunci, label, jenis, opsi]
    ['font', 'Font', 'font'], ['weight', 'Ketebalan', 'select', [['400', 'Normal'], ['600', 'Tebal'], ['800', 'Sangat tebal']]],
    ['size', 'Ukuran huruf', 'range', [24, 200, 2]], ['color', 'Warna', 'color'],
    ['align', 'Rata', 'align'], ['letterSpacing', 'Jarak huruf', 'range', [-2, 20, 1]], ['lineHeight', 'Jarak baris', 'range', [1, 2, 0.05]],
    ['curve', 'Lengkung', 'range', [-100, 100, 5]],
    ['italic', 'Miring', 'bool'], ['uppercase', 'HURUF BESAR', 'bool'],
    ['stroke', 'Garis tepi', 'bool'], ['strokeColor', 'Warna garis', 'color', null, 'stroke'], ['strokeWidth', 'Tebal garis', 'range', [1, 20, 1], 'stroke'],
    ['boxBg', 'Kotak latar', 'bool'], ['boxColor', 'Warna kotak', 'color', null, 'boxBg'], ['boxOpacity', 'Transparansi kotak', 'range', [0.1, 1, 0.05], 'boxBg'],
    ['shadow', 'Bayangan', 'bool'], ['glow', 'Bersinar (neon)', 'bool'],
    ['textGradient', 'Gradasi', 'bool'], ['color2', 'Warna gradasi', 'color', null, 'textGradient'],
    ['highlightColor', 'Warna *sorotan*', 'color'],
  ];
  let tbStyleKey = '';
  function setTextTab(t) {
    $('#textBar').dataset.pt = t;
    $$('#tbTabs [data-ptab]').forEach((b) => b.classList.toggle('active', b.dataset.ptab === t));
  }
  function renderTextStylePanes(tx) {
    const isTxt = tx && !isSticker(tx) && !isOverlay(tx), isOv = tx && isOverlay(tx);
    const want = isTxt ? 'txt' : isOv ? 'ov' : '';
    const tabs = $('#tbTabs');
    if (tabs.dataset.kind !== want) {
      tabs.dataset.kind = want;
      tabs.innerHTML = isTxt ? '<button data-ptab="teks">Teks</button><button data-ptab="gaya">Gaya</button><button data-ptab="animasi">Animasi</button>'
        : isOv ? '<button data-ptab="teks">Dasar</button><button data-ptab="ov">Tampilan &amp; chroma</button>' : '';
      setTextTab('teks');
    }
    tabs.classList.toggle('hidden', !want);
    renderOvPane(isOv ? tx : null);
    if (!isTxt) { tbStyleKey = ''; return; }
    const key = tx.id + '|' + JSON.stringify(tx.style || {}) + '|' + [tx.animIn, tx.animOut, tx.animInDur, tx.animOutDur].join() + '|' + JSON.stringify(state.style);
    const box = $('#tbGaya');
    if (key === tbStyleKey || (box.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName) && document.activeElement.type !== 'checkbox') || $('#tbAnim').contains(document.activeElement)) return;
    tbStyleKey = key;
    const st = textStyleOf(tx), own = tx.style || {};
    const fonts = [...$('#font').options].map((o) => o.value || o.textContent);
    const field = ([k, label, type, opt, dep]) => {
      const v = st[k], mark = own[k] !== undefined ? ' own' : '';
      const hide = dep && !st[dep] ? ' hidden' : '';
      if (type === 'bool') return `<label class="check half${mark}${hide}"><input type="checkbox" data-sk="${k}"${v ? ' checked' : ''} /> ${label}</label>`;
      if (type === 'color') return `<label class="half${mark}${hide}">${label} <input type="color" data-sk="${k}" value="${esc(v || '#ffffff')}" /></label>`;
      if (type === 'range') return `<label class="${k === 'size' ? '' : 'half'}${mark}${hide}">${label} <input type="range" data-sk="${k}" min="${opt[0]}" max="${opt[1]}" step="${opt[2]}" value="${+v || 0}" /><output>${+v || 0}</output></label>`;
      if (type === 'select') return `<label class="half${mark}${hide}">${label} <select data-sk="${k}">${opt.map(([a, b]) => `<option value="${a}"${String(v) === a ? ' selected' : ''}>${b}</option>`).join('')}</select></label>`;
      if (type === 'font') return `<label class="half${mark}${hide}">${label} <select data-sk="${k}">${fonts.map((f) => `<option${f === v ? ' selected' : ''} style="font-family:'${esc(f)}'">${esc(f)}</option>`).join('')}</select></label>`;
      if (type === 'align') return `<div class="half seg mini-seg${mark}">${[['left', '⯇'], ['center', '≡'], ['right', '⯈']].map(([a, b]) => `<button data-align="${a}" class="${v === a ? 'active' : ''}" title="Rata ${a === 'left' ? 'kiri' : a === 'right' ? 'kanan' : 'tengah'}">${b}</button>`).join('')}</div>`;
      return '';
    };
    box.innerHTML = `
      <div class="clip-sec">Gaya cepat</div>
      <div class="tx-presets">${TEXT_PRESETS.map(([n, p], i) => `<button class="tx-preset" data-preset="${i}" title="${esc(n)}" style="font-family:'${esc(p.font || st.font)}';color:${p.color};${p.boxBg ? `background:${p.boxColor};` : ''}${p.stroke ? `-webkit-text-stroke:1px ${p.strokeColor};` : ''}${p.glow ? `text-shadow:0 0 8px ${p.color};` : ''}${p.textGradient ? `background:linear-gradient(${p.color},${p.color2});-webkit-background-clip:text;color:transparent;` : ''}${p.uppercase ? 'text-transform:uppercase;' : ''}font-weight:${p.weight || 600}">Aa</button>`).join('')}</div>
      <div class="clip-sec">Huruf</div>
      ${STYLE_FIELDS.map(field).join('')}
      <div class="tb-btns">
        <button data-sact="all" class="tool ghost" title="Pakai gaya teks ini di semua teks">⧉ Gaya ke semua teks</button>
        <button data-sact="reset" class="tool ghost" title="Kembali ke gaya bawaan (tab Teks)"${Object.keys(own).length ? '' : ' disabled'}>↺ Gaya bawaan</button>
      </div>
      <p class="muted tb-note">Label bertanda titik = diatur khusus teks ini. Gaya bawaan untuk teks baru diatur di kategori Teks.</p>`;
    // animasi
    const optsOf = (id) => [...$(id).options].map((o) => [o.value, o.textContent]);
    const selA = (k, id, label) => `<label>${label}<select data-ak="${k}"><option value="">↩ Bawaan (${esc((optsOf(id).find((o) => o[0] === (k === 'animIn' ? state.anim.type : state.anim.transition)) || ['', ''])[1])})</option>${optsOf(id).map(([v, n]) => `<option value="${esc(v)}"${tx[k] === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
    $('#tbAnim').innerHTML = `
      ${selA('animIn', '#animType', 'Animasi masuk')}
      <label class="half">Lama masuk (dtk) <input type="number" data-ak="animInDur" min="0" max="20" step="0.1" placeholder="otomatis" value="${tx.animInDur || ''}" /></label>
      ${selA('animOut', '#transition', 'Animasi keluar')}
      <label class="half">Lama keluar (dtk) <input type="number" data-ak="animOutDur" min="0" max="20" step="0.1" placeholder="otomatis" value="${tx.animOutDur || ''}" /></label>
      <div class="tb-btns">
        <button data-aact="try" class="tool">▶ Putar teks ini</button>
        <button data-aact="all" class="tool ghost">⧉ Animasi ke semua teks</button>
      </div>`;
  }
  function bindTextStylePanes() {
    const cur = () => (freeMode() ? textById(ui.selText) : null);
    $('#tbTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-ptab]'); if (b) setTextTab(b.dataset.ptab); });
    const changed = (rebuild) => { if (rebuild) tbStyleKey = ''; save(); if (!player.playing) render(player.t); renderTimeline(); if (rebuild) renderTextStylePanes(cur()); };
    const setStyle = (tx, k, v) => {
      tx.style = { ...(tx.style || {}), [k]: v };
      if (k === 'font' || k === 'weight') { const st = textStyleOf(tx); document.fonts.load(`${st.weight} 40px "${st.font}"`).finally(() => { if (!player.playing) render(player.t); }); }
    };
    const g = $('#tbGaya');
    g.addEventListener('input', (e) => {
      const el = e.target.closest('[data-sk]'), tx = cur(); if (!el || !tx) return;
      const k = el.dataset.sk;
      const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
      setStyle(tx, k, v);
      const o = el.parentElement.querySelector('output'); if (o) o.textContent = el.value;
      el.closest('label').classList.add('own');
      changed(el.type === 'checkbox'); // centang memunculkan/menyembunyikan pilihan terkait
    });
    g.addEventListener('change', (e) => { if (e.target.closest('select[data-sk]')) changed(true); });
    g.addEventListener('click', (e) => {
      const tx = cur(); if (!tx) return;
      const al = e.target.closest('[data-align]');
      if (al) { setStyle(tx, 'align', al.dataset.align); changed(true); return; }
      const pr = e.target.closest('[data-preset]');
      if (pr) { const p = TEXT_PRESETS[+pr.dataset.preset][1]; tx.style = { ...(tx.style || {}), ...p }; setStyle(tx, 'font', textStyleOf(tx).font); changed(true); return; }
      const a = e.target.closest('[data-sact]'); if (!a) return;
      if (a.dataset.sact === 'all') {
        state.texts.forEach((o) => { if (o !== tx && !isSticker(o) && !isOverlay(o)) o.style = { ...(tx.style || {}) }; });
        toast('Gaya dipakai di semua teks', 'success');
      } else delete tx.style;
      changed(true);
    });
    const an = $('#tbAnim');
    an.addEventListener('change', (e) => {
      const el = e.target.closest('[data-ak]'), tx = cur(); if (!el || !tx) return;
      const k = el.dataset.ak;
      if (el.type === 'number') { const v = clamp(+el.value || 0, 0, 20); if (v > 0) tx[k] = v; else delete tx[k]; }
      else if (el.value) tx[k] = el.value; else delete tx[k];
      changed(false); tbStyleKey = '';
      playTextLayer(tx);
    });
    an.addEventListener('click', (e) => {
      const b = e.target.closest('[data-aact]'), tx = cur(); if (!b || !tx) return;
      if (b.dataset.aact === 'try') return playTextLayer(tx);
      state.texts.forEach((o) => { if (o === tx || isSticker(o) || isOverlay(o)) return; ['animIn', 'animOut', 'animInDur', 'animOutDur'].forEach((k) => { if (tx[k]) o[k] = tx[k]; else delete o[k]; }); });
      changed(true); toast('Animasi dipakai di semua teks', 'success');
    });
  }
  function playTextLayer(tx) {
    const [a, b] = textRange(tx);
    if (typeof playRange === 'function') playRange(a, b);
  }

  // =========================================================
  //  Magnet: tempel ke tepi klip, teks, audio & playhead
  // =========================================================
  ui.snap = true;
  try { ui.snap = localStorage.getItem('yog:snap') !== '0'; } catch (_) { /* abaikan */ }
  function snapPoints(skip) {
    const pts = [0, player.t, totalDuration()];
    let a = 0; for (const c of clipList()) { a += clipDur(c); pts.push(a); }
    for (const l of state.texts) { if (l === skip) continue; const [s, e] = textRange(l); pts.push(s, e); }
    for (const au of state.audios || []) { if (au === skip) continue; const r = audioRange(au); pts.push(r[0], r[1]); }
    for (const sg of segList()) { if (sg === skip) continue; pts.push(+sg.start, +sg.end); }
    for (const mk of markerList()) pts.push(+mk.t);
    return pts;
  }
  function snapTime(t, pxPerSec) {
    let best = snapBeat(t, pxPerSec);
    if (best !== t || !ui.snap) return best;
    const tol = 8 / Math.max(1, pxPerSec), skip = tl.drag && (tl.drag.tx || tl.drag.a || tl.drag.sg);
    let bd = tol;
    for (const p of snapPoints(skip)) { const d = Math.abs(p - t); if (d < bd) { bd = d; best = p; } }
    showSnapLine(best !== t ? best : null);
    return best;
  }
  function showSnapLine(t) {
    let ln = $('#tlSnapLine');
    if (!ln) { ln = document.createElement('div'); ln.id = 'tlSnapLine'; ln.className = 'tl-snapline'; $('#tlInner').appendChild(ln); }
    if (t == null) { ln.style.display = 'none'; return; }
    const r = $('#tlTrack').getBoundingClientRect(), inner = $('#tlInner').getBoundingClientRect();
    ln.style.display = 'block';
    ln.style.left = `${r.left - inner.left + (t / (tl.scale || totalDuration())) * r.width}px`;
    clearTimeout(showSnapLine.timer);
    showSnapLine.timer = setTimeout(() => { ln.style.display = 'none'; }, 700);
  }
  function bindSnap() {
    const b = $('#tlSnap');
    b.classList.toggle('active', ui.snap);
    b.addEventListener('click', () => {
      ui.snap = !ui.snap; b.classList.toggle('active', ui.snap);
      try { localStorage.setItem('yog:snap', ui.snap ? '1' : '0'); } catch (_) { /* abaikan */ }
      toast(ui.snap ? 'Magnet aktif 🧲' : 'Magnet mati');
    });
  }

  // =========================================================
  //  YOG-EDITZ: lapisan efek & filter di timeline (berlaku untuk seluruh layar)
  // =========================================================
  ui.selSeg = '';
  const segList = () => (Array.isArray(state.segs) ? state.segs : (state.segs = []));
  const segById = (id) => segList().find((s) => s.id === id);
  const segName = (s) => (s.kind === 'filter' ? (FILTERS[s.v] || [s.v])[0] : EFFECTS[s.v] || s.v);
  // lapisan aktif pada t (yang ditambahkan terakhir menang)
  function segAt(t, kind) {
    let hit = null;
    for (const s of segList()) if (s.kind === kind && t >= s.start && t < s.end) hit = s;
    return hit;
  }
  function withSegs(spec, t) {
    const fx = segAt(t, 'fx'), fl = segAt(t, 'filter');
    if (!fx && !fl) return spec;
    const o = { ...spec };
    if (fx) { o.segFx = fx.v; o.segFxAmt = fx.amt == null ? 60 : +fx.amt; }
    if (fl) { o.segFilter = fl.v; o.segFilterAmt = fl.amt == null ? 100 : +fl.amt; }
    return o;
  }
  function addSeg(kind, v) {
    const total = Math.max(1, totalDuration());
    let a = player.t >= total - 0.3 ? 0 : player.t;
    const s = { id: newId(), kind, v, amt: kind === 'fx' ? +$('#fxGridAmt').value : +$('#flGridAmt').value, start: r1Fine(a), end: r1Fine(Math.min(total, a + 3)) };
    if (s.end - s.start < 0.5) { s.start = r1Fine(Math.max(0, total - 3)); s.end = r1Fine(total); }
    segList().push(s);
    selectSeg(s.id);
    save(); refresh();
    if (typeof playRange === 'function') playRange(s.start, s.end);
    toast(`${kind === 'fx' ? 'Efek' : 'Filter'} "${segName(s)}" ditambahkan di timeline`, 'success');
  }
  function selectSeg(id) {
    ui.selSeg = id; ui.focus = 'seg';
    ui.selClip = ''; ui.selAudio = ''; ui.selText = '';
    updateClipBar(); updateAudioBar(); updateTextBar(); updateMvBar();
    if (!tl.drag) renderTimeline(tl.scale || undefined);
  }
  let segBarKey = '';
  function updateSegBar() {
    const bar = $('#segBar'); if (!bar) return;
    const s = ui.focus === 'seg' ? segById(ui.selSeg) : null;
    bar.classList.toggle('hidden', !s);
    if (!s) { segBarKey = ''; return; }
    const key = JSON.stringify(s);
    if (key === segBarKey || (bar.contains(document.activeElement) && /INPUT/.test(document.activeElement.tagName) && document.activeElement.type !== 'range')) return;
    segBarKey = key;
    const opts = s.kind === 'fx' ? Object.entries(EFFECTS).map(([v, n]) => [v, n]) : Object.entries(FILTERS).map(([v, [n]]) => [v, n]);
    bar.innerHTML = `
      <span class="clip-name">${s.kind === 'fx' ? '✦ Efek' : '◑ Filter'}: ${esc(segName(s))}</span>
      <button data-sg="dup" class="tool ghost" title="Duplikat (ditaruh sesudahnya)">⧉ Duplikat</button>
      <button data-sg="del" class="tool ghost" title="Hapus (Delete)">🗑 Hapus</button>
      <label>${s.kind === 'fx' ? 'Jenis efek' : 'Jenis filter'} <select data-sf="v">${opts.map(([v, n]) => `<option value="${esc(v)}"${v === s.v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label>Kekuatan <input data-sf="amt" type="range" min="0" max="100" step="5" value="${s.amt == null ? (s.kind === 'fx' ? 60 : 100) : s.amt}" /><output>${s.amt == null ? '' : s.amt}</output></label>
      <label class="half">Mulai (dtk) <input data-sf="start" type="number" min="0" step="0.1" value="${(+s.start).toFixed(2)}" /></label>
      <label class="half">Selesai (dtk) <input data-sf="end" type="number" min="0" step="0.1" value="${(+s.end).toFixed(2)}" /></label>
      <button data-sg="try" class="tool">▶ Putar bagian ini</button>
      <button data-sg="full" class="tool ghost" title="Rentangkan ke seluruh video">↔ Seluruh video</button>
      <p class="muted tb-note">Lapisan ini berlaku untuk seluruh layar pada rentang waktunya, menimpa efek/filter klip. Geser baloknya di track Efek, tarik tepinya untuk mengubah panjang.</p>`;
  }
  // =========================================================
  //  YOG-EDITZ: kurva kecepatan (speed ramp) per klip
  // =========================================================
  // titik [posisi 0..1 pada durasi klip di timeline, pengali kecepatan]
  const CURVES = {
    montage: ['Montage', [[0, 1], [0.25, 2.5], [0.5, 0.6], [0.75, 2.5], [1, 1]]],
    hero: ['Hero', [[0, 1.6], [0.38, 1.6], [0.5, 0.25], [0.62, 1.6], [1, 1.6]]],
    bullet: ['Bullet', [[0, 2.5], [0.42, 2.5], [0.5, 0.2], [0.58, 2.5], [1, 2.5]]],
    jump: ['Lompat', [[0, 0.6], [0.44, 0.6], [0.5, 3], [0.56, 0.6], [1, 0.6]]],
    flashIn: ['Flash masuk', [[0, 3], [0.4, 1], [1, 1]]],
    flashOut: ['Flash keluar', [[0, 1], [0.6, 1], [1, 3]]],
  };
  function clipVolAt(c, local) {
    if (!c) return 1;
    if (c.mute) return 0;
    const v = c.vol == null ? 1 : +c.vol, D = clipDur(c), fi = +c.fadeIn || 0, fo = +c.fadeOut || 0;
    let k = 1;
    if (fi > 0) k = Math.min(k, clamp(local / fi));
    if (fo > 0) k = Math.min(k, clamp((D - local) / fo));
    return v * k;
  }
  const curvePts = (c) => (c && c.curve && !c.rev && !c.freeze && CURVES[c.curve] ? CURVES[c.curve][1] : null);
  function curveRate(pts, u) {
    u = clamp(u);
    for (let i = 0; i < pts.length - 1; i++) {
      const [u0, v0] = pts[i], [u1, v1] = pts[i + 1];
      if (u <= u1) return v0 + (v1 - v0) * ((u - u0) / Math.max(1e-9, u1 - u0));
    }
    return pts[pts.length - 1][1];
  }
  // ∫0^u v(x) dx (sepotong-sepotong linear)
  function curveCum(pts, u) {
    u = clamp(u); let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [u0, v0] = pts[i], [u1, v1] = pts[i + 1];
      if (u <= u0) break;
      const e = Math.min(u, u1), ve = v0 + (v1 - v0) * ((e - u0) / Math.max(1e-9, u1 - u0));
      acc += (e - u0) * (v0 + ve) / 2;
      if (u <= u1) break;
    }
    return acc;
  }
  const curveAvg = (pts) => curveCum(pts, 1);
  // detik di file sumber pada detik lokal tau (0..durasi klip) untuk klip berkurva
  const curveSrc = (c, tau) => { const pts = curvePts(c), D = clipDur(c); return (+c.in || 0) + (+c.speed || 1) * D * curveCum(pts, tau / D); };
  // panjang bagian file yang dipakai klip
  function clipSrcSpan(c) { const p = curvePts(c); return clipDur(c) * (+c.speed || 1) * (p ? curveAvg(p) : 1); }
  function setClipCurve(c, name) {
    const S = clipSrcSpan(c), sp = +c.speed || 1;
    if (!name || !CURVES[name]) { delete c.curve; c.dur = r1Fine(Math.max(0.3, S / sp)); return; }
    c.curve = name; c.rev = false; c.freeze = false;
    c.dur = r1Fine(Math.max(0.3, S / (sp * curveAvg(CURVES[name][1]))));
  }
  // kurva dilepas tapi isi video tetap sama (dipakai sebelum memotong klip berkurva)
  function flattenCurveAt(c, local) {
    const D = clipDur(c), s0 = +c.in || 0, sL = curveSrc(c, local), sE = curveSrc(c, D);
    delete c.curve;
    c.speed = Math.round(((sL - s0) / Math.max(0.05, local)) * 1000) / 1000;
    return Math.round(((sE - sL) / Math.max(0.05, D - local)) * 1000) / 1000;
  }
  const curveSvg = (pts, w = 64, h = 26) => {
    const max = 3.2, pl = pts.map(([u, v]) => `${(u * w).toFixed(1)},${(h - 2 - (Math.min(v, max) / max) * (h - 4)).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><line x1="0" x2="${w}" y1="${h - 2 - (1 / max) * (h - 4)}" y2="${h - 2 - (1 / max) * (h - 4)}" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="2 2"/><polyline points="${pl}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
  };
  let curveKey = '';
  function renderCurveBox() {
    const box = $('#curveBox'); if (!box) return;
    const c = clipById(ui.selClip);
    const it = c && mediaItem(c.mediaId);
    const key = c ? `${c.id}|${c.curve || ''}|${c.rev}|${c.freeze}|${it && it.kind}` : '';
    if (key === curveKey) return;
    curveKey = key;
    if (!c || !it || it.kind !== 'video') { box.innerHTML = '<p class="muted tb-note">Kurva kecepatan hanya untuk klip video.</p>'; return; }
    const cur = c.curve || '';
    box.innerHTML = `<div class="clip-sec">Kurva kecepatan</div>
      <div class="curve-grid">
        <button class="curve-tile${!cur ? ' active' : ''}" data-curve=""><span class="cv-none">⊘</span><small>Tanpa kurva</small></button>
        ${Object.entries(CURVES).map(([k, [n, pts]]) => `<button class="curve-tile${cur === k ? ' active' : ''}" data-curve="${k}" title="${esc(n)}">${curveSvg(pts)}<small>${esc(n)}</small></button>`).join('')}
      </div>
      <p class="muted tb-note">${c.rev || c.freeze ? 'Klip mundur / beku tidak bisa diberi kurva.' : 'Kecepatan berubah halus di sepanjang klip (garis putus-putus = kecepatan normal). Isi video tetap sama; durasi klip menyesuaikan.'}</p>`;
  }
  function bindCurveBox() {
    $('#curveBox').addEventListener('click', (e) => {
      const b = e.target.closest('[data-curve]'); const c = clipById(ui.selClip); if (!b || !c) return;
      if (c.rev || c.freeze) { toast('Matikan mundur / beku dulu untuk memakai kurva.', 'error'); return; }
      setClipCurve(c, b.dataset.curve);
      curveKey = '';
      renderScenes(); refresh(); updateClipBar();
      if (b.dataset.curve) { tryClip(c); toast(`Kurva "${CURVES[b.dataset.curve][0]}" dipasang`, 'success'); }
    });
  }

  // ---------- Properti overlay: tab "Tampilan & chroma" ----------
  let ovPaneKey = '';
  function renderOvPane(l) {
    const pane = $('#tbOv'); if (!pane) return;
    if (!l || !isOverlay(l)) { ovPaneKey = ''; pane.innerHTML = ''; return; }
    if (ovPaneKey === l.id && pane.firstChild) return;
    ovPaneKey = l.id;
    pane.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'ov-pane';
    const opts = (arr) => arr.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
    d.innerHTML = ovCardHtml(l, opts);
    pane.appendChild(d);
    bindOvCard(d, l);
  }

  const curveSrcFlat = (c, local) => (+c.in || 0) + local * (+c.speed || 1);
  // =========================================================
  //  YOG-EDITZ: hapus latar (AI), haluskan, hapus bising track audio
  // =========================================================
  let rmbgWorker = null, rmbgSeq = 0, rmbgBusy = false;
  function runRmbg(blob, onStatus) {
    return new Promise((resolve, reject) => {
      if (!rmbgWorker) rmbgWorker = new Worker('js/rmbg-worker.js', { type: 'module' });
      const id = ++rmbgSeq, files = {};
      rmbgWorker.onmessage = (e) => {
        const m = e.data; if (m.id !== id) return;
        if (m.type === 'progress' && m.p && m.p.status === 'progress' && m.p.total) {
          files[m.p.file] = [m.p.loaded, m.p.total];
          const v = Object.values(files), pct = (v.reduce((a, x) => a + x[0], 0) / v.reduce((a, x) => a + x[1], 0)) * 100;
          onStatus(`Mengunduh AI hapus latar… ${pct.toFixed(0)}% (sekali saja)`);
        } else if (m.type === 'status') onStatus(m.msg);
        else if (m.type === 'done') resolve(m);
        else if (m.type === 'error') reject(new Error(m.msg));
      };
      rmbgWorker.onerror = (e) => { rmbgWorker = null; reject(new Error(e.message || 'AI gagal dimuat')); };
      localServerAlive().then((alive) => rmbgWorker.postMessage({ id, blob, noLocal: !alive }));
    });
  }
  // foto → PNG transparan (latar dihapus)
  async function removeBgBlob(blob, onStatus) {
    const { mask, w, h } = await runRmbg(blob, onStatus);
    const bmp = await createImageBitmap(blob);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.drawImage(bmp, 0, 0, w, h);
    const img = g.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0, j = 3; i < mask.length; i++, j += 4) d[j] = Math.round((d[j] * mask[i]) / 255);
    g.putImageData(img, 0, 0);
    return new Promise((r) => cv.toBlob(r, 'image/png'));
  }
  async function withRmbg(btn, blob, done) {
    if (rmbgBusy) return;
    rmbgBusy = true;
    const label = btn.textContent; btn.disabled = true;
    const status = (msg) => { btn.textContent = msg.length > 34 ? msg.slice(0, 33) + '…' : msg; };
    try {
      if (location.protocol === 'file:') throw new Error('buka aplikasi lewat START.bat');
      const out = await removeBgBlob(blob, status);
      await done(out);
      toast('Latar dihapus ✂ (AI)', 'success');
    } catch (err) {
      console.error(err);
      const msg = String(err.message || err);
      toast(`Hapus latar gagal: ${msg}${/fetch|network|Failed|load/i.test(msg) ? ' → jalankan UNDUH-MODEL-AI.bat pilihan 5, lalu coba lagi.' : ''}`, 'error', 9000);
    } finally { rmbgBusy = false; btn.disabled = false; btn.textContent = label; }
  }
  const blobOfUrl = async (url) => (await fetch(url)).blob();
  // file baru di penyimpanan media (IndexedDB + elemen pemutar)
  function storeFile(blob, kind) {
    const id = newId(), entry = { el: null, ready: false, missing: false, url: '' };
    mediaEls.set(id, entry);
    attachBlob({ id, kind }, entry, blob);
    idbPut(id, blob).catch(() => {});
    return { id, entry };
  }
  // klip foto: buat media baru tanpa latar, klip menunjuk ke media itu
  async function rmbgClip(btn) {
    const c = clipById(ui.selClip), m = c && mediaItem(c.mediaId), e = m && mediaEls.get(m.id);
    if (!c || !m || m.kind !== 'image' || !e || !e.url) { toast('Hapus latar AI saat ini untuk klip FOTO.', 'error'); return; }
    await withRmbg(btn, await blobOfUrl(e.url), async (png) => {
      const { id } = storeFile(png, 'image');
      state.media.push({ ...m, id, name: m.name.replace(/\.[^.]+$/, '') + ' (tanpa latar).png' });
      c.rmbgFrom = c.rmbgFrom || m.id;
      c.mediaId = id;
      mediaLibKey = ''; renderScenes(); refresh(); updateClipBar();
    });
  }
  function restoreClipBg() {
    const c = clipById(ui.selClip); if (!c || !c.rmbgFrom || !mediaItem(c.rmbgFrom)) return;
    c.mediaId = c.rmbgFrom; delete c.rmbgFrom;
    mediaLibKey = ''; renderScenes(); refresh(); updateClipBar();
  }
  // overlay / stiker gambar
  async function rmbgLayer(btn) {
    const l = textById(ui.selText), e = l && mediaEls.get(l.fileId);
    if (!l || !l.fileId || l.media === 'video' || !e || !e.url) { toast('Hapus latar AI saat ini untuk FOTO / gambar.', 'error'); return; }
    await withRmbg(btn, await blobOfUrl(e.url), async (png) => {
      const { id } = storeFile(png, 'image');
      l.origFileId = l.origFileId || l.fileId;
      l.fileId = id;
      ovPaneKey = ''; renderScenes(); refresh(); updateTextBar();
    });
  }
  function restoreLayerBg() {
    const l = textById(ui.selText); if (!l || !l.origFileId) return;
    l.fileId = l.origFileId; delete l.origFileId;
    ovPaneKey = ''; renderScenes(); refresh(); updateTextBar();
  }
  // track audio: hapus bising (dari suara asli)
  let audCleaning = false;
  async function cleanAudioTrack() {
    const a = audioById(ui.selAudio); if (!a || audCleaning) return;
    const srcId = a.origFileId || a.fileId, e = mediaEls.get(srcId);
    if (!e || !e.url) { toast('Audio belum termuat.', 'error'); return; }
    audCleaning = true;
    const btn = $('#btnAudClean'), label = btn.textContent; btn.disabled = true;
    try {
      const buf = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(await (await fetch(e.url)).arrayBuffer());
      const strength = clamp((+$('#audDenoise').value || 0) / 100);
      const { sr, out } = await cleanVoiceBuffer(buf, strength, $('#audNorm').checked, (p) => { btn.textContent = `Memproses ${Math.round(p * 100)}%`; });
      const { id, entry } = storeFile(encodeWav(sr, out), 'audio');
      if (audio.ctx) routeAudioTrack(entry);
      a.origFileId = srcId; a.fileId = id;
      if (player.playing) syncAudioTracks(player.t, true);
      renderTimeline(); renderAudioList(); save(); updateAudioBar();
      toast('Bising dihapus ✨ Dengarkan, atau klik "Suara asli" untuk kembali.', 'success');
    } catch (err) {
      console.error(err); toast('Gagal memproses audio: format tidak bisa dibaca browser.', 'error', 6000);
    } finally { audCleaning = false; btn.disabled = false; btn.textContent = label; }
  }
  function restoreAudioTrack() {
    const a = audioById(ui.selAudio); if (!a || !a.origFileId) return;
    a.fileId = a.origFileId; delete a.origFileId;
    if (player.playing) syncAudioTracks(player.t, true);
    renderTimeline(); renderAudioList(); save(); updateAudioBar();
  }
  function bindP7() {
    $('#btnClipRmbg').addEventListener('click', (e) => rmbgClip(e.currentTarget));
    $('#btnClipRmbgUndo').addEventListener('click', restoreClipBg);
    $('#tbRmbg').addEventListener('click', (e) => rmbgLayer(e.currentTarget));
    $('#tbRmbgUndo').addEventListener('click', restoreLayerBg);
    $('#btnAudClean').addEventListener('click', cleanAudioTrack);
    $('#btnAudOrig').addEventListener('click', restoreAudioTrack);
    $('#audDenoise').addEventListener('input', () => { $('#audDenoiseOut').textContent = $('#audDenoise').value; });
  }

  // =========================================================
  //  YOG-EDITZ: pilih banyak (Ctrl+klik), salin/tempel, tempel atribut
  // =========================================================
  ui.multi = new Set(); // kunci: 'c:id' klip, 't:id' teks/stiker/overlay, 's:id' lapisan efek
  const keyOfBlock = (b) => (b.dataset.cid ? `c:${b.dataset.cid}` : b.dataset.seg ? `s:${b.dataset.seg}` : b.dataset.id ? `t:${b.dataset.id}` : '');
  const keyOfSel = () => (ui.focus === 'seg' && ui.selSeg ? `s:${ui.selSeg}` : ui.focus === 'text' && ui.selText ? `t:${ui.selText}` : ui.selClip ? `c:${ui.selClip}` : ui.selText ? `t:${ui.selText}` : '');
  function multiItems() {
    const out = { clips: [], texts: [], segs: [] };
    for (const k of ui.multi) {
      const [t, id] = [k[0], k.slice(2)];
      if (t === 'c' && clipById(id)) out.clips.push(clipById(id));
      if (t === 't' && textById(id)) out.texts.push(textById(id));
      if (t === 's' && segById(id)) out.segs.push(segById(id));
    }
    return out;
  }
  function markMulti() {
    $$('#tlTrack .tl-block.msel').forEach((b) => b.classList.remove('msel'));
    for (const k of ui.multi) {
      const [t, id] = [k[0], k.slice(2)];
      const sel = t === 'c' ? `[data-cid="${id}"]` : t === 's' ? `[data-seg="${id}"]` : `[data-id="${id}"]`;
      const b = $(`#tlTrack .tl-block${sel}`); if (b) b.classList.add('msel');
    }
    const info = $('#tlMultiInfo');
    if (info) { info.textContent = ui.multi.size > 1 ? `${ui.multi.size} dipilih` : ''; info.classList.toggle('hidden', ui.multi.size < 2); }
  }
  function clearMulti() { if (!ui.multi.size) return; ui.multi.clear(); markMulti(); }
  // Ctrl/⌘ + klik balok = tambah/buang dari pilihan
  function toggleMultiBlock(b) {
    const k = keyOfBlock(b); if (!k) return;
    if (!ui.multi.size) { const cur = keyOfSel(); if (cur && cur !== k) ui.multi.add(cur); }
    if (ui.multi.has(k)) ui.multi.delete(k); else ui.multi.add(k);
    markMulti();
    if (ui.multi.size > 1) toast(ui.multiTap ? `${ui.multi.size} dipilih • 🗑 hapus, ⧉ salin, atau pilih transisi/filter/efek untuk semua` : `${ui.multi.size} dipilih • Delete = hapus, Ctrl+C = salin, klik transisi/filter/efek = pasang ke semua klip terpilih`);
  }
  function deleteMulti() {
    const { clips, texts, segs } = multiItems();
    if (!clips.length && !texts.length && !segs.length) return false;
    state.clips = state.clips.filter((c) => !clips.includes(c));
    state.texts = state.texts.filter((t) => !texts.includes(t));
    state.segs = segList().filter((s) => !segs.includes(s));
    ui.selClip = ''; ui.selText = ''; ui.selSeg = ''; ui.focus = '';
    const n = clips.length + texts.length + segs.length;
    ui.multi.clear();
    renderScenes(); refresh(); updateClipBar(); updateTextBar();
    toast(`${n} item dihapus`, 'success');
    return true;
  }
  // klip yang dituju alat grid: semua klip terpilih (Ctrl+klik), atau klip terpilih
  function gridTargets() {
    const m = multiItems().clips;
    if (m.length) return m;
    const c = clipById(ui.selClip);
    return c ? [c] : [];
  }

  // ---------- salin / tempel ----------
  let clipboard = null;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function copySelection(cut) {
    let items = multiItems();
    if (!items.clips.length && !items.texts.length && !items.segs.length) {
      items = { clips: [], texts: [], segs: [] };
      if (ui.focus === 'seg' && segById(ui.selSeg)) items.segs.push(segById(ui.selSeg));
      else if (ui.focus === 'text' && textById(ui.selText)) items.texts.push(textById(ui.selText));
      else if (clipById(ui.selClip)) items.clips.push(clipById(ui.selClip));
      else if (textById(ui.selText)) items.texts.push(textById(ui.selText));
    }
    [...items.texts, ...items.segs].forEach((x) => { if (x.groupId) groupItems(x.groupId).forEach(({ k, item }) => { const arr = k === 't' ? items.texts : items.segs; if (!arr.includes(item)) arr.push(item); }); });
    const n = items.clips.length + items.texts.length + items.segs.length;
    if (!n) { toast('Pilih klip, teks, atau lapisan dulu.'); return; }
    const t0 = Math.min(...items.texts.map((t) => textRange(t)[0]), ...items.segs.map((s) => +s.start), Infinity);
    clipboard = { clips: items.clips.map((c) => ({ ...clone(c), dur: r1Fine(clipDur(c)) })), texts: clone(items.texts), segs: clone(items.segs), t0: isFinite(t0) ? t0 : 0 };
    if (cut) { ui.multi = new Set([...items.clips.map((c) => `c:${c.id}`), ...items.texts.map((t) => `t:${t.id}`), ...items.segs.map((s) => `s:${s.id}`)]); deleteMulti(); }
    toast(`${n} item ${cut ? 'dipotong' : 'disalin'} • Ctrl+V untuk menempel`, 'success');
  }
  function pasteClipboard() {
    if (!clipboard) { toast('Belum ada yang disalin (Ctrl+C).'); return; }
    const off = player.t - clipboard.t0;
    const newKeys = [];
    const gmap = {};
    const regroup = (n) => { if (n.groupId) n.groupId = gmap[n.groupId] || (gmap[n.groupId] = newId()); };
    if (clipboard.clips.length) {
      const sel = clipById(ui.selClip);
      let at = sel ? state.clips.indexOf(sel) + 1 : state.clips.length;
      for (const c of clipboard.clips) {
        if (!mediaItem(c.mediaId)) continue;
        const n = { ...clone(c), id: newId() };
        state.clips.splice(at++, 0, n); newKeys.push(`c:${n.id}`);
      }
      if (state.bg.type !== 'media' && clipList().length) state.bg.type = 'media';
    }
    for (const t of clipboard.texts) {
      const n = { ...clone(t), id: newId() };
      const len = textRange(t)[1] - textRange(t)[0];
      n.start = r1Fine(Math.max(0, +t.start + off)); n.end = r1Fine(n.start + len);
      if (n.fileId && !mediaEls.get(n.fileId)) continue;
      regroup(n);
      state.texts.push(n); newKeys.push(`t:${n.id}`);
    }
    for (const sg of clipboard.segs) {
      const n = { ...clone(sg), id: newId() };
      const len = sg.end - sg.start;
      n.start = r1Fine(Math.max(0, +sg.start + off)); n.end = r1Fine(n.start + len);
      regroup(n);
      segList().push(n); newKeys.push(`s:${n.id}`);
    }
    if (!newKeys.length) { toast('Media sumber sudah tidak ada.', 'error'); return; }
    ui.multi = new Set(newKeys.length > 1 ? newKeys : []);
    const k = newKeys[0], id = k.slice(2);
    renderScenes(); refresh();
    if (k[0] === 'c') selectClip(id, false); else if (k[0] === 't') selectText(id, false); else selectSeg(id);
    markMulti();
    toast(`${newKeys.length} item ditempel`, 'success');
  }
  // tempel atribut: filter, efek, warna, transisi, kurva (klip) • gaya & animasi (teks)
  let attrBoard = null;
  function copyAttrs() {
    const t0 = textById(ui.selText), c = ui.focus === 'text' && t0 ? null : clipById(ui.selClip), t = c ? null : t0;
    if (c) attrBoard = { kind: 'clip', v: clone({ filter: c.filter, filterAmt: c.filterAmt, fx: c.fx, fxAmt: c.fxAmt, adj: c.adj, trans: c.trans, transDur: c.transDur, animIn: c.animIn, animInDur: c.animInDur, animOut: c.animOut, animOutDur: c.animOutDur, animCombo: c.animCombo, animComboDur: c.animComboDur, mask: c.mask, maskSize: c.maskSize, maskFeather: c.maskFeather, maskX: c.maskX, maskY: c.maskY, maskInvert: c.maskInvert }) };
    else if (t && !isSticker(t)) attrBoard = { kind: 'text', v: clone({ style: t.style, animIn: t.animIn, animOut: t.animOut, animInDur: t.animInDur, animOutDur: t.animOutDur }) };
    else { toast('Pilih klip atau teks sumber atribut.'); return; }
    toast('Atribut disalin • pilih tujuan lalu Ctrl+Alt+V', 'success');
  }
  function pasteAttrs() {
    if (!attrBoard) { copyAttrs(); return; }
    const apply = (o) => { Object.entries(attrBoard.v).forEach(([k, v]) => { if (v === undefined) delete o[k]; else o[k] = clone(v); }); };
    let n = 0;
    if (attrBoard.kind === 'clip') { const ts = gridTargets(); ts.forEach(apply); n = ts.length; }
    else { const m = multiItems().texts; const ts = m.length ? m : [textById(ui.selText)].filter(Boolean); ts.filter((t) => !isSticker(t)).forEach((t) => { apply(t); n++; }); }
    if (!n) { toast(`Pilih ${attrBoard.kind === 'clip' ? 'klip' : 'teks'} tujuan dulu.`); return; }
    save(); refresh(); updateClipBar(); updateTextBar(); renderFxList(true);
    toast(`Atribut ditempel ke ${n} ${attrBoard.kind === 'clip' ? 'klip' : 'teks'}`, 'success');
  }

  async function detachClipAudio(btn) {
    const c = clipById(ui.selClip), m = c && mediaItem(c.mediaId), e = m && mediaEls.get(m.id);
    if (!c || !m || m.kind !== 'video' || !e || !e.url) return;
    if ((+c.speed || 1) !== 1 || c.curve || c.rev || c.freeze) { toast('Pisahkan audio untuk klip berkecepatan normal (tanpa kurva / mundur / beku).', 'error', 6000); return; }
    const label = btn.textContent; btn.disabled = true; btn.textContent = 'Memisahkan…';
    try {
      const blob = await (await fetch(e.url)).blob();
      const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await blob.arrayBuffer()).catch(() => null);
      if (!buf) { toast('Video ini tidak punya suara.', 'error'); return; }
      const [a0] = clipRange(c);
      const sel = ui.selClip;
      const a = addAudioFile(blob, `${m.name.replace(/\.[^.]+$/, '')} (audio)`, a0);
      a.in = +c.in || 0; a.dur = r1Fine(clipDur(c)); a.vol = c.vol == null ? 1 : +c.vol;
      if (c.fadeIn) a.fadeIn = c.fadeIn; if (c.fadeOut) a.fadeOut = c.fadeOut;
      c.mute = true;
      selectAudio(a.id);
      renderTimeline(); refresh();
      void sel;
      toast('Audio dipisahkan 🎵 — track audio baru di timeline, klip video dibisukan', 'success');
    } finally { btn.disabled = false; btn.textContent = label; }
  }
  function bindClipAudio() {
    const cur = () => clipById(ui.selClip);
    const live = () => { save(); syncVideos(player.t, true); updateClipBar(); renderTimeline(); };
    $('#clipVol').addEventListener('input', (e) => { const c = cur(); if (!c) return; c.vol = +e.target.value; if (c.vol > 0) c.mute = false; live(); });
    $('#clipMute').addEventListener('change', (e) => { const c = cur(); if (!c) return; c.mute = e.target.checked; live(); });
    $('#clipFadeIn').addEventListener('change', (e) => { const c = cur(); if (!c) return; c.fadeIn = clamp(+e.target.value || 0, 0, 10); live(); });
    $('#clipFadeOut').addEventListener('change', (e) => { const c = cur(); if (!c) return; c.fadeOut = clamp(+e.target.value || 0, 0, 10); live(); });
    $('#btnClipDetach').addEventListener('click', (e) => detachClipAudio(e.currentTarget));
  }
  // =========================================================
  //  YOG-EDITZ: template video (slot media → klip + transisi + teks + efek)
  // =========================================================
  // teks: [isi, mulai(dtk) atau 'end', lama, indeks TEXT_TEMPLATES]
  const VIDEO_TEMPLATES = [
    { id: 'kenangan', name: 'Kenangan', desc: 'Slideshow lembut, zoom pelan', icon: '🌅', slots: 5, per: 2.6, trans: 'fade', td: 0.8, filter: 'warm', kb: true,
      texts: [['Kenangan indah', 0.2, 3, 7]], segs: [] },
    { id: 'beat', name: 'Beat cepat', desc: 'Potongan cepat + kilat', icon: '⚡', slots: 8, per: 0.7, trans: 'flash', td: 0.15, filter: 'vivid',
      texts: [["LET'S GO!", 0, 1.4, 2]], segs: [['fx', 'zoomPulse', 0, 'all', 50]] },
    { id: 'vlog', name: 'Vlog harian', desc: 'Geser antar klip + judul', icon: '🎒', slots: 4, per: 3, trans: 'slideLeft', td: 0.5, filter: 'none',
      texts: [['VLOG HARIAN', 0.2, 2.6, 3], ['Terima kasih sudah menonton', 'end', 2.6, 1]], segs: [] },
    { id: 'sinema', name: 'Sinematik', desc: 'Lewat hitam, nuansa film', icon: '🎬', slots: 3, per: 4, trans: 'black', td: 1, filter: 'cinematic', film: true,
      texts: [['SEBUAH CERITA', 0.5, 3, 5]], segs: [['fx', 'leak', 0, 'all', 35]] },
    { id: 'beforeafter', name: 'Sebelum – sesudah', desc: 'Dua foto, sapu tengah', icon: '↔', slots: 2, per: 2.5, trans: 'wipe', td: 0.6, filter: 'none',
      texts: [['SEBELUM', 0.1, 2.3, 3], ['SESUDAH', 2.6, 2.3, 3]], segs: [] },
    { id: 'promo', name: 'Promo produk', desc: 'Zoom + teks jualan', icon: '🛍', slots: 4, per: 2, trans: 'zoom', td: 0.4, filter: 'vivid',
      texts: [['PROMO', 0.1, 1.8, 0], ['Diskon 50%', 2.1, 1.8, 2], ['Pesan sekarang!', 'end', 1.9, 4]], segs: [['fx', 'shine', 0, 'all', 40]] },
  ];
  let vtplSel = null;
  function buildVideoTemplates() {
    const box = $('#vtplGrid'); if (!box) return;
    box.innerHTML = VIDEO_TEMPLATES.map((t) => `<button class="vtpl-card" data-vt="${t.id}"><span class="vtpl-ico">${t.icon}</span><b>${esc(t.name)}</b><small>${esc(t.desc)}</small><em>${t.slots} media • ${(t.slots * t.per - (t.slots - 1) * 0).toFixed(0)} dtk</em></button>`).join('');
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-vt]'); if (b) openVideoTemplate(b.dataset.vt); });
    $('#vtplCancel').addEventListener('click', () => { vtplSel = null; $('#vtplSlots').classList.add('hidden'); $$('.vtpl-card').forEach((x) => x.classList.remove('active')); });
    $('#vtplAuto').addEventListener('click', () => { if (!vtplSel) return; vtplSel.fill = autoFillSlots(vtplSel.t.slots); renderSlots(); });
    $('#vtplApply').addEventListener('click', applyVideoTemplate);
    $('#vtplSlotList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-slot]'); if (!b || !vtplSel) return;
      const i = +b.dataset.slot, ids = state.media.map((m) => m.id);
      if (!ids.length) { toast('Impor media dulu di kategori Media.', 'error'); return; }
      const cur = ids.indexOf(vtplSel.fill[i]);
      vtplSel.fill[i] = ids[(cur + 1) % ids.length]; // klik = ganti ke media berikutnya
      renderSlots();
    });
  }
  const autoFillSlots = (n) => { const ids = state.media.map((m) => m.id); return Array.from({ length: n }, (_, i) => (ids.length ? ids[i % ids.length] : '')); };
  function openVideoTemplate(id) {
    const t = VIDEO_TEMPLATES.find((x) => x.id === id); if (!t) return;
    vtplSel = { t, fill: autoFillSlots(t.slots) };
    $$('.vtpl-card').forEach((x) => x.classList.toggle('active', x.dataset.vt === id));
    $('#vtplSlots').classList.remove('hidden');
    $('#vtplTitle').textContent = `${t.icon} ${t.name}`;
    renderSlots();
  }
  function renderSlots() {
    const t = vtplSel.t;
    $('#vtplSlotList').innerHTML = vtplSel.fill.map((mid, i) => {
      const m = mediaItem(mid), e = m && mediaEls.get(m.id);
      const th = !m ? '<span>＋</span>' : m.kind === 'image' && e && e.url ? `<img src="${e.url}" alt="" />` : `<span>${m.kind === 'video' ? '🎬' : '🖼'}</span>`;
      return `<button class="vtpl-slot${m ? '' : ' empty'}" data-slot="${i}" title="${m ? esc(m.name) + ' — klik untuk ganti' : 'Kosong — klik untuk memilih media'}">${th}<small>${i + 1}</small></button>`;
    }).join('');
    const empty = !state.media.length;
    $('#vtplHint').textContent = empty ? 'Perpustakaan masih kosong: impor foto/video dulu di kategori Media.' : `Klik kotak untuk mengganti medianya (berputar di antara media perpustakaan). Durasi ±${(t.slots * t.per).toFixed(1)} dtk.`;
    $('#vtplApply').disabled = empty;
  }
  function applyVideoTemplate() {
    if (!vtplSel) return;
    const t = vtplSel.t, ids = vtplSel.fill.filter((id) => mediaItem(id));
    if (!ids.length) { toast('Impor media dulu.', 'error'); return; }
    if ((clipList().length || state.texts.length) && !confirm(`Template "${t.name}" akan mengganti isi timeline (klip, teks, lapisan efek). Lanjutkan? (bisa di-Undo)`)) return;
    state.clips = ids.map((id, i) => {
      const c = newClip(id, { dur: t.per, trans: i ? t.trans : 'none', transDur: t.td });
      if (t.filter && t.filter !== 'none') { c.filter = t.filter; c.filterAmt = 80; }
      if (t.kb) c.kf = i % 2 ? [{ t: 0, z: 118, x: 4, y: 0 }, { t: t.per, z: 104, x: -4, y: 0 }] : [{ t: 0, z: 104, x: -4, y: 0 }, { t: t.per, z: 118, x: 4, y: 0 }];
      return c;
    });
    state.bg.type = 'media'; state.bg.mediaMode = 'timed'; state.bg.mediaId = ids[0];
    const total = ids.length * t.per;
    state.texts = t.texts.map(([txt, at, len, ti]) => {
      const a = at === 'end' ? Math.max(0, total - len) : Math.min(at, Math.max(0, total - 0.5));
      const tx = newText(txt, '', a, Math.min(total, a + len));
      const tp = TEXT_TEMPLATES[ti];
      if (tp) { tx.style = { ...tp[2] }; tx.animIn = tp[3]; tx.animOut = tp[4]; }
      return tx;
    });
    state.segs = t.segs.map(([kind, v, a, b, amt]) => ({ id: newId(), kind, v: EFFECTS[v] || FILTERS[v] ? v : 'none', amt, start: a, end: b === 'all' ? r1Fine(total) : b }));
    state.effects.frame = t.film ? 'film' : (state.effects.frame === 'film' ? 'none' : state.effects.frame);
    ui.selClip = ''; ui.selText = ''; ui.selSeg = ''; ui.focus = ''; ui.multi.clear();
    mediaLibKey = '';
    state.texts.forEach((tx) => { const st = textStyleOf(tx); document.fonts.load(`${st.weight} 40px "${st.font}"`).finally(() => { if (!player.playing) render(player.t); }); });
    renderScenes(); syncControls(); refresh();
    seekTo(0); play(true);
    toast(`Template "${t.name}" dipakai 🎬 — semua bisa diubah di timeline`, 'success');
  }

  // =========================================================
  //  YOG-EDITZ: animasi klip (masuk / keluar / kombo) & mask klip utama
  // =========================================================
  const CLIP_ANIM_IN = [['', 'Tanpa'], ['fadeIn', 'Pudar masuk'], ['zoomIn', 'Zoom masuk'], ['zoomOut', 'Zoom dari besar'], ['slideL', 'Geser dari kiri'], ['slideR', 'Geser dari kanan'],
    ['slideU', 'Naik dari bawah'], ['slideD', 'Turun dari atas'], ['spin', 'Putar masuk'], ['bounce', 'Memantul'], ['swingIn', 'Ayun masuk']];
  const CLIP_ANIM_OUT = [['', 'Tanpa'], ['fadeOut', 'Pudar keluar'], ['zoomOut', 'Zoom keluar'], ['zoomIn', 'Mengecil'], ['slideL', 'Geser ke kiri'], ['slideR', 'Geser ke kanan'],
    ['slideU', 'Naik keluar'], ['slideD', 'Turun keluar'], ['spin', 'Putar keluar']];
  const CLIP_ANIM_COMBO = [['', 'Tanpa'], ['pulse', 'Denyut'], ['sway', 'Goyang'], ['shake', 'Getar'], ['swing', 'Ayun'], ['zoomLoop', 'Zoom maju-mundur'], ['float', 'Melayang']];
  const CLIP_MASKS = [['none', 'Tanpa mask'], ['circle', 'Lingkaran'], ['ellipse', 'Oval'], ['rounded', 'Sudut bulat'], ['square', 'Persegi'], ['heart', 'Hati'], ['star', 'Bintang'], ['diamond', 'Belah ketupat'], ['band', 'Garis (pita)'], ['film', 'Film (layar lebar)']];
  // keadaan animasi klip pada detik lokal → { a: alpha, s: skala, r: putar (rad), dx, dy } atau null
  function clipAnimState(c, local) {
    if (!c || (!c.animIn && !c.animOut && !c.animCombo)) return null;
    const W = canvas.width, H = canvas.height, D = clipDur(c);
    const st = { a: 1, s: 1, r: 0, dx: 0, dy: 0 };
    if (c.animIn) {
      const d = clamp(+c.animInDur || 0.6, 0.1, Math.max(0.1, D * 0.9)), p = clamp(local / d), e = easeOut(p);
      if (p < 1) {
        const k = c.animIn;
        if (k === 'fadeIn') st.a *= e;
        else if (k === 'zoomIn') { st.s *= 0.55 + 0.45 * e; st.a *= clamp(p * 2); }
        else if (k === 'zoomOut') { st.s *= 1.6 - 0.6 * e; st.a *= clamp(p * 2); }
        else if (k === 'slideL') st.dx += -(1 - e) * W;
        else if (k === 'slideR') st.dx += (1 - e) * W;
        else if (k === 'slideU') st.dy += (1 - e) * H;
        else if (k === 'slideD') st.dy += -(1 - e) * H;
        else if (k === 'spin') { st.r += -(1 - e) * Math.PI; st.s *= 0.3 + 0.7 * e; st.a *= clamp(p * 2); }
        else if (k === 'bounce') { st.s *= Math.max(0.01, easeOutBack(p)); st.a *= clamp(p * 3); }
        else if (k === 'swingIn') { st.r += -(1 - easeOutBack(p)) * 0.6; st.a *= clamp(p * 2); }
      }
    }
    if (c.animOut) {
      const d = clamp(+c.animOutDur || 0.6, 0.1, Math.max(0.1, D * 0.9)), q = clamp((D - local) / d);
      if (q < 1) {
        const e = easeOut(q), k = c.animOut;
        if (k === 'fadeOut') st.a *= e;
        else if (k === 'zoomOut') { st.s *= 1 + (1 - e) * 0.6; st.a *= clamp(q * 2); }
        else if (k === 'zoomIn') { st.s *= 0.4 + 0.6 * e; st.a *= clamp(q * 2); }
        else if (k === 'slideL') st.dx += -(1 - e) * W;
        else if (k === 'slideR') st.dx += (1 - e) * W;
        else if (k === 'slideU') st.dy += -(1 - e) * H;
        else if (k === 'slideD') st.dy += (1 - e) * H;
        else if (k === 'spin') { st.r += (1 - e) * Math.PI; st.s *= 0.3 + 0.7 * e; st.a *= clamp(q * 2); }
      }
    }
    if (c.animCombo) {
      const per = clamp(+c.animComboDur || 1.2, 0.3, 10), ph = (local / per) * Math.PI * 2, k = c.animCombo;
      if (k === 'pulse') st.s *= 1 + 0.05 * (0.5 - 0.5 * Math.cos(ph));
      else if (k === 'sway') st.r += 0.04 * Math.sin(ph);
      else if (k === 'shake') { st.dx += Math.sin(ph * 7.3) * W * 0.012; st.dy += Math.cos(ph * 9.1) * H * 0.008; }
      else if (k === 'swing') st.r += 0.09 * Math.sin(ph);
      else if (k === 'zoomLoop') st.s *= 1.06 + 0.06 * Math.sin(ph);
      else if (k === 'float') st.dy += Math.sin(ph) * H * 0.015;
    }
    return st;
  }
  function applyClipAnim(st) {
    if (!st) return;
    const W = canvas.width, H = canvas.height;
    ctx.translate(W / 2 + st.dx, H / 2 + st.dy);
    if (st.r) ctx.rotate(st.r);
    if (st.s !== 1) ctx.scale(st.s, st.s);
    ctx.translate(-W / 2, -H / 2);
    ctx.globalAlpha *= clamp(st.a);
  }
  const clipBufs = [];
  function clipBuf(i) {
    const W = canvas.width, H = canvas.height;
    let b = clipBufs[i];
    if (!b) { const c = document.createElement('canvas'); b = clipBufs[i] = { c, g: c.getContext('2d') }; }
    if (b.c.width !== W || b.c.height !== H) { b.c.width = W; b.c.height = H; }
    b.g.setTransform(1, 0, 0, 1, 0, 0); b.g.globalAlpha = 1; b.g.filter = 'none'; b.g.globalCompositeOperation = 'source-over';
    b.g.clearRect(0, 0, W, H);
    return b;
  }
  function drawClipMask(g, c) {
    const W = canvas.width, H = canvas.height, k = clamp(+c.maskSize || 0.8, 0.1, 2);
    const fe = clamp(+c.maskFeather || 0) * Math.min(W, H) * 0.08;
    g.filter = fe > 0.5 ? `blur(${fe.toFixed(1)}px)` : 'none';
    g.fillStyle = '#fff';
    const ox = (+c.maskX || 0) * W, oy = (+c.maskY || 0) * H;
    if (c.mask === 'band' || c.mask === 'film') {
      const bh = c.mask === 'film' ? Math.min(H, W / 2.35) * k : H * 0.32 * k;
      g.fillRect(-W, H / 2 - bh / 2 + oy, W * 3, bh);
    } else {
      g.save();
      g.translate(W / 2 + ox, H / 2 + oy); g.scale(k, k); g.translate(-W / 2, -H / 2);
      const side = Math.min(W, H);
      const ww = c.mask === 'ellipse' || c.mask === 'rounded' ? W : side, hh = c.mask === 'ellipse' || c.mask === 'rounded' ? H : side;
      g.translate((W - ww) / 2, (H - hh) / 2);
      maskPath(g, c.mask, ww, hh, 0);
      g.fill();
      g.restore();
    }
    g.filter = 'none';
  }
  // pembungkus: klip utama dengan animasi / mask digambar lewat sini
  function drawClipCanvas(t, bg, c) {
    const W = canvas.width, H = canvas.height;
    ctx.save();
    if (c.canvasBg === 'color') { ctx.fillStyle = c.canvasColor || '#000000'; ctx.fillRect(0, 0, W, H); ctx.restore(); return; }
    const item = mediaItem(bg.mediaId), e = item && mediaEls.get(item.id);
    const el = e && e.el, sw = el && (el.videoWidth || el.naturalWidth), sh = el && (el.videoHeight || el.naturalHeight);
    if (!e || !e.ready || !sw || !sh) { ctx.restore(); return; }
    const k = Math.max(W / sw, H / sh) * 1.12;
    ctx.filter = `blur(${((6 + (+c.canvasBlur || 2) * 9) * W / 1080).toFixed(1)}px) brightness(0.8)`;
    try { ctx.drawImage(el, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k); } catch (_) { /* abaikan */ }
    ctx.restore();
  }
  function drawBgLayer(t, bg) {
    const c = bg.clip;
    if (c && c.canvasBg) drawClipCanvas(t, bg, c);
    const anim = c ? clipAnimState(c, t - (bg.mStart || 0)) : null;
    const masked = !!(c && c.mask && c.mask !== 'none');
    if (!anim && !masked) { drawBgLayerFx(t, bg); return; }
    if (!masked) { ctx.save(); applyClipAnim(anim); drawBgLayerFx(t, bg); ctx.restore(); return; }
    const buf = clipBuf(0), main = ctx;
    ctx = buf.g;
    try { drawBgLayerFx(t, bg); } finally { ctx = main; }
    const mk = clipBuf(1);
    drawClipMask(mk.g, c);
    buf.g.globalCompositeOperation = c.maskInvert ? 'destination-out' : 'destination-in';
    buf.g.drawImage(mk.c, 0, 0);
    buf.g.globalCompositeOperation = 'source-over';
    ctx.save(); applyClipAnim(anim); ctx.drawImage(buf.c, 0, 0); ctx.restore();
  }
  // ---------- Properti: animasi klip & mask ----------
  function fillClipAnimUi(c) {
    const set = (id, v) => { const el = $(id); if (el && document.activeElement !== el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v; } };
    set('#clipAnimIn', c.animIn || ''); set('#clipAnimInDur', +c.animInDur || 0.6);
    set('#clipAnimOut', c.animOut || ''); set('#clipAnimOutDur', +c.animOutDur || 0.6);
    set('#clipAnimCombo', c.animCombo || ''); set('#clipAnimComboDur', +c.animComboDur || 1.2);
    set('#clipMask', c.mask || 'none'); set('#clipMaskSize', c.maskSize == null ? 0.8 : c.maskSize); set('#clipMaskFeather', +c.maskFeather || 0);
    set('#clipMaskX', +c.maskX || 0); set('#clipMaskY', +c.maskY || 0); set('#clipMaskInvert', c.maskInvert);
    const on = !!(c.mask && c.mask !== 'none');
    $$('#clipBar .mask-opt').forEach((el) => el.classList.toggle('hidden', !on));
  }
  function bindClipCanvas() {
    const cur = () => clipById(ui.selClip);
    const live = () => { save(); if (!player.playing) render(player.t); updateClipBar(); };
    $('#clipCanvas').addEventListener('change', (e) => { const c = cur(); if (!c) return; if (e.target.value) c.canvasBg = e.target.value; else delete c.canvasBg; if (c.canvasBg && (+c.z || 100) >= 100 && !(c.kf && c.kf.length)) toast('Tip: perkecil Skala klip (di bawah 100%) agar latar kanvas terlihat.'); live(); });
    $('#clipCanvasColor').addEventListener('input', (e) => { const c = cur(); if (!c) return; c.canvasColor = e.target.value; live(); });
    $('#clipCanvasBlur').addEventListener('input', (e) => { const c = cur(); if (!c) return; c.canvasBlur = +e.target.value; live(); });
    $('#btnCanvasAll').addEventListener('click', () => { const c = cur(); if (!c) return; clipList().forEach((x) => { ['canvasBg', 'canvasColor', 'canvasBlur'].forEach((k) => { if (c[k] != null) x[k] = c[k]; else delete x[k]; }); }); live(); toast('Latar kanvas dipakai di semua klip', 'success'); });
  }
  function bindClipAnim() {
    bindClipCanvas();
    const opts = (arr) => arr.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
    $('#clipAnimIn').innerHTML = opts(CLIP_ANIM_IN); $('#clipAnimOut').innerHTML = opts(CLIP_ANIM_OUT); $('#clipAnimCombo').innerHTML = opts(CLIP_ANIM_COMBO);
    $('#clipMask').innerHTML = opts(CLIP_MASKS);
    const cur = () => clipById(ui.selClip);
    const live = (tryIt) => { save(); if (!player.playing) render(player.t); updateClipBar(); renderTimeline(); if (tryIt) { const c = cur(); if (c) tryClip(c); } };
    const bindSel = (id, key, tryIt = true) => $(id).addEventListener('change', (e) => { const c = cur(); if (!c) return; if (e.target.value) c[key] = e.target.value; else delete c[key]; live(tryIt); });
    bindSel('#clipAnimIn', 'animIn'); bindSel('#clipAnimOut', 'animOut'); bindSel('#clipAnimCombo', 'animCombo');
    bindSel('#clipMask', 'mask', false);
    [['#clipAnimInDur', 'animInDur', 0.1, 5], ['#clipAnimOutDur', 'animOutDur', 0.1, 5], ['#clipAnimComboDur', 'animComboDur', 0.3, 10]].forEach(([id, key, lo, hi]) => $(id).addEventListener('change', (e) => { const c = cur(); if (!c) return; c[key] = clamp(+e.target.value || lo, lo, hi); live(true); }));
    [['#clipMaskSize', 'maskSize'], ['#clipMaskFeather', 'maskFeather'], ['#clipMaskX', 'maskX'], ['#clipMaskY', 'maskY']].forEach(([id, key]) => $(id).addEventListener('input', (e) => { const c = cur(); if (!c) return; c[key] = +e.target.value; save(); if (!player.playing) render(player.t); }));
    $('#clipMaskInvert').addEventListener('change', (e) => { const c = cur(); if (!c) return; c.maskInvert = e.target.checked; live(false); });
  }

  // =========================================================
  //  YOG-EDITZ: grup lapisan (teks, stiker, overlay, lapisan efek)
  // =========================================================
  const GROUP_COLORS = ['#ffd166', '#06d6a0', '#ef476f', '#4cc9f0', '#c77dff', '#f8961e'];
  function groupItems(gid) {
    if (!gid) return [];
    return [...state.texts.filter((t) => t.groupId === gid).map((item) => ({ k: 't', item })), ...segList().filter((x) => x.groupId === gid).map((item) => ({ k: 's', item }))];
  }
  const groupKeys = (gid) => groupItems(gid).map(({ k, item }) => `${k}:${item.id}`);
  const groupColor = (gid) => { let h = 0; for (const ch of String(gid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return GROUP_COLORS[h % GROUP_COLORS.length]; };
  function groupSelection() {
    const { clips, texts, segs } = multiItems();
    const items = [...texts, ...segs];
    if (items.length < 2) { toast('Pilih minimal 2 teks / stiker / overlay / lapisan efek dengan Ctrl+klik, lalu Ctrl+G.'); return; }
    const gid = newId();
    items.forEach((x) => { x.groupId = gid; });
    save(); renderTimeline(); markMulti();
    toast(`${items.length} lapisan dikelompokkan 🔗${clips.length ? ' (klip track utama tidak ikut grup)' : ''}`, 'success');
  }
  function ungroupSelection() {
    const m = multiItems();
    let items = [...m.texts, ...m.segs];
    if (!items.length) { const t = textById(ui.selText), sg = segById(ui.selSeg); items = [ui.focus === 'seg' ? sg : t].filter(Boolean); }
    const gids = new Set(items.map((x) => x.groupId).filter(Boolean));
    if (!gids.size) { toast('Lapisan terpilih tidak ada di grup.'); return; }
    gids.forEach((gid) => groupItems(gid).forEach(({ item }) => { delete item.groupId; }));
    ui.multi.clear();
    save(); renderTimeline(); markMulti();
    toast('Grup dibubarkan', 'success');
  }
  // klik anggota grup → seluruh grup terpilih
  function selectGroupOf(item) {
    if (!item || !item.groupId) return;
    ui.multi = new Set(groupKeys(item.groupId));
    markMulti();
  }
  // anggota lain yang ikut bergeser saat satu anggota diseret
  function groupDragInfo(item) {
    if (!item || !item.groupId) return null;
    const others = groupItems(item.groupId).filter((g) => g.item !== item).map(({ k, item: it }) => {
      const r = k === 't' ? textRange(it) : [+it.start, +it.end];
      return { item: it, s0: r[0], e0: r[1] };
    });
    if (!others.length) return null;
    return { others, minS0: Math.min(...others.map((o) => o.s0)) };
  }
  function shiftGroup(d, startNow, start0, rr) {
    if (!d.grp) return startNow;
    let delta = startNow - start0;
    delta = Math.max(delta, -Math.min(start0, d.grp.minS0));
    for (const o of d.grp.others) { const L = o.e0 - o.s0; o.item.start = rr(o.s0 + delta); o.item.end = rr(o.item.start + L); }
    return rr(start0 + delta);
  }
  function markGroups() {
    $$('#tlTrack .tl-block.grouped').forEach((b) => { b.classList.remove('grouped'); b.style.removeProperty('--gc'); });
    for (const t of state.texts) if (t.groupId) { const b = $(`#tlTrack .tl-block[data-id="${t.id}"]`); if (b) { b.classList.add('grouped'); b.style.setProperty('--gc', groupColor(t.groupId)); } }
    for (const x of segList()) if (x.groupId) { const b = $(`#tlTrack .tl-block[data-seg="${x.id}"]`); if (b) { b.classList.add('grouped'); b.style.setProperty('--gc', groupColor(x.groupId)); } }
  }

  function bindPreviewQuality() {
    const sel = $('#previewQuality'); if (!sel) return;
    sel.value = String(ui.previewScale);
    sel.addEventListener('change', () => {
      ui.previewScale = clamp(+sel.value || 1, 0.25, 1);
      try { localStorage.setItem('yog:pq', String(ui.previewScale)); } catch (_) { /* abaikan */ }
      if (!player.playing) render(player.t);
      toast(ui.previewScale < 1 ? `Pratinjau ${ui.previewScale === 0.5 ? '½' : '¼'} — lebih ringan. Hasil export tetap resolusi penuh.` : 'Pratinjau kualitas penuh');
    });
  }
  function bindWelcome() {
    $('#btnWelcomeImport').addEventListener('click', () => { document.querySelector('.tab[data-tab=bg]').click(); $('#fileMediaTop').click(); });
  }
  // ---------- Tampilan HP: kategori di bawah, panel & Properti sebagai lembar bawah ----------
  const isPhoneUi = () => window.matchMedia('(max-width: 760px)').matches;
  function closeInspector() {
    ui.selClip = ''; ui.selText = ''; ui.selSeg = ''; ui.selAudio = ''; ui.focus = '';
    if (ui.multi) ui.multi.clear();
    renderScenes(); refresh(); updateClipBar(); updateTextBar(); updateAudioBar(); updateMvBar();
  }
  function bindMobile() {
    const panel = $('.panel'), body = $('.panel .panel-body'), nav = $('.panel .tabs');
    if (!panel || !body || !nav) return;
    const head = document.createElement('div');
    head.className = 'm-sheet-head';
    head.innerHTML = '<span class="m-grip"></span><b id="mSheetTitle"></b><button id="mSheetClose" class="ghost small" title="Tutup">✕</button>';
    body.before(head);
    const setOpen = (on) => {
      document.body.classList.toggle('m-panel', on);
      if (on) { const a = $('.panel .tab.active span'); $('#mSheetTitle').textContent = a ? a.textContent : ''; }
    };
    // fase capture: status tab dibaca sebelum tab berganti → klik tab yang sama menutup lembar
    nav.addEventListener('click', (e) => {
      const t = e.target.closest('.tab'); if (!t || !isPhoneUi()) return;
      const reopen = !(t.classList.contains('active') && document.body.classList.contains('m-panel'));
      setTimeout(() => setOpen(reopen));
    }, true);
    $('#mSheetClose').addEventListener('click', () => setOpen(false));
    $('#inspClose').addEventListener('click', closeInspector);
    // menyentuh timeline / pemutar menutup lembar kategori agar Properti bisa tampil
    ['#timeline', '.stage'].forEach((sel) => $(sel).addEventListener('pointerdown', () => { if (isPhoneUi() && document.body.classList.contains('m-panel')) setOpen(false); }, true));
    // tombol impor di layar sambutan membuka lembar Media
    $('#btnWelcomeImport').addEventListener('click', () => { if (isPhoneUi()) setTimeout(() => setOpen(true)); });
    window.matchMedia('(max-width: 760px)').addEventListener('change', (e) => { if (!e.matches) { setOpen(false); setMultiTap(false); } if (!tl.drag) renderTimeline(tl.scale || undefined); });

    // --- pilih banyak: mode Pilih (ketuk = tambah/lepas), salin & tempel ---
    const setMultiTap = (on) => {
      ui.multiTap = on;
      $('#tlPick').classList.toggle('active', on);
      document.body.classList.toggle('m-picking', on);
      if (!on) clearMulti();
      else toast('Mode pilih: ketuk beberapa klip/teks untuk memilih sekaligus. Ketuk ☑ lagi untuk selesai.');
    };
    $('#tlPick').addEventListener('click', () => setMultiTap(!ui.multiTap));
    $('#tlCopy').addEventListener('click', () => copySelection(false));
    $('#tlPaste').addEventListener('click', () => pasteClipboard());

    // --- seret media dari perpustakaan ke timeline: tekan lama lalu geser ---
    const lib = $('#mediaLib');
    let hold = null, drag = null;
    const stopHold = () => { if (hold) { clearTimeout(hold.timer); hold = null; } };
    const finishDrag = () => { if (drag) { drag.ghost.remove(); drag = null; $('#timeline').classList.remove('drop-ok'); document.body.classList.remove('m-dragging'); } };
    lib.addEventListener('contextmenu', (e) => { if (isPhoneUi() && e.target.closest('.ml-item')) e.preventDefault(); });
    lib.addEventListener('touchstart', (e) => {
      const card = e.target.closest('.ml-item');
      if (!card || e.touches.length !== 1 || e.target.closest('button')) return;
      const t0 = e.touches[0];
      stopHold();
      hold = { x: t0.clientX, y: t0.clientY, timer: setTimeout(() => {
        const img = card.querySelector('img');
        const ghost = document.createElement('div');
        ghost.className = 'm-drag-ghost';
        ghost.innerHTML = img ? `<img src="${img.src}" alt="" />` : '🎬';
        document.body.appendChild(ghost);
        drag = { id: card.dataset.id, ghost };
        hold = null;
        ghost.style.transform = `translate(${t0.clientX - 32}px, ${t0.clientY - 60}px)`;
        document.body.classList.add('m-dragging');
        setOpen(false); // tampilkan timeline untuk tempat menjatuhkan
        try { navigator.vibrate && navigator.vibrate(25); } catch (_) { /* abaikan */ }
      }, 380) };
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (hold) { const t = e.touches[0]; if (Math.hypot(t.clientX - hold.x, t.clientY - hold.y) > 10) stopHold(); return; }
      if (!drag) return;
      e.preventDefault();
      const t = e.touches[0];
      drag.ghost.style.transform = `translate(${t.clientX - 32}px, ${t.clientY - 60}px)`;
      const r = $('#timeline').getBoundingClientRect();
      $('#timeline').classList.toggle('drop-ok', t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom);
    }, { passive: false });
    document.addEventListener('touchend', (e) => {
      stopHold();
      if (!drag) return;
      const t = e.changedTouches[0], r = $('#timeline').getBoundingClientRect(), id = drag.id;
      const inside = t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom;
      finishDrag();
      if (inside) dropMediaAt(id, t.clientX, t.clientY);
      else toast('Lepaskan di atas timeline untuk menambahkan media.');
    });
    document.addEventListener('touchcancel', () => { stopHold(); finishDrag(); });

    // --- cubit dua jari di timeline = zoom ---
    const tbox = $('#timeline');
    let tp = null;
    const dist2 = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY) || 1;
    tbox.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      tp = { d0: dist2(e.touches), z0: tl.zoom };
      ui.pinching = true;
    }, { passive: false });
    tbox.addEventListener('touchmove', (e) => {
      if (!tp || e.touches.length < 2) return;
      e.preventDefault();
      const ax = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      setZoom(tp.z0 * (dist2(e.touches) / tp.d0), ax);
    }, { passive: false });
    const tEnd = (e) => { if (tp && e.touches.length < 2) { tp = null; setTimeout(() => { ui.pinching = false; }, 0); } };
    tbox.addEventListener('touchend', tEnd);
    tbox.addEventListener('touchcancel', tEnd);
  }
  function bindSegBar() {
    bindWelcome();
    bindPreviewQuality();
    bindClipAnim();
    bindClipAudio();
    bindP7();
    bindCurveBox();
    $('#audTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-ptab]'); if (!b) return; $('#audioBar').dataset.pt = b.dataset.ptab; $$('#audTabs [data-ptab]').forEach((x) => x.classList.toggle('active', x === b)); });
    const bar = $('#segBar');
    const cur = () => segById(ui.selSeg);
    const changed = () => { save(); renderTimeline(); if (!player.playing) render(player.t); };
    bar.addEventListener('input', (e) => {
      const el = e.target.closest('[data-sf]'), s = cur(); if (!el || !s) return;
      if (el.dataset.sf === 'amt') { s.amt = +el.value; const o = el.parentElement.querySelector('output'); if (o) o.textContent = el.value; changed(); }
    });
    bar.addEventListener('change', (e) => {
      const el = e.target.closest('[data-sf]'), s = cur(); if (!el || !s) return;
      const k = el.dataset.sf;
      if (k === 'v') s.v = el.value;
      if (k === 'start') s.start = r1Fine(clamp(+el.value || 0, 0, s.end - 0.2));
      if (k === 'end') s.end = r1Fine(Math.max(s.start + 0.2, +el.value || 0));
      segBarKey = ''; changed(); updateSegBar();
    });
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sg]'), s = cur(); if (!b || !s) return;
      const a = b.dataset.sg;
      if (a === 'try') { if (typeof playRange === 'function') playRange(s.start, s.end); return; }
      if (a === 'del') { state.segs = segList().filter((x) => x !== s); ui.selSeg = ''; ui.focus = ''; }
      if (a === 'dup') { const len = s.end - s.start; const c = { ...s, id: newId(), start: s.end, end: r1Fine(s.end + len) }; segList().push(c); ui.selSeg = c.id; }
      if (a === 'full') { s.start = 0; s.end = r1Fine(totalDuration()); }
      segBarKey = ''; save(); refresh(); updateTextBar();
    });
  }

  // ---------- Template teks: sekali klik = teks bergaya + animasi ----------
  const TEXT_TEMPLATES = [
    ['Judul besar', 'JUDUL VIDEO', { ...TEXT_PRESETS[8][1], size: 120 }, 'pop', 'zoomOut'],
    ['Subjudul', 'Subjudul di sini', { ...TEXT_PRESETS[1][1], size: 56, weight: '600' }, 'slideUp', 'fade'],
    ['Kuning viral', 'TONTON SAMPAI HABIS!', { ...TEXT_PRESETS[3][1], size: 84 }, 'pop', 'popOut'],
    ['Label kotak', 'Info penting', { ...TEXT_PRESETS[4][1], size: 60 }, 'slideLeft', 'slideLeftOut'],
    ['Catatan putih', 'Catatan', { ...TEXT_PRESETS[5][1], size: 58 }, 'zoom', 'shrink'],
    ['Neon malam', 'NEON', { ...TEXT_PRESETS[6][1], size: 110, font: 'Bebas Neue' }, 'flickerIn', 'flickerOut'],
    ['Mesin ketik', 'Mengetik kata demi kata…', { ...TEXT_PRESETS[0][1], font: 'Montserrat', size: 58 }, 'typewriter', 'fade'],
    ['Tulisan tangan', 'terima kasih', { ...TEXT_PRESETS[9][1], size: 96 }, 'riseBlur', 'blur'],
    ['Gradasi', 'Keren banget', { ...TEXT_PRESETS[7][1], size: 92 }, 'stretchIn', 'zoomOut'],
    ['Glitch', 'ERROR 404', { ...TEXT_PRESETS[2][1], font: 'Bebas Neue', size: 110 }, 'glitchIn', 'glitchOut'],
  ];
  function buildTextTemplates() {
    const box = $('#txTplGrid'); if (!box) return;
    box.innerHTML = TEXT_TEMPLATES.map(([n, t, st], i) => {
      const p = { ...defaultStyle(), ...st };
      return `<button class="tx-tpl" data-tt="${i}" title="${esc(n)}"><span style="font-family:'${esc(p.font)}';font-weight:${p.weight};color:${p.color};${p.boxBg ? `background:${p.boxColor};padding:1px 5px;border-radius:3px;` : ''}${p.stroke ? `-webkit-text-stroke:1px ${p.strokeColor};` : ''}${p.glow ? `text-shadow:0 0 8px ${p.color};` : ''}${p.textGradient ? `background:linear-gradient(${p.color},${p.color2});-webkit-background-clip:text;color:transparent;` : ''}${p.uppercase ? 'text-transform:uppercase;' : ''}">${esc(t.length > 14 ? t.slice(0, 13) + '…' : t)}</span><small>${esc(n)}</small></button>`;
    }).join('');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tt]'); if (!b) return;
      const [, text, st, inA, outA] = TEXT_TEMPLATES[+b.dataset.tt];
      const total = Math.max(1, totalDuration());
      const a = player.t >= total - 0.5 ? 0 : player.t;
      const tx = newText(text, '', a, Math.min(total, a + 4));
      if (tx.end - tx.start < 1) { tx.start = r1(Math.max(0, total - 4)); tx.end = r1(total); }
      tx.style = { ...st }; tx.animIn = inA; tx.animOut = outA;
      state.texts.push(tx);
      ui.selText = tx.id; ui.focus = 'text';
      document.fonts.load(`${textStyleOf(tx).weight} 40px "${textStyleOf(tx).font}"`).finally(() => { if (!player.playing) render(player.t); });
      renderScenes(); refresh(); updateTextBar();
      if (typeof playRange === 'function') playRange(tx.start, Math.min(tx.end, tx.start + 2.5));
      toast(`Template "${b.title}" ditambahkan`, 'success');
    });
  }

  function bindTextBar() {
    bindTextStylePanes();
    bindSegBar();
    buildTextTemplates();
    bindSnap();
    const cur = () => (freeMode() ? textById(ui.selText) : null);
    const cardBtn = (act) => { const tx = cur(); const b = tx && $(`#sceneList .scene[data-id="${tx.id}"] [data-act="${act}"]`); if (b) b.click(); };
    $('#tbText').addEventListener('input', (e) => { const tx = cur(); if (tx) { tx.text = e.target.value; refresh(); } });
    $('#tbText').addEventListener('change', () => renderScenes());
    $('#tbStart').addEventListener('change', (e) => { const tx = cur(); if (!tx) return; tx.start = r1Fine(clamp(+e.target.value || 0, 0, textRange(tx)[1] - 0.3)); renderScenes(); refresh(); });
    $('#tbEnd').addEventListener('change', (e) => { const tx = cur(); if (!tx) return; tx.end = r1Fine(Math.max(textRange(tx)[0] + 0.3, +e.target.value || 0)); renderScenes(); refresh(); });
    [['#tbS', 's'], ['#tbR', 'r'], ['#tbO', 'o'], ['#tbX', 'x'], ['#tbY', 'y']].forEach(([id, k]) => {
      $(id).addEventListener('input', (e) => { const tx = cur(); if (tx) { editLayer(tx, { [k]: +e.target.value }); refresh(); } });
      $(id).addEventListener('change', () => renderScenes());
    });
    $('#tbCenter').addEventListener('click', () => cardBtn('center'));
    $('#tbKfAdd').addEventListener('click', () => {
      const tx = cur(); if (!tx) return;
      const [a0, b0] = textRange(tx);
      if (player.t < a0 || player.t > b0) { toast('Taruh playhead di dalam waktu tampil lapisan ini dulu.', 'error'); return; }
      const lt = r1Fine(player.t - a0), ks = tx.keys || [];
      const k = ks.find((q) => Math.abs(q.t - lt) < 0.06);
      if (k) {
        tx.keys = ks.filter((q) => q !== k);
        if (!tx.keys.length) Object.assign(tx, layerProps({ ...tx, keys: [k] }, 0));
        toast('Keyframe dihapus');
      } else {
        upsertKey(tx, lt, layerProps(tx, lt));
        toast(`Keyframe ◆ di ${player.t.toFixed(2)} dtk${tx.keys.length < 2 ? ' — pindah playhead lalu ubah posisi/ukuran untuk membuat gerakan' : ''}`, 'success');
      }
      renderScenes(); refresh(); updateTextBar();
    });
    const jumpKey = (dir) => {
      const tx = cur(); if (!tx || !(tx.keys || []).length) return;
      const a0 = textRange(tx)[0], lt = player.t - a0;
      const ts = tx.keys.map((k) => k.t).sort((x, y) => x - y);
      const tgt = dir < 0 ? ts.filter((v) => v < lt - 0.06).pop() : ts.find((v) => v > lt + 0.06);
      if (tgt != null) { if (player.playing) pause(); seekTo(a0 + tgt); updateTextBar(); }
    };
    $('#tbKfPrev').addEventListener('click', () => jumpKey(-1));
    $('#tbKfNext').addEventListener('click', () => jumpKey(1));
    $('#tbKfClear').addEventListener('click', () => {
      const tx = cur(); if (!tx || !(tx.keys || []).length) return;
      const P = layerProps(tx, layerLocal(tx)); tx.keys = []; Object.assign(tx, P);
      renderScenes(); refresh(); updateTextBar(); toast('Semua keyframe dihapus');
    });
    $('#tbUp').addEventListener('click', () => cardBtn('up'));
    $('#tbDup').addEventListener('click', () => cardBtn('dup'));
    $('#tbDel').addEventListener('click', () => { cardBtn('del'); ui.selText = ''; refresh(); });
    $('#tbStyle').addEventListener('click', () => { document.querySelector('[data-tab=teks]').click(); setTimeout(() => { const h = [...$$('#tab-teks > h3')].find((x) => /Gaya teks/.test(x.textContent)); if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); });
    $('#tbCard').addEventListener('click', () => {
      const tx = cur(); document.querySelector(`[data-tab=${tx && isSticker(tx) && !isOverlay(tx) ? 'teks' : 'teks'}]`).click();
      const card = tx && $(`#sceneList .scene[data-id="${tx.id}"]`);
      if (card) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    // fokus panel mengikuti balok yang diklik di timeline
    $('#tlTrack').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.tl-block');
      if (!b || e.ctrlKey || e.metaKey) return;
      ui.focus = b.dataset.seg ? 'seg' : b.dataset.aid ? 'audio' : b.dataset.cid || b.dataset.mid ? 'clip' : b.dataset.id ? 'text' : b.dataset.kind || ui.focus;
      if (ui.focus === 'text') ui.selText = b.dataset.id;
      updateTextBar();
    }, true);
  }

  function bindTimeline() {
    bindTextBar();
    bindMvBar();
    bindSubnav();
    const tbox = $('#timeline');
    // Ctrl + scroll = zoom di posisi kursor
    tbox.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(tl.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX);
    }, { passive: false });
    $('#tlZoom').addEventListener('input', (e) => setZoom(Math.pow(40, +e.target.value / 100)));
    $('#tlZoomIn').addEventListener('click', () => setZoom(tl.zoom * 1.5));
    $('#tlZoomOut').addEventListener('click', () => setZoom(tl.zoom / 1.5));
    $('#tlFit').addEventListener('click', () => { setZoom(1); tbox.scrollLeft = 0; });
    new ResizeObserver(() => { if (!tl.drag) renderTimeline(tl.scale || undefined); }).observe(tbox);
    // rasio di bawah pemutar
    const pr = $('#playerRatio');
    pr.value = state.ratio;
    pr.addEventListener('change', () => { state.ratio = pr.value; syncControls(); refresh(); });
    new MutationObserver(() => { if (pr.value !== state.ratio) pr.value = state.ratio; }).observe($('#ratioBadge'), { childList: true, characterData: true, subtree: true });
    const box = $('#timeline');
    const track = $('#tlTrack');
    const timeAt = (x) => {
      const r = track.getBoundingClientRect();
      return clamp((x - r.left) / r.width) * (tl.scale || totalDuration());
    };
    box.addEventListener('pointerdown', (e) => {
      if (player.exporting) return;
      if (e.target.closest('.tl-heads')) return;
      const blk = freeMode() && e.target.closest('#tlTrack .tl-block');
      if (blk && (e.ctrlKey || e.metaKey || ui.multiTap)) { e.preventDefault(); toggleMultiBlock(blk); return; }
      if (blk && ui.multi.size) clearMulti();
      box.setPointerCapture(e.pointerId);
      const h = e.target.closest('.tl-handle');
      const ab = freeMode() && e.target.closest('.tl-audio');
      if (ab) {
        const a = audioById(ab.dataset.aid);
        if (!a) return;
        selectAudio(a.id);
        const [s0, s1] = audioRange(a);
        tl.drag = { mode: h ? 'aresize' : 'amove', side: h && h.dataset.side, a, s0, s1, in0: +a.in || 0, x0: e.clientX, moved: false,
          pxPerSec: track.getBoundingClientRect().width / (tl.scale || totalDuration()), scale: tl.scale || totalDuration(), t0: timeAt(e.clientX), src: audioSrcDur(a) };
        if (h) box.classList.add('resizing');
        return;
      }
      const sgb = freeMode() && e.target.closest('.tl-seg');
      if (sgb) {
        const sg = segById(sgb.dataset.seg);
        if (!sg) return;
        selectSeg(sg.id);
        if (sg.groupId) selectGroupOf(sg);
        tl.drag = { mode: h ? 'sresize' : 'smove', side: h && h.dataset.side, sg, s0: +sg.start, e0: +sg.end, x0: e.clientX, moved: false,
          pxPerSec: track.getBoundingClientRect().width / (tl.scale || totalDuration()), scale: tl.scale || totalDuration(), t0: timeAt(e.clientX) };
        if (!h && sg.groupId) tl.drag.grp = groupDragInfo(sg);
        box.classList.add(h ? 'resizing' : 'moving');
        return;
      }
      const bgb = freeMode() && e.target.closest('.tl-bgblk');
      if (bgb) {
        const it = mediaItem(bgb.dataset.mid);
        if (!it) return;
        const clip = clipById(bgb.dataset.cid);
        const pxPerSec = track.getBoundingClientRect().width / (tl.scale || totalDuration());
        if (clip) {
          selectClip(clip.id, false);
          if (!h) { // geser = ubah urutan, klik = lompat
            tl.drag = { mode: 'cmove', clip, el: bgb, x0: e.clientX, moved: false, t0: timeAt(e.clientX), pxPerSec };
            return;
          }
          tl.drag = { mode: 'ctrim', side: h.dataset.side, clip, x0: e.clientX, moved: false, pxPerSec, scale: tl.scale || totalDuration(),
            d0: clipDur(clip), in0: +clip.in || 0, src: srcDuration(it) };
          box.classList.add('resizing');
          return;
        }
        if (!h) { // klik baris latar = pilih media & lompat ke titik itu
          selectMedia(it.id);
          tl.drag = { mode: 'seek' };
          seekTo(timeAt(e.clientX));
          return;
        }
        tl.drag = { mode: 'mresize', it, d0: mediaDur(it), x0: e.clientX, moved: false,
          pxPerSec: track.getBoundingClientRect().width / (tl.scale || totalDuration()), scale: tl.scale || totalDuration() };
        selectMedia(it.id);
        box.classList.add('resizing');
        return;
      }
      const fb = freeMode() && e.target.closest('.tl-block');
      if (fb) {
        const tx = textById(fb.dataset.id);
        if (!tx) return;
        const [s0, e0] = textRange(tx);
        tl.drag = { mode: h ? 'tresize' : 'tmove', side: h && h.dataset.side, tx, s0, e0, x0: e.clientX, moved: false,
          pxPerSec: track.getBoundingClientRect().width / (tl.scale || totalDuration()), scale: tl.scale || totalDuration(), t0: timeAt(e.clientX) };
        selectText(tx.id, false);
        if (tx.groupId) { selectGroupOf(tx); if (!h) tl.drag.grp = groupDragInfo(tx); }
        box.classList.add(h ? 'resizing' : 'moving');
        return;
      }
      if (h) {
        const i = +h.dataset.i;
        const total = totalDuration();
        tl.drag = { mode: 'resize', i, x0: e.clientX, d0: +state.scenes[i].duration, pxPerSec: track.getBoundingClientRect().width / total, scale: total };
        box.classList.add('resizing');
      } else {
        const sb = !freeMode() && e.target.closest('.tl-block[data-i]');
        if (sb) selectScene(+sb.dataset.i, false);
        tl.drag = { mode: 'seek' };
        seekTo(timeAt(e.clientX));
      }
    });
    box.addEventListener('pointermove', (e) => {
      const d = tl.drag;
      if (!d || ui.pinching) return;
      if (d.mode === 'seek') return seekTo(timeAt(e.clientX));
      if (d.mode === 'amove' || d.mode === 'aresize') {
        if (Math.abs(e.clientX - d.x0) > 3) d.moved = true;
        if (!d.moved) return;
        const dt = (e.clientX - d.x0) / d.pxPerSec, a = d.a, len = d.s1 - d.s0;
        if (d.mode === 'amove') a.start = r1Fine(Math.max(0, snapTime(d.s0 + dt, d.pxPerSec)));
        else if (d.side === 'ar') {
          let nl = Math.max(0.1, len + dt);
          if (d.src) nl = Math.min(nl, d.src - d.in0);
          a.dur = r1Fine(nl);
        } else { // potong awal: titik mulai di file ikut maju, akhir tetap
          const shift = clamp(dt, -Math.min(d.in0, d.s0), len - 0.1);
          a.in = r1Fine(d.in0 + shift); a.start = r1Fine(d.s0 + shift); a.dur = r1Fine(len - shift);
        }
        renderTimeline(Math.max(d.scale, totalDuration()));
        updateAudioBar();
        return;
      }
      if (d.mode === 'cmove') {
        if (Math.abs(e.clientX - d.x0) > 4) d.moved = true;
        if (d.moved) { d.el.style.transform = `translateX(${e.clientX - d.x0}px)`; d.el.style.zIndex = 5; d.el.style.opacity = 0.85; d.dropT = timeAt(e.clientX); }
        return;
      }
      if (d.mode === 'ctrim') {
        if (Math.abs(e.clientX - d.x0) > 3) d.moved = true;
        if (!d.moved) return;
        const dt = (e.clientX - d.x0) / d.pxPerSec, c = d.clip, sp = +c.speed || 1;
        if (c.freeze) c.dur = r1(Math.max(0.3, d.side === 'cr' ? d.d0 + dt : d.d0 - dt));
        else if (c.rev && d.src) {
          if (d.side === 'cr') { // tepi kanan = titik awal di file
            const ni = clamp(d.in0 - dt * sp, 0, d.in0 + (d.d0 - 0.3) * sp);
            c.in = Math.round(ni * 100) / 100;
            c.dur = r1(Math.max(0.3, d.d0 + (d.in0 - ni) / sp));
          } else c.dur = r1(clamp(d.d0 - dt, 0.3, (d.src - d.in0) / sp));
        } else if (d.side === 'cr') {
          const cs = (clipRange(c) || [0])[0];
          let nd = Math.max(0.3, snapBeat(cs + d.d0 + dt, d.pxPerSec) - cs);
          if (d.src) nd = Math.min(nd, (d.src - d.in0) / sp); // video tidak bisa lebih panjang dari sisa file
          c.dur = state.beat.snap && +state.beat.period > 0 ? Math.round(nd * 1000) / 1000 : r1(nd);
        } else if (d.src) { // trim awal video: titik mulai maju/mundur, akhir tetap
          const ni = clamp(d.in0 + dt * sp, 0, d.in0 + (d.d0 - 0.3) * sp);
          c.in = Math.round(ni * 100) / 100;
          c.dur = r1(Math.max(0.3, d.d0 - (ni - d.in0) / sp));
        } else c.dur = r1(Math.max(0.3, d.d0 - dt)); // foto: tepi kiri = durasi
        renderTimeline(Math.max(d.scale, totalDuration()));
        if (!player.playing) { syncVideos(player.t); render(player.t); }
        updateTimeUI();
        return;
      }
      if (d.mode === 'mresize') {
        if (Math.abs(e.clientX - d.x0) > 3) d.moved = true;
        if (!d.moved) return;
        d.it.dur = clamp(r1(d.d0 + (e.clientX - d.x0) / d.pxPerSec), 0.5, 600);
        renderTimeline(Math.max(d.scale, totalDuration()));
        if (!player.playing) render(player.t);
        updateTimeUI();
        return;
      }
      if (d.mode === 'smove' || d.mode === 'sresize') {
        if (Math.abs(e.clientX - d.x0) > 3) d.moved = true;
        if (!d.moved) return;
        const dt = (e.clientX - d.x0) / d.pxPerSec, len = d.e0 - d.s0, sg = d.sg, r3 = (v) => Math.round(v * 1000) / 1000;
        if (d.mode === 'smove') {
          let ns = snapTime(d.s0 + dt, d.pxPerSec);
          if (ns === d.s0 + dt) { const ne = snapTime(d.e0 + dt, d.pxPerSec); ns += ne - (d.e0 + dt); }
          sg.start = r3(Math.max(0, ns)); sg.end = r3(sg.start + len);
          if (d.grp) { sg.start = shiftGroup(d, sg.start, d.s0, r3); sg.end = r3(sg.start + len); }
        } else if (d.side === 'l') sg.start = r3(clamp(snapTime(d.s0 + dt, d.pxPerSec), 0, d.e0 - 0.2));
        else sg.end = r3(Math.max(d.s0 + 0.2, snapTime(d.e0 + dt, d.pxPerSec)));
        renderTimeline(Math.max(d.scale, totalDuration()));
        if (!player.playing) render(player.t);
        return;
      }
      if (d.mode === 'tmove' || d.mode === 'tresize') {
        if (Math.abs(e.clientX - d.x0) > 3) d.moved = true;
        if (!d.moved) return;
        const dt = (e.clientX - d.x0) / d.pxPerSec, len = d.e0 - d.s0, total = totalDuration();
        const snapped = state.beat.snap && +state.beat.period > 0 && state.beat.show !== false;
        const rr = (v) => (snapped || ui.snap ? Math.round(v * 1000) / 1000 : r1(v));
        if (d.mode === 'tmove') {
          let ns = snapTime(d.s0 + dt, d.pxPerSec);
          if (ns === d.s0 + dt) { const ne = snapTime(d.e0 + dt, d.pxPerSec); ns += ne - (d.e0 + dt); } // atau ujungnya yang menempel
          d.tx.start = rr(clamp(ns, 0, Math.max(0, total - len)));
          d.tx.end = rr(d.tx.start + len);
          if (d.grp) { d.tx.start = shiftGroup(d, d.tx.start, d.s0, rr); d.tx.end = rr(d.tx.start + len); }
        } else if (d.side === 'l') {
          d.tx.start = rr(clamp(snapTime(d.s0 + dt, d.pxPerSec), 0, d.e0 - 0.3));
        } else {
          d.tx.end = rr(clamp(snapTime(d.e0 + dt, d.pxPerSec), d.s0 + 0.3, 600));
          if (d.tx.end > total) state.duration = d.tx.end; // tarik melewati akhir = video diperpanjang
        }
        renderTimeline(Math.max(d.scale, totalDuration()));
        if (!player.playing) render(player.t);
        updateTimeUI();
        return;
      }
      const nd = clamp(Math.round((d.d0 + (e.clientX - d.x0) / d.pxPerSec) * 10) / 10, 0.5, 60);
      state.scenes[d.i].duration = nd;
      renderTimeline(Math.max(d.scale, totalDuration()));
      if (!player.playing) render(player.t);
      updateTimeUI();
    });
    const end = () => {
      if (!tl.drag) return;
      const d = tl.drag;
      const wasResize = d.mode === 'resize';
      tl.drag = null;
      box.classList.remove('resizing', 'moving');
      if (wasResize) { renderScenes(); refresh(); }
      if (d.mode === 'amove' || d.mode === 'aresize') {
        if (!d.moved) seekTo(d.t0);
        renderAudioList(); refresh(); updateAudioBar();
        if (player.playing) syncAudioTracks(player.t, true);
      }
      if (d.mode === 'mresize' || d.mode === 'ctrim') { mediaLibKey = ''; syncControls(); renderScenes(); refresh(); }
      if (d.mode === 'cmove') {
        if (!d.moved) seekTo(d.t0);
        else { // pindahkan klip ke posisi tempat dilepas
          const list = clipList().filter((c) => c !== d.clip);
          let acc = 0, idx = list.length;
          for (let k = 0; k < list.length; k++) { const cd = clipDur(list[k]); if (d.dropT < acc + cd / 2) { idx = k; break; } acc += cd; }
          const rest = state.clips.filter((c) => c !== d.clip);
          const before = list[idx];
          rest.splice(before ? rest.indexOf(before) : rest.length, 0, d.clip);
          state.clips = rest;
        }
        renderScenes(); refresh(); updateClipBar();
      }
      if (d.mode === 'smove' || d.mode === 'sresize') {
        if (!d.moved) seekTo(d.t0);
        segBarKey = ''; save(); refresh(); updateSegBar();
      }
      if (d.mode === 'tmove' || d.mode === 'tresize') {
        if (!d.moved) seekTo(d.t0); // klik saja = lompat ke titik itu
        renderScenes(); refresh();
      }
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    box.addEventListener('dblclick', (e) => {
      const b = e.target.closest('.tl-block');
      if (!b) return;
      if (freeMode() && b.dataset.id && !$('#tbTextWrap').classList.contains('hidden')) { $('#tbText').focus(); return; }
      document.querySelector('[data-tab=teks]').click();
      const ta = freeMode() ? $(`#sceneList .scene[data-id="${b.dataset.id}"] textarea`) : $$('#sceneList textarea')[+b.dataset.i];
      if (ta) { ta.focus(); ta.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    });
  }

  // =========================================================
  //  VISUALIZER: tarik langsung di preview + posisi cepat
  // =========================================================
  let vizDrag = null;
  function bindVizDrag() {
    const toCanvas = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height };
    };
    const hit = (p) => {
      if (!state.effects.visualizer || state.effects.visualizer === 'none') return false;
      const b = vizGeom().box, pad = canvas.width * 0.02;
      return p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;
    };
    // foto/video yang sedang tampil di preview bisa digeser & di-zoom
    const mediaBg = () => {
      const spec = specAt(player.t);
      if (spec.type !== 'media') return null;
      const item = mediaItem(spec.mediaId) || state.media[0];
      const e = item && mediaEls.get(item.id);
      return e && e.ready ? item : null;
    };
    let bgDrag = null, textDrag = null, pinch = null;
    const snap0 = (v) => (Math.abs(v) < 0.012 ? 0 : v); // magnet ke tengah
    const textHit = (p) => {
      if (!freeMode()) return null;
      const pad = canvas.width * 0.02;
      for (let k = ui.textBoxes.length - 1; k >= 0; k--) {
        const b = ui.textBoxes[k];
        if (p.x >= b.x0 - pad && p.x <= b.x1 + pad && p.y >= b.y0 - pad && p.y <= b.y1 + pad) return b;
      }
      return null;
    };

    canvas.addEventListener('pointerdown', (e) => {
      if (player.exporting || player.playing || pinch) return;
      const p = toCanvas(e);
      const tb = textHit(p);
      const tx = tb && textById(tb.id);
      if (tx) {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        const P0 = layerProps(tx, layerLocal(tx));
        textDrag = { tx, x0: p.x, y0: p.y, ix: P0.x, iy: P0.y };
        selectText(tx.id, false);
        canvas.style.cursor = 'move';
      } else if (hit(p)) {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        vizDrag = { dx: p.x - canvas.width * state.viz.x, dy: p.y - canvas.height * state.viz.y };
        render(player.t);
      } else {
        const item = mediaBg();
        if (!item) return;
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        bgDrag = { item, x0: p.x, y0: p.y, ix: +item.x || 0, iy: +item.y || 0 };
        selectMedia(item.id);
        canvas.style.cursor = 'grabbing';
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (pinch) return;
      const p = toCanvas(e);
      if (textDrag) {
        let x = clamp(textDrag.ix + (p.x - textDrag.x0) / canvas.width);
        let y = clamp(textDrag.iy + (p.y - textDrag.y0) / canvas.height);
        if (Math.abs(x - 0.5) < 0.015) x = 0.5; // magnet ke tengah
        if (Math.abs(y - 0.5) < 0.01) y = 0.5;
        editLayer(textDrag.tx, { x: +x.toFixed(4), y: +y.toFixed(4) });
        render(player.t);
        return;
      }
      if (bgDrag) {
        bgDrag.item.x = +snap0(clamp(bgDrag.ix + (p.x - bgDrag.x0) / canvas.width, -1, 1)).toFixed(3);
        bgDrag.item.y = +snap0(clamp(bgDrag.iy + (p.y - bgDrag.y0) / canvas.height, -1, 1)).toFixed(3);
        render(player.t);
        return;
      }
      if (!vizDrag) {
        canvas.style.cursor = player.playing ? '' : textHit(p) || hit(p) ? 'move' : mediaBg() ? 'grab' : '';
        return;
      }
      let x = clamp((p.x - vizDrag.dx) / canvas.width);
      const y = clamp((p.y - vizDrag.dy) / canvas.height);
      if (Math.abs(x - 0.5) < 0.015) x = 0.5; // magnet ke tengah
      state.viz.x = +x.toFixed(3);
      state.viz.y = +y.toFixed(3);
      render(player.t);
    });
    // scroll mouse di atas preview = zoom foto
    const tDist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY) || 1;
    const tAng = (ts) => (Math.atan2(ts[1].clientY - ts[0].clientY, ts[1].clientX - ts[0].clientX) * 180) / Math.PI;
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 2 || player.exporting || player.playing) return;
      e.preventDefault();
      // jari kedua: batalkan geser satu jari, kembalikan posisi awalnya
      if (textDrag) editLayer(textDrag.tx, { x: textDrag.ix, y: textDrag.iy });
      if (bgDrag) { bgDrag.item.x = bgDrag.ix; bgDrag.item.y = bgDrag.iy; }
      textDrag = null; bgDrag = null; vizDrag = null;
      const d0 = tDist(e.touches), a0 = tAng(e.touches);
      const layer = ui.focus === 'text' ? textById(ui.selText) : null;
      const clip = !layer && ui.focus === 'clip' ? clipById(ui.selClip) : null;
      if (layer) { const P = layerProps(layer, layerLocal(layer)); pinch = { layer, d0, a0, s0: P.s, r0: P.r }; }
      else if (clip) { const v = kfVals(clip, clipLocalT(clip)); pinch = { clip, d0, a0, z0: v.z, r0: v.r }; }
      else { const item = mediaBg(); if (item) pinch = { item, d0, z0: +item.zoom || 1 }; }
      ui.pinching = !!pinch;
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      if (!pinch || e.touches.length < 2) return;
      e.preventDefault();
      const k = tDist(e.touches) / pinch.d0;
      let da = tAng(e.touches) - pinch.a0;
      if (da > 180) da -= 360; if (da < -180) da += 360;
      const snapR = (r) => { const q = Math.round(r / 90) * 90; return Math.abs(r - q) < 4 ? q : Math.round(r); }; // magnet 0/90/180°
      if (pinch.layer) editLayer(pinch.layer, { s: +clamp(pinch.s0 * k, 0.1, 6).toFixed(3), r: snapR(pinch.r0 + da) });
      else if (pinch.clip) editClipView(pinch.clip, { z: Math.round(clamp(pinch.z0 * k, 10, 500)), r: snapR(pinch.r0 + da) });
      else pinch.item.zoom = +clamp(pinch.z0 * k, 0.3, 5).toFixed(3);
      render(player.t);
    }, { passive: false });
    const pinchEnd = (e) => {
      if (!pinch || e.touches.length >= 2) return;
      const was = pinch; pinch = null; ui.pinching = false;
      if (was.layer) syncLayerCard(); else if (was.clip) updateClipBar(); else syncControls();
      refresh();
    };
    canvas.addEventListener('touchend', pinchEnd);
    canvas.addEventListener('touchcancel', pinchEnd);
    canvas.addEventListener('wheel', (e) => {
      const lb = !player.exporting && !player.playing ? textHit(toCanvas(e)) : null;
      const layer = lb && textById(lb.id);
      if (layer) { // scroll di atas teks/stiker: ubah ukuran (Shift = putar)
        e.preventDefault();
        if (ui.selText !== layer.id) selectText(layer.id, false);
        const P = layerProps(layer, layerLocal(layer));
        if (e.shiftKey) editLayer(layer, { r: Math.round(P.r + (e.deltaY > 0 ? 3 : -3)) });
        else editLayer(layer, { s: +clamp(P.s * (1 - e.deltaY * 0.0012), 0.1, 6).toFixed(3) });
        render(player.t);
        syncLayerCard();
        save();
        return;
      }
      const item = player.exporting ? null : mediaBg();
      if (!item) return;
      e.preventDefault();
      if (ui.selMedia !== item.id) selectMedia(item.id);
      item.zoom = +clamp((+item.zoom || 1) * (1 - e.deltaY * 0.0012), 0.3, 5).toFixed(3);
      if (!player.playing) render(player.t);
      syncControls();
      save();
    }, { passive: false });
    const end = () => {
      if (textDrag) {
        textDrag = null;
        canvas.style.cursor = 'move';
        refresh();
        syncLayerCard();
        if (textById(ui.selText) && (textById(ui.selText).keys || []).length) renderScenes();
        return;
      }
      if (bgDrag) {
        bgDrag = null;
        canvas.style.cursor = 'grab';
        syncControls();
        refresh();
        return;
      }
      if (!vizDrag) return;
      vizDrag = null;
      syncControls();
      refresh();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    $('#btnImgCenter').addEventListener('click', () => {
      const it = selItem();
      if (!it) return;
      it.x = 0; it.y = 0;
      syncControls(); refresh();
    });
    $('#btnImgReset').addEventListener('click', () => {
      const it = selItem();
      if (!it) return;
      Object.assign(it, { x: 0, y: 0, zoom: 1, rotate: 0, flip: false, fit: 'cover' });
      syncControls(); refresh();
    });
    $('#btnColorReset').addEventListener('click', () => {
      Object.assign(state.bg, { bright: 1, contrast: 1, sat: 1 });
      syncControls(); refresh();
    });

    $('#vizPos').addEventListener('click', (e) => {
      const b = e.target.closest('[data-y]');
      if (!b) return;
      state.viz.x = 0.5;
      state.viz.y = b.dataset.y === 'text' ? clamp(+state.style.posY + 0.2, 0.05, 0.95) : +b.dataset.y;
      if (state.effects.visualizer === 'none') state.effects.visualizer = 'bars';
      syncControls();
      refresh();
    });
  }

  // durasi video bisa berubah sendiri (mis. metadata video baru termuat)
  function refreshDurations() {
    if (!freeMode()) return;
    updateLayoutUI();
    if (!tl.drag) renderTimeline();
    updateTimeUI();
    $('#totalDur').textContent = `Video ${totalDuration().toFixed(1)} dtk • ${state.texts.length} teks`;
  }

  // layar sambutan: tampil selama proyek benar-benar kosong
  function updateWelcome() {
    const w = $('#welcome'); if (!w) return;
    const empty = !clipList().length && !state.texts.length && !segList().length && !(state.audios || []).length && !music.src && !voice.src && state.bg.type !== 'gradient' && state.bg.type !== 'aurora' && state.bg.type !== 'waves';
    w.classList.toggle('hidden', !empty || player.exporting);
  }
  function refresh() {
    save();
    updateWelcome();
    renderFxList();
    updateSceneBar();
    updateClipBar();
    updateTextBar();
    updateMvBar();
    if (!tl.drag) renderTimeline();
    if (!player.playing) render(Math.min(player.t, totalDuration()));
    updateTimeUI();
    $('#totalDur').textContent = freeMode()
      ? `Video ${totalDuration().toFixed(1)} dtk • ${state.texts.filter((x) => !isSticker(x)).length} teks${stickerCount()}`
      : `Total ${totalDuration().toFixed(1)} dtk • ${state.scenes.length} scene`;
  }

  // =========================================================
  //  AUDIO (Web Audio agar musik ikut terekam)
  // =========================================================
  const audio = { ctx: null, src: null, gain: null, dest: null, analyser: null, freq: null, wave: null };
  function ensureAudioGraph() {
    if (audio.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new AC();
    audio.src = audio.ctx.createMediaElementSource(music);
    audio.gain = audio.ctx.createGain();
    audio.dest = audio.ctx.createMediaStreamDestination();
    audio.src.connect(audio.gain);
    audio.gain.connect(audio.ctx.destination);
    audio.gain.connect(audio.dest);
    // jalur voice-over (terpisah agar volumenya bisa diatur sendiri)
    audio.vsrc = audio.ctx.createMediaElementSource(voice);
    audio.vgain = audio.ctx.createGain();
    audio.vsrc.connect(audio.vgain);
    audio.vgain.connect(audio.ctx.destination);
    audio.vgain.connect(audio.dest);
    audio.analyser = audio.ctx.createAnalyser();
    audio.analyser.fftSize = 256;
    audio.analyser.smoothingTimeConstant = 0.75;
    audio.gain.connect(audio.analyser);
    audio.vgain.connect(audio.analyser); // visualizer juga bereaksi pada voice-over
    for (const e of mediaEls.values()) { routeVideoAudio(e); routeAudioTrack(e); }
    setVoiceFx();
    // modul pengubah nada dimuat di belakang; setelah siap jalur efek dibangun ulang
    loadPitch(audio.ctx).then((ok) => { if (ok) { setVoiceFx(); syncAudioTracks(player.t); } });
  }

  // ---------- Efek suara (dipakai di preview & export) ----------
  const AUDIO_FX = [['none', 'Tanpa efek'], ['echo', 'Gema'], ['reverb', 'Ruangan (reverb)'], ['radio', 'Telepon / radio'],
    ['robot', 'Robot'], ['bass', 'Bass kuat'], ['underwater', 'Bawah air']];
  const impulseCache = new Map();
  function impulse(ac, secs = 2.2) {
    const key = `${ac.sampleRate}`;
    if (ac instanceof AudioContext && impulseCache.has(key)) return impulseCache.get(key);
    const n = Math.floor(ac.sampleRate * secs), buf = ac.createBuffer(2, n, ac.sampleRate);
    const rnd = mulberry32(99);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / n, 3); }
    if (ac instanceof AudioContext) impulseCache.set(key, buf);
    return buf;
  }
  // rantai efek: { input, output }

  // ---------- Pengubah nada (pitch) tanpa mengubah kecepatan: AudioWorklet (preview & export) ----------
  const PITCHES = [[0, 'Normal'], [12, 'Tupai (+12)'], [7, 'Chipmunk (+7)'], [4, 'Anak-anak (+4)'], [2, 'Sedikit tinggi (+2)'],
    [-2, 'Sedikit berat (-2)'], [-4, 'Pria berat (-4)'], [-7, 'Monster (-7)'], [-12, 'Raksasa (-12)']];
  const PITCH_SRC = `
  class PitchShift extends AudioWorkletProcessor {
    constructor(o) {
      super();
      this.ratio = (o.processorOptions && o.processorOptions.ratio) || 1;
      this.N = 32768; this.buf = []; this.w = 0; this.p = 0;
      this.L = Math.round(sampleRate * 0.06); // panjang jendela ~60 ms
    }
    process(inputs, outputs) {
      const inp = inputs[0], out = outputs[0];
      const n = out[0].length, N = this.N, L = this.L, step = (1 - this.ratio) / L;
      const ch = inp && inp.length ? inp.length : 0;
      while (this.buf.length < Math.max(1, ch)) this.buf.push(new Float32Array(N));
      let w = this.w, p = this.p;
      const rd = (b, x) => { x = ((x % N) + N) % N; const i = Math.floor(x), f = x - i; return b[i] * (1 - f) + b[(i + 1) % N] * f; };
      for (let i = 0; i < n; i++) {
        for (let c = 0; c < this.buf.length; c++) this.buf[c][w] = c < ch ? inp[c][i] : 0;
        const p2 = (p + 0.5) % 1, s = Math.sin(Math.PI * p), g1 = s * s, g2 = 1 - g1;
        for (let c = 0; c < out.length; c++) {
          const b = this.buf[Math.min(c, this.buf.length - 1)];
          out[c][i] = rd(b, w - p * L) * g1 + rd(b, w - p2 * L) * g2;
        }
        w = (w + 1) % N; p += step; p -= Math.floor(p);
      }
      this.w = w; this.p = p;
      return true;
    }
  }
  registerProcessor('pitch-shift', PitchShift);`;
  let pitchUrl = '';
  const pitchReady = new WeakSet();
  async function loadPitch(ac) {
    if (pitchReady.has(ac)) return true;
    if (!ac.audioWorklet) return false;
    if (!pitchUrl) pitchUrl = URL.createObjectURL(new Blob([PITCH_SRC], { type: 'application/javascript' }));
    try { await ac.audioWorklet.addModule(pitchUrl); pitchReady.add(ac); return true; } catch (_) { return false; }
  }
  const usesPitch = () => !!(+state.voice.pitch || (state.audios || []).some((a) => +a.pitch));
  // efek suara + pengubah nada (semitone)
  function buildFx(ac, fx, pitch = 0) {
    const core = buildFxCore(ac, fx);
    if (!+pitch || !pitchReady.has(ac)) return core;
    const input = ac.createGain();
    const node = new AudioWorkletNode(ac, 'pitch-shift', { processorOptions: { ratio: Math.pow(2, +pitch / 12) } });
    input.connect(node); node.connect(core.input);
    return { input, output: core.output };
  }
  function buildFxCore(ac, fx) {
    const input = ac.createGain(), output = ac.createGain();
    if (fx === 'echo') {
      const d = ac.createDelay(2), fb = ac.createGain(), wet = ac.createGain();
      d.delayTime.value = 0.28; fb.gain.value = 0.42; wet.gain.value = 0.55;
      input.connect(output); input.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(output);
    } else if (fx === 'reverb') {
      const cv = ac.createConvolver(), wet = ac.createGain();
      cv.buffer = impulse(ac); wet.gain.value = 0.5;
      input.connect(output); input.connect(cv); cv.connect(wet); wet.connect(output);
    } else if (fx === 'radio') {
      const hp = ac.createBiquadFilter(), lp = ac.createBiquadFilter(), ws = ac.createWaveShaper();
      hp.type = 'highpass'; hp.frequency.value = 500; lp.type = 'lowpass'; lp.frequency.value = 3000;
      const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.5); }
      ws.curve = curve;
      input.connect(hp); hp.connect(lp); lp.connect(ws); ws.connect(output);
    } else if (fx === 'robot') {
      const ring = ac.createGain(), osc = ac.createOscillator();
      ring.gain.value = 0; osc.frequency.value = 55; osc.type = 'sine';
      osc.connect(ring.gain); osc.start(0);
      input.connect(ring); ring.connect(output);
      output.gain.value = 1.6;
    } else if (fx === 'bass') {
      const ls = ac.createBiquadFilter(); ls.type = 'lowshelf'; ls.frequency.value = 140; ls.gain.value = 12;
      input.connect(ls); ls.connect(output);
    } else if (fx === 'underwater') {
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 450; lp.Q.value = 6;
      input.connect(lp); lp.connect(output);
    } else input.connect(output);
    return { input, output };
  }
  // track audio tambahan lewat jalur audio aplikasi (ikut visualizer & export realtime)
  function routeAudioTrack(entry) {
    if (!audio.ctx || !entry || entry.anode || !(entry.el instanceof HTMLAudioElement) || entry.el === music || entry.el === voice) return;
    try {
      entry.anode = audio.ctx.createMediaElementSource(entry.el);
      entry.again = audio.ctx.createGain();
      entry.again.connect(audio.ctx.destination);
      entry.again.connect(audio.dest);
      entry.again.connect(audio.analyser);
      setEntryFx(entry, 'none');
    } catch (_) { /* abaikan */ }
  }
  function setEntryFx(entry, fx, pitch = 0) {
    const key = `${fx}|${+pitch || 0}|${pitchReady.has(audio.ctx) ? 1 : 0}`;
    if (!entry.anode || entry.fxKey === key) return;
    try { entry.anode.disconnect(); } catch (_) { /* abaikan */ }
    if (entry.fxChain) { try { entry.fxChain.output.disconnect(); } catch (_) { /* abaikan */ } }
    entry.fxChain = buildFx(audio.ctx, fx, pitch);
    entry.anode.connect(entry.fxChain.input);
    entry.fxChain.output.connect(entry.again);
    entry.fxKey = key;
  }
  // voice-over: efek suara + pengubah nada
  function setVoiceFx() {
    if (!audio.ctx || !audio.vsrc) return;
    const fx = state.voice.fx || 'none', pitch = +state.voice.pitch || 0;
    const key = `${fx}|${pitch}|${pitchReady.has(audio.ctx) ? 1 : 0}`;
    if (audio.vfxKey === key) return;
    try { audio.vsrc.disconnect(); } catch (_) { /* abaikan */ }
    if (audio.vchain) { try { audio.vchain.output.disconnect(); } catch (_) { /* abaikan */ } }
    audio.vchain = buildFx(audio.ctx, fx, pitch);
    audio.vsrc.connect(audio.vchain.input);
    audio.vchain.output.connect(audio.vgain);
    audio.vfxKey = key;
  }

  // ---------- Track audio: waktu & sinkron preview ----------
  const audioById = (id) => (state.audios || []).find((a) => a.id === id);
  function audioSrcDur(a) {
    const e = mediaEls.get(a.fileId);
    return e && e.el && isFinite(e.el.duration) && e.el.duration > 0 ? e.el.duration : 0;
  }
  function audioLen(a) {
    if (+a.dur > 0) return Math.max(0.1, +a.dur);
    const sd = audioSrcDur(a);
    return sd ? Math.max(0.1, sd - (+a.in || 0)) : 1;
  }
  const audioRange = (a) => [Math.max(0, +a.start || 0), Math.max(0, +a.start || 0) + audioLen(a)];
  // volume track pada detik lt (relatif awal track) termasuk fade in/out
  const voiceVol = () => (state.tracks.voiceMute ? 0 : +state.voice.volume);
  function audioEnv(a, lt) {
    const len = audioLen(a), vol = state.tracks.audioMute ? 0 : a.vol == null ? 1 : +a.vol;
    let k = 1;
    if (+a.fadeIn > 0) k = Math.min(k, lt / +a.fadeIn);
    if (+a.fadeOut > 0) k = Math.min(k, (len - lt) / +a.fadeOut);
    return vol * clamp(k);
  }
  function syncAudioTracks(t, force = false) {
    const active = new Map(); // elemen → track yang sedang berbunyi
    for (const a of state.audios || []) {
      const [s0, s1] = audioRange(a);
      const e = mediaEls.get(a.fileId);
      if (!e || !e.ready) continue;
      if (t >= s0 && t < s1 && !active.has(e.el)) active.set(e.el, { a, e });
    }
    for (const e of mediaEls.values()) {
      if (!(e.el instanceof HTMLAudioElement) || e.el === music || e.el === voice) continue;
      const hit = active.get(e.el);
      if (!hit || !player.playing || recState.mr) { if (!e.el.paused) e.el.pause(); continue; }
      const { a } = hit;
      const want = (+a.in || 0) + (t - audioRange(a)[0]);
      const env = audioEnv(a, t - audioRange(a)[0]);
      if (e.again) { e.again.gain.value = env; e.el.volume = 1; setEntryFx(e, a.fx || 'none', +a.pitch || 0); } else e.el.volume = clamp(env);
      if (e.el.paused) { e.el.currentTime = want; e.el.play().catch(() => {}); }
      else if (force || Math.abs(e.el.currentTime - want) > 0.3) e.el.currentTime = want;
    }
  }

  // Suara video latar lewat jalur audio aplikasi (ikut terekam di export realtime)
  function routeVideoAudio(entry) {
    if (!audio.ctx || !entry || entry.node || !(entry.el instanceof HTMLVideoElement)) return;
    try {
      entry.node = audio.ctx.createMediaElementSource(entry.el);
      entry.node.connect(audio.ctx.destination);
      entry.node.connect(audio.dest);
      entry.node.connect(audio.analyser);
    } catch (_) { /* abaikan */ }
  }
  function setGain(v, seconds) {
    if (!audio.gain) return;
    const now = audio.ctx.currentTime;
    audio.gain.gain.cancelScheduledValues(now);
    audio.gain.gain.setValueAtTime(audio.gain.gain.value, now);
    if (seconds > 0) audio.gain.gain.linearRampToValueAtTime(v, now + seconds);
    else audio.gain.gain.setValueAtTime(v, now);
  }

  // =========================================================
  //  EXPORT
  // =========================================================
  function pickMime() {
    if (!window.MediaRecorder) return null;
    const list = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return list.find((m) => MediaRecorder.isTypeSupported(m)) || null;
  }

  function showFormatInfo() {
    const m = pickMime();
    const wc = webCodecsAvailable();
    const useWC = wc && state.export.mode !== 'realtime';
    let txt;
    if (useWC) txt = 'Mesin export: WebCodecs → MP4 (H.264 + AAC). Dirender frame demi frame: presisi, tanpa frame hilang, biasanya lebih cepat dari durasi video, dan tetap jalan walau pindah tab.';
    else if (m) txt = `Mesin export: Realtime (MediaRecorder) → ${m.startsWith('video/mp4') ? 'MP4' : 'WEBM'}. Lama export = durasi video. Jangan pindah tab selama export.`;
    else txt = 'Browser ini tidak mendukung export video. Gunakan Chrome / Edge versi terbaru.';
    if (!wc && state.export.mode !== 'realtime' && m) txt += ' (WebCodecs tidak tersedia di browser ini, otomatis memakai mode realtime.)';
    $('#formatInfo').textContent = txt;
    $('#btnExport').disabled = !m && !wc;
  }

  // ---------- Dialog progres export ----------
  function openExportModal(mode) {
    const modal = $('#exportModal');
    const bar = $('#emBar'), pct = $('#emPct'), info = $('#emInfo'), btn = $('#emCancel');
    modal.classList.remove('hidden');
    $('#emTitle').textContent = 'Mengekspor video…';
    $('#emMode').textContent = mode;
    bar.style.width = '0%'; pct.textContent = '0%'; info.textContent = 'Menyiapkan…';
    btn.textContent = 'Batal'; btn.disabled = false;
    $('#emShare').classList.add('hidden');
    const t0 = performance.now();
    const ctl = {
      onCancel: null,
      progress(p, msg = '') {
        bar.style.width = `${clamp(p) * 100}%`;
        pct.textContent = `${Math.floor(clamp(p) * 100)}%`;
        const el = (performance.now() - t0) / 1000;
        const eta = p > 0.03 ? (el / p) * (1 - p) : NaN;
        info.textContent = msg + (isFinite(eta) && p < 1 ? ` • sisa ±${fmtTime(Math.ceil(eta))}` : '');
      },
      done(msg) {
        $('#emTitle').textContent = 'Selesai ✓';
        bar.style.width = '100%'; pct.textContent = '100%';
        const el = (performance.now() - t0) / 1000;
        info.textContent = `${msg} • waktu proses ${fmtTime(Math.ceil(el))}`;
        btn.textContent = 'Tutup';
        btn.onclick = ctl.close;
      },
      close() { modal.classList.add('hidden'); },
    };
    btn.onclick = () => { btn.disabled = true; btn.textContent = 'Membatalkan…'; if (ctl.onCancel) ctl.onCancel(); };
    return ctl;
  }

  // jam lokal (bukan UTC) agar nama file sesuai jam di komputer
  const stamp = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19).replace(/[:T]/g, '-'); };

  async function exportVideo() {
    if (player.exporting) return;
    pause();
    await document.fonts.ready;
    const useWC = state.export.mode !== 'realtime' && webCodecsAvailable();
    if (!useWC && !pickMime()) { toast('Browser ini tidak mendukung export video.', 'error'); return; }
    const ctl = openExportModal(useWC ? 'WebCodecs • MP4 H.264 • presisi frame' : 'Realtime • MediaRecorder');
    player.exporting = true; // ukuran canvas mengikuti resolusi export
    document.body.classList.add('exporting');
    render(0);

    let result = null, error = null;
    try {
      result = useWC ? await exportWebCodecs(ctl) : await exportRealtime(ctl);
    } catch (e) {
      error = e;
      console.error(e);
    }
    endExport();

    if (error) {
      ctl.close();
      toast(`Export gagal: ${error.message || error}. Coba ubah "Mesin export" ke Realtime.`, 'error', 9000);
      return;
    }
    if (!result) { ctl.close(); toast('Export dibatalkan.'); return; }
    const custom = (state.export.fileName || '').trim();
    const name = custom ? `${custom.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)}.${result.ext}` : `${slug(state.name)}-${stamp()}.${result.ext}`;
    downloadBlob(result.blob, name);
    setLastExport(result.blob, name);
    ctl.done(`${name} • ${(result.blob.size / 1048576).toFixed(1)} MB`);
    $('#exportStatus').textContent = `Terakhir di-export: ${name}`;
    toast('Video berhasil di-export 🎉', 'success');
    $('#emShare').classList.remove('hidden');
  }

  // ---------- ringkasan dialog export: ukuran, perkiraan file, sampul ----------
  function exportDims() {
    const [bw, bh] = RATIOS[state.ratio] || RATIOS['9:16'];
    const k = +state.export.res || 1;
    return [Math.round((bw * k) / 2) * 2, Math.round((bh * k) / 2) * 2];
  }
  function updateExportSummary() {
    const [w, h] = exportDims(), fps = +state.export.fps || 30, dur = totalDuration();
    const br = exportBitrate(w, h), mb = ((br + 192000) * dur) / 8 / 1048576;
    const mm = Math.floor(dur / 60), ss = Math.round(dur % 60);
    $('#expDims').textContent = `${w} × ${h}`;
    $('#expEstimate').innerHTML = `<b>${w} × ${h}</b> • ${fps} fps • ${mm}:${String(ss).padStart(2, '0')} • ± <b>${mb < 1 ? (mb * 1024).toFixed(0) + ' KB' : mb.toFixed(mb < 10 ? 1 : 0) + ' MB'}</b> (${(br / 1e6).toFixed(1)} Mbps)${w * h > 3840 * 2160 * 0.9 ? '<br><span class="muted">4K butuh komputer kuat; export lebih lama.</span>' : ''}`;
    const ni = $('#expName');
    if (document.activeElement !== ni) { ni.value = state.export.fileName || ''; ni.placeholder = slug(state.name) + '-' + 'tanggal'; }
  }
  function openExportDialog() {
    try { $('#expThumb').src = canvas.toDataURL('image/jpeg', 0.75); } catch (_) { /* abaikan */ }
    updateExportSummary();
    $('#exportPanel').classList.remove('hidden');
  }

  // ---------- Penanda (marker) di timeline ----------
  const MARKER_COLORS = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#c77dff'];
  const markerList = () => (Array.isArray(state.markers) ? state.markers : (state.markers = []));
  function toggleMarker() {
    const t = r1Fine(player.t), list = markerList();
    const hit = list.find((m) => Math.abs(m.t - t) < 0.05);
    if (hit) { state.markers = list.filter((m) => m !== hit); toast('Penanda dihapus'); }
    else { list.push({ id: newId(), t, color: MARKER_COLORS[list.length % MARKER_COLORS.length], label: '' }); list.sort((a, b) => a.t - b.t); toast(`Penanda 🔖 di ${timecode(t)}`, 'success'); }
    save(); renderMarkers();
  }
  function jumpMarker(dir) {
    const ts = markerList().map((m) => m.t);
    const tgt = dir < 0 ? ts.filter((v) => v < player.t - 0.03).pop() : ts.find((v) => v > player.t + 0.03);
    if (tgt != null) { if (player.playing) pause(); seekTo(tgt); }
  }
  function renderMarkers() {
    const box = $('#tlMarkers'); if (!box) return;
    const scale = tl.scale || totalDuration() || 1;
    box.innerHTML = markerList().filter((m) => m.t <= scale + 1e-6).map((m) => `<i class="tl-marker" data-mk="${esc(m.id)}" style="left:calc(8px + (100% - 16px) * ${m.t / scale});--mk:${m.color}" title="${esc(m.label || 'Penanda')} • ${timecode(m.t)} — klik: lompat, klik ganda: beri nama, klik kanan: hapus"><b></b></i>`).join('');
  }
  function bindMarkers() {
    $('#tlMarker').addEventListener('click', toggleMarker);
    const box = $('#tlMarkers');
    box.addEventListener('pointerdown', (e) => { if (e.target.closest('.tl-marker')) e.stopPropagation(); });
    box.addEventListener('click', (e) => {
      const el = e.target.closest('.tl-marker'); if (!el) return;
      const m = markerList().find((x) => x.id === el.dataset.mk); if (!m) return;
      if (player.playing) pause(); seekTo(m.t);
    });
    box.addEventListener('dblclick', (e) => {
      const el = e.target.closest('.tl-marker'); if (!el) return;
      const m = markerList().find((x) => x.id === el.dataset.mk); if (!m) return;
      const v = prompt('Nama penanda:', m.label || ''); if (v == null) return;
      m.label = v.slice(0, 60); save(); renderMarkers();
    });
    box.addEventListener('contextmenu', (e) => {
      const el = e.target.closest('.tl-marker'); if (!el) return;
      e.preventDefault();
      state.markers = markerList().filter((x) => x.id !== el.dataset.mk); save(); renderMarkers(); toast('Penanda dihapus');
    });
  }

  function endExport() {
    player.exporting = false;
    offlineAudio = null;
    document.body.classList.remove('exporting');
    player.t = Math.max(0, totalDuration() - 1);
    refresh();
  }

  // Export setiap scene menjadi file video terpisah
  async function exportPerScene() {
    if (player.exporting) return;
    if (!webCodecsAvailable()) {
      toast('Export per scene butuh mesin Presisi (WebCodecs). Gunakan Chrome / Edge terbaru.', 'error', 6000);
      return;
    }
    pause();
    await document.fonts.ready;
    const parts = partRanges();
    const n = parts.length;
    const word = freeMode() ? 'teks' : 'scene';
    if (!n) { toast('Belum ada teks.', 'error'); return; }
    const ctl = openExportModal(`Per ${word} • ${n} video MP4 terpisah`);
    player.exporting = true;
    document.body.classList.add('exporting');
    render(0);

    let error = null, cancelled = false, saved = 0, size = 0;
    for (let i = 0; i < n; i++) {
      const part = parts[i];
      const sub = {
        set onCancel(fn) { ctl.onCancel = () => { cancelled = true; if (fn) fn(); }; },
        progress: (p, m) => ctl.progress((i + p) / n, `${word[0].toUpperCase() + word.slice(1)} ${i + 1}/${n} • ${m}`),
      };
      let res = null;
      try { res = await exportWebCodecs(sub, { from: part.a, to: part.b }); } catch (e) { error = e; console.error(e); break; }
      offlineAudio = null;
      if (!res || cancelled) { cancelled = true; break; }
      downloadBlob(res.blob, `${slug(state.name)}-${word}-${String(i + 1).padStart(2, '0')}.mp4`);
      saved++;
      size += res.blob.size;
    }
    endExport();

    if (error) { ctl.close(); toast(`Export gagal: ${error.message || error}`, 'error', 8000); return; }
    if (cancelled && !saved) { ctl.close(); toast('Export dibatalkan.'); return; }
    ctl.done(`${saved} video ${word} • ${(size / 1048576).toFixed(1)} MB total${cancelled ? ' (dibatalkan sebagian)' : ''}`);
    toast(`${saved} video ${word} berhasil di-export 🎉`, 'success');
  }

  // ---------- Mesin export 1: WebCodecs (frame-accurate) ----------
  function webCodecsAvailable() {
    return 'VideoEncoder' in window && 'VideoFrame' in window && typeof window.Mp4Muxer !== 'undefined';
  }

  async function pickVideoConfig(width, height, fps, bitrate) {
    const codecs = ['avc1.640034', 'avc1.640033', 'avc1.64002A', 'avc1.640028', 'avc1.4D0028', 'avc1.42E028'];
    for (const codec of codecs) {
      const cfg = { codec, width, height, bitrate, framerate: fps, avc: { format: 'avc' } };
      try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch (_) { /* coba berikutnya */ }
    }
    return null;
  }

  async function pickAudioConfig(sampleRate) {
    if (typeof AudioEncoder === 'undefined') return null;
    for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
      const config = { codec, sampleRate, numberOfChannels: 2, bitrate: 192000 };
      try { if ((await AudioEncoder.isConfigSupported(config)).supported) return { config, mux }; } catch (_) { /* lanjut */ }
    }
    return null;
  }

  // Bagian timeline tempat video bersuara tampil: [{id, a, b, mStart}]
  // allVideos = true: semua video, termasuk yang dibisukan (dipakai untuk subtitle dari suara video)
  function videoSoundSegments(allVideos = false) {
    const segs = [];
    bgIntervals().forEach(({ a, b, spec: sp }) => {
      if (sp.type !== 'media') return;
      const item = mediaItem(sp.mediaId) || state.media[0];
      if (allVideos ? !(item && item.kind === 'video') : !videoAudible(item)) return;
      const rate = sp.clip ? clamp(+sp.clip.speed || 1, 0.1, 16) : 1;
      if (sp.clip && sp.clip.freeze) return;
      if (!allVideos && sp.clip && (sp.clip.mute || +(sp.clip.vol == null ? 1 : sp.clip.vol) <= 0)) return;
      const cv = sp.clip ? clamp(+state.vsound.volume, 0, 1) * (sp.clip.vol == null ? 1 : +sp.clip.vol) : null;
      const cA = sp.mStart || 0, cB = sp.clip ? cA + clipDur(sp.clip) : 0, fin = sp.clip ? +sp.clip.fadeIn || 0 : 0, fout = sp.clip ? +sp.clip.fadeOut || 0 : 0;
      if (sp.clip && sp.clip.rev) {
        const m = sp.mStart || 0, L = clipDur(sp.clip), i0 = +sp.clip.in || 0;
        segs.push({ id: item.id, a, b, rate, rev: true, lo: i0 + Math.max(0, L - (b - m)) * rate, hi: i0 + Math.max(0, L - (a - m)) * rate });
        return;
      }
      if (sp.clip && curvePts(sp.clip)) {
        const N = Math.max(1, Math.ceil((b - a) / 0.1));
        for (let k = 0; k < N; k++) {
          const pa = a + ((b - a) * k) / N, pb = a + ((b - a) * (k + 1)) / N;
          const sa = curveSrc(sp.clip, pa - (sp.mStart || 0)), sb = curveSrc(sp.clip, pb - (sp.mStart || 0));
          segs.push({ id: item.id, a: pa, b: pb, src0: sa, rate: clamp((sb - sa) / Math.max(1e-6, pb - pa), 0.0625, 16), vol: cv == null ? undefined : cv * clipVolAt({ ...sp.clip, vol: 1, mute: false }, (pa + pb) / 2 - cA) });
        }
        return;
      }
      const src0 = sp.clip ? (+sp.clip.in || 0) + (a - (sp.mStart || 0)) * rate : a - (sp.mStart || 0); // posisi di file pada detik a
      const last = segs[segs.length - 1];
      if (last && !last.rev && last.id === item.id && last.rate === rate && Math.abs(last.b - a) < 1e-6 && !fin && !fout && !last.fin && !last.fout && last.vol === (cv == null ? undefined : cv)
        && Math.abs(last.src0 + (last.b - last.a) * rate - src0) < 1e-3) last.b = b;
      else segs.push({ id: item.id, a, b, src0, rate, vol: cv == null ? undefined : cv, fin, fout, cA, cB });
    });
    if (freeMode()) for (const l of state.texts) {
      if (!isOverlay(l) || l.media !== 'video' || (!allVideos && !ovAudible(l))) continue;
      const [a, b0] = textRange(l);
      const e = mediaEls.get(l.fileId), d = e && e.el && e.el.duration;
      let b = Math.min(b0, totalDuration());
      if (l.loop === false && d) b = Math.min(b, a + Math.max(0, d - (+l.in || 0)));
      if (b - a > 0.02) segs.push({ id: l.fileId, a, b, src0: +l.in || 0, rate: 1, vol: clamp(+ovv(l, 'vol'), 0, 1) });
    }
    return segs;
  }

  // Render musik + voice-over (volume, titik mulai, loop, ducking, fade out) secara offline.
  // `from` = detik awal potongan (untuk export per scene).
  async function renderAudioOffline(total, from = 0) {
    const sr = 48000;
    const oc = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
    if (usesPitch()) await loadPitch(oc);
    const decode = async (url) => oc.decodeAudioData(await (await fetch(url)).arrayBuffer());
    const voiceBuf = voice.src ? await decode(voice.src) : null;
    const vStart = (+state.voice.delay || 0) - from; // posisi voice relatif terhadap potongan

    if (music.src) {
      const decoded = await decode(music.src);
      const src = oc.createBufferSource();
      src.buffer = decoded;
      src.loop = true;
      const g = oc.createGain();
      const vol = state.tracks.musicMute ? 0 : +state.music.volume;
      const lo = vol * DUCK;
      const ducked = (t) => voiceBuf && state.voice.duck && t >= vStart && t < vStart + voiceBuf.duration;
      g.gain.setValueAtTime(ducked(0) ? lo : vol, 0);
      if (voiceBuf && state.voice.duck) {
        const a = vStart, b = vStart + voiceBuf.duration;
        if (a > 0 && a < total) { g.gain.setValueAtTime(vol, Math.max(0, a - 0.3)); g.gain.linearRampToValueAtTime(lo, a); }
        if (b > 0 && b < total) { g.gain.setValueAtTime(lo, b); g.gain.linearRampToValueAtTime(vol, Math.min(total, b + 0.3)); }
      }
      if (state.music.fade && total > 2) {
        g.gain.setValueAtTime(ducked(total - 1.5) ? lo : vol, total - 1.5);
        g.gain.linearRampToValueAtTime(0, total);
      }
      src.connect(g).connect(oc.destination);
      src.start(0, ((+state.music.start || 0) + from) % decoded.duration);
    }

    if (voiceBuf && vStart < total && vStart + voiceBuf.duration > 0) {
      const vs = oc.createBufferSource();
      vs.buffer = voiceBuf;
      const vg = oc.createGain();
      vg.gain.value = voiceVol();
      const vfx = buildFx(oc, state.voice.fx || 'none', +state.voice.pitch || 0);
      vs.connect(vfx.input); vfx.output.connect(vg); vg.connect(oc.destination);
      if (vStart >= 0) vs.start(vStart); else vs.start(0, -vStart);
    }

    // track audio tambahan
    const abufs = new Map();
    for (const a of state.audios || []) {
      const [A, B] = audioRange(a);
      const s0 = Math.max(A, from), s1 = Math.min(B, from + total);
      if (s1 - s0 < 0.01) continue;
      const entry = mediaEls.get(a.fileId);
      if (!entry || !entry.url) continue;
      if (!abufs.has(a.fileId)) abufs.set(a.fileId, await decode(entry.url).catch(() => null));
      const buf = abufs.get(a.fileId);
      if (!buf) continue;
      const src = oc.createBufferSource();
      src.buffer = buf;
      const g = oc.createGain();
      const fx = buildFx(oc, a.fx || 'none', +a.pitch || 0);
      src.connect(fx.input); fx.output.connect(g); g.connect(oc.destination);
      // selubung volume (fade) — garis lurus antar titik, jadi persis
      const len = B - A, env = (x) => audioEnv(a, x - A);
      const pts = [A + Math.min(len, +a.fadeIn || 0), B - Math.min(len, +a.fadeOut || 0), B].filter((x) => x > s0 && x <= s1);
      g.gain.setValueAtTime(env(s0), s0 - from);
      for (const x of pts) g.gain.linearRampToValueAtTime(env(Math.min(x, B - 1e-4)), x - from);
      src.start(s0 - from, (+a.in || 0) + (s0 - A), s1 - s0);
    }

    // suara asli video latar, persis di bagian video itu tampil
    const decoded = new Map();
    for (const seg of videoSoundSegments()) {
      const s0 = Math.max(seg.a, from), s1 = Math.min(seg.b, from + total);
      if (s1 - s0 < 0.02) continue;
      const entry = mediaEls.get(seg.id);
      if (!entry || !entry.url) continue;
      if (!decoded.has(seg.id)) decoded.set(seg.id, await decode(entry.url).catch(() => null)); // video tanpa suara → null
      const buf = decoded.get(seg.id);
      if (!buf) continue;
      const d = (entry.el && entry.el.duration) || buf.duration;
      if (seg.rev) { // potongan suara dibalik
        const sr0 = buf.sampleRate, i0 = Math.floor(clamp(seg.lo, 0, buf.duration) * sr0), i1 = Math.floor(clamp(seg.hi, 0, buf.duration) * sr0);
        if (i1 - i0 < 32) continue;
        const rb = oc.createBuffer(buf.numberOfChannels, i1 - i0, sr0);
        for (let ch = 0; ch < buf.numberOfChannels; ch++) {
          const s = buf.getChannelData(ch), o = rb.getChannelData(ch);
          for (let k = 0, n = i1 - i0; k < n; k++) o[k] = s[i1 - 1 - k];
        }
        const rsrc = oc.createBufferSource();
        rsrc.buffer = rb;
        rsrc.playbackRate.value = seg.rate;
        const rg = oc.createGain(), vol = clamp(+state.vsound.volume, 0, 1), a = s0 - from, b = s1 - from;
        rg.gain.setValueAtTime(0, a);
        rg.gain.linearRampToValueAtTime(vol, a + 0.02);
        rg.gain.setValueAtTime(vol, Math.max(a + 0.02, b - 0.03));
        rg.gain.linearRampToValueAtTime(0, b);
        rsrc.connect(rg).connect(oc.destination);
        rsrc.start(a, Math.min(rb.duration - 0.001, (s0 - seg.a) * seg.rate));
        rsrc.stop(b);
        continue;
      }
      const src = oc.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = 0;
      src.loopEnd = Math.min(d, buf.duration);
      const g = oc.createGain();
      const vol = seg.vol != null ? seg.vol : clamp(+state.vsound.volume, 0, 1);
      const a = s0 - from, b = s1 - from;
      if (seg.fin || seg.fout) { // fade masuk/keluar klip
        const env = (x) => vol * Math.min(1, seg.fin ? clamp((x - seg.cA) / seg.fin) : 1, seg.fout ? clamp((seg.cB - x) / seg.fout) : 1);
        g.gain.setValueAtTime(0, a);
        g.gain.linearRampToValueAtTime(env(s0 + 0.02), a + 0.02);
        for (const x of [seg.cA + seg.fin, seg.cB - seg.fout].filter((x) => x > s0 + 0.02 && x < s1 - 0.03).sort((p, q) => p - q)) g.gain.linearRampToValueAtTime(env(x), x - from);
        g.gain.linearRampToValueAtTime(env(s1 - 0.03), b - 0.03);
        g.gain.linearRampToValueAtTime(0, b);
      } else {
      // fade sangat singkat di tepi agar tidak "klik"
      g.gain.setValueAtTime(0, a);
      g.gain.linearRampToValueAtTime(vol, a + 0.02);
      g.gain.setValueAtTime(vol, Math.max(a + 0.02, b - 0.03));
      g.gain.linearRampToValueAtTime(0, b);
      }
      src.connect(g).connect(oc.destination);
      src.playbackRate.value = seg.rate;
      const off = seg.src0 + (s0 - seg.a) * seg.rate;
      src.start(a, (((off % d) + d) % d) % src.loopEnd);
      src.stop(b);
    }
    return oc.startRendering();
  }

  // Jeda singkat yang tidak di-throttle walau tab tidak aktif
  const yieldUI = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });

  function seekVideo(el, time) {
    return new Promise((res) => {
      if (Math.abs(el.currentTime - time) < 0.001) return res();
      const finish = () => { el.removeEventListener('seeked', finish); clearTimeout(to); res(); };
      const to = setTimeout(finish, 1500);
      el.addEventListener('seeked', finish);
      el.currentTime = time;
    });
  }

  async function exportWebCodecs(ctl, range = null) {
    let cancelled = false;
    ctl.onCancel = () => { cancelled = true; };
    const fps = +state.export.fps || 30;
    const from = range ? range.from : 0;
    const total = range ? range.to - range.from : totalDuration();
    const W = canvas.width, H = canvas.height;
    const vcfg = await pickVideoConfig(W, H, fps, exportBitrate(W, H));
    if (!vcfg) throw new Error('encoder H.264 tidak tersedia');

    let abuf = null, acfg = null;
    if (anyAudio()) {
      ctl.progress(0, 'Menyiapkan audio…');
      abuf = await renderAudioOffline(total, from);
      acfg = await pickAudioConfig(abuf.sampleRate);
      if (!acfg) throw new Error('encoder audio tidak tersedia');
      offlineAudio = { data: abuf.getChannelData(0), sr: abuf.sampleRate, t: 0 };
    }

    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H },
      audio: acfg ? { codec: acfg.mux, numberOfChannels: 2, sampleRate: abuf.sampleRate } : undefined,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });
    let encErr = null;

    // --- audio ---
    if (acfg) {
      const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { encErr = e; } });
      aenc.configure(acfg.config);
      const sr = abuf.sampleRate, N = 4096;
      const ch0 = abuf.getChannelData(0), ch1 = abuf.numberOfChannels > 1 ? abuf.getChannelData(1) : ch0;
      for (let off = 0; off < abuf.length; off += N) {
        const n = Math.min(N, abuf.length - off);
        const data = new Float32Array(n * 2);
        data.set(ch0.subarray(off, off + n), 0);
        data.set(ch1.subarray(off, off + n), n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((off / sr) * 1e6), data });
        aenc.encode(ad);
        ad.close();
      }
      await aenc.flush();
      aenc.close();
    }

    // --- video ---
    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { encErr = e; } });
    venc.configure(vcfg);
    const frames = Math.max(1, Math.round(total * fps));
    for (const e of mediaEls.values()) if (e.el instanceof HTMLVideoElement) e.el.pause();
    const frameDur = Math.round(1e6 / fps);

    for (let i = 0; i < frames; i++) {
      if (cancelled || encErr) break;
      const t = from + i / fps;
      for (const v of visibleVideos(t)) await seekVideo(v.el, v.time);
      if (offlineAudio) offlineAudio.t = i / fps;
      render(t);
      const vf = new VideoFrame(canvas, { timestamp: i * frameDur, duration: frameDur });
      venc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
      vf.close();
      while (venc.encodeQueueSize > 6) await yieldUI();
      if (i % 4 === 0) {
        ctl.progress(i / frames, `Merender frame ${i + 1} / ${frames}`);
        await yieldUI();
      }
    }
    if (encErr) throw encErr;
    if (cancelled) { try { venc.close(); } catch (_) { /* abaikan */ } return null; }

    ctl.progress(1, 'Menyusun file MP4…');
    await venc.flush();
    venc.close();
    muxer.finalize();
    return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4' };
  }

  // ---------- Mesin export 2: Realtime (MediaRecorder, cadangan) ----------
  async function exportRealtime(ctl) {
    const mime = pickMime();
    if (!mime) return null;

    const fps = +state.export.fps || 30;
    const stream = canvas.captureStream(fps);
    if (anyAudio()) {
      ensureAudioGraph();
      await audio.ctx.resume();
      audio.dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    }

    const chunks = [];
    const rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: exportBitrate(canvas.width, canvas.height),
      audioBitsPerSecond: 192000,
    });
    rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);

    const total = totalDuration();
    let cancelled = false;
    ctl.onCancel = () => {
      cancelled = true;
      player.onEnd = null;
      pause();
      if (rec.state !== 'inactive') rec.stop();
    };
    const prog = setInterval(() => ctl.progress(clamp(player.t / total), 'Merekam secara realtime… jangan pindah tab'), 250);

    const done = new Promise((res) => { rec.onstop = res; });
    rec.start(250);
    player.t = 0;
    player.onEnd = () => setTimeout(() => rec.state !== 'inactive' && rec.stop(), 150);
    play(true);
    await done;

    clearInterval(prog);
    stream.getVideoTracks().forEach((tr) => tr.stop());
    if (cancelled) return null;
    return {
      blob: new Blob(chunks, { type: mime.split(';')[0] }),
      ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm',
    };
  }

  // Simpan setiap scene sebagai gambar PNG (cocok untuk carousel Instagram)
  async function exportScenesPng() {
    pause();
    await document.fonts.ready;
    const fb = state.effects.fadeBlack;
    state.effects.fadeBlack = false;
    ui.capturing = true;
    const parts = partRanges();
    const word = freeMode() ? 'teks' : 'scene';
    for (const part of parts) {
      const d = part.b - part.a;
      const t = part.a + Math.max(d * 0.5, d - Math.min(0.6, d * 0.2) - 0.05);
      render(t);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      if (blob) downloadBlob(blob, `${slug(state.name)}-${word}-${String(part.n).padStart(2, '0')}.png`);
      await new Promise((r) => setTimeout(r, 400));
    }
    state.effects.fadeBlack = fb;
    ui.capturing = false;
    toast(`${parts.length} gambar PNG diunduh`, 'success');
    render(player.t);
  }

  // =========================================================
  //  POSTING KE MEDIA SOSIAL: bagikan file + caption & hashtag otomatis
  // =========================================================
  let lastExport = null; // { file, name }
  const PLATFORMS = {
    tiktok: { name: 'TikTok', url: 'https://www.tiktok.com/upload', tags: ['#fyp', '#foryou', '#katakatatiktok'] },
    reels: { name: 'Instagram Reels', url: 'https://www.instagram.com/', tags: ['#reels', '#reelsinstagram', '#explore'] },
    shorts: { name: 'YouTube Shorts', url: 'https://www.youtube.com/upload', tags: ['#shorts', '#youtubeshorts'] },
    facebook: { name: 'Facebook Reels', url: 'https://www.facebook.com/reels/create', tags: ['#reels', '#fbreels'] },
  };
  const TOPIC_TAGS = [
    [/\b(allah|tuhan|doa|ikhlas|syukur|sabar|iman|sholat|shalat|dosa|surga|takdir|hijrah|bismillah)\b/i, ['#katakataislami', '#religi', '#pengingatdiri']],
    [/\b(cinta|sayang|rindu|kangen|kekasih|jodoh|hati|pasangan)\b/i, ['#katakatacinta', '#romantis', '#bucin']],
    [/\b(galau|sedih|kecewa|luka|patah|tangis|menangis|sakit|pergi|lupa)\b/i, ['#katakatagalau', '#sadvibes', '#galau']],
    [/\b(sukses|kerja|mimpi|usaha|semangat|gagal|berjuang|tujuan|bisnis|rezeki|rejeki)\b/i, ['#motivasi', '#katakatamotivasi', '#sukses']],
    [/\b(ibu|ayah|bapak|mama|papa|keluarga|anak|orang tua|orangtua)\b/i, ['#keluarga', '#katakataibu', '#orangtua']],
    [/\b(hidup|kehidupan|waktu|pelan|proses|lelah|diri)\b/i, ['#katakatabijak', '#quotesoftheday', '#selfreminder']],
  ];
  const BASE_TAGS = ['#katakata', '#quotes', '#quotesindonesia', '#katakatabijak'];
  const plainText = (t) => String(t || '').replace(/\*/g, '').replace(/\s+\n/g, '\n').trim();
  function projectTexts() {
    const list = freeMode()
      ? state.texts.filter((l) => !isSticker(l)).sort((a, b) => textRange(a)[0] - textRange(b)[0]).map((l) => ({ text: l.text, author: l.author }))
      : state.scenes.map((s) => ({ text: s.text, author: s.author }));
    return list.filter((x) => plainText(x.text));
  }
  function autoCaption() {
    const items = projectTexts();
    const main = items.slice(0, 3).map((x) => plainText(x.text).replace(/\n+/g, ' ') + ((x.author || '').trim() ? `\n— ${x.author.trim()}` : '')).join('\n\n');
    const all = items.map((x) => x.text).join(' ');
    const tags = [...BASE_TAGS];
    for (const [re, t] of TOPIC_TAGS) if (re.test(all)) tags.push(...t);
    const wm = (state.watermark || '').trim();
    let cap = main || state.name || '';
    if (wm && wm.startsWith('@')) cap += `\n\nFollow ${wm} ✨`;
    else cap += '\n\nSimpan & bagikan ke orang yang butuh ✨';
    return `${cap}\n\n${[...new Set(tags)].slice(0, 9).join(' ')}`;
  }
  // caption untuk platform tertentu: caption kamu + hashtag khas platform (tanpa dobel)
  function platformCaption(key) {
    let cap = (state.share.caption || '').trim() || autoCaption();
    const extra = (PLATFORMS[key] ? PLATFORMS[key].tags : []).filter((t) => !cap.toLowerCase().includes(t.toLowerCase()));
    if (extra.length) cap += (/#\S+\s*$/.test(cap) ? ' ' : '\n\n') + extra.join(' ');
    return cap;
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) { /* cadangan di bawah */ }
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    ta.remove();
    return ok;
  }
  function setLastExport(blob, name) {
    const type = blob.type || (name.endsWith('.webm') ? 'video/webm' : 'video/mp4');
    lastExport = { file: new File([blob], name, { type: type.split(';')[0] }), name };
    renderShareUI();
  }
  const canShareFile = () => !!(lastExport && navigator.canShare && navigator.share && navigator.canShare({ files: [lastExport.file] }));
  const isMobile = () => matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
  function renderShareUI() {
    const has = !!lastExport;
    $('#shareFile').textContent = has
      ? `🎬 ${lastExport.name} • ${(lastExport.file.size / 1048576).toFixed(1)} MB`
      : 'Belum ada video. Export dulu, atau pilih file video yang sudah ada.';
    $('#btnShare').disabled = !has;
    $('#shareHint').textContent = !has ? ''
      : canShareFile() ? (isMobile() ? 'Tekan Bagikan lalu pilih TikTok / Instagram / WhatsApp / YouTube.' : 'Tekan Bagikan untuk membuka menu berbagi Windows / perangkat.')
        : 'Browser ini tidak bisa membagikan file langsung. Pakai tombol platform di bawah: caption disalin, halaman upload dibuka, lalu seret file dari folder Unduhan.';
  }
  async function shareNow(key = '') {
    if (!lastExport) { toast('Export video dulu (atau pilih file video), baru bisa dibagikan.', 'error'); return; }
    const cap = platformCaption(key);
    copyText(cap); // caption disalin juga, karena banyak aplikasi mengabaikan teks yang ikut dibagikan
    try {
      await navigator.share({ files: [lastExport.file], title: state.name || 'Video YOG-EDITZ', text: cap });
      toast('Caption sudah disalin, tinggal tempel di kolom caption 👍', 'success', 5000);
    } catch (e) {
      if (e && e.name === 'AbortError') return; // dibatalkan pengguna
      toast('Gagal membuka menu berbagi. Pakai tombol platform di bawah.', 'error', 6000);
    }
  }
  async function postTo(key) {
    const p = PLATFORMS[key];
    if (!lastExport) { toast('Export video dulu, baru bisa diposting.', 'error'); return; }
    // di HP: menu berbagi langsung ke aplikasinya
    if (isMobile() && canShareFile()) { shareNow(key); return; }
    const win = window.open(p.url, '_blank', 'noopener');
    const ok = await copyText(platformCaption(key));
    toast(`${ok ? 'Caption disalin. ' : ''}Halaman ${p.name} dibuka: pilih / seret file "${lastExport.name}" dari folder Unduhan, lalu tempel caption (Ctrl+V).`, 'success', 9000);
    if (!win) toast('Pop-up diblokir browser. Izinkan pop-up untuk aplikasi ini.', 'error', 6000);
  }
  function bindShare() {
    $('#btnCaptionAuto').addEventListener('click', () => {
      state.share.caption = autoCaption();
      syncControls(); snapshot();
      toast('Caption & hashtag dibuat dari teks di video', 'success');
    });
    $('#btnCaptionCopy').addEventListener('click', async () => {
      const ok = await copyText(platformCaption(''));
      toast(ok ? 'Caption disalin' : 'Gagal menyalin, salin manual dari kotak caption', ok ? 'success' : 'error');
    });
    $('#btnShare').addEventListener('click', () => (canShareFile() ? shareNow() : postTo('tiktok')));
    $('#shareTargets').innerHTML = Object.entries(PLATFORMS).map(([k, p]) => `<button class="ghost small" data-post="${k}">${p.name}</button>`).join('');
    $('#shareTargets').addEventListener('click', (e) => { const b = e.target.closest('[data-post]'); if (b) postTo(b.dataset.post); });
    $('#fileShare').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) { setLastExport(f, f.name); toast('Video siap dibagikan', 'success'); } });
    $('#emShareBtn').addEventListener('click', () => { if (canShareFile()) shareNow(); else { $('#exportModal').classList.add('hidden'); $('#exportPanel').classList.remove('hidden'); $('#sharePanel').scrollIntoView({ behavior: 'smooth' }); } });
    renderShareUI();
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  // =========================================================
  //  UI: SCENE LIST
  // =========================================================
  // ---------- Gaya per scene: animasi teks, transisi, filter & efek ----------
  const SCENE_STYLE_KEYS = ['animIn', 'animOut', 'xTrans', 'filter', 'fx'];
  const openStyles = new WeakSet(); // kartu scene yang panel gayanya sedang terbuka
  let styleOptCache = null;
  function sceneStyleOpts() {
    if (styleOptCache) return styleOptCache;
    const fromSel = (id) => [...$(id).options].map((o) => [o.value, o.textContent]);
    styleOptCache = {
      animIn: { label: '✍ Teks masuk', list: fromSel('#animType'), global: () => state.anim.type },
      animOut: { label: '👋 Teks keluar', list: fromSel('#transition'), global: () => state.anim.transition },
      xTrans: { label: '🔀 Transisi latar', list: TRANSITIONS.map(([v, n]) => [v, n]), global: () => state.bg.xTrans || 'fade' },
      filter: { label: '🎨 Filter warna', list: Object.entries(FILTERS).map(([v, [n]]) => [v, n]), global: () => state.bg.filter || 'none' },
      fx: { label: '✨ Efek latar', list: Object.entries(EFFECTS).map(([v, n]) => [v, n]), global: () => state.bg.fx || 'none' },
    };
    return styleOptCache;
  }
  const optName = (k, v) => { const f = sceneStyleOpts()[k].list.find((o) => o[0] === v); return f ? f[1] : v; };
  function sceneStyleSummary(sc) {
    const own = SCENE_STYLE_KEYS.filter((k) => sc[k]);
    return own.length ? own.map((k) => sceneStyleOpts()[k].label.split(' ')[0] + ' ' + optName(k, sc[k])).join('  ') : 'ikut pengaturan global';
  }
  function sceneStyleHtml(sc, i, flat) {
    const O = sceneStyleOpts();
    const own = SCENE_STYLE_KEYS.some((k) => sc[k]);
    const sel = (k) => `<label>${O[k].label}<select data-st="${k}"><option value="">↩ Ikut global (${esc(optName(k, O[k].global()))})</option>${O[k].list.map(([v, n]) => `<option value="${esc(v)}"${sc[k] === v ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
    return `<${flat ? 'div' : 'details'} class="scene-style${own ? ' own' : ''}${flat ? ' flat' : ''}"${!flat && openStyles.has(sc) ? ' open' : ''}>
      ${flat ? '' : `<summary><span>🎬 Transisi &amp; efek</span><em>${esc(sceneStyleSummary(sc))}</em></summary>`}
      <div class="ss-grid">${SCENE_STYLE_KEYS.map(sel).join('')}</div>
      <p class="muted ss-tip">Transisi latar terlihat bila latar scene ini berbeda dari scene sebelumnya (mis. foto/video lain).${i === 0 ? ' Scene 1 tidak punya transisi masuk.' : ''}</p>
      <div class="ss-btns">
        <button data-ss="try" class="small" title="Putar mulai sedikit sebelum scene ini">▶ Coba</button>
        <button data-ss="all" class="ghost small" title="Pakai gaya scene ini di semua scene">⧉ Ke semua scene</button>
        <button data-ss="rand" class="ghost small" title="Pilih gaya acak untuk scene ini">🎲 Acak</button>
        <button data-ss="reset" class="ghost small" title="Kembali ikut pengaturan global"${own ? '' : ' disabled'}>↺ Ikut global</button>
      </div>
    </${flat ? 'div' : 'details'}>`;
  }
  // gaya acak yang tetap enak dilihat
  const RAND_STYLE = {
    animIn: ['fade', 'slideUp', 'zoom', 'pop', 'blur', 'slideLeft', 'riseBlur', 'drop', 'typewriter', 'word'],
    animOut: ['fade', 'slideUp', 'zoomOut', 'blur', 'shrink', 'slideLeftOut'],
    xTrans: null, filter: null, fx: null,
  };
  function randomSceneStyle(sc) {
    const O = sceneStyleOpts();
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const valid = (k) => O[k].list.map((o) => o[0]);
    ['animIn', 'animOut'].forEach((k) => { const ok = RAND_STYLE[k].filter((v) => valid(k).includes(v)); sc[k] = pick(ok.length ? ok : valid(k)); });
    sc.xTrans = pick(valid('xTrans').filter((v) => v !== 'none'));
  }
  function trySceneAt(i) {
    if (player.playing) pause();
    const sc = state.scenes[i];
    const from = Math.max(0, sceneStart(i) - (i > 0 ? 0.8 : 0));
    seekTo(from);
    play();
    clearTimeout(trySceneAt.timer);
    const len = (sceneStart(i) - from) + Math.max(0.5, +sc.duration || 0);
    trySceneAt.timer = setTimeout(() => { if (player.playing) pause(); }, len * 1000 + 150);
  }
  // pilihan yang sama tampil di kartu scene (tab Teks) dan daftar tab Efek → samakan keduanya
  function syncSceneStyleViews(sc, k) {
    const i = state.scenes.indexOf(sc); if (i < 0) return;
    [$$('#sceneList .scene')[i], $$('#fxList .fx-card')[i]].forEach((card) => {
      if (!card) return;
      const s = card.querySelector(`select[data-st=${k}]`); if (s) s.value = sc[k] || '';
      const em = card.querySelector('.scene-style summary em'); if (em) em.textContent = sceneStyleSummary(sc);
      const box = card.querySelector('.scene-style'); if (box) box.classList.toggle('own', SCENE_STYLE_KEYS.some((q) => sc[q]));
    });
    fxListKey = fxListSig();
    sceneBarKey = '';
  }
  function bindSceneStyle(el, sc, i) {
    const box = $('.scene-style', el);
    box.addEventListener('toggle', () => { if (box.open) openStyles.add(sc); else openStyles.delete(sc); });
    const updSummary = () => {
      const em = $('summary em', box); if (em) em.textContent = sceneStyleSummary(sc);
      const own = SCENE_STYLE_KEYS.some((k) => sc[k]);
      box.classList.toggle('own', own);
      $('[data-ss=reset]', box).disabled = !own;
    };
    $$('select[data-st]', box).forEach((s) => s.addEventListener('change', () => {
      const k = s.dataset.st;
      if (s.value) sc[k] = s.value; else delete sc[k];
      updSummary(); renderTimeline(); refresh(); syncSceneStyleViews(sc, k);
      // langsung perlihatkan hasilnya: transisi → putar pergantian scene, lainnya → tampilkan scene
      if (k === 'xTrans' || k === 'animIn' || k === 'animOut') trySceneAt(i); else goToScene(i);
    }));
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ss]');
      if (!b) return;
      const act = b.dataset.ss;
      if (act !== 'try' && document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
      if (act === 'try') return trySceneAt(i);
      if (act === 'all') {
        state.scenes.forEach((o) => { if (o === sc) return; SCENE_STYLE_KEYS.forEach((k) => { if (sc[k]) o[k] = sc[k]; else delete o[k]; }); });
        toast(`Gaya scene ${i + 1} dipakai di semua scene`, 'success');
      }
      if (act === 'rand') randomSceneStyle(sc);
      if (act === 'reset') SCENE_STYLE_KEYS.forEach((k) => delete sc[k]);
      openStyles.add(sc);
      renderScenes(); refresh();
      if (act === 'rand') trySceneAt(i);
    });
  }
  // ---------- Tab Efek: daftar semua klip (teks bebas) / scene (berurutan) dengan transisi & efeknya ----------
  let fxListKey = '';
  function fxListSig() {
    if (!freeMode()) return 'S|' + state.scenes.map((sc) => [sc.text, sc.duration, ...SCENE_STYLE_KEYS.map((k) => sc[k] || '')].join('~')).join('|');
    return 'C|' + clipList().map((c) => [c.id, c.mediaId, clipDur(c).toFixed(2), c.trans, c.transDur, c.filter || '', c.fx || '', (thumbCache.get(c.mediaId) || {}).ready ? 1 : 0].join('~')).join('|');
  }
  function playRange(a, b) {
    if (player.playing) pause();
    seekTo(Math.max(0, a));
    play();
    clearTimeout(trySceneAt.timer);
    trySceneAt.timer = setTimeout(() => { if (player.playing) pause(); }, Math.max(0.5, b - a) * 1000 + 150);
  }
  function tryClip(c) {
    const r = clipRange(c); if (!r) return;
    playRange(r[0] - (r[0] > 0 ? 0.8 : 0), r[1]);
  }
  function renderFxList(force) {
    const box = $('#fxList');
    if (!box) return;
    const sig = fxListSig();
    if (!force && sig === fxListKey) return;
    fxListKey = sig;
    const free = freeMode();
    $('#fxListTitle').textContent = free ? '🎬 Transisi & efek tiap klip' : '🎬 Transisi & efek tiap scene';
    if (!free) {
      $('#fxListHint').textContent = 'Semua scene ada di sini: animasi teks masuk/keluar, transisi latar, filter, dan efek. "Ikut global" = memakai pengaturan bawaan.';
      box.innerHTML = '';
      state.scenes.forEach((sc, i) => {
        const el = document.createElement('div');
        el.className = 'fx-card';
        const txt = (sc.text || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim() || '(kosong)';
        el.innerHTML = `<div class="fx-head" data-go="1"><b>Scene ${i + 1}</b><span>${esc(txt.slice(0, 50))}</span><small>${(+sc.duration || 0).toFixed(1)} dtk</small></div>${sceneStyleHtml(sc, i, true)}`;
        bindSceneStyle(el, sc, i);
        $('.fx-head', el).addEventListener('click', () => selectScene(i));
        box.appendChild(el);
      });
      return;
    }
    const clips = clipList();
    $('#fxListHint').textContent = 'Semua klip (foto/video) ada di sini. Pilih transisi, filter, dan efeknya; hasilnya langsung diputar. "Ikut latar" = memakai pengaturan bawaan di bawah.';
    if (!clips.length) { box.innerHTML = '<p class="muted fx-empty">Belum ada klip. Upload foto/video di tab <b>Media</b> dulu, nanti tiap klip muncul di sini.</p>'; return; }
    const tOpts = transOptions();
    const fOpts = Object.entries(FILTERS).map(([v, [n]]) => `<option value="${v}">${n}</option>`).join('');
    const xOpts = Object.entries(EFFECTS).map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
    box.innerHTML = '';
    clips.forEach((c, i) => {
      const m = mediaItem(c.mediaId), th = thumbCache.get(c.mediaId);
      const el = document.createElement('div');
      el.className = 'fx-card' + (c.id === ui.selClip ? ' sel' : '') + (c.filter || c.fx || (c.trans && c.trans !== 'fade') ? ' own' : '');
      el.innerHTML = `<div class="fx-head" data-go="1">
          <span class="fx-thumb"${th && th.ready ? ` style="background-image:url(${th.url})"` : ''}>${th && th.ready ? '' : (m.kind === 'video' ? '🎬' : '🖼')}</span>
          <b>Klip ${i + 1}</b><span>${esc(m.name)}</span><small>${clipDur(c).toFixed(1)} dtk</small>
        </div>
        <div class="ss-grid">
          <label>🔀 Transisi masuk<select data-k="trans"${i === 0 ? ' title="Klip pertama tidak punya transisi masuk"' : ''}>${tOpts}</select></label>
          <label>⏱ Lama transisi (dtk)<input data-k="transDur" type="number" min="0.1" max="5" step="0.1" /></label>
          <label>🎨 Filter warna<select data-k="filter"><option value="">↩ Ikut latar</option>${fOpts}</select></label>
          <label>✨ Efek<select data-k="fx"><option value="">↩ Ikut latar</option>${xOpts}</select></label>
        </div>
        ${i === 0 ? '<p class="muted ss-tip">Klip pertama tidak punya transisi masuk (tidak ada klip sebelumnya).</p>' : ''}
        <div class="ss-btns">
          <button data-a="try" class="small">▶ Coba</button>
          <button data-a="all" class="ghost small" title="Pakai transisi, filter & efek klip ini di semua klip">⧉ Ke semua klip</button>
          <button data-a="rand" class="ghost small">🎲 Acak</button>
          <button data-a="reset" class="ghost small">↺ Reset</button>
          <button data-a="more" class="ghost small" title="Buka semua pengaturan klip (warna, crop, keyframe…) di panel Properti">⚙ Lainnya</button>
        </div>`;
      const q = (k) => el.querySelector(`[data-k=${k}]`);
      q('trans').value = c.trans || 'fade';
      q('transDur').value = +c.transDur || 0.6;
      q('filter').value = c.filter || '';
      q('fx').value = c.fx || '';
      const changed = (tryIt) => {
        save(); renderTimeline(); updateClipBar();
        if (tryIt) tryClip(c); else if (!player.playing) { const r = clipRange(c); if (r) seekTo(r[0] + Math.min(0.7, (r[1] - r[0]) / 2)); }
        fxListKey = fxListSig();
        el.classList.toggle('own', !!(c.filter || c.fx || (c.trans && c.trans !== 'fade')));
      };
      q('trans').addEventListener('change', (e) => { c.trans = e.target.value; changed(true); });
      q('transDur').addEventListener('change', (e) => { c.transDur = clamp(+e.target.value || 0.6, 0.1, 5); e.target.value = c.transDur; changed(true); });
      q('filter').addEventListener('change', (e) => { if (e.target.value) c.filter = e.target.value; else delete c.filter; changed(false); });
      q('fx').addEventListener('change', (e) => { if (e.target.value) c.fx = e.target.value; else delete c.fx; changed(false); });
      el.querySelector('.fx-head').addEventListener('click', () => { selectClip(c.id); $$('.fx-card', box).forEach((x) => x.classList.toggle('sel', x === el)); });
      el.querySelector('.ss-btns').addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'try') return tryClip(c);
        if (a === 'more') { selectClip(c.id); const bar = $('#clipBar'); if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        if (a === 'all') {
          clipList().forEach((o) => { if (o === c) return; o.trans = c.trans; o.transDur = c.transDur; ['filter', 'filterAmt', 'fx', 'fxAmt'].forEach((k) => { if (c[k] != null && c[k] !== '') o[k] = c[k]; else delete o[k]; }); });
          toast(`Transisi & efek klip ${i + 1} dipakai di semua klip`, 'success');
        }
        if (a === 'rand') { const v = TRANSITIONS.map((t) => t[0]).filter((t) => t !== 'none'); c.trans = v[Math.floor(Math.random() * v.length)]; }
        if (a === 'reset') { c.trans = 'fade'; c.transDur = 0.6; delete c.filter; delete c.fx; }
        save(); renderTimeline(); updateClipBar(); renderFxList(true);
        if (a === 'rand') tryClip(c);
        else if (!player.playing) render(player.t);
      });
      box.appendChild(el);
    });
  }
  function bindFxList() {
    $('#btnFxRandAll').addEventListener('click', () => {
      if (!freeMode()) { $('#btnSceneRandAll').click(); renderFxList(true); return; }
      const v = TRANSITIONS.map((t) => t[0]).filter((t) => t !== 'none');
      clipList().forEach((c) => { c.trans = v[Math.floor(Math.random() * v.length)]; });
      save(); renderTimeline(); updateClipBar(); renderFxList(true); if (!player.playing) render(player.t);
      toast('Tiap klip dapat transisi berbeda 🎲', 'success');
    });
    $('#btnFxResetAll').addEventListener('click', () => {
      if (!freeMode()) { $('#btnSceneResetAll').click(); renderFxList(true); return; }
      clipList().forEach((c) => { c.trans = 'fade'; c.transDur = 0.6; delete c.filter; delete c.fx; });
      save(); renderTimeline(); updateClipBar(); renderFxList(true); if (!player.playing) render(player.t);
      toast('Semua klip kembali ke pengaturan bawaan', 'success');
    });
    $('#btnFxPlayAll').addEventListener('click', () => { if (player.playing) pause(); play(true); });
    const tab = document.querySelector('.tab[data-tab=efek]');
    if (tab) tab.addEventListener('click', () => renderFxList(true));
  }
  function bindSceneStyleTools() {
    bindFxList();
    $('#btnSceneRandAll').addEventListener('click', () => {
      if (freeMode()) return;
      state.scenes.forEach(randomSceneStyle);
      renderScenes(); refresh();
      toast('Tiap scene dapat transisi & animasi berbeda 🎲 (klik ▶ Putar untuk melihat)', 'success');
    });
    $('#btnSceneResetAll').addEventListener('click', () => {
      if (freeMode()) return;
      state.scenes.forEach((sc) => SCENE_STYLE_KEYS.forEach((k) => delete sc[k]));
      renderScenes(); refresh();
      toast('Semua scene kembali ikut pengaturan global', 'success');
    });
  }

  function renderScenes() {
    sceneBarKey = '';
    updateLayoutUI();
    $('.scene-style-tools').classList.toggle('hidden', freeMode());
    if (freeMode()) return renderTexts();
    const list = $('#sceneList');
    list.innerHTML = '';
    state.scenes.forEach((sc, i) => {
      const el = document.createElement('div');
      el.className = 'scene';
      el.innerHTML = `
        <div class="scene-head">
          <span class="num">SCENE ${i + 1}</span>
          <button data-act="go" title="Lihat scene ini">👁</button>
          <button data-act="up" title="Naik" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button data-act="down" title="Turun" ${i === state.scenes.length - 1 ? 'disabled' : ''}>↓</button>
          <button data-act="dup" title="Duplikat">⧉</button>
          <button data-act="del" class="del" title="Hapus" ${state.scenes.length === 1 ? 'disabled' : ''}>✕</button>
        </div>
        <textarea rows="3" placeholder="Tulis teks di sini… (*kata* untuk menyorot)"></textarea>
        <div class="meta">
          <input type="text" placeholder="Nama penulis (opsional)" />
          <label class="num-field" title="Detik ke berapa teks ini mulai muncul di video">Masuk (dtk)<input type="number" min="0" step="0.1" data-f="start" /></label>
          <label class="num-field" title="Detik ke berapa teks ini hilang. Kosongkan = tampil sampai scene berakhir">Hilang (dtk)<input type="number" min="0" step="0.1" data-f="end" /></label>
          <label class="num-field" title="Berapa lama scene ini tampil (detik)">Durasi (dtk)<input type="number" min="0.5" max="60" step="0.5" data-f="dur" /></label>
        </div>
        <div class="meta meta2">
          <input type="text" maxlength="12" placeholder="Emoji ✨ (opsional)" title="Emoji / stiker di atas teks" />
          <select title="Background khusus scene ini">
            <option value="">BG: ikut global</option>
            ${GRADIENT_NAMES.map((n, k) => `<option value="g${k}">Gradasi: ${n}</option>`).join('')}
            ${SCENE_COLORS.map(([c, n]) => `<option value="${c}">Warna: ${n}</option>`).join('')}
            ${state.media.map((m, k) => `<option value="m:${esc(m.id)}">${m.kind === 'video' ? '🎬' : '🖼'} ${k + 1}. ${esc(m.name)}</option>`).join('')}
          </select>
        </div>
        ${sceneStyleHtml(sc, i)}`;
      bindSceneStyle(el, sc, i);
      const [ta] = $$('textarea', el);
      const [author, startIn, endIn, dur, emo] = $$('input', el);
      endIn.value = textEnd(i).toFixed(1);
      endIn.addEventListener('focus', () => goToScene(i));
      endIn.addEventListener('change', () => { setTextEnd(i, endIn.value); renderScenes(); refresh(); seekTo(Math.max(0, textEnd(i) - 0.4)); });
      const bgSel = $('select', el);
      ta.value = sc.text; author.value = sc.author; dur.value = sc.duration;
      startIn.value = textStart(i).toFixed(1);
      startIn.addEventListener('focus', () => goToScene(i));
      startIn.addEventListener('change', () => { setTextStart(i, +startIn.value || 0); renderScenes(); refresh(); goToScene(i); });
      emo.value = sc.emoji || ''; bgSel.value = sc.bg || '';
      emo.addEventListener('input', () => { sc.emoji = emo.value; refresh(); });
      emo.addEventListener('focus', () => goToScene(i));
      bgSel.addEventListener('change', () => { sc.bg = bgSel.value; goToScene(i); refresh(); });
      ta.addEventListener('input', () => { sc.text = ta.value; refresh(); });
      ta.addEventListener('focus', () => goToScene(i));
      author.addEventListener('input', () => { sc.author = author.value; refresh(); });
      dur.addEventListener('input', () => { sc.duration = clamp(+dur.value || 0.5, 0.5, 60); updateStartFields(); refresh(); });
      el.querySelector('.scene-head').addEventListener('click', (e) => {
        const act = e.target.dataset.act;
        if (!act) return;
        if (act === 'go') return goToScene(i);
        if (act === 'up' && i > 0) [state.scenes[i - 1], state.scenes[i]] = [state.scenes[i], state.scenes[i - 1]];
        if (act === 'down' && i < state.scenes.length - 1) [state.scenes[i + 1], state.scenes[i]] = [state.scenes[i], state.scenes[i + 1]];
        if (act === 'dup') state.scenes.splice(i + 1, 0, { ...sc });
        if (act === 'del' && state.scenes.length > 1) state.scenes.splice(i, 1);
        renderScenes(); refresh();
      });
      list.appendChild(el);
    });
  }

  // ---------- Panel teks bebas ----------
  function newText(text = '', author = '', start = 0, end = 4) {
    return { id: newId(), text, author, emoji: '', start: r1(start), end: r1(end), x: 0.5, y: +state.style.posY || 0.5 };
  }
  function renderTexts() {
    const list = $('#sceneList');
    list.innerHTML = '';
    let nT = 0, nS = 0, nO = 0;
    const opts = (arr) => arr.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
    state.texts.forEach((tx, i) => {
      const st = isSticker(tx), ov = isOverlay(tx);
      const el = document.createElement('div');
      el.className = `scene${st ? ' sticker' : ''}${tx.id === ui.selText ? ' current' : ''}`;
      el.dataset.id = tx.id;
      const [a, b] = textRange(tx);
      const thumb = st ? (tx.fileId ? `<img class="st-thumb" src="${(mediaEls.get(tx.fileId) || {}).url || ''}" alt="" />` : `<span class="st-thumb emoji">${esc(tx.emoji || '⭐')}</span>`) : '';
      el.innerHTML = `
        <div class="scene-head">
          <span class="num">${ov ? `OVERLAY ${++nO}` : st ? `STIKER ${++nS}` : `TEKS ${++nT}`}</span>
          <button data-act="center" title="Kembalikan posisi ke tengah">⊕ Tengah</button>
          <button data-act="up" title="Ke depan (di atas lapisan lain)">⬆</button>
          <button data-act="go" title="Lihat lapisan ini">👁</button>
          <button data-act="dup" title="Duplikat">⧉</button>
          <button data-act="del" class="del" title="Hapus">✕</button>
        </div>
        ${ov ? ovCardHtml(tx, opts) : st ? `<div class="st-row">${thumb}<label>Animasi <select data-f="anim">${STICKER_ANIMS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
          <label class="check"><input type="checkbox" data-f="shadow" /> Bayangan</label></div>`
    : `<textarea rows="3" placeholder="Tulis teks di sini… (*kata* untuk menyorot)"></textarea>`}
        <div class="meta">
          ${st ? '' : '<input type="text" data-f="author" placeholder="Nama penulis (opsional)" />'}
          <label class="num-field" title="Detik ke berapa lapisan ini muncul">Muncul (dtk)<input type="number" min="0" step="0.1" data-f="start" /></label>
          <label class="num-field" title="Detik ke berapa lapisan ini hilang">Hilang (dtk)<input type="number" min="0" step="0.1" data-f="end" /></label>
          ${st ? '' : '<input type="text" maxlength="12" data-f="emoji" placeholder="Emoji ✨" title="Emoji / stiker di atas teks" />'}
        </div>
        <details class="xf"${tx.id === ui.selText || (tx.keys || []).length ? ' open' : ''}>
          <summary>Transform &amp; keyframe${(tx.keys || []).length ? ` • ◆ ${tx.keys.length}` : ''}</summary>
          <label>Ukuran <input type="range" min="0.1" max="4" step="0.01" data-p="s" /> <output data-o="s"></output></label>
          <label>Putar <input type="range" min="-180" max="180" step="1" data-p="r" /> <output data-o="r"></output></label>
          <label>Transparansi <input type="range" min="0" max="1" step="0.01" data-p="o" /> <output data-o="o"></output></label>
          <div class="row gap kf-row">
            <button data-act="key" class="small" title="Simpan posisi, ukuran, putar & transparansi saat ini sebagai keyframe di posisi playhead">◆ Keyframe di playhead</button>
            ${(tx.keys || []).length ? '<button data-act="keyclear" class="small ghost">Hapus semua</button>' : ''}
          </div>
          <div class="kf-list">${(tx.keys || []).map((k, ki) => `<span class="kf-chip" data-k="${ki}" title="Lompat ke keyframe ini">◆ ${(a + k.t).toFixed(1)}s<b data-kdel="${ki}" title="Hapus keyframe">×</b></span>`).join('')}</div>
          <p class="muted pos-hint">${(tx.keys || []).length ? 'Ada keyframe: setiap perubahan di waktu lain otomatis membuat keyframe baru. Gerakan dihaluskan di antara keyframe.' : '📍 Tarik di preview untuk memindah • scroll = ukuran • Shift+scroll = putar. Tambah ≥2 keyframe untuk animasi gerak.'}</p>
        </details>`;
      const q = (sel) => el.querySelector(sel);
      const startIn = q('[data-f="start"]'), endIn = q('[data-f="end"]');
      startIn.value = a.toFixed(1); endIn.value = b.toFixed(1);
      const focus = () => selectText(tx.id);
      el.querySelectorAll('textarea, input, select').forEach((x) => x.addEventListener('focus', focus));
      const ta = q('textarea');
      if (ta) { ta.value = tx.text || ''; ta.addEventListener('input', () => { tx.text = ta.value; refresh(); }); }
      const author = q('[data-f="author"]');
      if (author) { author.value = tx.author || ''; author.addEventListener('input', () => { tx.author = author.value; refresh(); }); }
      const emo = q('[data-f="emoji"]');
      if (emo) { emo.value = tx.emoji || ''; emo.addEventListener('input', () => { tx.emoji = emo.value; refresh(); }); }
      const anim = q('[data-f="anim"]');
      if (anim) { anim.value = tx.anim || 'pop'; anim.addEventListener('change', () => { tx.anim = anim.value; refresh(); }); }
      const sh = q('[data-f="shadow"]');
      if (sh) { sh.checked = !!tx.shadow; sh.addEventListener('change', () => { tx.shadow = sh.checked; refresh(); }); }
      if (ov) bindOvCard(el, tx);
      startIn.addEventListener('change', () => {
        const len = textRange(tx)[1] - textRange(tx)[0];
        tx.start = r1(Math.max(0, +startIn.value || 0));
        if (tx.end <= tx.start + 0.2) tx.end = r1(tx.start + len);
        if (tx.end > totalDuration()) state.duration = tx.end;
        renderTexts(); refresh(); seekTo(tx.start + Math.min(0.7, (tx.end - tx.start) / 2));
      });
      endIn.addEventListener('change', () => {
        tx.end = r1(Math.max(textRange(tx)[0] + 0.3, +endIn.value || 0));
        if (tx.end > totalDuration()) state.duration = tx.end;
        renderTexts(); refresh(); seekTo(Math.max(tx.start, tx.end - 0.4));
      });
      el.querySelectorAll('[data-p]').forEach((inp) => inp.addEventListener('input', () => {
        if (ui.selText !== tx.id) selectText(tx.id);
        editLayer(tx, { [inp.dataset.p]: +inp.value });
        syncLayerCard();
        if (!player.playing) render(player.t);
        save();
      }));
      el.querySelectorAll('[data-p]').forEach((inp) => inp.addEventListener('change', () => { if ((tx.keys || []).length) renderTexts(); refresh(); }));
      el.querySelector('.kf-list').addEventListener('click', (e) => {
        const del = e.target.closest('[data-kdel]');
        if (del) { tx.keys.splice(+del.dataset.kdel, 1); renderTexts(); refresh(); return; }
        const chip = e.target.closest('[data-k]');
        if (chip) { ui.selText = tx.id; seekTo(textRange(tx)[0] + tx.keys[+chip.dataset.k].t); updateTimeUI(); }
      });
      $('.scene-head', el).addEventListener('click', (e) => {
        const act = e.target.dataset.act;
        if (!act) return;
        if (act === 'go') return selectText(tx.id);
        if (act === 'center') { editLayer(tx, { x: 0.5, y: 0.5 }); }
        if (act === 'up') { state.texts.splice(i, 1); state.texts.push(tx); }
        if (act === 'dup') {
          const P = baseProps(tx);
          const c = { ...tx, id: newId(), y: clamp(P.y + 0.08), keys: (tx.keys || []).map((k) => ({ ...k, y: clamp(+k.y + 0.08) })) };
          state.texts.splice(i + 1, 0, c);
          ui.selText = c.id;
        }
        if (act === 'del') state.texts.splice(i, 1);
        renderTexts(); refresh();
      });
      el.querySelector('.kf-row').addEventListener('click', (e) => {
        const act = e.target.dataset.act;
        if (act === 'key') {
          const [a0, b0] = textRange(tx);
          if (player.t < a0 || player.t > b0) { toast('Taruh playhead di dalam waktu tampil lapisan ini dulu.', 'error'); return; }
          upsertKey(tx, r1Fine(player.t - a0), layerProps(tx, player.t - a0));
          toast(`Keyframe di ${player.t.toFixed(1)} dtk ◆${tx.keys.length < 2 ? ' — tambah satu lagi di waktu lain untuk animasi' : ''}`, 'success');
        }
        if (act === 'keyclear') { const P = layerProps(tx, layerLocal(tx)); tx.keys = []; Object.assign(tx, P); }
        if (act) { renderTexts(); refresh(); }
      });
      list.appendChild(el);
    });
    if (!state.texts.length) list.innerHTML = '<p class="muted">Belum ada teks. Klik <b>+ Tambah Teks</b>, atau tambah stiker di tab Stiker.</p>';
    syncLayerCard();
  }

  function ovCardHtml(l, opts) {
    const url = (mediaEls.get(l.fileId) || {}).url || '';
    const v = l.media === 'video';
    const thumb = v ? `<video class="st-thumb" src="${url}#t=0.1" muted preload="metadata"></video>` : `<img class="st-thumb" src="${url}" alt="" />`;
    const fOpts = Object.entries(FILTERS).map(([k, [n]]) => `<option value="${k}">${n}</option>`).join('');
    return `<div class="st-row">${thumb}<span class="ov-name">${esc(l.name || 'overlay')}</span>
        <button data-act="ovfill" class="small" title="Perbesar sampai menutupi seluruh layar">⛶ Penuh layar</button>
        <button data-act="ovpip" class="small ghost" title="Kecilkan ke pojok (picture-in-picture)">◰ Pojok</button></div>
      <div class="ov-grid">
        <label>Animasi <select data-ov="anim">${opts(OV_ANIMS)}</select></label>
        <label>Mode campur <select data-ov="blend">${opts(OV_BLENDS)}</select></label>
        <label>Bentuk (mask) <select data-ov="mask">${opts(OV_MASKS)}</select></label>
        <label>Halus tepi <input type="range" min="0" max="1" step="0.05" data-ov="feather" /></label>
        <label>Bingkai <input type="range" min="0" max="12" step="0.5" data-ov="border" /><input type="color" data-ov="borderColor" title="Warna bingkai" /></label>
        <label>Filter <select data-ov="filter">${fOpts}</select></label>
        <label class="check"><input type="checkbox" data-ov="shadow" /> Bayangan</label>
        <label class="check"><input type="checkbox" data-ov="flip" /> Cermin</label>
      </div>
      <details class="ck"${ovv(l, 'chroma') ? ' open' : ''}><summary>🟩 Chroma key (hapus latar hijau/biru)</summary>
        <label class="check"><input type="checkbox" data-ov="chroma" /> Aktifkan chroma key</label>
        <label>Warna dihapus <input type="color" data-ov="keyColor" /> <button data-act="autokey" class="small ghost" title="Ambil warna dari tepi gambar">🎯 Deteksi otomatis</button></label>
        <label>Kekuatan <input type="range" min="0" max="1" step="0.01" data-ov="tol" /></label>
        <label>Kehalusan tepi <input type="range" min="0.01" max="0.6" step="0.01" data-ov="soft" /></label>
        <label>Hilangkan pantulan <input type="range" min="0" max="1" step="0.05" data-ov="spill" /></label>
      </details>
      ${v ? `<div class="ov-grid">
        <label class="check"><input type="checkbox" data-ov="sound" /> Suara video</label>
        <label>Volume <input type="range" min="0" max="1" step="0.05" data-ov="vol" /></label>
        <label title="Detik di dalam video tempat overlay mulai">Mulai dari (dtk) <input type="number" min="0" step="0.1" data-ov="in" /></label>
        <label class="check"><input type="checkbox" data-ov="loop" /> Ulang bila habis</label>
      </div>` : ''}`;
  }
  function bindOvCard(el, l) {
    el.querySelectorAll('[data-ov]').forEach((inp) => {
      const k = inp.dataset.ov, val = ovv(l, k);
      if (inp.type === 'checkbox') inp.checked = !!val; else inp.value = val;
      const apply = () => {
        const nv = inp.type === 'checkbox' ? inp.checked : (inp.type === 'range' || inp.type === 'number') ? +inp.value : inp.value;
        l[k] = k === 'in' ? Math.max(0, nv) : nv;
        if (k === 'chroma' && nv && !l.keyPicked && autoKeyColor(l)) { l.keyPicked = true; const kc = el.querySelector('[data-ov="keyColor"]'); if (kc) kc.value = l.keyColor; }
        if (k === 'keyColor') l.keyPicked = true;
        if (k === 'in' || k === 'loop' || k === 'sound' || k === 'vol') syncVideos(player.t, true);
        if (!player.playing) render(player.t);
        save();
      };
      inp.addEventListener(inp.tagName === 'SELECT' || inp.type === 'checkbox' || inp.type === 'number' ? 'change' : 'input', apply);
      inp.addEventListener('change', () => refresh());
    });
    el.addEventListener('click', (e) => {
      const act = e.target.dataset && e.target.dataset.act;
      if (act === 'ovfill') { ovFill(l); renderTexts(); refresh(); }
      if (act === 'ovpip') { editLayer(l, { x: 0.72, y: 0.2, s: 0.75, r: 0 }); renderTexts(); refresh(); }
      if (act === 'autokey') {
        if (!autoKeyColor(l)) { toast('Overlay belum termuat, coba lagi sebentar.', 'error'); return; }
        l.keyPicked = true; l.chroma = true;
        renderTexts(); refresh();
        toast(`Warna kunci: ${l.keyColor}`, 'success');
      }
    });
  }
  // slider transform pada kartu lapisan terpilih mengikuti nilai di posisi playhead
  function syncLayerCard() {
    if (!freeMode()) return;
    const l = textById(ui.selText);
    if (!l) return;
    const el = $(`#sceneList .scene[data-id="${l.id}"]`);
    if (!el) return;
    const P = layerProps(l, clamp(layerLocal(l), 0, 1e6));
    el.querySelectorAll('[data-p]').forEach((inp) => { if (document.activeElement !== inp) inp.value = P[inp.dataset.p]; });
    const fmt = { s: (v) => `${Math.round(v * 100)}%`, r: (v) => `${Math.round(v)}°`, o: (v) => `${Math.round(v * 100)}%` };
    el.querySelectorAll('[data-o]').forEach((o) => { o.textContent = fmt[o.dataset.o](P[o.dataset.o]); });
  }
  // Tambah stiker (emoji atau gambar) di posisi playhead
  function addSticker(extra) {
    if (!freeMode()) setLayout('free');
    const total = totalDuration();
    const a = player.t >= total - 0.5 ? 0 : player.t;
    const l = { id: newId(), kind: 'sticker', anim: 'pop', start: r1(a), end: r1(Math.min(total, a + 3)), x: 0.5, y: 0.35, s: 1, r: 0, o: 1, keys: [], ...extra };
    if (l.end - l.start < 1) { l.start = r1(Math.max(0, total - 3)); l.end = r1(total); }
    state.texts.push(l);
    ui.selText = l.id;
    renderScenes(); refresh();
    selectText(l.id);
    return l;
  }
  const STICKER_EMOJIS = '❤️ 😍 🥰 🔥 ✨ ⭐ 🌟 💯 👍 🙏 😂 🥺 😭 💔 🌸 🌹 🌙 ☀️ ⚡ 🎉 🎵 💪 👑 💎 🦋 🌈 ☕ 📌 ✅ ❌ ⚠️ 👉 👆 💬 💭 🎁 🍀 🌊 🕊️ 🤍 🖤 💛 💚 💙 💜 🤲 📿 🕌'.split(' ');
  function bindStickers() {
    $('#emojiGrid').innerHTML = STICKER_EMOJIS.map((e) => `<button class="emoji-btn" data-e="${e}" title="Tambah ${e}">${e}</button>`).join('');
    $('#emojiGrid').addEventListener('click', (e) => {
      const b = e.target.closest('[data-e]');
      if (b) { addSticker({ emoji: b.dataset.e }); toast(`Stiker ${b.dataset.e} ditambahkan • tarik di preview untuk memindah`, 'success'); }
    });
    $('#btnEmojiCustom').addEventListener('click', () => {
      const v = $('#emojiCustom').value.trim();
      if (v) addSticker({ emoji: v });
    });
    $('#fileSticker').addEventListener('change', (e) => {
      for (const f of [...e.target.files].filter((x) => x.type.startsWith('image/'))) {
        const fileId = newId();
        const entry = { el: null, ready: false, missing: false, url: '' };
        mediaEls.set(fileId, entry);
        attachBlob({ id: fileId, kind: 'image' }, entry, f);
        idbPut(fileId, f).catch(() => {});
        addSticker({ fileId, name: f.name });
      }
      e.target.value = '';
    });
    $('#fileOverlay').addEventListener('change', (e) => {
      addOverlayFiles(e.target.files);
      e.target.value = '';
      toast('Overlay ditambahkan • atur bentuk, chroma key & bingkai di kartunya (tab Teks)', 'success');
    });
  }

  // ---------- Klip: pilih, potong, hapus, toolbar ----------
  function clipRange(clip) {
    let a = 0;
    for (const c of clipList()) { const d = clipDur(c); if (c === clip) return [a, a + d]; a += d; }
    return null;
  }
  function selectClip(id, seek = true) {
    const c = clipById(id);
    if (!c) return;
    ui.selClip = id;
    ui.selAudio = '';
    ui.focus = 'clip';
    updateAudioBar();
    if (c.mediaId !== ui.selMedia) { ui.selMedia = c.mediaId; syncControls(); }
    const r = clipRange(c);
    if (seek && r && !player.playing && (player.t < r[0] || player.t >= r[1])) seekTo(r[0] + Math.min(0.7, (r[1] - r[0]) / 2));
    if (!tl.drag) renderTimeline();
    updateClipBar();
  }
  // klip yang dipotong: yang dipilih bila playhead di dalamnya, kalau tidak klip di bawah playhead
  function clipAtPlayhead() {
    if (!timedSlides()) return null;
    const t = player.t, C = cycleDur();
    if (t >= C) return null; // bagian ulangan tidak bisa dipotong
    return slideAt(t);
  }
  function splitClip() {
    const sl = clipAtPlayhead();
    if (!sl) { toast(freeMode() ? 'Taruh playhead di atas klip latar (foto/video) untuk memotong.' : 'Potong klip butuh latar foto/video berurutan.', 'error'); return; }
    const c = sl.clip, local = player.t - sl.a, d = sl.b - sl.a;
    if (local < 0.2 || d - local < 0.2) { toast('Terlalu dekat dengan tepi klip.', 'error'); return; }
    const sp2 = curvePts(c) ? flattenCurveAt(c, local) : null;
    const sp = +c.speed || 1;
    const second = newClip(c.mediaId, { in: Math.round(((+c.in || 0) + (c.freeze || c.rev ? 0 : local * sp)) * 100) / 100, dur: r1(d - local), speed: c.speed, trans: 'none', transDur: c.transDur, rev: !!c.rev, freeze: !!c.freeze, ...clipVisual(c, local) });
    if (c.rev) c.in = Math.round(((+c.in || 0) + (d - local) * sp) * 100) / 100; // bagian pertama = ujung akhir video
    cutKeys(c, local);
    c.dur = r1(local);
    if (sp2) { second.speed = sp2; second.in = Math.round(curveSrcFlat(c, local) * 100) / 100; }
    delete c.animOut; delete c.animOutDur; delete second.animIn; // animasi masuk tetap di potongan pertama
    state.clips.splice(state.clips.indexOf(c) + 1, 0, second);
    ui.selClip = second.id;
    renderScenes(); refresh(); updateClipBar();
    toast(sp2 ? 'Klip dipotong ✂ (kurva kecepatan diganti kecepatan tetap per bagian)' : 'Klip dipotong ✂', 'success');
  }
  function trimAtPlayhead(side) {
    const sl = clipAtPlayhead();
    if (!sl) { toast('Taruh playhead di atas klip untuk memangkas.', 'error'); return; }
    const c = sl.clip, local = player.t - sl.a, d = sl.b - sl.a;
    if (local < 0.2 || d - local < 0.2) { toast('Terlalu dekat dengan tepi klip.', 'error'); return; }
    splitClip();
    const second = clipById(ui.selClip);
    if (!second || second === c) return;
    if (side === 'left') { state.clips = state.clips.filter((x) => x !== c); second.trans = c.trans; second.transDur = c.transDur; ui.selClip = second.id; }
    else { state.clips = state.clips.filter((x) => x !== second); ui.selClip = c.id; }
    renderScenes(); refresh(); updateClipBar();
    if (side === 'left') seekTo(Math.max(0, sl.a));
    toast(side === 'left' ? 'Bagian kiri playhead dihapus' : 'Bagian kanan playhead dihapus', 'success');
  }
  // Beku (freeze frame): sisipkan foto diam 2 dtk dari frame di posisi playhead
  function freezeClip() {
    const sl = clipAtPlayhead();
    const it = sl && mediaItem(sl.clip.mediaId);
    if (!sl || !it || it.kind !== 'video') { toast('Taruh playhead di atas klip VIDEO untuk membekukan frame.', 'error'); return; }
    const c = sl.clip, local = player.t - sl.a, d = sl.b - sl.a, sp = +c.speed || 1;
    const e = mediaEls.get(it.id), sd = (e && e.el && e.el.duration) || 1e6;
    const src = srcTimeAt({ clip: c, mStart: sl.a }, player.t, sd);
    const fr = newClip(c.mediaId, { in: Math.round(src * 100) / 100, dur: 2, speed: 1, trans: 'none', freeze: true, ...clipVisual(c), ...kfVals(c, local) });
    let at = state.clips.indexOf(c);
    if (local < 0.2) state.clips.splice(at, 0, fr);
    else if (d - local < 0.2 || c.freeze) state.clips.splice(at + 1, 0, fr);
    else {
      const second = newClip(c.mediaId, { in: Math.round(((+c.in || 0) + (c.rev ? 0 : local * sp)) * 100) / 100, dur: r1(d - local), speed: c.speed, trans: 'none', transDur: c.transDur, rev: !!c.rev, ...clipVisual(c, local) });
      if (c.rev) c.in = Math.round(((+c.in || 0) + (d - local) * sp) * 100) / 100;
      cutKeys(c, local);
      c.dur = r1(local);
      state.clips.splice(at + 1, 0, fr, second);
    }
    ui.selClip = fr.id;
    renderScenes(); refresh(); updateClipBar();
    toast('Frame dibekukan ❄ 2 dtk • ubah lamanya lewat Durasi', 'success');
  }
  // bagian pertama klip yang dipotong: keyframe sesudah titik potong dibuang, nilai di titik potong dipertahankan
  function cutKeys(c, local) {
    if (!c.kf || !c.kf.length) return;
    const end = { t: r1Fine(local), ...kfVals(c, local) };
    c.kf = [...c.kf.filter((k) => k.t < local - 0.05), end];
  }
  function updateClipBar() {
    updateGridSel();
    renderCurveBox();
    { const c0 = clipById(ui.selClip); if (c0) { fillClipAnimUi(c0);
      const cv = $('#clipCanvas'); if (document.activeElement !== cv) cv.value = c0.canvasBg || '';
      $('#clipCanvasColor').value = c0.canvasColor || '#000000'; $('#clipCanvasBlur').value = c0.canvasBlur || 2;
      $$('#clipBar .canvas-opt').forEach((el) => el.classList.toggle('hidden', !c0.canvasBg || (el.classList.contains('canvas-color') && c0.canvasBg !== 'color') || (el.classList.contains('canvas-blur') && c0.canvasBg !== 'blur')));
    } }
    {
      const c = clipById(ui.selClip), m = c && mediaItem(c.mediaId), isV = !!(m && m.kind === 'video');
      $('#clipAudNote').classList.toggle('hidden', !c || isV);
      $$('#clipBar .clip-aud').forEach((el) => el.classList.toggle('hidden', !isV));
      if (c && isV) {
        const set = (id, v) => { const el = $(id); if (document.activeElement !== el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v; } };
        set('#clipVol', c.vol == null ? 1 : c.vol); set('#clipMute', c.mute); set('#clipFadeIn', +c.fadeIn || 0); set('#clipFadeOut', +c.fadeOut || 0);
        $('#clipVolOut').textContent = `${Math.round((c.vol == null ? 1 : +c.vol) * 100)}%`;
      }
    }
    { const c = clipById(ui.selClip), m = c && mediaItem(c.mediaId); $('#btnClipRmbg').classList.toggle('hidden', !(m && m.kind === 'image') || !!c.rmbgFrom); $('#btnClipRmbgUndo').classList.toggle('hidden', !(c && c.rmbgFrom)); }
    const bar = $('#clipBar');
    const c = clipById(ui.selClip);
    const show = !!c && timedSlides();
    bar.classList.toggle('hidden', !show);
    if (!show) return;
    const it = mediaItem(c.mediaId), r = clipRange(c);
    $('#clipName').textContent = `${it.kind === 'video' ? '🎬' : '🖼'} ${clipList().indexOf(c) + 1}. ${it.name}`;
    const set = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = v; };
    set('#clipSpeed', String(+c.speed || 1));
    set('#clipTrans', c.trans || 'fade');
    set('#clipTransDur', +c.transDur || 0.6);
    set('#clipDur', r ? +(r[1] - r[0]).toFixed(2) : '');
    set('#clipIn', +c.in || 0);
    $('#clipSpeedWrap').classList.toggle('hidden', it.kind !== 'video' || !!c.freeze);
    $('#clipInWrap').classList.toggle('hidden', it.kind !== 'video');
    $('#clipInWrap').firstChild.textContent = c.freeze ? 'Frame detik ' : 'Mulai dari ';
    $('#btnClipRev').classList.toggle('hidden', it.kind !== 'video' || !!c.freeze);
    $('#btnClipRev').classList.toggle('active', !!c.rev);
    $('#btnClipFreeze').classList.toggle('hidden', it.kind !== 'video');
    $('#clipTransDur').disabled = c.trans === 'none';
    set('#clipFilter', c.filter || '');
    set('#clipFilterAmt', c.filterAmt == null ? 100 : c.filterAmt);
    set('#clipFx', c.fx || '');
    set('#clipFxAmt', c.fxAmt == null ? 60 : c.fxAmt);
    $('#clipFilterAmt').disabled = !c.filter || c.filter === 'none';
    $('#clipFxAmt').disabled = !c.fx || c.fx === 'none';
    // atur warna & crop
    const adj = clipAdj(c), crop = c.crop || {};
    $$('#clipBar [data-adj]').forEach((el) => { set('#' + el.id, adj[el.dataset.adj]); el.nextElementSibling.textContent = adj[el.dataset.adj]; });
    $$('#clipBar [data-crop]').forEach((el) => { const v = +crop[el.dataset.crop] || 0; set('#' + el.id, v); el.nextElementSibling.textContent = v + '%'; });
    $('#btnClipFlipH').classList.toggle('active', !!c.flipH);
    $('#btnClipFlipV').classList.toggle('active', !!c.flipV);
    $('#btnClipRot').lastChild.textContent = ' Putar 90°' + (+c.rot ? ` (${((+c.rot % 360) + 360) % 360}°)` : '');
    // zoom & geser
    const lt = clipLocalT(c), kv = kfVals(c, lt), n = (c.kf || []).length;
    $$('#clipBar [data-kf]').forEach((el) => { const v = kv[el.dataset.kf]; set('#' + el.id, v); el.nextElementSibling.textContent = el.dataset.kf === 'z' || el.dataset.kf === 'o' ? v + '%' : el.dataset.kf === 'r' ? v + '°' : v; });
    const onKey = (c.kf || []).some((k) => Math.abs(k.t - lt) < 0.06);
    $('#kfInfo').textContent = n ? `◆ ${n} keyframe${onKey ? ' • di playhead' : ''}` : '';
    $('#btnKfDel').disabled = !onKey;
    $('#btnKfClear').disabled = !n;
  }
  // detik playhead di dalam klip (0..durasi klip)
  function clipLocalT(c) {
    const r = clipRange(c);
    return r ? r1Fine(clamp(player.t - r[0], 0, r[1] - r[0])) : 0;
  }
  // ubah zoom/geser: tanpa keyframe → nilai dasar klip; dengan keyframe → keyframe di playhead
  function editClipView(c, patch) {
    if (c.kf && c.kf.length) upsertClipKey(c, clipLocalT(c), { ...kfVals(c, clipLocalT(c)), ...patch });
    else { const p2 = { ...patch }; if ('r' in p2) { c.rr = p2.r; delete p2.r; } if ('o' in p2) { c.op = p2.o; delete p2.o; } Object.assign(c, p2); }
  }
  function upsertClipKey(c, lt, vals) {
    c.kf = c.kf || [];
    const k = c.kf.find((q) => Math.abs(q.t - lt) < 0.06);
    const v = { z: Math.round(+vals.z), x: Math.round(+vals.x), y: Math.round(+vals.y), r: Math.round(+vals.r || 0), o: vals.o == null ? 100 : Math.round(+vals.o) };
    if (k) Object.assign(k, v); else c.kf.push({ t: lt, ...v });
    c.kf.sort((a, b) => a.t - b.t);
  }
  function bindClipBar() {
    $('#clipTrans').innerHTML = transOptions();
    $('#bgXTrans').innerHTML = transOptions();
    const fOpts = Object.entries(FILTERS).map(([v, [n]]) => `<option value="${v}">${n}</option>`).join('');
    const xOpts = Object.entries(EFFECTS).map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
    $('#clipFilter').innerHTML = '<option value="">Filter: ikut latar</option>' + fOpts;
    $('#clipFx').innerHTML = '<option value="">Efek: ikut latar</option>' + xOpts;
    $('#bgFilter').innerHTML = fOpts;
    $('#bgFx').innerHTML = xOpts;
    const cur = () => clipById(ui.selClip);
    const after = () => { mediaLibKey = ''; syncVideos(player.t, true); renderScenes(); refresh(); updateClipBar(); };
    $('#clipSpeed').addEventListener('change', (e) => {
      const c = cur(); if (!c) return;
      const old = +c.speed || 1, nv = +e.target.value || 1;
      if (+c.dur > 0) c.dur = r1(Math.max(0.3, (c.dur * old) / nv)); // bagian video yang sama, jadi lebih cepat/lambat
      c.speed = nv;
      after();
    });
    $('#clipTrans').addEventListener('change', (e) => { const c = cur(); if (c) { c.trans = e.target.value; after(); } });
    $('#clipTransDur').addEventListener('change', (e) => { const c = cur(); if (c) { c.transDur = clamp(+e.target.value || 0.6, 0.1, 5); after(); } });
    $('#clipDur').addEventListener('change', (e) => {
      const c = cur(); if (!c) return;
      const it = mediaItem(c.mediaId), sd = srcDuration(it);
      let v = Math.max(0.3, +e.target.value || 0.3);
      if (sd && !c.freeze) v = Math.min(v, (sd - (+c.in || 0)) / (+c.speed || 1));
      c.dur = r1(v);
      after();
    });
    $('#clipIn').addEventListener('change', (e) => {
      const c = cur(); if (!c) return;
      const sd = srcDuration(mediaItem(c.mediaId));
      if (c.freeze) { c.in = Math.round(clamp(+e.target.value || 0, 0, Math.max(0, (sd || 1e6) - 0.05)) * 100) / 100; after(); return; }
      const endSrc = (+c.in || 0) + clipDur(c) * (+c.speed || 1);
      c.in = Math.round(clamp(+e.target.value || 0, 0, Math.max(0, (sd || endSrc) - 0.3)) * 100) / 100;
      if (+c.dur > 0) c.dur = r1(Math.max(0.3, (Math.min(endSrc, sd || endSrc) - c.in) / (+c.speed || 1)));
      after();
    });
    $('#clipFilter').addEventListener('change', (e) => { const c = cur(); if (c) { c.filter = e.target.value; after(); } });
    $('#clipFilterAmt').addEventListener('input', (e) => { const c = cur(); if (c) { c.filterAmt = +e.target.value; if (!player.playing) render(player.t); save(); } });
    $('#clipFx').addEventListener('change', (e) => { const c = cur(); if (c) { c.fx = e.target.value; after(); } });
    $('#clipFxAmt').addEventListener('input', (e) => { const c = cur(); if (c) { c.fxAmt = +e.target.value; if (!player.playing) render(player.t); save(); } });
    $('#btnSplit').addEventListener('click', splitClip);
    $('#btnClipFreeze').addEventListener('click', freezeClip);
    $('#btnClipRev').addEventListener('click', () => {
      const c = cur(); if (!c) return;
      if (!+c.dur) c.dur = r1(clipDur(c)); // bagian yang sama, hanya arahnya dibalik
      c.rev = !c.rev;
      after();
      toast(c.rev ? 'Klip diputar mundur ⏪ (preview bisa patah-patah, hasil export mulus)' : 'Klip diputar normal', 'success');
    });
    $('#btnClipDup').addEventListener('click', () => {
      const c = cur(); if (!c) return;
      const copy = { ...c, id: newId(), dur: r1(clipDur(c)) };
      state.clips.splice(state.clips.indexOf(c) + 1, 0, copy);
      ui.selClip = copy.id;
      after();
    });
    $('#btnClipDel').addEventListener('click', () => {
      const c = cur(); if (!c) return;
      state.clips = state.clips.filter((x) => x !== c);
      ui.selClip = '';
      after();
    });
    // ---- atur warna ----
    const live = () => { if (!player.playing) render(player.t); updateClipBar(); save(); };
    $$('#clipBar [data-adj]').forEach((el) => el.addEventListener('input', () => {
      const c = cur(); if (!c) return;
      c.adj = { ...(c.adj || {}), [el.dataset.adj]: +el.value };
      live();
    }));
    $('#btnAdjReset').addEventListener('click', () => { const c = cur(); if (c) { delete c.adj; liveTl(); } });
    $('#btnAdjAll').addEventListener('click', () => {
      const c = cur(); if (!c) return;
      state.clips.forEach((x) => { if (c.adj) x.adj = { ...c.adj }; else delete x.adj; });
      live();
      toast('Pengaturan warna dipakai di semua klip', 'success');
    });
    // ---- crop, putar & balik ----
    $$('#clipBar [data-crop]').forEach((el) => el.addEventListener('input', () => {
      const c = cur(); if (!c) return;
      c.crop = { ...(c.crop || {}), [el.dataset.crop]: +el.value };
      live();
    }));
    const liveTl = () => { live(); renderTimeline(); };
    $$('#clipBar [data-adj], #clipBar [data-crop]').forEach((el) => el.addEventListener('change', () => renderTimeline()));
    $('#btnClipRot').addEventListener('click', () => { const c = cur(); if (c) { c.rot = ((+c.rot || 0) + 90) % 360; liveTl(); } });
    $('#btnClipFlipH').addEventListener('click', () => { const c = cur(); if (c) { c.flipH = !c.flipH; liveTl(); } });
    $('#btnClipFlipV').addEventListener('click', () => { const c = cur(); if (c) { c.flipV = !c.flipV; liveTl(); } });
    $('#btnCropReset').addEventListener('click', () => { const c = cur(); if (c) { delete c.crop; delete c.rot; delete c.flipH; delete c.flipV; liveTl(); } });
    // ---- zoom & geser (keyframe) ----
    $$('#clipBar [data-kf]').forEach((el) => el.addEventListener('input', () => {
      const c = cur(); if (!c) return;
      editClipView(c, { [el.dataset.kf]: +el.value });
      live();
    }));
    $('#btnKfAdd').addEventListener('click', () => {
      const c = cur(); if (!c) return;
      const lt = clipLocalT(c), had = !!(c.kf && c.kf.length);
      upsertClipKey(c, lt, kfVals(c, lt));
      if (!had) { delete c.z; delete c.x; delete c.y; }
      renderTimeline(); live();
      toast(`◆ Keyframe di detik ${lt.toFixed(2)} klip ini. Pindah playhead lalu ubah zoom/geser untuk keyframe berikutnya.`, 'success');
    });
    $('#btnKfDel').addEventListener('click', () => {
      const c = cur(); if (!c || !c.kf) return;
      const lt = clipLocalT(c), keep = kfVals(c, lt);
      c.kf = c.kf.filter((k) => Math.abs(k.t - lt) >= 0.06);
      if (!c.kf.length) { delete c.kf; Object.assign(c, keep); }
      renderTimeline(); live();
    });
    $('#btnKfClear').addEventListener('click', () => {
      const c = cur(); if (!c) return;
      delete c.kf; delete c.z; delete c.x; delete c.y;
      renderTimeline(); live();
    });
    let kbStep = 0;
    $('#btnKenBurns').addEventListener('click', () => {
      const c = cur(); if (!c) return;
      const d = r1Fine(clipDur(c));
      // tiap klik memberi variasi gerakan lain
      const presets = [
        [{ z: 100, x: 0, y: 0 }, { z: 125, x: 0, y: 0 }],
        [{ z: 125, x: 0, y: 0 }, { z: 100, x: 0, y: 0 }],
        [{ z: 120, x: -6, y: 0 }, { z: 120, x: 6, y: 0 }],
        [{ z: 120, x: 6, y: 0 }, { z: 120, x: -6, y: 0 }],
        [{ z: 105, x: 0, y: 5 }, { z: 130, x: 0, y: -4 }],
      ];
      const [a, b] = presets[kbStep++ % presets.length];
      c.kf = [{ t: 0, ...a }, { t: d, ...b }];
      delete c.z; delete c.x; delete c.y;
      renderTimeline(); live();
      toast(`🎥 Ken Burns ${((kbStep - 1) % presets.length) + 1}/${presets.length} • klik lagi untuk gerakan lain`, 'success');
    });
    $('#btnClipTransAll').addEventListener('click', () => {
      const c = cur(); if (!c) return;
      state.clips.forEach((x) => { x.trans = c.trans; x.transDur = c.transDur; });
      after();
      toast('Transisi dipakai di semua klip', 'success');
    });
  }

  // ---------- Track audio: panel, toolbar, potong, efek suara bawaan ----------
  function selectAudio(id) {
    ui.selAudio = id;
    ui.selClip = '';
    ui.focus = 'audio';
    if (!tl.drag) renderTimeline();
    updateClipBar();
    updateAudioBar();
    renderAudioList();
  }
  function addAudioFile(blob, name, start) {
    const fileId = newId();
    const entry = { el: null, ready: false, missing: false, url: '' };
    mediaEls.set(fileId, entry);
    attachBlob({ id: fileId, kind: 'audio' }, entry, blob);
    idbPut(fileId, blob).catch(() => {});
    const a = { id: newId(), fileId, name, start: r1Fine(start == null ? player.t : start), in: 0, dur: 0, vol: 1, fadeIn: 0, fadeOut: 0, fx: 'none' };
    state.audios.push(a);
    if (!audio.ctx) ensureAudioGraph(); else routeAudioTrack(entry);
    selectAudio(a.id);
    refresh();
    return a;
  }
  function splitAudio() {
    const a = audioById(ui.selAudio);
    if (!a) return false;
    const [s0, s1] = audioRange(a);
    const t = player.t;
    if (t <= s0 + 0.1 || t >= s1 - 0.1) { toast('Taruh playhead di tengah track audio untuk memotong.', 'error'); return true; }
    const left = t - s0;
    const b = { ...a, id: newId(), start: r1Fine(t), in: r1Fine((+a.in || 0) + left), dur: r1Fine(s1 - t), fadeIn: 0 };
    a.dur = r1Fine(left); a.fadeOut = 0;
    state.audios.splice(state.audios.indexOf(a) + 1, 0, b);
    selectAudio(b.id);
    refresh();
    toast('Audio dipotong ✂', 'success');
    return true;
  }
  function renderAudioList() {
    renderBeatUI();
    const box = $('#audioList');
    if (!box) return;
    const list = state.audios || [];
    box.innerHTML = list.length ? list.map((a) => {
      const [s0, s1] = audioRange(a);
      return `<div class="au-item${a.id === ui.selAudio ? ' current' : ''}" data-aid="${esc(a.id)}">
        <span class="au-name">🎵 ${esc(a.name || 'audio')}</span><span class="mono muted">${s0.toFixed(1)}–${s1.toFixed(1)}s</span>
        <button class="small ghost" data-del title="Hapus track">✕</button></div>`;
    }).join('') : '<p class="muted">Belum ada track tambahan.</p>';
  }
  function updateAudioBar() {
    const bar = $('#audioBar');
    const a = audioById(ui.selAudio);
    bar.classList.toggle('hidden', !a);
    if (!a) return;
    const [s0, s1] = audioRange(a);
    $('#audName').textContent = `🎵 ${a.name || 'audio'}`;
    const set = (id, v) => { const el = $(id); if (document.activeElement !== el) el.value = v; };
    set('#audStart', s0.toFixed(2)); set('#audLen', (s1 - s0).toFixed(2));
    set('#audVol', a.vol == null ? 1 : a.vol); set('#audFadeIn', +a.fadeIn || 0); set('#audFadeOut', +a.fadeOut || 0);
    set('#audFx', a.fx || 'none');
    set('#audPitch', String(+a.pitch || 0));
    $('#audVolOut').textContent = `${Math.round((a.vol == null ? 1 : a.vol) * 100)}%`;
    $('#btnAudOrig').classList.toggle('hidden', !a.origFileId);
  }
  // efek suara bawaan: disintesis langsung (tanpa file / internet)
  const SFX = [['whoosh', '💨 Whoosh'], ['pop', '🫧 Pop'], ['ding', '🔔 Ding'], ['click', '🖱 Klik'], ['boom', '💥 Boom'],
    ['swipe', '👋 Swipe'], ['notif', '📱 Notifikasi'], ['typing', '⌨ Mengetik'], ['heart', '💓 Detak'], ['riser', '📈 Riser']];
  async function synthSfx(type) {
    const sr = 44100;
    const dur = { whoosh: 0.8, pop: 0.18, ding: 1.4, click: 0.06, boom: 1.4, swipe: 0.4, notif: 0.7, typing: 1.6, heart: 1.0, riser: 2.2 }[type] || 1;
    const oc = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);
    const out = oc.createGain(); out.connect(oc.destination);
    const noise = (len) => { const b = oc.createBuffer(1, Math.ceil(sr * len), sr), d = b.getChannelData(0), r = mulberry32(7); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; const s = oc.createBufferSource(); s.buffer = b; return s; };
    const env = (g, t0, a, peak, rel) => { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + rel); };
    const tone = (f0, f1, t0, len, type2 = 'sine', peak = 0.6) => {
      const o = oc.createOscillator(), g = oc.createGain(); o.type = type2;
      o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + len);
      env(g, t0, 0.005, peak, len); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + len + 0.05);
    };
    if (type === 'whoosh' || type === 'swipe') {
      const n = noise(dur), bp = oc.createBiquadFilter(), g = oc.createGain();
      bp.type = 'bandpass'; bp.Q.value = type === 'swipe' ? 2 : 1.2;
      bp.frequency.setValueAtTime(type === 'swipe' ? 1500 : 300, 0); bp.frequency.exponentialRampToValueAtTime(type === 'swipe' ? 6000 : 3500, dur * 0.7);
      g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.9, dur * 0.45); g.gain.linearRampToValueAtTime(0, dur);
      n.connect(bp); bp.connect(g); g.connect(out); n.start(0);
    } else if (type === 'pop') tone(700, 180, 0, 0.15, 'sine', 0.8);
    else if (type === 'ding') { tone(1320, 1320, 0, 1.3, 'sine', 0.5); tone(2640, 2640, 0, 0.9, 'sine', 0.18); }
    else if (type === 'click') { const n = noise(0.04), g = oc.createGain(); env(g, 0, 0.001, 0.8, 0.03); n.connect(g); g.connect(out); n.start(0); }
    else if (type === 'boom') {
      tone(140, 35, 0, 1.3, 'sine', 1);
      const n = noise(1.2), lp = oc.createBiquadFilter(), g = oc.createGain(); lp.type = 'lowpass'; lp.frequency.value = 400;
      env(g, 0, 0.005, 0.7, 1.1); n.connect(lp); lp.connect(g); g.connect(out); n.start(0);
    } else if (type === 'notif') { tone(880, 880, 0, 0.25, 'triangle', 0.5); tone(1320, 1320, 0.18, 0.45, 'triangle', 0.5); }
    else if (type === 'typing') {
      const r = mulberry32(3);
      for (let t = 0.02; t < dur - 0.05; t += 0.07 + r() * 0.09) { const n = noise(0.03), bp = oc.createBiquadFilter(), g = oc.createGain(); bp.type = 'bandpass'; bp.frequency.value = 2500 + r() * 2000; env(g, t, 0.001, 0.6, 0.025); n.connect(bp); bp.connect(g); g.connect(out); n.start(t); }
    } else if (type === 'heart') { tone(70, 45, 0.05, 0.18, 'sine', 1); tone(70, 45, 0.33, 0.2, 'sine', 0.8); }
    else if (type === 'riser') {
      const o = oc.createOscillator(), lp = oc.createBiquadFilter(), g = oc.createGain(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, 0); o.frequency.exponentialRampToValueAtTime(1400, dur);
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, 0); lp.frequency.exponentialRampToValueAtTime(6000, dur);
      g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.35, dur * 0.95); g.gain.linearRampToValueAtTime(0, dur);
      o.connect(lp); lp.connect(g); g.connect(out); o.start(0); o.stop(dur);
    }
    const buf = await oc.startRendering();
    return wavBlob(buf);
  }
  function wavBlob(buf) {
    const d = buf.getChannelData(0), n = d.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
    const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, clamp(d[i], -1, 1) * 32767, true);
    return new Blob([ab], { type: 'audio/wav' });
  }

  // =========================================================
  //  KETUKAN MUSIK (beat sync)
  // =========================================================
  function beatBase() {
    const B = state.beat;
    if (!B || !(+B.period > 0)) return null;
    let base = +B.off + (+B.nudge || 0) / 1000;
    if (B.src === 'music') base -= +state.music.start || 0;
    else { const a = audioById(B.src); if (!a) return null; base += (+a.start || 0) - (+a.in || 0); }
    return base;
  }
  // waktu-waktu ketukan di timeline (grid tempo tetap)
  function beatTimes(upTo, every = 1) {
    const base = beatBase();
    if (base == null) return [];
    const P = +state.beat.period;
    const first = ((base % P) + P) % P;
    const k0 = Math.round((first - base) / P); // indeks ketukan pertama (relatif sumber) agar kelompok "tiap N" tetap konsisten
    const out = [];
    for (let k = 0, t = first; t <= upTo + 1e-6 && k < 20000; k++, t = first + k * P) {
      if (every <= 1 || (((k + k0) % every) + every) % every === 0) out.push(Math.round(t * 1000) / 1000);
    }
    return out;
  }
  // tempel ke ketukan terdekat (dalam 8 px) saat menggeser di timeline
  function snapBeat(t, pxPerSec) {
    if (!state.beat.snap || !state.beat.show || !(+state.beat.period > 0)) return t;
    const tol = 8 / Math.max(1, pxPerSec);
    let best = t, bd = tol;
    for (const b of beatTimes(t + tol + 0.01)) { const dd = Math.abs(b - t); if (dd < bd) { bd = dd; best = b; } }
    return best;
  }
  // Deteksi tempo & ketukan: amplop onset (frekuensi rendah + penuh) -> tempo (comb) -> fase
  async function detectBeats(src) {
    let url;
    if (src === 'music') url = music.src;
    else { const a = audioById(src); const e = a && mediaEls.get(a.fileId); url = e && e.url; }
    if (!url) throw new Error('sumber audio tidak ditemukan');
    const raw = await (await fetch(url)).arrayBuffer();
    const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(raw);
    const sr = 11025, len = Math.ceil(Math.min(buf.duration, 180) * sr);
    const band = async (lowpass) => {
      const oc = new OfflineAudioContext(1, len, sr);
      const s = oc.createBufferSource(); s.buffer = buf;
      let node = s;
      if (lowpass) { const f = oc.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 170; s.connect(f); node = f; }
      node.connect(oc.destination); s.start();
      return (await oc.startRendering()).getChannelData(0);
    };
    const hop = 128, fps = sr / hop;
    const onset = (x) => {
      const n = Math.floor(x.length / hop) - 1, env = new Float32Array(n), o = new Float32Array(n);
      for (let i = 0; i < n; i++) { let e = 0; for (let j = 0; j < 256 && i * hop + j < x.length; j++) { const v = x[i * hop + j]; e += v * v; } env[i] = Math.log(1e-8 + e); }
      for (let i = 1; i < n; i++) o[i] = Math.max(0, env[i] - env[i - 1]);
      // buang rata-rata lokal (~0,4 dtk) agar hanya lonjakan yang tersisa
      const W = Math.round(fps * 0.2), out = new Float32Array(n);
      let acc = 0;
      for (let i = 0; i < n; i++) {
        acc += o[i]; if (i - 2 * W - 1 >= 0) acc -= o[i - 2 * W - 1];
        const c = i - W; if (c >= 0) out[c] = Math.max(0, o[c] - acc / (2 * W + 1));
      }
      let mx = 1e-9; for (let i = 0; i < n; i++) mx = Math.max(mx, out[i]);
      for (let i = 0; i < n; i++) out[i] /= mx;
      return out;
    };
    const lo = onset(await band(true)), full = onset(await band(false));
    const n = Math.min(lo.length, full.length), O = new Float32Array(n);
    for (let i = 0; i < n; i++) O[i] = lo[i] + 0.6 * full[i];
    const at = (x) => { const i = Math.floor(x), f = x - i; return i + 1 < n ? O[i] * (1 - f) + O[i + 1] * f : 0; };
    const corr = (P) => { let s = 0; for (let i = 0; i + P < n - 1; i++) s += O[i] * at(i + P); return s / Math.max(1, n - P); };
    let bestP = 0, best = -1;
    for (let bpm = 70; bpm <= 180; bpm += 0.25) {
      const P = (fps * 60) / bpm;
      const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 115) / 0.7, 2)); // condong ke tempo umum
      const sc = (corr(P) + 0.5 * corr(2 * P) + 0.25 * corr(4 * P)) * w;
      if (sc > best) { best = sc; bestP = P; }
    }
    if (!bestP) throw new Error('tempo tidak terdeteksi');
    // fase: geser grid sampai paling banyak jatuh di lonjakan
    const sm = new Float32Array(n);
    for (let i = 0; i < n; i++) sm[i] = Math.max(O[i], O[i - 1] || 0, O[i + 1] || 0);
    let bestF = 0, bf = -1;
    for (let f = 0; f < bestP; f += 0.25) {
      let s = 0;
      for (let x = f; x < n - 1; x += bestP) s += sm[Math.round(x)];
      if (s > bf) { bf = s; bestF = f; }
    }
    // haluskan: cari puncak onset di sekitar tiap ketukan, lalu regresi garis (indeks ketukan -> frame)
    for (let pass = 0; pass < 2; pass++) {
      const pts = [];
      for (let k = 0, x = bestF; x < n - 2; k++, x = bestF + k * bestP) {
        const w = Math.max(2, Math.round(bestP * 0.12));
        let bi = -1, bv = 0.25;
        for (let i = Math.max(1, Math.round(x) - w); i <= Math.min(n - 2, Math.round(x) + w); i++) if (O[i] > bv) { bv = O[i]; bi = i; }
        if (bi < 0) continue;
        // posisi puncak sub-frame (parabola)
        const y0 = O[bi - 1], y1 = O[bi], y2 = O[bi + 1], den = y0 - 2 * y1 + y2;
        pts.push([k, bi + (den ? clamp((0.5 * (y0 - y2)) / den, -0.5, 0.5) : 0)]);
      }
      if (pts.length < 4) break;
      let sk = 0, si = 0, skk = 0, ski = 0;
      for (const [k, i] of pts) { sk += k; si += i; skk += k * k; ski += k * i; }
      const m = pts.length, den = m * skk - sk * sk;
      if (!den) break;
      const P2 = (m * ski - sk * si) / den, F2 = (si - P2 * sk) / m;
      if (!(P2 > bestP * 0.9 && P2 < bestP * 1.1)) break;
      bestP = P2; bestF = ((F2 % P2) + P2) % P2;
    }
    // frame energi i memuat sampel [i*hop, i*hop+256): lonjakan terbesar saat ketukan berada di tengah jendela
    return { period: bestP / fps, off: (bestF * hop + 128) / sr, bpm: (60 * fps) / bestP };
  }
  function beatSources() {
    const out = [];
    if (music.src) out.push(['music', `🎵 Musik latar${$('#audioName') ? ' • ' + $('#audioName').textContent : ''}`]);
    for (const a of state.audios || []) out.push([a.id, `🎚 ${a.name || 'track audio'}`]);
    return out;
  }
  function renderBeatUI() {
    const sel = $('#beatSrc');
    if (!sel) return;
    const opts = beatSources();
    const cur = state.beat.src || sel.value;
    sel.innerHTML = opts.length ? opts.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join('') : '<option value="">(tambah musik dulu)</option>';
    if (opts.some(([v]) => v === cur)) sel.value = cur;
    const B = state.beat, ok = +B.period > 0 && beatBase() != null;
    $('#beatInfo').textContent = ok ? `${(60 / B.period).toFixed(1)} BPM • 1 ketukan = ${B.period.toFixed(3)} dtk` : 'Belum dideteksi';
    $('#beatEvery').value = String(B.every || 2);
    $('#beatShow').checked = B.show !== false;
    $('#beatSnap').checked = B.snap !== false;
    $('#beatNudge').value = +B.nudge || 0;
    ['#btnBeatClips', '#btnBeatTexts'].forEach((id) => { $(id).disabled = !ok; });
  }
  // klip latar berganti tepat di ketukan (tiap N ketukan)
  function fitClipsToBeats() {
    if (!timedSlides()) {
      if (!state.media.length) { toast('Tambahkan foto/video latar dulu.', 'error'); return; }
      state.bg.mediaMode = 'timed'; state.bg.modeChosen = true;
    }
    const every = +state.beat.every || 2;
    const B = beatTimes(3600, every);
    let t = 0, n = 0;
    for (const c of clipList()) {
      const it = mediaItem(c.mediaId), sd = srcDuration(it);
      const maxD = it.kind === 'video' && !c.freeze && sd ? (sd - (+c.in || 0)) / (+c.speed || 1) : Infinity;
      const nb = B.find((b) => b > t + 0.25);
      if (nb == null) break;
      let d = nb - t;
      if (d > maxD) { // video terlalu pendek: pakai kelipatan ketukan terbesar yang muat
        const fit = B.filter((b) => b > t + 0.25 && b - t <= maxD).pop();
        d = fit != null ? fit - t : maxD;
      }
      c.dur = Math.round(d * 1000) / 1000;
      t += c.dur; n++;
    }
    renderScenes(); syncControls(); refresh();
    toast(`${n} klip berganti tepat di ketukan (tiap ${every} ketukan) 🥁`, 'success');
  }
  function fitTextsToBeats() {
    const all = beatTimes(totalDuration() + 30);
    if (!all.length) return;
    const near = (x) => all.reduce((m, b) => (Math.abs(b - x) < Math.abs(m - x) ? b : m), all[0]);
    let n = 0;
    for (const tx of state.texts) {
      const [a, b] = textRange(tx);
      const na = near(a);
      let nb = near(b);
      if (nb <= na + 0.25) nb = all.find((x) => x > na + 0.25) || na + state.beat.period;
      tx.start = Math.round(na * 1000) / 1000; tx.end = Math.round(nb * 1000) / 1000;
      (tx.keys || []).forEach(() => {}); // keyframe relatif terhadap awal lapisan, ikut bergeser
      n++;
    }
    renderScenes(); refresh();
    toast(`${n} lapisan teks/stiker ditempel ke ketukan`, 'success');
  }
  function bindBeats() {
    renderBeatUI();
    $('#beatSrc').addEventListener('pointerdown', () => { const v = $('#beatSrc').value; renderBeatUI(); if (v) $('#beatSrc').value = v; });
    $('#btnBeatDetect').addEventListener('click', async () => {
      const src = $('#beatSrc').value;
      if (!src) { toast('Pilih musik latar atau tambah track audio dulu (tab Musik).', 'error'); return; }
      const btn = $('#btnBeatDetect');
      btn.disabled = true; $('#beatInfo').textContent = 'Menganalisis tempo…';
      try {
        const r = await detectBeats(src);
        Object.assign(state.beat, { src, period: Math.round(r.period * 100000) / 100000, off: Math.round(r.off * 1000) / 1000, show: true, nudge: 0 });
        refresh(); renderBeatUI();
        toast(`Tempo ${r.bpm.toFixed(1)} BPM • penanda ketukan tampil di timeline`, 'success');
      } catch (e) {
        toast(`Gagal mendeteksi ketukan: ${e.message || e}`, 'error');
        renderBeatUI();
      } finally { btn.disabled = false; }
    });
    $('#beatEvery').addEventListener('change', (e) => { state.beat.every = +e.target.value; refresh(); });
    $('#beatShow').addEventListener('change', (e) => { state.beat.show = e.target.checked; refresh(); });
    $('#beatSnap').addEventListener('change', (e) => { state.beat.snap = e.target.checked; save(); });
    $('#beatNudge').addEventListener('change', (e) => { state.beat.nudge = Math.round(+e.target.value || 0); refresh(); renderBeatUI(); });
    $('#btnBeatClips').addEventListener('click', fitClipsToBeats);
    $('#btnBeatTexts').addEventListener('click', fitTextsToBeats);
  }

  function bindAudioTracks() {
    $('#audFx').innerHTML = AUDIO_FX.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
    $('#voiceFx').innerHTML = $('#audFx').innerHTML;
    $('#audPitch').innerHTML = $('#voicePitch').innerHTML = PITCHES.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
    $('#sfxList').innerHTML = SFX.map(([v, n]) => `<button class="small" data-sfx="${v}">${n}</button>`).join('');
    $('#fileAudioTrack').addEventListener('change', (e) => {
      let t = player.t;
      for (const f of [...e.target.files].filter((x) => x.type.startsWith('audio/') || x.type.startsWith('video/'))) addAudioFile(f, f.name.replace(/\.[^.]+$/, ''), t);
      e.target.value = '';
    });
    $('#sfxList').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-sfx]');
      if (!b) return;
      const blob = await synthSfx(b.dataset.sfx);
      addAudioFile(blob, b.textContent.replace(/^\S+\s/, ''), player.t);
      toast(`Efek suara "${b.textContent}" ditambahkan di ${player.t.toFixed(1)} dtk`, 'success');
    });
    $('#audioList').addEventListener('click', (e) => {
      const it = e.target.closest('[data-aid]');
      if (!it) return;
      const a = audioById(it.dataset.aid);
      if (e.target.closest('[data-del]')) { state.audios = state.audios.filter((x) => x !== a); if (ui.selAudio === a.id) ui.selAudio = ''; renderAudioList(); updateAudioBar(); refresh(); return; }
      selectAudio(a.id);
      seekTo(audioRange(a)[0]);
    });
    const cur = () => audioById(ui.selAudio);
    const after = () => { renderAudioList(); refresh(); updateAudioBar(); if (player.playing) syncAudioTracks(player.t, true); };
    $('#audStart').addEventListener('change', (e) => { const a = cur(); if (a) { a.start = r1Fine(Math.max(0, +e.target.value || 0)); after(); } });
    $('#audLen').addEventListener('change', (e) => { const a = cur(); if (!a) return; const sd = audioSrcDur(a); let v = Math.max(0.1, +e.target.value || 0.1); if (sd) v = Math.min(v, sd - (+a.in || 0)); a.dur = r1Fine(v); after(); });
    $('#audVol').addEventListener('input', (e) => { const a = cur(); if (a) { a.vol = +e.target.value; $('#audVolOut').textContent = `${Math.round(a.vol * 100)}%`; save(); } });
    $('#audFadeIn').addEventListener('change', (e) => { const a = cur(); if (a) { a.fadeIn = clamp(+e.target.value || 0, 0, 10); after(); } });
    $('#audFadeOut').addEventListener('change', (e) => { const a = cur(); if (a) { a.fadeOut = clamp(+e.target.value || 0, 0, 10); after(); } });
    $('#audFx').addEventListener('change', (e) => { const a = cur(); if (a) { a.fx = e.target.value; after(); } });
    $('#audPitch').addEventListener('change', (e) => { const a = cur(); if (a) { a.pitch = +e.target.value; after(); } });
    $('#btnAudSplit').addEventListener('click', splitAudio);
    $('#btnAudDup').addEventListener('click', () => { const a = cur(); if (!a) return; const [s0, s1] = audioRange(a); const b = { ...a, id: newId(), start: r1Fine(s1), dur: r1Fine(s1 - s0) }; state.audios.push(b); selectAudio(b.id); after(); });
    $('#btnAudDel').addEventListener('click', () => { const a = cur(); if (!a) return; state.audios = state.audios.filter((x) => x !== a); ui.selAudio = ''; after(); });
    $('#btnAudClose').addEventListener('click', () => { ui.selAudio = ''; updateAudioBar(); renderAudioList(); if (!tl.drag) renderTimeline(); });
    renderAudioList();
  }

  // Pilih teks: tandai di panel/preview/timeline, dan (bila perlu) lompat ke waktunya
  function selectText(id, seek = true) {
    const tx = textById(id);
    if (!tx) return;
    ui.selText = id;
    ui.focus = 'text';
    // buka bagian transform & keyframe pada kartu lapisan yang dipilih
    const card = $(`#sceneList .scene[data-id="${id}"] details.xf`);
    if (card && !card.open) card.open = true;
    const [a, b] = textRange(tx);
    // lompat bila teks belum tampil penuh (masih animasi masuk) atau di luar waktunya
    if (seek && !player.playing && (player.t < a + 0.3 || player.t >= b)) seekTo(a + Math.min(0.7, (b - a) / 2));
    if (!tl.drag) renderTimeline();
    updateTimeUI();
    if (!player.playing) render(player.t);
  }
  // Tambah banyak teks berurutan setelah teks terakhir: [{text, author, duration}]
  function appendTexts(list, replace = false) {
    let t = replace ? 0 : state.texts.filter((x) => !isSticker(x)).reduce((m, x) => Math.max(m, textRange(x)[1]), 0);
    const items = list.map((q) => { const it = newText(q.text, q.author || '', t, t + q.duration); t += q.duration; return it; });
    state.texts = replace ? state.texts.filter(isSticker).concat(items) : state.texts.concat(items);
    state.duration = replace ? Math.max(1, r1(t)) : Math.max(totalDuration(), r1(t));
    if (items.length) ui.selText = items[items.length - 1].id;
  }
  // Rentang waktu tiap bagian: scene (susunan scene) atau teks (susunan bebas)
  function partRanges() {
    if (freeMode()) return state.texts.filter((x) => !isSticker(x)).map((tx, i) => ({ a: textRange(tx)[0], b: Math.min(textRange(tx)[1], totalDuration()), n: i + 1 })).filter((r) => r.b - r.a > 0.1).sort((x, y) => x.a - y.a);
    return state.scenes.map((sc, i) => ({ a: sceneStart(i), b: sceneStart(i) + Math.max(0.5, +sc.duration || 0), n: i + 1 }));
  }
  function scenesToTexts() {
    return state.scenes.map((sc, i) => ({
      id: newId(), text: sc.text || '', author: sc.author || '', emoji: sc.emoji || '',
      start: r1(textStart(i)), end: r1(textEnd(i)), x: 0.5, y: +state.style.posY || 0.5,
    }));
  }
  function textsToScenes() {
    const list = state.texts.filter((x) => !isSticker(x)).sort((a, b) => textRange(a)[0] - textRange(b)[0]);
    const total = totalDuration();
    return list.map((tx, i) => {
      const [a, b] = textRange(tx);
      const s0 = i === 0 ? 0 : a;
      const next = i + 1 < list.length ? textRange(list[i + 1])[0] : Math.max(total, b);
      const delay = i === 0 ? a : 0;
      const dur = clamp(r1(Math.max(next - s0, delay + 0.5)), 0.5, 60);
      const hold = b < next - 0.05 ? r1(Math.max(0.3, b - a)) : 0;
      return { text: tx.text, author: tx.author, emoji: tx.emoji, bg: '', duration: dur, delay: r1(delay), hold };
    });
  }
  function setLayout(v, quiet) {
    if (v === state.layout) return;
    const bk = state.freeBackup;
    if (v === 'free') {
      if (bk && bk.scenes === JSON.stringify(state.scenes)) {
        // scene tidak diubah sejak pindah susunan → susunan bebas dikembalikan utuh (posisi & tumpukan)
        state.texts = bk.texts;
        state.duration = bk.duration;
      } else {
        const dur = scenesDuration();
        state.texts = scenesToTexts();
        state.duration = r1(dur);
      }
      delete state.freeBackup;
      state.layout = 'free';
      if (state.bg.mediaMode === 'slideshow') state.bg.mediaMode = 'timed';
      if (!quiet) toast('Susunan teks bebas: atur waktu & tarik posisi tiap teks sesukamu', 'success');
    } else {
      if (state.texts.length) state.scenes = textsToScenes();
      if (!state.scenes.length) state.scenes = [{ text: '', author: '', duration: 5, emoji: '', bg: '' }];
      state.freeBackup = { texts: state.texts, duration: state.duration, scenes: JSON.stringify(state.scenes) };
      state.layout = 'scenes';
      toast('Susunan scene berurutan', 'success');
    }
    player.t = Math.min(player.t, totalDuration());
    renderScenes(); syncControls(); refresh();
  }
  function updateLayoutUI() {
    const free = freeMode();
    $('#layout').value = state.layout;
    $('#videoDurRow').classList.toggle('hidden', !free);
    const fromBg = free && state.durFromBg && bgDuration() > 0;
    $('#durFromBg').checked = !!state.durFromBg;
    $('#videoDur').disabled = fromBg;
    $('#videoDur').title = fromBg ? 'Durasi mengikuti total durasi foto/video latar. Hilangkan centang "Ikut latar" untuk mengatur sendiri.' : '';
    $('#durHint').textContent = !free ? '' : fromBg
      ? `= total durasi ${timedSlides() ? `${state.media.length} media latar` : 'media latar'}`
      : state.durFromBg ? 'Latar bukan foto/video: durasi diatur sendiri' : '';
    if (document.activeElement !== $('#videoDur')) $('#videoDur').value = +totalDuration().toFixed(2);
    $('#textHeading').textContent = 'Lapisan teks';
    $('#btnAddScene').textContent = free ? '+ Tambah Teks' : '+ Tambah Scene';
    $('#btnAutoDur').title = free ? 'Atur lama tampil tiap teks sesuai panjang teks' : 'Atur durasi tiap scene sesuai panjang teks';
    $('#btnBulk').textContent = free ? 'Buat teks' : 'Buat scene';
    $('#btnExportScenes').textContent = free ? '🎞 Export tiap teks jadi video terpisah' : '🎞 Export tiap scene jadi video terpisah';
  }

  // Detik saat teks scene i mulai muncul (awal scene + jeda)
  function textStart(i) {
    const sc = state.scenes[i];
    return sceneStart(i) + Math.max(0, +(sc && sc.delay) || 0);
  }

  // Geser batas antara scene i-1 dan scene i ke detik B, dan teks scene i masuk di detik
  // `curIn`. Waktu hilang teks scene i (jika diatur) dan akhir scene i tetap sebisa mungkin.
  function moveBoundary(i, B, curIn) {
    const prev = state.scenes[i - 1], cur = state.scenes[i];
    const pS = sceneStart(i - 1);
    const curOut = textEnd(i), curHold = +cur.hold > 0;
    const curEnd = sceneStart(i) + Math.max(0.5, +cur.duration || 0);
    B = r1(Math.max(B, pS + Math.max(0, +prev.delay || 0) + 0.5)); // scene sebelumnya minimal 0,5 dtk
    curIn = r1(Math.max(curIn, B));
    prev.duration = clamp(r1(B - pS), 0.5, 60);
    if (+prev.hold > 0 && textStart(i - 1) + +prev.hold >= pS + prev.duration - 0.05) prev.hold = 0;
    cur.delay = r1(curIn - B);
    cur.duration = clamp(r1(Math.max(curEnd - B, cur.delay + 0.5)), 0.5, 60);
    if (curHold) {
      const h = r1(curOut - curIn);
      cur.hold = h >= cur.duration - cur.delay - 0.05 ? 0 : Math.max(0.3, h);
    }
  }

  // Atur detik masuk teks scene i — bebas, tidak harus menempel pada akhir scene sebelumnya.
  // Scene pertama: teks ditunda (jeda) di dalam scene.
  // Scene berikutnya: kalau masuk SETELAH teks sebelumnya hilang, ada jeda kosong di antaranya
  // (teks sebelumnya tidak ikut berubah). Kalau masuk SEBELUM teks sebelumnya hilang, teks
  // sebelumnya hilang tepat saat teks ini masuk (teks tidak bertumpuk).
  function setTextStart(i, value) {
    const sc = state.scenes[i];
    if (!sc) return;
    value = Math.max(0, r1(value));
    if (i === 0) {
      const out = textEnd(0), hold = +sc.hold > 0;
      sc.delay = Math.min(value, 59);
      sc.duration = clamp(Math.max(+sc.duration || 0.5, sc.delay + 1), 0.5, 60);
      if (hold) sc.hold = Math.max(0.3, r1(out - sc.delay));
      return;
    }
    const prevOut = textEnd(i - 1);
    moveBoundary(i, Math.min(value, prevOut), value);
  }

  // Detik saat teks scene i hilang (default: akhir scene)
  function textEnd(i) {
    const sc = state.scenes[i];
    const end = sceneStart(i) + Math.max(0.5, +sc.duration || 0);
    const hold = +sc.hold || 0;
    return hold > 0 ? Math.min(end, textStart(i) + hold) : end;
  }

  // Atur detik hilang teks scene i. Kosong = sampai akhir scene.
  // Lebih awal dari akhir scene: teks hilang, latar tetap tampil.
  // Lebih lambat: scene diperpanjang memakan jeda sebelum teks berikutnya; teks berikutnya
  // tetap masuk di detiknya, kecuali kalau dilewati (teks tidak bertumpuk → ikut mundur).
  function setTextEnd(i, raw) {
    const sc = state.scenes[i];
    if (!sc) return;
    if (String(raw).trim() === '') { sc.hold = 0; return; }
    const value = r1(Math.max(0, +raw || 0));
    const t0 = textStart(i);
    const end = sceneStart(i) + Math.max(0.5, +sc.duration || 0);
    if (value < end - 0.05) { sc.hold = Math.max(0.3, r1(value - t0)); return; }
    sc.hold = 0;
    if (i === state.scenes.length - 1) { sc.duration = clamp(r1(value - sceneStart(i)), 0.5, 60); return; }
    moveBoundary(i + 1, value, Math.max(textStart(i + 1), value));
  }

  function updateStartFields() {
    $$('#sceneList input[data-f="start"]').forEach((el, i) => {
      if (document.activeElement !== el) el.value = textStart(i).toFixed(1);
    });
    $$('#sceneList input[data-f="end"]').forEach((el, i) => {
      if (document.activeElement !== el) el.value = textEnd(i).toFixed(1);
    });
    $$('#sceneList input[data-f="dur"]').forEach((el, i) => {
      if (document.activeElement !== el) el.value = state.scenes[i].duration;
    });
  }

  function goToScene(i) {
    if (player.playing) return;
    if (freeMode()) return;
    const sc = state.scenes[i];
    const d = Math.max(0.5, +sc.duration || 0);
    const dl = Math.min(Math.max(0, +sc.delay || 0), d);
    // tampilkan saat teks sudah muncul penuh
    seekTo(sceneStart(i) + dl + (d - dl) * 0.6);
  }

  function autoDuration(text) {
    const words = text.replace(/\*/g, '').split(/\s+/).filter(Boolean).length;
    return clamp(Math.round((2.5 + words * 0.35) * 2) / 2, 3, 15);
  }

  // =========================================================
  //  UI: TEMPLATE
  // =========================================================
  function applyTemplate(tpl) {
    const keepBg = clipList().length ? { type: state.bg.type, mediaId: state.bg.mediaId, mediaMode: state.bg.mediaMode } : {};
    state.bg = { ...state.bg, animate: true, ...tpl.bg, ...keepBg };
    state.style = { ...defaultStyle(), ...tpl.style };
    state.anim = { ...defaultAnim(), inDur: +state.anim.inDur || 0, outDur: +state.anim.outDur || 0, ...tpl.anim };
    state.effects = {
      ...defaultEffects(),
      visualizer: state.effects.visualizer, fadeBlack: state.effects.fadeBlack,
      ...tpl.effects,
    };
    document.fonts.load(`${state.style.weight} 40px "${state.style.font}"`).finally(refresh);
    syncControls();
    refresh();
  }

  function buildTemplates() {
    const wrap = $('#templateList');
    TEMPLATES.forEach((tpl) => {
      const card = document.createElement('button');
      card.className = 'tpl';
      const st = { ...defaultStyle(), ...tpl.style };
      const bg = tpl.bg.type === 'color'
        ? tpl.bg.color
        : `linear-gradient(135deg, ${GRADIENTS[tpl.bg.preset][0]}, ${GRADIENTS[tpl.bg.preset][1]})`;
      card.style.background = bg;
      card.innerHTML = `
        <span class="tpl-sample" style="font-family:'${st.font}';font-weight:${st.weight};color:${st.color};${st.italic ? 'font-style:italic;' : ''}${st.glow ? `text-shadow:0 0 10px ${st.color};` : ''}${st.stroke ? `-webkit-text-stroke:1px ${st.strokeColor};` : ''}">
          ${st.uppercase ? 'KATA' : 'Kata'} <span style="color:${st.highlightColor}">${st.uppercase ? 'INDAH' : 'indah'}</span>
        </span>
        <span class="tpl-name">${tpl.name}</span>`;
      card.addEventListener('click', () => applyTemplate(tpl));
      wrap.appendChild(card);
    });

    $('#btnRandom').addEventListener('click', () => {
      const tpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
      const bg = Math.random() < 0.7 ? { type: 'gradient', preset: Math.floor(Math.random() * GRADIENTS.length) } : {};
      const anims = ['fade', 'slideUp', 'zoom', 'typewriter', 'word', 'blur', 'slideDown', 'zoomBig', 'drop', 'riseBlur', 'stretchIn'];
      applyTemplate({ ...tpl, bg: { ...tpl.bg, ...bg }, anim: { type: anims[Math.floor(Math.random() * anims.length)] } });
    });
  }

  // =========================================================
  //  UI: BINDING KONTROL
  // =========================================================
  // [id, objek pemilik (fungsi), key, tipe]
  const BINDINGS = [
    ['font', () => state.style, 'font'], ['weight', () => state.style, 'weight'],
    ['color', () => state.style, 'color'], ['authorColor', () => state.style, 'authorColor'],
    ['highlightColor', () => state.style, 'highlightColor'],
    ['size', () => state.style, 'size', 'num'], ['lineHeight', () => state.style, 'lineHeight', 'num'],
    ['letterSpacing', () => state.style, 'letterSpacing', 'num'],
    ['posY', () => state.style, 'posY', 'num'],
    ['shadow', () => state.style, 'shadow', 'bool'], ['uppercase', () => state.style, 'uppercase', 'bool'],
    ['italic', () => state.style, 'italic', 'bool'], ['boxBg', () => state.style, 'boxBg', 'bool'],
    ['boxColor', () => state.style, 'boxColor'], ['boxOpacity', () => state.style, 'boxOpacity', 'num'],
    ['stroke', () => state.style, 'stroke', 'bool'], ['strokeColor', () => state.style, 'strokeColor'],
    ['strokeWidth', () => state.style, 'strokeWidth', 'num'], ['glow', () => state.style, 'glow', 'bool'],
    ['float', () => state.style, 'float', 'bool'],
    ['animType', () => state.anim, 'type'], ['transition', () => state.anim, 'transition'],
    ['speed', () => state.anim, 'speed', 'num'],
    ['bgColor', () => state.bg, 'color'], ['gradAnimate', () => state.bg, 'animate', 'bool'],
    ['overlay', () => state.bg, 'overlay', 'num'],
    // pengaturan milik media yang sedang dipilih di pustaka
    ['bgMotion', () => selItem() || {}, 'motion'], ['imgFit', () => selItem() || {}, 'fit'],
    ['imgZoom', () => selItem() || {}, 'zoom', 'num'], ['imgX', () => selItem() || {}, 'x', 'num'],
    ['imgY', () => selItem() || {}, 'y', 'num'], ['imgRotate', () => selItem() || {}, 'rotate', 'num'],
    ['imgFlip', () => selItem() || {}, 'flip', 'bool'], ['mediaMode', () => state.bg, 'mediaMode'],
    ['bgFilter', () => state.bg, 'filter'], ['bgFilterAmt', () => state.bg, 'filterAmt', 'num'],
    ['shareCaption', () => state.share, 'caption'],
    ['bgXTrans', () => state.bg, 'xTrans'], ['bgXDur', () => state.bg, 'xDur', 'num'],
    ['animInDur', () => state.anim, 'inDur', 'num'], ['animOutDur', () => state.anim, 'outDur', 'num'],
    ['bgFx', () => state.bg, 'fx'], ['bgFxAmt', () => state.bg, 'fxAmt', 'num'], ['slideDur', () => state.bg, 'slideDur', 'num'],
    ['imgMute', () => selItem() || {}, 'muted', 'bool'],
    ['vsoundOn', () => state.vsound, 'on', 'bool'], ['vsoundVol', () => state.vsound, 'volume', 'num'],
    ['bgBright', () => state.bg, 'bright', 'num'], ['bgContrast', () => state.bg, 'contrast', 'num'],
    ['bgSat', () => state.bg, 'sat', 'num'],
    ['bgBlur', () => state.bg, 'blur', 'num'],
    ['particles', () => state.effects, 'particles'], ['amount', () => state.effects, 'amount', 'num'],
    ['vignette', () => state.effects, 'vignette', 'num'], ['grain', () => state.effects, 'grain', 'bool'],
    ['progressBar', () => state.effects, 'progressBar', 'bool'],
    ['quoteMark', () => state.effects, 'quoteMark', 'bool'], ['frame', () => state.effects, 'frame'],
    ['fadeBlack', () => state.effects, 'fadeBlack', 'bool'], ['visualizer', () => state.effects, 'visualizer'],
    ['logoPos', () => state.logo, 'pos'], ['logoSize', () => state.logo, 'size', 'num'],
    ['logoOpacity', () => state.logo, 'opacity', 'num'],
    ['res', () => state.export, 'res'], ['exportMode', () => state.export, 'mode'],
    ['projectName', () => state, 'name'],
    ['hlStyle', () => state.style, 'hlStyle'], ['textGradient', () => state.style, 'textGradient', 'bool'],
    ['color2', () => state.style, 'color2'],
    ['headerText', () => state.header, 'text'], ['headerStyle', () => state.header, 'style'],
    ['headerSize', () => state.header, 'size', 'num'], ['headerY', () => state.header, 'y', 'num'],
    ['headerColor', () => state.header, 'color'],
    ['voiceVolume', () => state.voice, 'volume', 'num'], ['voiceDelay', () => state.voice, 'delay', 'num'],
    ['voiceDuck', () => state.voice, 'duck', 'bool'],
    ['voicePitch', () => state.voice, 'pitch', 'num'], ['voiceFx', () => state.voice, 'fx'],
    ['vizX', () => state.viz, 'x', 'num'], ['vizY', () => state.viz, 'y', 'num'],
    ['vizWidth', () => state.viz, 'width', 'num'], ['vizHeight', () => state.viz, 'height', 'num'],
    ['vizBars', () => state.viz, 'bars', 'num'], ['vizThickness', () => state.viz, 'thickness', 'num'],
    ['vizColor', () => state.viz, 'color'], ['vizCustomColor', () => state.viz, 'customColor'],
    ['vizOpacity', () => state.viz, 'opacity', 'num'], ['vizGlow', () => state.viz, 'glow', 'bool'],
    ['capShow', () => state.captions, 'show', 'bool'], ['capY', () => state.captions, 'y', 'num'],
    ['capSize', () => state.captions, 'size', 'num'], ['capColor', () => state.captions, 'color'],
    ['capHl', () => state.captions, 'hl'], ['capStyle', () => state.captions, 'style'],
    ['capKaraoke', () => state.captions, 'karaoke', 'bool'], ['capUpper', () => state.captions, 'upper', 'bool'],
    ['capMaxWords', () => state.captions, 'maxWords', 'num'], ['capSource', () => state.captions, 'source'],
    ['capLang', () => state.captions, 'lang'], ['capModel', () => state.captions, 'model'],
    ['capEngine', () => state.captions, 'engine'], ['capGroqModel', () => state.captions, 'groqModel'],
    ['capRef', () => state.captions, 'ref'], ['capOffset', () => state.captions, 'offset', 'num'],
    ['capFont', () => state.captions, 'font'], ['capWeight', () => state.captions, 'weight', 'num'],
    ['capItalic', () => state.captions, 'italic', 'bool'], ['capSpacing', () => state.captions, 'spacing', 'num'],
    ['capWidth', () => state.captions, 'width', 'num'], ['capRot', () => state.captions, 'rot', 'num'],
    ['capGlow', () => state.captions, 'glow', 'bool'], ['capBoxColor', () => state.captions, 'boxColor'],
    ['capBoxOpacity', () => state.captions, 'boxOpacity', 'num'], ['capStrokeColor', () => state.captions, 'strokeColor'],
    ['capStrokeW', () => state.captions, 'strokeW', 'num'], ['capAnim', () => state.captions, 'anim'],
    ['capAnimOut', () => state.captions, 'animOut'], ['capHlMode', () => state.captions, 'hlMode'],
    ['volume', () => state.music, 'volume', 'num'], ['audioStart', () => state.music, 'start', 'num'],
    ['audioFade', () => state.music, 'fade', 'bool'],
    ['fps', () => state.export, 'fps'], ['quality', () => state.export, 'quality'],
    ['watermark', () => state, 'watermark'],
  ];
  const SEGMENTS = [
    ['bgType', () => state.bg, 'type'],
    ['ratio', () => state, 'ratio'],
    ['align', () => state.style, 'align'],
  ];

  function updateOutputs() {
    $$('output[data-for]').forEach((o) => {
      const el = document.getElementById(o.dataset.for);
      if (el) o.textContent = el.value;
    });
  }

  function syncControls() {
    BINDINGS.forEach(([id, owner, key, type]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const v = owner()[key];
      if (type === 'bool') el.checked = !!v; else el.value = v;
    });
    SEGMENTS.forEach(([id, owner, key]) => {
      $$(`#${id} button`).forEach((b) => b.classList.toggle('active', b.dataset.v === owner()[key]));
    });
    const sel = selItem();
    $('#mediaAdjust').classList.toggle('hidden', !sel);
    $('#imgMotionRow').classList.toggle('hidden', !sel || sel.kind !== 'image');
    $('#slideDurRow').classList.toggle('hidden', !timedSlides() && state.bg.mediaMode !== 'timed');
    $('#imgMuteRow').classList.toggle('hidden', !sel || sel.kind !== 'video');
    if (sel && document.activeElement !== $('#mediaDur')) {
      $('#mediaDur').value = +sel.dur > 0 ? sel.dur : '';
      $('#mediaDur').placeholder = `${mediaDur({ ...sel, dur: 0 }).toFixed(1)} (bawaan${sel.kind === 'video' ? ': panjang video' : ''})`;
    }
    if (sel) $('#selMediaName').textContent = sel.name;
    renderMediaLib();
    const animatedBg = state.bg.type === 'aurora' || state.bg.type === 'waves';
    $$('.bg-opt').forEach((d) => d.classList.toggle('active', d.dataset.for === state.bg.type || (animatedBg && d.dataset.for === 'gradient')));
    $$('.swatch').forEach((s, i) => s.classList.toggle('active', i === state.bg.preset));
    const groq = state.captions.engine === 'groq';
    $('#groqBox').classList.toggle('hidden', !groq);
    $('#capModelWrap').classList.toggle('hidden', groq);
    updateOutputs();
  }

  function bindControls() {
    BINDINGS.forEach(([id, owner, key, type]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const ev = el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'color' ? 'change' : 'input';
      const handler = () => {
        owner()[key] = type === 'bool' ? el.checked : type === 'num' ? +el.value : el.value;
        if (id === 'volume' && audio.gain && !fadeStarted) setGain(+el.value, 0);
        if (id === 'exportMode') showFormatInfo();
        if (id === 'voiceVolume' && audio.vgain) audio.vgain.gain.value = voiceVol();
        if (id === 'voiceDelay' || id === 'voiceDuck') { lastLevel = -1; syncVoice(player.t, true); }
        if (id === 'voicePitch' || id === 'voiceFx') setVoiceFx();
        if (id === 'imgMute' || id === 'vsoundOn' || id === 'vsoundVol') { syncVideos(player.t); renderMediaLib(); }
        if (id === 'font' || id === 'weight') document.fonts.load(`${state.style.weight} 40px "${state.style.font}"`).finally(refresh);
        updateOutputs();
        refresh();
      };
      el.addEventListener(ev, handler);
      if (el.type === 'color') el.addEventListener('input', handler);
    });
    SEGMENTS.forEach(([id, owner, key]) => {
      $(`#${id}`).addEventListener('click', (e) => {
        const v = e.target.dataset.v;
        if (!v) return;
        owner()[key] = v;
        if (id === 'bgType') syncVideos(player.t, true);
        syncControls();
        refresh();
      });
    });
  }

  function buildSwatches() {
    const wrap = $('#gradPresets');
    GRADIENTS.forEach(([a, b], i) => {
      const s = document.createElement('div');
      s.className = 'swatch';
      s.style.background = `linear-gradient(135deg, ${a}, ${b})`;
      s.addEventListener('click', () => {
        state.bg.preset = i;
        if (state.bg.type !== 'aurora' && state.bg.type !== 'waves') state.bg.type = 'gradient';
        syncControls();
        refresh();
      });
      wrap.appendChild(s);
    });
  }

  // =========================================================
  //  UI: FILE / TOMBOL
  // =========================================================
  function bindFiles() {
    const loadAudioFile = (f) => {
      if (music.src) URL.revokeObjectURL(music.src);
      music.src = URL.createObjectURL(f);
      $('#audioName').textContent = f.name;
      renderBeatUI();
    };
    const onPick = (fn) => (e) => { const f = e.target.files[0]; if (f) fn(f); e.target.value = ''; };

    // banyak foto & video sekaligus
    bindClipBar();
    bindSceneStyleTools();
    bindShare();
    bindStickers();
    bindAudioTracks();
    bindBeats();
    syncControls();
    $('#layout').addEventListener('change', (e) => setLayout(e.target.value));
    $('#durFromBg').addEventListener('change', (e) => {
      if (!e.target.checked) state.duration = r1(totalDuration()); // mulai dari durasi sekarang
      state.durFromBg = e.target.checked;
      player.t = Math.min(player.t, totalDuration());
      renderScenes(); refresh();
    });
    $('#mediaDur').addEventListener('change', (e) => {
      const it = selItem();
      if (!it) return;
      const v = +e.target.value;
      it.dur = v > 0 ? clamp(r1(v), 0.5, 600) : 0; // kosong = bawaan
      mediaLibKey = '';
      syncControls(); renderScenes(); refresh();
    });
    $('#videoDur').addEventListener('change', (e) => {
      state.duration = clamp(r1(+e.target.value || 10), 1, 600);
      player.t = Math.min(player.t, state.duration);
      renderScenes(); refresh();
    });
    ['#fileMedia', '#fileMediaTop'].forEach((sel) => $(sel).addEventListener('change', (e) => { addMediaFiles(e.target.files); e.target.value = ''; }));
    // pilihan mode dari pengguna dihormati (tidak diubah otomatis saat menambah media)
    $('#mediaMode').addEventListener('change', () => {
      state.bg.modeChosen = true;
      $('#slideDurRow').classList.toggle('hidden', !timedSlides() && state.bg.mediaMode !== 'timed');
      if (timedSlides()) {
        toast('Tiap media tampil sesuai durasinya (atur di "Atur media" atau tarik di baris latar timeline)', 'info', 5000);
      }
    });
    $('#fileAudio').addEventListener('change', onPick(loadAudioFile));

    // Logo
    $('#fileLogo').addEventListener('change', onPick((f) => {
      const img = new Image();
      img.onload = () => { media.logo = img; refresh(); };
      img.src = URL.createObjectURL(f);
      $('#logoName').textContent = f.name;
    }));
    $('#btnRemoveLogo').addEventListener('click', () => {
      media.logo = null;
      $('#logoName').textContent = '';
      refresh();
    });

    // Font sendiri (.ttf / .otf / .woff)
    $('#fileFont').addEventListener('change', onPick(async (f) => {
      const name = f.name.replace(/\.[^.]+$/, '').replace(/[^\w\- ]/g, '').trim() || 'FontKu';
      try {
        const face = new FontFace(name, await f.arrayBuffer());
        await face.load();
        document.fonts.add(face);
        const sel = $('#font');
        if (![...sel.options].some((o) => o.value === name)) sel.add(new Option(`${name} (upload)`, name));
        state.style.font = name;
        syncControls();
        refresh();
      } catch (_) {
        toast('Font tidak bisa dibaca. Gunakan file .ttf, .otf, .woff, atau .woff2.', 'error');
      }
    }));

    // Drag & drop file ke area preview
    const stage = $('.stage');
    stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('dragging'); });
    stage.addEventListener('dragleave', (e) => { if (!stage.contains(e.relatedTarget)) stage.classList.remove('dragging'); });
    stage.addEventListener('drop', (e) => {
      e.preventDefault();
      stage.classList.remove('dragging');
      const files = [...e.dataTransfer.files];
      const audioFile = files.find((f) => f.type.startsWith('audio/'));
      addMediaFiles(files.filter((f) => f !== audioFile && mediaKindOf(f)), true);
      if (audioFile) loadAudioFile(audioFile);
    });
    $('#btnRemoveAudio').addEventListener('click', () => {
      music.pause();
      if (music.src) URL.revokeObjectURL(music.src);
      music.removeAttribute('src');
      music.load();
      $('#audioName').textContent = 'Belum ada musik';
      if (state.beat.src === 'music') { state.beat.period = 0; refresh(); }
      renderBeatUI();
    });

    // Voice-over: upload file / hapus
    $('#fileVoice').addEventListener('change', onPick((f) => setVoice(f, f.name)));
    $('#btnRemoveVoice').addEventListener('click', () => {
      voice.pause();
      if (voice.src) URL.revokeObjectURL(voice.src);
      voice.removeAttribute('src');
      voice.load();
      voiceBlob = null; voiceClean = null;
      $('#btnVoiceOrig').classList.add('hidden');
      $('#voiceName').textContent = 'Belum ada voice-over';
      lastLevel = -1;
    });
    // Perjelas suara
    const denoiseOut = () => { $('#voiceDenoiseOut').textContent = `${$('#voiceDenoise').value}%`; };
    $('#voiceDenoise').addEventListener('input', denoiseOut); denoiseOut();
    $('#btnVoiceClean').addEventListener('click', cleanVoice);
    bindTts();
    $('#btnVoiceOrig').addEventListener('click', () => {
      if (!voiceClean) return;
      const { orig, name } = voiceClean;
      setVoice(orig, name);
      toast('Kembali ke suara asli', 'success');
    });

    // Impor kata-kata dari file .txt ke kotak "tempel banyak"
    $('#fileTxt').addEventListener('change', onPick(async (f) => {
      $('#bulkText').value = (await f.text()).replace(/\r\n/g, '\n').trim();
      $('.bulk').open = true;
      toast(`Teks dimuat. Periksa lalu klik "${freeMode() ? 'Buat teks' : 'Buat scene'}".`, 'success');
    }));

    $('#fileProject').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        snapshot();
        state = fromJSON(JSON.parse(await f.text()));
        state.id = newId(); // simpan sebagai project baru di galeri
        resetHistory();
        afterStateReplaced();
        toast(`Project "${state.name}" dibuka`, 'success');
      } catch (_) {
        toast('File project tidak valid.', 'error');
      }
      e.target.value = '';
    });
  }

  function afterStateReplaced(keepTime = false) {
    pause();
    if (!keepTime) player.t = Math.min(totalDuration() * 0.2, 1.5); // langsung tampilkan teks
    // jangan berhenti di ujung video (teks sudah fade out → preview kosong)
    player.t = Math.min(player.t, Math.max(0, totalDuration() - 1));
    if (!mediaItem(ui.selMedia)) ui.selMedia = state.media[0] ? state.media[0].id : '';
    loadMediaEls();
    renderScenes();
    renderCaptionList();
    syncControls();
    refresh();
  }

  // =========================================================
  //  PUSTAKA FOTO & VIDEO
  // =========================================================
  const selItem = () => mediaItem(ui.selMedia);

  function selectMedia(id) {
    ui.selMedia = id;
    syncControls();
  }

  // Muat file media dari IndexedDB untuk semua item di project
  function loadMediaEls() {
    for (const a of state.audios || []) {
      if (!a.fileId || mediaEls.has(a.fileId)) continue;
      const entry = { el: null, ready: false, missing: false, url: '' };
      mediaEls.set(a.fileId, entry);
      idbGet(a.fileId).then((blob) => { if (blob) attachBlob({ id: a.fileId, kind: 'audio' }, entry, blob); else entry.missing = true; }).catch(() => { entry.missing = true; });
    }
    for (const l of state.texts || []) {
      if (!l.fileId || mediaEls.has(l.fileId)) continue;
      const entry = { el: null, ready: false, missing: false, url: '' };
      mediaEls.set(l.fileId, entry);
      idbGet(l.fileId).then((blob) => { if (blob) attachBlob({ id: l.fileId, kind: l.media === 'video' ? 'video' : 'image' }, entry, blob); else entry.missing = true; }).catch(() => { entry.missing = true; });
    }
    for (const item of state.media) {
      if (mediaEls.has(item.id)) continue;
      const entry = { el: null, ready: false, missing: false, url: '' };
      mediaEls.set(item.id, entry);
      idbGet(item.id)
        .then((blob) => { if (blob) attachBlob(item, entry, blob); else { entry.missing = true; renderMediaLib(); } })
        .catch(() => { entry.missing = true; renderMediaLib(); });
    }
  }

  function attachBlob(item, entry, blob) {
    entry.url = URL.createObjectURL(blob);
    const done = () => {
      entry.ready = true;
      if (!player.playing) { syncVideos(player.t, true); render(player.t); }
      mediaLibKey = '';
      renderMediaLib();
      if (!player.exporting) refreshDurations();
    };
    if (item.kind === 'audio') {
      const a = new Audio();
      a.preload = 'auto';
      a.onloadedmetadata = () => { entry.ready = true; if (!player.exporting) { renderAudioList(); if (!tl.drag) renderTimeline(); updateAudioBar(); } };
      a.src = entry.url;
      entry.el = a;
      routeAudioTrack(entry);
    } else if (item.kind === 'image') {
      const img = new Image();
      img.onload = done;
      img.src = entry.url;
      entry.el = img;
    } else {
      const v = document.createElement('video');
      v.muted = true; // dinyalakan saat diputar (lihat syncVideos)
      v.playsInline = true;
      v.preload = 'auto';
      v.onloadeddata = done;
      v.onseeked = () => { if (!player.playing && !player.exporting) render(player.t); };
      v.src = entry.url;
      entry.el = v;
      routeVideoAudio(entry);
    }
  }

  let idbWarned = false;
  // jenis media dari tipe MIME, atau dari ekstensi bila browser tidak memberi tipe (mis. .mkv/.mov di Windows)
  function mediaKindOf(f) {
    if (/^video\//.test(f.type)) return 'video';
    if (/^image\//.test(f.type)) return /heic|heif/i.test(f.type) ? 'heic' : 'image';
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v', '3gp', 'ogv'].includes(ext)) return 'video';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'svg'].includes(ext)) return 'image';
    if (['heic', 'heif'].includes(ext)) return 'heic';
    return '';
  }

  function addMediaFiles(fileList, toTimeline = false) {
    const all = [...fileList];
    const heic = all.filter((f) => mediaKindOf(f) === 'heic');
    const files = all.filter((f) => ['image', 'video'].includes(mediaKindOf(f)));
    if (heic.length) toast(`${heic.length} foto HEIC (dari iPhone) belum bisa dibuka browser. Ubah dulu ke JPG, atau di iPhone pilih Pengaturan → Kamera → Format → "Paling Kompatibel".`, 'error', 9000);
    else if (all.length && !files.length) toast('File ini bukan foto/video yang didukung. Pakai MP4, WEBM, MOV, JPG, PNG, atau WEBP.', 'error', 7000);
    if (!files.length) return;
    const first = state.media.length;
    for (const f of files) {
      const item = {
        id: newId(), kind: mediaKindOf(f), name: f.name,
        fit: 'cover', zoom: 1, x: 0, y: 0, rotate: 0, flip: false, motion: 'zoomIn',
      };
      state.media.push(item);
      if (toTimeline) state.clips.push(newClip(item.id));
      const entry = { el: null, ready: false, missing: false, url: '' };
      mediaEls.set(item.id, entry);
      attachBlob(item, entry, f);
      idbPut(item.id, f).catch(() => {
        if (!idbWarned) { idbWarned = true; toast('Media tidak bisa disimpan permanen di browser ini (hanya sampai halaman ditutup).', 'error', 7000); }
      });
    }
    ui.selMedia = state.media[first].id;
    if (!toTimeline) {
      mediaLibKey = ''; renderMediaLib(); syncControls(); refresh();
      toast(`${files.length} media diimpor • klik ＋ atau seret ke timeline`, 'success');
      return;
    }
    if (state.bg.type !== 'media') {
      state.bg.type = 'media';
      state.bg.mediaId = state.media[first].id;
    }
    if (!mediaItem(state.bg.mediaId)) state.bg.mediaId = state.media[first].id;
    // lebih dari 1 media (diupload sekaligus maupun satu per satu) → otomatis bergantian per scene,
    // kecuali pengguna sendiri sudah memilih "satu media untuk semua scene"
    if (state.media.length > 1 && state.bg.mediaMode === 'single' && !state.bg.modeChosen) state.bg.mediaMode = freeMode() ? 'timed' : 'slideshow';
    renderScenes();
    syncControls();
    refresh();
    let msg = `${files.length} media ditambahkan`;
    if (timedSlides()) msg += ' • bergantian sesuai durasi tiap media';
    else if (state.bg.mediaMode === 'slideshow') {
      msg += ' • bergantian per scene';
      const extra = state.media.length - state.scenes.length;
      if (extra > 0) msg += `. ${extra} media belum tampil: tambah scene agar semua media kebagian`;
    }
    toast(msg, 'success', !freeMode() && state.bg.mediaMode === 'slideshow' && state.media.length > state.scenes.length ? 7000 : undefined);
  }

  function removeMedia(id) {
    state.media = state.media.filter((m) => m.id !== id);
    state.clips = state.clips.filter((c) => c.mediaId !== id);
    if (ui.selClip && !clipById(ui.selClip)) ui.selClip = '';
    state.scenes.forEach((s) => { if (s.bg === `m:${id}`) s.bg = ''; });
    if (state.bg.mediaId === id) state.bg.mediaId = state.media[0] ? state.media[0].id : '';
    if (ui.selMedia === id) ui.selMedia = state.media[0] ? state.media[0].id : '';
    if (!state.media.length && state.bg.type === 'media') state.bg.type = 'gradient';
    // file di IndexedDB dibersihkan saat aplikasi dibuka berikutnya (agar Undo tetap bisa)
    renderScenes();
    syncControls();
    refresh();
  }

  // Hapus file media yang tidak dipakai project mana pun
  async function cleanupMediaStore() {
    try {
      const used = new Set(state.media.map((m) => m.id));
      (state.texts || []).forEach((l) => l.fileId && used.add(l.fileId));
      (state.audios || []).forEach((a) => a.fileId && used.add(a.fileId));
      for (const p of Object.values(readGallery())) {
        try {
          const d = JSON.parse(p.data);
          (d.media || []).forEach((m) => used.add(m.id));
          (d.texts || []).forEach((l) => l.fileId && used.add(l.fileId));
          (d.audios || []).forEach((a) => a.fileId && used.add(a.fileId));
        } catch (_) { /* abaikan */ }
      }
      for (const k of (await idbKeys()) || []) if (!used.has(k)) await idbDel(k);
    } catch (_) { /* abaikan */ }
  }

  let mediaLibKey = '';
  function renderMediaLib() {
    const box = $('#mediaLib');
    if (!box) return;
    // hanya gambar ulang bila ada yang berubah (thumbnail video mahal dibuat ulang)
    const key = JSON.stringify([ui.selMedia, state.bg.mediaMode, state.bg.mediaId,
      state.vsound.on, timedSlides(), state.clips.map((c) => c.mediaId).join(), state.media.map((m) => (thumbCache.get(m.id) || {}).poster ? 1 : 0).join(), state.media.map((m) => { const e = mediaEls.get(m.id); return [m.id, m.name, e && e.url, e && e.missing, m.muted, mediaDur(m)]; })]);
    if (key === mediaLibKey) return;
    mediaLibKey = key;
    if (!state.media.length) {
      box.innerHTML = '<div class="lib-empty"><b>Belum ada media</b><span>Klik Impor di atas, atau seret foto/video ke sini.</span></div>';
      const lc = $('#libCount'); if (lc) lc.textContent = '';
      return;
    }
    state.media.forEach((m) => { const e = mediaEls.get(m.id); if (m.kind === 'video' && e && e.ready && !thumbCache.has(m.id)) queueThumb(m); });
    box.innerHTML = state.media.map((m, i) => {
      const e = mediaEls.get(m.id);
      const thumb = e && e.missing
        ? '<span class="ml-missing">⚠ file hilang</span>'
        : e && e.url
          ? (m.kind === 'image' ? `<img src="${e.url}" alt="" loading="lazy" />` : (thumbCache.get(m.id) || {}).poster ? `<img src="${thumbCache.get(m.id).poster}" alt="" />` : '<span class="ml-wait">🎬</span>')
          : '<span class="ml-missing">memuat…</span>';
      const isMain = state.bg.mediaMode === 'single' && (state.bg.mediaId || (state.media[0] && state.media[0].id)) === m.id;
      const used = state.clips.filter((c) => c.mediaId === m.id).length;
      return `<div class="ml-item${m.id === ui.selMedia ? ' selected' : ''}${used ? ' used' : ''}" data-id="${esc(m.id)}" title="${esc(m.name)} • klik ＋ atau seret ke timeline" draggable="true">
        <div class="ml-thumb">${thumb}</div>
        <span class="ml-kind">${m.kind === 'video' ? `🎬${videoAudible(m) ? '🔊' : '🔇'}` : '🖼'} ${i + 1}</span>
        ${isMain ? '<span class="ml-main">Utama</span>' : ''}
        ${timedSlides() || freeMode() ? `<span class="ml-dur">${mediaDur(m).toFixed(1)}s</span>` : ''}
        ${used ? `<span class="ml-used" title="Dipakai ${used}× di timeline">✓${used > 1 ? used : ''}</span>` : ''}
        <button class="ml-add" data-add title="Tambahkan ke akhir timeline">＋</button>
        <button class="ml-ov" data-ov title="Tambahkan sebagai overlay (picture-in-picture) di playhead">▣</button>
        <button class="ml-del" data-del title="Hapus dari project">✕</button>
        <span class="ml-name">${esc(m.name)}</span>
      </div>`;
    }).join('');
    const lc = $('#libCount'); if (lc) lc.textContent = `${state.media.length} media`;
  }

  // tambahkan media ke track utama (di akhir, atau sebelum klip ke-atIndex pada urutan timeline)
  function addClipsForMedia(ids, atIndex) {
    ids = ids.filter((id) => mediaItem(id));
    if (!ids.length) return;
    const list = clipList();
    const made = ids.map((id) => newClip(id));
    const ref = atIndex != null && list[atIndex] ? state.clips.indexOf(list[atIndex]) : state.clips.length;
    state.clips.splice(ref, 0, ...made);
    if (state.bg.type !== 'media') state.bg.type = 'media';
    if (state.bg.mediaMode === 'single') state.bg.mediaMode = 'timed';
    if (!mediaItem(state.bg.mediaId)) state.bg.mediaId = ids[0];
    mediaLibKey = '';
    renderScenes(); syncControls(); refresh();
    selectClip(made[0].id, true);
    toast(made.length > 1 ? `${made.length} klip ditambahkan ke timeline` : 'Klip ditambahkan ke timeline', 'success');
  }
  // media perpustakaan → lapisan overlay (file disalin agar tidak berebut pemutar dengan track utama)
  async function addMediaAsOverlay(id, at) {
    const m = mediaItem(id), e = m && mediaEls.get(id);
    if (!m || !e || !e.url) { toast('Media belum siap.', 'error'); return; }
    const blob = await (await fetch(e.url)).blob();
    const f = new File([blob], m.name, { type: blob.type || (m.kind === 'video' ? 'video/mp4' : 'image/jpeg') });
    if (at != null) seekTo(at);
    addOverlayFiles([f]);
    const l = state.texts[state.texts.length - 1];
    if (l && isOverlay(l)) { l.s = 0.6; selectText(l.id); }
    refresh();
    toast(`"${m.name}" ditambahkan sebagai overlay`, 'success');
  }
  // posisi sisip di track utama dari waktu t (sebelum klip yang tengahnya sesudah t)
  function clipIndexAt(t) {
    let a = 0; const list = clipList();
    for (let i = 0; i < list.length; i++) { const d = clipDur(list[i]); if (t < a + d / 2) return i; a += d; }
    return list.length;
  }
  function timelineTimeAtX(x) {
    const r = $('#tlTrack').getBoundingClientRect();
    return clamp((x - r.left) / (r.width || 1)) * (tl.scale || totalDuration());
  }
  // media dijatuhkan di timeline: di atas track utama = overlay, selain itu = klip di posisi itu
  function dropMediaAt(mid, x, y) {
    const t = timelineTimeAtX(x);
    const mainHead = $('#tlHeads .tl-head.main');
    const mainTop = mainHead ? mainHead.getBoundingClientRect().top - 2 : Infinity;
    if (y < mainTop && clipList().length > 0) addMediaAsOverlay(mid, t); else addClipsForMedia([mid], clipIndexAt(t));
  }
  function bindLibraryDrag() {
    const lib = $('#mediaLib'), tbox = $('#timeline');
    lib.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.ml-item'); if (!card) return;
      e.dataTransfer.setData('text/x-yog-media', card.dataset.id);
      e.dataTransfer.effectAllowed = 'copy';
    });
    const isLib = (e) => [...(e.dataTransfer.types || [])].includes('text/x-yog-media');
    const isFile = (e) => [...(e.dataTransfer.types || [])].includes('Files');
    tbox.addEventListener('dragover', (e) => { if (isLib(e) || isFile(e)) { e.preventDefault(); tbox.classList.add('drop-ok'); } });
    tbox.addEventListener('dragleave', (e) => { if (!tbox.contains(e.relatedTarget)) tbox.classList.remove('drop-ok'); });
    tbox.addEventListener('drop', (e) => {
      tbox.classList.remove('drop-ok');
      const t = timelineTimeAtX(e.clientX);
      if (isLib(e)) { e.preventDefault(); dropMediaAt(e.dataTransfer.getData('text/x-yog-media'), e.clientX, e.clientY); return; }
      if (isFile(e)) {
        e.preventDefault();
        const files = [...e.dataTransfer.files];
        const before = new Set(state.media.map((m) => m.id));
        addMediaFiles(files.filter((f) => mediaKindOf(f)));
        const ids = state.media.filter((m) => !before.has(m.id)).map((m) => m.id);
        if (ids.length) addClipsForMedia(ids, clipIndexAt(t));
      }
    });
    // seret file ke panel Media = impor
    const panel = $('#tab-bg');
    panel.addEventListener('dragover', (e) => { if (isFile(e)) { e.preventDefault(); panel.classList.add('drop-ok'); } });
    panel.addEventListener('dragleave', (e) => { if (!panel.contains(e.relatedTarget)) panel.classList.remove('drop-ok'); });
    panel.addEventListener('drop', (e) => { if (!isFile(e)) return; e.preventDefault(); panel.classList.remove('drop-ok'); addMediaFiles([...e.dataTransfer.files].filter((f) => mediaKindOf(f))); });
    $('#btnLibAddAll').addEventListener('click', () => {
      if (!state.media.length) { toast('Impor media dulu.', 'error'); return; }
      addClipsForMedia(state.media.map((m) => m.id));
    });
  }

  function bindMediaLib() {
    bindLibraryDrag();
    $('#mediaLib').addEventListener('click', (e) => {
      const card = e.target.closest('.ml-item');
      if (!card) return;
      const id = card.dataset.id;
      if (e.target.closest('[data-del]')) { removeMedia(id); return; }
      if (e.target.closest('[data-add]')) { addClipsForMedia([id]); return; }
      if (e.target.closest('[data-ov]')) { addMediaAsOverlay(id); return; }
      selectMedia(id);
      // tampilkan scene yang memakai media ini
      const hitBg = bgIntervals().find(({ spec: sp }) => sp.type === 'media' && (sp.mediaId || state.media[0].id) === id);
      if (hitBg) {
        const idx = sceneAt(hitBg.a + 1e-3).index;
        if (!freeMode() && Math.abs(hitBg.a - sceneStart(idx)) < 1e-3) goToScene(idx); else seekTo(hitBg.a + Math.min(0.7, (hitBg.b - hitBg.a) / 2));
      }
    });
    $('#btnUseMain').addEventListener('click', () => {
      const it = selItem();
      if (!it) return;
      state.bg.type = 'media';
      state.bg.mediaId = it.id;
      state.bg.mediaMode = 'single';
      state.bg.modeChosen = true;
      syncControls();
      refresh();
      toast(`"${it.name}" dipakai untuk semua scene`, 'success');
    });
  }

  // ---------- Tata letak editor: dialog Export, toolbar timeline, menu, tinggi timeline ----------
  function bindShell() {
    const panel = $('#exportPanel');
    $('#btnOpenExport').addEventListener('click', openExportDialog);
    ['#res', '#fps', '#quality'].forEach((sel) => $(sel).addEventListener('change', () => setTimeout(updateExportSummary)));
    $('#expName').addEventListener('input', (e) => { state.export.fileName = e.target.value.trim(); save(); });
    bindMarkers();
    $('#btnExport').addEventListener('click', () => panel.classList.add('hidden'));
    $('#btnExportScenes').addEventListener('click', () => panel.classList.add('hidden'));
    // toolbar timeline bekerja pada klip / track audio yang sedang dipilih
    const visible = (id) => !$(id).classList.contains('hidden');
    const pick = (clipBtn, audBtn, txtBtn) => {
      if (visible('#segBar')) { const b = $(clipBtn === '#btnClipDup' ? '#segBar [data-sg=dup]' : clipBtn === '#btnClipDel' ? '#segBar [data-sg=del]' : null); if (b) b.click(); else toast('Potong tidak berlaku untuk lapisan efek; tarik tepinya.'); return; }
      if (visible('#audioBar')) $(audBtn).click();
      else if (visible('#clipBar')) $(clipBtn).click();
      else if (txtBtn && visible('#textBar')) $(txtBtn).click();
      else toast('Pilih klip, teks, atau track audio di timeline dulu.');
    };
    $('#tlSplit').addEventListener('click', () => pick('#btnSplit', '#btnAudSplit'));
    $('#tlDup').addEventListener('click', () => pick('#btnClipDup', '#btnAudDup', '#tbDup'));
    $('#tlDel').addEventListener('click', () => { if (ui.multi.size > 1 && deleteMulti()) return; pick('#btnClipDel', '#btnAudDel', '#tbDel'); });
    // alat klip: pakai klip terpilih, atau klip di bawah playhead
    const clipTool = (fn) => () => {
      if (!clipById(ui.selClip)) { const sl = clipAtPlayhead(); if (sl) selectClip(sl.clip.id, false); }
      if (!clipById(ui.selClip)) { toast('Pilih klip video/foto di timeline dulu.'); return; }
      fn();
    };
    $('#tlFreeze').addEventListener('click', clipTool(() => $('#btnClipFreeze').click()));
    $('#tlReverse').addEventListener('click', clipTool(() => $('#btnClipRev').click()));
    $('#tlMirror').addEventListener('click', clipTool(() => $('#btnClipFlipH').click()));
    $('#tlRotate').addEventListener('click', clipTool(() => $('#btnClipRot').click()));
    $('#tlCrop').addEventListener('click', clipTool(() => { setPropTab('dasar'); const c = $('#cropL'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
    $('#tlDelLeft').addEventListener('click', () => trimAtPlayhead('left'));
    $('#tlGroup').addEventListener('click', groupSelection);
    $('#tlUngroup').addEventListener('click', ungroupSelection);
    $('#tlDelRight').addEventListener('click', () => trimAtPlayhead('right'));
    // menu project tertutup setelah memilih item / klik di luar
    const menu = $('details.menu');
    menu.addEventListener('click', (e) => { if (e.target.closest('.menu-item') && !e.target.closest('label')) menu.open = false; });
    $('#fileProject').addEventListener('change', () => { menu.open = false; });
    document.addEventListener('click', (e) => { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    // tinggi timeline bisa ditarik (disimpan per pengguna)
    const root = document.documentElement, rz = $('#tlResizer');
    try { const v = +localStorage.getItem('evkk:tlh'); if (v) root.style.setProperty('--tl-h', `${v}px`); } catch (_) { /* abaikan */ }
    rz.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      rz.setPointerCapture(e.pointerId); rz.classList.add('active');
      const y0 = e.clientY, h0 = $('.tl-area').getBoundingClientRect().height;
      const move = (ev) => root.style.setProperty('--tl-h', `${Math.round(clamp(h0 - (ev.clientY - y0), 150, window.innerHeight * 0.65))}px`);
      const up = () => {
        rz.classList.remove('active'); rz.removeEventListener('pointermove', move); rz.removeEventListener('pointerup', up);
        try { localStorage.setItem('evkk:tlh', String(parseInt(getComputedStyle(root).getPropertyValue('--tl-h'), 10))); } catch (_) { /* abaikan */ }
        if (!player.playing) refresh();
      };
      rz.addEventListener('pointermove', move); rz.addEventListener('pointerup', up);
    });
  }

  function bindButtons() {
    $$('.tab').forEach((t) => t.addEventListener('click', () => {
      $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
      $$('.tab-body').forEach((b) => b.classList.toggle('active', b.id === `tab-${t.dataset.tab}`));
    }));

    bindShell();
    btnPlay.addEventListener('click', () => (player.playing ? pause() : play()));
    const toggleFullscreen = () => {
      const wrap = $('.canvas-wrap');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (wrap.requestFullscreen) wrap.requestFullscreen();
    };
    const toggleGuides = () => {
      ui.guides = !ui.guides;
      try { localStorage.setItem('evkk:guides', ui.guides ? '1' : '0'); } catch (_) { /* abaikan */ }
      $('#btnGuides').classList.toggle('active', ui.guides);
      if (!player.playing) render(player.t);
    };
    const toggleHelp = (show) => $('#helpModal').classList.toggle('hidden', show === undefined ? undefined : !show);
    const step = (sec) => { pause(); seekTo(player.t + sec); };

    document.addEventListener('keydown', (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.key === 'Escape') {
        toggleHelp(false);
        clearMulti();
        $$('.modal[data-dismiss]').forEach((m) => m.classList.add('hidden'));
        if (typing) document.activeElement.blur();
        return;
      }
      if (player.exporting) return;
      // pintasan yang tetap aktif walau sedang mengetik
      if (mod && k === 's') { e.preventDefault(); saveProjectFile(); return; }
      if (mod && k === 'e') { e.preventDefault(); exportVideo(); return; }
      if (typing) return;
      if (mod) {
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
        if (k === 'b') { e.preventDefault(); if (!(ui.selAudio && splitAudio())) splitClip(); }
        if (k === 'c' && e.altKey) { e.preventDefault(); copyAttrs(); }
        else if (k === 'c') { e.preventDefault(); copySelection(false); }
        if (k === 'x') { e.preventDefault(); copySelection(true); }
        if (k === 'g' && e.shiftKey) { e.preventDefault(); ungroupSelection(); }
        else if (k === 'g') { e.preventDefault(); groupSelection(); }
        if (k === 'v' && e.altKey) { e.preventDefault(); pasteAttrs(); }
        else if (k === 'v') { e.preventDefault(); pasteClipboard(); }
        return;
      }
      const fps = +state.export.fps || 30;
      switch (e.key) {
        case ' ': e.preventDefault(); player.playing ? pause() : play(); break;
        case 'ArrowLeft': e.preventDefault(); step(e.shiftKey ? -1 : -1 / fps); break;
        case 'ArrowRight': e.preventDefault(); step(e.shiftKey ? 1 : 1 / fps); break;
        case 'Home': e.preventDefault(); pause(); seekTo(0); break;
        case 'End': e.preventDefault(); pause(); seekTo(totalDuration()); break;
        case 'f': case 'F': toggleFullscreen(); break;
        case 'g': case 'G': toggleGuides(); break;
        case 's': case 'S': if (!(ui.selAudio && splitAudio())) splitClip(); break;
        case 'm': toggleMarker(); break;
        case 'M': jumpMarker(1); break;
        case 'q': case 'Q': trimAtPlayhead('left'); break;
        case 'w': case 'W': trimAtPlayhead('right'); break;
        case 'Delete': case 'Backspace': e.preventDefault(); $('#tlDel').click(); break;
        case '?': toggleHelp(true); break;
        default: break;
      }
    });

    $('#btnUndo').addEventListener('click', undo);
    $('#btnRedo').addEventListener('click', redo);
    $('#btnFullscreen').addEventListener('click', toggleFullscreen);
    $('#btnGuides').addEventListener('click', toggleGuides);
    $('#btnGuides').classList.toggle('active', ui.guides);
    $('#btnHelp').addEventListener('click', () => toggleHelp(true));
    $('#helpModal').addEventListener('click', (e) => {
      if (e.target.id === 'helpModal' || e.target.closest('[data-close]')) toggleHelp(false);
    });

    $('#btnAddScene').addEventListener('click', () => {
      if (freeMode()) {
        const total = totalDuration();
        let a = player.t >= total - 0.5 ? 0 : player.t;
        const tx = newText('Teks default', '', a, Math.min(total, a + 4));
        if (tx.end - tx.start < 1) { tx.start = r1(Math.max(0, total - 4)); tx.end = r1(total); }
        state.texts.push(tx);
        ui.selText = tx.id;
        renderScenes(); refresh();
        selectText(tx.id);
        const ta = $(`#sceneList .scene[data-id="${tx.id}"] textarea`);
        if (ta) ta.focus();
        return;
      }
      state.scenes.push({ text: '', author: '', duration: 5 });
      renderScenes(); refresh();
      const tas = $$('#sceneList textarea');
      tas[tas.length - 1].focus();
    });

    $('#btnSample').addEventListener('click', () => {
      const [text, author] = SAMPLE_QUOTES[Math.floor(Math.random() * SAMPLE_QUOTES.length)];
      if (freeMode()) { appendTexts([{ text, author, duration: autoDuration(text) }]); renderScenes(); refresh(); selectText(ui.selText); return; }
      state.scenes.push({ text, author, duration: autoDuration(text) });
      renderScenes(); refresh();
      goToScene(state.scenes.length - 1);
    });

    $('#btnAutoDur').addEventListener('click', () => {
      if (freeMode()) {
        state.texts.forEach((tx) => { tx.end = r1(textRange(tx)[0] + autoDuration(tx.text || '')); });
        state.duration = Math.max(totalDuration(), ...state.texts.map((tx) => tx.end));
        renderScenes(); refresh();
        return;
      }
      state.scenes.forEach((s) => { s.duration = autoDuration(s.text || ''); });
      renderScenes(); refresh();
    });

    $('#btnBulk').addEventListener('click', () => {
      const raw = $('#bulkText').value.trim();
      if (!raw) return;
      const useAuto = $('#bulkAuto').checked;
      const dur = clamp(+$('#bulkDur').value || 5, 0.5, 60);
      const blocks = raw.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
      const scenes = blocks.map((b) => {
        const lines = b.split('\n');
        let author = '';
        if (lines.length > 1 && /^\s*[-—–]/.test(lines[lines.length - 1])) {
          author = lines.pop().replace(/^\s*[-—–]\s*/, '');
        }
        const text = lines.join('\n');
        return { text, author, duration: useAuto ? autoDuration(text) : dur };
      });
      if (freeMode()) {
        const replace = confirm(`Buat ${scenes.length} teks berurutan.\nOK = ganti semua teks lama, Batal = tambahkan di akhir.`);
        appendTexts(scenes, replace);
      } else {
        const replace = confirm(`Buat ${scenes.length} scene.\nOK = ganti semua scene lama, Batal = tambahkan di akhir.`);
        state.scenes = replace ? scenes : state.scenes.concat(scenes);
      }
      $('#bulkText').value = '';
      renderScenes(); refresh();
    });

    $('#btnNew').addEventListener('click', newProject);
    $('#btnProjects').addEventListener('click', openGallery);
    $('#btnBank').addEventListener('click', openBank);
    $('#btnRecord').addEventListener('click', toggleRecord);
    $('#btnTheme').addEventListener('click', toggleTheme);
    // tutup modal saat klik latar atau tombol ✕
    $$('.modal[data-dismiss]').forEach((m) => m.addEventListener('click', (e) => {
      if (e.target === m || e.target.closest('[data-close]')) m.classList.add('hidden');
    }));

    $('#btnSaveProject').addEventListener('click', saveProjectFile);

    $('#btnExport').addEventListener('click', exportVideo);
    $('#btnExportScenes').addEventListener('click', exportPerScene);
    $('#btnExportPng').addEventListener('click', exportScenesPng);

    $('#btnSnapshot').addEventListener('click', () => {
      ui.capturing = true;
      render(player.t);
      canvas.toBlob((b) => { if (b) { downloadBlob(b, `${slug(state.name)}-frame-${stamp()}.png`); toast('Frame disimpan sebagai PNG', 'success'); } }, 'image/png');
      ui.capturing = false;
      render(player.t);
    });
  }

  function saveProjectFile() {
    snapshot();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${slug(state.name)}.json`);
    toast('Project disimpan ke file .json', 'success');
  }

  // =========================================================
  //  PROJECT SAYA (galeri)
  // =========================================================
  function switchToState(next, msg) {
    snapshot(); // simpan project yang sedang dibuka
    state = next;
    resetHistory();
    afterStateReplaced();
    snapshot();
    if (msg) toast(msg, 'success');
  }

  function newProject() {
    const s = defaultState();
    s.name = `Project ${Object.keys(readGallery()).length + 1}`;
    switchToState(s, 'Project baru dibuat. Project sebelumnya tersimpan di "Project Saya".');
    $('#galleryModal').classList.add('hidden');
  }

  function openGallery() {
    snapshot();
    renderGallery();
    $('#galleryModal').classList.remove('hidden');
  }

  function renderGallery() {
    const all = Object.values(readGallery()).sort((a, b) => b.updated - a.updated);
    $('#galleryCount').textContent = `${all.length} project`;
    $('#galleryList').innerHTML = all.map((p) => `
      <div class="g-card${p.id === state.id ? ' current' : ''}" data-id="${esc(p.id)}">
        <div class="g-thumb">${p.thumb ? `<img src="${p.thumb}" alt="" />` : ''}</div>
        <div class="g-info">
          <b title="${esc(p.name)}">${esc(p.name || 'Tanpa nama')}</b>
          <span class="muted">${new Date(p.updated).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          ${p.id === state.id ? '<span class="badge">Sedang dibuka</span>' : ''}
        </div>
        <div class="g-actions">
          ${p.id === state.id ? '' : '<button data-act="open" class="primary small">Buka</button>'}
          <button data-act="dup" class="ghost small" title="Duplikat">⧉</button>
          ${p.id === state.id ? '' : '<button data-act="del" class="ghost small del" title="Hapus">✕</button>'}
        </div>
      </div>`).join('') || '<p class="muted">Belum ada project.</p>';
  }

  function bindGallery() {
    $('#galleryList').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.closest('.g-card').dataset.id;
      const all = readGallery();
      const p = all[id];
      if (!p) return;
      if (btn.dataset.act === 'open') {
        switchToState(fromJSON(JSON.parse(p.data)), `Project "${p.name}" dibuka`);
        $('#galleryModal').classList.add('hidden');
      } else if (btn.dataset.act === 'dup') {
        const copy = JSON.parse(p.data);
        copy.id = newId();
        copy.name = `${p.name} (salinan)`;
        all[copy.id] = { ...p, id: copy.id, name: copy.name, updated: Date.now(), data: JSON.stringify(copy) };
        writeGallery(all);
        renderGallery();
        toast('Project diduplikat', 'success');
      } else if (btn.dataset.act === 'del') {
        if (!confirm(`Hapus project "${p.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
        delete all[id];
        writeGallery(all);
        renderGallery();
        toast('Project dihapus');
      }
    });
    $('#btnGalleryNew').addEventListener('click', newProject);
  }

  // =========================================================
  //  BANK KATA-KATA
  // =========================================================
  let bankCat = 'Semua';
  function openBank() {
    renderBank();
    $('#bankModal').classList.remove('hidden');
    setTimeout(() => $('#bankSearch').focus(), 50);
  }
  function renderBank() {
    const cats = ['Semua', ...Object.keys(QUOTE_BANK)];
    $('#bankCats').innerHTML = cats.map((c) => `<button class="chip${c === bankCat ? ' active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    const q = $('#bankSearch').value.trim().toLowerCase();
    const items = [];
    for (const [cat, list] of Object.entries(QUOTE_BANK)) {
      if (bankCat !== 'Semua' && cat !== bankCat) continue;
      list.forEach((text) => { if (!q || text.toLowerCase().includes(q)) items.push([cat, text]); });
    }
    $('#bankList').innerHTML = items.map(([cat, text]) => `
      <div class="bank-item" data-text="${esc(text)}">
        <span class="bank-text">${esc(text).replace(/\*([^*]+)\*/g, '<mark>$1</mark>')}</span>
        <span class="chip small">${esc(cat)}</span>
        <button class="small" data-add title="Tambahkan sebagai scene">+ Tambah</button>
      </div>`).join('') || '<p class="muted">Tidak ada yang cocok.</p>';
  }
  function addQuoteScenes(texts) {
    if (freeMode()) {
      const defTexts = JSON.stringify(defaultState().texts.map((x) => x.text));
      const wasDef = JSON.stringify(state.texts.map((x) => x.text)) === defTexts;
      appendTexts(texts.map((text) => ({ text, author: '', duration: autoDuration(text) })), wasDef);
      renderScenes(); refresh();
      return;
    }
    const wasDefault = state.scenes.length === 2 && JSON.stringify(state.scenes.map((s) => s.text)) === JSON.stringify(defaultState().scenes.map((s) => s.text));
    const scenes = texts.map((text) => ({ text, author: '', duration: autoDuration(text), emoji: '', bg: '' }));
    state.scenes = wasDefault ? scenes : state.scenes.concat(scenes);
    renderScenes();
    refresh();
  }
  function bindBank() {
    $('#bankSearch').addEventListener('input', renderBank);
    $('#bankCats').addEventListener('click', (e) => {
      const c = e.target.closest('[data-cat]');
      if (!c) return;
      bankCat = c.dataset.cat;
      renderBank();
    });
    $('#bankList').addEventListener('click', (e) => {
      if (!e.target.closest('[data-add]')) return;
      const item = e.target.closest('.bank-item');
      addQuoteScenes([item.dataset.text]);
      e.target.textContent = '✓ Ditambah';
      e.target.disabled = true;
      toast('Scene ditambahkan', 'success', 1800);
    });
    $('#bankRandom').addEventListener('click', () => {
      const pool = bankCat === 'Semua' ? Object.values(QUOTE_BANK).flat() : QUOTE_BANK[bankCat];
      const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
      addQuoteScenes(picks);
      $('#bankModal').classList.add('hidden');
      toast(`${picks.length} scene acak ditambahkan`, 'success');
    });
  }

  // =========================================================
  //  VOICE-OVER: rekam dari mikrofon
  // =========================================================
  // voiceClean: { orig, name } = suara sebelum diperjelas (untuk tombol "Suara asli")
  let voiceBlob = null, voiceClean = null;
  function setVoice(blob, name, cleaned = false) {
    if (voice.src) URL.revokeObjectURL(voice.src);
    if (!cleaned) voiceClean = null;
    voiceBlob = blob;
    $('#btnVoiceOrig').classList.toggle('hidden', !voiceClean);
    voice.src = URL.createObjectURL(blob);
    voice.onloadedmetadata = () => {
      const d = isFinite(voice.duration) ? ` (${voice.duration.toFixed(1)} dtk)` : '';
      $('#voiceName').textContent = `${name}${d}`;
    };
    $('#voiceName').textContent = name;
    lastLevel = -1;
  }

  // ---------- Perjelas suara: hapus bising (spectral gating) + ratakan volume ----------
  function fftInPlace(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < h; k++) {
          const a = i + k, b = a + h;
          const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  // strength 0..1; onProgress(0..1)
  async function cleanVoiceBuffer(buf, strength, normalize, onProgress) {
    const sr = buf.sampleRate, N = 2048, H = N / 4, B = N / 2 + 1;
    const len = buf.length, frames = Math.max(1, Math.ceil((len + N) / H));
    const win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
    const chans = [];
    for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
    // sinyal mono untuk profil bising & deteksi bagian bicara
    const mono = new Float32Array(len);
    for (const d of chans) for (let i = 0; i < len; i++) mono[i] += d[i] / chans.length;
    const re = new Float32Array(N), im = new Float32Array(N);
    const frameAt = (src, f) => {
      const off = f * H - N;
      for (let i = 0; i < N; i++) { const x = off + i; re[i] = x >= 0 && x < len ? src[x] * win[i] : 0; im[i] = 0; }
      fftInPlace(re, im);
    };
    // 1) profil bising = rata-rata spektrum dari 10% frame paling sunyi
    const energy = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      const off = f * H - N; let e = 0;
      for (let i = 0; i < N; i += 4) { const x = off + i; if (x >= 0 && x < len) e += mono[x] * mono[x]; }
      energy[f] = e;
    }
    const sorted = Array.from(energy).sort((a, b) => a - b);
    const thr = sorted[Math.min(frames - 1, Math.max(0, Math.floor(frames * 0.1)))];
    const noise = new Float32Array(B); let cnt = 0;
    for (let f = 0; f < frames && cnt < 400; f++) {
      if (energy[f] > thr) continue;
      frameAt(mono, f); cnt++;
      for (let k = 0; k < B; k++) noise[k] += Math.hypot(re[k], im[k]);
    }
    for (let k = 0; k < B; k++) noise[k] /= Math.max(1, cnt);
    // 2) gating per frekuensi, dihaluskan terhadap waktu & frekuensi agar tidak "berdesis"
    const floor = Math.pow(10, (-28 * strength) / 20), over = 1 + 3 * strength;
    const hpBin = Math.ceil((75 * N) / sr);
    const out = chans.map(() => new Float32Array(len));
    const prev = chans.map(() => new Float32Array(B).fill(1));
    const g = new Float32Array(B), gs = new Float32Array(B);
    for (let f = 0; f < frames; f++) {
      for (let c = 0; c < chans.length; c++) {
        frameAt(chans[c], f);
        for (let k = 0; k < B; k++) {
          const m = Math.hypot(re[k], im[k]), nn = noise[k] * over;
          const snr = (m * m) / (nn * nn + 1e-12);
          g[k] = k < hpBin ? 0 : Math.max(floor, snr / (1 + snr));
        }
        const p = prev[c];
        for (let k = 0; k < B; k++) {
          const v = (g[Math.max(0, k - 1)] + g[k] * 2 + g[Math.min(B - 1, k + 1)]) / 4;
          gs[k] = v >= p[k] ? v : p[k] * 0.65 + v * 0.35; // naik cepat, turun pelan
          p[k] = gs[k];
        }
        for (let k = 0; k < B; k++) {
          re[k] *= gs[k]; im[k] *= gs[k];
          if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; }
        }
        // IFFT lewat konjugasi
        for (let i = 0; i < N; i++) im[i] = -im[i];
        fftInPlace(re, im);
        const o = out[c], off = f * H - N;
        for (let i = 0; i < N; i++) {
          const x = off + i;
          if (x >= 0 && x < len) o[x] += (re[i] / N) * win[i] / 1.5; // Hann² dengan hop N/4 = 1.5
        }
      }
      if (f % 300 === 299) { onProgress && onProgress(f / frames); await new Promise((r) => setTimeout(r)); }
    }
    // 3) ratakan volume: bagian bicara ke ±-18 dBFS, puncak dilunakkan
    if (normalize) {
      let sum = 0, n = 0;
      const act = sorted[Math.floor(frames * 0.5)];
      for (let f = 0; f < frames; f++) {
        if (energy[f] < act) continue;
        const off = f * H - N;
        for (let i = 0; i < H; i++) { const x = off + i; if (x >= 0 && x < len) { for (const o of out) sum += o[x] * o[x]; n += out.length; } }
      }
      const rms = Math.sqrt(sum / Math.max(1, n));
      const gain = rms > 1e-5 ? clamp(0.125 / rms, 0.3, 10) : 1;
      for (const o of out) {
        for (let i = 0; i < len; i++) {
          const x = o[i] * gain, a = Math.abs(x);
          o[i] = a <= 0.8 ? x : Math.sign(x) * (0.8 + 0.19 * Math.tanh((a - 0.8) / 0.19));
        }
      }
    }
    onProgress && onProgress(1);
    return { sr, out };
  }
  function encodeWav(sr, chans) {
    const n = chans[0].length, nc = chans.length, view = new DataView(new ArrayBuffer(44 + n * nc * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); view.setUint32(4, 36 + n * nc * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, nc, true);
    view.setUint32(24, sr, true); view.setUint32(28, sr * nc * 2, true); view.setUint16(32, nc * 2, true);
    view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, n * nc * 2, true);
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { view.setInt16(o, Math.round(clamp(chans[c][i], -1, 1) * 32767), true); o += 2; }
    return new Blob([view], { type: 'audio/wav' });
  }
  // =========================================================
  //  TEKS KE SUARA (AI, bahasa Indonesia, berjalan di browser)
  // =========================================================
  const SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  function angkaKata(n) {
    n = Math.floor(n);
    if (n < 0) return 'minus ' + angkaKata(-n);
    if (n < 12) return n === 0 ? 'nol' : SATUAN[n];
    if (n < 20) return SATUAN[n - 10] + ' belas';
    if (n < 100) return SATUAN[Math.floor(n / 10)] + ' puluh' + (n % 10 ? ' ' + SATUAN[n % 10] : '');
    const part = (d, w, se) => { const q = Math.floor(n / d), r = n % d; return (q === 1 && se ? se : angkaKata(q) + ' ' + w) + (r ? ' ' + angkaKata(r) : ''); };
    if (n < 1000) return part(100, 'ratus', 'seratus');
    if (n < 1e6) return part(1000, 'ribu', 'seribu');
    if (n < 1e9) return part(1e6, 'juta');
    if (n < 1e12) return part(1e9, 'miliar');
    return String(n).split('').map((d) => angkaKata(+d)).join(' ');
  }
  const SINGKATAN = { yg: 'yang', dgn: 'dengan', dg: 'dengan', tdk: 'tidak', gak: 'nggak', ga: 'nggak', gk: 'nggak', krn: 'karena', utk: 'untuk', sdh: 'sudah', jg: 'juga', dlm: 'dalam', kpd: 'kepada', bgt: 'banget', aja: 'saja', tp: 'tapi', sm: 'sama', org: 'orang', klo: 'kalau', kalo: 'kalau' };
  // teks siap dibaca: tanpa tanda sorotan/emoji/tautan, angka jadi kata, singkatan umum dipanjangkan
  function ttsNormalize(t) {
    return String(t || '')
      .replace(/\*/g, '')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[#@](\w+)/g, '$1')
      .replace(/\b(\d{1,3}(?:\.\d{3})+)\b/g, (m) => m.replace(/\./g, ''))
      .replace(/(\d+),(\d+)/g, (m, a, b) => `${angkaKata(+a)} koma ${b.split('').map((d) => angkaKata(+d)).join(' ')}`)
      .replace(/(\d+)\s*%/g, (m, a) => angkaKata(+a) + ' persen')
      .replace(/\d+/g, (m) => ' ' + angkaKata(+m) + ' ')
      .replace(/\b[a-z]+\b/gi, (w) => SINGKATAN[w.toLowerCase()] || w)
      .replace(/&/g, ' dan ')
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ')
      .replace(/[—–]/g, ', ')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }
  // potong per kalimat (model lebih rapi untuk kalimat pendek); kalimat sangat panjang dipotong di koma
  function ttsSentences(t) {
    const out = [];
    for (const line of ttsNormalize(t).split(/\n+/)) {
      for (let sen of line.split(/(?<=[.!?…])\s+/)) {
        sen = sen.trim();
        if (!/[a-z]/i.test(sen)) continue;
        while (sen.length > 180) {
          let cut = sen.lastIndexOf(',', 180);
          if (cut < 40) cut = sen.lastIndexOf(' ', 180);
          if (cut < 1) cut = 180;
          out.push(sen.slice(0, cut + 1).trim());
          sen = sen.slice(cut + 1).trim();
        }
        if (sen) out.push(sen);
      }
    }
    return out;
  }
  let ttsWorker = null, ttsJob = 0, ttsBusy = false, ttsLast = null;
  // bagian teks → [{audio: Float32Array, sr}] (urutan sama)
  function runTts(parts, onStatus, noLocal = false) {
    if (!ttsWorker) ttsWorker = new Worker('js/tts-worker.js', { type: 'module' });
    const id = ++ttsJob, res = new Array(parts.length);
    return new Promise((resolve, reject) => {
      const files = new Map();
      ttsWorker.onmessage = (e) => {
        const m = e.data;
        if (m.id !== id) return;
        if (m.type === 'progress' && m.p && m.p.file && m.p.total) {
          files.set(m.p.file, [m.p.loaded || 0, m.p.total]);
          let a = 0, b = 0; for (const [x, y] of files.values()) { a += x; b += y; }
          onStatus(`Memuat suara AI… ${Math.round((a / b) * 100)}% (${(b / 1048576).toFixed(0)} MB, sekali saja)`);
        } else if (m.type === 'status') onStatus(m.msg);
        else if (m.type === 'part') res[m.i] = { audio: m.audio, sr: m.sr };
        else if (m.type === 'done') resolve(res);
        else if (m.type === 'error') reject(new Error(m.msg));
      };
      ttsWorker.onerror = (e) => { reject(new Error(e.message || 'Worker suara AI gagal dimuat')); ttsWorker = null; };
      ttsWorker.postMessage({ id, parts, noLocal });
    });
  }
  // gabungkan potongan suara dengan jeda; ujung tiap potongan dihaluskan agar tidak "klik"
  function joinTts(chunks, gap) {
    const sr = chunks[0].sr, g = Math.round(gap * sr), lead = Math.round(0.05 * sr);
    const n = chunks.reduce((a, c) => a + c.audio.length, 0) + g * Math.max(0, chunks.length - 1) + lead * 2;
    const out = new Float32Array(n);
    let o = lead, peak = 0;
    chunks.forEach((c, i) => {
      const a = c.audio, f = Math.min(Math.round(0.01 * sr), a.length >> 1);
      for (let k = 0; k < a.length; k++) {
        let v = a[k];
        if (k < f) v *= k / f; else if (k > a.length - f) v *= (a.length - k) / f;
        out[o + k] = v; peak = Math.max(peak, Math.abs(v));
      }
      o += a.length + (i < chunks.length - 1 ? g : 0);
    });
    if (peak > 0.01) { const k = 0.89 / peak; for (let i = 0; i < n; i++) out[i] *= k; } // ratakan ke ±-1 dB
    return { sr, out };
  }
  // opt: { mode, text, status } untuk dipanggil dari fitur lain; hasil true bila berhasil
  async function makeTts(opt = {}) {
    if (ttsBusy) return false;
    const mode = opt.mode || $('#ttsMode').value, gap = clamp(+$('#ttsGap').value || 0, 0, 3);
    const status = (m) => { $('#ttsStatus').textContent = m; if (opt.status) opt.status(m); };
    // daftar tugas: [{text, start}] — start dipakai untuk track audio
    let jobs;
    if (mode === 'each') {
      jobs = freeMode()
        ? state.texts.filter((l) => !isSticker(l) && plainText(l.text)).map((l) => ({ text: l.text, start: textRange(l)[0] }))
        : state.scenes.map((sc, i) => ({ text: sc.text, start: textStart(i) })).filter((j) => plainText(j.text));
      if (!jobs.length) { toast('Belum ada teks di project.', 'error'); return false; }
    } else {
      const txt = (opt.text != null ? opt.text : $('#ttsText').value).trim();
      if (!txt) { toast('Tulis kata-kata yang akan dibacakan dulu (atau klik "Ambil teks project").', 'error'); return false; }
      jobs = [{ text: txt, start: mode === 'track' ? player.t : 0 }];
    }
    const groups = jobs.map((j) => ({ ...j, parts: ttsSentences(j.text) })).filter((j) => j.parts.length);
    if (!groups.length) { toast('Tidak ada kata yang bisa dibacakan.', 'error'); return false; }
    ttsBusy = true;
    const btn = $('#btnTts'); btn.disabled = true;
    try {
      const serverOk = await localServerAlive();
      if (!serverOk && !navigator.onLine) throw new Error('SERVER_MATI');
      const chunks = await runTts(groups.flatMap((g) => g.parts), status, !serverOk);
      let k = 0;
      const results = groups.map((g) => { const r = joinTts(chunks.slice(k, k + g.parts.length), gap); k += g.parts.length; return { ...g, ...r }; });
      const label = (t) => '🗣 ' + plainText(t).replace(/\s+/g, ' ').slice(0, 28);
      if (mode === 'voice') {
        const r = results[0];
        voice.addEventListener('loadedmetadata', () => renderTimeline(), { once: true });
        setVoice(encodeWav(r.sr, [r.out]), label(r.text));
        ttsLast = voice;
        toast('Voice-over AI siap. Atur "Mulai di detik ke-" bila perlu.', 'success');
      } else {
        let last = null;
        for (const r of results) last = addAudioFile(encodeWav(r.sr, [r.out]), label(r.text), r.start);
        const le = last && mediaEls.get(last.fileId);
        ttsLast = le ? le.el : null;
        renderAudioList();
        toast(results.length > 1 ? `${results.length} track suara AI ditaruh di waktu tiap teks.` : 'Track suara AI ditambahkan di timeline.', 'success');
      }
      const secs = results.reduce((a, r) => a + r.out.length / r.sr, 0);
      status(`Selesai: ${secs.toFixed(1)} dtk suara.`);
      $('#btnTtsPlay').classList.toggle('hidden', !ttsLast);
      save();
      return true;
    } catch (err) {
      console.error(err);
      const msg = String((err && err.message) || err);
      status('');
      if (location.protocol === 'file:') toast('Teks ke suara butuh aplikasi dibuka lewat START.bat (server lokal).', 'error', 7000);
      else if (msg === 'SERVER_MATI' || (/fetch|network|Failed to/i.test(msg) && !(await localServerAlive()))) toast(SERVER_TIP, 'error', 10000);
      else toast(/fetch|network|404|Could not locate|Failed to load/i.test(msg) ? 'Model suara AI belum ada & gagal diunduh. Jalankan UNDUH-MODEL-AI.bat → Teks ke suara, atau cek internet.' : 'Gagal membuat suara: ' + msg.slice(0, 140), 'error', 8000);
      return false;
    } finally {
      ttsBusy = false; btn.disabled = false;
    }
  }
  function bindTts() {
    // aplikasi terbuka dari cache (ter-install) tapi START.bat tidak jalan → fitur AI tidak bisa memakai model lokal
    if (location.protocol !== 'file:') setTimeout(() => localServerAlive().then((ok) => {
      if (!ok) toast('⚠ Server aplikasi tidak jalan. Fitur AI (Teks otomatis & Teks ke suara) butuh START.bat: klik dua kali, biarkan jendelanya terbuka, lalu muat ulang.', 'error', 15000);
    }), 1500);
    $('#btnTts').addEventListener('click', () => makeTts());
    $('#btnTtsFill').addEventListener('click', () => {
      $('#ttsText').value = projectTexts().map((x) => plainText(x.text)).join('\n');
      if (!$('#ttsText').value) toast('Belum ada teks di project.', 'error');
    });
    $('#btnTtsClear').addEventListener('click', () => { $('#ttsText').value = ''; });
    $('#ttsMode').addEventListener('change', () => { $('#ttsText').disabled = $('#ttsMode').value === 'each'; });
    $('#btnTtsPlay').addEventListener('click', () => {
      if (!ttsLast) return;
      if (!ttsLast.paused) { ttsLast.pause(); return; }
      ttsLast.currentTime = 0; ttsLast.play().catch(() => {});
    });
  }

  let cleaning = false;
  async function cleanVoice() {
    if (!voiceBlob) { toast('Belum ada voice-over. Rekam atau upload suara dulu.', 'error'); return; }
    if (cleaning) return;
    cleaning = true;
    const btn = $('#btnVoiceClean'), label = btn.textContent;
    btn.disabled = true;
    try {
      const src = voiceClean ? voiceClean.orig : voiceBlob; // selalu proses dari suara asli
      const name = voiceClean ? voiceClean.name : $('#voiceName').textContent.replace(/ \([\d.]+ dtk\)$/, '');
      const ac = new OfflineAudioContext(1, 1, 48000);
      const buf = await ac.decodeAudioData(await src.arrayBuffer());
      const strength = clamp((+$('#voiceDenoise').value || 0) / 100);
      const { sr, out } = await cleanVoiceBuffer(buf, strength, $('#voiceNorm').checked, (p) => { btn.textContent = `Memproses ${Math.round(p * 100)}%`; });
      voiceClean = { orig: src, name };
      setVoice(encodeWav(sr, out), `${name} ✨`, true);
      toast('Suara diperjelas. Klik ▶ untuk mendengar, atau "Suara asli" untuk kembali.', 'success');
    } catch (err) {
      console.error(err);
      toast('Gagal memproses suara: format audio tidak bisa dibaca browser.', 'error', 6000);
    } finally {
      cleaning = false; btn.disabled = false; btn.textContent = label;
    }
  }

  async function toggleRecord() {
    const btn = $('#btnRecord');
    if (recState.mr) { recState.mr.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Browser ini tidak mendukung perekaman suara.', 'error'); return; }
    try {
      recState.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (_) {
      toast('Mikrofon tidak bisa diakses. Izinkan akses mikrofon di browser.', 'error', 6000);
      return;
    }
    // hapus voice lama agar tidak ikut terdengar saat merekam
    if (voice.src) { URL.revokeObjectURL(voice.src); voice.removeAttribute('src'); voice.load(); }
    const chunks = [];
    const mr = new MediaRecorder(recState.stream);
    recState.mr = mr;
    mr.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      recState.stream.getTracks().forEach((tr) => tr.stop());
      recState.mr = null;
      player.onEnd = null;
      pause();
      btn.textContent = '🎙 Rekam suara';
      btn.classList.remove('recording');
      if (!chunks.length) return;
      setVoice(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), 'Rekaman suara');
      toast('Rekaman suara tersimpan sebagai voice-over', 'success');
    };
    state.voice.delay = 0;
    syncControls();
    btn.textContent = '⏹ Stop rekam';
    btn.classList.add('recording');
    mr.start();
    pause();
    play(true); // putar dari awal (musik dibisukan) agar bisa membaca kata-katanya
    player.onEnd = () => { if (mr.state !== 'inactive') mr.stop(); };
    toast('Merekam… Berhenti otomatis di akhir video.', 'info', 5000);
  }

  // =========================================================
  //  TEKS OTOMATIS (subtitle)
  // =========================================================
  // Pecah segmen panjang menjadi potongan berisi maks. N kata (waktu dibagi sesuai panjang huruf)
  function splitSegments(segs, maxWords) {
    const out = [];
    const n = Math.max(1, Math.round(+maxWords || 6));
    for (const s of segs) {
      const words = s.text.trim().split(/\s+/).filter(Boolean);
      if (!words.length) continue;
      // potong per kalimat dulu, lalu bagi rata tiap kalimat (mis. 8 kata, maks 6 → 4 + 4)
      const sentences = [];
      let cur = [];
      words.forEach((w, i) => {
        cur.push(w);
        if (/[.!?…]$/.test(w) || i === words.length - 1) { sentences.push(cur); cur = []; }
      });
      const chunks = [];
      for (const sw of sentences) {
        const size = Math.ceil(sw.length / Math.ceil(sw.length / n));
        for (let j = 0; j < sw.length; j += size) chunks.push(sw.slice(j, j + size));
      }
      const totalChars = words.join(' ').length || 1;
      const dur = Math.max(0.2, s.end - s.start);
      let t = s.start;
      chunks.forEach((ch) => {
        const d = (dur * (ch.join(' ').length + 1)) / (totalChars + chunks.length);
        out.push({ start: +t.toFixed(2), end: +(t + d).toFixed(2), text: ch.join(' ') });
        t += d;
      });
      out[out.length - 1].end = +s.end.toFixed(2);
    }
    return out;
  }

  // Dari naskah (tanpa AI): bagi teks & atur waktunya otomatis
  function captionsFromScript() {
    const raw = $('#capScript').value.trim();
    if (!raw) { toast('Tulis atau tempel naskahnya dulu.', 'error'); return; }
    const words = raw.split(/\s+/).length;
    const start = voice.src && voice.duration ? +state.voice.delay || 0 : 0;
    const dur = voice.src && voice.duration ? voice.duration : Math.max(2, words * 0.42);
    // satu segmen per kalimat, waktu sebanding jumlah huruf
    const sentences = raw.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter(Boolean);
    const totalChars = sentences.join(' ').length;
    let t = start;
    const segs = sentences.map((s) => { const d = (dur * s.length) / totalChars; const seg = { start: t, end: t + d, text: s }; t += d; return seg; });
    state.captions.items = splitSegments(segs, state.captions.maxWords);
    state.captions.show = true;
    afterCaptionsChanged(`${state.captions.items.length} baris subtitle dibuat dari naskah`);
  }

  // Model Whisper dengan waktu per kata. Harus sama dengan download-model.js
  const MODEL_CONFIG = {
    base: { id: 'onnx-community/whisper-base_timestamped', dtype: 'q8', gpu: false },
    small: { id: 'onnx-community/whisper-small_timestamped', dtype: 'q8', gpu: false },
    turbo: { id: 'onnx-community/whisper-large-v3-turbo_timestamped', dtype: 'q4', gpu: true },
  };

  // ---------- Presisi: energi suara ----------
  // Energi (RMS) tiap 10 ms + ambang suara, untuk menempelkan waktu kata ke suara asli
  function computeEnergy(data, SR) {
    const hop = Math.round(SR / 100);
    const n = Math.floor(data.length / hop);
    const raw = new Float32Array(n);
    for (let f = 0; f < n; f++) {
      let sum = 0;
      for (let i = f * hop, end = i + hop; i < end; i++) sum += data[i] * data[i];
      raw[f] = Math.sqrt(sum / hop);
    }
    const e = new Float32Array(n); // dihaluskan sedikit
    for (let f = 0; f < n; f++) e[f] = (raw[Math.max(0, f - 1)] + raw[f] * 2 + raw[Math.min(n - 1, f + 1)]) / 4;
    const sorted = Float32Array.from(e).sort();
    const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] || 0;
    const noise = pick(0.1), peak = pick(0.98);
    return { e, thr: noise + (peak - noise) * 0.08, n };
  }
  const frameOf = (en, t) => Math.max(0, Math.min(en.n - 1, Math.round(t * 100)));
  function maxEnergy(en, a, b) {
    let m = 0;
    for (let f = frameOf(en, a), fb = frameOf(en, b); f <= fb; f++) m = Math.max(m, en.e[f]);
    return m;
  }
  // Geser awal kata ke titik suara benar-benar mulai.
  // Whisper sering memberi kata pertama setelah jeda waktu mulai di DALAM jeda (terlalu awal),
  // jadi bila awal kata jatuh di bagian hening, cari suara pertama sepanjang rentang kata itu (`maxFwd`).
  function snapStart(en, s, maxFwd = 0.25) {
    const f = frameOf(en, s), E = en.e, thr = en.thr;
    if (E[f] < thr) {
      const lim = Math.max(25, Math.round(maxFwd * 100));
      for (let k = 1; k <= lim && f + k < en.n; k++) if (E[f + k] >= thr) return (f + k) / 100;
      return s;
    }
    let k = 0;
    while (k < 15 && f - k - 1 >= 0 && E[f - k - 1] >= thr) k++;
    return (f - k) / 100;
  }
  // Geser akhir kata ke titik suara benar-benar berhenti (kata terakhir sering "menggantung" di jeda).
  function snapEnd(en, e, maxBack = 0.25) {
    const f = frameOf(en, e), E = en.e, thr = en.thr;
    if (E[f] < thr) {
      const lim = Math.max(25, Math.round(maxBack * 100));
      for (let k = 1; k <= lim && f - k >= 0; k++) if (E[f - k] >= thr) return (f - k + 1) / 100;
      return e;
    }
    let k = 0;
    while (k < 15 && f + k + 1 < en.n && E[f + k + 1] >= thr) k++;
    return (f + k + 1) / 100;
  }

  const normWord = (w) => w.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');

  // Bersihkan hasil AI: buang "halusinasi" di bagian hening & pengulangan, lalu presisikan waktunya
  function cleanWords(words, en) {
    let out = words.filter((w) => maxEnergy(en, w.s - 0.08, w.e + 0.08) >= en.thr * 0.7);
    // pengulangan berturut-turut (kata/frasa sama ≥3 kali) → simpan sekali
    for (let n = 1; n <= 4; n++) {
      for (let i = 0; i + 3 * n <= out.length; i++) {
        const key = (k) => out.slice(k, k + n).map((x) => normWord(x.w)).join(' ');
        const a = key(i);
        if (!a) continue;
        let j = i + n;
        while (j + n <= out.length && key(j) === a) j += n;
        if ((j - i) / n >= 3) out.splice(i + n, j - i - n);
      }
    }
    out = out.map((w, i) => {
      const next = out[i + 1], prev = out[i - 1];
      // batas pencarian: rentang kata itu sendiri, tidak melewati kata tetangga
      const fwd = Math.min(w.e, next ? next.s : w.e) - w.s + 0.1;
      const back = w.e - Math.max(w.s, prev ? prev.e : w.s) + 0.1;
      const s = snapStart(en, w.s, fwd);
      return { ...w, s, e: Math.max(s + 0.06, snapEnd(en, w.e, back)) };
    });
    for (let i = 0; i < out.length; i++) {
      if (i && out[i].s < out[i - 1].e) out[i].s = out[i - 1].e;
      if (out[i].e < out[i].s + 0.06) out[i].e = out[i].s + 0.06;
    }
    return out;
  }

  // ---------- Presisi: cocokkan dengan naskah ----------
  function referenceText() {
    const c = state.captions;
    if (c.ref === 'scenes' && freeMode()) return state.texts.filter((x) => !isSticker(x)).sort((a, b) => textRange(a)[0] - textRange(b)[0]).map((s) => (s.text || '').replace(/\*/g, '')).join(' ').trim();
    if (c.ref === 'scenes') return state.scenes.map((s) => (s.text || '').replace(/\*/g, '')).join(' ').trim();
    if (c.ref === 'script') return ($('#capScript').value || '').trim();
    return '';
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return 1 - prev[n] / Math.max(m, n);
  }

  // Penyelarasan global (Needleman–Wunsch): kata naskah ↔ kata hasil AI.
  // Ejaan diambil dari naskah, waktu dari AI; kata naskah tanpa pasangan diberi waktu interpolasi.
  function alignToReference(refText, hyp) {
    // simbol tanpa huruf (mis. "—", ":)", "…") ditempel ke kata sebelumnya, bukan dihitung sebagai kata
    const R = [];
    refText.split(/\s+/).filter(Boolean).forEach((tok) => {
      if (!normWord(tok) && R.length) R[R.length - 1] += ` ${tok}`;
      else if (!normWord(tok)) R.push(tok);
      else if (R.length && !normWord(R[R.length - 1])) R[R.length - 1] += ` ${tok}`;
      else R.push(tok);
    });
    const n = R.length, m = hyp.length;
    if (!n || !m) return null;
    const rn = R.map(normWord), hn = hyp.map((h) => normWord(h.w));
    const GAP = -0.6;
    const W = m + 1;
    const score = new Float32Array((n + 1) * W);
    const move = new Uint8Array((n + 1) * W); // 1 = diagonal, 2 = atas (lewati naskah), 3 = kiri (lewati AI)
    const simM = new Float32Array(n * m);
    for (let i = 1; i <= n; i++) { score[i * W] = i * GAP; move[i * W] = 2; }
    for (let j = 1; j <= m; j++) { score[j] = j * GAP; move[j] = 3; }
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const sim = similarity(rn[i - 1], hn[j - 1]);
        simM[(i - 1) * m + (j - 1)] = sim;
        const d = score[(i - 1) * W + j - 1] + (sim >= 0.75 ? 2 * sim : sim >= 0.5 ? 0.5 : -1);
        const u = score[(i - 1) * W + j] + GAP;
        const l = score[i * W + j - 1] + GAP;
        if (d >= u && d >= l) { score[i * W + j] = d; move[i * W + j] = 1; }
        else if (u >= l) { score[i * W + j] = u; move[i * W + j] = 2; }
        else { score[i * W + j] = l; move[i * W + j] = 3; }
      }
    }
    const out = R.map((w) => ({ w, s: null, e: null }));
    let i = n, j = m, good = 0;
    while (i > 0 || j > 0) {
      const mv = move[i * W + j];
      if (mv === 1) {
        out[i - 1].s = hyp[j - 1].s;
        out[i - 1].e = hyp[j - 1].e;
        if (simM[(i - 1) * m + (j - 1)] >= 0.5) good++;
        i--; j--;
      } else if (mv === 2) i--;
      else j--;
    }
    if (good < n * 0.35) return null; // naskah tidak cocok dengan suara
    // isi waktu kata naskah yang tidak terdengar/terdeteksi (dibagi sesuai panjang huruf)
    for (let a = 0; a < n;) {
      if (out[a].s != null) { a++; continue; }
      let b = a;
      while (b < n && out[b].s == null) b++;
      const from = a > 0 ? out[a - 1].e : Math.max(0, (b < n ? out[b].s : 0) - 0.35 * (b - a));
      const to = b < n ? out[b].s : from + 0.35 * (b - a);
      const chars = out.slice(a, b).reduce((x, w) => x + w.w.length + 1, 0);
      let t = from;
      for (let k = a; k < b; k++) {
        const d = ((to - from) * (out[k].w.length + 1)) / chars;
        out[k].s = t; out[k].e = t + d; t += d;
      }
      a = b;
    }
    for (let k = 1; k < n; k++) if (out[k].s < out[k - 1].e) out[k].s = out[k - 1].e;
    return out.map((w) => ({ ...w, e: Math.max(w.e, w.s + 0.06) }));
  }

  // Susun kata → baris subtitle: per kalimat / jeda bicara, dibagi rata sesuai "maks kata"
  function groupWords(words, maxWords) {
    const n = Math.max(1, Math.round(+maxWords || 6));
    const groups = [];
    let cur = [];
    words.forEach((w, i) => {
      cur.push(w);
      const next = words[i + 1];
      if (!next || /[.!?…]$/.test(w.w) || next.s - w.e > 0.6) { groups.push(cur); cur = []; }
    });
    const chunks = [];
    for (const g of groups) {
      const size = Math.ceil(g.length / Math.ceil(g.length / n));
      for (let j = 0; j < g.length; j += size) chunks.push(g.slice(j, j + size));
    }
    const items = chunks.map((ch) => ({
      start: Math.max(0, ch[0].s - 0.05),
      end: ch[ch.length - 1].e + 0.15,
      text: ch.map((x) => x.w).join(' '),
      words: ch.map((x) => ({ w: x.w, s: +x.s.toFixed(3), e: +x.e.toFixed(3) })),
    }));
    for (let i = 0; i < items.length - 1; i++) {
      const a = items[i], b = items[i + 1];
      // jeda pendek → tetap tampil sampai baris berikutnya (tidak berkedip)
      if (b.start - a.end < 0.35 || a.end > b.start) a.end = b.start;
    }
    items.forEach((it) => { it.start = +it.start.toFixed(2); it.end = +Math.max(it.end, it.start + 0.3).toFixed(2); });
    return items;
  }

  // Suara video latar persis seperti di timeline (per scene, ikut titik mulai video), mono.
  // Video yang dibisukan tetap diikutkan: subtitle tetap bisa dibuat walau suaranya tidak dipakai.
  // Hasil null bila tidak ada video yang bersuara.
  async function renderVideoSound(sr) {
    const total = totalDuration();
    const oc = new OfflineAudioContext(1, Math.max(1, Math.ceil(total * sr)), sr);
    const decoded = new Map();
    let any = false;
    for (const seg of videoSoundSegments(true)) {
      const s1 = Math.min(seg.b, total);
      if (s1 - seg.a < 0.02) continue;
      const entry = mediaEls.get(seg.id);
      if (!entry || !entry.url) continue;
      if (!decoded.has(seg.id)) {
        const raw = await (await fetch(entry.url)).arrayBuffer();
        decoded.set(seg.id, await oc.decodeAudioData(raw).catch(() => null)); // video tanpa suara → null
      }
      const buf = decoded.get(seg.id);
      if (!buf) continue;
      any = true;
      const d = Math.min((entry.el && entry.el.duration) || buf.duration, buf.duration);
      const node = oc.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      node.loopEnd = d;
      node.connect(oc.destination);
      node.playbackRate.value = seg.rate;
      node.start(seg.a, (((seg.src0 % d) + d) % d));
      node.stop(s1);
    }
    return any ? oc.startRendering() : null;
  }

  let asrWorker = null;
  // Server lokal (START.bat) hidup? Folder models/ tidak dilayani service worker, jadi ini benar-benar mengetuk server.
  // Halaman bisa tetap terbuka dari cache (aplikasi ter-install) walau server sudah ditutup.
  async function localServerAlive() {
    try { await fetch('models/?cek=' + Date.now(), { method: 'HEAD', cache: 'no-store' }); return true; } catch (_) { return false; }
  }
  const SERVER_TIP = 'Server aplikasi belum jalan: klik dua kali START.bat, biarkan jendela hitamnya tetap terbuka, lalu muat ulang halaman ini (Ctrl+F5).';
  // tidak ada suara orang → jelaskan & tawarkan voice-over AI
  function noSpeech(msg) {
    $('#capStatus').textContent = msg;
    $('#capNoVoice').classList.remove('hidden');
    toast(msg, 'error', 8000);
  }
  // buat voice-over AI dari teks project, lalu langsung buat subtitle dari suara itu (ejaan = teks project)
  async function ttsThenCaptions() {
    const text = projectTexts().map((x) => plainText(x.text)).join('\n');
    if (!text) { toast('Belum ada teks di project.', 'error'); return; }
    const btn = $('#btnCapTts'); btn.disabled = true;
    try {
      const ok = await makeTts({ mode: 'voice', text, status: (m) => { $('#capStatus').textContent = '🗣 ' + m; } });
      if (!ok) return;
      const set = (id, v) => { const el = $(id); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
      set('#capSource', 'voice'); set('#capRef', 'scenes');
      $('#capNoVoice').classList.add('hidden');
      await autoCaptions();
    } finally { btn.disabled = false; }
  }
  // ---------- Teks otomatis online: Groq Whisper (lewat server lokal, key tidak pernah ada di browser) ----------
  const GROQ_LANG = { indonesian: 'id', english: 'en', malay: 'ms', javanese: 'jw', arabic: 'ar', auto: '' };
  function wavBytes(f32, sr) { // PCM 16-bit mono
    const n = f32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const x = Math.max(-1, Math.min(1, f32[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
    return buf;
  }
  const groqErr = (msg) => Object.assign(new Error(msg), { groq: true });
  async function groqApi(path, opt = {}) {
    let r;
    try { r = await fetch('api/groq/' + path, { cache: 'no-store', ...opt }); }
    catch (_) { throw groqErr(SERVER_TIP); }
    const j = await r.json().catch(() => null);
    if (!j) throw groqErr(r.status === 404 ? (/github.io$|netlify.app$|pages.dev$/.test(location.hostname) ? 'Teks otomatis Groq hanya bisa dipakai saat YOG-EDITZ dijalankan dari START.bat di komputer. Di versi online, pakai mesin Whisper (di browser).' : 'Server aplikasi masih versi lama. Tutup jendela hitam START.bat, lalu jalankan START.bat lagi.') : 'Jawaban server tidak terbaca (' + r.status + ').');
    if (!r.ok) throw groqErr(j.error || 'Gagal (' + r.status + ')');
    return j;
  }
  // audio dipotong per ±10 menit (batas Groq 25 MB per file), dipotong di bagian paling hening
  async function groqWords(f32, sr, c, onStatus) {
    const MAX = 600 * sr, chunks = [];
    for (let a = 0; a < f32.length;) {
      let b = Math.min(f32.length, a + MAX);
      if (b < f32.length) { // cari titik hening di 20 detik terakhir potongan
        let best = b, bestE = Infinity; const win = Math.round(sr * 0.1);
        for (let x = b - 20 * sr; x < b - win; x += win) { let e = 0; for (let i = x; i < x + win; i += 8) e += Math.abs(f32[i]); if (e < bestE) { bestE = e; best = x + (win >> 1); } }
        b = best;
      }
      chunks.push([a, b]); a = b;
    }
    const lang = GROQ_LANG[c.lang] != null ? GROQ_LANG[c.lang] : 'id';
    const ref = referenceText();
    const words = [];
    for (let k = 0; k < chunks.length; k++) {
      const [a, b] = chunks[k];
      onStatus(chunks.length > 1 ? `Mengirim ke Groq… bagian ${k + 1}/${chunks.length}` : 'Mengirim audio ke Groq…', null);
      const q = new URLSearchParams({ model: c.groqModel || 'whisper-large-v3' });
      if (lang) q.set('lang', lang);
      if (ref) q.set('prompt', ref.replace(/\s+/g, ' ').slice(0, 400)); // bantu ejaan nama/istilah
      const j = await groqApi('transcribe?' + q, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wavBytes(f32.subarray(a, b), sr) });
      let ws = (j.words || []).map((w) => ({ w: String(w.word || '').trim(), s: +w.start || 0, e: +w.end || 0 })).filter((w) => w.w);
      ws.forEach((w) => { if (w.e <= w.s) w.e = w.s + 0.08; });
      // kata dari Groq tanpa tanda baca → ambil ejaan + tanda baca dari kalimat hasil Groq
      const full = (j.segments || []).map((x) => x.text).join(' ').trim() || j.text || '';
      if (full && ws.length) { const al = alignToReference(full, ws); if (al) ws = al; }
      const off = a / sr;
      ws.forEach((w) => words.push({ ...w, s: w.s + off, e: w.e + off }));
      onStatus(`Groq selesai ${k + 1}/${chunks.length}`, Math.round(((k + 1) / chunks.length) * 100));
    }
    return words;
  }
  async function refreshGroqStatus() {
    const el = $('#groqStatus');
    try {
      const j = await groqApi('status');
      el.textContent = j.set ? '✅ API key Groq tersimpan' + (j.env ? ' (dari GROQ_API_KEY)' : '') + '. Siap dipakai.' : '⚠ API key belum diisi. Tempel key lalu klik Simpan.';
    } catch (e) { el.textContent = '⚠ ' + e.message; }
  }
  function bindGroq() {
    const input = $('#groqKey');
    $('#btnGroqSave').addEventListener('click', async () => {
      const key = input.value.trim();
      if (!key) { toast('Tempel dulu API key Groq.', 'error'); input.focus(); return; }
      const btn = $('#btnGroqSave'); btn.disabled = true; $('#groqStatus').textContent = 'Memeriksa key ke Groq…';
      try {
        await groqApi('key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
        input.value = '';
        toast('API key Groq tersimpan ✅', 'success');
      } catch (e) { toast(e.message, 'error', 9000); }
      finally { btn.disabled = false; refreshGroqStatus(); }
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnGroqSave').click(); });
    $('#btnGroqDel').addEventListener('click', async () => {
      if (!confirm('Hapus API key Groq dari komputer ini?')) return;
      try { await groqApi('key', { method: 'DELETE' }); toast('API key Groq dihapus', 'success'); } catch (e) { toast(e.message, 'error'); }
      refreshGroqStatus();
    });
    $('#capEngine').addEventListener('change', () => { syncControls(); if (state.captions.engine === 'groq') refreshGroqStatus(); });
    if (state.captions.engine === 'groq') refreshGroqStatus();
  }

  async function autoCaptions() {
    $('#capNoVoice').classList.add('hidden');
    const c = state.captions;
    const fromMusic = c.source === 'music';
    const fromVideo = c.source === 'video';
    const src = fromMusic ? music : voice;
    if (fromVideo && !videoSoundSegments(true).length) {
      noSpeech('Belum ada video latar. Upload video di tab Media → Foto & Video, atau pilih sumber suara lain.');
      return;
    }
    if (!fromVideo && !src.src) {
      if (fromMusic) toast('Pilih musik dulu di tab Audio.', 'error', 6000);
      else noSpeech('Belum ada voice-over. Teks otomatis butuh suara orang berbicara/bernyanyi.');
      return;
    }
    if (location.protocol === 'file:') {
      toast('Teks otomatis AI butuh aplikasi dibuka lewat START.bat (localhost).', 'error', 8000);
      return;
    }
    const btn = $('#btnAutoCap');
    const status = $('#capStatus');
    const bar = $('#capProgress');
    btn.disabled = true;
    bar.classList.remove('hidden');
    bar.firstElementChild.style.width = '0%';
    status.textContent = 'Menyiapkan audio…';
    const serverOk = await localServerAlive();
    if (!serverOk && !navigator.onLine) {
      status.textContent = 'Gagal: ' + SERVER_TIP; toast(SERVER_TIP, 'error', 12000);
      btn.disabled = false; bar.classList.add('hidden'); return;
    }
    const useGroq = c.engine === 'groq';
    if (useGroq && !serverOk) {
      status.textContent = 'Gagal: ' + SERVER_TIP; toast('Groq butuh server aplikasi. ' + SERVER_TIP, 'error', 12000);
      btn.disabled = false; bar.classList.add('hidden'); return;
    }
    if (!serverOk) toast('Server aplikasi (START.bat) tidak jalan → model AI diambil dari internet. Lebih cepat bila START.bat dijalankan.', 'error', 8000);
    try {
      // audio 16 kHz mono untuk Whisper
      const SR = 16000;
      const buf = fromVideo
        ? await renderVideoSound(SR)
        : await new OfflineAudioContext(1, SR, SR).decodeAudioData(await (await fetch(src.src)).arrayBuffer());
      if (!buf) { noSpeech('Video latar tidak punya suara sama sekali (videonya bisu), jadi tidak ada yang bisa diubah jadi teks.'); return; }
      let data = buf.getChannelData(0);
      if (buf.numberOfChannels > 1) {
        const r = buf.getChannelData(1);
        data = data.map((v, i) => (v + r[i]) / 2);
      }
      let offset = 0;
      if (fromMusic) { // ambil bagian musik yang terdengar di video
        const s0 = Math.floor((+state.music.start || 0) * SR);
        data = data.subarray(s0, s0 + Math.ceil(totalDuration() * SR));
      } else if (!fromVideo) offset = +state.voice.delay || 0; // suara video sudah sesuai timeline
      const audioData = new Float32Array(data); // salinan untuk dikirim ke worker
      let peak = 0; for (let i = 0; i < audioData.length; i += 4) { const v = Math.abs(audioData[i]); if (v > peak) peak = v; }
      if (peak < 0.004) { noSpeech('Suaranya hening (tidak ada bunyi) di bagian yang dipakai video.'); return; }
      const audioDur = audioData.length / SR;
      // peta energi suara (dihitung sebelum audio dikirim ke worker)
      const energy = computeEnergy(audioData, SR);
      const cfg = MODEL_CONFIG[c.model] || MODEL_CONFIG.small;

      const backup = cfg.gpu && !useGroq ? new Float32Array(audioData) : null; // cadangan untuk penyelaras waktu
      const runAsr = (audio, conf) => new Promise((resolve, reject) => {
        if (!asrWorker) asrWorker = new Worker('js/asr-worker.js', { type: 'module' });
        const files = {};
        asrWorker.onmessage = (e) => {
          const m = e.data;
          if (m.type === 'progress' && m.p && m.p.status === 'progress' && m.p.total) {
            files[m.p.file] = [m.p.loaded, m.p.total];
            const v = Object.values(files);
            const pct = (v.reduce((a, x) => a + x[0], 0) / v.reduce((a, x) => a + x[1], 0)) * 100;
            bar.classList.remove('busy');
            bar.firstElementChild.style.width = `${pct.toFixed(0)}%`;
            status.textContent = `Mengunduh model AI… ${pct.toFixed(0)}% (hanya sekali)`;
          } else if (m.type === 'status') {
            status.textContent = m.msg;
            if (m.msg.includes('transkrip')) { bar.classList.add('busy'); bar.firstElementChild.style.width = '100%'; }
          } else if (m.type === 'done') resolve(m.out);
          else if (m.type === 'error') reject(new Error(m.msg));
        };
        asrWorker.onerror = (e) => { asrWorker = null; reject(new Error(e.message || 'Mesin AI gagal dimuat. Pastikan aplikasi dibuka lewat START.bat, lalu muat ulang halaman (Ctrl+F5).')); };
        asrWorker.postMessage({ audio, model: conf.id, dtype: conf.dtype, language: c.lang, preferGpu: conf.gpu, noLocal: !serverOk }, [audio.buffer]);
      });
      // kata-kata dengan waktu dari AI (relatif terhadap awal audio)
      const toWords = (out) => {
        const ws = [];
        (out.chunks || []).forEach((ch) => {
          const w = (ch.text || '').trim();
          if (!w) return;
          const prevEnd = ws.length ? ws[ws.length - 1].e : 0;
          const s = ch.timestamp && ch.timestamp[0] != null ? ch.timestamp[0] : prevEnd;
          let e = ch.timestamp && ch.timestamp[1] != null ? ch.timestamp[1] : Math.min(audioDur, s + 0.4);
          if (e <= s) e = s + 0.08;
          ws.push({ w, s, e });
        });
        return ws;
      };
      // waktu per kata rusak? (model terkompresi tinggi kadang memberi waktu yang sama untuk semua kata)
      const badTimes = (ws) => {
        if (ws.length < 3) return false;
        const outside = ws.filter((w) => w.s >= audioDur - 0.02 || w.s < 0).length;
        const distinct = new Set(ws.map((w) => w.s.toFixed(2))).size;
        return outside > ws.length * 0.3 || distinct < ws.length * 0.3;
      };

      let words, hybrid = false;
      if (useGroq) words = await groqWords(audioData, SR, c, (m, pct) => { status.textContent = m; if (pct == null) { bar.classList.add('busy'); bar.firstElementChild.style.width = '100%'; } else { bar.classList.remove('busy'); bar.firstElementChild.style.width = pct + '%'; } });
      else words = toWords(await runAsr(audioData, cfg));
      if (backup && words.length && badTimes(words)) {
        // teks dari model Terbaik, waktu dari model Akurat → keduanya digabung
        status.textContent = 'Menghitung waktu per kata (model Akurat)…';
        const timing = cleanWords(toWords(await runAsr(backup, MODEL_CONFIG.small)), energy);
        const merged = timing.length ? alignToReference(words.map((w) => w.w).join(' '), timing) : null;
        if (merged) { words = merged; hybrid = true; }
        else words = timing;
      }
      if (words.length < (fromVideo || fromMusic ? 4 : 1)) {
        noSpeech(fromMusic ? 'Tidak ada lirik/ucapan yang terdengar. Sepertinya musik ini instrumental (tanpa vokal).' : 'Tidak ada ucapan yang terdeteksi di suara ini.');
        return;
      }

      status.textContent = 'Menyelaraskan waktu dengan suara…';
      if (!hybrid) words = cleanWords(words, energy);

      // samakan ejaan dengan naskah / teks scene bila dipilih
      let usedRef = false;
      const ref = referenceText();
      if (ref) {
        const aligned = alignToReference(ref, words);
        if (aligned) { words = aligned; usedRef = true; }
        else toast('Naskah sepertinya tidak sama dengan yang diucapkan, jadi dipakai teks hasil AI.', 'error', 7000);
      }
      words.forEach((w) => { w.s += offset; w.e += offset; });
      c.items = groupWords(words, c.maxWords);
      c.show = true;
      status.textContent = `Selesai: ${c.items.length} baris • ${words.length} kata${usedRef ? ' • ejaan dari naskah' : ''}${hybrid ? ' • waktu dari model Akurat' : ''}.`;
      afterCaptionsChanged(`Teks otomatis selesai: ${c.items.length} baris ✨`);
    } catch (err) {
      console.error(err);
      // saran sesuai jenis kegagalan
      const msg = String(err.message || err);
      const tip = err.groq ? '' : /fetch|network|Failed to|404|load|unduh/i.test(msg)
        ? (!(await localServerAlive()) ? ' → ' + SERVER_TIP : ' → Model AI tidak ditemukan di folder models/ dan gagal diunduh. Jalankan UNDUH-MODEL-AI.bat sekali, lalu coba lagi.')
        : /memory|alloc|OOM|Aborted/i.test(msg) ? ' → Memori tidak cukup. Pilih model "Cepat" atau "Akurat", tutup aplikasi lain, lalu coba lagi.' : '';
      status.textContent = `Gagal: ${msg}${tip}`;
      toast(`Teks otomatis gagal: ${msg}${tip}`, 'error', 12000);
      if (asrWorker && !err.groq) { asrWorker.terminate(); asrWorker = null; }
    } finally {
      btn.disabled = false;
      bar.classList.remove('busy');
      setTimeout(() => bar.classList.add('hidden'), 1200);
    }
  }

  function afterCaptionsChanged(msg) {
    renderCaptionList();
    syncControls();
    refresh();
    if (msg) toast(msg, 'success');
  }

  const fmtSrt = (s) => {
    const ms = Math.max(0, Math.round(s * 1000));
    const p = (n, l = 2) => String(n).padStart(l, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };

  function renderCaptionList() {
    const items = state.captions.items;
    $('#capCount').textContent = items.length ? `(${items.length})` : '';
    $('#capList').innerHTML = items.map((s, i) => `
      <div class="cap-row" data-i="${i}">
        <input type="number" step="0.1" min="0" data-k="start" value="${s.start}" title="Mulai (detik)" />
        <input type="number" step="0.1" min="0" data-k="end" value="${s.end}" title="Selesai (detik)" />
        <input type="text" data-k="text" value="${esc(s.text)}" />
        <button class="ghost small" data-act="go" title="Lihat">👁</button>
        <button class="ghost small" data-act="split" title="Bagi dua di posisi playhead (atau di tengah)">✂</button>
        <button class="ghost small" data-act="merge" title="Gabung dengan baris berikutnya">⤓</button>
        <button class="ghost small" data-act="ins" title="Sisipkan baris sesudahnya">＋</button>
        <button class="ghost small" data-act="del" title="Hapus">✕</button>
      </div>`).join('') || '<p class="muted">Belum ada subtitle.</p>';
  }

  // ---------- Subtitle: template, edit baris, edit massal ----------
  function renderCapTemplates() {
    const grid = $('#capTplGrid');
    if (!grid.children.length) {
      grid.innerHTML = CAP_TEMPLATES.map(([k, n]) => `<button class="cap-tpl" data-tpl="${k}" title="${esc(n)}"><canvas width="270" height="150"></canvas><span>${esc(n)}</span></button>`).join('');
    }
    $$('.cap-tpl', grid).forEach((b) => {
      const tpl = CAP_TEMPLATES.find((x) => x[0] === b.dataset.tpl);
      const cv = b.querySelector('canvas'), g = cv.getContext('2d');
      const bgr = g.createLinearGradient(0, 0, cv.width, cv.height);
      bgr.addColorStop(0, '#3a4a5c'); bgr.addColorStop(1, '#1b2230');
      g.fillStyle = bgr; g.fillRect(0, 0, cv.width, cv.height);
      const c = { ...state.captions, ...tpl[2], size: tpl[2].size * 2.3, y: 0.5, width: 0.94, karaoke: tpl[2].karaoke };
      const seg = { start: 0, end: 2, text: 'Kata *indah* hari ini' };
      drawCaptionSeg(seg, tpl[2].anim === 'typewriter' ? 1.6 : 1.05, c, g, cv.width, cv.height);
      b.classList.toggle('active', state.captions.template === tpl[0]);
    });
  }
  // waktu tiap kata di semua baris (dari AI bila ada, kalau tidak dibagi menurut panjang kata)
  function captionWordTimes() {
    const out = [];
    for (const s of [...state.captions.items].sort((a, b) => a.start - b.start)) {
      const ws = String(s.text || '').trim().split(/\s+/).filter(Boolean);
      if (!ws.length) continue;
      if (s.words && s.words.length === ws.length) { s.words.forEach((w, i) => out.push({ w: ws[i], s: +w.s, e: +w.e })); continue; }
      const total = ws.reduce((a, w) => a + w.length + 1, 0), d = Math.max(0.1, s.end - s.start);
      let acc = 0;
      ws.forEach((w) => { const a = s.start + (acc / total) * d; acc += w.length + 1; out.push({ w, s: a, e: s.start + (acc / total) * d }); });
    }
    return out;
  }
  // samakan waktu per kata dengan teks baru (hanya bila jumlah kata tetap)
  function capSetText(s, text) {
    s.text = text;
    if (s.words) {
      const ws = text.trim().split(/\s+/);
      if (ws.length === s.words.length) ws.forEach((w, i) => { s.words[i].w = w; }); else s.words = null;
    }
  }
  function capRowAction(act, i) {
    const items = state.captions.items, s = items[i];
    if (!s) return;
    if (act === 'split') {
      const ws = String(s.text || '').trim().split(/\s+/).filter(Boolean);
      if (ws.length < 2) { toast('Baris ini hanya satu kata.', 'error'); return; }
      const t = player.t - (+state.captions.offset || 0);
      let k;
      if (s.words && s.words.length === ws.length && t > s.start + 0.05 && t < s.end - 0.05) k = s.words.findIndex((w) => w.s >= t);
      else if (t > s.start + 0.05 && t < s.end - 0.05) k = Math.round(ws.length * (t - s.start) / (s.end - s.start));
      if (!(k > 0 && k < ws.length)) k = Math.ceil(ws.length / 2);
      const cut = s.words && s.words.length === ws.length ? +s.words[k].s.toFixed(2) : +(s.start + (s.end - s.start) * (ws.slice(0, k).join(' ').length / ws.join(' ').length)).toFixed(2);
      const b = { start: cut, end: s.end, text: ws.slice(k).join(' '), words: s.words && s.words.length === ws.length ? s.words.slice(k) : null };
      s.end = cut; s.text = ws.slice(0, k).join(' ');
      if (s.words && s.words.length === ws.length) s.words = s.words.slice(0, k); else s.words = null;
      items.splice(i + 1, 0, b);
      afterCaptionsChanged('Baris dibagi ✂');
    } else if (act === 'merge') {
      const n = items[i + 1];
      if (!n) { toast('Tidak ada baris sesudahnya.', 'error'); return; }
      const both = s.words && n.words;
      s.text = `${String(s.text).trim()} ${String(n.text).trim()}`.trim();
      s.words = both ? [...s.words, ...n.words] : null;
      s.end = Math.max(s.end, n.end);
      items.splice(i + 1, 1);
      afterCaptionsChanged('Baris digabung ⤓');
    } else if (act === 'ins') {
      const n = items[i + 1];
      const start = +s.end.toFixed(2), end = +Math.max(start + 0.5, n ? Math.min(n.start, start + 2) : start + 2).toFixed(2);
      items.splice(i + 1, 0, { start, end, text: 'Teks baru' });
      afterCaptionsChanged();
    }
  }
  function bindCaptionTools() {
    const opts = (list) => list.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
    $('#capStyle').innerHTML = opts(CAP_STYLES);
    $('#capAnim').innerHTML = opts(CAP_ANIMS);
    $('#capAnimOut').innerHTML = opts(CAP_OUTS);
    $('#capHlMode').innerHTML = opts(CAP_HL);
    const fonts = [...$('#font').options].map((o) => o.value || o.textContent);
    $('#capFont').innerHTML = '<option value="">Ikut font teks</option>' + fonts.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
    renderCapTemplates();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderCapTemplates());
    $('#capTplGrid').addEventListener('click', (e) => {
      const b = e.target.closest('.cap-tpl');
      if (!b) return;
      const tpl = CAP_TEMPLATES.find((x) => x[0] === b.dataset.tpl);
      Object.assign(state.captions, tpl[2], { template: tpl[0], show: true });
      $('#capRegroupN').value = tpl[2].maxWords;
      const f = tpl[2].font || state.style.font;
      document.fonts.load(`${tpl[2].weight} 40px "${f}"`).finally(() => { syncControls(); updateOutputs(); refresh(); renderCapTemplates(); });
      toast(state.captions.items.length
        ? `Template "${tpl[1]}" dipakai. Klik "Bagi ulang" (${tpl[2].maxWords} kata) agar jumlah kata per baris ikut template.`
        : `Template "${tpl[1]}" dipakai. Buat subtitle dulu di atas.`, 'success', 6000);
    });
    // gaya diubah manual → tidak lagi persis template
    ['capStyle', 'capFont', 'capWeight', 'capColor', 'capHl', 'capAnim', 'capAnimOut', 'capHlMode', 'capBoxColor', 'capStrokeColor'].forEach((id) => $('#' + id).addEventListener('change', () => {
      state.captions.template = '';
      if (id === 'capFont' || id === 'capWeight') document.fonts.load(`${state.captions.weight} 40px "${state.captions.font || state.style.font}"`).finally(refresh);
      $$('.cap-tpl').forEach((b) => b.classList.remove('active'));
    }));
    $('#capList').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (b && ['split', 'merge', 'ins'].includes(b.dataset.act)) capRowAction(b.dataset.act, +b.closest('.cap-row').dataset.i);
    });
    const needItems = () => { if (state.captions.items.length) return true; toast('Belum ada subtitle.', 'error'); return false; };
    $('#btnCapReplace').addEventListener('click', () => {
      const f = $('#capFind').value;
      if (!f || !needItems()) { if (!f) toast('Isi kata yang dicari.', 'error'); return; }
      const re = new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      let n = 0;
      state.captions.items.forEach((s) => { const t2 = String(s.text).replace(re, () => { n++; return $('#capRepl').value; }); if (t2 !== s.text) capSetText(s, t2.replace(/\s+/g, ' ').trim()); });
      afterCaptionsChanged(n ? `${n} kata diganti` : 'Kata tidak ditemukan');
    });
    $('#btnCapCase').addEventListener('click', () => {
      if (!needItems()) return;
      state.captions.items.forEach((s) => capSetText(s, String(s.text).trim().replace(/^(\*?)(\p{L})/u, (m, a, ch) => a + ch.toUpperCase())));
      afterCaptionsChanged('Huruf awal tiap baris dikapitalkan');
    });
    $('#btnCapPunct').addEventListener('click', () => {
      if (!needItems()) return;
      state.captions.items.forEach((s) => capSetText(s, String(s.text).trim().replace(/[.,;:]+(\*?)$/, '$1')));
      afterCaptionsChanged('Tanda baca di akhir baris dihapus');
    });
    $('#btnCapRegroup').addEventListener('click', () => {
      if (!needItems()) return;
      const n = clamp(Math.round(+$('#capRegroupN').value || 3), 1, 20);
      state.captions.maxWords = n;
      state.captions.items = groupWords(captionWordTimes(), n);
      syncControls();
      afterCaptionsChanged(`Subtitle disusun ulang: maks ${n} kata per baris`);
    });
  }

  function bindCaptions() {
    bindCaptionTools();
    bindGroq();
    $('#btnAutoCap').addEventListener('click', autoCaptions);
    $('#btnCapTts').addEventListener('click', ttsThenCaptions);
    $('#btnCapScript').addEventListener('click', captionsFromScript);
    $('#capList').addEventListener('input', (e) => {
      const row = e.target.closest('.cap-row');
      if (!row) return;
      const s = state.captions.items[+row.dataset.i];
      const k = e.target.dataset.k;
      s[k] = k === 'text' ? e.target.value : Math.max(0, +e.target.value || 0);
      // waktu per kata hanya dipertahankan bila jumlah katanya tetap sama (mis. hanya membetulkan ejaan)
      if (k === 'text' && s.words) {
        const ws = s.text.trim().split(/\s+/);
        if (ws.length === s.words.length) ws.forEach((w, i) => { s.words[i].w = w; });
        else s.words = null;
      }
      refresh();
    });
    $('#capList').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const i = +b.closest('.cap-row').dataset.i;
      if (b.dataset.act === 'del') { state.captions.items.splice(i, 1); afterCaptionsChanged(); }
      else if (b.dataset.act === 'go') { pause(); seekTo(state.captions.items[i].start + 0.05); }
    });
    $('#btnCapAdd').addEventListener('click', () => {
      const items = state.captions.items;
      const start = items.length ? items[items.length - 1].end : +player.t.toFixed(2);
      items.push({ start, end: +(start + 2).toFixed(2), text: 'Teks baru' });
      afterCaptionsChanged();
    });
    $('#btnCapClear').addEventListener('click', () => {
      if (!state.captions.items.length || !confirm('Hapus semua subtitle?')) return;
      state.captions.items = [];
      afterCaptionsChanged('Subtitle dihapus (bisa dibatalkan dengan Undo)');
    });
    // subtitle → teks SRT (urut waktu, ikut "geser waktu")
    const srtText = () => {
      const off = +state.captions.offset || 0;
      return [...state.captions.items].sort((a, b) => a.start - b.start)
        .map((s, i) => `${i + 1}\r\n${fmtSrt(s.start + off)} --> ${fmtSrt(s.end + off)}\r\n${String(s.text || '').replace(/\*/g, '').trim()}\r\n`).join('\r\n');
    };
    const needCaps = () => {
      if (state.captions.items.length) return true;
      toast('Belum ada subtitle. Klik "✨ Buat teks otomatis" dulu, atau tambah baris manual.', 'error', 6000);
      return false;
    };
    $('#btnCapSrt').addEventListener('click', () => {
      if (!needCaps()) return;
      // BOM UTF-8 agar huruf non-ASCII terbaca benar di pemutar / YouTube
      downloadBlob(new Blob(['\ufeff' + srtText()], { type: 'application/x-subrip' }), `${slug(state.name)}.srt`);
      toast('File subtitle .srt diunduh ke folder Unduhan. Kalau tidak muncul, pakai "📋 Salin subtitle".', 'success', 6000);
    });
    $('#btnCapTxt').addEventListener('click', () => {
      if (!needCaps()) return;
      const txt = [...state.captions.items].sort((a, b) => a.start - b.start).map((s) => String(s.text || '').trim()).join('\r\n');
      downloadBlob(new Blob(['\ufeff' + txt], { type: 'text/plain;charset=utf-8' }), `${slug(state.name)}-subtitle.txt`);
      toast('Teks subtitle .txt diunduh', 'success');
    });
    $('#btnCapCopy').addEventListener('click', async () => {
      if (!needCaps()) return;
      const text = srtText();
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (_) {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch (__) { ok = false; }
        ta.remove();
      }
      toast(ok ? 'Subtitle (format SRT) disalin. Tempel di Notepad lalu simpan sebagai .srt' : 'Gagal menyalin', ok ? 'success' : 'error', 6000);
    });
    $('#btnCapToScenes').addEventListener('click', () => {
      const items = [...state.captions.items].sort((a, b) => a.start - b.start);
      if (!items.length) { toast('Belum ada subtitle.', 'error'); return; }
      if (freeMode()) {
        if (!confirm(`Ganti semua teks dengan ${items.length} teks dari subtitle (waktunya sama persis)?`)) return;
        const off = +state.captions.offset || 0;
        state.texts = state.texts.filter(isSticker).concat(items.map((s) => newText(s.text, '', Math.max(0, s.start + off), Math.max(0, s.end + off))));
        state.duration = Math.max(totalDuration(), r1(items[items.length - 1].end + off + 0.5));
        state.captions.show = false;
        renderScenes(); syncControls(); refresh();
        toast(`${items.length} teks dibuat dari subtitle`, 'success');
        return;
      }
      if (!confirm(`Ganti semua scene dengan ${items.length} scene dari subtitle?`)) return;
      // batas scene = awal tiap subtitle; scene pertama mulai dari 0
      const audioEnd = voice.src && voice.duration ? (+state.voice.delay || 0) + voice.duration : 0;
      const end = Math.max(items[items.length - 1].end + 0.5, audioEnd);
      state.scenes = items.map((s, i) => {
        const off = +state.captions.offset || 0;
        const a = i === 0 ? 0 : s.start + off;
        const b = i + 1 < items.length ? items[i + 1].start + off : end + off;
        // scene pertama: teks baru masuk saat kalimat pertama diucapkan
        const delay = i === 0 ? +Math.max(0, s.start + off).toFixed(2) : 0;
        return { text: s.text, author: '', duration: +Math.max(0.5, b - a, delay + 0.5).toFixed(2), emoji: '', bg: '', delay };
      });
      state.captions.show = false; // teks sudah tampil sebagai scene
      renderScenes();
      afterCaptionsChanged(`${items.length} scene dibuat dari subtitle (subtitle disembunyikan)`);
    });
  }

  // =========================================================
  //  TEMA TERANG / GELAP
  // =========================================================
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    $('#btnTheme').textContent = theme === 'light' ? '🌙' : '☀';
    try { localStorage.setItem('evkk:theme', theme); } catch (_) { /* abaikan */ }
  }
  function toggleTheme() {
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  }

  // =========================================================
  //  INIT
  // =========================================================
  // =========================================================
  //  YOG-EDITZ: grid Efek / Transisi / Filter + tab Properti klip
  // =========================================================
  function setPropTab(t) {
    const bar = $('#clipBar');
    bar.dataset.pt = t;
    $$('#clipBar .ptabs [data-ptab]').forEach((b) => b.classList.toggle('active', b.dataset.ptab === t));
    try { localStorage.setItem('yog:ptab', t); } catch (_) { /* abaikan */ }
  }
  // klip yang dituju alat di panel kiri: yang dipilih (bila ada)
  const gridClip = () => clipById(ui.selClip) || null;
  const TR_GLYPH = { 'Dasar': '◐', 'Geser': '⇆', 'Dorong': '⇶', 'Zoom & putar': '⟲', 'Sapu & bentuk': '◆' };
  // gerakan contoh untuk pratinjau (arahkan kursor ke kotak transisi)
  const TR_ANIM = {
    none: 'none', fade: 'fade', dissolve: 'fade', flash: 'flash', colorFlash: 'flash', filmBurn: 'flash', lightLeak: 'flash', black: 'black',
    slideLeft: 'slide-l', bounceSlide: 'slide-l', slideRight: 'slide-r', slideUp: 'slide-u', slideDown: 'slide-d', dropBounce: 'slide-d',
    pushLeft: 'push-l', slideAway: 'push-l', pushRight: 'push-r', pushUp: 'push-u', pushDown: 'push-d', zoomThrough: 'zoom-in', zoomBlur: 'zoom-in',
    zoom: 'zoom-in', zoomOut: 'zoom-out', spin: 'spin', zoomSpin: 'spin', flip: 'flip', flipV: 'flip-v', stretch: 'flip-v', swing: 'swing',
    wipe: 'wipe-l', wipeLeft: 'wipe-r', wipeUp: 'wipe-u', wipeDown: 'wipe-d', wipeDiag: 'wipe-diag', splitV: 'split-v', splitH: 'split-h',
    circle: 'circle', heart: 'circle', rectIris: 'rect', diamond: 'diamond', star: 'diamond', clock: 'wipe-diag', blinds: 'blinds', blindsV: 'blinds-v', checker: 'blinds',
    blurIn: 'blur', pixelIn: 'pixel', glitchIn: 'glitch', rgbIn: 'glitch', shakeIn: 'shake',
  };
  function trTile(v, n, g) {
    return `<button class="fx-tile tr" data-v="${esc(v)}" title="${esc(n)}"><span class="ft-art tr-art" data-tra="${TR_ANIM[v] || 'fade'}"><em class="tr-a"></em><em class="tr-b"></em><b>${TR_GLYPH[g] || '⇄'}</b></span><span class="ft-name">${esc(n)}</span></button>`;
  }
  const fxAnimOf = (v, n) => { const x = (v + ' ' + n).toLowerCase(); return /shake|getar|goyang|gempa|wobble/.test(x) ? 'shake' : /glitch|rgb|vhs|tv|noise|semut|pixel|piksel/.test(x) ? 'glitch' : /strobe|flash|kilat|flicker|kedip/.test(x) ? 'flicker' : /blur/.test(x) ? 'blur' : /spin|putar|kaleido|pusar/.test(x) ? 'spin' : /sparkle|star|bintang|shine|kilau|prism|bocor|leak|glow|sinar/.test(x) ? 'shine' : 'pulse'; };
  function buildGrids() {
    // transisi, dikelompokkan
    let html = '', grp = '';
    for (const [v, n, g] of TRANSITIONS) {
      if (g !== grp) { html += `<div class="fx-group">${esc(g || '')}</div>`; grp = g; }
      html += trTile(v, n, g);
    }
    $('#trGrid').innerHTML = html;
    // efek
    $('#fxGrid').innerHTML = Object.entries(EFFECTS).map(([v, n], i) => `<button class="fx-tile fxv" data-v="${esc(v)}" title="${esc(n)}"><span class="ft-art fx-art" data-fxa="${v === 'none' ? 'none' : fxAnimOf(v, n)}" style="--h:${(i * 37) % 360}"><b>${v === 'none' ? '⊘' : '✦'}</b></span><span class="ft-add" title="Tambah sebagai lapisan di timeline (di playhead)">＋</span><span class="ft-name">${esc(n)}</span></button>`).join('');
    // filter (gambar contoh dibuat dari frame pemutar)
    $('#flGrid').innerHTML = Object.entries(FILTERS).map(([v, [n]]) => `<button class="fx-tile fl" data-v="${esc(v)}" title="${esc(n)}"><canvas class="ft-art fl-art" width="96" height="64"></canvas><span class="ft-add" title="Tambah sebagai lapisan di timeline (di playhead)">＋</span><span class="ft-name">${esc(n)}</span></button>`).join('');
    $('#trGrid').addEventListener('click', (e) => { const b = e.target.closest('.fx-tile'); if (b) applyGridTrans(b.dataset.v); });
    $('#fxGrid').addEventListener('click', (e) => { const b = e.target.closest('.fx-tile'); if (!b) return; if (e.target.closest('.ft-add')) addSeg('fx', b.dataset.v); else applyGridFx(b.dataset.v); });
    $('#flGrid').addEventListener('click', (e) => { const b = e.target.closest('.fx-tile'); if (!b) return; if (e.target.closest('.ft-add')) addSeg('filter', b.dataset.v); else applyGridFilter(b.dataset.v); });
    // kekuatan / durasi
    const outs = () => { $('#fxGridAmtOut').textContent = `${$('#fxGridAmt').value}`; $('#flGridAmtOut').textContent = `${$('#flGridAmt').value}`; };
    $('#fxGridAmt').addEventListener('input', () => {
      const c = gridClip(), v = +$('#fxGridAmt').value;
      if (c) c.fxAmt = v; else state.bg.fxAmt = v;
      outs(); afterGrid(false);
    });
    $('#flGridAmt').addEventListener('input', () => {
      const c = gridClip(), v = +$('#flGridAmt').value;
      if (c) c.filterAmt = v; else state.bg.filterAmt = v;
      outs(); afterGrid(false);
    });
    $('#trGridDur').addEventListener('change', () => {
      const v = clamp(+$('#trGridDur').value || 0.6, 0.1, 5); $('#trGridDur').value = v;
      const c = gridClip();
      if (c) c.transDur = v; else { clipList().forEach((x) => { x.transDur = v; }); state.bg.xDur = v; }
      afterGrid(true);
    });
    $('#btnTrGridAll').addEventListener('click', () => {
      const c = gridClip(); if (!c) { toast('Pilih klip sumber di timeline dulu.'); return; }
      clipList().forEach((x) => { x.trans = c.trans; x.transDur = c.transDur; });
      afterGrid(false); toast('Transisi dipakai di semua klip', 'success');
    });
    $('#btnFxGridAll').addEventListener('click', () => {
      const c = gridClip(); if (!c) { toast('Pilih klip sumber di timeline dulu.'); return; }
      clipList().forEach((x) => { if (c.fx) { x.fx = c.fx; x.fxAmt = c.fxAmt; } else delete x.fx; });
      afterGrid(false); toast('Efek dipakai di semua klip', 'success');
    });
    $('#btnFlGridAll').addEventListener('click', () => {
      const c = gridClip(); if (!c) { toast('Pilih klip sumber di timeline dulu.'); return; }
      clipList().forEach((x) => { if (c.filter) { x.filter = c.filter; x.filterAmt = c.filterAmt; } else delete x.filter; });
      afterGrid(false); toast('Filter dipakai di semua klip', 'success');
    });
    outs();
    // tab Properti klip
    $('#clipBar .ptabs').addEventListener('click', (e) => { const b = e.target.closest('[data-ptab]'); if (b) setPropTab(b.dataset.ptab); });
    let pt = 'dasar'; try { pt = localStorage.getItem('yog:ptab') || 'dasar'; } catch (_) { /* abaikan */ }
    setPropTab(pt);
    $('#btnAdjOpen').addEventListener('click', () => {
      if (!clipById(ui.selClip)) { const sl = clipAtPlayhead(); if (sl) selectClip(sl.clip.id, false); }
      if (!clipById(ui.selClip)) { toast('Belum ada klip di timeline. Tambahkan media dulu.', 'error'); return; }
      setPropTab('penyesuaian');
      $('#clipBar').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // buka tab → perbarui tanda & gambar contoh
    $$('.tab').forEach((t) => t.addEventListener('click', () => { if (['efek', 'transisi', 'filter'].includes(t.dataset.tab)) { updateGridSel(); if (t.dataset.tab === 'filter') drawFilterThumbs(); } }));
    updateGridSel();
  }
  function afterGrid(tryIt) {
    save(); renderTimeline(); updateClipBar(); renderFxList(true);
    const c = gridClip();
    if (tryIt && c) tryClip(c); else if (!player.playing) render(player.t);
    updateGridSel();
  }
  function applyGridTrans(v) {
    const ts = gridTargets(), c = ts[0] || null, d = clamp(+$('#trGridDur').value || 0.6, 0.1, 5);
    if (!clipList().length) { toast('Tambahkan klip ke timeline dulu.', 'error'); return; }
    if (c) {
      if (ts.length === 1 && clipList()[0] === c && v !== 'none') toast('Klip pertama tidak punya transisi masuk. Pilih klip kedua dst.', 'error');
      ts.forEach((x) => { x.trans = v; x.transDur = d; });
      if (ts.length > 1) toast(`Transisi dipasang di ${ts.length} klip`, 'success');
    } else { clipList().forEach((x) => { x.trans = v; x.transDur = d; }); state.bg.xTrans = v; state.bg.xDur = d; toast('Transisi dipasang di semua klip', 'success'); }
    afterGrid(true);
  }
  function applyGridFx(v) {
    const ts = gridTargets(), c = ts[0] || null, amt = +$('#fxGridAmt').value;
    if (c) ts.forEach((x) => { x.fx = v; x.fxAmt = amt; }); else { state.bg.fx = v; state.bg.fxAmt = amt; }
    afterGrid(false);
  }
  function applyGridFilter(v) {
    const ts = gridTargets(), c = ts[0] || null, amt = +$('#flGridAmt').value;
    if (c) ts.forEach((x) => { x.filter = v; x.filterAmt = amt; }); else { state.bg.filter = v; state.bg.filterAmt = amt; }
    afterGrid(false);
  }
  // tandai pilihan yang aktif untuk klip terpilih / seluruh video
  function updateGridSel() {
    if (!$('#trGrid')) return;
    const c = gridClip();
    const n = c ? clipList().indexOf(c) + 1 : 0;
    const mc = multiItems().clips.length;
    const who = mc > 1 ? `${mc} klip dipilih` : c ? `Klip ${n} dipilih` : 'Belum memilih klip → seluruh video';
    $('#trGridHint').innerHTML = c ? `<b>${who}.</b> Klik transisi untuk memasangnya di awal klip ini.` : `<b>${who}.</b> Klik transisi untuk memasangnya di semua klip, atau pilih klip di timeline dulu.`;
    $('#fxGridHint').innerHTML = `<b>${who}.</b> Klik efek untuk memasangnya.`;
    $('#flGridHint').innerHTML = `<b>${who}.</b> Klik filter untuk memasangnya.`;
    const tr = c ? c.trans || 'fade' : state.bg.xTrans || 'fade';
    const fx = c ? c.fx || '' : state.bg.fx || 'none';
    const fl = c ? c.filter || '' : state.bg.filter || 'none';
    $$('#trGrid .fx-tile').forEach((b) => b.classList.toggle('active', b.dataset.v === tr));
    $$('#fxGrid .fx-tile').forEach((b) => b.classList.toggle('active', b.dataset.v === fx));
    $$('#flGrid .fx-tile').forEach((b) => b.classList.toggle('active', b.dataset.v === fl));
    if (document.activeElement !== $('#trGridDur')) $('#trGridDur').value = c ? (+c.transDur || 0.6) : (+state.bg.xDur || 0.6);
    $('#fxGridAmt').value = c ? (c.fxAmt == null ? 60 : c.fxAmt) : (state.bg.fxAmt == null ? 60 : state.bg.fxAmt);
    $('#flGridAmt').value = c ? (c.filterAmt == null ? 100 : c.filterAmt) : (state.bg.filterAmt == null ? 100 : state.bg.filterAmt);
    $('#fxGridAmtOut').textContent = $('#fxGridAmt').value; $('#flGridAmtOut').textContent = $('#flGridAmt').value;
  }
  // gambar contoh filter dari frame pemutar saat ini
  function drawFilterThumbs() {
    const src = $('#canvas');
    $$('#flGrid canvas').forEach((cv) => {
      const g = cv.getContext('2d'), v = cv.parentElement.dataset.v;
      g.clearRect(0, 0, cv.width, cv.height);
      g.filter = filterCss({ filter: v, amt: 1 }) || 'none';
      const sw = src.width, sh = src.height, r = Math.max(cv.width / sw, cv.height / sh);
      const w = sw * r, h = sh * r;
      try { g.drawImage(src, (cv.width - w) / 2, (cv.height - h) / 2, w, h); } catch (_) { /* abaikan */ }
      g.filter = 'none';
    });
  }

  function init() {
    document.addEventListener("click", (e) => { if (e.target.closest("button, .fx-tile, .ml-item, .tx-tpl, [data-tab]")) flushPendingSave(); }, true);
    document.addEventListener("keydown", (e) => { if (!/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "")) flushPendingSave(); }, true);
    document.addEventListener("pointerdown", (e) => { if (e.target.closest("#timeline")) flushPendingSave(); }, true);
    buildSwatches();
    buildTemplates();
    renderScenes();
    bindControls();
    bindFiles();
    bindButtons();
    bindTimeline();
    bindMobile();
    bindVizDrag();
    bindGallery();
    bindBank();
    bindMediaLib();
    buildGrids();
    buildVideoTemplates();
    bindCaptions();
    renderCaptionList();
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
    ui.selMedia = state.media[0] ? state.media[0].id : '';
    loadMediaEls();
    cleanupMediaStore();
    syncControls();
    showFormatInfo();
    // PWA: aktifkan mode offline/instal saat dijalankan lewat server (bukan file://)
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* abaikan */ });
    }
    if (state.layout !== 'free') setLayout('free', true);
    player.t = 0;
    snapshot();
    refresh();
    // gambar ulang setelah font Google selesai dimuat
    document.fonts.load(`${state.style.weight} 40px "${state.style.font}"`).finally(refresh);
    document.fonts.ready.then(refresh);
  }

  init();
})();
