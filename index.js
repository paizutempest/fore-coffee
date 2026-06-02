import "dotenv/config";
import chalk from "chalk";
import gradient from "gradient-string";
import { input, select } from "@inquirer/prompts";
import { v4 } from "uuid";
import dayjs from "dayjs";

import { getRandomNumber, log } from "./src/utils.js";
import {
  getToken,
  checkPhone,
  reqLogin,
  signUp,
  addPin,
  updateProfile,
  fetchRandomUser,
} from "./src/api.js";
import { loadAccounts, saveAccount, formatAccountsTable } from "./src/storage.js";

function displayBanner() {
    console.clear();
    console.log(gradient(['#6F4E37', '#A67B5B', '#ECB176'])(`
    ███████╗ ██████╗ ██████╗ ███████╗    ██████╗ ██████╗ ███████╗███████╗███████╗███████╗
    ██╔════╝██╔═══██╗██╔══██╗██╔════╝   ██╔════╝██╔═══██╗██╔════╝██╔════╝██╔════╝██╔════╝
    █████╗  ██║   ██║██████╔╝█████╗     ██║     ██║   ██║█████╗  █████╗  █████╗  █████╗  
    ██╔══╝  ██║   ██║██╔══██╗██╔══╝     ██║     ██║   ██║██╔══╝  ██╔══╝  ██╔══╝  ██╔══╝  
    ██║     ╚██████╔╝██║  ██║███████╗   ╚██████╗╚██████╔╝██║     ██║     ███████╗███████╗
    ╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝    ╚═════╝ ╚═════╝ ╚═╝     ╚═╝     ╚══════╝╚══════╝
    FORE COFFEE AUTO SYSTEM
    By Paizutempest
    `));
}

// --- MAIN LOGIC ---

(async function main() {
    displayBanner();

    const menu = await select({
        message: 'Fore Coffee System Menu:',
        choices: [
            { name: '1. List Saved Accounts', value: 'list' },
            { name: '2. Register New Account (Manual OTP)', value: 'register' },
            { name: '3. Check Voucher Status', value: 'voucher' },
            { name: '0. Exit', value: 'exit' },
        ],
    });

    if (menu === 'exit') process.exit();

    if (menu === 'list') {
        const accounts = loadAccounts();
        if (!accounts) {
            log.warn("Belum ada akun terdaftar.");
        } else {
            console.log(formatAccountsTable(accounts));
        }
    }

    if (menu === 'register') {
        const phoneInput = await input({ message: "Masukkan Nomor HP (Contoh: 628xxx):" });
        const referral = await input({ message: "Masukkan Referral Code (Opsional):", default: "" });
        
        log.process("Inisialisasi Device & Token");
        const uuid = v4();
        const tokenRes = await getToken(uuid);
        
        if (!tokenRes.payload) {
            log.error("Gagal mendapatkan initial token.");
            return;
        }

        const accessToken = tokenRes.payload.access_token;
        log.success("Session Token Berhasil Dibuat");

        log.process(`Mengecek Status Nomor ${phoneInput}`);
        const check = await checkPhone(uuid, accessToken, phoneInput);

        if (check.payload?.is_registered === 1) {
            log.warn("Nomor sudah terdaftar! Gunakan menu login.");
            return;
        }

        log.process("Meminta Kode OTP ke Server Fore");
        const otpReq = await reqLogin(uuid, accessToken, phoneInput);

        if (otpReq.payload?.code) {
            log.info(`OTP telah dikirim via SMS/WhatsApp ke ${phoneInput}`);
            const otpCode = await input({ message: "Masukkan Kode OTP:" });

            log.process("Memproses Pendaftaran & Identitas Random");
            const rUser = await fetchRandomUser();
            const fullName = `${rUser.name.first} ${rUser.name.last}`;
            
            const regResult = await signUp(uuid, accessToken, phoneInput, fullName, otpCode, referral);

            if (regResult.payload?.text === "Success") {
                log.success(`Pendaftaran Berhasil! Halo, ${fullName}`);
                
                log.process("Mengatur Security PIN");
                await addPin(uuid, accessToken, process.env.DEFAULT_PIN);
                
                log.process("Melengkapi Profil & Email");
                const birth = dayjs().subtract(getRandomNumber(19, 25), 'year').format('YYYY-MM-DD');
                const randEmail = `${rUser.name.first.toLowerCase()}${getRandomNumber(100, 999)}@gmail.com`;
                await updateProfile(uuid, accessToken, fullName, randEmail, birth);

                const newAcc = {
                    phone: phoneInput,
                    name: fullName,
                    email: randEmail,
                    birthday: birth,
                    uuid: uuid,
                    access_token: accessToken,
                    pin: process.env.DEFAULT_PIN,
                    registered_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
                };

                saveAccount(newAcc);
                log.success("Data Akun Berhasil Disimpan ke accounts.json");
            } else {
                log.error(`Gagal Sign Up: ${JSON.stringify(regResult.payload)}`);
            }
        } else {
            log.error("Gagal meminta OTP. Coba beberapa saat lagi.");
        }
    }
    
    log.info("Proses Selesai. Kembali ke menu dalam 3 detik...");
    setTimeout(main, 3000);
})();
