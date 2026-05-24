# ☕ FORE COFFEE AUTO SYSTEM v1.1

[![Node.js Version](https://img.shields.io/badge/node->%3D18.0.0-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Author](https://img.shields.io/badge/developer-Paizutempest-orange.svg)](https://github.com/paizutempest)

**FORE COFFEE AUTO SYSTEM** adalah skrip otomasi berbasis Node.js yang dirancang dengan presisi ultra untuk mengelola pendaftaran akun baru secara massal (*bulk registration*), melakukan sinkronisasi data profil secara real-time, serta memanfaatkan skema referral otomatis pada platform Fore Coffee.

---

## 🚀 Fitur Utama

* **Ultra Precision Registration:** Alur pendaftaran akun baru otomatis dengan pengisian kode OTP secara manual.
* **Manual Identity Injection:** Integrasi otomatis dengan API RandomUser untuk menghasilkan nama, email acak Indonesia, dan tanggal lahir dinamis (usia 19-25 tahun) guna menghindari deteksi anomali.
* **Security Gate Automated:** Otomatisasi pengaturan Security PIN akun baru menggunakan parameter pengaman terpusat.
* **Real-time Profile Synchronizer:** Menggunakan sinkronisasi data presisi berbasis waktu (*last seen yesterday*) untuk membaca poin, voucher, dan status akun terbaru.
* **Encrypted Local Database:** Penyimpanan otomatis seluruh data akun, token sesi (`access_token`), dan UUID perangkat ke dalam file lokal `accounts.json`.

---

## 🛠️ Modul & Jaringan Stack

Skrip ini dibangun menggunakan pustaka modern berkinerja tinggi:
* `@inquirer/prompts` - Antarmuka menu interaktif berbasis terminal.
* `node-fetch` - Mesin HTTP Request penembak API endpoint Fore.
* `uuid` - Pembuat sidik jari Device ID (`v4`) unik per akun.
* `dayjs` - Manajemen manipulasi waktu dan tanggal lahir dinamis.
* `gradient-string` & `chalk` - Desain visual konsol log mewah.
* `table` - Struktur penataan tabel akun harian yang rapi.

---

## 📦 Persyaratan Sistem

* Node.js v18.x atau versi yang lebih baru.
* NPM (Node Package Manager).

---

## ⚙️ Instalasasi & Struktur Kunci

1. Clone repositori ini ke dalam server VPS atau komputer lokal Anda:
   ```bash
   git clone [https://github.com/paizutempest/fore-coffee.git](https://github.com/paizutempest/fore-coffee.git)
   cd fore-coffee
