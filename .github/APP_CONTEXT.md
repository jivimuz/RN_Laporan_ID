# Laporin ID: Application Context

Dokumen ini adalah peta teknis singkat untuk memahami struktur dan alur utama
aplikasi sebelum mengubah kode.

## Ringkasan

Laporin ID adalah aplikasi React Native berbasis Expo Router untuk mencatat
laporan transaksi. Laporan disimpan secara lokal di perangkat dan dapat
disinkronkan ke Google Spreadsheet melalui endpoint Google Apps Script.

## Stack dan Konfigurasi

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript strict mode
- Expo Router dengan typed routes
- Alias import `@/*` mengarah ke root project
- Android package: `com.laporin.id`
- iOS bundle identifier: `com.laporin.id`

## Peta Navigasi

```text
app/index.tsx
├── /onboarding  # Jika nama pelapor belum tersimpan
└── /home        # Jika nama pelapor sudah tersimpan
    └── /setting # Dibuka dari tombol pengaturan di Home
```

### Root flow

`app/index.tsx` membaca nama pelapor dari `services/userService.ts`. Selama
proses membaca, tampilkan loading. Setelah selesai, arahkan pengguna ke
`/onboarding` atau `/home`; jangan menambahkan logika bisnis laporan di file
ini.

### Onboarding

`app/onboarding/index.tsx` memvalidasi nama tidak kosong, menyimpannya melalui
`saveUserName`, lalu mengganti route ke `/home`.

### Home

`app/home/index.tsx` adalah layar utama dan saat ini menampung:

- pemuatan nama dan laporan;
- filter tahun dan bulan;
- ringkasan total bulan aktif dan saldo keseluruhan;
- modal create, detail, edit, dan konfirmasi delete;
- pemanggilan CRUD dari `services/storage.ts`.

Nilai transaksi `in` menambah total, sedangkan `out` mengurangi total. Laporan
yang memiliki `deletedAt` tidak ditampilkan sebagai laporan aktif.

### Settings

`app/setting/index.tsx` mengelola:

- perubahan nama pelapor;
- URL Web App / endpoint Google Apps Script;
- nama sheet target;
- sinkronisasi manual;
- export laporan aktif ke file Excel;
- waktu sinkronisasi terakhir;
- tutorial dan penyalinan script Apps Script.

## Model Data

Model utama ada di `types/index.ts`:

```ts
Report {
  id: string
  title: string
  description: string
  category: string
  transactionType: "in" | "out"
  is_sinc: 0 | 1
  syncedSheet: string | null
  amount?: number
  date: string // YYYY-MM-DD
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}
```

`ReportFormData` adalah subset data laporan untuk create/update. Field teknis
seperti `id`, timestamp, status sync, dan nama sheet diisi oleh service storage.

## Service dan Persistence

### `services/storage.ts`

Modul ini adalah satu-satunya lapisan untuk operasi laporan:

- `getReports`: membaca, menormalisasi, dan memperbaiki data rusak;
- `createReport`: membuat ID dan timestamp;
- `updateReport`: memperbarui data dan mengembalikan status menjadi unsynced;
- `deleteReport`: soft delete dengan `deletedAt`;
- `getActiveReports`: mengambil laporan yang belum dihapus;
- `getReportsByMonth`: memfilter berdasarkan `YYYY-MM-DD`;
- `getUnsyncedReports` dan `markReportsAsSynced`: mengatur status sinkronisasi;
- `getAllReportsJson`: ekspor data laporan sebagai JSON.

Key AsyncStorage laporan adalah `reports_data`. Setiap perubahan laporan
menjadwalkan auto-sync dengan debounce 1200 ms. Error auto-sync tidak menghapus
data lokal; laporan tetap berstatus belum tersinkron.

### `services/userService.ts`

Nama pelapor disimpan menggunakan Expo SecureStore dengan key `user_name`.
Gunakan service ini, bukan akses SecureStore langsung dari layar lain.

### `services/spreadsheetService.ts`

Konfigurasi spreadsheet memakai AsyncStorage:

- `spreadsheet_sync_url`
- `spreadsheet_sync_name`

Service mengirim request `POST` berisi `sheetName`, `headers`, `keyField`, dan
`rows`. `created_at` adalah key idempotensi untuk memperbarui baris yang sudah
ada. Jika nama sheet kosong, nama otomatis memakai format `YYYY-MM`.

## Kontrak Spreadsheet

Header row yang dikirim ke endpoint harus tetap kompatibel dengan Apps Script:

```text
Tujuan
Tipe (in/out)
Kategori
Nominal
Tanggal
User
created_at
updated_at
deleted_at
```

Saat mengubah field `SpreadsheetRow` atau payload, perbarui juga snippet
`APPS_SCRIPT_SNIPPET` di `app/setting/index.tsx` dan dokumentasi README.

## Export Excel

`services/exportService.ts` membuat workbook `.xlsx` dari seluruh laporan aktif,
menulisnya ke direktori dokumen aplikasi, lalu membuka native share sheet.
Import `expo-sharing` dilakukan saat export diminta agar Settings tetap dapat
dibuka di Expo Go atau binary lama. Export tidak mengubah status sinkronisasi
dan tidak menghapus data lokal.

## Google AdMob

AdMob menggunakan plugin `react-native-google-mobile-ads` di `app.json`.
Android memakai App ID produksi dan iOS sementara memakai App ID test resmi
Google sampai App ID produksi iOS tersedia.
`components/banner-ad.tsx` menampilkan banner pada native build, sedangkan
`components/banner-ad.web.tsx` menonaktifkannya untuk web. `services/adService.ts`
menyediakan helper interstitial dan rewarded.

Banner memakai Ad Unit ID produksi, sedangkan interstitial dan rewarded masih
memakai `TestIds.*`. Banner ditampilkan di Home dan area Data pada Pengaturan,
sebelum aksi sync/export. Lakukan EAS/development build karena Expo Go tidak
memuat native module AdMob. Komponen banner hanya melewati Expo Go agar route
tetap aman.

## Aturan Perubahan

1. Ikuti pemisahan tanggung jawab: UI di `app/`, persistence di `services/`,
   dan kontrak data di `types/`.
2. Gunakan alias `@/` untuk import internal baru.
3. Pertahankan format tanggal laporan `YYYY-MM-DD`; parsing dilakukan sebagai
   waktu lokal untuk menghindari pergeseran tanggal akibat UTC.
4. Jangan menghapus data laporan secara permanen tanpa mengubah desain soft
   delete dan alur sinkronisasi.
5. Setiap create/update/delete harus mempertahankan status unsynced agar
   perubahan dapat dikirim ke spreadsheet.
6. Jangan menaruh URL endpoint, kredensial, atau secret di source code.
7. Setelah perubahan TypeScript/React Native, jalankan `npm run lint`.

## Checklist Membaca Perubahan

Sebelum mengubah fitur laporan, periksa:

1. layar terkait di `app/`;
2. tipe terkait di `types/index.ts`;
3. service persistence atau sinkronisasi;
4. efek terhadap status `is_sinc`, `syncedSheet`, dan `deletedAt`;
5. README dan snippet Apps Script bila kontrak pengguna berubah.
