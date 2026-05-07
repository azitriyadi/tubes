# ♻️ EcoRecycle - Smart E-Waste Reverse Logistics (V1.0)

EcoRecycle adalah platform inovatif yang dirancang untuk mengelola rantai pasok terbalik (reverse logistics) khusus sampah elektronik (e-waste). Platform ini memfasilitasi siklus hidup produk elektronik mulai dari akhir penggunaan (end-of-life) hingga proses daur ulang yang bertanggung jawab, sambil memberikan insentif ekonomi kepada pengguna.

---

## 📖 Deskripsi Proyek
Masalah sampah elektronik (e-waste) global terus meningkat. EcoRecycle hadir sebagai jembatan antara konsumen (Eco Warriors) dan fasilitas pengolahan sampah (Collectors). Dengan sistem pelacakan berbasis tracking number unik dan integrasi reward otomatis, kita dapat memastikan e-waste tidak berakhir di TPA, melainkan didaur ulang secara efisien.

---

## 🏗️ Arsitektur & Teknologi

### Tech Stack
- **Backend**: PHP 7.4/8.x (Native MVC Architecture)
- **Database**: MySQL / MariaDB
- **Frontend**: HTML5, Vanilla CSS3 (Modern Tech Design), JavaScript (Vanilla ES6)
- **Libraries**: SweetAlert2 (Notifications), Leaflet.js (Mapping), Chart.js (Analytics), FontAwesome 6 (Icons)

### Struktur Folder
```text
/logistikita_tubes
├── app/
│   ├── Config/         # Konfigurasi Database & Global
│   ├── Controllers/    # Handler API & Logika Bisnis (MVC)
│   ├── Models/         # Abstraksi Data & Query SQL (MVC)
│   └── Views/          # Template HTML (Landing, Dashboard, Admin, Collector)
├── assets/
│   ├── css/            # UI Styling (style.css, admin.css, kurir.css)
│   ├── js/             # Frontend Logic (home.js, dashboard.js, admin.js)
│   └── images/         # Aset Gambar & Media
├── index.php           # Front Controller & API Router
├── setup.php           # Database Auto-Installer
└── README.md           # Dokumentasi Teknis
```

---

## 🗄️ Skema Database (Smart Schema)
Aplikasi ini menggunakan database `ecorecycle` dengan tabel-tabel berikut:

1.  **`users`**: Menyimpan data Eco Warriors, Collectors, dan Admin.
2.  **`waste_categories`**: Master data kategori sampah (Gadget, Battery, Laptop) beserta rate reward per Kg.
3.  **`pickups`**: Tabel utama transaksi penjemputan sampah.
4.  **`pickup_history`**: Log pelacakan status penjemputan (Timeline).
5.  **`transactions`**: Integrasi keuangan (Payouts) hasil reward.

---

## 🚀 Panduan Instalasi (Step-by-Step)

### 1. Persiapan Environment
- Pastikan Anda menggunakan **XAMPP** atau server PHP lainnya.
- Clone/Copy folder ini ke dalam direktori `C:/xampp/htdocs/progress_tubes/logistikita_tubes/`.

### 2. Konfigurasi Database Otomatis
Buka browser dan akses alamat berikut:
`http://localhost/progress_tubes/logistikita_tubes/setup.php`
> [!IMPORTANT]
> Script ini akan secara otomatis membuat database `ecorecycle`, membuat semua tabel yang diperlukan, dan mengisi data awal (seeding) termasuk kategori sampah dan akun demo.

### 3. Akses Aplikasi
- **Landing Page**: `http://localhost/progress_tubes/logistikita_tubes/`
- **Login**: `http://localhost/progress_tubes/logistikita_tubes/login`

---

## 🛠️ Dokumentasi API (Web Service)

### 1. Autentikasi
#### **Register Akun Baru**
- **Endpoint**: `POST /api/auth/register`
- **Payload**:
  ```json
  {
    "name": "Fiqry F",
    "email": "fiqry@eco.com",
    "password": "password123",
    "role": "user"
  }
  ```

#### **Login System**
- **Endpoint**: `POST /api/auth/login`
- **Response**: Mengembalikan token profil user.

---

### 2. Pengelolaan E-Waste
#### **Estimasi Reward**
Menghitung perkiraan rupiah yang akan diterima pengguna.
- **Endpoint**: `POST /api/ecorecycle/estimate_reward`
- **Payload**: `{"category": "Computers", "weight_kg": 5.5}`
- **Logic**: `Reward = (Weight * Category_Rate) - (5% Processing Fee)`

#### **Request Pickup**
Mengajukan penjemputan sampah ke alamat pengguna.
- **Endpoint**: `POST /api/ecorecycle/request_pickup`
- **Payload**:
  ```json
  {
    "user_id": 1,
    "item_description": "Laptop rusak & charger",
    "pickup_address": "Jl. Ganesha No. 10, Bandung",
    "contact_phone": "08123456789",
    "weight_kg": 3.2,
    "category": "Computers"
  }
  ```
- **Response**: Mengembalikan `tracking_number` (Contoh: `ECR-20240507-X12A`).

---

### 3. Pelacakan & Logistik
#### **Update Status (Oleh Kolektor)**
- **Endpoint**: `POST /api/ecorecycle/pickup_status`
- **Payload**:
  ```json
  {
    "tracking_number": "ECR-20240507-X12A",
    "status": "transit",
    "location": "Gudang Transit Bandung Tengah",
    "notes": "Sampah telah dijemput dan diverifikasi"
  }
  ```

#### **Cek Riwayat Pickup**
- **Endpoint**: `GET /api/ecorecycle/list_pickups?type=user&user_id=1`

---

## 🔄 Alur Kerja Sistem (Full Workflow)

1.  **Donasi**: User melakukan `request_pickup` melalui dashboard.
2.  **Verifikasi**: Admin melihat permohonan di Control Center dan menugaskan Kolektor.
3.  **Pickup**: Kolektor menuju lokasi, memverifikasi berat sampah, dan mengupdate status menjadi `transit` atau `completed`.
4.  **Reward**: Setelah status `completed`, sistem secara otomatis memproses Payout melalui integrasi `SmartBank`.
5.  **Selesai**: User menerima dana di saldo digital mereka.

---

## 📊 Dashboard Roles
- **Eco Warrior (User)**: Request pickup, cek estimasi reward, lacak status e-waste.
- **Expert Collector (Kurir)**: Terima tugas pickup, navigasi ke lokasi, update status barang.
- **Eco Admin**: Monitoring semua transaksi, manajemen armada, validasi pembayaran reward.

---

## 🛠️ Pemecahan Masalah (Troubleshooting)
- **Database tidak terdeteksi**: Jalankan kembali `setup.php`.
- **Gagal Login**: Pastikan role yang dipilih saat login sesuai dengan data di tabel `users`.
- **API Error 404**: Pastikan file `.htaccess` aktif (jika menggunakan Apache) atau routing di `index.php` tidak terhapus.

---
**EcoRecycle Project** - *Smart Logistics for a Greener Future.*
Dibuat dengan ❤️ untuk lingkungan yang lebih bersih.
