import "dotenv/config";
import chalk from "chalk";
import gradient from "gradient-string";
import { input, select } from "@inquirer/prompts";
import fetch from "node-fetch";
import { v4 } from "uuid";
import fs from "fs";
import { table } from "table";
import dayjs from "dayjs";

// Random Number
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Display Luxury Banner
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
    By Paizutempest x Yaelanit
    `));
}

// Log System
const log = {
    info: (msg) => console.log(`${chalk.blue('ℹ')} [${dayjs().format('HH:mm:ss')}] ${msg}`),
    success: (msg) => console.log(`${chalk.green('✔')} [${dayjs().format('HH:mm:ss')}] ${msg}`),
    warn: (msg) => console.log(`${chalk.yellow('⚠')} [${dayjs().format('HH:mm:ss')}] ${msg}`),
    error: (msg) => console.log(`${chalk.red('✖')} [${dayjs().format('HH:mm:ss')}] ${msg}`),
    process: (msg) => console.log(`${chalk.magenta('⚙')} [${dayjs().format('HH:mm:ss')}] ${chalk.italic(msg)}...`)
};

// --- CORE FUNCTIONS ---

const getHeaders = (deviceId, accessToken = null) => {
    const headers = {
        "Host": "api.fore.coffee",
        "Content-Type": "application/json",
        "Accept": "*/*",
        "App-Version": process.env.FORE_VERSION,
        "Device-Id": deviceId,
        "Platform": "android",
        "User-Agent": "okhttp/4.11.0",
        "Os-Version": "13",
        "Accept-Language": "id-ID;q=1.0, en-ID;q=0.9",
        "Accept-Encoding": "gzip, deflate, br"
    };
    if (accessToken) {
        headers["Access-Token"] = accessToken;
        headers["Country-Id"] = "1";
        headers["Language"] = "ID";
        headers["Timezone"] = "+07:00";
    } else {
        headers["Secret-Key"] = "0kFe6Oc3R1eEa2CpO2FeFdzElp";
    }
    return headers;
};

const getToken = async (deviceId) => {
    const res = await fetch("https://api.fore.coffee/auth/get-token", { headers: getHeaders(deviceId) });
    return res.json();
};

const checkPhone = async (deviceId, token, phone) => {
    const res = await fetch("https://api.fore.coffee/auth/check-phone", {
        method: "POST",
        headers: getHeaders(deviceId, token),
        body: JSON.stringify({ phone: `+${phone}` })
    });
    return res.json();
};

const reqLogin = async (deviceId, token, phone) => {
    const res = await fetch("https://api.fore.coffee/auth/req-login-code", {
        method: "POST",
        headers: getHeaders(deviceId, token),
        body: JSON.stringify({ method: "", phone: `+${phone}` })
    });
    return res.json();
};

const signUp = async (deviceId, token, phone, name, otp, referral) => {
    const res = await fetch("https://api.fore.coffee/auth/sign-up", {
        method: "POST",
        headers: getHeaders(deviceId, token),
        body: JSON.stringify({
            whatsapp: 0,
            phone: `+${phone}`,
            name: name,
            code: otp,
            referral_code: referral
        })
    });
    return res.json();
};

const addPin = async (deviceId, token, pin) => {
    const res = await fetch("https://api.fore.coffee/auth/pin", {
        method: "POST",
        headers: getHeaders(deviceId, token),
        body: JSON.stringify({ confirm_pin: pin, pin: pin })
    });
    return res.json();
};

const updateProfile = async (deviceId, token, name, email, birthday) => {
    const res = await fetch("https://api.fore.coffee/user/profile", {
        method: "PUT",
        headers: getHeaders(deviceId, token),
        body: JSON.stringify({ user_name: name, user_email: email, user_birthday: birthday })
    });
    return res.json();
};

const profileDetail = async (deviceId, token) => {
    // Generate tanggal kemarin secara otomatis (Real-time Precision)
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD 00:00:00');
    const encodedDate = encodeURIComponent(yesterday);
    
    // Inject encodedDate ke dalam URL template literal
    const url = `https://api.fore.coffee/user/profile/detail?last_seen=${encodedDate}`;
    
    log.process(`Sync Profile Data - Last Seen: ${yesterday}`);

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: getHeaders(deviceId, token)
        });

        const response = await res.json();

        if (response.payload) {
            log.success(`Data Berhasil Sinkron! User: ${chalk.cyan(response.payload.user_name)} | Point: ${chalk.yellow(response.payload.user_point)}`);
        } else {
            log.warn(`Respon Fore: ${response.message || 'Data profile tidak ditemukan'}`);
        }

        return response;
    } catch (error) {
        log.error(`Gagal Fetch Profile: ${error.message}`);
        return null;
    }
};

const fetchRandomUser = async () => {
    const res = await fetch("https://randomuser.me/api?nat=id");
    const data = await res.json();
    return data.results[0];
};

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
        if (!fs.existsSync("accounts.json")) {
            log.warn("Belum ada akun terdaftar.");
        } else {
            const accounts = JSON.parse(fs.readFileSync("accounts.json", "utf8"));
            const data = accounts.map(a => [a.phone, a.name, a.email, a.point || 0]);
            console.log(table([["Phone", "Name", "Email", "Points"], ...data]));
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

                // Save to JSON
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

                let accounts = [];
                if (fs.existsSync("accounts.json")) accounts = JSON.parse(fs.readFileSync("accounts.json"));
                accounts.push(newAcc);
                fs.writeFileSync("accounts.json", JSON.stringify(accounts, null, 2));
                
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
