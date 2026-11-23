# YOG-EDITZ

**YOG-EDITZ** adalah aplikasi pengeditan video di browser dengan cara kerja ala editor video desktop.

1. Impor media ke perpustakaan.
2. Susun di timeline multi-track.
3. Potong, beri transisi, efek, filter, animasi, mask, keyframe, teks, stiker, subtitle otomatis, dan audio.
4. Export MP4 sampai 4K.

Semua berjalan di komputer sendiri, tanpa instal aplikasi lain.

## Cara menjalankan

1. Install [Node.js](https://nodejs.org) (sekali saja).
2. Klik dua kali **`START.bat`**. Aplikasi terbuka di `http://localhost:5173`.
3. Biarkan jendela hitam START.bat tetap terbuka selama memakai aplikasi.

Gunakan **Chrome** atau **Edge** versi terbaru. Setelah aplikasi diperbarui, tekan **Ctrl+F5** di tab aplikasi.

Dengan START.bat, aplikasi bisa **di-install** (ikon ⊕ di address bar) dan **dipakai offline**. Font diambil dari Google Fonts; tanpa internet aplikasi tetap berjalan dengan font bawaan.

### Membuka di HP (WiFi yang sama)

1. Klik dua kali **`START-HP.bat`** (bukan START.bat). Jendela hitamnya menampilkan alamat seperti `http://192.168.x.x:5173`.
2. Bila Windows menanyakan izin firewall untuk Node.js, centang **Private networks** lalu **Allow**.
3. Sekali saja di browser HP/tablet:
   - **Edge:** buka `edge://flags/#unsafely-treat-insecure-origin-as-secure`
   - **Chrome:** buka `chrome://flags/#unsafely-treat-insecure-origin-as-secure`

   Isi kotaknya dengan alamat tadi, pilih **Enabled**, lalu tekan **Restart / Relaunch**. Tanpa langkah ini export video dan install aplikasi tidak jalan, karena browser hanya mengizinkannya di alamat aman (HTTPS).
4. Buka alamatnya. Untuk memasang:
   - **Edge:** menu **···** → **Tambahkan ke ponsel / Install aplikasi**
   - **Chrome:** menu ⋮ → **Install aplikasi / Tambahkan ke layar utama**

   Ikon YOG-EDITZ muncul di layar utama dan aplikasinya terbuka tanpa bilah alamat.

Di layar HP (lebar 760px ke bawah) tampilan otomatis berganti ke versi HP: pemutar di atas, timeline di tengah, kategori di bilah bawah. Ketuk kategori untuk membuka lembarnya (ketuk lagi atau ✕ untuk menutup). Ketuk klip atau teks di timeline untuk membuka **Properti** dari bawah, lalu tekan **✕ Selesai**. Di timeline, geser untuk menggulir; klip yang sedang terpilih bisa ditarik dan dipangkas.

Gerakan sentuh di HP:

| Gerakan | Fungsi |
|---|---|
| Tekan lama kartu media lalu geser ke timeline | Menambahkan media di posisi itu (di atas track utama = overlay) |
| Cubit dua jari di timeline | Zoom timeline |
| Cubit / putar dua jari di pemutar | Mengubah ukuran dan memutar teks/stiker atau klip yang dipilih |
| Tombol ☑ di toolbar timeline | Mode pilih banyak: ketuk beberapa klip/teks, lalu hapus, salin, atau pasang transisi/filter/efek sekaligus |
| Tombol salin / tempel di toolbar | Pengganti Ctrl+C / Ctrl+V |

Teks otomatis Groq hanya bisa dipakai dari komputer, supaya API key tidak dipakai perangkat lain di WiFi.

## Tampilan editor

| Area | Isi |
|---|---|
| **Bilah atas** | Menu (Project Saya, project baru, buka/simpan file, pintasan, versi), nama project, tema terang/gelap, tombol **Export** |
| **Kiri – kategori** | Media, Audio, Teks, Stiker, Efek, Transisi, Teks otomatis, Filter, Penyesuaian, Template |
| **Tengah – Pemutar** | Pratinjau, waktu (jam:menit:detik:frame), putar/jeda, **kualitas pratinjau** (Penuh / ½ / ¼), rasio, area aman, layar penuh |
| **Kanan – Properti** | Pengaturan item yang diklik di timeline (klip, teks, overlay, audio, lapisan efek), bertab |
| **Bawah – Timeline** | Track Efek → Teks → Overlay → Video utama → Audio → Musik/Voice-over, toolbar alat, zoom, magnet, penanda |

Project kosong menampilkan layar sambutan dengan tombol **＋ Impor media**.

## Alur kerja dasar

1. **Media → Impor**: pilih foto/video (bisa banyak sekaligus), atau seret file ke panel Media / pemutar / timeline.
2. Masukkan ke timeline lewat salah satu cara:
   - klik **＋** di kartu media,
   - **seret kartu ke timeline** (bisa disisipkan di antara klip),
   - atau **＋ Semua ke timeline**.
3. Seret kartu ke area **di atas** track utama, atau klik **▣**, untuk menjadikannya **overlay** (gambar di atas video).
4. Klik item di timeline, lalu atur di **Properti**.
5. Klik **Export**.

## Kategori kiri

- **Media**: perpustakaan foto/video dengan sampul, durasi, dan tanda ✓ bila sudah dipakai. Pengaturan per media: mode tampil, gerak foto, durasi bawaan foto, dan suara asli video.
- **Audio**:
  - musik latar dan **ketukan musik (beat sync)**,
  - voice-over: rekam, upload, perjelas suara, pengubah suara,
  - **teks ke suara (AI)** bahasa Indonesia,
  - **track audio tambahan** dan 10 efek suara bawaan.
- **Teks**:
  - **＋ Teks default** dan **10 template teks** (gaya + animasi),
  - gaya bawaan untuk teks baru dan animasi teks bawaan.
- **Stiker**: emoji, gambar/PNG transparan, overlay video/foto, logo & watermark.
- **Efek**:
  - grid efek video dengan pratinjau animasi saat kursor di atasnya; klik = pasang di klip terpilih, **＋** = lapisan efek di timeline,
  - partikel, sinematik, bingkai, visualizer musik.
- **Transisi**: grid transisi dengan pratinjau animasi, durasi, ⧉ ke semua klip, daftar transisi tiap klip.
- **Teks otomatis**:
  - subtitle dari suara memakai AI Whisper di komputer, atau **Groq Whisper online**,
  - 16 template subtitle, gaya, efek, dan alat edit lengkap.
- **Filter**: grid filter dengan gambar contoh dari video sendiri. Klik = klip terpilih, **＋** = lapisan filter di timeline.
- **Penyesuaian**: buka penyesuaian klip, gelap/blur seluruh video, latar kanvas, rasio video.
- **Template**:
  - **6 template video** dengan slot media: Kenangan, Beat cepat, Vlog harian, Sinematik, Sebelum–sesudah, Promo produk,
  - template gaya.

## Panel Properti

### Klip video / foto

| Tab | Isi |
|---|---|
| **Dasar** | Durasi, trim awal, **hapus latar (AI)** untuk foto, **mask** (9 bentuk, ukuran, halus tepi, geser, balik), **latar kanvas** (hitam/blur/warna), crop, putar 90°, balik, **transform**: skala 10–300%, geser X/Y, putar bebas, opasitas — semua bisa di-keyframe ◆, plus Ken Burns otomatis |
| **Animasi** | **Animasi klip** masuk/keluar/kombo + durasi, transisi masuk, filter & efek klip |
| **Penyesuaian** | Kecerahan, kontras, saturasi, suhu, rona, vignette, **haluskan (retouch)** |
| **Kecepatan** | 0,25×–4×, **kurva kecepatan** (Montage, Hero, Bullet, Lompat, Flash masuk/keluar), mundur, beku |
| **Audio** | Volume klip 0–200%, bisukan, fade in/out, **🎵 pisahkan audio** |

### Teks

| Tab | Isi |
|---|---|
| **Teks** | Isi, waktu, posisi X/Y, ukuran, putar, transparansi, keyframe ◆ ‹ › |
| **Gaya** | 10 gaya cepat, font (16 + upload sendiri), ketebalan, ukuran, warna, rata, jarak huruf/baris, **lengkung**, miring, huruf besar, garis tepi, kotak latar, bayangan, neon, gradasi, warna sorotan; ⧉ ke semua teks |
| **Animasi** | Masuk/keluar & lamanya, termasuk **animasi per huruf** (muncul satu-satu, naik, ombak, memantul, berkedip) |

### Overlay, audio, dan lapisan efek

- **Overlay**:
  - **Dasar**: posisi, ukuran, putar, transparansi, keyframe, hapus latar (AI) untuk foto.
  - **Tampilan & chroma**: animasi, mode campur, mask, bingkai, filter, chroma key, suara.
- **Audio**:
  - **Dasar**: mulai, durasi, volume, fade.
  - **Suara**: efek suara, pengubah nada, hapus bising, ratakan volume.
- **Lapisan efek/filter**: jenis, kekuatan, mulai/selesai, ↔ seluruh video, duplikat, hapus.

## Timeline

- **Toolbar**:
  - undo/redo,
  - potong, hapus kiri/kanan playhead, duplikat, hapus,
  - **grup / bubarkan grup**,
  - beku, mundur, cermin, putar 90°, crop,
  - **penanda**, **magnet**, zoom.
- **Seret & trim**:
  - seret klip utama untuk mengubah urutan,
  - seret teks, overlay, audio, atau lapisan efek untuk memindah waktu,
  - tarik tepi untuk trim,
  - **magnet** menempel ke tepi klip, teks, audio, lapisan, penanda, dan playhead.
- **Pilih banyak**: Ctrl+klik beberapa item lalu hapus, salin, atau pasang transisi/filter/efek sekaligus.
- **Grup**: Ctrl+G mengelompokkan teks, stiker, overlay, dan lapisan efek. Klik satu anggota memilih seluruh grup, dan seret satu membuat semuanya ikut bergeser.
- **Salin/tempel** item atau **atributnya saja** (filter, warna, transisi, animasi, mask • gaya & animasi teks).
- Tinggi timeline bisa ditarik dari tepi atasnya. Tombol 👁 🔒 🔇 di kepala track menyembunyikan, mengunci, atau membisukan track.

## Pintasan keyboard

| Tombol | Fungsi |
|---|---|
| `Spasi` | Putar / jeda |
| `←` `→` | Mundur / maju 1 frame (`Shift` = 1 detik) |
| `Home` / `End` | Ke awal / akhir |
| `Ctrl+B` / `S` | Potong di playhead |
| `Q` / `W` | Hapus bagian klip di kiri / kanan playhead |
| `Delete` | Hapus item terpilih (atau semua yang dipilih) |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Salin / potong / tempel |
| `Ctrl+Alt+C` / `Ctrl+Alt+V` | Salin / tempel atribut |
| `Ctrl+G` / `Ctrl+Shift+G` | Kelompokkan / bubarkan grup |
| `Ctrl` + klik | Pilih banyak |
| `M` / `Shift+M` | Tambah/hapus penanda / lompat ke penanda berikutnya |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo (setiap aksi = satu langkah) |
| `Ctrl+S` | Simpan project ke file |
| `Ctrl+E` | Export |
| `F` / `G` | Layar penuh / area aman |
| `?` / `Esc` | Bantuan / tutup & batal pilih |

## Export

- **Dialog export**: sampul, nama file (dipakai persis), resolusi **480p / 720p / 1080p / 2K / 4K**, frame rate 24–60, bitrate (menyesuaikan resolusi & fps), format MP4 (H.264 + AAC), dan **perkiraan ukuran file**.
- **Mesin Presisi (WebCodecs)**: dirender frame demi frame, tidak ada frame hilang, biasanya lebih cepat dari durasi video. Mesin Realtime tersedia di *Lanjutan* sebagai cadangan.
- Pratinjau ½ / ¼ tidak memengaruhi hasil export.
- Ada juga: simpan frame sebagai PNG, dan posting ke media sosial (caption & hashtag otomatis, tombol upload per platform).

## Fitur AI (berjalan di komputer sendiri)

| Fitur | Model | Ukuran | Lisensi |
|---|---|---|---|
| Teks otomatis (subtitle) | Whisper (Cepat / Akurat / Terbaik) | 77–620 MB | MIT |
| Teks ke suara Indonesia | MMS-TTS (Meta) | ±110 MB | **CC BY-NC 4.0 (non-komersial)** |
| Hapus latar foto | MODNet | ±25 MB | Apache-2.0 |

- Model diunduh sekali saat pertama dipakai. Agar bisa offline, atau bila muncul "network error", jalankan **`UNDUH-MODEL-AI.bat`** dan pilih modelnya. File disimpan ke folder `models/` dan dipakai otomatis.
- **Teks otomatis online (Groq)**: lebih cepat dan akurat, tanpa unduh model.
  1. Daftar di https://console.groq.com, lalu buat API key (diawali `gsk_`).
  2. Buka **Teks otomatis → Mesin: Groq**, tempel key, lalu **Simpan**.
  3. Key disimpan di file `.groq-key` (tidak di browser, tidak ikut git). Audio hanya dikirim saat tombol *Buat teks otomatis* ditekan.
- Teks otomatis butuh suara orang berbicara/bernyanyi. Untuk video bisu, aplikasi menawarkan voice-over AI dari teks lalu subtitle.
- Hapus latar AI saat ini untuk **foto**. Hasil terbaik untuk foto orang.

## Penyimpanan project

- Project tersimpan otomatis di browser (**Project Saya**, lengkap dengan thumbnail).
- File media disimpan di IndexedDB browser.
- **Simpan ke file** menyimpan project sebagai `.json`. File media tidak ikut di dalam `.json`, jadi pilih ulang saat membuka di komputer lain.

## Struktur folder

```
START.bat              Jalankan aplikasi (server lokal + buka browser)
START-HP.bat           Jalankan server agar bisa dibuka dari HP di WiFi yang sama
server.js              Server lokal tanpa dependensi + penghubung Groq
index.html             Halaman aplikasi
css/style.css          Tampilan
js/app.js              Editor: render canvas, timeline, properti, export
js/asr-worker.js       Worker AI teks otomatis (Whisper)
js/tts-worker.js       Worker AI teks ke suara
js/rmbg-worker.js      Worker AI hapus latar (MODNet)
js/vendor/             transformers.js 3.0.2, mp4-muxer 5.1.3 (MIT)
UNDUH-MODEL-AI.bat     Unduh model AI ke folder models/
download-model.js      Skrip pengunduh model
models/                Model AI lokal (tidak ikut git)
manifest.webmanifest   Data install (PWA)
sw.js                  Service worker (offline)
icons/                 Ikon aplikasi
```

## Catatan

- Gunakan musik dan media yang kamu punya haknya.
- Proyek berat terasa patah-patah? Pilih **kualitas pratinjau ½ atau ¼** di bawah pemutar.
- Kalau export Presisi gagal, pilih *Lanjutan → Mesin export → Realtime*.
- Project lama dari versi "Editor Video Kata-Kata" tetap bisa dibuka. Susunan scene otomatis diubah menjadi lapisan teks.
