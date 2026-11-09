# Laporin ID

Aplikasi mobile untuk mencatat laporan transaksi secara sederhana, menyimpannya
di perangkat, dan menyinkronkannya ke Google Spreadsheet.

## Fitur

- Onboarding dengan penyimpanan nama pelapor secara aman.
- Membuat, melihat, mengubah, dan menghapus laporan.
- Jenis transaksi `in` dan `out`.
- Kategori, tujuan, deskripsi, nominal, dan tanggal laporan.
- Filter laporan berdasarkan bulan.
- Ringkasan total transaksi pada bulan aktif dan saldo keseluruhan.
- Penyimpanan lokal menggunakan AsyncStorage sehingga data tetap tersedia tanpa
  koneksi.
- Sinkronisasi laporan yang belum tersinkron ke Google Spreadsheet melalui
  endpoint Google Apps Script.
- Export seluruh laporan aktif ke file Excel `.xlsx` dari halaman Pengaturan.
- Integrasi Google AdMob dengan banner serta helper interstitial dan rewarded.
- Nama sheet dapat ditentukan sendiri atau dibuat otomatis dengan format
  `YYYY-MM`.
- Tema navigasi dan tampilan berbasis Expo Router.

## Teknologi

- React Native 0.81 dan React 19
- Expo SDK 54
- TypeScript
- Expo Router dengan file-based routing
- AsyncStorage untuk data laporan dan konfigurasi spreadsheet
- Expo SecureStore untuk nama pelapor
- EAS untuk build dan distribusi aplikasi

## Struktur Modul

```text
app/
├── index.tsx             # Mengecek profil lalu mengarahkan ke onboarding/home
├── onboarding/index.tsx  # Form nama pelapor
├── home/index.tsx        # Daftar, ringkasan, dan CRUD laporan
├── setting/index.tsx     # Profil dan konfigurasi/sinkronisasi spreadsheet
└── _layout.tsx           # Root layout, tema, dan status bar

services/
├── storage.ts            # CRUD, filter, dan antrean auto-sync laporan
├── userService.ts        # Penyimpanan nama pelapor
└── spreadsheetService.ts # Konfigurasi dan sinkronisasi Google Spreadsheet

types/index.ts            # Tipe Report, User, dan ReportFormData
components/               # Komponen UI reusable
constants/                # Konstanta tema
hooks/                    # Custom hooks
```

Dokumentasi context teknis untuk memahami alur dan kontrak antar-modul tersedia
di [`.github/APP_CONTEXT.md`](./.github/APP_CONTEXT.md).

## Menjalankan Project

Prasyarat: Node.js dan perangkat/simulator yang mendukung Expo.

```bash
npm install
npm run start
```

Setelah Expo berjalan, pilih target dari terminal atau buka QR code dengan Expo
Go. Perintah target yang tersedia:

```bash
npm run android
npm run ios
npm run web
```

## Perintah NPM

| Perintah | Keterangan |
| --- | --- |
| `npm run start` | Menjalankan Expo dengan cache yang dibersihkan |
| `npm run android` | Menjalankan aplikasi pada Android |
| `npm run ios` | Menjalankan aplikasi pada iOS |
| `npm run web` | Menjalankan aplikasi versi web |
| `npm run lint` | Menjalankan ESLint |
| `npm run reset-project` | Mereset starter project Expo |

## Sinkronisasi Google Spreadsheet

Sinkronisasi bersifat opsional. Data tetap disimpan secara lokal apabila URL
endpoint belum dikonfigurasi. Untuk mengaktifkannya:

1. Buat Google Spreadsheet dan buka **Extensions > Apps Script**.
2. Buat Web App yang menerima request `POST` dan mengolah payload laporan.
3. Deploy sebagai Web App, lalu salin URL yang berakhiran `/exec`.
4. Buka menu **Pengaturan** di aplikasi.
5. Isi **URL Web App / Endpoint** dan, bila diperlukan, **Nama Sheet / Tab**.
6. Simpan target, lalu pilih **Sinkron ke Spreadsheet**.

Jika nama sheet dikosongkan, laporan dikelompokkan ke tab berdasarkan bulan,
misalnya `2026-11`. Setiap laporan dikirim dengan kolom:

`Tujuan`, `Tipe (in/out)`, `Kategori`, `Nominal`, `Tanggal`, `User`,
`created_at`, `updated_at`, dan `deleted_at`.

Perubahan laporan akan ditandai sebagai belum tersinkron dan dijadwalkan untuk
auto-sync. Sinkronisasi manual dapat dijalankan dari halaman Pengaturan.

## Build dengan EAS

Konfigurasi build tersedia di `eas.json` untuk profil `development`, `preview`,
dan `production`.

```bash
npx eas login
npx eas build --platform android
npx eas build --platform ios
```

Gunakan profil tertentu bila diperlukan:

```bash
npx eas build --profile preview --platform android
```

Pastikan akun Expo, bundle identifier, dan konfigurasi platform sudah sesuai
sebelum membuat build rilis.

## Google AdMob

AdMob dikonfigurasi melalui plugin `react-native-google-mobile-ads`. App ID
Android produksi ada di `app.json`, sedangkan iOS saat ini memakai test App ID
resmi Google sampai App ID produksi iOS tersedia. Banner menggunakan Ad Unit ID
produksi yang dikonfigurasi di `components/banner-ad.tsx`; interstitial dan
rewarded masih menggunakan test ad unit ID dari Google SDK.

Karena AdMob membutuhkan native code, jalankan aplikasi menggunakan development
build atau EAS build, bukan Expo Go:

```bash
npx expo prebuild
npx expo run:android
```

Jika menjalankan `npx expo start` di Expo Go, banner sengaja tidak ditampilkan
agar aplikasi tidak crash karena native module AdMob tidak ada di Expo Go.

Banner sudah ditampilkan di halaman Home. Helper `showInterstitialAd` dan
`showRewardedAd` tersedia di `services/adService.ts` untuk dipanggil pada alur
yang memiliki konteks yang tepat.

## Preview

<img src="./preview.jpeg" alt="Preview aplikasi Laporin ID" width="300" />
