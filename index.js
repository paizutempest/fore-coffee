import "dotenv/config";
import gradient from "gradient-string";
import { input, select } from "@inquirer/prompts";
import { v4 } from "uuid";
import { table } from "table";
import dayjs from "dayjs";

import log from "./utils/logger.js";
import {
  getToken,
  checkPhone,
  reqLogin,
  signUp,
  addPin,
  updateProfile,
} from "./utils/api.js";
import { loadAccounts, saveAccount } from "./utils/accounts.js";
import { fetchRandomUser, generateRandomIdentity } from "./utils/helpers.js";

function displayBanner() {
  console.clear();
  console.log(
    gradient(["#6F4E37", "#A67B5B", "#ECB176"])(`
    ███████╗ ██████╗ ██████╗ ███████╗    ██████╗ ██████╗ ███████╗███████╗███████╗███████╗
    ██╔════╝██╔═══██╗██╔══██╗██╔════╝   ██╔════╝██╔═══██╗██╔════╝██╔════╝██╔════╝██╔════╝
    █████╗  ██║   ██║██████╔╝█████╗     ██║     ██║   ██║█████╗  █████╗  █████╗  █████╗  
    ██╔══╝  ██║   ██║██╔══██╗██╔══╝     ██║     ██║   ██║██╔══╝  ██╔══╝  ██╔══╝  ██╔══╝  
    ██║     ╚██████╔╝██║  ██║███████╗   ╚██████╗╚██████╔╝██║     ██║     ███████╗███████╗
    ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝    ╚═════╝ ╚═════╝ ╚═╝     ╚═╝     ╚══════╝╚══════╝
    FORE COFFEE AUTO SYSTEM
    By Paizutempest
    `)
  );
}

(async function main() {
  displayBanner();

  const menu = await select({
    message: "Fore Coffee System Menu:",
    choices: [
      { name: "1. List Saved Accounts", value: "list" },
      { name: "2. Register New Account (Manual OTP)", value: "register" },
      { name: "3. Check Voucher Status", value: "voucher" },
      { name: "0. Exit", value: "exit" },
    ],
  });

  if (menu === "exit") process.exit();

  if (menu === "list") {
    const accounts = loadAccounts();
    if (!accounts) {
      log.warn("Belum ada akun terdaftar.");
    } else {
      const data = accounts.map((a) => [a.phone, a.name, a.email, a.point || 0]);
      console.log(table([["Phone", "Name", "Email", "Points"], ...data]));
    }
  }

  if (menu === "register") {
    const phoneInput = await input({
      message: "Masukkan Nomor HP (Contoh: 628xxx):",
    });
    const referral = await input({
      message: "Masukkan Referral Code (Opsional):",
      default: "",
    });

    log.process("Inisialisasi Device & Token");
    const uuid = v4();
    const tokenRes = await getToken(uuid);

    if (!tokenRes?.payload) {
      log.error("Gagal mendapatkan initial token.");
      return;
    }

    const accessToken = tokenRes.payload.access_token;
    log.success("Session Token Berhasil Dibuat");

    log.process(`Mengecek Status Nomor ${phoneInput}`);
    const check = await checkPhone(uuid, accessToken, phoneInput);

    if (check?.payload?.is_registered === 1) {
      log.warn("Nomor sudah terdaftar! Gunakan menu login.");
      return;
    }

    log.process("Meminta Kode OTP ke Server Fore");
    const otpReq = await reqLogin(uuid, accessToken, phoneInput);

    if (otpReq?.payload?.code) {
      log.info(`OTP telah dikirim via SMS/WhatsApp ke ${phoneInput}`);
      const otpCode = await input({ message: "Masukkan Kode OTP:" });

      log.process("Memproses Pendaftaran & Identitas Random");
      const rUser = await fetchRandomUser();
      const { fullName, birthday, email } = generateRandomIdentity(rUser);

      const regResult = await signUp(
        uuid,
        accessToken,
        phoneInput,
        fullName,
        otpCode,
        referral
      );

      if (regResult?.payload?.text === "Success") {
        log.success(`Pendaftaran Berhasil! Halo, ${fullName}`);

        log.process("Mengatur Security PIN");
        await addPin(uuid, accessToken, process.env.DEFAULT_PIN);

        log.process("Melengkapi Profil & Email");
        await updateProfile(uuid, accessToken, fullName, email, birthday);

        saveAccount({
          phone: phoneInput,
          name: fullName,
          email,
          birthday,
          uuid,
          access_token: accessToken,
          pin: process.env.DEFAULT_PIN,
          registered_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
        });

        log.success("Data Akun Berhasil Disimpan ke accounts.json");
      } else {
        log.error(`Gagal Sign Up: ${JSON.stringify(regResult?.payload)}`);
      }
    } else {
      log.error("Gagal meminta OTP. Coba beberapa saat lagi.");
    }
  }

  log.info("Proses Selesai. Kembali ke menu dalam 3 detik...");
  setTimeout(main, 3000);
})();
