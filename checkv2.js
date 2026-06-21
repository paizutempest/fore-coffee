require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const chalk = require('chalk');
const QRCode = require('qrcode');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

process.on('uncaughtException', (err) => {
    try { console.error(`[UNCAUGHT] ${err && err.message ? err.message : err}`); } catch (e) {}
});
process.on('unhandledRejection', (reason) => {
    try { console.error(`[UNHANDLED_REJECTION] ${reason && reason.message ? reason.message : reason}`); } catch (e) {}
});
bot.on('polling_error', (err) => {
    try { console.error(`[POLLING_ERROR] ${err && err.message ? err.message : err}`); } catch (e) {}
});
bot.on('error', (err) => {
    try { console.error(`[BOT_ERROR] ${err && err.message ? err.message : err}`); } catch (e) {}
});
async function safeAnswerCallback(queryId, options = {}) {
    if (!queryId || String(queryId).startsWith('synthetic')) return;
    try { await bot.answerCallbackQuery(queryId, options); }
    catch (e) {  }
}
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  },
  realtime: {
    transport: WebSocket
  }
});

const ADMIN_ID = parseInt(process.env.ADMIN_ID || "559991935");
const userState = {};
const rateBuckets = new Map();
const RATE_CAPACITY = parseInt(process.env.RATE_CAPACITY || "8");
const RATE_REFILL_MS = parseInt(process.env.RATE_REFILL_MS || "10000");
function checkRateLimit(userId) {
    const key = String(userId);
    const now = Date.now();
    let b = rateBuckets.get(key);
    if (!b) { b = { tokens: RATE_CAPACITY, ts: now }; rateBuckets.set(key, b); }
    const elapsed = now - b.ts;
    const refill = (elapsed / RATE_REFILL_MS) * RATE_CAPACITY;
    b.tokens = Math.min(RATE_CAPACITY, b.tokens + refill);
    b.ts = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
}
const USERSTATE_TTL_MS = 30 * 60 * 1000;
function touchUserState(userId) {
    if (userState[userId]) userState[userId]._lastSeen = Date.now();
}
setInterval(() => {
    const now = Date.now();
    let cleared = 0;
    for (const uid of Object.keys(userState)) {
        const st = userState[uid];
        const last = st && st._lastSeen ? st._lastSeen : 0;
        if (!last || (now - last) > USERSTATE_TTL_MS) {
            delete userState[uid];
            cleared++;
        }
    }
    if (cleared > 0) logger.engine("SYSTEM", `Sweeper: ${cleared} userState basi dibersihkan.`, "INFO");
}, 5 * 60 * 1000);
const PAKASIR_SLUG = process.env.PAKASIR_SLUG;
const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const logger = {
    info: (userId, action, msg) => {
        console.log(`\x1b[1m\x1b[38;5;45m[USER-${userId}]\x1b[0m \x1b[38;5;250m|\x1b[0m \x1b[1m\x1b[38;5;214m${action.padEnd(12)}\x1b[0m \x1b[38;5;250m|\x1b[0m ${msg}`);
    },
    db: (type, table, status) => {
        const color = status.includes("ERR") || status.includes("FAIL") ? "\x1b[41m" : "\x1b[42m";
        console.log(`\x1b[1m${color}\x1b[30m ${type.padEnd(8)} \x1b[0m \x1b[38;5;82mTable: ${table.padEnd(15)}\x1b[0m \x1b[38;5;250m?\x1b[0m ${status}`);
    },
    engine: (user, msg, type = 'INFO') => {
        const time = new Date().toLocaleTimeString();
        const colors = { INFO: '\x1b[36m', SUCCESS: '\x1b[32m', ERR: '\x1b[31m', WARN: '\x1b[33m' };
        console.log(`${colors[type] || ''}[${time}] [${type}] [${user}] » ${msg}\x1b[0m`);
    }
};

const pathMod = require('path');
const fsMod = require('fs');
const ORDERS_FILE = process.env.ORDERS_FILE || pathMod.join(__dirname, 'orders.json');
function saveOrderRecord(record) {
    let list = [];
    try {
        if (fsMod.existsSync(ORDERS_FILE)) {
            const raw = fsMod.readFileSync(ORDERS_FILE, 'utf8').trim();
            if (raw) list = JSON.parse(raw);
            if (!Array.isArray(list)) list = [];
        }
    } catch (e) {
        logger.engine("ORDER_SAVE", `Gagal baca orders.json: ${e.message}`, "WARN");
        list = [];
    }
    list.unshift(record);
    if (list.length > 5000) list = list.slice(0, 5000);
    try {
        fsMod.writeFileSync(ORDERS_FILE, JSON.stringify(list, null, 2), 'utf8');
        logger.db("WRITE", "orders.json", `SUCCESS: ${record.order_id}`);
    } catch (e) {
        logger.engine("ORDER_SAVE", `Gagal tulis orders.json: ${e.message}`, "ERR");
    }
}

function isCookieAgeValid(createdAtStr) {
    const createdDate = new Date(createdAtStr);
    const currentDate = new Date();

    const timeDiff = currentDate.getTime() - createdDate.getTime();
    const daysDiff = timeDiff / (1000 * 3600 * 24);

    return daysDiff <= 3;
}
function getDeepIdentity() {
    const devices = [
        { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', platform: 'Windows' },
        { ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', platform: 'MacIntel' },
        { ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', platform: 'Linux x86_64' },

        { ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36', platform: 'Linux armv8l' },
        { ua: 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36', platform: 'Linux armv8l' },
        { ua: 'Mozilla/5.0 (Linux; Android 12; M2101K6G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36', platform: 'Linux armv8l' },

        { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', platform: 'iPhone' },
        { ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1', platform: 'iPhone' },

        { ua: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', platform: 'iPad' },
        { ua: 'Mozilla/5.0 (Linux; Android 13; SM-X906B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', platform: 'Linux armv8l' }
    ];
    const pick = devices[Math.floor(Math.random() * devices.length)];
    const screens = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1440, height: 900 }
    ];
    const screen = screens[Math.floor(Math.random() * screens.length)];
    return { ...pick, screen };
}

const FALLBACK_SZ_TOKEN = "+IBV0FRwWaIqrszSdBav6w==|LYvHaeXkLW4fyt7s4Ma+EZJbFt4dKAS92dIa9Qy4VaDm6QvYjSbP7Dj5K5kSG90yXB2F5cP30yVSpJM86pR2|xd9FoW9aLdsNU20h|08|3";
const FALLBACK_SZ_PREFIX = "+IBV0FRwWaIqrsz";

const crypto = require('crypto');
const ENC_PREFIX = 'enc:v1:';
function getEncKey() {
    const raw = process.env.COOKIE_ENC_KEY || '';
    if (!raw) return null;
    try {
        let buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
        if (buf.length === 32) return buf;
        return crypto.createHash('sha256').update(raw).digest();
    } catch (e) { return crypto.createHash('sha256').update(raw).digest(); }
}
const COOKIE_KEY = getEncKey();
function encryptCookie(plain) {
    if (!COOKIE_KEY || !plain || typeof plain !== 'string') return plain;
    if (plain.startsWith(ENC_PREFIX)) return plain;
    try {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', COOKIE_KEY, iv);
        const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();
        return ENC_PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
    } catch (e) { return plain; }
}
function decryptCookie(stored) {
    if (!stored || typeof stored !== 'string' || !stored.startsWith(ENC_PREFIX)) return stored;
    if (!COOKIE_KEY) { logger.engine("CRYPTO", "COOKIE_ENC_KEY hilang, cookie terenkripsi tak bisa dibaca!", "ERR"); return stored; }
    try {
        const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64');
        const iv = buf.slice(0, 12), tag = buf.slice(12, 28), enc = buf.slice(28);
        const decipher = crypto.createDecipheriv('aes-256-gcm', COOKIE_KEY, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch (e) { logger.engine("CRYPTO", `Decrypt cookie gagal: ${e.message}`, "ERR"); return stored; }
}
const MAX_CONCURRENT_BROWSERS = parseInt(process.env.MAX_BROWSERS || "3");
let activeBrowsers = 0;
const browserQueue = [];
async function acquireBrowserSlot() {
    if (activeBrowsers < MAX_CONCURRENT_BROWSERS) { activeBrowsers++; return; }
    await new Promise(resolve => browserQueue.push(resolve));
    activeBrowsers++;
}
function releaseBrowserSlot() {
    activeBrowsers = Math.max(0, activeBrowsers - 1);
    const next = browserQueue.shift();
    if (next) next();
}
async function withBrowserSlot(fn) {
    await acquireBrowserSlot();
    try { return await fn(); }
    finally { releaseBrowserSlot(); }
}

async function fetchWebFingerprint(webIdentity) {
    let browser;
    await acquireBrowserSlot();
    try {
        logger.engine("FINGERPRINT", "Membuka jalur skenario reset siluman...", "INFO");

        const safeUA = webIdentity?.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';
        const safeScreen = webIdentity?.screen || { width: 1440, height: 900 };
        const cookie = webIdentity?.cookie || null;

        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--disable-blink-features=AutomationControlled']
        });

        const context = await browser.newContext({
            viewport: safeScreen,
            userAgent: safeUA,
            locale: 'id-ID',
            timezoneId: 'Asia/Jakarta'
        });

        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en'] });
            window.chrome = { runtime: {} };
        });

        if (cookie) {
            try { await context.addCookies(buildPlaywrightCookies(cookie, '.shopee.co.id')); } catch (e) {}
            try { await context.addCookies(buildPlaywrightCookies(cookie, 'shopee.co.id')); } catch (e) {}
        }

        const page = await context.newPage();
        let targetToken = null;
        let targetSapri = null;
        const returnFull = !!(webIdentity && webIdentity.returnFull);

        await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,css}', route => route.abort());

        const grab = (headers) => {
            const v = headers['af-ac-enc-sz-token'] || headers['x-dfp'];
            if (v && v.length > 40 && !targetToken) {
                targetToken = v;
                logger.engine("SCANNER", `Berhasil menangkap sz-token dari header!`, "SUCCESS");
            }

            if (headers['x-sap-ri'] && !targetSapri) targetSapri = headers['x-sap-ri'];
        };
        page.on('request', req => grab(req.headers()));

        await page.goto('https://shopee.co.id/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000 // Turunkan ke 30 detik agar antrean tidak menggantung terlalu lama
        });
        await page.waitForTimeout(2500);

        for (let attempt = 0; attempt < 5 && (!targetToken || !targetSapri); attempt++) {
            try {
                // PERBAIKAN 1: Gunakan AbortController di dalam browser agar fetch diputus paksa jika Shopee gantung koneksi
                await page.evaluate(async () => {
                    const urls = [
                        'https://shopee.co.id/api/v4/account/basic/get_account_info',
                        'https://shopee.co.id/api/v4/account/get_user_login_methods',
                        'https://mall.shopee.co.id/api/v4/homepage/get_wallet_bar_balance',
                        'https://shopee.co.id/api/v4/pdp/get_pc',
                        'https://shopee.co.id/api/v4/account/basic/get_payment_info'
                    ];
                    for (const u of urls) {
                        try { 
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 4000); // Batasi max 4 detik per request
                            
                            await fetch(u, { 
                                credentials: 'include', 
                                headers: { 'x-api-source': 'pc', 'x-requested-with': 'XMLHttpRequest' },
                                signal: controller.signal
                            }); 
                            clearTimeout(timeoutId);
                        } catch (e) {}
                    }
                });
            } catch (e) {}
            await page.waitForTimeout(1500);
        }

        // Tutup browser normal di sini setelah loop selesai mumpung masih di blok try
        await browser.close().catch(() => {});
        browser = null; // Set null agar blok finally tahu browser sudah ditutup bersih

        if (!targetToken) {
            logger.engine("FINGERPRINT", "Gagal menangkap sz-token asli, pakai fallback statik.", "WARN");
            return returnFull ? { sz: FALLBACK_SZ_TOKEN, sapri: null } : FALLBACK_SZ_TOKEN;
        }

        return returnFull ? { sz: targetToken, sapri: targetSapri } : targetToken;

    } catch (e) {
        logger.engine("FINGERPRINT", `Gagal memindai skenario reset: ${e.message}`, "ERR");
        return (webIdentity && webIdentity.returnFull) ? { sz: FALLBACK_SZ_TOKEN, sapri: null } : FALLBACK_SZ_TOKEN;
    } finally {
        // PERBAIKAN 2: Jaring pengaman mutlak bersihkan memory & lepas slot antrean
        if (browser) {
            await browser.close().catch(() => {});
        }
        releaseBrowserSlot();
    }
}

async function genShopeeQRCode(webIdentity) {
    const headers = {
        'Host': 'shopee.co.id',
        'Accept': 'application/json',
        'User-Agent': webIdentity.ua,
        'Referer': 'https://shopee.co.id/'
    };

    try {
        const res = await axios.get('https://shopee.co.id/api/v2/authentication/gen_qrcode', { headers, timeout: 10000 });
        if (res.data && res.data.error === 0) {
            return {
                success: true,
                qrcodeId: res.data.data.qrcode_id,
                qrcodeBase64: res.data.data.qrcode_base64
            };
        }
        return { success: false, msg: res.data?.error_msg || "Gagal alokasi server QR" };
    } catch (err) {
        return { success: false, msg: err.message };
    }
}

async function executeQRLogin(qrcodeToken, webIdentity, grabbedFingerprint) {
    const headers = {
        'Host': 'shopee.co.id',
        'Content-Type': 'application/json',
        'X-API-Source': 'rn',
        'User-Agent': webIdentity.ua,
        'Referer': 'https://shopee.co.id/'
    };

    const body = {
        qrcode_token: qrcodeToken,
        stay_logged_in: false,
        "af-ac-enc-sz-token": grabbedFingerprint,
        client_identifier: {
            security_device_fingerprint: grabbedFingerprint
        }
    };

    try {
        const res = await axios.post('https://shopee.co.id/api/v2/authentication/qrcode_login', body, { headers, timeout: 10000 });

        if (res.data && res.data.error === 0) {
            const rawCookies = res.headers['set-cookie'] || [];
            const cookieString = rawCookies.map(c => c.split(';')[0]).join('; ');
            return { success: true, cookie: cookieString };
        }

        return { success: false, msg: res.data?.error_msg || `Shopee Reject (Error: ${res.data?.error})` };
    } catch (err) {
        const serverMsg = err.response?.data?.error_msg || err.message;
        return { success: false, msg: serverMsg };
    }
}
function detectCookieType(cookie) {
    if (!cookie) return 'unknown';
    const webMarkers = ['_ga', '_gcl_au', '_fbp', 'shopee_webUnique_ccd', 'SPC_SEC_SI', 'SPC_SI', 'ssr-tz', '_QPWSDCXHZQA'];
    const hits = webMarkers.filter(m => new RegExp(`(?:^|;|\\s)${m}=`).test(cookie)).length;
    const isMobile = /(?:^|;|\s)SPC_SC_SESSION=/.test(cookie) || /(?:^|;|\s)SPC_SC_TK=/.test(cookie);
    if (hits >= 2 && !isMobile) return 'web';
    if (isMobile) return 'mobile';
    return hits >= 1 ? 'web' : 'unknown';
}

const WEB_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

function pickUserAgent(cookie, identity) {
    const type = detectCookieType(cookie);
    if (type === 'web') return WEB_USER_AGENT;
    return identity?.ua || generateDynamicDevice().ua;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 USER AGENT MANAGEMENT (Sinkron dengan getUA Anda)
// ═══════════════════════════════════════════════════════════════════════════════
const uaMap = new Map();
function randomUA() {
  const v = ["3.70.30","3.69.36","3.71.10","3.72.05"][Math.floor(Math.random()*4)];
  const os = [11,12,13,14][Math.floor(Math.random()*4)];
  const osv = {11:30,12:31,13:33,14:34}[os]||33;
  const ep = ['2.18.1','2.19.0','2.17.1'][Math.floor(Math.random()*3)];
  return `shopee/${v} (Linux;Android ${os}) ExoPlayerLib/${ep} app_type=1 platform=native_android os_ver=${osv} appver=${v.replace(/\./g,'')}`;
}
function getUA(key) { if (!uaMap.has(key)) uaMap.set(key, randomUA()); return uaMap.get(key); }

function generateDynamicDevice() {
    const { v4: uuidv4 } = require('uuid');
    const idfa = uuidv4().toUpperCase();
    const uniqueId = uuidv4().toUpperCase();

    const appleDevices = [
        { model: "iPhone13,4", name: "iPhone 12 Pro Max", res: "2778x1284", os: "15.5", build: "19F77" },
        { model: "iPhone14,3", name: "iPhone 13 Pro Max", res: "2778x1284", os: "16.0", build: "20A362" },
        { model: "iPhone15,3", name: "iPhone 14 Pro Max", res: "2796x1290", os: "16.6", build: "20G75" },
        { model: "iPhone16,2", name: "iPhone 15 Pro Max", res: "2796x1290", os: "17.0", build: "21A326" }
    ];

    const selected = appleDevices[Math.floor(Math.random() * appleDevices.length)];

    const appVersion = "37441";
    const shopeeUA = `iOS app iPhone Shopee appver=${appVersion} language=id app_type=1 platform=native_ios os_ver=${selected.os} Cronet/102.0.5005.61`;

    return {
        ua: shopeeUA,
        model: selected.model,
        deviceName: selected.name,
        resolution: selected.res,
        osVersion: selected.os,
        buildNumber: selected.build,
        idfa: idfa,
        uniqueId: uniqueId
    };
}

async function getShopeeAccountInfo(cookie, identity) {
    const headers = {
        'Host': 'mall.shopee.co.id',
        'X-API-Source': 'rn',
        'User-Agent': identity.ua,
        'Referer': 'https://mall.shopee.co.id/',
        'Cookie': cookie
    };

    try {
        const res = await axios.get('https://mall.shopee.co.id/api/v4/account/basic/get_account_info', { headers, timeout: 15000 });
        if (res.data && res.data.error === 0) {
            return {
                success: true,
                username: res.data.data.username,
                phone: res.data.data.phone
            };
        }
        return { success: false, msg: res.data?.error_msg || "Sesi Kuki Kandas" };
    } catch (err) {
        return { success: false, msg: err.message };
    }
}

async function getShopeeProfile(cookie, identity) {
    const csrf = cookie.split('csrftoken=')[1]?.split(';')[0] || '';
    const headers = {
        'Host': 'mall.shopee.co.id',
        'x-api-source': 'rn',
        'X-CSRFToken': csrf,
        'User-Agent': identity?.ua || 'Android app Shopee appver=37528 app_type=1 platform=native_android os_ver=36 Cronet/102.0.5005.61',
        'Referer': 'https://mall.shopee.co.id/',
        'Cookie': cookie
    };
    try {
        const res = await axios.get('https://mall.shopee.co.id/api/v4/account/get_profile', { headers, timeout: 12000 });
        if (res.data && res.data.error === 0) {
            const up = res.data.data?.user_profile || {};
            return {
                success: true,
                gender: up.gender,
                birthday: up.birthday,
                birthTimestamp: up.birth_timestamp,
                hasGender: !!up.gender,
                hasBirthday: !!(up.birthday || up.birth_timestamp),
                username: up.username
            };
        }
        return { success: false, msg: res.data?.error_msg || `Code: ${res.data?.error}` };
    } catch (err) {
        return { success: false, msg: err.message };
    }
}

async function updateShopeeProfile(cookie, identity, fields) {
    const csrf = cookie.split('csrftoken=')[1]?.split(';')[0] || '';
    const headers = {
        'Host': 'mall.shopee.co.id',
        'x-api-source': 'rn',
        'X-CSRFToken': csrf,
        'Content-Type': 'application/json',
        'User-Agent': identity?.ua || 'Android app Shopee appver=37528 app_type=1 platform=native_android os_ver=36 Cronet/102.0.5005.61',
        'Referer': 'https://mall.shopee.co.id/',
        'Cookie': cookie
    };
    try {
        const res = await axios.post('https://mall.shopee.co.id/api/v4/account/update_profile', fields, { headers, timeout: 12000 });
        if (res.data && res.data.error === 0) return { success: true, data: res.data.data };
        return { success: false, msg: res.data?.error_msg || `Code: ${res.data?.error}` };
    } catch (err) {
        return { success: false, msg: err.response?.data?.error_msg || err.message };
    }
}

async function ensureProfileComplete(cookie, identity) {
    const prof = await getShopeeProfile(cookie, identity);
    if (!prof.success) return { success: false, msg: prof.msg };
    if (prof.hasGender && prof.hasBirthday) return { success: true, alreadyComplete: true };

    const fields = {};
    if (!prof.hasGender) fields.gender = 1;
    if (!prof.hasBirthday) {
        const year = 1990 + Math.floor(Math.random() * 10);
        const month = 1 + Math.floor(Math.random() * 12);
        const day = 1 + Math.floor(Math.random() * 27);
        fields.birthday = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    const upd = await updateShopeeProfile(cookie, identity, fields);
    return { success: upd.success, applied: fields, msg: upd.msg };
}

async function getShopeeCoinBalance(cookie, identity) {
    const { v4: uuidv4 } = require('uuid');

    const szToken = identity?.sz_token || "";
    const csrfToken = cookie.split('csrftoken=')[1]?.split(';')[0] || "";
    const clientRequestId = `${uuidv4()}.${Math.floor(100 + Math.random() * 900)}`;

    const nativeAppUA = identity?.ua || "iOS app iPhone Shopee appver=37441 language=id app_type=1 platform=native_ios os_ver=26.5.0 Cronet/102.0.5005.61";

    const headers = {
        'Connection': 'keep-alive',
        'Accept': '*/*',
        'x-api-source': 'rn',
        'x-shopee-language': 'id',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        'af-ac-enc-sz-token': szToken,
        'X-DFP': szToken,
        'Client-Request-Id': clientRequestId,
        'User-Agent': nativeAppUA,
        'X-Shopee-Client-Timezone': 'Asia/Jakarta',
        'shopee_http_dns_mode': '1',
        'cache-control': 'no-cache, no-store',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cookie': cookie
    };

    if (identity?.d3bed805) headers['d3bed805'] = identity.d3bed805;
    if (identity?.df091811) headers['df091811'] = identity.df091811;
    if (identity?.["2a25e7d0"]) headers['2a25e7d0'] = identity["2a25e7d0"];

    const coinEndpoints = [
        { url: 'https://shopee.co.id/api/v4/market_coin/get_user_coins', referer: 'https://shopee.co.id/api/v4/market_coin/', host: 'shopee.co.id' },
        { url: 'https://mall.shopee.co.id/api/v2/coin/get_user_coins', referer: 'https://mall.shopee.co.id/', host: 'mall.shopee.co.id' }
    ];

    let coinBalance = null;
    let lastErr = null;
    let antibotHit = false;

    for (const ep of coinEndpoints) {
        try {
            const res = await axios.get(ep.url, {
                headers: { ...headers, 'Host': ep.host, 'Referer': ep.referer },
                timeout: 12000
            });
            const d = res.data?.data;
            if (d && (d.available_amount != null || d.fe_available_amount != null)) {
                coinBalance = d.available_amount != null
                    ? d.available_amount
                    : Math.round((d.fe_available_amount || 0) / 100000);
                break;
            }
            lastErr = "Struktur response coin kosong dari Shopee.";
        } catch (err) {
            const status = err.response?.status;
            if (status === 418 || status === 403) antibotHit = true;
            lastErr = err.response?.data?.error_msg || err.message;
        }
    }

    if (coinBalance !== null) {
        return { success: true, spayBalance: 0, coinBalance };
    }

    if (antibotHit) {
        logger.engine("COIN_BALANCE", `Coin API ditolak antibot (403/418) - non-kritis, fallback browser`, "WARN");
        return { success: false, spayBalance: 0, coinBalance: 0, antibot: true, msg: `coin antibot` };
    }
    logger.engine("COIN_BALANCE", lastErr || "unknown", "WARN");
    return { success: false, spayBalance: 0, coinBalance: 0, msg: lastErr || "unknown" };
}

async function fetchWalletViaBrowser(cookie) {
    let browser;
    await acquireBrowserSlot();
    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--disable-blink-features=AutomationControlled']
        });
        const ctx = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            viewport: { width: 390, height: 844 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta'
        });
        await ctx.addCookies([
            ...buildPlaywrightCookies(cookie, 'mall.shopee.co.id'),
            ...buildPlaywrightCookies(cookie, '.shopee.co.id'),
            ...buildPlaywrightCookies(cookie, 'shopee.co.id')
        ]);
        const page = await ctx.newPage();
        await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,css,mp4}', route => route.abort());
        
        try { await page.goto('https://mall.shopee.co.id/', { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch (e) {}
        await page.waitForTimeout(3000);
        
        const csrf = (await ctx.cookies()).find(c => c.name === 'csrftoken')?.value || '';
        let r;
        try {
            r = await page.evaluate(async (csrf) => {
                const baseHeaders = { 'Accept': 'application/json', 'X-CSRFToken': csrf, 'x-api-source': 'rn', 'x-shopee-language': 'id', 'X-Requested-With': 'XMLHttpRequest' };
                const out = { coinBalance: null, spayBalance: 0, pinStatus: undefined, walletStatus: 0 };

                for (const u of ['https://shopee.co.id/api/v4/market_coin/get_user_coins', 'https://mall.shopee.co.id/api/v2/coin/get_user_coins']) {
                    try {
                        // PERBAIKAN 1: Menambahkan AbortController pada fetch koin internal browser
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 4000); // Batasi max 4 detik
                        
                        const cr = await fetch(u, { method: 'GET', headers: baseHeaders, credentials: 'include', signal: controller.signal });
                        clearTimeout(timeoutId);
                        
                        let cj = null; try { cj = await cr.json(); } catch (e) {}
                        const d = cj && cj.data;
                        if (d && (d.available_amount != null || d.fe_available_amount != null)) {
                            out.coinBalance = d.available_amount != null ? d.available_amount : Math.round((d.fe_available_amount || 0) / 100000);
                            break;
                        }
                    } catch (e) {}
                }

                try {
                    // PERBAIKAN 2: Menambahkan AbortController pada fetch wallet_bar_balance
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 4000); // Batasi max 4 detik
                    
                    const wr = await fetch('https://mall.shopee.co.id/api/v4/homepage/get_wallet_bar_balance', { method: 'GET', headers: baseHeaders, credentials: 'include', signal: controller.signal });
                    clearTimeout(timeoutId);
                    
                    out.walletStatus = wr.status;
                    let wj = null; try { wj = await wr.json(); } catch (e) {}
                    if (wj && wj.data) {
                        out.spayBalance = wj.data.wallet?.balance || 0;
                        out.pinStatus = wj.data.wallet?.has_pin;
                        if (out.coinBalance == null) out.coinBalance = wj.data.coin?.balance ?? null;
                    }
                } catch (e) {}

                return out;
            }, csrf);
        } catch (e) { r = { coinBalance: null, err: e.message }; }
        
        // Tutup browser secara normal setelah evaluasi selesai
        await browser.close().catch(() => {});
        browser = null; // Set null agar blok finally tahu browser sudah ditutup bersih

        if (r && r.coinBalance != null) {
            return { success: true, spayBalance: r.spayBalance || 0, coinBalance: r.coinBalance, pinStatus: r.pinStatus };
        }
        return { success: false, spayBalance: 0, coinBalance: 0, msg: `wallet reject (HTTP ${r?.walletStatus || 0})` };
    } catch (err) {
        return { success: false, spayBalance: 0, coinBalance: 0, msg: err.message };
    } finally {
        // PERBAIKAN 3: Jaring pengaman mutlak. Pastikan slot lepas & browser mati total walaupun crash di atas
        if (browser) {
            await browser.close().catch(() => {});
        }
        releaseBrowserSlot();
    }
}

async function resolveShopeeShortlink(shortUrl) {
    let currentUrl = shortUrl.trim();

    for (let i = 0; i < 5; i++) {
        try {
            const res = await axios.get(currentUrl, {
                maxRedirects: 0,
                validateStatus: (status) => status >= 300 && status < 400,
                timeout: 7000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Shopee'
                }
            });

            const nextUrl = res.headers.location;
            if (!nextUrl) break;

            currentUrl = nextUrl;

            if (currentUrl.includes('mmp_ad_id=')) {
                break;
            }
        } catch (err) {
            const nextUrl = err.response?.headers?.location;
            if (nextUrl) {
                currentUrl = nextUrl;
                if (currentUrl.includes('mmp_ad_id=')) break;
            } else {
                break;
            }
        }
    }
    return currentUrl;
}

function buildPlaywrightCookies(cookieStr, domain) {
    return cookieStr.split(';').map(p => {
        const idx = p.indexOf('=');
        if (idx === -1) return null;
        const name = p.slice(0, idx).trim();
        const value = p.slice(idx + 1).trim();
        if (!name) return null;
        return { name, value, domain, path: '/', secure: true, sameSite: 'None' };
    }).filter(Boolean);
}

async function runGamesReferralMission(shareToken, cookie, deviceIdentity) {
    let browser;
    await acquireBrowserSlot();
    try {
        const ua = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
        const szToken = deviceIdentity?.sz_token || cookie.split('SPC_DID=')[1]?.split(';')[0] || cookie.split('SPC_F=')[1]?.split(';')[0] || '';
        const deviceId = deviceIdentity?.device_id || cookie.split('SPC_DID=')[1]?.split(';')[0] || cookie.split('SPC_F=')[1]?.split(';')[0] || '';

        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--no-zygote',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security',
                '--disable-infobars',
                '--lang=id-ID'
            ]
        });

        const context = await browser.newContext({
            userAgent: ua,
            viewport: { width: 390, height: 844 },
            locale: 'id-ID',
            timezoneId: 'Asia/Jakarta',
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
            extraHTTPHeaders: {
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"'
            }
        });

        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US', 'en'] });
            Object.defineProperty(navigator, 'platform', { get: () => 'Linux armv8l' });
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 });
            window.chrome = { runtime: {}, app: {}, csi: () => {}, loadTimes: () => {} };
            const origQuery = window.navigator.permissions && window.navigator.permissions.query;
            if (origQuery) {
                window.navigator.permissions.query = (p) => (
                    p && p.name === 'notifications'
                        ? Promise.resolve({ state: Notification.permission })
                        : origQuery(p)
                );
            }
            try {
                const gp = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function (param) {
                    if (param === 37445) return 'Qualcomm';
                    if (param === 37446) return 'Adreno (TM) 730';
                    return gp.call(this, param);
                };
            } catch (e) {}
        });

        const cookies = [
            ...buildPlaywrightCookies(cookie, 'games.shopee.co.id'),
            ...buildPlaywrightCookies(cookie, '.shopee.co.id'),
            ...buildPlaywrightCookies(cookie, 'shopee.co.id')
        ];
        await context.addCookies(cookies);

        const page = await context.newPage();
        await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,css,mp4}', route => route.abort());

        await page.goto(`https://games.shopee.co.id/referral/?share_token=${encodeURIComponent(shareToken)}&mmp_campaign=referral&mmp_pid=shp_games&source=19`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000 // Turunkan sedikit ke 30 detik untuk menghindari gantung terlalu lama
        });
        await page.waitForTimeout(4000);
        try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch (e) {}

        const csrfToken = (await context.cookies()).find(c => c.name === 'csrftoken')?.value || '';

        const evalWithRetry = async (fn, arg, tries = 3) => {
            for (let i = 0; i < tries; i++) {
                try {
                    return await page.evaluate(fn, arg);
                } catch (e) {
                    if (/context was destroyed|Execution context/i.test(e.message) && i < tries - 1) {
                        await page.waitForTimeout(2500);
                        continue;
                    }
                    throw e;
                }
            }
        };

        // TITIK PERBAIKAN 1: Tambah AbortController pada fetch Join Game
        const joinResult = await evalWithRetry(async ({ shareToken, csrfToken, szToken, deviceId }) => {
            try {
                const headers = {
                    'Accept': 'application/json, text/plain, */*',
                    'x-api-source': 'rn',
                    'X-CSRFToken': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                };
                if (szToken) {
                    headers['X-DFP'] = szToken;
                    headers['af-ac-enc-sz-token'] = szToken;
                }
                if (deviceId) {
                    headers['X-Device-ID'] = deviceId;
                    headers['x-device-id'] = deviceId;
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout 5 detik

                const r = await fetch(`https://games.shopee.co.id/referral/api/v1/app/join?share_token=${encodeURIComponent(shareToken)}`, {
                    method: 'GET',
                    headers,
                    credentials: 'include',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const status = r.status;
                let j = null;
                try { j = await r.json(); } catch (e) {}
                return { status, code: j?.code, msg: j?.msg, referrerName: j?.data?.referrer_name };
            } catch (err) {
                return { status: 0, msg: err.message };
            }
        }, { shareToken, csrfToken, szToken, deviceId });

        // TITIK PERBAIKAN 2: Semua "await browser.close()" di tengah alur dihapus agar didelegasikan ke finally
        if (joinResult.status === 403 || joinResult.status === 418) {
            return { success: false, msg: `anti fraud blocked (HTTP ${joinResult.status})` };
        }
        if (joinResult.code !== 0) {
            return { success: false, msg: joinResult.msg || `Join Code: ${joinResult.code}` };
        }
        const referrerName = joinResult.referrerName || 'Member';

        // TITIK PERBAIKAN 3: Tambah AbortController pada fetch Unlock Gift
        const unlockResult = await evalWithRetry(async ({ shareToken, csrfToken, szToken, deviceId }) => {
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/plain, */*',
                    'x-api-source': 'rn',
                    'X-CSRFToken': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                };
                if (szToken) {
                    headers['X-DFP'] = szToken;
                    headers['af-ac-enc-sz-token'] = szToken;
                }
                if (deviceId) {
                    headers['X-Device-ID'] = deviceId;
                    headers['x-device-id'] = deviceId;
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // Timeout 5 detik

                const r = await fetch('https://games.shopee.co.id/referral/api/v1/unlock_gift', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ share_token: shareToken }),
                    credentials: 'include',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);

                const status = r.status;
                let j = null;
                try { j = await r.json(); } catch (e) {}
                return { status, code: j?.code, msg: j?.msg, voucherName: j?.data?.voucher_name, minSpend: j?.data?.min_spend_text };
            } catch (err) {
                return { status: 0, msg: err.message };
            }
        }, { shareToken, csrfToken, szToken, deviceId });

        // Selesai mengevaluasi, tutup browser secara normal di dalam blok try
        await browser.close().catch(() => {});
        browser = null; // Set null agar tidak diproses ulang di finally

        if (unlockResult.status === 403 || unlockResult.status === 418) {
            return { success: false, msg: `anti fraud blocked (HTTP ${unlockResult.status})` };
        }
        if (unlockResult.code !== 0) {
            return { success: false, msg: unlockResult.msg || `Unlock Code: ${unlockResult.code}` };
        }

        return {
            success: true,
            referrerName,
            voucherName: unlockResult.voucherName || 'Hadiah Mission',
            minSpend: unlockResult.minSpend || '0'
        };
    } catch (err) {
        return { success: false, msg: err.message };
    } finally {
        // JARING PENGAMAN UTAMA: Memastikan instance browser hancur total dan antrean bot terlepas
        if (browser) {
            await browser.close().catch(() => {});
        }
        releaseBrowserSlot();
    }
}

async function fetchShopeeAddressList(cookie, identity) {
    const csrfToken = cookie.split('csrftoken=')[1]?.split(';')[0] || "";

    const userAgent = identity?.ua || "iOS app iPhone Shopee appver=37441 language=id app_type=1 platform=native_ios os_ver=26.5.0 Cronet/102.0.5005.61";
    const szToken = identity?.sz_token || "";

    const headers = {
        'Host': 'mall.shopee.co.id',
        'Connection': 'keep-alive',
        'x-api-source': 'rn',
        'X-CSRFToken': csrfToken,
        'af-ac-enc-sz-token': szToken,
        'X-DFP': szToken,
        'User-Agent': userAgent,
        'Referer': 'https://mall.shopee.co.id/',
        'Cookie': cookie
    };
    try {
        const res = await axios.get('https://mall.shopee.co.id/api/v4/account/address/get_user_address_list', { headers, timeout: 10000 });
        if (res.data && res.data.error === 0) {
            return { success: true, addresses: res.data.data?.addresses || [] };
        }
        return { success: false, msg: res.data?.error_msg || `Code: ${res.data?.error}` };
    } catch (err) {
        return { success: false, msg: err.message };
    }
}

async function fetchHierarchyByGeo(lat, lon, cookie, identity) {
    const userAgent = identity?.ua || "iOS app iPhone Shopee appver=37441 language=id app_type=1 platform=native_ios os_ver=26.5.0 Cronet/102.0.5005.61";
    const szToken = identity?.sz_token || "";

    const headers = {
        'Host': 'mall.shopee.co.id',
        'Connection': 'keep-alive',
        'x-api-source': 'rn',
        'af-ac-enc-sz-token': szToken,
        'X-DFP': szToken,
        'User-Agent': userAgent,
        'Cookie': cookie
    };
    try {
        const apiUrl = `https://mall.shopee.co.id/api/v4/location/get_division_hierarchy_by_geo?lat=${lat}&lon=${lon}&need_zipcode=true&usage=FE.user.new_address_flow_v2`;
        const res = await axios.get(apiUrl, { headers, timeout: 10000 });
        if (res.data && res.data.data) {
            return { success: true, geoData: res.data.data };
        }
        return { success: false, msg: "Koordinat GPS tidak dikenali oleh sistem Shopee." };
    } catch (err) {
        return { success: false, msg: err.message };
    }
}

async function injectCreateAddress(payload, cookie, identity) {
    const { v4: uuidv4 } = require('uuid');
    const csrfToken = cookie.split('csrftoken=')[1]?.split(';')[0] || "";
    const clientRequestId = `${uuidv4()}.${Math.floor(100 + Math.random() * 900)}`;

    const userAgent = identity?.ua || "iOS app iPhone Shopee appver=37441 language=id app_type=1 platform=native_ios os_ver=26.5.0 Cronet/102.0.5005.61";
    const szToken = identity?.sz_token || "";

    const headers = {
        'Host': 'mall.shopee.co.id',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'x-api-source': 'rn',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        'af-ac-enc-sz-token': szToken,
        'X-DFP': szToken,
        'Client-Request-Id': clientRequestId,
        'User-Agent': userAgent,
        'Referer': 'https://mall.shopee.co.id/',
        'Cookie': cookie
    };

    const body = {
        "address": {
            "country": "ID",
            "name": payload.name,
            "phone": payload.phone,
            "address": `${payload.fullAddress} (${payload.instruction})`,
            "address_instruction": payload.instruction,
            "state": payload.state,
            "city": payload.city,
            "district": payload.district,
            "zipcode": payload.zipcode,
            "geoinfo": {
                "geoinfo_confirm": true,
                "user_adjusted": false,
                "user_verified": true,
                "region": {
                    "latitude": parseFloat(payload.lat),
                    "longitude": parseFloat(payload.lon)
                }
            },
            "label_id": 2
        },
        "address_flag": { "as_default": true }
    };

    try {
        const res = await axios.post('https://mall.shopee.co.id/api/v4/account/address/create_user_address', body, { headers, timeout: 12000 });
        if (res.data && res.data.error === 0) {
            return { success: true, addressId: res.data.data?.addressid };
        }
        return { success: false, msg: res.data?.error_msg || `Injeksi Gagal (Code: ${res.data?.error})` };
    } catch (err) {
        return { success: false, msg: err.message };
    }
}

async function injectDeleteAddress(addressId, cookie, identity) {
    const { v4: uuidv4 } = require('uuid');
    const csrfToken = cookie.split('csrftoken=')[1]?.split(';')[0] || "";
    const clientRequestId = `${uuidv4()}.${Math.floor(100 + Math.random() * 900)}`;

    const userAgent = identity?.ua || "iOS app iPhone Shopee appver=37441 language=id app_type=1 platform=native_ios os_ver=26.5.0 Cronet/102.0.5005.61";
    const szToken = identity?.sz_token || "";

    const headers = {
        'Host': 'mall.shopee.co.id',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-source': 'rn',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        'af-ac-enc-sz-token': szToken,
        'X-DFP': szToken,
        'Client-Request-Id': clientRequestId,
        'User-Agent': userAgent,
        'Referer': 'https://mall.shopee.co.id/',
        'Cookie': cookie
    };

    const body = {
        "address_id": parseInt(addressId)
    };

    try {
        const res = await axios.post('https://mall.shopee.co.id/api/v4/account/address/delete_user_address', body, { headers, timeout: 10000 });
        if (res.data && res.data.error === 0) {
            return { success: true };
        }
        return { success: false, msg: res.data?.error_msg || `Shopee Reject Code: ${res.data?.error}` };
    } catch (err) {
        return { success: false, msg: err.response?.data?.error_msg || err.message };
    }
}

async function fetchShopeeLandingItemInfo(longUrl, shopId, itemId, utmSource, cookie, userAgent, deviceIdentity) {
    try {
        logger.engine("LANDING_BYPASS", `Memulai pemindaian teks HTML mentah affiliate APK...`, "INFO");

        const res = await axios.get(longUrl, {
            headers: {
                'User-Agent': userAgent,
                'Cookie': cookie,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9'
            },
            timeout: 10000
        });

        const htmlContent = res.data;

        let extractedModelId = 0;
        const regexModelJson = /"model_id"\s*:\s*(\d+)/i;
        const regexModelUrl = /[?&]modelid=(\d+)/i;

        if (regexModelJson.test(htmlContent)) {
            extractedModelId = htmlContent.match(regexModelJson)[1];
        } else if (regexModelUrl.test(longUrl)) {
            extractedModelId = longUrl.match(regexModelUrl)[1];
        }

        let productName = "Produk Affiliate Shopee";
        const regexTitle = /<title>([^<]+)<\/title>/i;
        if (regexTitle.test(htmlContent)) {
            productName = htmlContent.match(regexTitle)[1].split('|')[0].trim();
        }

        if (!extractedModelId || extractedModelId == 0) {
            const genericModelRegex = /model_id":(\d+)/;
            const matchGeneric = htmlContent.match(genericModelRegex);
            if (matchGeneric) extractedModelId = matchGeneric[1];
        }

        logger.engine("EXTRACTOR", `Berhasil menculik parameters! Model ID: ${extractedModelId}`, "SUCCESS");

        return {
            success: true,
            shopid: parseInt(shopId),
            itemid: parseInt(itemId),
            modelid: extractedModelId ? parseInt(extractedModelId) : 0,
            productName: productName,
            shopName: "Shopee Affiliate Item",
            stock: 999,
            models: []
        };

    } catch (err) {
        logger.engine("LANDING_ITEM_CRASH", `Metode HTML Extractor gagal: ${err.message}`, "ERR");
        return { success: false, msg: `Gagal urai data HTML: ${err.message}` };
    }
}

function extractJsonArray(h, keyToken) {
    const arrIdx = h.indexOf(keyToken);
    if (arrIdx < 0) return null;
    const start = arrIdx + keyToken.length - 1;
    let depth = 0, i = start, inStr = false, esc = false;
    for (; i < h.length; i++) {
        const ch = h[i];
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') inStr = !inStr;
        if (inStr) continue;
        if (ch === '[') depth++;
        else if (ch === ']') { depth--; if (depth === 0) { i++; break; } }
    }
    try { return JSON.parse(h.substring(start, i)); } catch (e) { return null; }
}

async function fetchProductFromHTML(shopid, itemid, userCookie, identity) {
    const ua = 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    try {
        const res = await axios.get(`https://shopee.co.id/product/${parseInt(shopid)}/${parseInt(itemid)}`, {
            headers: {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9',
                'Cookie': userCookie
            },
            timeout: 15000
        });
        const h = String(res.data);

        let productName = "Produk Shopee";
        const ogm = h.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
        if (ogm && !ogm[1].includes("Situs Belanja")) productName = ogm[1];

        const rawModels = extractJsonArray(h, '"models":[');
        if (!rawModels || rawModels.length === 0) {
            logger.engine("HTML_EXTRACT", `Data models tidak ada di HTML (len ${h.length}). UA/sesi kemungkinan dapat halaman kosong.`, "WARN");
            return { success: false, msg: "Gagal baca data produk dari halaman (HTML kosong/anti-crawl)." };
        }

        const models = rawModels.map(m => ({
            model_id: m.model_id || m.modelid,
            name: m.name || "",
            stock: (m.stock != null ? m.stock : (m.normal_stock != null ? m.normal_stock : (m.has_stock ? 99 : 0))),
            is_selectable: (m.status === 1 && m.has_stock === true && m.is_grayout !== true && m.is_clickable !== false)
        })).filter(m => m.model_id);

        if (models.length === 0) {
            return { success: false, msg: "Variasi produk tidak terbaca dari halaman." };
        }

        const totalStock = models.reduce((s, x) => s + (x.stock || 0), 0);
        logger.engine("HTML_EXTRACT", `Sukses tarik ${models.length} variasi dari HTML produk.`, "SUCCESS");
        return {
            success: true,
            itemData: { name: productName, stock: totalStock || 99, models }
        };
    } catch (err) {
        logger.engine("HTML_EXTRACT_CRASH", err.message, "ERR");
        return { success: false, msg: err.message };
    }
}

async function fetchUserVouchers(userCookie) {
    const csrf = userCookie.split('csrftoken=')[1]?.split(';')[0] || '';
    const headers = {
        'host': 'mall.shopee.co.id',
        'accept': 'application/json',
        'x-csrftoken': csrf,
        'content-type': 'application/json',
        'user-agent': 'shopee/3.70.30 (Linux;Android 12) ExoPlayerLib/2.18.1 app_type=1 platform=native_android os_ver=31 appver=37030',
        'referer': 'https://mall.shopee.co.id/',
        'Cookie': userCookie
    };
    const body = { voucher_status: 1, voucher_sort_flag: 6, cursor: "", limit: 100, need_statistics: true };
    try {
        const res = await axios.post('https://mall.shopee.co.id/api/v2/voucher_wallet/get_user_voucher_list', body, { headers, timeout: 12000 });
        if (res.data && res.data.error === 0) {
            const list = res.data.data?.user_voucher_list || [];
            const vouchers = list
                .filter(v => !v.has_expired && !v.fully_used && !v.disabled)
                .map(v => {
                    let kind = 'OTHER', discountText = 'Voucher';
                    if (v.voucher_code && v.voucher_code.startsWith('FSV')) { kind = 'FSV'; discountText = 'Gratis Ongkir'; }
                    else if (v.discount_value > 0) { kind = 'CASH'; discountText = `Rp ${(v.discount_value / 100000).toLocaleString('id-ID')}`; }
                    else if (v.discount_percentage > 0) { kind = 'PERCENT'; discountText = `${v.discount_percentage}%${v.discount_cap > 0 ? ` (maks Rp ${(v.discount_cap / 100000).toLocaleString('id-ID')})` : ''}`; }
                    else if (v.reward_value > 0) { kind = 'CASH'; discountText = `Rp ${(v.reward_value / 100000).toLocaleString('id-ID')}`; }
                    else if (v.reward_percentage > 0) { kind = 'PERCENT'; discountText = `${v.reward_percentage}%`; }

                    const memruText = `${v.title || ''} ${v.icon_text || ''} ${v.description || ''} ${v.usage_terms_and_conditions || ''}`.toLowerCase();
                    const isMemru = /memru|member|eksklusif|exclusive|khusus member|special member/.test(memruText) || v.is_member_voucher === true || v.member_only === true;
                    return {
                        code: v.voucher_code,
                        promotionid: v.promotionid,
                        signature: v.signature || "",
                        kind,
                        discountText,
                        title: v.title || v.icon_text || v.description || (v.shop_name ? `Voucher ${v.shop_name}` : "Voucher Shopee"),
                        minSpend: v.min_spend || 0,
                        isShop: !!(v.shop_id && v.shop_id !== 0),
                        shopId: v.shop_id || 0,
                        endTime: v.end_time || 0,
                        isMemru
                    };
                });

            vouchers.sort((a, b) => (b.isMemru ? 1 : 0) - (a.isMemru ? 1 : 0));
            return { success: true, vouchers };
        }
        return { success: false, msg: res.data?.error_msg || `Reject code: ${res.data?.error}` };
    } catch (err) {
        logger.engine("VOUCHER_FETCH", `HTTP ${err.response?.status || '-'}: ${err.message}`, "ERR");
        return { success: false, msg: err.response?.data?.error_msg || err.message };
    }
}

const PAYMENT_CHANNELS = [
    { id: 8005200, option: "89052007", name: "SeaBank",        emoji: "🌊", default: true },
    { id: 89000,   option: "",         name: "COD",            emoji: "💵" },
    { id: 8001400, option: "",         name: "ShopeePay",      emoji: "🛍️" },
    { id: 8002601, option: "",         name: "SPayLater",      emoji: "📆" },
    { id: 8031400, option: "",         name: "QRIS",           emoji: "📷" },
    { id: 8005200, option: "",         name: "Transfer Bank",  emoji: "🏦" },
    { id: 8002050, option: "",         name: "Kartu Kredit/Debit", emoji: "💳" }
];
const DEFAULT_PAYMENT = PAYMENT_CHANNELS.find(c => c.default);

const COURIER_NAMES = {
    8005: "Hemat (SPX Hemat)",
    8003: "Reguler (SPX Standard)",
    80091: "Sameday",
    80090: "Instant",
    8004: "Kargo",
    8002: "JNE Reguler",
    8006: "J&T Express",
    8015: "SiCepat",

    8007: "Instant",
    8008: "Instant Prioritas",
    80053: "SPX Instant",
    80054: "SPX Instant Prioritas",
    80061: "GrabExpress Instant Prioritas",
    80062: "GrabExpress Instant",
    80063: "GoSend Instant Prioritas",
    80064: "Gosend Instant"
};

function courierLabel(id, apiName) { return apiName || COURIER_NAMES[id] || `Kurir #${id}`; }

function buildPaymentChannelData(ch) {
    const c = ch || DEFAULT_PAYMENT;
    if (c.id === 89000) {
        return {
            version: 1,
            payment_channelid: c.id,
            option_info: "",
            text_info: {},
            ros_opt_in: false,
            name: c.name,
            support_advance_booking: true,
            combined_payments_info: { base_payable: 0, total_payable: 0, price_breakdown: [], splits: [] }
        };
    }
    return {
        version: 2,
        option_info: "",
        channel_id: c.id,
        channel_item_option_info: { option_info: c.option || "" },
        text_info: {},
        ros_opt_in: false,
        name: c.name,
        support_advance_booking: true,
        combined_payments_info: { base_payable: 0, total_payable: 0, price_breakdown: [], splits: [] }
    };
}

async function executeShopeeCheckout(shopid, itemid, modelid, quantity, userCookie, identity, voucherOpts, previewOnly, paymentChannel, useCoins, extraOpts) {
    const csrf = userCookie.split('csrftoken=')[1]?.split(';')[0] || '';
    const fp = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('') + '_unknown';
    const sessionId = `${fp}:${Date.now()}:0.${Math.random().toString().slice(2, 18)}`;
    const CFT = identity?.cft || [4227792767, 1060634367, 4194238];

    const realDeviceId = userCookie.split('SPC_DID=')[1]?.split(';')[0]
        || userCookie.split('SPC_F=')[1]?.split(';')[0]
        || identity?.device_id
        || sessionId.split(':')[0];

    const dbSz = identity?.sz_token;
    const SZ_MAX_AGE_MS = 6 * 60 * 60 * 1000;
    const szAge = identity?.sz_token_ts ? (Date.now() - identity.sz_token_ts) : Infinity;
    const isUsableDbSz = dbSz && dbSz.length > 40 && !dbSz.startsWith(FALLBACK_SZ_PREFIX) && szAge < SZ_MAX_AGE_MS;
    let realSzToken = isUsableDbSz ? dbSz : (extraOpts?.szToken && !extraOpts.szToken.startsWith(FALLBACK_SZ_PREFIX) ? extraOpts.szToken : null);

    const hasVoucher = voucherOpts && (voucherOpts.platform || voucherOpts.shop || voucherOpts.fsv);
    const needSz = !previewOnly || hasVoucher;
    let realSapri = (identity?.x_sap_ri && szAge < SZ_MAX_AGE_MS) ? identity.x_sap_ri : (extraOpts?.sapri || null);
    
    // Ambil User Agent dinamis menggunakan cookie/device id sebagai key pengunci sesi UA
    const targetUA = getUA(userCookie);

    if (needSz && !realSzToken) {
        try {
            // Gunakan targetUA yang sama agar fingerprint sinkron dengan request checkout
            const grabbed = await fetchWebFingerprint({ ua: targetUA, cookie: userCookie, returnFull: true });
            if (grabbed && grabbed.sz && grabbed.sz.length > 40 && !grabbed.sz.startsWith(FALLBACK_SZ_PREFIX)) {
                realSzToken = grabbed.sz;
                if (grabbed.sapri) realSapri = grabbed.sapri;
            }
        } catch (e) { logger.engine("FINGERPRINT", `grab gagal: ${e.message}`, "WARN"); }
    }

    const promo = { 
        use_coins: !!useCoins, 
        platform_vouchers: [], 
        shop_vouchers: [], 
        check_shop_voucher_entrances: true, 
        auto_apply_shop_voucher: false, 
        auto_apply_platform_voucher: false, 
        auto_apply_spl_voucher: true, 
        spl_voucher_info: null, 
        claimable_vouchers: [] 
    };
    
    let fsvSelection = [];
    if (voucherOpts && voucherOpts.platform) {
        promo.platform_vouchers.push({ voucher_code: voucherOpts.platform.code, promotionid: voucherOpts.platform.promotionid, signature: voucherOpts.platform.signature || "" });
    }
    if (voucherOpts && voucherOpts.shop) {
        promo.shop_vouchers.push({ voucher_code: voucherOpts.shop.code, promotionid: voucherOpts.shop.promotionid, signature: voucherOpts.shop.signature || "" });
    }
    if (voucherOpts && voucherOpts.fsv) {
        promo.free_shipping_voucher_info = { free_shipping_voucher_id: voucherOpts.fsv.promotionid, free_shipping_voucher_code: voucherOpts.fsv.code, free_shipping_voucher_signature: voucherOpts.fsv.signature || "" };
        fsvSelection = [{ fsv_id: voucherOpts.fsv.promotionid, selected_shipping_ids: [1], selected_combined_group_id: null, potentially_applied_shipping_ids: [1], potentially_applied_combined_group_ids: null }];
    }

    const headers = {
        'host': 'mall.shopee.co.id',
        'accept': 'application/json',
        'x-csrftoken': csrf,
        'x-shopee-client-timezone': 'Asia/Jakarta',
        'x-shopee-language': 'id',
        'x-requested-with': 'com.shopee.id',
        'content-type': 'application/json',
        'user-agent': targetUA, // ⚡ Sekarang menggunakan User Agent dinamis dari fungsi getUA(userCookie) Anda
        'X-Api-Source': 'native',
        'referer': 'https://mall.shopee.co.id/',
        'Cookie': userCookie
    };

    if (realSzToken) { headers['af-ac-enc-sz-token'] = realSzToken; headers['X-DFP'] = realSzToken; }
    if (realSapri) headers['x-sap-ri'] = realSapri;

    const mkItem = (it, mo, q) => ({
        itemid: parseInt(it), modelid: parseInt(mo) || 0, quantity: parseInt(q),
        add_on_deal_id: 0, is_add_on_sub_item: false, item_group_id: null, insurances: [],
        channel_exclusive_info: { source_id: 0, token: "", is_live_stream: false, is_short_video: false, user_path_token: "", user_path_flag: 1 },
        supports_free_returns: false, free_return_eligible: false, com_eligible: false,
        spu_info: { itemid: 0, modelid: 0, shopid: 0, quantity: 0 },
        value_added_service_info: { installation_products: [], trade_in_products: [], warranty_products: [] }, is_bom_item: false
    });

    let shoporders;
    const cartItems = extraOpts && Array.isArray(extraOpts.cartItems) && extraOpts.cartItems.length ? extraOpts.cartItems : null;
    if (cartItems) {
        const byShop = {};
        cartItems.forEach(ci => {
            const sid = parseInt(ci.shopid);
            if (!byShop[sid]) byShop[sid] = [];
            byShop[sid].push(mkItem(ci.itemid, ci.modelid, ci.quantity));
        });
        let sidx = 1;
        shoporders = Object.keys(byShop).map(sid => ({
            shop: { shopid: parseInt(sid) },
            items: byShop[sid],
            shipping_id: sidx++, shippable: true, carrier_id: 0
        }));
    } else {
        shoporders = [{
            shop: { shopid: parseInt(shopid) },
            items: [mkItem(itemid, modelid, quantity)],
            shipping_id: 1, shippable: true, carrier_id: 0
        }];
    }

    // 🔧 2-PHASE checkout/get Builder
    const buildGetBody = (first, prev) => {
        const ts = Math.floor(Date.now() / 1000);
        const bom = first
            ? { session_info: { session_id: sessionId, version: 0 }, fetch_mode: 1, display_mode: 0 }
            : { ...(prev?.buy_one_more || {}), session_info: { session_id: sessionId, version: 1 }, fetch_mode: 0, display_mode: 0 };
        const svip = first
            ? { status: 1, session_info: { session_id: sessionId, version: 0 } }
            : { ...(prev?.svip_one_click_info || {}), session_info: { session_id: sessionId, version: 0 } };
        let prevSo = (prev?.shipping_orders?.length) ? prev.shipping_orders : null;
        
        // Ekstrak info OS dan versi aplikasi langsung dari targetUA Anda agar parameter device_info sinkron 100%
        const uaMatchApp = targetUA.match(/shopee\/([^\s]+)/);
        const uaMatchOs = targetUA.match(/Android\s([^\)]+)/);
        const currentAppVer = uaMatchApp ? uaMatchApp[1] : "3.70.30";
        const currentOsVer = uaMatchOs ? uaMatchOs[1] : "12";

        const body = {
            ...(first ? {} : { timestamp: prev?.timestamp ?? ts }),
            ...(first ? { timestamp: ts } : {}),
            shoporders,
            selected_payment_channel_data: buildPaymentChannelData(paymentChannel),
            
            // 🎫 Kunci FALSE secara konsisten di semua phase agar voucher manual tidak di-override sistem auto-apply
            promotion_data: {
                ...promo,
                auto_apply_shop_voucher: false,
                auto_apply_platform_voucher: false,
                smart_voucher_popup: { session_info: { session_id: sessionId, version: 0 } }
            },
            
            fsv_selection_infos: fsvSelection,
            device_info: {
                device_id: realDeviceId,
                device_fingerprint: `${realDeviceId}_unknown`,
                device_sz_fingerprint: realSzToken || fp,
                timezone_offset_in_minutes: 420,
                model_info: identity?.model_info || `Brand/samsung Model/SM-G991B OSVer/${currentOsVer} Manufacturer/samsung`,
                system_version: currentOsVer,
                buyer_payment_info: { is_jko_app_installed: false },
                gps_location_info: { status: 0, latitude: null, longitude: null }
            },
            device_type: "mobile",
            buyer_info: first ? { kyc_info: null, checkout_email: "", spl_activation_status: 2, authorize_to_leave_preference: 0, shipping_channel_preference: 0, preferred_address_id: 0, vip_subscription_status: 1 } : (prev?.buyer_info || {}),
            cart_type: 1, checkout_scope: 0, client_id: 0, checkout_session_id: sessionId, checkout_page_id: "main_opc_page",
            buy_one_more: bom, svip_one_click_info: svip,
            tax_info: { tax_id: "" },
            client_event_info: first ? { is_fsv_changed: false, is_platform_voucher_changed: false } : { is_fsv_changed: false, is_platform_voucher_changed: false, recommend_shipping_preselect: false },
            ...(!first && prevSo ? { shipping_orders: prevSo } : {}),
            ...(!first && prev?.first_load_info ? { first_load_info: prev.first_load_info } : {}),
            ...(!first ? { display_meta_data: { shipping_orders_type: 0, hide_pmp_entrance: false }, order_update_info: {}, dropshipping_info: { enabled: false, phone_number: '', name: '' } } : {}),
            add_to_cart_info: {}, extra_data: first ? { snack_click_id: null } : { snack_click_id: null, translation_status: 0 }, _cft: CFT
        };
        return body;
    };

    const getBody = buildGetBody(true, null);

    try {
        logger.engine("CHECKOUT_GET", `Hit checkout/get [P1] » shop=${shopid} item=${itemid} model=${modelid} qty=${quantity}`, "INFO");
        // PHASE 1: first-load
        const p1Res = await axios.post('https://mall.shopee.co.id/api/v4/checkout/get', buildGetBody(true, null), { headers, timeout: 15000 });
        const p1 = p1Res.data;
        if (p1) p1.checkout_session_id = sessionId;

        // PHASE 2: Re-apply voucher menggunakan previous state (p1)
        let cd = p1;
        const priceOf = (r) => (r && r.checkout_price_data && (r.checkout_price_data.total_payable || r.checkout_price_data.merchandise_subtotal)) ? (r.checkout_price_data.total_payable || r.checkout_price_data.merchandise_subtotal) : 0;
        const hasVoucherSel = voucherOpts && (voucherOpts.platform || voucherOpts.shop || voucherOpts.fsv);
        
        if (p1 && !p1.error && hasVoucherSel) {
            logger.engine("CHECKOUT_GET", `[P2] re-apply voucher dengan prev state...`, "INFO");
            try {
                const p2Res = await axios.post('https://mall.shopee.co.id/api/v4/checkout/get', buildGetBody(false, p1), { headers, timeout: 15000 });
                const p2 = p2Res.data;
                if (p2) p2.checkout_session_id = sessionId;
                if (p2 && !p2.error && priceOf(p2) > 0) cd = p2;
                else logger.engine("CHECKOUT_GET", `[P2] kosong/invalid, pakai P1`, "WARN");
            } catch (e) { logger.engine("CHECKOUT_GET", `[P2] gagal: ${e.message}, pakai P1`, "WARN"); }
        }
        logger.engine("CHECKOUT_GET", `Response error=${cd.error || 'NULL'} can_checkout=${cd.can_checkout} total=${priceOf(cd)}`, cd.error ? "WARN" : "SUCCESS");

        if (cd.error) {
            let msg = cd.error_msg || `Checkout reject: ${cd.error}`;
            if (cd.error === 'error_params' || cd.error === 'error_client_update') {
                msg = "Data produk berubah (harga/stok/voucher). Coba ulangi atau ganti produk.";
            }
            logger.engine("CHECKOUT_GET_REJECT", `${cd.error}: ${(cd.error_msg || '').substring(0, 80)}`, "ERR");
            return { success: false, stage: 'get', msg };
        }

        const availableCouriers = [];
        const couriersByShop = {};
        let selectedCourierName = null;
        let selectedCourierId = null;

        const soShopId = (so) => {
            try {
                const idxs = so.shoporder_indexes || [];
                if (idxs.length && cd.shoporders && cd.shoporders[idxs[0]]) {
                    return parseInt(cd.shoporders[idxs[0]].shop?.shopid || cd.shoporders[idxs[0]].shopid);
                }
            } catch (e) {}
            return parseInt(shopid);
        };
        
        if (Array.isArray(cd.shipping_orders)) {
            cd.shipping_orders.forEach(so => {
                if (extraOpts && extraOpts.note != null) so.buyer_remark = String(extraOpts.note).substring(0, 200);
                const sid = soShopId(so);
                const channels = so.logistics?.logistic_channels || {};
                Object.keys(channels).forEach(cid => {
                    const ch = channels[cid];
                    const id = parseInt(cid);
                    const cdata = ch.channel_data || {};
                    const fee = ch.shipping_fee_data?.chargeable_shipping_fee ?? ch.shipping_fee_data?.shipping_fee_before_discount ?? 0;
                    const feeBefore = ch.shipping_fee_data?.shipping_fee_before_discount ?? fee;

                    const apiName = cdata.name || null;
                    const enabled = cdata.enabled !== false;
                    const cod = cdata.cod_supported === true;
                    if (!id) return;
                    if (!availableCouriers.find(x => x.id === id)) {
                        availableCouriers.push({ id, fee, feeBefore, name: apiName, enabled, cod, shopid: sid });
                    }
                    if (!couriersByShop[sid]) couriersByShop[sid] = [];
                    if (!couriersByShop[sid].find(x => x.id === id)) {
                        couriersByShop[sid].push({ id, fee, feeBefore, name: apiName, enabled, cod, shopid: sid });
                    }
                });

                const cm = extraOpts && extraOpts.courierMap;
                const perShopCid = cm && cm[sid];
                const chosenCid = perShopCid || (extraOpts && extraOpts.courierId);
                if (chosenCid && channels[chosenCid]) {
                    so.selected_logistic_channelid = chosenCid;
                }
                const activeCid = chosenCid || so.selected_logistic_channelid || so.logistics?.selected_logistic_channelid;
                if (activeCid && channels[activeCid] && !selectedCourierName) {
                    selectedCourierId = parseInt(activeCid);
                    selectedCourierName = channels[activeCid].channel_data?.name || COURIER_NAMES[parseInt(activeCid)] || `Kurir #${activeCid}`;
                }
                if (!selectedCourierName) {
                    const firstEnabled = Object.keys(channels).find(cid => channels[cid]?.channel_data?.enabled !== false);
                    if (firstEnabled) {
                        selectedCourierId = parseInt(firstEnabled);
                        selectedCourierName = channels[firstEnabled].channel_data?.name || COURIER_NAMES[parseInt(firstEnabled)] || `Kurir #${firstEnabled}`;
                    }
                }
            });
        }

        if (cd.can_checkout === false) {
            const reason = cd.disabled_checkout_info?.reason || "Akun/produk tidak memenuhi syarat checkout.";
            if (previewOnly) {
                return { success: true, preview: true, can_checkout: false, disabledReason: reason, totalPayment: 0, priceDetail: { merchandise: 0, shippingFee: 0, shippingDiscount: 0, voucherDiscount: 0, coinOffset: 0, insurance: 0, totalSavings: 0, totalPayment: 0, breakdown: [], appliedVoucherInfo: [] }, voucherChannelMap: {}, availableCouriers, couriersByShop, raw: cd };
            }
            return { success: false, stage: 'get', msg: reason };
        }

        const cpd = cd.checkout_price_data || {};
        const breakdown = cpd.price_breakdown || [];
        const merchandise = cpd.merchandise_subtotal || 0;
        const shippingFee = cpd.shipping_subtotal_before_discount || cpd.shipping_subtotal || 0;
        const shippingDiscount = cpd.shipping_discount_subtotal || 0;
        const voucherDiscount = (cpd.promocode_applied || 0) + (cpd.bundle_deals_discount || 0);
        const coinOffset = cpd.shopee_coins_redeemed || 0;
        const insurance = cpd.insurance_subtotal || 0;
        const totalSavings = cpd.total_savings || 0;
        const totalPayment = cpd.total_payable || (merchandise + shippingFee - shippingDiscount + insurance);

        const appliedVoucherInfo = [];
        (cd.promotion_data?.platform_vouchers || []).forEach(v => {
            appliedVoucherInfo.push({ code: v.voucher_code, scope: 'platform', valid: !v.invalid_message_code, msg: v.invalid_message || '', discount: v.discount_value || 0 });
        });
        (cd.promotion_data?.shop_vouchers || []).forEach(v => {
            appliedVoucherInfo.push({ code: v.voucher_code, scope: 'shop', valid: !v.invalid_message_code, msg: v.invalid_message || '', discount: v.discount_value || 0 });
        });

        const priceDetail = { merchandise, shippingFee, shippingDiscount, voucherDiscount, coinOffset, insurance, totalSavings, totalPayment, breakdown, appliedVoucherInfo };

        if (previewOnly) {
            const voucherChannelMap = {};
            const allVouchers = [
                ...(cd.promotion_data?.platform_vouchers || []),
                ...(cd.promotion_data?.shop_vouchers || []),
                ...(cd.promotion_data?.claimable_vouchers || [])
            ];

            allVouchers.forEach(v => {
                const code = v.voucher_code || v.applied_voucher_code;
                if (!code) return;
                voucherChannelMap[code] = !v.invalid_message_code;
            });
            return { success: true, preview: true, totalPayment, priceDetail, voucherChannelMap, availableCouriers, couriersByShop, selectedCourierName, selectedCourierId, szToken: realSzToken, sapri: realSapri, raw: cd };
        }

        // 🎫 VALIDATE VOUCHER DRAWER 
        if (voucherOpts && (voucherOpts.platform || voucherOpts.fsv)) {
            try {
                const toVal = [];
                if (voucherOpts.platform) toVal.push({ promotion_id: voucherOpts.platform.promotionid, voucher_code: voucherOpts.platform.code });
                if (voucherOpts.fsv) toVal.push({ promotion_id: voucherOpts.fsv.promotionid, voucher_code: voucherOpts.fsv.code });
                if (toVal.length) {
                    const vdRes = await axios.post('https://mall.shopee.co.id/api/v4/voucher_wallet/validate_voucher_drawer',
                        { validate_voucher_drawer_type: 1, platform_vouchers: toVal },
                        { headers: { ...headers, 'x-api-source': 'rn' }, timeout: 12000 });
                    const vd = vdRes.data;
                    if (vd && vd.error === 0) {
                        const rej = (vd.data?.platform_vouchers || []).filter(v => v.error_code !== 0);
                        if (rej.length) {
                            const rejCodes = new Set(rej.map(v => v.voucher_identifier?.voucher_code).filter(Boolean));
                            logger.engine("VOUCHER_VALIDATE", `Voucher ditolak drawer: ${[...rejCodes].join(', ')}`, "WARN");
                        } else {
                            logger.engine("VOUCHER_VALIDATE", `Semua voucher valid (drawer).`, "SUCCESS");
                        }
                    }
                }
            } catch (e) { logger.engine("VOUCHER_VALIDATE", `drawer skip: ${e.message}`, "WARN"); }
        }

        const placeBody = {
            timestamp: cd.timestamp || Math.floor(Date.now() / 1000),
            checkout_price_data: cd.checkout_price_data,
            promotion_data: cd.promotion_data,
            selected_payment_channel_data: cd.selected_payment_channel_data && cd.selected_payment_channel_data.payment_channelid ? cd.selected_payment_channel_data : buildPaymentChannelData(paymentChannel),
            shoporders: cd.shoporders,
            shipping_orders: cd.shipping_orders,
            fsv_selection_infos: cd.fsv_selection_infos || [],
            buyer_info: cd.buyer_info,
            device_info: getBody.device_info,
            device_type: "mobile",
            captcha_id: '', captcha_signature: '', captcha_version: 1,
            ignored_errors: [0], ignore_warnings: false,
            dropshipping_info: { enabled: false, phone_number: "", name: "" },
            order_update_info: {},
            display_meta_data: cd.display_meta_data || { shipping_orders_type: 0, hide_pmp_entrance: false },
            buy_one_more: cd.buy_one_more,
            first_load_info: cd.first_load_info,
            svip_one_click_info: cd.svip_one_click_info,
            banners: cd.banners || [],
            can_checkout: true,
            cart_type: cd.cart_type,
            checkout_scope: cd.checkout_scope,
            client_id: cd.client_id,
            checkout_session_id: cd.checkout_session_id,
            checkout_page_id: cd.checkout_page_id || "main_opc_page",
            tax_info: { tax_id: "" },
            client_event_info: { is_fsv_changed: false, is_platform_voucher_changed: false, recommend_shipping_preselect: false },
            add_to_cart_info: cd.add_to_cart_info || {},
            _cft: CFT
        };

        logger.engine("PLACE_ORDER", `Hit place_order (total Rp ${(totalPayment/100000).toLocaleString('id-ID')})...`, "INFO");
        const maxRetry = 3;
        let pd = null;

        placeBody.device_info = getBody.device_info;
        for (let attempt = 1; attempt <= maxRetry; attempt++) {
            placeBody.timestamp = Math.floor(Date.now() / 1000);

            const placeRes = await axios.post('https://mall.shopee.co.id/api/v4/checkout/place_order', placeBody, { headers, timeout: 20000 });
            pd = placeRes.data;

            if (!pd.error) break;
            const isFraud = String(pd.error).includes('fraud') || (pd.error_msg || '').includes('M01');
            const isCoupon = String(pd.error).includes('coupon');
            logger.engine("PLACE_ORDER", `Attempt ${attempt}/${maxRetry} » ${pd.error}${isFraud ? ' (retry...)' : ''}`, "WARN");
            if (!isFraud && !isCoupon) break;
            if (attempt < maxRetry) await new Promise(r => setTimeout(r, 2000));
        }

        if (pd.error) {
            logger.engine("PLACE_ORDER_REJECT", `${pd.error}: ${(pd.error_msg || '').substring(0, 80)}`, "ERR");
            let pmsg = pd.error_msg || `Place order reject: ${pd.error}`;
            if (String(pd.error).includes('fraud') || (pd.error_msg || '').includes('M01') || (pd.error_msg || '').includes('mencurigakan')) {
                pmsg = "🛡️ Shopee Anti-Fraud (M01): Akun terdeteksi mencurigakan (sudah retry 3x). Coba lagi nanti atau pakai akun lebih 'warm' (sudah ada transaksi).";
            } else if (String(pd.error).includes('coupon')) {
                pmsg = "🎟️ Voucher tidak valid untuk pesanan ini (error_coupon). Ganti/lepas voucher.";
            } else if (String(pd.error).includes('serviceability') || String(pd.error).includes('channel')) {
                pmsg = "🚚 Jasa kirim berubah saat checkout (serviceability changed). Buka menu <b>Pilih Kurir</b>, pilih ulang kurir, lalu coba bayar lagi.";
            }
            return { success: false, stage: 'place', msg: pmsg, totalPayment };
        }

        const orderId = (pd.orderids && pd.orderids.length ? pd.orderids[0] : null) || pd.checkoutid || pd.checkout_id || pd.order_id || (pd.data?.order_ids ? pd.data.order_ids[0] : null) || "CREATED";
        const checkoutId = pd.checkoutid || pd.checkout_id || (pd.data?.checkout_id) || orderId;
        logger.engine("PLACE_ORDER", `Order berhasil dibuat: ${orderId}`, "SUCCESS");
        return { success: true, orderId, checkoutId, totalPayment, coinOffset, raw: pd };

    } catch (err) {
        const status = err.response?.status;
        const raw = err.response?.data ? JSON.stringify(err.response.data).substring(0, 200) : err.message;
        logger.engine("CHECKOUT_CRITICAL", `HTTP ${status || '-'}: ${raw}`, "ERR");
        let msg = err.response?.data?.error_msg || err.message;
        if (status === 418) msg = "Shopee Anti-Bot (418). Sesi ditolak — login QR ulang / ganti akun.";
        return { success: false, stage: 'exception', msg };
    }
}

async function injectAddToCart(shopid, itemid, modelid, quantity, userCookie, identity) {
    const headers = {
        'Host': 'mall.shopee.co.id',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-API-Source': 'rn',
        'X-Sap-Type': '2',
        'X-Shopee-Language': 'id',
        'User-Agent': identity.ua,
        'Referer': 'https://mall.shopee.co.id/',
        'Cookie': userCookie,
        'X-Shopee-Client-Timezone': 'Asia/Jakarta',
        'Accept-Language': 'id-ID,id,en-US,en'
    };

    const body = {
        "quantity": parseInt(quantity),
        "donot_add_quantity": false,
        "client_source": 0,
        "shopid": parseInt(shopid),
        "itemid": parseInt(itemid),
        "modelid": parseInt(modelid)
    };

    try {
        const res = await axios.post('https://mall.shopee.co.id/api/v4/cart/add_to_cart', body, { headers, timeout: 12000 });

        if (res.data && res.data.error === 0) {
            return { success: true, cartData: res.data.data };
        }
        return { success: false, msg: res.data?.error_msg || `Shopee Reject (Code: ${res.data?.error})` };
    } catch (err) {
        return { success: false, msg: err.response?.data?.error_msg || err.message };
    }
}

async function fetchShopeePdpGet(shopid, itemid, userCookie, identity) {
    const { v4: uuidv4 } = require('uuid');

    const szToken = identity?.sz_token || "";
    const csrfToken = userCookie.split('csrftoken=')[1]?.split(';')[0] || "";
    const clientRequestId = `${uuidv4()}.${Math.floor(100 + Math.random() * 900)}`;

    const nativeUA = identity?.ua || "Android app Shopee appver=37528 app_type=1 platform=native_android os_ver=36 Cronet/102.0.5005.61";

    const headers = {
        'Host': 'mall.shopee.co.id',
        'Connection': 'keep-alive',
        'Accept': 'application/json',
        'x-api-source': 'rn',
        'x-shopee-language': 'id',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        'af-ac-enc-sz-token': szToken,
        'X-DFP': szToken,
        'Client-Request-Id': clientRequestId,
        'shopee_http_dns_mode': '1',
        'cache-control': 'no-cache, no-store',
        'User-Agent': nativeUA,
        'X-Shopee-Client-Timezone': 'Asia/Jakarta',
        'Referer': 'https://mall.shopee.co.id/',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cookie': userCookie
    };

    if (identity?.['af-ac-cli-id']) headers['af-ac-cli-id'] = identity['af-ac-cli-id'];
    if (identity?.['x-sap-ri']) headers['x-sap-ri'] = identity['x-sap-ri'];
    if (identity?.d3bed805) headers['d3bed805'] = identity.d3bed805;
    if (identity?.df091811) headers['df091811'] = identity.df091811;

    const qs = `_pft=8388607&closed_clip_session_ids=&closed_livestream_session_ids=&closed_video_item_ids=&incoming_pdp_page_scenario=0&incoming_pdp_page_source=0&item_id=${parseInt(itemid)}&pdp_type=0&shop_id=${parseInt(shopid)}&tz_offset_in_minutes=420`;

    try {
        const res = await axios.get(`https://mall.shopee.co.id/api/v4/pdp/get?${qs}`, { headers, timeout: 12000 });

        if (res.data && res.data.error === null && res.data.data && res.data.data.item) {
            const item = res.data.data.item;

            const normModels = (item.models || []).map(m => ({
                model_id: m.model_id,
                name: m.name,
                price: m.price,
                stock: (m.has_stock ? (m.normal_stock || m.stock || 99) : 0),
                is_selectable: (m.status === 1 && m.has_stock === true && m.is_grayout !== true)
            }));

            return {
                success: true,
                itemData: {
                    name: item.title || "Produk Shopee",
                    stock: item.stock || item.normal_stock || 99,
                    price: item.price || 0,
                    models: normModels
                }
            };
        }

        let errorReason = res.data?.error_msg || `Shopee Reject Code: ${res.data?.error}`;
        if (res.data?.error === 90309999) {
            errorReason = "Sesi Perangkat Akun Jenuh / Token Mismatch (90309999). Solusi: Hapus akun lalu Login QR ulang dengan device fresh!";
        }
        logger.engine("PDP_GET_REJECT", JSON.stringify(res.data).substring(0, 300), "ERR");
        return { success: false, msg: errorReason };

    } catch (err) {
        const status = err.response?.status;
        const serverErrorRaw = err.response?.data ? JSON.stringify(err.response.data).substring(0, 300) : err.message;
        logger.engine("PDP_GET_CRITICAL", `HTTP ${status || '-'}: ${serverErrorRaw}`, "ERR");
        let msg = err.response?.data?.error_msg || err.message;
        if (status === 418) msg = "Shopee Anti-Bot aktif (418). Sesi/token perangkat ditolak. Solusi: Login QR ulang atau ganti akun.";
        return { success: false, msg };
    }
}

async function fetchShopeeCartPanel(shopid, itemid, userCookie, identity) {
    const { v4: uuidv4 } = require('uuid');

    const szToken = identity?.sz_token || "";
    const csrfToken = userCookie.split('csrftoken=')[1]?.split(';')[0] || "";
    const clientRequestId = `${uuidv4()}.${Math.floor(100 + Math.random() * 900)}`;

    const headers = {
        'Host': 'mall.shopee.co.id',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-source': 'rn',
        'X-CSRFToken': csrfToken,
        'X-Requested-With': 'XMLHttpRequest',
        'af-ac-enc-sz-token': szToken,
        'X-DFP': szToken,
        'Client-Request-Id': clientRequestId,
        'User-Agent': identity.ua,
        'X-Shopee-Client-Timezone': 'Asia/Jakarta',
        'Referer': 'https://mall.shopee.co.id/',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cookie': userCookie
    };

    if (identity?.d3bed805) headers['d3bed805'] = identity.d3bed805;
    if (identity?.df091811) headers['df091811'] = identity.df091811;
    if (identity?.["2a25e7d0"]) headers['2a25e7d0'] = identity["2a25e7d0"];

    const body = {
        "item_id": parseInt(itemid),
        "shop_id": parseInt(shopid),
        "selected_tiers": null,
        "quantity": 1,
        "method": 1,
        "use_group_buy": false,
        "is_group_buy_new_group": false,
        "selected_spl": null,
        "selected_insurance_plans": [],
        "_pft": 16777215,
        "source": 0,
        "warranty_details": { "has_selected_warranty_product": false },
        "installation_details": { "has_selected_installation_product": false },
        "tz_offset_in_minutes": 420
    };

    try {
        const res = await axios.post('https://mall.shopee.co.id/api/v4/pdp/cart_panel/get', body, {
            headers,
            timeout: 10000
        });

        if (res.data && res.data.data && res.data.data.item) {
            return { success: true, itemData: res.data.data.item };
        }

        let errorReason = res.data?.error_msg || `Shopee Reject Code: ${res.data?.error}`;
        if (res.data?.error === 90309999) {
            errorReason = "Sesi Perangkat Akun Jenuh / Token Mismatch (90309999). Solusi: Re-login akun via QR bot kembali!";
        }

        logger.engine("CART_PANEL_REJECT", JSON.stringify(res.data), "ERR");
        return { success: false, msg: errorReason };

    } catch (err) {
        const serverErrorRaw = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        logger.engine("CART_PANEL_CRITICAL", serverErrorRaw, "ERR");
        return { success: false, msg: err.response?.data?.error_msg || err.message };
    }
}

function mapShopeeStatus(orderDetail) {
    const label = (
        orderDetail?.status?.list_view_status_label?.text ||
        orderDetail?.status?.status_label?.text ||
        orderDetail?.status?.text?.text ||
        ''
    ).toLowerCase();

    if (label.includes('to_pay') || label.includes('topay') || label.includes('unpaid')) return 'to_pay';
    if (label.includes('to_ship') || label.includes('to_process') || label.includes('packing') || label.includes('process')) return 'to_ship';
    if (label.includes('to_receive') || label.includes('shipping') || label.includes('shipped') || label.includes('delivered')) return 'to_receive';
    if (label.includes('completed') || label.includes('complete')) return 'completed';
    if (label.includes('cancel') || label.includes('return') || label.includes('refund')) return 'cancelled';
    return label || '';
}

async function fetchPaymentVA(cookie, checkoutId) {
    const csrf = cookie.split('csrftoken=')[1]?.split(';')[0] || '';
    const did = cookie.split('SPC_DID=')[1]?.split(';')[0] || cookie.split('SPC_F=')[1]?.split(';')[0] || '';
    try {
        const Hm = {
            host: 'mall.shopee.co.id', accept: 'application/json', 'x-csrftoken': csrf, 'content-type': 'application/json',
            'user-agent': 'shopee/3.70.30 (Linux;Android 12) ExoPlayerLib/2.18.1 app_type=1 platform=native_android os_ver=31 appver=37030',
            'x-api-source': 'native', referer: 'https://mall.shopee.co.id/', Cookie: cookie
        };
        const rr = await axios.post('https://mall.shopee.co.id/api/v4/mpp/get_payment_redirection',
            { checkout_id: parseInt(checkoutId), flow_source: 1, show_payment_confirmation_page: false, is_jko_app_installed: false, device_info: { device_id: did, device_fingerprint: did + '_unknown' } },
            { headers: Hm, timeout: 12000, validateStatus: () => true });
        const url = rr.data?.data?.redirect_url || '';
        const pid = url.match(/payment\/(\d+)/)?.[1];
        if (!pid) return { success: false };

        const Hw = {
            host: 'gw0.wsa.spm.shopee.co.id', accept: 'application/json', 'x-csrftoken': csrf, 'content-type': 'application/json',
            'user-agent': 'shopee/3.70.30 (Linux;Android 12) ExoPlayerLib/2.18.1 app_type=1 platform=native_android os_ver=31 appver=37030',
            'x-api-source': 'rn', Cookie: cookie
        };
        const r = await axios.post('https://gw0.wsa.spm.shopee.co.id/api/payment/init',
            { encrypted_payment_id: pid, holmes_collect_risk_info: JSON.stringify({ source: 'rn', app_type: 1, device_id: did }) },
            { headers: Hw, timeout: 12000, validateStatus: () => true });
        const td = r.data?.transify_data || {};
        const va = (td.virtual_account || '').replace(/\s/g, '');
        if (!va) return { success: false };
        return { success: true, va, bankName: td.bank_name || 'SeaBank', companyCode: td.company_code || '', phone: td.phone_number || '' };
    } catch (e) {
        return { success: false, msg: e.message };
    }
}

function normalizeShopeeOrders(rawList) {
    return (rawList || []).map(item => {
        if (item.order_list_detail) {
            const o = item.order_list_detail;
            const info = o.info_card || {};
            const card = (info.order_list_cards || [])[0] || {};
            const items = [];
            (card.product_info?.item_groups || []).forEach(g => (g.items || []).forEach(it => items.push(it)));
            if (items.length === 0 && Array.isArray(o.items)) items.push(...o.items);

            const canonical = mapShopeeStatus(o);
            const totalRaw = info.final_total ?? info.subtotal ?? o.total_payment_amount?.total_price ?? 0;

            return {
                order_list_detail: {
                    order_id: info.order_id || card.order_id || o.order_id || null,
                    status: { text: { text: canonical } },
                    status_label: o.status?.status_label?.text || '',
                    status_view_label: o.status?.list_view_status_label?.text || '',
                    items,
                    shop: { shop_name: card.shop_info?.shop_name || o.shop?.shop_name || '' },
                    total_payment_amount: { total_price: totalRaw },
                    product_count: info.product_count || items.length,
                    _raw: o
                }
            };
        }
        if (item.checkout_list_detail) {
            const cld = item.checkout_list_detail;
            const info = cld.info_card || {};

            const card = (info.order_list_cards || cld.order_cards || [])[0] || {};
            const items = [];
            (card.product_info?.item_groups || []).forEach(g => (g.items || []).forEach(it => items.push(it)));
            if (items.length === 0 && Array.isArray(card.items)) items.push(...card.items);
            const checkoutId = info.checkout_id || cld.checkout_info?.checkout_id || card.order_id || null;
            return {
                order_list_detail: {
                    order_id: checkoutId,
                    checkout_id: checkoutId,
                    status: { text: { text: 'to_pay' } },
                    status_label: 'label_to_pay',
                    status_view_label: 'label_to_pay',
                    items,
                    shop: { shop_name: card.shop_info?.shop_name || card.shop?.shop_name || '' },
                    total_payment_amount: { total_price: info.subtotal || cld.checkout_info?.total_price || 0 },
                    product_count: info.product_count || items.length
                }
            };
        }
        return item;
    });
}

async function fetchShopeeOrderList(cookie, deviceIdentity) {
    const cookieType = detectCookieType(cookie);
    logger.engine("ORDER_FETCH", `Cookie terdeteksi: ${cookieType.toUpperCase()}`, "INFO");

    const csrf = cookie.split('csrftoken=')[1]?.split(';')[0] || '';
    const headers = {
        'host': 'mall.shopee.co.id',
        'accept': 'application/json',
        'x-csrftoken': csrf,
        'content-type': 'application/json',
        'user-agent': 'shopee/3.70.30 (Linux;Android 12) ExoPlayerLib/2.18.1 app_type=1 platform=native_android os_ver=31 appver=37030',
        'x-api-source': 'rn',
        'x-shopee-language': 'id',
        'referer': 'https://mall.shopee.co.id/',
        'Cookie': cookie
    };

    try {
        const url = 'https://mall.shopee.co.id/api/v4/order/get_all_order_and_checkout_list?_oft=2048&limit=20&offset=0';
        const res = await axios.get(url, { headers, timeout: 12000, validateStatus: () => true });
        const payload = res.data?.new_data || res.data?.data || null;
        if (res.data?.error === 0 && payload) {
            const orders = normalizeShopeeOrders(payload.order_or_checkout_data || []);
            logger.engine("ORDER_OK", `Berhasil tarik ${orders.length} pesanan`, "SUCCESS");
            return { success: true, orders };
        }
        if (res.data?.error === 90309999) {
            return { success: false, msg: "Sesi tidak login (error 90309999). Cookie ter-logout. Hubungkan ulang akun." };
        }
        const code = res.data?.error;
        logger.engine("ORDER_FETCH", `Reject error=${code} msg=${res.data?.error_msg || '-'}`, "WARN");
        return { success: false, msg: res.data?.error_msg || (code !== undefined ? `API Error Code: ${code}` : "Sesi Kuki Mati / Expired. Perbarui kuki akun ini.") };
    } catch (err) {
        logger.engine("ORDER_FETCH", `HTTP ${err.response?.status || '-'}: ${err.message}`, "ERR");
        const status = err.response?.status;
        if (status === 418 || status === 403) {
            return { success: false, msg: `Anti-bot Shopee reject (HTTP ${status}). Coba ulang sebentar lagi.` };
        }
        return { success: false, msg: err.response?.data?.error_msg || err.message };
    }
}

async function fetchOrderDetail(cookie, orderId) {
    const csrf = cookie.split('csrftoken=')[1]?.split(';')[0] || '';
    const headers = {
        'host': 'mall.shopee.co.id',
        'accept': 'application/json',
        'x-csrftoken': csrf,
        'content-type': 'application/json',
        'user-agent': 'shopee/3.70.30 (Linux;Android 12) ExoPlayerLib/2.18.1 app_type=1 platform=native_android os_ver=31 appver=37030',
        'x-api-source': 'rn',
        'x-shopee-language': 'id',
        'referer': 'https://mall.shopee.co.id/',
        'Cookie': cookie
    };
    try {
        const url = `https://mall.shopee.co.id/api/v4/order/get_order_detail?_oft=2048&order_id=${orderId}`;
        const res = await axios.get(url, { headers, timeout: 12000, validateStatus: () => true });
        if (res.data?.error !== 0 || !res.data?.data) {
            return { success: false, msg: res.data?.error_msg || `Detail error: ${res.data?.error}` };
        }
        return { success: true, detail: parseOrderDetail(res.data.data, orderId) };
    } catch (err) {
        logger.engine("ORDER_DETAIL", `HTTP ${err.response?.status || '-'}: ${err.message}`, "ERR");
        return { success: false, msg: err.response?.data?.error_msg || err.message };
    }
}

const RUPIAH = (v) => `Rp ${Math.round((v || 0) / 100000).toLocaleString('id-ID')}`;
const TS = (sec) => sec ? new Date(sec * 1000).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '-';
const PAYMENT_NAMES = { 6: 'COD', 8: 'SeaBank', 1: 'Transfer Bank/VA' };
const INSTANT_CARRIERS = /instant|sameday|grab|gojek|gosend|gocar/i;

function parseOrderDetail(d, orderId) {
    const ic = d.info_card || {};
    const pc = (ic.parcel_cards || [])[0] || {};

    const apkShip = d.shipping || {};
    const webShip = d.pc_shipping || {};
    const webShipInfo = (webShip.forder_shipping_info_list || [])[0] || {};

    let trackingRaw = [];
    if (Array.isArray(webShipInfo.tracking_info_list) && webShipInfo.tracking_info_list.length) trackingRaw = webShipInfo.tracking_info_list;
    else if (Array.isArray(apkShip.tracking_info)) trackingRaw = apkShip.tracking_info;
    else if (apkShip.tracking_info && typeof apkShip.tracking_info === 'object') trackingRaw = [apkShip.tracking_info];
    const tracking = trackingRaw.map(t => ({ time: t.ctime, desc: t.description || '', driver_name: t.driver_name, driver_phone: t.driver_phone, plate: t.license_plate_number }));

    const items = [];
    (pc.product_info?.item_groups || []).forEach(g => {
        (g.items || []).forEach(it => {
            items.push({
                name: it.name || 'Produk',
                model: it.model_name || '',
                qty: it.amount || 1,
                price: it.order_price ?? it.item_price ?? 0
            });
        });
    });
    const itemsSum = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0);

    const carrierName = apkShip.fulfilment_carrier?.text || webShip.fulfilment_carrier?.text || pc.shipping_info?.carrier_name || '-';
    const maskedType = apkShip.masked_carrier?.text || webShip.masked_carrier?.text || '';
    const isInstant = INSTANT_CARRIERS.test(carrierName) || INSTANT_CARRIERS.test(maskedType);
    const trackingNumber = apkShip.tracking_number || webShipInfo.tracking_number || '';

    let driver = null;
    const dic = apkShip.driver_info_card;
    if (dic && (dic.driver_phone || (dic.driver_name && dic.driver_name !== 'Delivery Driver'))) {
        driver = { name: dic.driver_name, phone: dic.driver_phone, plate: dic.license_plate_number };
    }
    if (!driver) for (const t of tracking) {
        if (t.driver_phone || (t.driver_name && t.driver_name.length)) { driver = { name: t.driver_name, phone: t.driver_phone, plate: t.plate }; break; }
    }

    const noShipInfo = tracking.length === 0 || tracking.every(t => !t.desc) || tracking.some(t => /tidak ada informasi pengiriman/i.test(t.desc || ''));

    const payMethod = d.payment_method?.payment_method;
    const payName = d.payment_method?.payment_channel_name?.text || PAYMENT_NAMES[payMethod] || '-';

    const finalTotal = ic.final_total || ic.amount_paid || pc.payment_info?.total_price || itemsSum;

    return {
        orderId,
        shopName: pc.shop_info?.shop_name || '-',
        statusHeader: d.status?.header_text?.text || '',
        statusLabel: d.status?.status_label?.text || '',
        paymentMethod: payMethod,
        paymentName: payName,
        canChangePayment: d.payment_method?.can_change_payment_method,
        carrierName,
        maskedType,
        isInstant,
        driver,
        trackingNumber,
        tracking: tracking.map(t => ({ time: t.time, desc: t.desc })),
        noShipInfo,
        items,
        subtotal: ic.subtotal || itemsSum,
        finalTotal,
        codAmount: pc.extra_info?.cod_amount_to_pay || 0,
        coins: d.coins?.coin_earn || 0,
        cancelReason: d.status?.header_text?.text || ''
    };
}

function humanStatus(raw) {
    if (!raw) return 'Dibatalkan';
    const map = {
        'order_status_text_cancelled_by_buyer': 'Dibatalkan oleh Pembeli',
        'order_status_text_cancelled_by_seller': 'Dibatalkan oleh Penjual',
        'order_status_text_cancelled_by_system': 'Dibatalkan otomatis oleh Sistem (melewati batas waktu)',
        'order_status_text_cancelled': 'Dibatalkan',
        'label_order_cancelled': 'Dibatalkan',
        'order_status_text_to_pay_expired': 'Kedaluwarsa (belum dibayar)'
    };
    if (map[raw]) return map[raw];
    return raw.replace(/^(order_status_text_|label_order_|label_)/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderItems(items) {
    let s = `📦 RINCIAN BARANG:\n`;
    items.forEach(it => {
        const nm = it.model ? `${it.name} (${it.model})` : it.name;
        s += `${nm}\n  ${RUPIAH(it.price)} x${it.qty}\n`;
    });
    return s;
}

function renderOrderDetail(d, prefix) {
    const line = `------------------------------------\n`;
    const sep = `────────────────────────────────────\n`;

    if (prefix === 'det_unpaid_') {
        const isSea = /seabank/i.test(d.vaBank || d.paymentName || '');
        let t = `⚠️ <b>RINCIAN PESANAN (BELUM BAYAR)</b>\n\n`;
        t += `Status Pesanan: Menunggu Pembayaran${isSea ? ' VIA SEABANK' : ''}\n\n`;
        t += line;
        t += `🔴 <b>INFORMASI PEMBAYARAN ASLI SHOPEE:</b>\n`;
        t += `Metode Pembayaran: ${d.paymentName}\n`;
        if (d.va) {
            t += `🏦 Bank/VA: <b>${d.vaBank || 'Virtual Account'}</b>\n`;
            t += `🔢 No. VA: <code>${d.va}</code>\n`;
            if (d.vaCompanyCode) t += `🏢 Kode Perusahaan: <code>${d.vaCompanyCode}</code>\n`;
        }
        if (d.codAmount > 0) t += `Tagihan COD: ${RUPIAH(d.codAmount)}\n`;
        t += `Total Pembayaran: ${RUPIAH(d.finalTotal)}\n\n`;
        t += `<i>Selesaikan pembayaran sebelum kedaluwarsa agar pesanan tidak dibatalkan otomatis oleh Shopee.</i>\n`;
        t += line;
        t += `📋 No. Pesanan: <code>${d.orderId}</code>\n`;
        t += `🏪 Toko: ${d.shopName}\n\n`;
        t += renderItems(d.items);
        return t;
    }

    if (prefix === 'det_pack_') {
        if (d.noShipInfo) {
            let t = `⏳ <b>DETAIL PESANAN (STATUS: PENDING)</b>\n\n`;
            t += `Status Pesanan: Sedang Dikemas (Tertahan Kurir)\n\n`;
            t += line;
            t += `⚠️ <b>PERINGATAN:</b> Pesanan tertahan PENDING — belum ada informasi pengiriman. Kurir belum memproses manifest paket ini.\n`;
            t += line;
            t += `📋 No. Pesanan: <code>${d.orderId}</code>\n🏪 Toko: ${d.shopName}\n💰 Total Bayar: ${RUPIAH(d.finalTotal)}\n🚚 Opsi Kurir: ${d.carrierName}\n\n`;
            t += renderItems(d.items);
            return t;
        }
        let t = `✅ <b>DETAIL PESANAN (STATUS: SUKSES)</b>\n\n`;
        t += `Status Pesanan: Sedang Dikemas (Normal)\n\n`;
        t += line;
        t += `ℹ️ <b>INFO:</b> Pesanan aman & sukses. Kurir dan logistik Shopee terhubung normal untuk persiapan kirim.\n`;
        t += line;
        t += `📋 No. Pesanan: <code>${d.orderId}</code>\n🏪 Toko: ${d.shopName}\n💰 Total Bayar: ${RUPIAH(d.finalTotal)}\n🚚 Opsi Kurir: ${d.carrierName}\n\n`;
        t += renderItems(d.items);
        return t;
    }

    if (prefix === 'det_ship_') {
        const latest = d.tracking[0];
        if (d.isInstant) {
            let t = `🛵 <b>DETAIL PESANAN (PENGIRIMAN INSTANT)</b>\n\n`;
            t += `Status Pesanan: Driver Sedang Membawa Paket Anda\n\n`;
            t += line;
            t += `📞 <b>INFORMASI DRIVER:</b>\n`;
            t += `Ekspedisi: ${d.carrierName}\n`;
            if (d.driver) {
                t += `Nama Driver: ${d.driver.name || '-'}\n`;
                t += `No. HP Driver: ${d.driver.phone || '-'}\n`;
                if (d.driver.plate) t += `Plat: ${d.driver.plate}\n`;
            }
            if (d.trackingNumber) t += `No. Booking: ${d.trackingNumber}\n`;
            t += line;
            t += `📋 No. Pesanan: <code>${d.orderId}</code>\n🏪 Toko: ${d.shopName}\n🚚 Opsi Kurir: ${d.carrierName}\n💰 Total Bayar: ${RUPIAH(d.finalTotal)}\n\n`;
            t += renderItems(d.items);
            return t;
        }
        let t = `🚚 <b>DETAIL PESANAN (DALAM PENGIRIMAN)</b>\n\n`;
        t += `Status Pesanan: Produk Sedang Dikirim Kurir Ekspedisi\n\n`;
        t += line;
        t += `📍 <b>RIWAYAT PELACAKAN TERBARU:</b>\n`;
        if (latest) { t += `Waktu: ${TS(latest.time)}\n`; t += `Status: ${latest.desc}\n\n`; }
        t += `🎫 No. Resi: <code>${d.trackingNumber || '-'}</code>\n`;
        t += line;
        t += `📋 No. Pesanan: <code>${d.orderId}</code>\n🏪 Toko: ${d.shopName}\n🚚 Opsi Kurir: ${d.carrierName} (${d.maskedType || 'Reguler'})\n💰 Total Bayar: ${RUPIAH(d.finalTotal)}\n\n`;
        t += renderItems(d.items);
        if (d.tracking.length > 1) {
            t += `\n${sep}📋 RIWAYAT:\n`;
            d.tracking.slice(0, 5).forEach(tr => { t += `[${TS(tr.time)}] ${tr.desc}\n`; });
        }
        return t;
    }

    if (prefix === 'det_done_') {
        const doneTime = d.tracking[0]?.time;
        let t = `✅ <b>DETAIL PESANAN (TRANSAKSI SELESAI)</b>\n\n`;
        t += `📋 No. Pesanan: <code>${d.orderId}</code>\n`;
        t += `🏪 Toko: ${d.shopName}\n`;
        t += `💰 Total Belanja: ${RUPIAH(d.finalTotal)}\n`;
        t += `🚚 Kurir: ${d.carrierName}${d.trackingNumber ? ` | Resi: ${d.trackingNumber}` : ''}\n`;
        if (doneTime) t += `📅 Waktu Selesai: ${TS(doneTime)}\n`;
        t += `\n${line}`;
        t += renderItems(d.items);
        return t;
    }

    if (prefix === 'det_cancel_') {
        let t = `🚫 <b>DETAIL PESANAN (DIBATALKAN)</b>\n\n`;
        t += `📋 No. Pesanan: <code>${d.orderId}</code>\n`;
        t += `🏪 Toko: ${d.shopName}\n`;
        t += `💰 Nilai Transaksi: ${RUPIAH(d.finalTotal)}\n`;
        t += `⚠️ Alasan Batal: ${humanStatus(d.statusHeader)}\n`;
        t += `\n${line}`;
        t += renderItems(d.items);
        return t;
    }

    let t = `📋 <b>DETAIL PESANAN</b>\n\n`;
    t += `No. Pesanan: <code>${d.orderId}</code>\n🏪 ${d.shopName}\n💰 ${RUPIAH(d.finalTotal)}\n\n`;
    t += renderItems(d.items);
    return t;
}

const licenseCache = new Map();
const LICENSE_TTL_MS = 30000;

const EXPIRY_GRACE_MS = 5 * 60 * 1000;

function invalidateLicenseCache(userId) {
    licenseCache.delete(String(userId));
}

async function getAccessLicense(userId, opts = {}) {
    const key = String(userId);
    const now = Date.now();
    if (!opts.force) {
        const c = licenseCache.get(key);
        if (c && (now - c.ts) < LICENSE_TTL_MS) return c.value;
    }
    try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (error || !data || !data.expired_at) {
            logger.db("SELECT", "profiles", "FAIL / EXPIRED");
            const value = { active: false };
            licenseCache.set(key, { ts: now, value });
            return value;
        }
        const expMs = new Date(data.expired_at).getTime();
        const isActive = expMs > now;
        logger.db("SELECT", "profiles", isActive ? "ACTIVE PREMIUM" : "EXPIRED");
        if (!isActive && (now - expMs) > EXPIRY_GRACE_MS) {

            await clearExpiredAccounts(userId);
        }
        const value = { active: isActive, data };
        licenseCache.set(key, { ts: now, value });
        return value;
    } catch (e) {
        logger.engine("SYSTEM", `License Check Error: ${e.message}`, "ERR");
        return { active: false };
    }
}

async function getOwnedAccount(accId, userId, columns = '*') {
    const { data: acc } = await supabase
        .from('shopee_accounts')
        .select(columns)
        .eq('id', accId)
        .eq('user_id', String(userId))
        .maybeSingle();
    if (acc && acc.cookie) acc.cookie = decryptCookie(acc.cookie);
    return acc || null;
}

const clearedRecently = new Map();
const CLEAR_COOLDOWN_MS = 60000;

async function clearExpiredAccounts(userId) {
    const key = String(userId);
    const last = clearedRecently.get(key);
    if (last && (Date.now() - last) < CLEAR_COOLDOWN_MS) return;
    clearedRecently.set(key, Date.now());
    try {
        const { data: accs } = await supabase
            .from('shopee_accounts')
            .select('id')
            .eq('user_id', key);
        if (accs && accs.length) {
            await supabase.from('shopee_accounts').delete().eq('user_id', key);
            logger.db("DELETE", "shopee_accounts", `Auto-clear ${accs.length} cookie (membership expired) user ${userId}`);
        }
    } catch (e) {
        logger.engine("SYSTEM", `Auto-clear cookie gagal: ${e.message}`, "WARN");
    }
}

async function finalizeAccountSave(chatId, userId, pa, szToken, sapri) {
    try {
        const { error: insertErr } = await supabase.from('shopee_accounts').insert({
            user_id: userId,
            account_name: pa.username,
            cookie: encryptCookie(pa.cleanCookie),
            device_identity: { ...pa.identity, phone: pa.phone || null, device_id: pa.realDid, sz_token: szToken, x_sap_ri: sapri, sz_token_ts: szToken ? Date.now() : null }
        });
        if (insertErr) throw insertErr;
        logger.db("INSERT", "shopee_accounts", `Saved Real Account: ${pa.username}`);

        let successMsg = `🍪 <b>LOGIN COOKIE BERHASIL</b>\n`;
        successMsg += `<code>--------------------------</code>\n`;
        successMsg += `📌 <b>Username  :</b> <code>${pa.username}</code>\n`;
        successMsg += `📱 <b>No. HP    :</b> <code>${pa.phone || '-'}</code>\n`;
        successMsg += `🔑 <b>sz-token  :</b> <b>${szToken ? (szToken.startsWith(FALLBACK_SZ_PREFIX) ? 'Fallback' : 'Tersimpan ✓') : 'KOSONG (set nanti)'}</b>\n`;
        successMsg += `<code>--------------------------</code>\n`;
        successMsg += `📊 <b>Status    :</b> <i>Account Ready</i>${pa.profileNote || ''}\n`;
        successMsg += `<code>--------------------------</code>\n\n`;
        successMsg += `👇 <i>Klik tombol untuk lanjut.</i>`;

        delete userState[userId];
        return await safeEditMessage(chatId, pa.target_message_id || chatId, successMsg, {
            reply_markup: { inline_keyboard: [[{ text: "🏠 Kembali ke Menu Utama", callback_data: "back_home" }]] }
        });
    } catch (e) {
        delete userState[userId];
        return await safeSendMessage(chatId, `❌ <b>Gagal simpan akun:</b> <code>${e.message}</code>`);
    }
}

async function safeSendMessage(chatId, text, options = {}) {
    options.parse_mode = "HTML";
    try {
        return await bot.sendMessage(chatId, text, options);
    } catch (err) {
        if (err.response && err.response.statusCode === 429) {
            const retryAfter = (err.response.body.parameters.retry_after || 2) * 1000;
            logger.engine("TELEGRAM", `Rate limit terdeteksi! Cooling down ${retryAfter}ms...`, "WARN");
            await delay(retryAfter + 500);
            return await bot.sendMessage(chatId, text, options);
        }
        logger.engine("TELEGRAM", `Gagal kirim pesan: ${err.message}`, "ERR");
    }
}

async function safeEditMessage(chatId, messageId, text, options = {}) {
    options.parse_mode = "HTML";
    try {
        return await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...options });
    } catch (err) {
        if (err.response && err.response.statusCode === 429) {
            const retryAfter = (err.response.body.parameters.retry_after || 2) * 1000;
            logger.engine("TELEGRAM", `Rate limit edit terdeteksi! Cooling down ${retryAfter}ms...`, "WARN");
            await delay(retryAfter + 500);
            return await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...options });
        }
        if (!err.message.includes("message is not modified")) {
            logger.engine("TELEGRAM", `Gagal edit pesan: ${err.message}`, "ERR");
        }
    }
}

async function checkAccountSessionGate(chatId, accountId, accountName) {
    try {
        const { data: acc } = await supabase.from('shopee_accounts').select('*').eq('id', accountId).maybeSingle();

        if (!acc) return false;

        if (!isCookieAgeValid(acc.created_at)) {
            logger.engine("SYSTEM", `Sesi ${accountName} hangus (> 3 hari). Memulai proses auto-wipe...`, "WARN");

            await supabase.from('shopee_accounts').delete().eq('id', accountId);
            logger.db("DELETE", "shopee_accounts", `Wiped expired: ${accountName}`);

            let expMsg = `👤 <b>AKUN KELUAR / KEDALUWARSA!</b>\n`;
            expMsg += `<code>--------------------------</code>\n`;
            expMsg += `Sesi login untuk akun <b>${accountName}</b> sudah melebihi batas 3 hari.\n\n`;
            expMsg += `Demi keamanan sistem, cookie lama <b>telah dihapus otomatis</b> dari database.\n`;
            expMsg += `<code>--------------------------</code>\n`;
            expMsg += `📌 <b>Tindakan:</b> Silakan masukkan cookie baru yang fresh untuk akun ini!`;

            await safeSendMessage(chatId, expMsg, {
                reply_markup: { inline_keyboard: [[{ text: "🍪 Masukkan Cookie Baru", callback_data: "method_cookie" }]] }
            });
            return false;
        }
        return true;
    } catch (e) {
        logger.engine("SYSTEM", `Gagal validasi umur kuki: ${e.message}`, "ERR");
        return false;
    }
}

function validateAndParseShopeeCookie(rawCookieText) {
    if (!rawCookieText || typeof rawCookieText !== 'string') {
        return { success: false, reason: "Teks cookie kosong atau tidak valid." };
    }

    const whitelist = [
        "SPC_U", "csrftoken", "SPC_EC", "SPC_T_ID", "SPC_R_T_ID",
        "SPC_T_IV", "SPC_R_T_IV", "SPC_ST", "SPC_F", "SPC_SI",
        "SPC_SEC_SI", "SPC_CLIENTID", "REC_T_ID", "language",
        "SPC_DID", "SPC_DH", "shopee_token", "shopid", "userid", "SPC_RNBV", "shopee_app_version"
    ];

    const map = {};
    rawCookieText.split(';').forEach(pair => {
        const idx = pair.indexOf('=');
        if (idx === -1) return;
        const key = pair.slice(0, idx).trim();
        const val = pair.slice(idx + 1).trim();
        if (key) map[key] = val;
    });

    const coreRequired = ['SPC_U', 'csrftoken', 'SPC_EC'];
    const missing = coreRequired.filter(k => map[k] === undefined);
    if (missing.length > 0) {
        return { success: false, reason: `Parameter inti tidak lengkap. Kehilangan: [${missing.join(', ')}]` };
    }

    const cleanCookieString = whitelist
        .filter(k => map[k] !== undefined)
        .map(k => `${k}=${map[k]}`)
        .join('; ');

    return { success: true, cookie: cleanCookieString };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔥 FULL-ORDER ENGINE (Ported from full.js — voucher cutting capability)
// ═══════════════════════════════════════════════════════════════════════════════
function foIsWebCookie(s) { return !s.includes('SPC_DID=') && !s.includes('shopee_rn_version='); }

function foConvertWebToAppCookie(webCookieString) {
    const cookies = {};
    for (const m of webCookieString.matchAll(/([^=;\s]+)=([^;]*)/g)) cookies[m[1].trim()] = m[2].trim();
    const spcU = cookies['SPC_U'] || 'default_spc_u';
    const spcDid = crypto.createHash('sha256').update(`spc_did_${spcU}`).digest('base64').replace(/=+$/, '');
    const spcF = crypto.createHash('md5').update(`spc_f_${spcU}`).digest('hex').slice(0, 16) + '_unknown';
    const aftidHash = crypto.createHash('md5').update(`spc_aftid_${spcU}`).digest('hex');
    const spcAftid = `${aftidHash.slice(0,8)}-${aftidHash.slice(8,12)}-${aftidHash.slice(12,16)}-${aftidHash.slice(16,20)}-${aftidHash.slice(20,32)}`;
    const appVersion = cookies['shopee_app_version'] || '37525';
    const rnVersion = cookies['shopee_rn_version'] || '1780452288';
    const rnBundleVer = cookies['shopee_rn_bundle_version'] || '7007004';
    const uaEncoded = encodeURIComponent(`Shopee Android Beeshop locale/id version=${appVersion} appver=${appVersion}`);
    const appCookies = { userid: spcU, SPC_U: spcU, SPC_DID: spcDid, SPP_DEVICE_ID: spcDid, SPC_F: spcF, SPC_AFTID: spcAftid, shopee_app_version: appVersion, shopee_rn_version: rnVersion, shopee_rn_bundle_version: rnBundleVer, SPC_RNBV: rnBundleVer, UA: uaEncoded, language: 'id' };
    const keepKeys = ['SPC_EC','SPC_ST','SPC_SI','SPC_SEC_SI','csrftoken','SPC_T_ID','SPC_T_IV','SPC_R_T_ID','SPC_R_T_IV','SPC_CLIENTID','REC_T_ID','_QPWSDCXHZQA','REC7iLP4Q','_gcl_au','_med','_fbp','_ga','SC_DFP','CTOKEN','_sapid','shopee_webUnique_ccd','ds','_ga_SW6D8G0HXK','SPC_P_V','SPC_B_SI','shopee_token','SPP_PRODUCT_TOKEN_DP','AC_CERT_D','useragent'];
    for (const k of keepKeys) { if (cookies[k] && !appCookies[k]) appCookies[k] = cookies[k]; }
    return { cookie: Object.entries(appCookies).map(([k,v]) => `${k}=${v}`).join('; '), fingerprint: spcF };
}

function foExtractCsrfToken(cookie) { const m = cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/); return m ? m[1] : null; }

async function foCheckMyVoucher(cookie) {
    const headers = { host: "mall.shopee.co.id", accept: "application/json", 'content-type': "application/json", 'user-agent': getUA(cookie), cookie };
    const body = { exclude_user_voucher_list_type: [], voucher_status: 1, voucher_sort_flag: 6, cursor: '', limit: 500, addition: ["voucher_microsite_link"], version: 7, priority_voucher_list: null, need_statistics: true, show_red_dot: false };
    try {
        const res = await axios.post('https://mall.shopee.co.id/api/v2/voucher_wallet/get_user_voucher_list', body, { headers, timeout: 12000 });
        return { data: res.data };
    } catch (e) {
        return { data: { error: -1, error_msg: e.message } };
    }
}

function foIsVoucherCompatible(v, chId, optInfo) {
    const req = v.required_spm_channels;
    if (!req || !req.length) return true;
    return req.some(r => { if (r.spm_channel_id !== chId) return false; if (!r.spm_option_info || r.spm_option_info === '') return true; if (!optInfo) return false; return r.spm_option_info === optInfo; });
}

async function foValidateVoucherDrawer(cookie, csrf, vouchers) {
    const headers = { host: 'mall.shopee.co.id', accept: 'application/json', 'x-csrftoken': csrf, 'x-api-source': 'rn', 'content-type': 'application/json', 'user-agent': getUA(cookie), referer: 'https://mall.shopee.co.id/', cookie };
    const body = { validate_voucher_drawer_type: 1, platform_vouchers: vouchers.map(v => ({ promotion_id: v.promotionid || v.promotion_id, voucher_code: v.voucher_code })) };
    try {
        const res = await axios.post('https://mall.shopee.co.id/api/v4/voucher_wallet/validate_voucher_drawer', body, { headers, timeout: 12000 });
        return res.data;
    } catch (e) { return { error: -1, error_msg: e.message }; }
}

async function foPostCheckoutGet(cookie, csrf, shopId, itemId, modelId, qty, fp, fsvInfo, platVouchers, shopVouchers, payData, shipOrders, priceOvr, retries = 3, apply = false, prev = null, useCoins = false) {
    for (let i = 1; i <= retries; i++) {
        try {
            const did = (cookie.match(/SPC_F=([^;]+)/) || ['', ''])[1];
            const first = !prev;
            const ts = Date.now();
            const sid = prev?.checkout_session_id || (did + ':' + ts + ':' + (ts + Math.random()).toFixed(13));
            let fsvSel = [];
            if (fsvInfo?.free_shipping_voucher_id) {
                fsvSel = prev?.fsv_selection_infos?.length ? prev.fsv_selection_infos : [{ fsv_id: fsvInfo.free_shipping_voucher_id, selected_shipping_ids: [1], selected_combined_group_id: null, potentially_applied_shipping_ids: [1], potentially_applied_combined_group_ids: null }];
            }
            let so; if (prev?.shipping_orders?.length) so = prev.shipping_orders; else if (shipOrders) so = shipOrders;
            const bom = first ? { session_info: { session_id: sid, version: 0 }, fetch_mode: 1, display_mode: 0 } : { ...(prev?.buy_one_more || {}), session_info: { session_id: sid, version: 1 }, fetch_mode: 0, display_mode: 0 };
            const svip = first ? { status: 1, session_info: { session_id: sid, version: 0 } } : { ...(prev?.svip_one_click_info || {}), session_info: { session_id: sid, version: 0 } };
            const obj = {
                ...(first ? {} : { timestamp: prev.timestamp }),
                shoporders: [{ shop: { shopid: shopId }, items: [{ itemid: itemId, modelid: modelId, quantity: qty, add_on_deal_id: 0, is_add_on_sub_item: false, item_group_id: null, insurances: [], insurance_display: {}, channel_exclusive_info: { source_id: 0, token: '', is_live_stream: false, is_short_video: false, user_path_token: '', user_path_tokens: null, user_path_flag: 1 }, supports_free_returns: false, free_return_eligible: false, com_eligible: false, spu_info: { itemid: 0, modelid: 0, shopid: 0, quantity: 0 }, value_added_service_info: { installation_products: [], trade_in_products: [], warranty_products: first ? [{ product_id: null, selected: false }] : [] }, is_bom_item: false }], shipping_id: 1 }],
                selected_payment_channel_data: payData || {},
                promotion_data: { use_coins: !!useCoins, free_shipping_voucher_info: fsvInfo || {}, platform_vouchers: (platVouchers || []).map(v => ({ voucher_code: v.voucher_code, promotionid: v.promotionid })), shop_vouchers: shopVouchers || [], check_shop_voucher_entrances: true, auto_apply_shop_voucher: false, auto_apply_platform_voucher: first, auto_apply_spl_voucher: true, spl_voucher_info: null, claimable_vouchers: [] },
                device_info: { device_id: did, device_fingerprint: did + '_unknown', device_sz_fingerprint: fp || did, timezone_offset_in_minutes: 420 },
                device_type: 'mobile',
                buyer_info: first ? { kyc_info: null, checkout_email: '', spl_activation_status: 2, authorize_to_leave_preference: 0, shipping_channel_preference: 0, preferred_address_id: 0, vip_subscription_status: 1 } : (prev?.buyer_info || {}),
                cart_type: 1, checkout_scope: 0, client_id: 0, checkout_session_id: sid, checkout_page_id: 'main_opc_page',
                buy_one_more: bom, svip_one_click_info: svip,
                tax_info: { tax_id: '' },
                client_event_info: first ? { is_fsv_changed: false, is_platform_voucher_changed: false } : { is_fsv_changed: false, is_platform_voucher_changed: false, recommend_shipping_preselect: false },
                fsv_selection_infos: fsvSel,
                ...(so && !first ? { shipping_orders: so } : {}),
                ...(!first && prev?.first_load_info ? { first_load_info: prev.first_load_info } : {}),
                ...(!first ? { display_meta_data: { shipping_orders_type: 0, hide_pmp_entrance: false }, order_update_info: {}, dropshipping_info: { enabled: false, phone_number: '', name: '' } } : {}),
                add_to_cart_info: {}, extra_data: first ? { snack_click_id: null } : { snack_click_id: null, translation_status: 0 },
                _cft: [4227792767, 1060634367, 4194238]
            };
            const headers = { host: 'mall.shopee.co.id', accept: 'application/json', 'x-csrftoken': csrf, 'x-shopee-language': 'id', 'x-requested-with': 'com.shopee.id', 'content-type': 'application/json', 'user-agent': getUA(cookie), 'X-Api-Source': 'rn', 'af-ac-enc-sz-token': fp || '', referer: 'https://mall.shopee.co.id/', cookie };
            const res = await axios.post('https://mall.shopee.co.id/api/v4/checkout/get', obj, { headers, timeout: 15000 });
            const j = res.data;
            if (j) j.checkout_session_id = sid;
            return j;
        } catch (e) { if (i < retries) { await new Promise(r => setTimeout(r, 500 * i)); continue; } return { error: -1, error_msg: e.message }; }
    }
}

async function foPostPlaceOrder(cookie, csrf, coResp, sz, payData, fsvInfo, platV, shopV, useCoins = false) {
    const did = (cookie.match(/SPC_F=([^;]+)/) || ['', ''])[1];
    const p = coResp.promotion_data || {};
    const pv = platV?.length ? platV : (p.platform_vouchers || []).filter(v => !v.invalid_message || v.invalid_message_code === 0);
    const sv = shopV || p.shop_vouchers || [];
    const fsv = fsvInfo?.free_shipping_voucher_id ? fsvInfo : (p.free_shipping_voucher_info || {});
    const body = {
        client_id: 5, checkout_page_id: 'main_opc_page', checkout_scope: 0, cart_type: 1,
        timestamp: coResp.timestamp, loan_summary: null, checkout_price_data: coResp.checkout_price_data,
        order_update_info: {}, dropshipping_info: { enabled: false, phone_number: '', name: '' },
        promotion_data: { can_use_coins: p.can_use_coins || false, use_coins: !!useCoins, platform_vouchers: pv, shop_vouchers: sv, free_shipping_voucher_info: fsv, spl_voucher_info: null, auto_apply_shop_voucher: false, auto_apply_platform_voucher: false, highlighted_platform_voucher_type: p.highlighted_platform_voucher_type || 0, platform_voucher_entrance: p.platform_voucher_entrance || { labels: [{ image: '', type: 1 }] }, applied_voucher_code: p.applied_voucher_code || null, voucher_code: p.voucher_code || null, voucher_info: p.voucher_info || { coin_earned: 0, voucher_code: null, coin_percentage: 0, discount_percentage: 0, discount_value: 0, promotionid: 0, reward_type: 0, used_price: 0 }, invalid_message: p.invalid_message || null, price_discount: p.price_discount || 0, coin_info: p.coin_info || { coin_breakdown: 0, coin_offset: 0, coin_used: 0, coin_earn: 0, coin_earn_by_voucher: 0, coin_earn_by_maricredit: 0, coin_earn_rate_by_maricredit: 0 }, card_promotion_id: p.card_promotion_id || null, card_promotion_enabled: p.card_promotion_enabled || false, shop_voucher_entrances: p.shop_voucher_entrances || [] },
        selected_payment_channel_data: payData, shoporders: coResp.shoporders, shipping_orders: coResp.shipping_orders, shipping_order_groups: [],
        display_meta_data: coResp.display_meta_data || { shipping_orders_type: 0, hide_pmp_entrance: false },
        fsv_selection_infos: coResp.fsv_selection_infos || [], buyer_info: coResp.buyer_info, client_event_info: coResp.client_event_info,
        captcha_id: '', captcha_signature: '', captcha_version: 1,
        buyer_txn_fee_info: coResp.buyer_txn_fee_info, disabled_checkout_info: coResp.disabled_checkout_info, can_checkout: true,
        buyer_service_fee_info: coResp.buyer_service_fee_info, iof_info: { iof_msg: '', learn_more_url: '' },
        add_to_cart_info: {}, extra_data: { snack_click_id: null }, banners: coResp.banners || [],
        buy_one_more: coResp.buy_one_more, first_load_info: coResp.first_load_info, svip_one_click_info: coResp.svip_one_click_info,
        ignored_errors: [0], ignore_warnings: false,
        device_info: { device_id: did, device_fingerprint: did, device_sz_fingerprint: sz },
        device_type: 'mobile', _cft: coResp._cft || [4227792767, 3208118015, 2239627198], checkout_session_id: coResp.checkout_session_id || ''
    };
    const headers = { host: 'mall.shopee.co.id', accept: 'application/json', 'x-csrftoken': csrf, 'x-shopee-language': 'id', 'x-requested-with': 'com.shopee.id', 'content-type': 'application/json', 'user-agent': getUA(cookie), 'X-Api-Source': 'rn', 'af-ac-enc-sz-token': sz, referer: 'https://mall.shopee.co.id/', cookie };
    try {
        const res = await axios.post('https://mall.shopee.co.id/api/v4/checkout/place_order', body, { headers, timeout: 20000 });
        return { response: res.data, checkoutid: res.data?.checkoutid };
    } catch (e) { return { response: { error: -1, error_msg: e.message } }; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔥 FULL-ORDER FLOW HELPERS (Checkout Init, Voucher Page, FSV, Final, Place)
// ═══════════════════════════════════════════════════════════════════════════════
// Fingerprint pool JSON management
const FP_POOL_FILE = pathMod.join(__dirname, 'fingerprint_pool.json');
function loadFpPool() { try { return JSON.parse(fsMod.readFileSync(FP_POOL_FILE, 'utf8')); } catch (e) { return []; } }
function saveFpToPool(fp) { if (!fp || fp.length < 5) return; const pool = loadFpPool(); if (pool.includes(fp)) return; pool.push(fp); fsMod.writeFileSync(FP_POOL_FILE, JSON.stringify(pool, null, 2)); }
function getRandomFpFromPool() { const pool = loadFpPool(); if (!pool.length) return null; return pool[Math.floor(Math.random() * pool.length)]; }

async function foDoCheckoutInit(chatId, userId, msgId) {
    const us = userState[userId];
    const cookie = us.foCookie;
    const fp = us.foFingerprint;
    const csrf = foExtractCsrfToken(cookie);
    us.foCsrf = csrf;

    const cart = us.cart || [];
    const firstItem = cart[0];
    if (!firstItem) return await safeEditMessage(chatId, msgId, "❌ Keranjang kosong.");

    await safeEditMessage(chatId, msgId, `⏳ <b>PROCESSING</b>\n<code>--------------------------</code>\n🔄 Inisialisasi checkout...\n📡 Mengambil payment & kurir...\n<code>--------------------------</code>`);
    us.fo_msg_id = msgId;
    logger.engine("FO_CHECKOUT_INIT", `Hit checkout/get [P1] shop=${firstItem.shopid} item=${firstItem.itemid} model=${firstItem.modelid} qty=${firstItem.quantity}`, "INFO");

    try {
        const co0 = await foPostCheckoutGet(cookie, csrf, firstItem.shopid, firstItem.itemid, firstItem.modelid, firstItem.quantity, fp, {}, [], [], {}, null, null, 3, false);
        if (!co0 || co0.error) {
            logger.engine("FO_CHECKOUT_INIT", `checkout/get gagal: ${co0?.error_msg || co0?.error || 'unknown'}`, "ERR");
            return await safeEditMessage(chatId, msgId, `❌ Gagal checkout/get:\n<code>${co0?.error_msg || JSON.stringify(co0?.error || 'unknown')}</code>`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] } });
        }
        logger.engine("FO_CHECKOUT_INIT", `Response OK can_checkout=${co0.can_checkout || 'true'} total=${co0.checkout_price_data?.total_payable || 0}`, "SUCCESS");
        us.foCo0 = co0;

        // Extract shipping/logistics channels with COURIER_NAMES
        const shippingOrders = co0.shipping_orders || [];
        const foShipChannels = [];
        shippingOrders.forEach(so => {
            const logCh = so.logistics?.logistic_channels || {};
            Object.keys(logCh).forEach(cid => {
                const ch = logCh[cid];
                const chData = ch.channel_data || ch;
                const cidInt = parseInt(cid);
                let fee = 0;
                if (ch.shipping_fee_data?.chargeable_shipping_fee !== undefined) fee = ch.shipping_fee_data.chargeable_shipping_fee;
                else if (ch.shipping_fee_data?.shipping_fee_before_discount !== undefined) fee = ch.shipping_fee_data.shipping_fee_before_discount;
                else if (chData.price !== undefined) fee = chData.price;
                const name = courierLabel(cidInt, chData.name || ch.name);
                foShipChannels.push({ id: cidInt, name, fee, enabled: ch.enabled !== false });
            });
        });
        us.foShipChannels = foShipChannels;
        const defLogId = shippingOrders[0]?.selected_logistic_channelid || (foShipChannels.find(c => c.enabled)?.id) || null;
        us.foLogistic = defLogId;
        us.foLogisticName = defLogId ? courierLabel(defLogId, foShipChannels.find(c => c.id === defLogId)?.name) : 'Default';
        us.foLogisticFee = foShipChannels.find(c => c.id === defLogId)?.fee || 0;
        logger.engine("FO_CHECKOUT", `Kurir: ${us.foLogisticName} | Channels: ${foShipChannels.length}`, "INFO");

        // Fetch coin balance
        try {
            const coinRes = await getShopeeCoinBalance(cookie, { sz_token: fp, ua: getUA(cookie) });
            us.foCoinBalance = coinRes.coinBalance || 0;
        } catch (e) { us.foCoinBalance = 0; }

        const channels = co0.payment_channel_info?.channels || [];
        const payArr = [];
        channels.forEach(a => {
            if (a.channel_id === 8002050) return;
            if (a.banks?.length) {
                a.banks.forEach(b => { payArr.push({ name: b.bank_name, icon: '🏦', obj: { version: a.version || 2, option_info: a.option_info || '', channel_id: a.channel_id, channel_item_option_info: { option_info: b.option_info || '' }, text_info: {}, ros_opt_in: false, name: a.name }, spm_channel_id: a.channel_id, spm_option_info: b.option_info || '' }); });
            } else if (a.channelid === 89000 || a.name === 'COD') {
                payArr.push({ name: 'COD', icon: '🏪', obj: { payment_channelid: a.channelid || 89000, channel_item_option_info: { option_info: null }, credit_card_data: null, cc_installment_data: {}, ros_opt_in: false, additional_info: {} }, spm_channel_id: 89000, spm_option_info: null });
            } else {
                let icon = '💳';
                if (a.name?.includes('ShopeePay')) icon = '🏧';
                else if (a.name?.includes('SPayLater')) icon = '📅';
                else if (a.name?.includes('QRIS')) icon = '📱';
                else if (a.name?.includes('Transfer')) icon = '🏦';
                else if (a.name?.includes('Kartu')) icon = '💳';
                payArr.push({ name: a.name, icon, obj: { version: a.version || 2, option_info: a.option_info || '', channel_id: a.channel_id, channel_item_option_info: { option_info: a.option_info || '' }, text_info: {}, ros_opt_in: false, name: a.name }, spm_channel_id: a.channel_id, spm_option_info: a.option_info || '' });
            }
        });
        us.foPayArr = payArr;
        us.foPayIdx = 0;
        us.foPayment = payArr[0]?.obj || {};
        us.foSpmChId = payArr[0]?.spm_channel_id || 89000;
        us.foSpmOpt = payArr[0]?.spm_option_info || null;
        us.foUseCoins = true;

        us.step = "FO_SELECT_PAY";
        return await foShowPaymentPage(chatId, msgId, userId);
    } catch (e) {
        await safeEditMessage(chatId, msgId, `❌ Error: ${e.message}`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] } });
    }
}

async function foShowPaymentPage(chatId, msgId, userId) {
    const us = userState[userId];
    const payArr = us.foPayArr || [];
    const selIdx = us.foPayIdx || 0;
    const firstItem = us.cart[0];

    let txt = `💳 <b>PILIH METODE PEMBAYARAN</b>\n<code>--------------------------</code>\n`;
    txt += `🔢 Kuantitas : <b>${firstItem.quantity} Pcs</b>\n`;
    txt += `✅ Terpilih  : <b>${payArr[selIdx]?.icon || '💳'} ${payArr[selIdx]?.name || 'Default'}</b>\n\n`;
    txt += `<i>Pilihan metode akan memfilter voucher yang valid.\nDefault: ${payArr[0]?.name || 'COD'}.</i>\n`;
    txt += `<code>--------------------------</code>`;

    const kb = [];
    for (let i = 0; i < payArr.length; i += 2) {
        const row = [];
        row.push({ text: `${i === selIdx ? '✅' : payArr[i].icon} ${payArr[i].name}`, callback_data: `fo_pay_${i}` });
        if (payArr[i + 1]) row.push({ text: `${(i + 1) === selIdx ? '✅' : payArr[i + 1].icon} ${payArr[i + 1].name}`, callback_data: `fo_pay_${i + 1}` });
        kb.push(row);
    }
    kb.push([{ text: '🎟️ LANJUT PILIH VOUCHER ▶️', callback_data: 'fo_goto_voucher' }]);
    kb.push([{ text: '❌ Batal', callback_data: 'back_home' }]);

    await safeEditMessage(chatId, msgId, txt, { reply_markup: { inline_keyboard: kb } });
}

async function foDoVouchers(chatId, msgId, userId) {
    const us = userState[userId];
    const cookie = us.foCookie;

    await safeEditMessage(chatId, msgId, `⏳ <b>Mengambil voucher wallet...</b>`);
    logger.engine("FO_VOUCHER", `Fetching voucher wallet...`, "INFO");
    try {
        const vr = await foCheckMyVoucher(cookie);
        const all = vr.data?.data?.user_voucher_list || vr.data?.user_voucher_list || [];
        us.foFsvList = all.filter(a => a.voucher_code?.toUpperCase().startsWith('FSV'));
        const platAll = all.filter(a => a.voucher_code && !a.voucher_code.toUpperCase().startsWith('FSV'));
        us.foCompatPV = platAll.filter(v => foIsVoucherCompatible(v, us.foSpmChId, us.foSpmOpt));
        us.foPvHidden = platAll.length - us.foCompatPV.length;
        logger.engine("FO_VOUCHER", `Total: ${all.length} | Compatible PV: ${us.foCompatPV.length} | FSV: ${us.foFsvList.length} | Hidden: ${us.foPvHidden}`, "SUCCESS");
        if (!us.foSelPV) us.foSelPV = [];
        if (!us.foSelFsv) us.foSelFsv = null;
        us.step = 'FO_VOUCHER_PAGE';
        us.fo_msg_id = msgId;
        return await foShowVoucherPage(chatId, msgId, userId);
    } catch (e) { await safeEditMessage(chatId, msgId, `❌ Error: ${e.message}`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] } }); }
}

async function foShowVoucherPage(chatId, msgId, userId) {
    const us = userState[userId];
    const payName = us.foPayArr?.[us.foPayIdx]?.name || 'Default';
    const coinBalance = us.foCoinBalance || 0;
    const selPV = us.foSelPV || [];
    const selFsv = us.foSelFsv;
    const compatPV = us.foCompatPV || [];
    const fsvList = us.foFsvList || [];
    const kurirName = us.foLogisticName || 'Default';
    const kurirFee = us.foLogisticFee || 0;
    const buyerNote = us.foBuyerNote || null;
    const shopVoucher = us.foCo0?.promotion_data?.shop_vouchers?.[0]?.voucher_code || null;

    // Sort vouchers: recommended first (has reward_type or higher discount), then by discount %
    const sortedPV = [...compatPV].sort((a, b) => {
        const aRec = a.is_recommend ? 1 : 0;
        const bRec = b.is_recommend ? 1 : 0;
        if (bRec !== aRec) return bRec - aRec;
        const aPct = a.discount_percentage || a.reward_percentage || 0;
        const bPct = b.discount_percentage || b.reward_percentage || 0;
        return bPct - aPct;
    });

    let txt = `🎫 <b>PILIH VOUCHER</b>\n<code>--------------------------</code>\n`;
    txt += `💳 Pembayaran   : 🏦 <b>${payName}</b>\n`;
    txt += `🪙 Pakai Koin  : <b>${us.foUseCoins ? 'OTOMATIS (pakai jika ada)' : 'OFF'}</b>\n`;
    txt += `💰 Saldo Koin  : <b>${coinBalance ? coinBalance.toLocaleString('id-ID') + ' Koin' : '0 Koin'}</b>\n`;
    txt += `🚚 Kurir       : <b>${kurirName}</b>\n`;
    txt += `🚛 Ongkir Kurir : <b>Rp ${(kurirFee / 100000).toLocaleString('id-ID')}</b>\n`;
    if (shopVoucher) txt += `🏷️ Voucher Produk: <b>${shopVoucher}</b>\n`;
    txt += `🎟️ Voucher Ongkir: <b>${selFsv ? 'Gratis Ongkir' : 'Belum dipilih'}</b>\n`;
    txt += `📝 Catatan     : <b>${buyerNote || 'Tanpa catatan'}</b>\n`;
    txt += `<code>--------------------------</code>\n`;
    txt += `<i>Pilih voucher lalu tekan PREVIEW HARGA.</i>`;

    const kb = [];
    sortedPV.slice(0, 10).forEach((v, i) => {
        const origIdx = compatPV.indexOf(v);
        const pct = v.discount_percentage || v.reward_percentage || 0;
        const cap = (v.discount_cap || v.reward_cap || 0) / 100000;
        const min = (v.min_spend || 0) / 100000;
        const selected = selPV.some(x => x.voucher_code === v.voucher_code);
        const locked = v.device_gated ? '🔒 ' : '';
        const prefix = selected ? '✅' : '🎁';
        let label = `${prefix} ${locked}${pct}% (maks Rp ${cap.toLocaleString('id-ID')})`;
        if (min) label += ` (min ${min.toLocaleString('id-ID')})`;
        kb.push([{ text: label, callback_data: `fo_pv_${origIdx}` }]);
    });

    fsvList.slice(0, 5).forEach((v, i) => {
        const selected = selFsv && selFsv.voucher_code === v.voucher_code;
        kb.push([{ text: `${selected ? '✅' : '🚛'} Gratis Ongkir (FSV-${v.promotionid || v.promotion_id || v.voucher_code.substring(0, 20)})`, callback_data: `fo_fsv_${i}` }]);
    });

    const coinLabel = coinBalance ? ` (${coinBalance.toLocaleString('id-ID')})` : '';
    kb.push([{ text: `💳 Ubah Pembayaran`, callback_data: 'fo_back_pay' }, { text: `🪙 Koin: ${us.foUseCoins ? 'AUTO' : 'OFF'}${coinLabel}`, callback_data: 'fo_toggle_coins' }]);
    kb.push([{ text: '📦 Pilih Kurir', callback_data: 'fo_pick_courier' }, { text: '📝 Catatan Seller', callback_data: 'fo_set_note' }]);
    kb.push([{ text: '🧹 Reset Voucher', callback_data: 'fo_reset_voucher' }, { text: '💰 PREVIEW HARGA', callback_data: 'fo_preview_price' }]);
    kb.push([{ text: '❌ Batalkan', callback_data: 'back_home' }]);

    await safeEditMessage(chatId, msgId, txt, { reply_markup: { inline_keyboard: kb } });
}

async function foDoFinalCheckout(chatId, msgId, userId) {
    const us = userState[userId];
    const cookie = us.foCookie;
    const fp = us.foFingerprint;
    const csrf = us.foCsrf;
    const firstItem = us.cart[0];

    await safeEditMessage(chatId, msgId, '⏳ <b>Validate voucher & checkout final...</b>');
    try {
        const toVal = [...(us.foSelPV || []), ...(us.foSelFsv ? [{ promotionid: us.foSelFsv.promotionid, voucher_code: us.foSelFsv.voucher_code }] : [])];
        if (toVal.length) {
            const vr = await foValidateVoucherDrawer(cookie, csrf, toVal);
            if (vr?.error === 0) {
                const rej = (vr.data?.platform_vouchers || []).filter(v => v.error_code !== 0);
                if (rej.length) {
                    const rc = new Set(rej.map(v => v.voucher_identifier?.voucher_code).filter(Boolean));
                    us.foSelPV = (us.foSelPV || []).filter(v => !rc.has(v.voucher_code));
                    if (us.foSelFsv && rc.has(us.foSelFsv.voucher_code)) us.foSelFsv = null;
                }
            }
        }

        const fsvInfo = us.foSelFsv ? { free_shipping_voucher_id: us.foSelFsv.promotionid, free_shipping_voucher_code: us.foSelFsv.voucher_code } : {};
        const so = us.foLogistic ? [{ sync: true, logistics: { channelid: us.foLogistic } }] : null;
        const coF = await foPostCheckoutGet(cookie, csrf, firstItem.shopid, firstItem.itemid, firstItem.modelid, firstItem.quantity, fp, fsvInfo, us.foSelPV || [], [], us.foPayment, so, null, 3, true, us.foCo0, us.foUseCoins);
        if (!coF || coF.error) {
            return await safeEditMessage(chatId, msgId, `❌ Gagal checkout final:\n<code>${coF?.error_msg || JSON.stringify(coF?.error || '')}</code>`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] } });
        }
        // Apply buyer note to shipping orders
        if (us.foBuyerNote && coF.shipping_orders) {
            coF.shipping_orders.forEach(so => { so.buyer_remark = us.foBuyerNote; });
        }
        us.foCoFinal = coF;
        us.foFsvInfo = fsvInfo;

        const rp = coF.promotion_data || {};
        let hasInv = false, invV = [], valV = [];
        (rp.platform_vouchers || []).forEach(pv => { if (pv.invalid_message) { hasInv = true; invV.push(pv); } else valV.push(pv); });
        us.foValidPV = valV.map(pv => ({ voucher_code: pv.voucher_code, promotionid: pv.promotionid }));

        if (hasInv) {
            let t = `⚠️ <b>VOUCHER MISMATCH</b>\n<code>--------------------------</code>\n`;
            invV.forEach(pv => { t += `❌ ${pv.voucher_code}\n   ${pv.invalid_message || 'invalid'}\n`; });
            t += `<code>--------------------------</code>\nPilih aksi:`;
            const kb = [[{ text: '🗑️ Hapus invalid, lanjut', callback_data: 'fo_vf_rem_inv' }], [{ text: '❌ Hapus semua voucher', callback_data: 'fo_vf_rem_all' }], [{ text: '🚫 Batalkan', callback_data: 'fo_vf_cancel' }]];
            return await safeEditMessage(chatId, msgId, t, { reply_markup: { inline_keyboard: kb } });
        }

        return await foShowFinalSummary(chatId, msgId, userId, coF, valV);
    } catch (e) { await safeEditMessage(chatId, msgId, `❌ Error: ${e.message}`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] } }); }
}

async function foShowFinalSummary(chatId, msgId, userId, coF, valV) {
    const us = userState[userId];
    const cart = us.cart || [];
    const isMulti = cart.length > 1;
    const pd = coF.checkout_price_data || {};
    const rp = coF.promotion_data || {};
    const payName = us.foPayArr?.[us.foPayIdx]?.name || 'Default';
    const fsvCode = rp.free_shipping_voucher_info?.free_shipping_voucher_code || us.foSelFsv?.voucher_code || '';
    const coinUsed = rp.coin_info?.coin_used || 0;

    const RUPIAH = (v) => `Rp ${((v || 0) / 100000).toLocaleString('id-ID')}`;

    let txt = `📝 <b>RINGKASAN AKHIR CHECKOUT (${isMulti ? 'MULTI-ORDER' : 'SINGLE ORDER'})</b>\n`;
    txt += `<code>--------------------------</code>\n`;

    // Per-shop/item detail like SS8
    const byShop = {};
    cart.forEach(c => { const sid = c.shopid || 'unknown'; if (!byShop[sid]) byShop[sid] = { name: c.shopName || `Shop ${sid}`, items: [] }; byShop[sid].items.push(c); });
    const shopKeys = Object.keys(byShop);
    shopKeys.forEach((sid, si) => {
        const shop = byShop[sid];
        txt += `🏪 <b>TOKO ${isMulti ? (si + 1) + ': ' : ''}${shop.name}</b>\n`;
        shop.items.forEach(it => {
            txt += `└─ 🔹 ${it.productName || 'Item'}${it.variationName ? ` (${it.variationName})` : ''} | 🔢 ${it.quantity} pcs\n`;
        });
        txt += `└─ 🚚 Kurir: <b>${us.foLogisticName || 'Default'}</b>\n`;
    });

    txt += `<code>--------------------------</code>\n`;
    txt += `💳 Pembayaran    : 🏦 <b>${payName}</b>\n`;
    if (pd.shipping_fee !== undefined) txt += `🚛 Ongkir Kurir  : <b>${RUPIAH(pd.shipping_fee)}</b>\n`;
    txt += `🪙 Saldo Koin Akun : <b>${(us.foCoinBalance || 0).toLocaleString('id-ID')} Koin</b>\n`;
    txt += `<code>--------------------------</code>\n`;

    txt += `🛍️ Subtotal Produk : <b>${RUPIAH(pd.merchandise_subtotal)}</b>\n`;
    if (pd.shipping_fee !== undefined) txt += `🚛 Ongkir        : <b>${RUPIAH(pd.shipping_fee)}</b>\n`;
    const totalBefore = (pd.merchandise_subtotal || 0) + (pd.shipping_fee || 0);
    txt += `📊 Total Sblm Voucher: <b>${RUPIAH(totalBefore)}</b>\n`;
    if (pd.shipping_fee_discount) txt += `🚛 Diskon Ongkir  : <b>-${RUPIAH(pd.shipping_fee_discount)}</b>\n`;
    if (rp.price_discount) txt += `🎫 Voucher Diskon : <b>-${RUPIAH(rp.price_discount)}</b>\n`;
    const totalAfterVoucher = totalBefore - (pd.shipping_fee_discount || 0) - (rp.price_discount || 0);
    txt += `📊 Total Stlh Voucher: <b>${RUPIAH(totalAfterVoucher < 0 ? 0 : totalAfterVoucher)}</b>\n`;
    if (coinUsed) txt += `🪙 Potongan Koin  : <b>-${RUPIAH(coinUsed)}</b>\n`;
    txt += `<code>--------------------------</code>\n`;
    if (pd.total_payable !== undefined) txt += `💵 <b>TOTAL BAYAR   : ${RUPIAH(pd.total_payable)}</b>\n`;
    const hemat = totalBefore - (pd.total_payable || 0);
    if (hemat > 0) txt += `🏷️ <b>Total Hemat  : ${RUPIAH(hemat)}</b>\n`;
    txt += `<code>--------------------------</code>\n\n`;

    // Status voucher
    let statusSection = '';
    if (fsvCode) statusSection += `🚛 FSV: <b>${fsvCode}</b>\n`;
    if (valV && valV.length) {
        statusSection += `🎟️ Voucher: `;
        valV.forEach(pv => statusSection += `<b>${pv.voucher_code}</b> `);
        statusSection += '\n';
    }
    const invPv = (rp.platform_vouchers || []).filter(pv => pv.invalid_message);
    if (invPv.length) {
        statusSection += `\n<b>Status Voucher:</b>\n`;
        invPv.forEach(pv => { statusSection += `❌ <code>${pv.voucher_code}</code> — ${pv.invalid_message}\n`; });
    }
    if (statusSection) txt += statusSection;

    txt += `\n<code>--------------------------</code>\n`;
    txt += `📌 <i>Tombol di bawah membuat PESANAN NYATA (belum bayar).</i>`;

    us.step = 'FO_CONFIRM';
    logger.engine("FO_PREVIEW", `User ${userId} | Total: ${RUPIAH(pd.total_payable)} | Hemat: ${RUPIAH(hemat)} | Koin: ${coinUsed}`, "INFO");
    const kb = [[{ text: '🔥 PLACE ORDER SEKARANG', callback_data: 'fo_order_yes' }], [{ text: '🎟️ Ubah Voucher', callback_data: 'fo_back_voucher' }, { text: '❌ Batal', callback_data: 'fo_order_no' }]];
    await safeEditMessage(chatId, msgId, txt, { reply_markup: { inline_keyboard: kb } });
}

async function foAutoSaveCookie(userId, us) {
    try {
        const identity = generateDynamicDevice();
        const realDid = us.foCookie.split('SPC_DID=')[1]?.split(';')[0] || us.foCookie.split('SPC_F=')[1]?.split(';')[0] || null;
        await supabase.from('shopee_accounts').insert({
            user_id: String(userId),
            account_name: us.foUsername || 'Auto-Saved',
            cookie: encryptCookie(us.foCookie),
            device_identity: { ...identity, phone: null, device_id: realDid, sz_token: us.foFingerprint || null, x_sap_ri: null, sz_token_ts: us.foFingerprint ? Date.now() : null }
        });
        logger.db("INSERT", "shopee_accounts", `SUCCESS: Auto-saved ${us.foUsername}`);
        return true;
    } catch (saveErr) {
        logger.engine("AUTO_SAVE", `Gagal auto-save cookie: ${saveErr.message}`, "WARN");
        return false;
    }
}

async function foRenderSuccessMsg(us, coF, res, retryLabel) {
    const cart = us.cart || [];
    const isMulti = cart.length > 1;
    const pd = coF?.checkout_price_data || {};
    const rp = coF?.promotion_data || {};
    const payName = us.foPayArr?.[us.foPayIdx]?.name || 'Default';
    const RUPIAH = (v) => `Rp ${((v || 0) / 100000).toLocaleString('id-ID')}`;
    const checkoutId = res.checkoutid || res.checkout_id || '-';
    const orderId = res.orderids?.[0] || res.order_id || checkoutId;
    const fsvCode = rp.free_shipping_voucher_info?.free_shipping_voucher_code || us.foSelFsv?.voucher_code || '';
    const pvCode = (rp.platform_vouchers || []).filter(pv => !pv.invalid_message).map(pv => pv.voucher_code).join(', ') || '-';
    const coinUsed = rp.coin_info?.coin_used || 0;

    let txt = `🎉 <b>Pesanan berhasil dibuat!</b> 🎉\n\n`;
    txt += `💰 Total     : <b>${RUPIAH(pd.total_payable)}</b>\n`;
    txt += `💳 Pembayaran: 🏦 <b>${payName}</b>\n`;
    txt += `🚚 Kurir     : <b>${us.foLogisticName || 'Default'}</b>\n`;
    if (coinUsed) txt += `🪙 Koin      : <b>${RUPIAH(coinUsed)}</b>\n`;
    if (pvCode !== '-') txt += `🎟️ Voucher   : <b>${pvCode}</b>\n`;
    if (fsvCode) txt += `🚛 FSV       : <b>${fsvCode}</b>\n`;
    txt += `📋 Checkout ID: <code>${checkoutId}</code>\n`;

    // Try to fetch VA info
    let vaInfo = null;
    try {
        const vaRes = await fetchPaymentVA(us.foCookie, checkoutId);
        if (vaRes.success && vaRes.va) {
            vaInfo = vaRes;
            txt += `🏦 VA        : <b>${vaRes.bankName || 'Virtual Account'}</b>\n`;
            txt += `🔢 No. VA    : <code>${vaRes.va}</code>\n`;
            if (vaRes.companyCode) txt += `🏢 Kode      : <code>${vaRes.companyCode}</code>\n`;
        } else {
            txt += `🏦 VA        : <i>Buka app Shopee untuk kode bayar</i>\n`;
        }
    } catch (e) {
        txt += `🏦 VA        : <i>Buka app Shopee untuk kode bayar</i>\n`;
    }

    txt += `\n`;
    cart.forEach(it => {
        txt += `${it.productName || 'Item'}${it.variationName ? ` (${it.variationName})` : ''}\n  ×${it.quantity}\n`;
    });

    txt += `\n⚠️ <i>Status BELUM BAYAR. Selesaikan pembayaran via VA/app Shopee sebelum kedaluwarsa!</i>\n`;
    if (retryLabel) txt += `\n📝 <i>${retryLabel}</i>\n`;
    txt += `\n🍪 <i>Cookie otomatis tersimpan ke Kelola Akun!</i>`;

    return { txt, checkoutId, orderId, vaInfo };
}

async function foDoPlaceOrder(chatId, msgId, userId) {
    const us = userState[userId];
    const cookie = us.foCookie;
    const fp = us.foFingerprint;
    const csrf = us.foCsrf;
    const coF = us.foCoFinal;
    const promo = coF.promotion_data || {};
    const firstItem = us.cart[0];

    await safeEditMessage(chatId, msgId, `⏳ <b>Memproses PLACE ORDER...</b>\n<code>--------------------------</code>\n🔄 Harap tunggu, jangan tekan tombol apapun.\n<code>--------------------------</code>`);
    logger.engine("FO_PLACE", `User ${userId} memulai place order...`, "INFO");

    try {
        const fPV = promo.platform_vouchers ? promo.platform_vouchers.filter(pv => !pv.invalid_message) : (us.foSelPV || []);
        const sV = promo.shop_vouchers || [];
        const fsvInfo = promo.free_shipping_voucher_info || us.foFsvInfo || {};

        const res = await foPostPlaceOrder(cookie, csrf, coF, fp, us.foPayment, fsvInfo, fPV, sV, us.foUseCoins);

        if (res.response && !res.response.error) {
            saveFpToPool(fp);
            await foAutoSaveCookie(userId, us);

            const successData = await foRenderSuccessMsg(us, coF, res.response, null);
            logger.engine("FO_SUCCESS", `Order ${successData.orderId} berhasil! Total: ${((coF.checkout_price_data?.total_payable || 0) / 100000)}`, "SUCCESS");

            const doneKb = [
                [{ text: '📋 Cek Pesanan', callback_data: 'memru_check_start' }, { text: '🏠 Menu Utama', callback_data: 'back_home' }]
            ];
            await safeEditMessage(chatId, msgId, successData.txt, { reply_markup: { inline_keyboard: doneKb } });
            delete userState[userId];
            return;
        }

        const err = res.response?.error_action?.message || res.response?.error_msg || String(res.response?.error || 'unknown');
        logger.engine("FO_PLACE_ERR", `Error: ${err.substring(0, 100)}`, "ERR");

        if (err.toLowerCase().includes('coupon') || err.toLowerCase().includes('voucher')) {
            await safeEditMessage(chatId, msgId, `⚠️ Error: <code>${err}</code>\n\n🔄 <b>Auto retry tanpa platform voucher (FSV tetap)...</b>`);
            logger.engine("FO_RETRY", `Retry tanpa platform voucher...`, "WARN");
            const so = us.foLogistic ? [{ sync: true, logistics: { channelid: us.foLogistic } }] : null;
            const co3 = await foPostCheckoutGet(cookie, csrf, firstItem.shopid, firstItem.itemid, firstItem.modelid, firstItem.quantity, fp, fsvInfo, [], [], us.foPayment, so, null, 3, false, us.foCo0);
            if (co3 && !co3.error) {
                const fsv3 = co3.promotion_data?.free_shipping_voucher_info || fsvInfo;
                const res2 = await foPostPlaceOrder(cookie, csrf, co3, fp, us.foPayment, fsv3, [], [], us.foUseCoins);
                if (res2.response && !res2.response.error) {
                    saveFpToPool(fp);
                    await foAutoSaveCookie(userId, us);
                    const successData = await foRenderSuccessMsg(us, co3, res2.response, 'Retry sukses (tanpa platform voucher, FSV tetap)');
                    logger.engine("FO_RETRY_OK", `Retry sukses: ${successData.orderId}`, "SUCCESS");
                    const doneKb2 = [[{ text: '📋 Cek Pesanan', callback_data: 'memru_check_start' }, { text: '🏠 Menu Utama', callback_data: 'back_home' }]];
                    await safeEditMessage(chatId, msgId, successData.txt, { reply_markup: { inline_keyboard: doneKb2 } });
                    delete userState[userId];
                    return;
                }
                await safeEditMessage(chatId, msgId, '⚠️ Masih gagal, retry tanpa voucher apapun...');
                logger.engine("FO_RETRY2", `Retry tanpa semua voucher...`, "WARN");
                const co4 = await foPostCheckoutGet(cookie, csrf, firstItem.shopid, firstItem.itemid, firstItem.modelid, firstItem.quantity, fp, {}, [], [], us.foPayment, so, null, 3, false, us.foCo0);
                if (co4 && !co4.error) {
                    const res3 = await foPostPlaceOrder(cookie, csrf, co4, fp, us.foPayment, {}, [], [], us.foUseCoins);
                    if (res3.response && !res3.response.error) {
                        saveFpToPool(fp);
                        await foAutoSaveCookie(userId, us);
                        const successData = await foRenderSuccessMsg(us, co4, res3.response, 'Retry sukses (tanpa semua voucher)');
                        logger.engine("FO_RETRY2_OK", `Retry2 sukses: ${successData.orderId}`, "SUCCESS");
                        const doneKb3 = [[{ text: '📋 Cek Pesanan', callback_data: 'memru_check_start' }, { text: '🏠 Menu Utama', callback_data: 'back_home' }]];
                        await safeEditMessage(chatId, msgId, successData.txt, { reply_markup: { inline_keyboard: doneKb3 } });
                        delete userState[userId];
                        return;
                    }
                    await safeEditMessage(chatId, msgId, `❌ Tetap gagal: <code>${res3.response?.error_msg || 'unknown'}</code>`, { reply_markup: { inline_keyboard: [[{ text: '🛒 Coba Lagi', callback_data: 'memru_order_start' }, { text: '🏠 Menu', callback_data: 'back_home' }]] } });
                    delete userState[userId];
                    return;
                }
            }
            await safeEditMessage(chatId, msgId, `❌ Retry gagal: <code>${co3?.error_msg || 'unknown'}</code>`, { reply_markup: { inline_keyboard: [[{ text: '🛒 Coba Lagi', callback_data: 'memru_order_start' }, { text: '🏠 Menu', callback_data: 'back_home' }]] } });
            delete userState[userId];
            return;
        }

        let failMsg = err;
        if (String(err).includes('fraud') || String(err).includes('M01') || String(err).includes('mencurigakan')) {
            failMsg = "🛡️ Shopee Anti-Fraud (M01): Akun terdeteksi mencurigakan. Coba lagi nanti atau pakai akun lebih 'warm'.";
        } else if (String(err).includes('serviceability') || String(err).includes('channel')) {
            failMsg = "🚚 Jasa kirim berubah saat checkout. Pilih ulang kurir lalu coba bayar lagi.";
        }
        logger.engine("FO_FAIL", `Place order gagal: ${failMsg.substring(0, 100)}`, "ERR");

        const failKb = [[{ text: '🛒 Coba Lagi', callback_data: 'memru_order_start' }], [{ text: '🏠 Menu Utama', callback_data: 'back_home' }]];
        await safeEditMessage(chatId, msgId, `❌ <b>PLACE ORDER GAGAL</b>\n<code>--------------------------</code>\n<code>${failMsg}</code>\n<code>--------------------------</code>`, { reply_markup: { inline_keyboard: failKb } });
        delete userState[userId];
    } catch (e) {
        logger.engine("FO_CRITICAL", `Exception: ${e.message}`, "ERR");
        await safeEditMessage(chatId, msgId, `❌ Error: <code>${e.message}</code>`, { reply_markup: { inline_keyboard: [[{ text: '🏠 Menu', callback_data: 'back_home' }]] } });
        delete userState[userId];
    }
}

async function startQRStatusPolling(chatId, userId, qrcodeId, webIdentity, originalMenuMsgId) {
    let attempts = 0;
    const maxAttempts = 36;

    const headers = {
        'Host': 'shopee.co.id',
        'X-API-Source': 'rn',
        'User-Agent': webIdentity.ua,
        'Referer': 'https://shopee.co.id/'
    };

    const interval = setInterval(async () => {
        if (!userState[userId] || userState[userId].step !== "WAIT_QR_SCAN") {
            clearInterval(interval);
            return;
        }

        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(interval);
            delete userState[userId];
            await bot.deleteMessage(chatId, originalMenuMsgId).catch(() => {});
            return await safeSendMessage(chatId, "📌 <b>Waktu Scan QR Habis!</b>\nSilakan muat ulang menu untuk mendapatkan QR Code baru.");
        }

        try {
            const res = await axios.get(`https://shopee.co.id/api/v2/authentication/qrcode_status?qrcode_id=${encodeURIComponent(qrcodeId)}`, { headers, timeout: 5000 });
            const qrData = res.data?.data;

            if (qrData && qrData.status === "CONFIRMED" && qrData.qrcode_token) {
                clearInterval(interval);

                await bot.editMessageCaption("✅ <b>Scan Berhasil! Mengonfigurasi enkripsi sistem keamanan... (Mohon tunggu)</b>", {
                    chat_id: chatId,
                    message_id: originalMenuMsgId,
                    parse_mode: "HTML"
                }).catch(() => {});

                logger.engine("QR_BYPASS", `Memulai engine pendobrak enkripsi 403 untuk ID: ${userId}...`, "INFO");

                await acquireBrowserSlot();
                const browser = await chromium.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote']
                });

                const context = await browser.newContext({
                    viewport: webIdentity.screen,
                    userAgent: webIdentity.ua
                });

                const page = await context.newPage();
                await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,css}', route => route.abort());

                await page.goto('https://shopee.co.id/buyer/login/qr?next=https%3A%2F%2Fshopee.co.id', { waitUntil: 'networkidle', timeout: 60000 });
                await page.waitForTimeout(2000);

                const cookiesList = await context.cookies();
                const csrfToken = cookiesList.find(c => c.name === 'csrftoken')?.value || "null";

                const loginResult = await page.evaluate(async ({ qrcodeToken, csrfToken }) => {
                    try {
                        const response = await fetch('https://shopee.co.id/api/v2/authentication/qrcode_login', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': csrfToken,
                                'X-Requested-With': 'XMLHttpRequest',
                                'Referer': 'https://shopee.co.id/buyer/login/qr?next=https%3A%2F%2Fshopee.co.id'
                            },
                            body: JSON.stringify({
                                qrcode_token: qrcodeToken,
                                stay_logged_in: false,
                                device: "Chrome, Windows"
                            })
                        });
                        const resJson = await response.json();

                        return {
                            success: resJson.error === 0,
                            msg: resJson.error_msg || `Code: ${resJson.error}`,
                            security_device_fingerprint: resJson.client_identifier?.security_device_fingerprint || resJson.device_sz_fingerprint || ""
                        };
                    } catch (err) {
                        return { success: false, msg: err.message };
                    }
                }, { qrcodeToken: qrData.qrcode_token, csrfToken });

                if (!loginResult.success) {
                    await browser.close().catch(() => {});
                    releaseBrowserSlot();
                    delete userState[userId];
                    return await safeSendMessage(chatId, `📷 <b>Autentikasi QR Gagal:</b> <code>${loginResult.msg}</code>`);
                }

                const grabbedFingerprint = loginResult.security_device_fingerprint || null;
                logger.engine("QR_SECURITY", grabbedFingerprint ? `Sidik jari berhasil diamankan: ${grabbedFingerprint.substring(0, 15)}...` : "Sidik jari real tak tertangkap, akan grab saat checkout.", grabbedFingerprint ? "SUCCESS" : "WARN");

                const successCookies = await context.cookies();
                const cleanCookieString = successCookies.map(c => `${c.name}=${c.value}`).join('; ');

                await browser.close().catch(() => {});
                releaseBrowserSlot();

                const mobileIdentity = generateDynamicDevice();
                logger.engine("QR_FLOW", `Membuat Handshake Mobile untuk Profile: ${mobileIdentity.deviceName}`, "INFO");

                const accountInfo = await getShopeeAccountInfo(cleanCookieString, mobileIdentity);
                if (!accountInfo.success) {
                    delete userState[userId];
                    return await safeSendMessage(chatId, `👤 <b>Sesi QR Sukses tapi Akun Reject:</b> <code>${accountInfo.msg}</code>`);
                }

                let profileNote = "";
                try {
                    const pc = await ensureProfileComplete(cleanCookieString, { ua: mobileIdentity.ua });
                    if (pc.success && !pc.alreadyComplete) { profileNote = "\n🛠️ <i>Profil dilengkapi otomatis (gender & tgl lahir).</i>"; logger.engine("PROFILE_FIX", `QR: Set ${JSON.stringify(pc.applied)} untuk ${accountInfo.username}`, "SUCCESS"); }
                    else if (pc.success) profileNote = "\n✅ <i>Profil sudah lengkap.</i>";
                } catch (pe) { logger.engine("PROFILE_FIX", pe.message, "WARN"); }

                let qrSz = (grabbedFingerprint && grabbedFingerprint.length > 40 && !grabbedFingerprint.startsWith(FALLBACK_SZ_PREFIX)) ? grabbedFingerprint : null;
                let qrSapri = null;
                if (!qrSz) {
                    try {
                        const g = await fetchWebFingerprint({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', cookie: cleanCookieString, returnFull: true });
                        if (g && g.sz && g.sz.length > 40 && !g.sz.startsWith(FALLBACK_SZ_PREFIX)) { qrSz = g.sz; qrSapri = g.sapri || null; }
                    } catch (e) {}
                }
                const qrDid = cleanCookieString.split('SPC_DID=')[1]?.split(';')[0] || cleanCookieString.split('SPC_F=')[1]?.split(';')[0] || null;

                const { error: insertErr } = await supabase.from('shopee_accounts').insert({
                    user_id: userId,
                    account_name: accountInfo.username,
                    cookie: encryptCookie(cleanCookieString),
                    device_identity: {
                        ua: mobileIdentity.ua,
                        model: mobileIdentity.model,
                        deviceName: mobileIdentity.deviceName,
                        osVersion: mobileIdentity.osVersion,
                        phone: accountInfo.phone || null,
                        device_id: qrDid,
                        sz_token: qrSz,
                        x_sap_ri: qrSapri,
                        sz_token_ts: qrSz ? Date.now() : null
                    }
                });

                if (insertErr) throw insertErr;
                logger.db("INSERT", "shopee_accounts", `Saved via QR Stealth Injection: ${accountInfo.username}`);

                await bot.deleteMessage(chatId, originalMenuMsgId).catch(() => {});

                let successMsg = `📷 <b>LOGIN QR BERHASIL</b>\n`;
                successMsg += `<code>--------------------------</code>\n`;
                successMsg += `📌 <b>Username  :</b> <code>${accountInfo.username}</code>\n`;
                successMsg += `📱 <b>No. HP    :</b> <code>${accountInfo.phone}</code>\n`;
                successMsg += `<code>--------------------------</code>\n`;
            successMsg += `📊 <b>Status    :</b> <i>Account Ready</i>${profileNote}\n`;
                successMsg += `<code>--------------------------</code>\n\n`;
                successMsg += `👇 <i>Silakan klik tombol di bawah melalui menu utama untuk masuk ke pemilihan akun dan memulai Auto CO:</i>`;

                delete userState[userId];

                return await safeSendMessage(chatId, successMsg);
            }
        } catch (e) {
            logger.engine("QR_POLLING", `Sesi retry status check... ${e.message}`, "DEBUG");
        }
    }, 5000);
}
async function sendMainMenu(chatId, userId, messageId = null, fromUser = null) {
    const access = await getAccessLicense(userId);
    const jakartaTime = new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Jakarta'
    }).format(new Date());

    const username = fromUser?.username ? `@${fromUser.username}` : "Premium Member";
    const teleId = fromUser?.id || userId;

    if (fromUser?.username) {
        supabase.from('profiles').update({ username: fromUser.username }).eq('id', userId)
            .then(() => {}, () => {});
    }

    let text = `🛒 <b>PAIZU SHOPEE TOOLS</b>\n`;
    text += `<code>--------------------------</code>\n`;
    text += `👤 <b>User   :</b> ${username}\n`;
    text += `🆔 <b>ID     :</b> <code>${teleId}</code>\n`;
    text += `🕐 <b>Waktu  :</b> <i>${jakartaTime} WIB</i>\n`;
    text += `<code>--------------------------</code>\n`;

    if (access.active) {
        const expireStringWIB = new Intl.DateTimeFormat('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Jakarta'
        }).format(new Date(access.data.expired_at));

        text += `📊 Status : <b>PREMIUM ACTIVE</b>\n`;
        text += `⏰ Expire : <code>${expireStringWIB} WIB</code>\n`;
        text += `<code>--------------------------</code>\n\n`;
        text += `👇 <i>Silakan klik tombol di bawah untuk membuat pesanan checkout baru atau kelola akun Anda.</i>`;
    } else {
        text += `📊 Status : <b>FREE / EXPIRED ACCESS</b>\n`;
        text += `<code>--------------------------</code>\n`;
        text += `📌 <b>AKTIVASI PREMIUM SYSTEM :</b>\n`;
        text += `Untuk membuka seluruh fitur Shopee Tools, Anda wajib mengaktifkan akses premium bot.\n\n`;
        text += `💳 Pembayaran menggunakan <b>QRIS Otomatis</b>.\n`;
        text += `🎟️ Lisensi langsung aktif ke akun Anda dalam 1 detik setelah pembayaran berhasil!\n`;
        text += `<code>--------------------------</code>\n`;
        text += `📌 <i>Klik tombol <b>🎟️ SEWA BOT / AKTIVASI</b> di bawah untuk membaca S&K dan memilih durasi paket:</i>`;
    }

    const buttons = access.active
        ? [
            [
                { text: "🛒 BUAT PESANAN", callback_data: "memru_order_start" },
                { text: "🔍 CEK PESANAN", callback_data: "memru_check_start" }
            ],
            [
                { text: "🎁 KLAIM HADIAH", callback_data: "memru_mission_start" },
                { text: "🎟️ CEK VOUCHER", callback_data: "memru_voucher_start" }
            ],
            [
                { text: "💰 SHOPEEPAY & KOIN", callback_data: "spay_menu" },
                { text: "📍 ATUR ALAMAT", callback_data: "main_menu_address_select" }
            ],
            [
                { text: "👤 KELOLA AKUN", callback_data: "manage_acc" }
            ]
          ]
        : [
            [{ text: "🎟️ SEWA BOT / AKTIVASI", callback_data: "claim_menu" }]
          ];

    buttons.push([{ text: "💬 Hubungi Admin Utama", url: "https://t.me/paizutempest" }]);

    const markup = { inline_keyboard: buttons };

    if (messageId) {
        await safeEditMessage(chatId, messageId, text, { reply_markup: markup });
    } else {
        await safeSendMessage(chatId, text, { reply_markup: markup });
    }
}

async function sendLoginMethodMenu(chatId, messageId) {
    let text = `📋 <b>Buat Pesanan</b>\n\n`;
    text += `Pilih metode login akun Shopee lo untuk melanjutkan alur penembakan Auto CO Memru:\n`;
    text += `<code>--------------------------</code>`;

    const buttons = [
        [
            { text: "📷 Login via QR", callback_data: "method_qr" },
            { text: "🍪 Raw Cookie", callback_data: "method_cookie" }
        ],
        [{ text: "🏠 Kembali ke Menu", callback_data: "back_home" }]
    ];

    await safeEditMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: buttons } });
}

bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    if (!text) return;

    logger.info(userId, "MESSAGE_RCV", text.substring(0, 30));
    touchUserState(userId);

    if (text === "/start" || text === "/memru") {
        delete userState[userId];
        return sendMainMenu(chatId, userId, null, msg.from);
    }
    if (text.startsWith("/addpremium") && userId === ADMIN_ID) {
        const args = text.split(" ");
        const target = args[1];
        const inputDays = parseInt(args[2]);

        if (!target || isNaN(inputDays)) {
            return await safeSendMessage(chatId, "📌 <b>Format Salah, Bos Admin!</b>\nGunakan format: <code>/addpremium [ID_atau_@Username] [Jumlah_Hari]</code>\n\n📌 <i>Contoh: /addpremium @paizutempest 30</i>");
        }

        if (inputDays <= 0 || inputDays > 3650) {
            return await safeSendMessage(chatId, "❌ <b>Jumlah hari tidak valid.</b> Gunakan angka 1–3650.");
        }

        try {
            const isUsername = target.startsWith("@");
            const cleanVal = target.replace("@", "");
            let targetId = cleanVal;

            if (isUsername) {
                const { data: userData } = await supabase.from('profiles').select('id').eq('username', cleanVal).maybeSingle();
                if (userData) {
                    targetId = userData.id;
                } else {
                    return await safeSendMessage(chatId, `❌ <b>Gagal:</b> Username <code>${target}</code> tidak ditemukan di database profiles. Orang tersebut harus ketik /start dulu di bot lo, Bang!`);
                }
            }

            if (/^\d+$/.test(String(targetId))) targetId = Number(targetId);

            let finalExpiredDate = new Date();
            finalExpiredDate.setDate(finalExpiredDate.getDate() + inputDays);

            const { data: currentProfile } = await supabase.from('profiles').select('expired_at').eq('id', targetId).maybeSingle();

            if (currentProfile && currentProfile.expired_at) {
                const oldExpired = new Date(currentProfile.expired_at);
                if (oldExpired > new Date()) {
                    finalExpiredDate = oldExpired;
                    finalExpiredDate.setDate(finalExpiredDate.getDate() + inputDays);
                }
            }

            const { error: upsertErr } = await supabase
                .from('profiles')
                .upsert({
                    id: targetId,
                    expired_at: finalExpiredDate.toISOString()
                });

            if (upsertErr) throw upsertErr;

            invalidateLicenseCache(targetId);
            logger.db("UPSERT", "profiles", `ADMIN INJECT SUCCESS: +${inputDays} DAYS FOR TARGET: ${target}`);

            const expiredStringWIB = new Intl.DateTimeFormat('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Asia/Jakarta'
            }).format(finalExpiredDate);

            let adminSuccessMsg = `✅ <b>SUNTIKAN PREMIUM ADMIN BERHASIL!</b>\n`;
            adminSuccessMsg += `<code>--------------------------</code>\n`;
            adminSuccessMsg += `📌 <b>Target    :</b> <code>${target}</code> (ID: <code>${targetId}</code>)\n`;
            adminSuccessMsg += `📌 <b>Durasi    :</b> <b>+${inputDays} Hari Premium Access</b>\n`;
            adminSuccessMsg += `⏰ <b>Habis Pada :</b> <code>${expiredStringWIB} WIB</code>\n`;
            adminSuccessMsg += `<code>--------------------------</code>\n\n`;
            adminSuccessMsg += `📌 <i>Sasis lisensi premium berhasil dipaksa aktif oleh hak prerogatif Admin Utama!</i>`;

            await safeSendMessage(chatId, adminSuccessMsg);

            if (String(targetId) !== String(chatId)) {
                let notifyTargetMsg = `🎉 <b>SELAMAT! AKSES PREMIUM DISUNTIK OLEH ADMIN</b> 🎉\n`;
                notifyTargetMsg += `<code>--------------------------</code>\n`;
                notifyTargetMsg += `Akun Anda telah diaktifkan secara manual oleh Admin Utama.\n`;
                notifyTargetMsg += `⏰ <b>Masa Expire :</b> <code>${expiredStringWIB} WIB</code>\n`;
                notifyTargetMsg += `<code>--------------------------</code>\n\n`;
                notifyTargetMsg += `👇 <i>Silakan ketik /start kembali untuk merefresh dashboard utama Anda!</i>`;

                await bot.sendMessage(targetId, notifyTargetMsg, { parse_mode: "HTML" }).catch(() => {});
            }
            return;

        } catch (e) {
            logger.engine("ADMIN_INJECT_FAIL", e.message, "ERR");
            return await safeSendMessage(chatId, `❌ <b>Gagal Injeksi Manual:</b> <code>${e.message}</code>`);
        }
    }
    if (text.startsWith("/deluser") && userId === ADMIN_ID) {
        let target = text.split(" ")[1];
        if (!target) return await safeSendMessage(chatId, "📌 <b>Format Salah!</b> Gunakan: <code>/deluser ID_atau_@Username</code>");

        try {
            const isUsername = target.startsWith("@");
            const cleanVal = target.replace("@", "");
            let targetId = cleanVal;

            if (isUsername) {
                const { data: userData } = await supabase.from('profiles').select('id').eq('username', cleanVal).maybeSingle();
                if (userData) {
                    targetId = userData.id;
                } else {
                    return await safeSendMessage(chatId, `❌ <b>Gagal:</b> Username <code>${target}</code> tidak terdaftar di database.`);
                }
            }
            if (/^\d+$/.test(String(targetId))) targetId = Number(targetId);

            await supabase.from('licenses').update({ used_by: null }).eq('used_by', targetId);

            await supabase.from('shopee_accounts').delete().eq('user_id', String(targetId));

            const { error } = await supabase.from('profiles').delete().eq('id', targetId);

            if (error) throw error;
            invalidateLicenseCache(targetId);

            logger.engine("ADMIN", `Wipe Out sukses untuk Target: ${target}`, "SUCCESS");
            return await safeSendMessage(chatId, `📌 <b>FULL ACCOUNT WIPE SUCCESS</b>\n<code>--------------------------</code>\nTarget : <code>${target}</code>\nStatus : <b>Sistem Berhasil Dibersihkan!</b>`);

        } catch (e) {
            logger.engine("ADMIN", `Gagal /deluser: ${e.message}`, "ERR");
            return await safeSendMessage(chatId, `❌ <b>Critical Error:</b> <code>${e.message}</code>`);
        }
    }
    const state = userState[userId];
    if (!state) return;

    const accessGateMsg = await getAccessLicense(userId);
    if (!accessGateMsg.active) {
        delete userState[userId];
        return sendMainMenu(chatId, userId, null, msg.from);
    }

    if (state && state.step === "WAIT_RAW_COOKIE") {
        const rawInput = msg.text ? msg.text.trim() : "";

        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});

        const parseResult = validateAndParseShopeeCookie(rawInput);

        if (!parseResult.success) {
            let errorMsg = `❌ <b>Autentikasi Gagal!</b>\n`;
            errorMsg += `<code>--------------------------</code>\n`;
            errorMsg += `Format Shopee Cookie yang Anda masukkan salah atau tidak lengkap.\n`;
            errorMsg += `<i>${parseResult.reason}</i>\n`;
            errorMsg += `<code>--------------------------</code>`;

            await safeEditMessage(chatId, state.target_message_id, errorMsg, {
                reply_markup: { inline_keyboard: [[{ text: "🔄 Coba Lagi", callback_data: "method_cookie" }]] }
            });
            delete userState[userId];
            return;
        }

        await safeEditMessage(chatId, state.target_message_id, "🔗 <b>Menghubungkan ke Shopee... Menyelaraskan sidik jari perangkat...</b>", { reply_markup: { inline_keyboard: [] } });

        try {
            const identity = generateDynamicDevice();
            logger.engine("DEVICE_GEN", `Injeksi Perangkat Sukses: ${identity.deviceName} [${identity.model}]`, "INFO");

            const cleanCookie = parseResult.cookie;
            const accountInfo = await getShopeeAccountInfo(cleanCookie, identity);
            if (!accountInfo.success) {
                delete userState[userId];
                let rejectMsg = `🚫 <b>Shopee Reject:</b> <code>${accountInfo.msg}</code>\n\nSesi ditolak oleh server Shopee. Sila perbarui kuki segar Anda.`;
                return await safeEditMessage(chatId, state.target_message_id, rejectMsg, {
                    reply_markup: { inline_keyboard: [[{ text: "🔄 Ulangi", callback_data: "method_cookie" }]] }
                });
            }

            let profileNote = "";
            try {
                const pc = await ensureProfileComplete(cleanCookie, identity);
                if (pc.success && !pc.alreadyComplete) { profileNote = "\n🛠️ <i>Profil dilengkapi otomatis (gender & tgl lahir).</i>"; logger.engine("PROFILE_FIX", `Set ${JSON.stringify(pc.applied)} untuk ${accountInfo.username}`, "SUCCESS"); }
                else if (pc.success) profileNote = "\n✅ <i>Profil sudah lengkap.</i>";
            } catch (pe) { logger.engine("PROFILE_FIX", pe.message, "WARN"); }

            const realDid = cleanCookie.split('SPC_DID=')[1]?.split(';')[0] || cleanCookie.split('SPC_F=')[1]?.split(';')[0] || null;
            userState[userId] = {
                step: "WAIT_SZ_TOKEN",
                target_message_id: state.target_message_id,
                pendingAccount: {
                    cleanCookie, identity, realDid,
                    username: accountInfo.username,
                    phone: accountInfo.phone || null,
                    profileNote,
                    target_message_id: state.target_message_id
                }
            };
            let szMsg = `🔑 <b>STEP 2 — Masukkan Fingerprint</b>\n`;
            szMsg += `<code>--------------------------</code>\n`;
            szMsg += `👤 Akun: <b>${accountInfo.username}</b>\n`;
            szMsg += `<code>--------------------------</code>\n`;
            szMsg += `Kirim <i>Fingerprint / SZ</i>\n\n`;
            szMsg += `⚠️ <b>Auto Grab</b>\n`;
            szMsg += `<code>--------------------------</code>`;
            return await safeEditMessage(chatId, state.target_message_id, szMsg, {
                reply_markup: { inline_keyboard: [[{ text: "⚡ Auto Grab (WEB - voucher bisa ditolak)", callback_data: "sz_auto_grab" }], [{ text: "❌ Batal", callback_data: "manage_acc" }]] }
            });

        } catch (e) {
            delete userState[userId];
            logger.engine(userId, `Gagal memproses kuki: ${e.message}`, "ERR");

            let criticalMsg = `❌ <b>System Critical Error:</b> <code>${e.message}</code>\n\nGagal mendaftarkan akun ke database server.`;
            return await safeEditMessage(chatId, state.target_message_id, criticalMsg, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] }
            });
        }
    }
    if (state && state.step === "WAIT_SZ_TOKEN") {
        const szInput = msg.text ? msg.text.trim() : "";
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        const pa = state.pendingAccount;
        if (!pa) { delete userState[userId]; return; }
        let szToken = null, sapri = null;
        if (szInput.toLowerCase() === 'auto') {
            await safeEditMessage(chatId, state.target_message_id, "⚡ <b>Auto-grab sz-token via browser...</b>", { reply_markup: { inline_keyboard: [] } });
            try {
                const g = await fetchWebFingerprint({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', cookie: pa.cleanCookie, returnFull: true });
                if (g && g.sz && g.sz.length > 40 && !g.sz.startsWith(FALLBACK_SZ_PREFIX)) { szToken = g.sz; sapri = g.sapri || null; }
            } catch (e) {}
        } else if (szInput.length > 20) {
            szToken = szInput;
        } else {
            await safeEditMessage(chatId, state.target_message_id, "❌ sz-token terlalu pendek. Kirim ulang atau ketik <b>auto</b>.", { reply_markup: { inline_keyboard: [[{ text: "⚡ Auto Grab", callback_data: "sz_auto_grab" }, { text: "❌ Batal", callback_data: "manage_acc" }]] } });
            return;
        }
        await finalizeAccountSave(chatId, userId, pa, szToken, sapri);
        return;
    }
    if (state && state.step === "WAIT_SET_SZ") {
        const szInput = msg.text ? msg.text.trim() : "";
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        if (szInput.length < 20) {
            return await safeEditMessage(chatId, state.target_message_id, "❌ sz-token terlalu pendek. Kirim ulang.", { reply_markup: { inline_keyboard: [[{ text: "🔙 Batal", callback_data: "manage_acc" }]] } });
        }
        try {
            const di = { ...(state.setSzDeviceIdentity || {}), sz_token: szInput, sz_token_ts: Date.now() };
            const { error } = await supabase.from('shopee_accounts').update({ device_identity: di }).eq('id', state.setSzAccId).eq('user_id', String(userId));
            if (error) throw error;
            logger.db("UPDATE", "shopee_accounts", `Set sz-token: ${state.setSzAccName}`);
            const isApk = !szInput.startsWith(FALLBACK_SZ_PREFIX);
            let m = `✅ <b>sz-token TERSIMPAN</b>\n`;
            m += `<code>--------------------------</code>\n`;
            m += `👤 Akun: <b>${state.setSzAccName}</b>\n`;
            m += `🔑 Token: <code>${szInput.slice(0, 16)}...${szInput.slice(-4)}</code>\n`;
            m += `📊 Tipe: <b>${/\|08\|[12]$/.test(szInput) ? 'APK ✅ (voucher OK)' : (/\|08\|3$/.test(szInput) ? 'WEB ⚠️ (voucher mungkin ditolak)' : 'Custom')}</b>\n`;
            m += `<code>--------------------------</code>`;
            delete userState[userId];
            return await safeEditMessage(chatId, state.target_message_id, m, { reply_markup: { inline_keyboard: [[{ text: "👤 Kelola Akun", callback_data: "manage_acc" }], [{ text: "🏠 Menu Utama", callback_data: "back_home" }]] } });
        } catch (e) {
            delete userState[userId];
            return await safeEditMessage(chatId, state.target_message_id, `❌ <b>Gagal simpan:</b> <code>${e.message}</code>`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "manage_acc" }]] } });
        }
    }
    if (state && state.step === "WAIT_MISSION_LINK_REPLY") {
        const isCorrectReply = msg.reply_to_message && msg.reply_to_message.message_id === state.target_message_id;
        if (!isCorrectReply) return;

        let rawText = msg.text ? msg.text.trim() : "";
        if (!rawText.includes("shp.ee") && !rawText.includes("shopee.co.id") && !rawText.includes("games.shopee.co.id")) {
            return await safeSendMessage(chatId, "📌 <b>Tautan Salah:</b> Kirimkan tautan referral resmi dari game Shopee Kak.");
        }

        const loadingMsg = await safeSendMessage(chatId, "🔓 <b>Membongkar enkripsi tautan referral game...</b>");

        try {
            let expandedUrl = rawText;

            if (expandedUrl.includes("shp.ee") || expandedUrl.includes("s.shopee.co.id")) {
                expandedUrl = await resolveShopeeShortlink(expandedUrl);
            }

            let shareToken = null;

            const cleanUrl = expandedUrl.replace(/&amp;/g, '&');

            if (/\/farm\/|[?&]skey=|ask4water|\/garden\//i.test(cleanUrl)) {
                throw new Error("WRONG_GAME_FARM");
            }

            if (cleanUrl.includes("mmp_ad_id=")) {
                shareToken = cleanUrl.split("mmp_ad_id=")[1]?.split("&")[0];
            } else if (cleanUrl.includes("share_token=")) {
                shareToken = cleanUrl.split("share_token=")[1]?.split("&")[0];
            }

            if (!shareToken) {
                const regexMatch = cleanUrl.match(/[?&](?:mmp_ad_id|share_token)=([^&]+)/);
                if (regexMatch) shareToken = regexMatch[1];
            }

            if (!shareToken) {
                if (!/\/referral\b/i.test(cleanUrl)) throw new Error("WRONG_GAME_OTHER");
                throw new Error("Parameter token 'mmp_ad_id' gagal diculik dari URL.");
            }

            logger.engine("MISSION_INTEL", `Sukses mengamankan share_token: ${shareToken.substring(0, 20)}...`, "SUCCESS");

            const { data: activeAccount } = await supabase.from('shopee_accounts').select('*').eq('id', state.account_database_id).maybeSingle();
            if (!activeAccount) throw new Error("Sesi akun terputus dari database.");
            if (activeAccount.cookie) activeAccount.cookie = decryptCookie(activeAccount.cookie);

            await safeEditMessage(chatId, loadingMsg.message_id, "📌 <b>Membuka browser siluman & sinkron signature anti-bot games...</b>");
            const missionRes = await runGamesReferralMission(shareToken, activeAccount.cookie, activeAccount.device_identity);
            if (!missionRes.success) throw new Error(`Join Failed: ${missionRes.msg}`);

            const joinRes = { referrerName: missionRes.referrerName };
            const unlockRes = { voucherName: missionRes.voucherName, minSpend: missionRes.minSpend };

            await bot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
            delete userState[userId];
            logger.engine("MISSION_COMPLETE", `Sukses claim misi refferal untuk user ${userId}`, "SUCCESS");
            let winMsg = `🎯 <b>MISI GAME REFERRAL SUKSES!</b> 🎉\n`;
            winMsg += `<code>--------------------------</code>\n`;
            winMsg += `📌 <b>Eksekutor :</b> <code>${activeAccount.account_name}</code>\n`;
            winMsg += `📌 <b>Referral  :</b> <code>${joinRes.referrerName}</code>\n`;
            winMsg += `📌 <b>Hadiah    :</b> <b>${unlockRes.voucherName}</b>\n`;
            winMsg += `📌 <b>Min Spend :</b> Rp ${parseInt(unlockRes.minSpend).toLocaleString('id-ID')}\n`;
            winMsg += `<code>--------------------------</code>\n`;
            winMsg += `🎁 <i>Kotak kado referral sukses dijebol dan diklaim otomatis masuk ke kantong voucher akun target!</i>\n`;

            return await safeSendMessage(chatId, winMsg, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali ke Dashboard", callback_data: "back_home" }]] }
            });

        } catch (err) {
            logger.engine("MISSION_CRITICAL", err.message, "ERR");
            delete userState[userId];

            let userFriendlyReason = err.message;

            if (err.message.includes("referee reaches upper limit")) {
                userFriendlyReason = "Akun ini sudah pernah mengklaim misi ini atau sudah mencapai batas limit (S&K Shopee).";
            } else if (err.message === "WRONG_GAME_FARM") {
                userFriendlyReason = "⚠️ Link ini game <b>Farm/Siram (Tanam)</b> — bukan game Referral-Gift. Mission ini hanya mendukung link <b>Referral Gift</b> (yang mendarat di <code>games.shopee.co.id/referral/</code> & membawa token <code>share_token</code>). Minta target kirim link referral gift yang benar ya Kak.";
            } else if (err.message === "WRONG_GAME_OTHER") {
                userFriendlyReason = "Jenis game pada link ini belum didukung. Mission hanya mendukung game <b>Referral Gift</b> (domain <code>games.shopee.co.id/referral/</code>). Pastikan link-nya benar dari game referral gift.";
            } else if (err.message.includes("Parameter token 'mmp_ad_id'")) {
                userFriendlyReason = "Tautan tidak valid! Token pelacak gagal ditemukan. Silakan ganti dan gunakan tautan referral (link reff) yang lain!";
            } else if (err.message.includes("anti fraud blocked")) {
                userFriendlyReason = "Sistem Keamanan Aktif! Proses buka kado diblokir karena terdeteksi High-Risk (Anti-Fraud) oleh Shopee. Solusi: Cek akun shopee kamu, jika terkena puzzle tolong singkirkan atau gunakan akun tumbal segar yang berbeda!";
            } else if (err.message.includes("link reaches quota")) {
                userFriendlyReason = "Slot Penuh! Tautan kado tersebut sudah mencapai batas kuota dibantu. Silakan suruh target Anda ganti atau buat link reff baru lagi!";
            } else if (err.message.includes("self referral")) {
    userFriendlyReason = "Terdeteksi menggunakan link sendiri (Self-Referral). Silakan gunakan link milik akun Shopee yang berbeda.";
} else if (err.message.includes("user_scope rule") || err.message.includes("voucher dispatch failed")) {
                userFriendlyReason = "Akun Tidak Memenuhi Syarat! Kuki akun tumbal Anda tidak masuk dalam kriteria penerima kado ini (Biasanya kado khusus Akun Baru / New User). Silakan ganti dengan kuki akun tumbal yang lain!";
} else if (err.message.toLowerCase().includes("authentication failed")) {
                userFriendlyReason = "Autentikasi Perangkat Gagal! Sesi token keamanan kuki atau device identity akun tumbal ini sudah tidak valid di server game Shopee. Silakan hapus akun lalu login QR ulang!";
            } else if (err.message.toLowerCase().includes("link expires")) {
                userFriendlyReason = "Terdeteksi Link yang di gunakan telah berakhir! Tolong ganti dengan Link baru.";
            } else if (/\b403\b|\b418\b/.test(err.message)) {
                userFriendlyReason = "Server Game Shopee menolak request (HTTP 403/418 — Anti-Bot). Penyebab: sesi kuki akun tumbal sudah mati/kadaluarsa, atau device identity tidak lagi valid. Solusi: hapus akun ini lalu login QR ulang dengan kuki segar!";
            } else if (/\b401\b/.test(err.message)) {
                userFriendlyReason = "Autentikasi Gagal (HTTP 401)! Sesi kuki akun tumbal sudah logout dari server game. Silakan login QR ulang.";
            }

            let errMsg = `⚡ <b>Gagal Eksekusi Misi Referral!</b>\n`;
            errMsg += `<code>--------------------------</code>\n`;
            errMsg += `<b>Penyebab :</b> <code>${userFriendlyReason}</code>\n`;
            errMsg += `<code>--------------------------</code>`;

            return await safeEditMessage(chatId, loadingMsg.message_id, errMsg, {
                reply_markup: { inline_keyboard: [[{ text: "👤 Coba Akun Lain", callback_data: "memru_mission_start" }]] }
            });
        }
    }
    if (state && state.step === "WAIT_ADDR_NAME_PHONE") {
        const isCorrectReply = msg.reply_to_message && msg.reply_to_message.message_id === state.target_message_id;
        if (!isCorrectReply) return;

        const rawText = text.trim();
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await bot.deleteMessage(chatId, state.target_message_id).catch(() => {});

        if (!rawText.includes("|")) {
            let rePrompt = `⚠️ <b>FORMAT SALAH! SILAKAN ULANGI [STEP 1]</b>\n`;
            rePrompt += `<code>--------------------------</code>\n`;
            rePrompt += `Wajib menggunakan pembatas tanda pipa ( <b>|</b> ) antara Nama dan No HP!\n\n`;
            rePrompt += `📌 <i>Contoh penulisan: Aji|6285126903165</i>\n`;
            rePrompt += `<code>--------------------------</code>`;

            const sent = await bot.sendMessage(chatId, rePrompt, {
                parse_mode: "HTML",
                reply_markup: { force_reply: true, selective: true }
            });
            userState[userId].target_message_id = sent.message_id;
            return;
        }

        const [name, phone] = rawText.split("|");
        userState[userId].name = name.trim();
        userState[userId].phone = phone.trim();
        userState[userId].step = "WAIT_ADDR_GPS";

        let promptGPS = `📍 <b>PROSES ALAMAT BARU [STEP 2]</b>\n`;
        promptGPS += `<code>--------------------------</code>\n`;
        promptGPS += `Sekarang masukkan koordinat map lokasi rumah Anda (Gunakan data Lat & Lon dari Google Maps).\n\n`;
        promptGPS += `📌 <i>Contoh format: -7.214607,112.762318</i>\n`;
        promptGPS += `<code>--------------------------</code>`;

        const sent = await bot.sendMessage(chatId, promptGPS, {
            parse_mode: "HTML",
            reply_markup: { force_reply: true, selective: true }
        });
        userState[userId].target_message_id = sent.message_id;
    }

    if (state && state.step === "WAIT_ADDR_GPS") {
        const isCorrectReply = msg.reply_to_message && msg.reply_to_message.message_id === state.target_message_id;
        if (!isCorrectReply) return;

        const rawGPS = text.trim();
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await bot.deleteMessage(chatId, state.target_message_id).catch(() => {});

        if (!rawGPS.includes(",")) {
            let rePromptGPS = `⚠️ <b>KOORDINAT SALAH! SILAKAN ULANGI [STEP 2]</b>\n`;
            rePromptGPS += `<code>--------------------------</code>\n`;
            rePromptGPS += `Pisahkan nilai Latitude dan Longitude Anda menggunakan tanda koma!\n\n`;
            rePromptGPS += `📌 <i>Contoh format: -7.214607,112.762318</i>\n`;
            rePromptGPS += `<code>--------------------------</code>`;

            const sent = await bot.sendMessage(chatId, rePromptGPS, {
                parse_mode: "HTML",
                reply_markup: { force_reply: true, selective: true }
            });
            userState[userId].target_message_id = sent.message_id;
            return;
        }

        const [lat, lon] = rawGPS.split(",");
        const loadingGeo = await safeSendMessage(chatId, "📍 <b>Menghubungkan radar geo-lokasi Shopee... Memeriksa kodepos...</b>");

        try {
            const { data: acc } = await supabase.from('shopee_accounts').select('*').eq('id', state.account_database_id).maybeSingle();
            if (acc && acc.cookie) acc.cookie = decryptCookie(acc.cookie);
            const lockedIdentity = acc.device_identity || generateDynamicDevice();

            const geoRes = await fetchHierarchyByGeo(lat.trim(), lon.trim(), acc.cookie, lockedIdentity);
            if (!geoRes.success) throw new Error(geoRes.msg);

            const divisions = geoRes.geoData.division_info_list || [];
            const stateName = divisions.find(d => d.division_level === 1)?.division_name || "";
            const cityName = divisions.find(d => d.division_level === 2)?.division_name || "";
            const districtName = divisions.find(d => d.division_level === 3)?.division_name || "";
            const zipcode = geoRes.geoData.zipcode || "";

            userState[userId].lat = lat.trim();
            userState[userId].lon = lon.trim();
            userState[userId].state = stateName;
            userState[userId].city = cityName;
            userState[userId].district = districtName;
            userState[userId].zipcode = zipcode;
            userState[userId].step = "WAIT_ADDR_DETAIL_PATOKAN";

            await bot.deleteMessage(chatId, loadingGeo.message_id).catch(() => {});

            let promptDetail = `📍 <b>PROSES ALAMAT BARU [STEP 3 - FINAL]</b>\n`;
            promptDetail += `<code>--------------------------</code>\n`;
            promptDetail += `📌 <b>Wilayah Terkunci :</b> <i>${districtName}, ${cityName}, ${stateName} (${zipcode})</i>\n`;
            promptDetail += `<code>--------------------------</code>\n\n`;
            promptDetail += `📍 <b>MASUKKAN ALAMAT DETAIL & PATOKAN RUMAH:</b>\n`;
            promptDetail += `Ketik alamat jalan lengkap rumah Anda beserta patokan/warna cat rumah dibatasi dengan tanda pipa ( <b>|</b> ).\n\n`;
            promptDetail += `📌 <i>Contoh: Jalan Dolly Jarak No991a | Rumah pagar hitam cat hijau</i>\n`;
            promptDetail += `<code>--------------------------</code>`;

            const sent = await bot.sendMessage(chatId, promptDetail, {
                parse_mode: "HTML",
                reply_markup: { force_reply: true, selective: true }
            });
            userState[userId].target_message_id = sent.message_id;

        } catch (e) {
            await bot.deleteMessage(chatId, loadingGeo.message_id).catch(() => {});
            return await safeSendMessage(chatId, `❌ <b>Geo API Reject:</b> <code>${e.message}</code>\nSilakan panggil menu alamat ulang.`);
        }
    }

    if (state && state.step === "WAIT_ADDR_DETAIL_PATOKAN") {
        const isCorrectReply = msg.reply_to_message && msg.reply_to_message.message_id === state.target_message_id;
        if (!isCorrectReply) return;

        const rawDetail = text.trim();
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await bot.deleteMessage(chatId, state.target_message_id).catch(() => {});

        if (!rawDetail.includes("|")) {
            let rePromptDetail = `⚠️ <b>PEMBATAS SALAH! SILAKAN ULANGI [STEP 3 - FINAL]</b>\n`;
            rePromptDetail += `<code>--------------------------</code>\n`;
            rePromptDetail += `Wajib masukkan alamat detail diikuti patokan rumah Anda dengan pemisah pipa ( <b>|</b> ) !\n\n`;
            rePromptDetail += `📌 <i>Contoh: Jalan Dolly Jarak No991a | Rumah pagar hitam cat hijau</i>\n`;
            rePromptDetail += `<code>--------------------------</code>`;

            const sent = await bot.sendMessage(chatId, rePromptDetail, {
                parse_mode: "HTML",
                reply_markup: { force_reply: true, selective: true }
            });
            userState[userId].target_message_id = sent.message_id;
            return;
        }

        const [fullAddress, instruction] = rawDetail.split("|");
        state.fullAddress = fullAddress.trim();
        state.instruction = instruction.trim();

        const finalLoading = await safeSendMessage(chatId, "📌 <b>Injeksi data... Mendaftarkan alamat baru ke database Shopee...</b>");

        try {
            const { data: acc } = await supabase.from('shopee_accounts').select('*').eq('id', state.account_database_id).maybeSingle();
            if (acc && acc.cookie) acc.cookie = decryptCookie(acc.cookie);
            const lockedIdentity = acc.device_identity || generateDynamicDevice();

            const createRes = await injectCreateAddress(state, acc.cookie, lockedIdentity);
            if (!createRes.success) throw new Error(createRes.msg);

            await bot.deleteMessage(chatId, finalLoading.message_id).catch(() => {});

            let successMsg = `📍 <b>INJEKSI ALAMAT BARU SUKSES!</b> ✅\n`;
            successMsg += `<code>--------------------------</code>\n`;
            successMsg += `🆔 <b>Address ID :</b> <code>${createRes.addressId}</code>\n`;
            successMsg += `📍 <b>Penerima   :</b> <b>${state.name}</b> (${state.phone})\n`;
            successMsg += `📍 <b>Alamat     :</b> <i>${state.fullAddress} (${state.instruction})</i>\n`;
            successMsg += `📌 <b>GPS Region :</b> <code>${state.lat}, ${state.lon}</code>\n`;
            successMsg += `<code>--------------------------</code>\n\n`;
            successMsg += `📌 <i>Alamat otomatis terkunci sebagai alamat pengiriman utama (Default) untuk operasional Auto CO!</i>`;

            delete userState[userId];

            return await safeSendMessage(chatId, successMsg, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali ke Kelola Alamat", callback_data: `addr_manage_${state.account_database_id}` }]] }
            });

        } catch (e) {
            await bot.deleteMessage(chatId, finalLoading.message_id).catch(() => {});
            delete userState[userId];
            return await safeSendMessage(chatId, `📍 <b>Gagal Menyuntik Alamat:</b> <code>${e.message}</code>`);
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 🍪 FULL-ORDER: Cookie & Fingerprint Text Handlers
    // ═══════════════════════════════════════════════════════════════════════════
    if (state && state.step === "WAIT_FO_COOKIE") {
        logger.info(userId, "MESSAGE_RCV", "Cookie input diterima");
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await bot.deleteMessage(chatId, state.fo_prompt_id).catch(() => {});

        let rawCookie = text.trim();
        if (!rawCookie || rawCookie.length < 20) {
            const errMsg = await safeSendMessage(chatId, "❌ <b>Cookie terlalu pendek / kosong.</b>\n\nSilakan kirimkan ulang.", { reply_markup: { force_reply: true, selective: true } });
            userState[userId].fo_prompt_id = errMsg.message_id;
            return;
        }

        let finalCookie = rawCookie;
        let fingerprint = '';
        if (foIsWebCookie(rawCookie)) {
            const conv = foConvertWebToAppCookie(rawCookie);
            finalCookie = conv.cookie;
            fingerprint = conv.fingerprint;
        } else {
            const fpMatch = rawCookie.match(/SPC_F=([^;]+)/);
            fingerprint = fpMatch ? fpMatch[1] : '';
        }

        const parsed = validateAndParseShopeeCookie(finalCookie);
        if (!parsed.success) {
            const errMsg = await safeSendMessage(chatId, `❌ <b>Cookie Invalid:</b> ${parsed.reason}\n\nSilakan kirim ulang cookie yang valid.`, { reply_markup: { force_reply: true, selective: true } });
            userState[userId].fo_prompt_id = errMsg.message_id;
            return;
        }

        userState[userId] = { step: "WAIT_FO_FINGERPRINT", foCookie: finalCookie, foFingerprint: fingerprint };

        const poolCount = loadFpPool().length;
        let fpMsg = `✅ <b>Cookie Diterima!</b>\n<code>--------------------------</code>\n`;
        fpMsg += `🔑 SPC_U: <code>${(finalCookie.match(/SPC_U=([^;]+)/) || ['','?'])[1].substring(0,12)}...</code>\n`;
        fpMsg += `<code>--------------------------</code>\n\n`;
        fpMsg += `📱 <b>INPUT FINGERPRINT (sz_token)</b>\n`;
        fpMsg += `<code>--------------------------</code>\n`;
        fpMsg += `Masukkan sz_token / fingerprint device.\n`;
        fpMsg += `Atau tekan tombol <b>Generate</b> untuk pakai fingerprint acak dari pool.\n\n`;
        fpMsg += `⚠️ <i>"Generate Fingerprint" tidak selalu sukses untuk checkout, harap membawa sendiri fingerprint nya.</i>\n\n`;
        fpMsg += `📊 Pool tersedia: <b>${poolCount}</b> fingerprint\n`;
        fpMsg += `<code>--------------------------</code>`;
        const fpKb = [[{ text: `🔄 Generate Fingerprint (${poolCount})`, callback_data: 'fo_gen_fp' }]];
        const sentMsg = await bot.sendMessage(chatId, fpMsg, { parse_mode: "HTML", reply_markup: { inline_keyboard: fpKb } });
        userState[userId].fo_fp_prompt_id = sentMsg.message_id;
        return;
    }

    if (state && state.step === "WAIT_FO_FINGERPRINT") {
    let fp = text.trim();

    // 🛡️ ANTI-MELEBER & VALIDASI KETAT FINGERPRINT
    const isLink = fp.includes("shopee.co.id") || fp.includes("shope.ee") || fp.startsWith("http://") || fp.startsWith("https://");
    const isCookieOrText = fp.includes("SPC_EC") || fp.includes(" ") || fp.includes("\n");
    
    // Validasi format: Token asli harus mengandung karakter "|" sebagai pemisah struktur data
    const hasPipeSeparator = fp.includes("|"); 

    if (fp !== '-' && fp !== '' && (isLink || isCookieOrText || !hasPipeSeparator)) {
        // Hapus chat input yang salah agar tidak mengotori room
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        
        // Kirim notifikasi peringatan interaktif
        const warnNotice = await bot.sendMessage(chatId, 
`❌ <b>Format Salah / Terdeteksi Teks Ilegal!</b>

Sistem mendeteksi input Anda <b>bukan Fingerprint (sz_token)</b> yang valid. Format token yang benar biasanya dipisahkan oleh tanda <code>|</code>.

👉 Silakan ketik <code>-</code> atau klik tombol <b>Generate</b> di atas jika tidak punya sz_token sendiri.`, { parse_mode: "HTML" });
        
        setTimeout(() => {
            bot.deleteMessage(chatId, warnNotice.message_id).catch(() => {});
        }, 4000);
        
        return; 
    }

    // 🟢 JALUR AMAN: Jika lolos filter
    await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
    await bot.deleteMessage(chatId, state.fo_fp_prompt_id).catch(() => {});

    // Deteksi Jenis Platform Fingerprint
    let fpType = "Bawaan Akun / Sistem";
    if (fp !== '-' && fp !== '') {
        const parts = fp.split('|');
        // Mengambil kolom ke-4 dan ke-5 jika ada (Contoh: "08" dan "1" menjadi "08|1")
        const osCode = parts[3]; 
        const osSubCode = parts[4];
        const fullOsCode = osSubCode ? `${osCode}|${osSubCode}` : osCode;

        if (fullOsCode === "08|0") fpType = "🤖 Generator FP";
        else if (fullOsCode === "08|1") fpType = "📱 Android App";
        else if (fullOsCode === "08|2") fpType = "🍏 iOS App";
        else if (fullOsCode === "08|3") fpType = "🌐 Web Browser";
        else fpType = `❓ Unknown Platform (${fullOsCode})`;

        // Simpan ke pool database
        saveFpToPool(fp);
    }

console.log(`\x1b[36m[USER-${userId}]\x1b[0m | \x1b[35mFP_DETECTED\x1b[0m | Menggunakan Jenis: \x1b[1m${fpType}\x1b[0m`);

    if (fp === '-' || fp === '') {
        fp = state.foFingerprint || (state.foCookie.match(/SPC_F=([^;]+)/) || ['', ''])[1] || '';
    }
    userState[userId].foFingerprint = fp;

    const cookie = state.foCookie;
    const loadMsg = await safeSendMessage(chatId, '⏳ Memvalidasi cookie...');

    try {
        const csrf = foExtractCsrfToken(cookie);
        const headers = { 
            host: "shopee.co.id", 
            accept: "application/json", 
            'content-type': "application/json", 
            'user-agent': getUA(cookie), 
            cookie 
        };
        const accRes = await axios.get('https://shopee.co.id/api/v4/account/basic/get_account_info', { headers, timeout: 10000 });
        const accData = accRes.data;
        const username = accData?.data?.username || accData?.data?.phone || 'Unknown';

        userState[userId].foUsername = username;
        userState[userId].foCsrf = csrf;
        userState[userId].step = "WAIT_FO_PRODUCT_LINK";
        userState[userId].cart = [];
        userState[userId].foMode = true;

        // Cetak informasi jenis FP di notifikasi sukses bot biar user tahu
        let sucMsg = `✅ <b>COOKIE VALID!</b>\n<code>--------------------------</code>\n`;
        sucMsg += `👤 <b>Username :</b> <code>${username}</code>\n`;
        sucMsg += `🔑 <b>Jenis FP  :</b> <code>${fpType}</code>\n`; // <-- KITA TAMBAHKAN DI SINI
        sucMsg += `<code>--------------------------</code>\n\n`;
        sucMsg += `🛍️ <b>MASUKKAN LINK PRODUK SHOPEE</b>\n`;
        sucMsg += `<code>--------------------------</code>\n`;
        sucMsg += `Silakan reply pesan ini dengan link produk Shopee yang ingin di-checkout.\n\n`;
        sucMsg += `<i>Contoh: https://s.shopee.co.id/20tEhVS80q</i>\n`;
        sucMsg += `<code>--------------------------</code>`;

        await bot.editMessageText(sucMsg, { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML" });
        userState[userId].fo_link_prompt_id = loadMsg.message_id;
    } catch (e) {
        const errTxt = e.response?.data?.error_msg || e.message || 'unknown';
        await bot.editMessageText(`❌ <b>Cookie Ditolak / Expired</b>\n<code>--------------------------</code>\n<code>${errTxt}</code>\n\nSilakan coba lagi.`, { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔄 Ulangi", callback_data: "fo_cookie_start" }, { text: "🏠 Menu", callback_data: "back_home" }]] } });
        delete userState[userId];
    }
    return;
}
// ═══════════════════════════════════════════════════════════════════════════
    if (state && state.step === "LOGIN_FO_COOKIE") {
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await bot.deleteMessage(chatId, state.fo_prompt_id).catch(() => {});

        let rawCookie = text.trim();
        if (!rawCookie || rawCookie.length < 20) {
            const errMsg = await safeSendMessage(chatId, "❌ <b>Cookie terlalu pendek / kosong.</b>\n\nSilakan kirimkan ulang.", { reply_markup: { force_reply: true, selective: true } });
            userState[userId].fo_prompt_id = errMsg.message_id;
            return;
        }

        let finalCookie = rawCookie;
        let fingerprint = '';
        if (foIsWebCookie(rawCookie)) {
            const conv = foConvertWebToAppCookie(rawCookie);
            finalCookie = conv.cookie;
            fingerprint = conv.fingerprint;
        } else {
            const fpMatch = rawCookie.match(/SPC_F=([^;]+)/);
            fingerprint = fpMatch ? fpMatch[1] : '';
        }

        const parsed = validateAndParseShopeeCookie(finalCookie);
        if (!parsed.success) {
            const errMsg = await safeSendMessage(chatId, `❌ <b>Cookie Invalid:</b> ${parsed.reason}\n\nSilakan kirim ulang cookie yang valid.`, { reply_markup: { force_reply: true, selective: true } });
            userState[userId].fo_prompt_id = errMsg.message_id;
            return;
        }

        userState[userId] = { step: "LOGIN_FO_FINGERPRINT", foCookie: finalCookie, foFingerprint: fingerprint };

        const poolCount = loadFpPool().length;
        let fpMsg = `✅ <b>Cookie Diterima!</b>\n<code>--------------------------</code>\n`;
        fpMsg += `🔑 SPC_U: <code>${(finalCookie.match(/SPC_U=([^;]+)/) || ['','?'])[1].substring(0,12)}...</code>\n`;
        fpMsg += `<code>--------------------------</code>\n\n`;
        fpMsg += `📱 <b>INPUT FINGERPRINT (sz_token)</b>\n`;
        fpMsg += `<code>--------------------------</code>\n`;
        fpMsg += `Masukkan sz_token / fingerprint device.\n`;
        fpMsg += `Atau tekan tombol <b>Generate</b> untuk pakai fingerprint acak dari pool.\n\n`;
        fpMsg += `⚠️ <i>"Generate Fingerprint" tidak selalu sukses untuk checkout, harap membawa sendiri fingerprint nya.</i>\n\n`;
        fpMsg += `📊 Pool tersedia: <b>${poolCount}</b> fingerprint\n`;
        fpMsg += `<code>--------------------------</code>`;
        const fpKb = [[{ text: `🔄 Generate Fingerprint (${poolCount})`, callback_data: 'fo_gen_fp_login' }]];
        const sentMsg = await bot.sendMessage(chatId, fpMsg, { parse_mode: "HTML", reply_markup: { inline_keyboard: fpKb } });
        userState[userId].fo_fp_prompt_id = sentMsg.message_id;
        return;
    }

    if (state && state.step === "LOGIN_FO_FINGERPRINT") {
        let fp = text.trim();

        // 🛡️ ANTI-MELEBER & VALIDASI KETAT FINGERPRINT
        const isLink = fp.includes("shopee.co.id") || fp.includes("shope.ee") || fp.startsWith("http://") || fp.startsWith("https://");
        const isCookieOrText = fp.includes("SPC_EC") || fp.includes(" ") || fp.includes("\n");
        
        // Validasi format: Token asli harus mengandung karakter "|" sebagai pemisah struktur data
        const hasPipeSeparator = fp.includes("|"); 

        if (fp !== '-' && fp !== '' && (isLink || isCookieOrText || !hasPipeSeparator)) {
            // Hapus chat input yang salah agar tidak mengotori room
            await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
            
            // Kirim notifikasi peringatan interaktif
            const warnNotice = await bot.sendMessage(chatId, 
    `❌ <b>Format Salah / Terdeteksi Teks Ilegal!</b>

Sistem mendeteksi input Anda <b>bukan Fingerprint (sz_token)</b> yang valid. Format token yang benar biasanya dipisahkan oleh tanda <code>|</code>.

👉 Silakan ketik <code>-</code> atau klik tombol <b>Generate</b> di atas jika tidak punya sz_token sendiri.`, { parse_mode: "HTML" });
            
            setTimeout(() => {
                bot.deleteMessage(chatId, warnNotice.message_id).catch(() => {});
            }, 4000);
            
            return; 
        }

        // 🟢 JALUR AMAN: Jika lolos filter
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await bot.deleteMessage(chatId, state.fo_fp_prompt_id).catch(() => {});

        // Deteksi Jenis Platform Fingerprint
        let fpType = "Bawaan Akun / Sistem";
        if (fp !== '-' && fp !== '') {
            const parts = fp.split('|');
            const osCode = parts[3]; 
            const osSubCode = parts[4];
            const fullOsCode = osSubCode ? `${osCode}|${osSubCode}` : osCode;

            if (fullOsCode === "08|0") fpType = "🤖 Generator FP";
            else if (fullOsCode === "08|1") fpType = "📱 Android App";
            else if (fullOsCode === "08|2") fpType = "🍏 iOS App";
            else if (fullOsCode === "08|3") fpType = "🌐 Web Browser";
            else fpType = `❓ Unknown Platform (${fullOsCode})`;

            // Simpan ke pool database
            saveFpToPool(fp);
        }

        console.log(`\x1b[36m[USER-${userId}]\x1b[0m | \x1b[35mFP_DETECTED\x1b[0m | Menggunakan Jenis: \x1b[1m${fpType}\x1b[0m`);

        if (fp === '-' || fp === '') {
            fp = state.foFingerprint || (state.foCookie.match(/SPC_F=([^;]+)/) || ['', ''])[1] || '';
        }
        userState[userId].foFingerprint = fp;

        const cookie = state.foCookie;
        const loadMsg = await safeSendMessage(chatId, '⏳ Memvalidasi cookie & mendaftarkan ke database...');

        try {
            const csrf = foExtractCsrfToken(cookie);
            const headers = { 
                host: "shopee.co.id", 
                accept: "application/json", 
                'content-type': "application/json", 
                'user-agent': getUA(cookie), 
                cookie 
            };
            const accRes = await axios.get('https://shopee.co.id/api/v4/account/basic/get_account_info', { headers, timeout: 10000 });
            const accData = accRes.data;
            const username = accData?.data?.username || accData?.data?.phone || 'Unknown';
            const userPhone = accData?.data?.phone || null;

            // 💾 PROSES INTEGRASI INSERT SUPABASE DB
            const { error: insertErr } = await supabase.from('shopee_accounts').insert({
                user_id: userId,
                account_name: username,
                cookie: encryptCookie(cookie),
                device_identity: { 
                    phone: userPhone, 
                    device_id: (cookie.match(/SPC_F=([^;]+)/) || ['', ''])[1] || '', 
                    sz_token: fp, 
                    x_sap_ri: '', 
                    sz_token_ts: fp ? Date.now() : null 
                }
            });

            if (insertErr) throw new Error(`Supabase Error: ${insertErr.message}`);

            // Hapus status state agar sesi chat bersih
            delete userState[userId];

            // Cetak informasi sukses menyimpan akun kelolaan baru
            let sucMsg = `✅ <b>AKUN BERHASIL DISIMPAN!</b>\n<code>--------------------------</code>\n`;
            sucMsg += `👤 <b>Username :</b> <code>${username}</code>\n`;
            sucMsg += `🔑 <b>Jenis FP  :</b> <code>${fpType}</code>\n`;
            sucMsg += `<code>--------------------------</code>\n\n`;
            sucMsg += `Sesi login kelola akun baru berhasil ditambahkan dan diamankan di dalam database bot.`;

            await bot.editMessageText(sucMsg, { 
                chat_id: chatId, 
                message_id: loadMsg.message_id, 
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "➕ Tambah Akun Lagi", callback_data: "method_cookie" }],
                        [{ text: "🔙 Kembali ke Kelola Akun", callback_data: "manage_acc" }]
                    ]
                }
            });
        } catch (e) {
            const errTxt = e.response?.data?.error_msg || e.message || 'unknown';
            await bot.editMessageText(`❌ <b>Gagal Menyimpan Akun</b>\n<code>--------------------------</code>\n<code>${errTxt}</code>\n\nSilakan coba lagi.`, { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔄 Ulangi", callback_data: "method_cookie" }, { text: "🏠 Menu", callback_data: "back_home" }]] } });
            delete userState[userId];
        }
        return;
    }

    if (state && state.step === "WAIT_FO_PRODUCT_LINK") {
        if (!text.includes("shopee.co.id") && !text.includes("shp.ee") && !text.includes("shopee.id") && !text.includes("s.shopee.co.id")) {
            return await safeSendMessage(chatId, "📌 <b>Tautan Tidak Dikenali:</b> Silakan reply dengan tautan produk resmi Shopee.");
        }
        logger.info(userId, "MESSAGE_RCV", text.trim().substring(0, 60));
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        const loadingMsg = await safeSendMessage(chatId, "🔓 <b>Sedang membongkar enkripsi & melacak model ID produk...</b>");

        try {
            const cookie = state.foCookie;
            const identity = generateDynamicDevice();
            let targetUrl = text.trim();

            if (text.includes("shp.ee") || text.includes("s.shopee.co.id")) {
                targetUrl = await resolveShopeeShortlink(text);
            }

            let shopid, itemid;
            const regexOpa = /\/opaanlp\/(\d+)\/(\d+)/i;
            const regexProductGroup = /product\/(\d+)\/(\d+)/i;
            const regexDotGroup = /i\.(\d+)\.(\d+)/i;
            const regexQueryGroup = /itemid=(\d+)&shopid=(\d+)/i;
            const regexQueryAltGroup = /shopid=(\d+)&itemid=(\d+)/i;

            if (regexOpa.test(targetUrl)) {
                const match = targetUrl.match(regexOpa); shopid = match[1]; itemid = match[2];
            } else if (regexProductGroup.test(targetUrl)) {
                const match = targetUrl.match(regexProductGroup); shopid = match[1]; itemid = match[2];
            } else if (regexDotGroup.test(targetUrl)) {
                const match = targetUrl.match(regexDotGroup); shopid = match[1]; itemid = match[2];
            } else if (regexQueryGroup.test(targetUrl)) {
                const match = targetUrl.match(regexQueryGroup); itemid = match[1]; shopid = match[2];
            } else if (regexQueryAltGroup.test(targetUrl)) {
                const match = targetUrl.match(regexQueryAltGroup); shopid = match[1]; itemid = match[2];
            }
            if (!shopid || !itemid) {
                const genericMatch = targetUrl.match(/[\/\.](\d{6,12})[\/\.](\d{9,13})/);
                if (genericMatch) { shopid = genericMatch[1]; itemid = genericMatch[2]; }
            }
            if (!shopid || !itemid) throw new Error("Gagal mengekstrak komponen ID Produk Shopee.");

            let panelRes = await fetchProductFromHTML(shopid, itemid, cookie, identity);
            if (!panelRes.success) panelRes = await fetchShopeePdpGet(shopid, itemid, cookie, identity);
            if (!panelRes.success) panelRes = await fetchShopeeCartPanel(shopid, itemid, cookie, identity);

            if (targetUrl.includes("opaanlp")) {
                let extractedUtm = "an_11325770730";
                try { const urlObj = new URL(targetUrl); const params = new URLSearchParams(urlObj.search); if (params.has("utm_source")) extractedUtm = params.get("utm_source"); } catch (e) {}
                const affRes = await fetchShopeeLandingItemInfo(targetUrl, shopid, itemid, extractedUtm, cookie, identity.ua, identity);
                if (affRes.success) {
                    if (affRes.modelid !== 0) {
                        userState[userId].shopid = parseInt(shopid);
                        userState[userId].itemid = parseInt(itemid);
                        userState[userId].modelid = affRes.modelid;
                        userState[userId].productName = affRes.productName || "Produk Shopee";
                        userState[userId].shopName = affRes.shopName || "Shopee Store";
                        userState[userId].models = affRes.models || (panelRes.success ? panelRes.itemData?.models || [] : []);
                        userState[userId].variationName = '';
                        userState[userId].identity = identity;
                        userState[userId].step = "WAIT_FO_QTY";

                        let qMsg = `🔐 <b>MASUKKAN JUMLAH BARANG (AFFILIATE)</b>\n<code>--------------------------</code>\n`;
                        qMsg += `👤 <b>Akun :</b> <code>${state.foUsername}</code>\n`;
                        qMsg += `🏪 <b>Toko :</b> <code>${affRes.shopName || '-'}</code>\n`;
                        qMsg += `🛍️ <b>Produk:</b> <code>${(affRes.productName || '').substring(0, 40)}...</code>\n`;
                        qMsg += `🆔 <b>Model :</b> <code>${affRes.modelid}</code>\n`;
                        qMsg += `<code>--------------------------</code>\n📌 <i>Pilih kuantitas:</i>`;
                        const kb = [[{ text: "1 Pcs", callback_data: "fo_qty_1" }, { text: "2 Pcs", callback_data: "fo_qty_2" }, { text: "3 Pcs", callback_data: "fo_qty_3" }], [{ text: "🔢 Manual", callback_data: "fo_qty_manual" }], [{ text: "❌ Batal", callback_data: "back_home" }]];
                        return await bot.editMessageText(qMsg, { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: "HTML", reply_markup: { inline_keyboard: kb } });
                    }
                    if (panelRes.success && panelRes.itemData?.models?.length) {
                        affRes.models = panelRes.itemData.models;
                    }
                    if (!panelRes.success) panelRes = { success: true, itemData: { name: affRes.productName, stock: affRes.stock || 99, models: affRes.models || [] } };
                }
            }

            if (!panelRes.success) throw new Error(panelRes.msg || "Gagal fetch product info");
            const item = panelRes.itemData;
            const productName = item.name || "Produk Shopee";
            const models = item.models || [];
            const stock = item.stock || 99;

            userState[userId].shopid = parseInt(shopid);
            userState[userId].itemid = parseInt(itemid);
            userState[userId].modelid = 0;
            userState[userId].productName = productName;
            userState[userId].shopName = "Shopee Store";
            userState[userId].models = models;
            userState[userId].variationName = '';
            userState[userId].identity = identity;

            if (models.length > 0) {
                const readyModels = models.filter(m => m.stock > 0 && m.is_selectable === true);
                if (readyModels.length > 0) {
                    userState[userId].step = "WAIT_FO_VARIATION";
                    let vMsg = `🛍️ <b>PILIH VARIASI PRODUK</b>\n<code>--------------------------</code>\n`;
                    vMsg += `🆔 <b>Shop ID :</b> <code>${shopid}</code>\n`;
                    vMsg += `🆔 <b>Item ID :</b> <code>${itemid}</code>\n`;
                    vMsg += `<code>--------------------------</code>\n📌 <i>Pilih variasi:</i>`;
                    const kb = readyModels.map(m => [{ text: `📦 ${m.name} (Stok: ${m.stock})`, callback_data: `fo_model_${m.model_id}` }]);
                    kb.push([{ text: "❌ Batal", callback_data: "back_home" }]);
                    return await bot.editMessageText(vMsg, { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: "HTML", reply_markup: { inline_keyboard: kb } });
                }
            }

            userState[userId].step = "WAIT_FO_QTY";
            let qMsg = `🔐 <b>MASUKKAN JUMLAH BARANG</b>\n<code>--------------------------</code>\n`;
            qMsg += `👤 <b>Akun :</b> <code>${state.foUsername}</code>\n`;
            qMsg += `🆔 <b>Shop ID:</b> <code>${shopid}</code>\n`;
            qMsg += `🆔 <b>Item ID:</b> <code>${itemid}</code>\n`;
            qMsg += `📦 <b>Stok   :</b> <b>${stock} Pcs</b>\n`;
            qMsg += `<code>--------------------------</code>\n📌 <i>Pilih kuantitas:</i>`;
            const kb = [[{ text: "1 Pcs", callback_data: "fo_qty_1" }, { text: "2 Pcs", callback_data: "fo_qty_2" }, { text: "3 Pcs", callback_data: "fo_qty_3" }], [{ text: "🔢 Manual", callback_data: "fo_qty_manual" }], [{ text: "❌ Batal", callback_data: "back_home" }]];
            return await bot.editMessageText(qMsg, { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: "HTML", reply_markup: { inline_keyboard: kb } });

        } catch (err) {
            let failMsg = `❌ <b>Gagal Memproses Tautan!</b>\n<code>--------------------------</code>\n`;
            failMsg += `<b>Error:</b> <code>${err.message}</code>\n<code>--------------------------</code>`;
            return await bot.editMessageText(failMsg, { chat_id: chatId, message_id: loadingMsg.message_id, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔄 Ulangi", callback_data: "fo_cookie_start" }]] } });
        }
    }

    if (state && state.step === "WAIT_FO_QTY_MANUAL") {
        const rawQty = text.trim();
        const qty = parseInt(rawQty);
        if (isNaN(qty) || qty < 1 || qty > 100) {
            return await safeSendMessage(chatId, "📌 <b>Input Salah:</b> Masukkan angka antara 1 - 100.");
        }
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        const us = userState[userId];
        us.cart.push({ shopid: us.shopid, itemid: us.itemid, modelid: us.modelid, quantity: qty, productName: us.productName, shopName: us.shopName, variationName: us.variationName || '' });

        const cartNow = us.cart;
        const distinctShops = new Set(cartNow.map(c => c.shopid)).size;
        const cartFull = cartNow.length >= 2 || distinctShops >= 2;
        const last = cartNow[cartNow.length - 1];

        logger.engine("FO_CART", `User ${userId} tambah produk (text): ${last.productName} x${qty}`, "SUCCESS");
        let addMsg = `📥 <b>BERHASIL MASUK KERANJANG!</b>\n\n`;
        addMsg += `🏪 <b>Toko:</b> ${last.shopName}\n📦 <b>Produk:</b> ${last.productName.substring(0, 45)}\n`;
        if (last.variationName) addMsg += `👕 <b>Variasi:</b> ${last.variationName}\n`;
        addMsg += `🔢 <b>Jumlah:</b> ${qty} pcs\n<code>──────────────────────────</code>\n`;

        const addButtons = [];
        if (cartFull) {
            addMsg += `\n⚠️ <b>NOTIFIKASI:</b>\n`;
            addMsg += `Keranjang sudah mencapai batas maksimal (2 produk / 2 toko berbeda). Tombol tambah produk dinonaktifkan.\n\n`;
            addMsg += `<i>Untuk ganti produk, hapus salah satu item dulu:</i>`;
            const delRow = cartNow.map((c, i) => ({ text: `❌ Hapus Produk ${i + 1}`, callback_data: `fo_cart_del_${i}` }));
            addButtons.push(delRow);
            addButtons.push([{ text: "🛒 Lihat Isi Keranjang", callback_data: "fo_view_cart" }]);
            addButtons.push([{ text: "➡️ Lanjut ke Checkout", callback_data: "fo_cart_checkout" }]);
        } else {
            addMsg += `<i>Silakan pilih aksi selanjutnya:</i>`;
            addButtons.push([{ text: "➕ Tambah Produk Lain", callback_data: "fo_add_more" }]);
            addButtons.push([{ text: "🛒 Lihat Isi Keranjang", callback_data: "fo_view_cart" }]);
            addButtons.push([{ text: "➡️ Lanjut ke Checkout", callback_data: "fo_cart_checkout" }]);
        }
        await safeSendMessage(chatId, addMsg, { reply_markup: { inline_keyboard: addButtons } });
        us.step = 'FO_WAIT_CART_ACTION';
        return;
    }

    if (state && state.step === "WAIT_BUYER_NOTE") {
        const note = text.trim();
        userState[userId].buyerNote = (note === '-') ? '' : note.substring(0, 200);
        userState[userId].step = "WAIT_VOUCHER_SELECT";
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await bot.deleteMessage(chatId, userState[userId].note_prompt_id).catch(() => {});
        return bot.emit("callback_query", { id: `synthetic_${Date.now()}`, from: msg.from, message: { chat: { id: chatId }, message_id: userState[userId].co_message_id }, data: "voucher_select" });
    }
    if (state && state.step === "WAIT_FO_BUYER_NOTE") {
        const note = text.trim();
        userState[userId].foBuyerNote = (note === '-') ? '' : note.substring(0, 200);
        userState[userId].step = "FO_VOUCHER_PAGE";
        await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
        await bot.deleteMessage(chatId, userState[userId].fo_note_prompt_id).catch(() => {});
        const vMsgId = userState[userId].fo_voucher_msg_id;
        if (vMsgId) return await foShowVoucherPage(chatId, vMsgId, userId);
        return;
    }
    if (state && state.step === "WAIT_QUANTITY_MANUAL_INPUT") {
        const rawQty = text.trim();
        const qty = parseInt(rawQty);

        if (isNaN(qty) || qty < 1 || qty > 100) {
            return await safeSendMessage(chatId, "📌 <b>Input Salah:</b> Masukkan angka antara 1 - 100.");
        }

        userState[userId].final_quantity = qty;
        userState[userId].step = "WAIT_PAYMENT_SELECT";
        userState[userId].voucherSel = { platform: null, shop: null, fsv: null };
        userState[userId].payment = DEFAULT_PAYMENT;
        userState[userId].co_message_id = userState[userId].original_menu_id;

        return bot.emit("callback_query", { id: `synthetic_${Date.now()}`, from: msg.from, message: { chat: { id: chatId }, message_id: userState[userId].original_menu_id }, data: "pick_payment_menu" });
    }
    if (state && state.step === "WAIT_PRODUCT_LINK_REPLY") {

        const isCorrectReply = msg.reply_to_message && msg.reply_to_message.message_id === state.target_message_id;
        if (!isCorrectReply) return;

        const curCart = state.cart || [];
        const curShops = new Set(curCart.map(c => c.shopid)).size;
        if (curCart.length >= 2 || curShops >= 2) {
            return await safeSendMessage(chatId, "⚠️ <b>Keranjang Penuh!</b>\nMaksimal 2 produk / 2 toko berbeda. Hapus salah satu item dulu di menu keranjang sebelum menambah produk baru.");
        }

        if (!text.includes("shopee.co.id") && !text.includes("shp.ee") && !text.includes("shopee.id") && !text.includes("s.shopee.co.id")) {
            return await safeSendMessage(chatId, "📌 <b>Tautan Tidak Dikenali:</b> Silakan reply pesan instruksi di atas menggunakan tautan produk resmi Shopee.");
        }

        const loadingMsg = await safeSendMessage(chatId, "🔓 <b>Sedang membongkar enkripsi & melacak model ID produk...</b>");

        try {
            let targetUrl = text.trim();
            if (text.includes("shp.ee") || text.includes("s.shopee.co.id")) {
                targetUrl = await resolveShopeeShortlink(text);
            }

            let shopid, itemid;

            const regexOpa = /\/opaanlp\/(\d+)\/(\d+)/i;
            const regexProductGroup = /product\/(\d+)\/(\d+)/i;
            const regexDotGroup = /i\.(\d+)\.(\d+)/i;
            const regexQueryGroup = /itemid=(\d+)&shopid=(\d+)/i;
            const regexQueryAltGroup = /shopid=(\d+)&itemid=(\d+)/i;

            if (regexOpa.test(targetUrl)) {
                const match = targetUrl.match(regexOpa);
                shopid = match[1]; itemid = match[2];
            } else if (regexProductGroup.test(targetUrl)) {
                const match = targetUrl.match(regexProductGroup);
                shopid = match[1]; itemid = match[2];
            } else if (regexDotGroup.test(targetUrl)) {
                const match = targetUrl.match(regexDotGroup);
                shopid = match[1]; itemid = match[2];
            } else if (regexQueryGroup.test(targetUrl)) {
                const match = targetUrl.match(regexQueryGroup);
                itemid = match[1]; shopid = match[2];
            } else if (regexQueryAltGroup.test(targetUrl)) {
                const match = targetUrl.match(regexQueryAltGroup);
                shopid = match[1]; itemid = match[2];
            }

            if (!shopid || !itemid) {
                const genericMatch = targetUrl.match(/[\/\.](\d{6,12})[\/\.](\d{9,13})/);
                if (genericMatch) {
                    shopid = genericMatch[1];
                    itemid = genericMatch[2];
                }
            }

            if (!shopid || !itemid) throw new Error("Gagal mengekstrak komponen ID Produk Shopee.");

            const { data: activeAccount } = await supabase.from('shopee_accounts').select('*').eq('id', state.account_database_id).maybeSingle();
            if (!activeAccount) throw new Error("Sesi akun Shopee terikat terputus dari database.");
            if (activeAccount.cookie) activeAccount.cookie = decryptCookie(activeAccount.cookie);

            const lockedIdentity = activeAccount.device_identity || generateDynamicDevice();
            const targetUA = lockedIdentity.ua;

            let productResult;

            if (targetUrl.includes("opaanlp")) {
                let extractedUtm = "an_11325770730";
                try {
                    const urlObj = new URL(targetUrl);
                    const params = new URLSearchParams(urlObj.search);
                    if (params.has("utm_source")) extractedUtm = params.get("utm_source");
                } catch (e) {}

                productResult = await fetchShopeeLandingItemInfo(targetUrl, shopid, itemid, extractedUtm, activeAccount.cookie, targetUA, lockedIdentity);

                if (productResult.success && productResult.modelid === 0) {
                    logger.engine("FALLBACK", "ModelID 0 terdeteksi, tarik variasi via HTML...", "WARN");
                    let panelRes = await fetchProductFromHTML(shopid, itemid, activeAccount.cookie, lockedIdentity);
                    if (!panelRes.success) panelRes = await fetchShopeePdpGet(shopid, itemid, activeAccount.cookie, lockedIdentity);
                    if (!panelRes.success) panelRes = await fetchShopeeCartPanel(shopid, itemid, activeAccount.cookie, lockedIdentity);
                    if (panelRes.success) {
                        const item = panelRes.itemData;
                        productResult.models = item.models || [];
                        productResult.stock = item.stock || 99;
                    }
                }
            } else {
                let panelRes = await fetchProductFromHTML(shopid, itemid, activeAccount.cookie, lockedIdentity);
                if (!panelRes.success) {
                    logger.engine("FALLBACK", "HTML extractor gagal, mencoba PDP Get...", "WARN");
                    panelRes = await fetchShopeePdpGet(shopid, itemid, activeAccount.cookie, lockedIdentity);
                }
                if (!panelRes.success) {
                    logger.engine("FALLBACK", "PDP Get gagal, mencoba Cart Panel...", "WARN");
                    panelRes = await fetchShopeeCartPanel(shopid, itemid, activeAccount.cookie, lockedIdentity);
                }
                if (!panelRes.success) throw new Error(panelRes.msg);

                const item = panelRes.itemData;
                productResult = {
                    success: true,
                    shopid: parseInt(shopid),
                    itemid: parseInt(itemid),
                    modelid: 0,
                    productName: item.name || "Produk Shopee",
                    shopName: "Shopee Store",
                    stock: item.stock || 99,
                    models: item.models || []
                };
            }

            if (!productResult.success) throw new Error(productResult.msg);

            const prevCart = (userState[userId] && userState[userId].cart) ? userState[userId].cart : [];
            const prevAccId = (userState[userId] && userState[userId].account_database_id) || state.account_database_id;
            userState[userId] = {
                shopid: productResult.shopid,
                itemid: productResult.itemid,
                modelid: productResult.modelid,
                productName: productResult.productName || "Produk Shopee",
                shopName: productResult.shopName || "Shopee Store",
                models: productResult.models || [],
                variationName: '',
                cookie: activeAccount.cookie,
                identity: lockedIdentity,
                cart: prevCart,
                account_database_id: prevAccId
            };

            if (targetUrl.includes("opaanlp") && productResult.modelid !== 0) {
                userState[userId].step = "WAIT_QUANTITY_INPUT";

                let qtyMsg = `🔐 <b>MASUKKAN JUMLAH BARANG (AFFILIATE BYPASS)</b>\n`;
                qtyMsg += `<code>--------------------------</code>\n`;
                qtyMsg += `👤 <b>Akun Sesi :</b> <code>${activeAccount.account_name}</code>\n`;
                qtyMsg += `🏪 <b>Toko      :</b> <code>${productResult.shopName}</code>\n`;
                qtyMsg += `🛍️ <b>Produk    :</b> <code>${productResult.productName.substring(0, 40)}...</code>\n`;
                qtyMsg += `🆔 <b>Model ID  :</b> <code>${productResult.modelid}</code>\n`;
                qtyMsg += `<code>--------------------------</code>\n\n`;
                qtyMsg += `📌 <i>Sesi diskon affiliate terkunci aman. Silakan pilih kuantitas untuk Auto CO:</i>`;

                const buttons = [
                    [
                        { text: "1 Pcs", callback_data: "set_qty_1" },
                        { text: "2 Pcs", callback_data: "set_qty_2" },
                        { text: "3 Pcs", callback_data: "set_qty_3" }
                    ],
                    [{ text: "🔢 Input Manual Jumlah Lain", callback_data: "set_qty_manual" }],
                    [{ text: "❌ Batalkan Sesi", callback_data: "back_home" }]
                ];

                return await bot.editMessageText(qtyMsg, {
                    chat_id: chatId,
                    message_id: loadingMsg.message_id,
                    parse_mode: "HTML",
                    reply_markup: { inline_keyboard: buttons }
                });
            }

            if (productResult.models && productResult.models.length > 0) {
                const readyModels = productResult.models.filter(m => m.stock > 0 && m.is_selectable === true);

                if (readyModels.length > 0) {
                    userState[userId].step = "WAIT_VARIATION_CHOICE";

                    let variationMsg = `🛍️ <b>PILIH VARIASI PRODUK</b>\n`;
                    variationMsg += `<code>--------------------------</code>\n`;
                    variationMsg += `🆔 <b>Shop ID :</b> <code>${shopid}</code>\n`;
                    variationMsg += `🆔 <b>Item ID :</b> <code>${itemid}</code>\n`;
                    variationMsg += `<code>--------------------------</code>\n`;
                    variationMsg += `📌 <i>Produk memiliki variasi. Silakan tentukan model yang ingin di-checkout:</i>`;

                    const buttons = readyModels.map(m => [{
                        text: `📦 ${m.name} (Stok: ${m.stock})`,
                        callback_data: `pick_model_${m.model_id}`
                    }]);
                    buttons.push([{ text: "❌ Batalkan Sesi", callback_data: "back_home" }]);

                    return await bot.editMessageText(variationMsg, {
                        chat_id: chatId,
                        message_id: loadingMsg.message_id,
                        parse_mode: "HTML",
                        reply_markup: { inline_keyboard: buttons }
                    });
                }
            }

            userState[userId].modelid = 0;
            userState[userId].step = "WAIT_QUANTITY_INPUT";

            let qtyMsg = `🔐 <b>MASUKKAN JUMLAH BARANG</b>\n`;
            qtyMsg += `<code>--------------------------</code>\n`;
            qtyMsg += `👤 <b>Akun Sesi :</b> <code>${activeAccount.account_name}</code>\n`;
            qtyMsg += `🆔 <b>Shop ID   :</b> <code>${shopid}</code>\n`;
            qtyMsg += `🆔 <b>Item ID   :</b> <code>${itemid}</code>\n`;
            qtyMsg += `📦 <b>Stok Ril  :</b> <b>${productResult.stock} Pcs</b>\n`;
            qtyMsg += `<code>--------------------------</code>\n\n`;
            qtyMsg += `📌 <i>Produk tunggal terdeteksi (Tanpa Variasi). Silakan pilih total barang yang mau di CO:</i>`;

            const buttons = [
                [
                    { text: "1 Pcs", callback_data: "set_qty_1" },
                    { text: "2 Pcs", callback_data: "set_qty_2" },
                    { text: "3 Pcs", callback_data: "set_qty_3" }
                ],
                [{ text: "🔢 Input Manual Jumlah Lain", callback_data: "set_qty_manual" }],
                [{ text: "❌ Batalkan Sesi", callback_data: "back_home" }]
            ];

            return await bot.editMessageText(qtyMsg, {
                chat_id: chatId,
                message_id: loadingMsg.message_id,
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: buttons }
            });

        } catch (err) {
            logger.engine("PRODUCT_LINK_FAIL", `Detail Error Asli:\n${err.stack || err.message}`, "ERR");

            let failMsg = `❌ <b>Gagal Memproses Tautan!</b>\n`;
            failMsg += `<code>--------------------------</code>\n`;
            failMsg += `<b>Respons System :</b> <code>${err.message}</code>\n`;
            failMsg += `<code>--------------------------</code>\n`;
            failMsg += `<i>Silakan periksa kembali tautan Anda atau ulangi proses pemilihan akun.</i>`;

            return await bot.editMessageText(failMsg, {
                chat_id: chatId,
                message_id: loadingMsg.message_id,
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: [[{ text: "🔄 Ulangi Proses", callback_data: "memru_order_start" }]] }
            });
        }
    }

});

bot.on("callback_query", async (q) => {
    const chatId = q.message.chat.id;
    const userId = q.from.id;
    const messageId = q.message.message_id;
    const data = q.data;

    logger.info(userId, "CALLBACK_BTN", data);
    touchUserState(userId);

    const HEAVY_PREFIXES = ["voucher_preview", "voucher_autocheck", "voucher_select", "execute_sniper_now", "pick_courier_menu", "set_courier_", "vsel_", "run_mission_", "run_check_", "det_", "vdet_", "vlog_", "spay_acc_", "voucher_view_", "cart_checkout", "pick_payment_menu", "set_payment_idx_", "toggle_coins", "fo_goto_voucher", "fo_preview_price", "fo_cart_checkout", "fo_order_yes", "fo_gen_fp"];
    if (HEAVY_PREFIXES.some(p => data === p || data.startsWith(p))) {
        if (!checkRateLimit(userId)) {
            return await safeAnswerCallback(q.id, { text: "⏳ Terlalu cepat! Tunggu sebentar biar akun aman dari anti-bot Shopee.", show_alert: true });
        }
    }

    const PUBLIC_CALLBACKS = new Set([
        "back_home", "claim_menu", "buy_premium_menu"
    ]);
    const PUBLIC_PREFIXES = ["order_pakasir_", "cancel_invoice_"];
    const isPublic = PUBLIC_CALLBACKS.has(data) || PUBLIC_PREFIXES.some(p => data.startsWith(p));

    if (!isPublic) {
        const accessGate = await getAccessLicense(userId);
        if (!accessGate.active) {
            delete userState[userId];
            await safeAnswerCallback(q.id, { text: "⛔ Akses premium kamu sudah habis. Silakan perpanjang dulu.", show_alert: true });
            return sendMainMenu(chatId, userId, messageId, q.from);
        }
    }

    if (data === "back_home") {
        delete userState[userId];
        return sendMainMenu(chatId, userId, messageId, q.from);
    }
    if (data === "claim_menu" || data === "buy_premium_menu") {
        await safeAnswerCallback(q.id);

        let snkText = `📜 <b>SYARAT & KETENTUAN LAYANAN</b>\n`;
        snkText += `<code>--------------------------</code>\n`;
        snkText += `Sebelum melakukan aktivasi premium SHOPEE TOOLS, harap baca dan pahami S&K di bawah ini secara mutlak:\n\n`;
        snkText += `📌 <b>Ketentuan Penggunaan :</b>\n`;
        snkText += ` + 1. Penggunaan bot sepenuhnya menjadi tanggung jawab user.\n`;
        snkText += ` + 2. <b>TIDAK ADA REFUND / PENGEMBALIAN DANA</b> setelah pembayaran diproses oleh sistem dengan alasan apa pun.\n`;
        snkText += ` + 3. Sistem keamanan bot dijamin steril demi menjaga keuntungan dan kenyamanan bersama di kedua belah pihak.\n`;
        snkText += ` + 4. Akses lisensi akan terhitung otomatis sejak transaksi Anda dinyatakan sukses oleh radar QRIS.\n`;
        snkText += `<code>--------------------------</code>\n`;
        snkText += `👇 <i>Silakan tentukan paket durasi waktu akses premium yang Anda inginkan, Bang:</i>`;

        const buttons = [
            [
                { text: "🎟️ SEWA 1 HARI", callback_data: "order_pakasir_1day" },
                { text: "🎟️ SEWA 3 HARI", callback_data: "order_pakasir_3day" }
            ],
            [{ text: "🔙 Kembali ke Dashboard", callback_data: "back_home" }]
        ];

        return await safeEditMessage(chatId, messageId, snkText, { reply_markup: { inline_keyboard: buttons } });
    }
    if (data === "main_menu_address_select") {
        await safeAnswerCallback(q.id, { text: "Memuat daftar slot akun..." });

        try {
            const { data: accounts, error } = await supabase
                .from('shopee_accounts')
                .select('*')
                .eq('user_id', String(userId));

            if (error || !accounts || accounts.length === 0) {
                return await safeEditMessage(chatId, messageId, "🚫 <b>Akses Ditolak:</b> Anda belum menghubungkan akun Shopee Anda.\n\nSilakan masuk ke menu <b>👤 KELOLA AKUN</b> untuk menambahkan sesi terlebih dahulu.", {
                    reply_markup: { inline_keyboard: [[{ text: "👤 KELOLA AKUN", callback_data: "manage_acc" }]] }
                });
            }

            let text = `📍 <b>ATUR ALAMAT MALL (KONFIGURASI PENGIRIMAN)</b>\n`;
            text += `<code>--------------------------</code>\n`;
            text += `Sistem mendeteksi Anda memiliki <b>${accounts.length} akun</b> terikat.\n`;
            text += `Silakan pilih akun Shopee di bawah ini untuk melihat atau menambahkan daftar alamat baru Anda:\n`;
            text += `<code>--------------------------</code>`;

            const buttons = accounts.map(acc => [{
                text: `👤 Akun: ${acc.account_name}`,
                callback_data: `addr_manage_${acc.id}`
            }]);

            buttons.push([{ text: "🏠 Kembali ke Menu Utama", callback_data: "back_home" }]);

            return await safeEditMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: buttons } });

        } catch (e) {
            logger.engine("ADDRESS_START_CRITICAL", e.message, "ERR");
            return await safeEditMessage(chatId, messageId, `❌ <b>Sistem Error:</b> <code>${e.message}</code>`, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] }
            });
        }
    }
    if (data.startsWith("addr_del_")) {
        const parts = data.replace("addr_del_", "").split("_");
        const addressId = parts[0];
        const accId = parts[1];

        if (!/^\d+$/.test(String(addressId)) || !/^\d+$/.test(String(accId))) {
            return await safeAnswerCallback(q.id, { text: "Data tidak valid.", show_alert: true });
        }

        await safeAnswerCallback(q.id, { text: `Mengeksekusi penghapusan alamat...` });
        await safeEditMessage(chatId, messageId, "📡 <b>Menghubungkan ke radar Shopee... Mengeksekusi penghapusan alamat pilihan Anda...</b>", { reply_markup: { inline_keyboard: [] } });

        try {
            const acc = await getOwnedAccount(accId, userId);
            if (!acc) throw new Error("Sesi database akun terputus.");

            const lockedIdentity = acc.device_identity || generateDynamicDevice();

            const delRes = await injectDeleteAddress(addressId, acc.cookie, lockedIdentity);
            if (!delRes.success) throw new Error(delRes.msg);

            logger.engine("ADDR_WIPE", `Sukses menghapus Address ID: ${addressId} pada akun ${acc.account_name}`, "SUCCESS");

            return bot.emit("callback_query", {
                ...q,
                data: `addr_manage_${accId}`
            });

        } catch (e) {
            logger.engine("ADDR_DEL_FAIL", e.message, "ERR");
            return await safeEditMessage(chatId, messageId, `❌ <b>Gagal Hapus Alamat:</b> <code>${e.message}</code>`, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: `addr_manage_${accId}` }]] }
            });
        }
    }
   if (data.startsWith("order_pakasir_")) {
        const durationType = data.replace("order_pakasir_", "");

        logger.info(userId, "CALLBACK_BTN", `order_pakasir_${durationType}`);
        await safeAnswerCallback(q.id, { text: "Membuka nota pembayaran QRIS..." });

        const amount = durationType === "1day" ? 21500 : 59000;
        const days = durationType === "1day" ? 1 : 3;
        const orderId = `PZ-${Date.now()}`;

        await safeEditMessage(chatId, messageId, "💳 <b>Radar Pakasir Active! Sedang merajut sasis QRIS dinamis Anda...</b>", { reply_markup: { inline_keyboard: [] } });

        try {
            const response = await axios.post("https://app.pakasir.com/api/transactioncreate/qris", {
                project: PAKASIR_SLUG,
                order_id: orderId,
                amount: amount,
                api_key: PAKASIR_API_KEY,
                expiry: 3600,
                external_id: String(userId)
            }, { timeout: 10000 });

            const paymentData = response.data?.payment || response.data?.data;

            if (!paymentData || (!paymentData.payment_number && !paymentData.qris_string)) {
                throw new Error(response.data?.message || "Server Pakasir menolak alokasi data string QRIS.");
            }

            const qrisRaw = paymentData.payment_number || paymentData.qris_string;
            const totalBayar = paymentData.total_payment || amount;
            const expiredAt = paymentData.expired_at
                ? new Date(paymentData.expired_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: '2-digit', minute: '2-digit' })
                : "1 Jam";

            const finalBuffer = await QRCode.toBuffer(qrisRaw, { width: 600, margin: 2 });

            const { error: profileCheckErr } = await supabase
                .from('profiles')
                .upsert({ id: Number(userId) }, { onConflict: 'id' });

            if (profileCheckErr) logger.db("UPSERT", "profiles", `FAIL: ${profileCheckErr.message}`);

            await bot.deleteMessage(chatId, messageId).catch(() => {});

            let payCaption = `💳 <b>PEMBAYARAN LISENSI PREMIUM</b>\n`;
            payCaption += `<code>--------------------------</code>\n`;
            payCaption += `🆔 <b>Order ID   :</b> <code>${orderId}</code>\n`;
            payCaption += `💳 <b>Total Bayar:</b> <code>Rp ${totalBayar.toLocaleString('id-ID')}</code>\n`;
            payCaption += `📅 <b>Durasi     :</b> <b>${days} Hari Premium Access</b>\n`;
            payCaption += `💳 <b>Batas Bayar:</b> Jam <b>${expiredAt} WIB</b>\n`;
            payCaption += `<code>--------------------------</code>\n\n`;
            payCaption += `💳 <b>INSTRUKSI PEMBAYARAN :</b>\n`;
            payCaption += `1. Silakan screenshot atau simpan foto QRIS di bawah ini.\n`;
            payCaption += `2. Buka aplikasi e-Wallet pilihan Anda (Dana, OVO, GOPAY, ShopeePay).\n`;
            payCaption += `3. Scan gambar QRIS dan selesaikan transaksi senilai Rp ${totalBayar.toLocaleString('id-ID')}.\n`;
            payCaption += `<code>--------------------------</code>\n`;
            payCaption += `⚡ <i>Begitu dana sukses ditransfer, sistem otomatis menginjeksi lisensi premium ke ID Anda dalam 1 detik!</i>`;

            const sentPhoto = await bot.sendPhoto(chatId, finalBuffer, {
                caption: payCaption,
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [[{ text: "❌ Batalkan Transaksi / Sesi", callback_data: `cancel_invoice_${orderId}` }]]
                }
            }, { filename: 'qris_invoice.png', contentType: 'image/png' });

            const { error: dbPendingErr } = await supabase
                .from('transactions')
                .upsert({
                    order_id: orderId,
                    user_id: Number(userId),
                    amount: totalBayar,
                    duration_days: days,
                    status: 'PENDING',
                    message_id: sentPhoto.message_id,
                    chat_id: chatId
                }, { onConflict: 'order_id' });

            if (dbPendingErr) {
                logger.db("UPSERT", "transactions", `FAIL_PENDING: ${dbPendingErr.message}`);
            } else {
                logger.db("UPSERT", "transactions", `SUCCESS: Target Msg ${sentPhoto.message_id} Saved`);
            }

        } catch (err) {
            logger.engine(userId, `Pakasir API Reject: ${err.message}`, "ERR");
            return await safeEditMessage(chatId, messageId, `❌ <b>Gateway Error:</b> <code>${err.message}</code>\nSilakan coba panggil menu pembelian ulang beberapa saat lagi.`, {
                reply_markup: { inline_keyboard: [[{ text: "🔄 Ulangi", callback_data: "claim_menu" }]] }
            });
        }
    }

    if (data.startsWith("cancel_invoice_")) {
        const targetOrderId = data.replace("cancel_invoice_", "");
        await safeAnswerCallback(q.id, { text: "Transaksi berhasil dibatalkan." });

        await bot.deleteMessage(chatId, messageId).catch(() => {});

        return sendMainMenu(chatId, userId, null, q.from);
    }
    if (data === "manage_acc") {
        await safeAnswerCallback(q.id, { text: "Memuat slot akun Anda..." });

        await bot.deleteMessage(chatId, messageId).catch(() => {});

        try {
            const { data: accounts, error } = await supabase
                .from('shopee_accounts')
                .select('id, account_name, created_at, device_identity')
                .eq('user_id', String(userId));

            if (error) throw error;

            let text = `👤 <b>ACCOUNT MANAGEMENT SYSTEM</b>\n`;
            text += `<code>--------------------------</code>\n`;
            text += `Berikut adalah daftar slot akun Shopee Anda yang aktif terikat di dalam sistem database.\n\n`;

            const buttons = [];

            if (!accounts || accounts.length === 0) {
                text += `📊 <b>Status: Belum ada akun yang terhubung.</b>\n`;
                text += `<i>Silakan hubungkan akun Shopee Anda terlebih dahulu untuk dapat memulai proses Auto Checkout.</i>\n`;
            } else {
                text += `👤 <b>Daftar Akun Terkunci:</b>\n`;
                text += `<i>🔑 = sz-token siap | ⚠️ = belum ada token</i>\n\n`;
                let no = 1;
                for (const acc of accounts) {
                    const createdDate = new Date(acc.created_at);
                    const currentDate = new Date();
                    const daysDiff = (currentDate.getTime() - createdDate.getTime()) / (1000 * 3600 * 24);

                    const szTok = acc.device_identity?.sz_token;
                    const hasTok = szTok && szTok.length > 20 && !szTok.startsWith(FALLBACK_SZ_PREFIX);
                    const tokIcon = hasTok ? '🔑' : '⚠️';

                    if (daysDiff > 3) {
                        text += ` + ${no++}. 📱 <code>${acc.account_name}</code> ${tokIcon} (⚠️ <b>Sesi Expired / Keluar</b>)\n`;
                    } else {
                        text += ` + ${no++}. 👤 <code>${acc.account_name}</code> ${tokIcon} (✅ <b>Sesi Ready</b>)\n`;
                    }

                    buttons.push([{ text: `🗑️ Hapus: ${acc.account_name}`, callback_data: `del_acc_${acc.id}` }]);
                }
            }

            text += `<code>--------------------------</code>\n`;
            text += `📌 <b>Masa Aktif Sesi:</b> Maksimal 3 Hari (Auto-Wipe oleh Sistem)\n`;
            text += `<code>--------------------------</code>`;

            if (accounts && accounts.length > 0) {
                buttons.push([{ text: "🔑 Set / Update Token", callback_data: "set_sz_menu" }]);
            }
            buttons.push([
                { text: "🍪 Login via Cookie", callback_data: "method_cookie" }
            ]);
            buttons.push([{ text: "🏠 Kembali ke Menu Utama", callback_data: "back_home" }]);

            return await safeSendMessage(chatId, text, {
                reply_markup: { inline_keyboard: buttons }
            });

        } catch (e) {
            logger.engine(userId, `Gagal memuat menu kelola akun: ${e.message}`, "ERR");

            return await safeSendMessage(chatId, `❌ <b>Sistem Error:</b> <code>${e.message}</code>`, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] }
            });
        }
    }
    if (data.startsWith("addr_manage_")) {
        const accId = data.replace("addr_manage_", "");
        await safeAnswerCallback(q.id, { text: "Menarik daftar alamat..." });

        try {
            const acc = await getOwnedAccount(accId, userId);
            if (!acc) throw new Error("Sesi database akun terputus.");

            const lockedIdentity = acc.device_identity || generateDynamicDevice();

            const addrRes = await fetchShopeeAddressList(acc.cookie, lockedIdentity);
            if (!addrRes.success) throw new Error(addrRes.msg);

            let text = `📍 <b>ADDRESS MANAGEMENT SYSTEM</b>\n`;
            text += `<code>--------------------------</code>\n`;
            text += `👤 <b>Akun Sesi :</b> <code>${acc.account_name}</code>\n`;
            text += `<code>--------------------------</code>\n\n`;

            const listAddr = addrRes.addresses || [];

            const buttons = [];

            if (listAddr.length === 0) {
                text += `📊 <b>Status: Belum ada alamat terdaftar pada akun ini!</b>\n`;
                text += `<i>Silakan tambahkan alamat baru untuk menghindari kegagalan kalkulasi ongkir saat proses Auto CO berjalan.</i>\n`;
            } else {
                text += `📍 <b>Daftar Alamat Aktif Terdeteksi:</b>\n\n`;
                listAddr.forEach((addr, i) => {
                    const isDefault = addr.is_delivery_address ? " [⭐ DEFAULT]" : "";
                    text += `${i + 1}. 📍 <b>${addr.name}</b> (${addr.phone})\n`;
                    text += `   🏠 <i>${addr.address}, ${addr.district}, ${addr.city}, ${addr.state} (${addr.zipcode})</i><b>${isDefault}</b>\n\n`;

                    buttons.push([{
                        text: `📍 Hapus Alamat ${i + 1}: ${addr.name}`,
                        callback_data: `addr_del_${addr.id}_${accId}`
                    }]);
                });
            }

            text += `<code>--------------------------</code>`;

            buttons.push([{ text: "📍 Tambah Alamat Baru", callback_data: `addr_add_flow_${accId}` }]);
            buttons.push([{ text: "🔙 Kembali ke Kelola Akun", callback_data: "manage_acc" }]);

            return await safeEditMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: buttons } });

        } catch (e) {
            logger.engine(userId, `Gagal memuat manajemen alamat: ${e.message}`, "ERR");
            return await safeEditMessage(chatId, messageId, `❌ <b>Alamat Error:</b> <code>${e.message}</code>`, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "manage_acc" }]] }
            });
        }
    }
    if (data.startsWith("addr_add_flow_")) {
        const accId = data.replace("addr_add_flow_", "");
        await safeAnswerCallback(q.id);

        const acc = await getOwnedAccount(accId, userId, 'account_name');
        if (!acc) {
            return await safeEditMessage(chatId, messageId, "🚫 <b>Akun tidak ditemukan / bukan milik Anda.</b>", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "manage_acc" }]] } });
        }
        await bot.deleteMessage(chatId, messageId).catch(() => {});

        let prompt = `📍 <b>PROSES ALAMAT BARU [STEP 1]</b>\n`;
        prompt += `<code>--------------------------</code>\n`;
        prompt += `Silakan reply/ketikkan <b>NAMA PENERIMA</b> dan <b>NO HP AKTIF AKUN</b> Wajib menggunakan pembatas tanda pipa ( <b>|</b> ) antara Nama dan No HP!.\n\n`;
        prompt += `📌 <i>Contoh penulisan: Aji|6285126903165</i>\n`;
        prompt += `<code>--------------------------</code>`;

        const sentMsg = await bot.sendMessage(chatId, prompt, {
            parse_mode: "HTML",
            reply_markup: { force_reply: true, selective: true }
        });

        userState[userId] = {
            step: "WAIT_ADDR_NAME_PHONE",
            target_message_id: sentMsg.message_id,
            account_database_id: accId
        };
    }
    if (data.startsWith("del_acc_")) {
        const accId = data.replace("del_acc_", "");
        await safeAnswerCallback(q.id, { text: "Menghapus sesi akun Anda..." });

        await supabase.from('shopee_accounts').delete().eq('id', accId).eq('user_id', String(userId));

        return bot.emit("callback_query", {
            ...q,
            data: "manage_acc"
        });
    }
    if (data === "set_sz_menu") {
        await safeAnswerCallback(q.id, { text: "Pilih akun..." });
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        const { data: accounts } = await supabase.from('shopee_accounts').select('id, account_name, device_identity').eq('user_id', String(userId));
        if (!accounts || !accounts.length) {
            return await safeSendMessage(chatId, "⚠️ Belum ada akun.", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "manage_acc" }]] } });
        }
        let text = `🔑 <b>SET / UPDATE sz-token</b>\n`;
        text += `<code>--------------------------</code>\n`;
        text += `Pilih akun untuk set/update token:\n`;
        text += `<i>🔑 = token siap | ⚠️ = belum ada</i>\n`;
        text += `<code>--------------------------</code>`;
        const buttons = accounts.map(acc => {
            const szTok = acc.device_identity?.sz_token;
            const hasTok = szTok && szTok.length > 20 && !szTok.startsWith(FALLBACK_SZ_PREFIX);
            return [{ text: `${hasTok ? '🔑' : '⚠️'} ${acc.account_name}`, callback_data: `set_sz_${acc.id}` }];
        });
        buttons.push([{ text: "🔙 Kembali", callback_data: "manage_acc" }]);
        return await safeSendMessage(chatId, text, { reply_markup: { inline_keyboard: buttons } });
    }
    if (data.startsWith("set_sz_")) {
        const accId = data.replace("set_sz_", "");
        await safeAnswerCallback(q.id, { text: "Set sz-token..." });
        const { data: acc } = await supabase.from('shopee_accounts').select('id, account_name, device_identity').eq('id', accId).eq('user_id', String(userId)).maybeSingle();
        if (!acc) {
            return await safeEditMessage(chatId, messageId, "🚫 <b>Akun tidak ditemukan.</b>", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "manage_acc" }]] } });
        }
        userState[userId] = { step: "WAIT_SET_SZ", target_message_id: messageId, setSzAccId: accId, setSzAccName: acc.account_name, setSzDeviceIdentity: acc.device_identity || {} };
        const cur = acc.device_identity?.sz_token;
        let m = `🔑 <b>SET / UPDATE Fingerprint</b>\n`;
        m += `<code>--------------------------</code>\n`;
        m += `👤 Akun: <b>${acc.account_name}</b>\n`;
        m += `🔑 Fingerprint sekarang: <b>${cur && cur.length > 20 ? 'Ada (' + cur.slice(0, 12) + '...)' : 'KOSONG'}</b>\n`;
        m += `<code>--------------------------</code>\n`;
        return await safeEditMessage(chatId, messageId, m, {
            reply_markup: { inline_keyboard: [[{ text: "🔙 Batal", callback_data: "manage_acc" }]] }
        });
    }

    if (data === "sz_auto_grab") {
        await safeAnswerCallback(q.id, { text: "Auto-grab sz-token..." });
        const st = userState[userId];
        if (!st || st.step !== "WAIT_SZ_TOKEN" || !st.pendingAccount) {
            return await safeEditMessage(chatId, messageId, "⏰ Sesi habis. Ulangi tambah akun.", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "manage_acc" }]] } });
        }
        const pa = st.pendingAccount;
        await safeEditMessage(chatId, messageId, "⚡ <b>Auto-grab sz-token via browser...</b>", { reply_markup: { inline_keyboard: [] } });
        let szToken = null, sapri = null;
        try {
            const g = await fetchWebFingerprint({ ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', cookie: pa.cleanCookie, returnFull: true });
            if (g && g.sz && g.sz.length > 40 && !g.sz.startsWith(FALLBACK_SZ_PREFIX)) { szToken = g.sz; sapri = g.sapri || null; }
        } catch (e) {}
        await finalizeAccountSave(chatId, userId, pa, szToken, sapri);
        return;
    }
    if (data === "method_cookie") {
        await safeAnswerCallback(q.id, { text: "Metode Raw Cookie Terpilih" });

        userState[userId] = {
            step: "LOGIN_FO_COOKIE",
            target_message_id: messageId
        };

        let msgCookie = `🍪 <b>INPUT RAW COOKIE SHOPEE</b>\n`;
        msgCookie += `<code>--------------------------</code>\n`;
        msgCookie += `Silakan kirimkan string <i>Raw Cookie</i> Shopee Anda ke ruang obrolan ini.\n\n`;
        msgCookie += `📌 <b>Proteksi Privasi:</b> Pesan yang Anda kirimkan akan langsung dihapus otomatis oleh sistem dalam hitungan milidetik setelah proses verifikasi selesai.\n`;
        msgCookie += `<code>--------------------------</code>`;

        return await safeEditMessage(chatId, messageId, msgCookie, {
            reply_markup: { inline_keyboard: [[{ text: "❌ Batalkan", callback_data: "manage_acc" }]] }
        });
    }
    if (data === "method_qr") {
        await safeAnswerCallback(q.id, { text: "Meminta Sesi QR Code..." });

        const webIdentity = getDeepIdentity();
        logger.engine("QR_INIT", `Inisialisasi QR via Platform: ${webIdentity.platform}`, "INFO");

        const qrRes = await genShopeeQRCode(webIdentity);
        if (!qrRes.success) {
            return await safeEditMessage(chatId, messageId, `❌ <b>Gagal Memuat Server QR:</b> <code>${qrRes.msg}</code>`, {
                reply_markup: { inline_keyboard: [[{ text: "🔄 Coba Lagi", callback_data: "manage_acc" }]] }
            });
        }

        const qrBuffer = Buffer.from(qrRes.qrcodeBase64.replace(/^data:image\/png;base64,/, ""), 'base64');

        await bot.deleteMessage(chatId, messageId).catch(() => {});

        let qrCaption = `📷 <b>SCAN QR CODE LOGIN SHOPEE</b>\n`;
        qrCaption += `<code>--------------------------</code>\n`;
        qrCaption += `1. Buka Aplikasi Shopee Anda di HP\n`;
        qrCaption += `2. Klik Tombol <b>Scan / Pemindai QR</b> di pojok kiri atas\n`;
        qrCaption += `3. Arahkan kamera HP Anda ke gambar QR ini\n`;
        qrCaption += `4. Klik <b>Setujui / Sahkan Login Web</b> di layar HP Anda\n`;
        qrCaption += `<code>--------------------------</code>\n`;
        qrCaption += `⏰ <i>Sesi otomatis kedaluwarsa dalam 3 menit.</i>`;

        const sentPhoto = await bot.sendPhoto(chatId, qrBuffer, {
            caption: qrCaption,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "❌ Batalkan Sesi", callback_data: "manage_acc" }]] }
        }, {
            filename: 'qrcode.png',
            contentType: 'image/png'
        });

        userState[userId] = {
            step: "WAIT_QR_SCAN",
            qrcode_id: qrRes.qrcodeId,
            web_identity: webIdentity
        };

        startQRStatusPolling(chatId, userId, qrRes.qrcodeId, webIdentity, sentPhoto.message_id);
    }
   if (data.startsWith("run_check_")) {
        const accId = data.replace("run_check_", "");
        await safeAnswerCallback(q.id, { text: "Menghubungkan akun Shopee..." });

        await safeEditMessage(chatId, messageId, "📦 <b>Sedang memproses penarikan riwayat pesanan...</b>", { reply_markup: { inline_keyboard: [] } });

        try {
            const activeAccount = await getOwnedAccount(accId, userId);

            if (!activeAccount) throw new Error("Sesi akun terputus.");

            const orderRes = await fetchShopeeOrderList(activeAccount.cookie, activeAccount.device_identity);
            if (!orderRes.success) throw new Error(orderRes.msg);

            const rawOrders = orderRes.orders || [];
            const s = { unpaid: [], packing: [], shipped: [], completed: [], cancelled: [] };

            rawOrders.forEach(item => {
                const status = item.order_list_detail?.status?.text?.text?.toLowerCase() || "";
                if (status.includes("unpaid") || status.includes("to_pay") || status === "") s.unpaid.push(item);
                else if (status.includes("to_ship") || status.includes("packing")) s.packing.push(item);
                else if (status.includes("shipping") || status.includes("to_receive")) s.shipped.push(item);
                else if (status.includes("completed")) s.completed.push(item);
                else if (status.includes("cancel") || status.includes("cancelled")) s.cancelled.push(item);
                else s.unpaid.push(item);
            });

            let dashboard = `👤 <b>AKUN: ${activeAccount.account_name}</b>\n`;
            dashboard += `📱 <b>No. HP:</b> <code>${activeAccount.device_identity?.phone || activeAccount.phone || 'N/A'}</code>\n`;
            dashboard += `<code>──────────────────────────</code>\n`;
            dashboard += `❌ Belum Bayar  : <b>${s.unpaid.length} Order</b>\n`;
            dashboard += `⏳ Dikemas      : <b>${s.packing.length} Order</b>\n`;
            dashboard += `🚚 Dikirim      : <b>${s.shipped.length} Order</b>\n`;
            dashboard += `✅ Selesai      : <b>${s.completed.length} Order</b>\n`;
            dashboard += `🚫 Dibatalkan   : <b>${s.cancelled.length} Order</b>\n`;
            dashboard += `<code>──────────────────────────</code>\n`;
            dashboard += `<i>Pilih detail di bawah untuk rincian:</i>`;

            const buttons = [
                [
                    { text: "❌ Detail Unpaid", callback_data: `det_unpaid_${accId}` },
                    { text: "⏳ Detail Packing", callback_data: `det_pack_${accId}` }
                ],
                [
                    { text: "🚚 Detail Shipped", callback_data: `det_ship_${accId}` },
                    { text: "✅ Detail Selesai", callback_data: `det_done_${accId}` }
                ],
                [
                    { text: "🚫 Detail Batal", callback_data: `det_cancel_${accId}` },
                    { text: "🔄 Refresh", callback_data: `run_check_${accId}` }
                ],
                [
                    { text: "🔙 Pilih Akun Lain", callback_data: "memru_check_start" }
                ]
            ];

            return await safeEditMessage(chatId, messageId, dashboard, { reply_markup: { inline_keyboard: buttons } });

        } catch (err) {
            logger.engine("ORDER_CHECK_FAIL", err.message, "ERR");

            let failCheckMsg = `❌ <b>Gagal Menarik Riwayat Pesanan!</b>\n`;
            failCheckMsg += `<code>--------------------------</code>\n`;
            failCheckMsg += `<b>Penyebab :</b> <code>${err.message}</code>\n`;
            failCheckMsg += `<code>--------------------------</code>`;

            return await safeEditMessage(chatId, messageId, failCheckMsg, {
                reply_markup: { inline_keyboard: [[{ text: "🔄 Coba Lagi", callback_data: "memru_check_start" }]] }
            });
        }
    }
    if (data === "memru_voucher_start") {
        await safeAnswerCallback(q.id, { text: "Memuat daftar akun..." });
        try {
            const { data: accounts, error } = await supabase.from('shopee_accounts').select('*').eq('user_id', String(userId));
            if (error || !accounts || accounts.length === 0) {
                return await safeEditMessage(chatId, messageId, "🚫 <b>Akses Ditolak:</b> Belum ada akun terhubung.", {
                    reply_markup: { inline_keyboard: [[{ text: "👤 KELOLA AKUN", callback_data: "manage_acc" }]] }
                });
            }
            let text = `🎟️ <b>CEK VOUCHER WALLET</b>\n`;
            text += `<code>--------------------------</code>\n`;
            text += `Pilih akun untuk melihat daftar voucher aktif di dompet Shopee:\n`;
            text += `<code>--------------------------</code>`;
            const buttons = accounts.map(acc => [{ text: `👤 Akun: ${acc.account_name}`, callback_data: `voucher_view_${acc.id}` }]);
            buttons.push([{ text: "🏠 Kembali ke Menu Utama", callback_data: "back_home" }]);
            return await safeEditMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: buttons } });
        } catch (e) {
            return await safeEditMessage(chatId, messageId, `❌ <b>Sistem Error:</b> <code>${e.message}</code>`, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] }
            });
        }
    }
    if (data.startsWith("voucher_view_")) {
        const accId = data.replace("voucher_view_", "");
        await safeAnswerCallback(q.id, { text: "Menarik voucher..." });
        await safeEditMessage(chatId, messageId, "⏳ <b>Memindai dompet voucher akun...</b>", { reply_markup: { inline_keyboard: [] } });
        try {
            const acc = await getOwnedAccount(accId, userId);
            if (!acc) throw new Error("Sesi akun terputus.");
            const vRes = await fetchUserVouchers(acc.cookie);
            if (!vRes.success) throw new Error(vRes.msg);

            let text = `🎟️ <b>VOUCHER WALLET — ${acc.account_name}</b>\n`;
            text += `<code>--------------------------</code>\n`;
            if (vRes.vouchers.length === 0) {
                text += `<i>Tidak ada voucher aktif di dompet akun ini.</i>\n`;
            } else {
                text += `Ditemukan <b>${vRes.vouchers.length} voucher</b> aktif:\n\n`;
                vRes.vouchers.slice(0, 20).forEach((v, i) => {
                    const icon = v.kind === 'FSV' ? '🚚' : (v.kind === 'PERCENT' ? '🏷️' : (v.kind === 'CASH' ? '💰' : '🎟️'));
                    const scope = v.isShop ? 'Toko' : 'Platform';
                    text += `${icon} <b>${v.discountText}</b> <i>(${scope})</i>\n`;
                    text += `   🔖 <code>${v.code}</code>\n`;
                    if (v.minSpend > 0) text += `   💰 Min belanja: Rp ${(v.minSpend / 100000).toLocaleString('id-ID')}\n`;
                    if (v.endTime > 0) text += `   📅 s/d ${new Date(v.endTime * 1000).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}\n`;
                    text += `\n`;
                });
            }
            text += `<code>--------------------------</code>`;
            return await safeEditMessage(chatId, messageId, text, {
                reply_markup: { inline_keyboard: [[{ text: "🔄 Refresh", callback_data: `voucher_view_${accId}` }], [{ text: "👤 Pilih Akun Lain", callback_data: "memru_voucher_start" }]] }
            });
        } catch (e) {
            logger.engine("VOUCHER_VIEW", e.message, "ERR");
            return await safeEditMessage(chatId, messageId, `❌ <b>Gagal Tarik Voucher:</b> <code>${e.message}</code>`, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_voucher_start" }]] }
            });
        }
    }
    if (data === "memru_mission_start") {
        await safeAnswerCallback(q.id, { text: "Memuat radar misi..." });
        try {
            const { data: accounts, error } = await supabase
                .from('shopee_accounts')
                .select('*')
                .eq('user_id', String(userId));

            if (error || !accounts || accounts.length === 0) {
                return await safeEditMessage(chatId, messageId, "🚫 <b>Akses Ditolak:</b> Anda belum menghubungkan akun Shopee.\n\nSilakan masuk ke menu <b>👤 KELOLA AKUN</b> untuk menambahkan sesi terlebih dahulu.", {
                    reply_markup: { inline_keyboard: [[{ text: "👤 KELOLA AKUN", callback_data: "manage_acc" }]] }
                });
            }

            let text = `🎯 <b>GAMES REFERRAL AUTO-MISSION V1</b>\n`;
            text += `<code>--------------------------</code>\n`;
            text += `Sistem mendeteksi Anda memiliki <b>${accounts.length} akun</b> terikat.\n`;
            text += `Silakan pilih salah satu akun eksekutor di bawah yang ingin lo gunakan untuk mengklaim/menyuntikkan misi referral game Shopee:\n`;
            text += `<code>--------------------------</code>`;

            const buttons = accounts.map(acc => [{
                text: `👤 Akun: ${acc.account_name}`,
                callback_data: `run_mission_${acc.id}`
            }]);

            buttons.push([{ text: "🔙 Kembali ke Dashboard", callback_data: "back_home" }]);

            return await safeEditMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: buttons } });

        } catch (e) {
            logger.engine("MISSION_START_FAIL", e.message, "ERR");
            return await safeEditMessage(chatId, messageId, `❌ <b>Sistem Error:</b> <code>${e.message}</code>`, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] }
            });
        }
    }

    if (data.startsWith("run_mission_")) {
        const accId = data.replace("run_mission_", "");
        await safeAnswerCallback(q.id);

        const acc = await getOwnedAccount(accId, userId, 'account_name');
        if (!acc) return await safeEditMessage(chatId, messageId, "❌ Sesi database kandas.");

        await bot.deleteMessage(chatId, messageId).catch(() => {});

        let promptText = `🎯 <b>MISSION INJECTOR UNTUK:</b> <code>${acc.account_name}</code>\n`;
        promptText += `<code>--------------------------</code>\n`;
        promptText += `📌 <b>TINDAKAN WAJIB:</b>\n`;
        promptText += `Silakan reply/kirimkan tautan referral game Shopee kamu pada kolom chat di bawah ini.\n\n`;
        promptText += `📌 <i>Format contoh: https://shp.ee/147pehgnc88</i>\n`;
        promptText += `<code>--------------------------</code>`;

        const sentMsg = await bot.sendMessage(chatId, promptText, {
            parse_mode: "HTML",
            reply_markup: { force_reply: true, selective: true }
        });

        userState[userId] = {
            step: "WAIT_MISSION_LINK_REPLY",
            target_message_id: sentMsg.message_id,
            account_database_id: accId
        };
    }
    if (data === "set_qty_manual") {
        await safeAnswerCallback(q.id, { text: "Silakan ketik jumlah barang" });

        userState[userId].step = "WAIT_QUANTITY_MANUAL_INPUT";
        userState[userId].original_menu_id = messageId;

        let manualPrompt = `🔢 <b>INPUT MANUAL QUANTITY</b>\n`;
        manualPrompt += `<code>--------------------------</code>\n`;
        manualPrompt += `Silakan ketik dan kirimkan <b>ANGKA</b> jumlah barang yang ingin Anda beli ke chat ini.\n\n`;
        manualPrompt += `<i>Contoh: 5</i>\n`;
        manualPrompt += `<code>--------------------------</code>`;

        return await safeEditMessage(chatId, messageId, manualPrompt, {
            reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] }
        });
    }
    if (data.startsWith("set_qty_")) {
        const targetQty = parseInt(data.replace("set_qty_", "")) || 1;
        await safeAnswerCallback(q.id, { text: `Kuantitas: ${targetQty} Pcs dikunci` });

        const userSession = userState[userId];
        if (!userSession || !userSession.cookie) {
            return await safeEditMessage(chatId, messageId, "⏰ <b>Sesi kedaluwarsa.</b> Ulangi dari awal.", {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] }
            });
        }

        userState[userId].final_quantity = targetQty;
        if (!userState[userId].cart) userState[userId].cart = [];
        userState[userId].cart.push({
            shopid: userSession.shopid,
            itemid: userSession.itemid,
            modelid: userSession.modelid,
            quantity: targetQty,
            productName: userSession.productName || 'Produk Shopee',
            shopName: userSession.shopName || 'Shopee Store',
            variationName: userSession.variationName || ''
        });

        const cartNow = userState[userId].cart;
        const distinctShopsN = new Set(cartNow.map(c => c.shopid)).size;
        const cartFull = cartNow.length >= 2 || distinctShopsN >= 2;
        const last = cartNow[cartNow.length - 1];

        let addMsg = `📥 <b>BERHASIL MASUK KERANJANG!</b>\n\n`;
        addMsg += `🏪 <b>Toko:</b> ${last.shopName}\n`;
        addMsg += `📦 <b>Produk:</b> ${last.productName.substring(0, 45)}\n`;
        if (last.variationName) addMsg += `👕 <b>Variasi:</b> ${last.variationName}\n`;
        addMsg += `🔢 <b>Jumlah:</b> ${last.quantity} pcs\n`;
        addMsg += `<code>──────────────────────────</code>\n`;

        const addButtons = [];
        if (cartFull) {
            addMsg += `⚠️ <b>NOTIFIKASI:</b>\n`;
            addMsg += `Keranjang sudah mencapai batas maksimal (2 produk / 2 toko berbeda). Tombol tambah produk dinonaktifkan.\n\n`;
            addMsg += `<i>Untuk ganti produk, hapus salah satu item dulu:</i>`;
            const delRow = cartNow.map((c, i) => ({ text: `❌ Hapus Produk ${i + 1}`, callback_data: `cart_remove_${i}` }));
            addButtons.push(delRow);
            addButtons.push([{ text: "🛒 Lihat Isi Keranjang", callback_data: "cart_view" }]);
            addButtons.push([{ text: "➡️ Lanjut ke Checkout", callback_data: "cart_checkout" }]);
        } else {
            addMsg += `<i>Silakan pilih aksi selanjutnya:</i>`;
            addButtons.push([{ text: "➕ Tambah Produk Lain", callback_data: "cart_add" }]);
            addButtons.push([{ text: "🛒 Lihat Isi Keranjang", callback_data: "cart_view" }]);
            addButtons.push([{ text: "➡️ Lanjut ke Checkout", callback_data: "cart_checkout" }]);
        }
        return await safeEditMessage(chatId, messageId, addMsg, { reply_markup: { inline_keyboard: addButtons } });
    }

    if (data === "cart_view") {
        if (q.id && !String(q.id).startsWith('synthetic')) await safeAnswerCallback(q.id, { text: "Keranjang" });
        const us = userState[userId];
        const cart = (us && us.cart) || [];
        if (!us || cart.length === 0) {
            return await safeEditMessage(chatId, messageId, "🛒 <b>KERANJANG BELANJA ANDA KOSONG</b>\n\nBelum ada produk. Kirim link produk Shopee untuk mulai.", {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali ke Menu Utama", callback_data: "back_home" }]] }
            });
        }
        const distinctShops = new Set(cart.map(c => c.shopid)).size;
        const isFull = cart.length >= 2 || distinctShops >= 2;

        let text = `🛒 <b>ISI KERANJANG (${cart.length} Item)</b>\n`;
        text += `<code>──────────────────────────</code>\n`;
        cart.forEach((c, i) => {
            text += `${i + 1}. 🛍️ <b>${c.productName.substring(0, 35)}</b>\n`;
            text += `   🏪 ${c.shopName} | 🔢 ${c.quantity} pcs\n`;
        });
        text += `<code>──────────────────────────</code>\n`;
        if (isFull) text += `⚠️ <i>Keranjang penuh (maks 2 produk/toko). Hapus item untuk ganti, atau lanjut checkout.</i>`;
        else text += `<i>Tambah produk lain atau lanjut checkout.</i>`;

        const buttons = [];
        if (!isFull) buttons.push([{ text: "➕ Tambah Produk Lain", callback_data: "cart_add" }]);
        const delRow = cart.map((c, i) => ({ text: `🗑️ Hapus #${i + 1}`, callback_data: `cart_remove_${i}` }));
        buttons.push(delRow);
        buttons.push([{ text: "➡️ Lanjut ke Checkout", callback_data: "cart_checkout" }]);
        buttons.push([{ text: "🔙 Batal", callback_data: "back_home" }]);
        return await safeEditMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: buttons } });
    }
    if (data === "cart_add") {
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us) return await safeEditMessage(chatId, messageId, "⏰ Sesi kedaluwarsa.", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] } });
        us.step = "WAIT_PRODUCT_LINK_REPLY";
        const sent = await bot.sendMessage(chatId, "🛒 <b>TAMBAH PRODUK KE KERANJANG</b>\n\nKirim link produk Shopee berikutnya (toko sama atau toko kedua):", {
            parse_mode: "HTML", reply_markup: { force_reply: true, selective: true }
        });
        us.target_message_id = sent.message_id;
        return;
    }
    if (data.startsWith("cart_remove_")) {
        await safeAnswerCallback(q.id, { text: "Item dihapus" });
        const idx = parseInt(data.replace("cart_remove_", ""));
        const us = userState[userId];
        if (us && Array.isArray(us.cart) && us.cart[idx]) us.cart.splice(idx, 1);
        return bot.emit("callback_query", { ...q, data: "cart_view" });
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // ⛔ BATAS: Sniper checkout lama (cart_checkout) — TIDAK DIPAKAI untuk FO flow
    // Gunakan fo_cart_checkout untuk Full-Order flow
    // ═══════════════════════════════════════════════════════════════════════════
    if (data === "cart_checkout") {
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us || !(us.cart || []).length) {
            return await safeEditMessage(chatId, messageId, "🛒 Keranjang kosong.", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] } });
        }
        us.shopid = us.cart[0].shopid;
        us.itemid = us.cart[0].itemid;
        us.modelid = us.cart[0].modelid;
        us.final_quantity = us.cart[0].quantity;
        us.step = "WAIT_PAYMENT_SELECT";
        us.voucherSel = { platform: null, shop: null, fsv: null };
        us.payment = DEFAULT_PAYMENT;
        us.useCoins = true;
        us.voucherChannelMap = null;
        us.probeShipping = undefined;
        return bot.emit("callback_query", { ...q, data: "pick_payment_menu" });
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // ⛔ BATAS AKHIR: Sniper checkout lama
    // ═══════════════════════════════════════════════════════════════════════════

    if (data === "memru_order_start") {

        await safeAnswerCallback(q.id, { text: "Memuat..." });
        logger.engine("FO_START", `User ${userId} memulai Full-Order flow`, "INFO");

        try {
            let text = `🛒 <b>BUAT PESANAN BARU (AUTO CO)</b>\n`;
            text += `<code>--------------------------</code>\n`;
            text += `Masukkan cookie Shopee untuk memulai checkout.\n`;
            text += `Cookie akan otomatis tersimpan setelah order berhasil.\n`;
            text += `<code>--------------------------</code>`;

            const buttons = [[{ text: "🍪 Input Cookie Manual", callback_data: "fo_cookie_start" }]];
            buttons.push([{ text: "🏠 Kembali ke Menu Utama", callback_data: "back_home" }]);

            return await safeEditMessage(chatId, messageId, text, {
                reply_markup: { inline_keyboard: buttons }
            });

        } catch (e) {
            return await safeEditMessage(chatId, messageId, `❌ <b>Sistem Error:</b> <code>${e.message}</code>`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🍪 FULL-ORDER FLOW CALLBACKS (Cookie input → Product → Voucher → Order)
    // ═══════════════════════════════════════════════════════════════════════════
    if (data === "fo_cookie_start") {
        await safeAnswerCallback(q.id);
        logger.info(userId, "CALLBACK_BTN", "fo_cookie_start");
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        let txt = `🍪 <b>INPUT COOKIE SHOPEE</b>\n`;
        txt += `<code>--------------------------</code>\n`;
        txt += `📌 Silakan <b>kirim</b> cookie Shopee Anda pada kolom chat di bawah ini.\n\n`;
        txt += `Bisa cookie web ataupun app — sistem akan otomatis konversi ke format APP.\n\n`;
        txt += `<i>Contoh: SPC_EC=xxx; SPC_U=xxx; csrftoken=xxx; ...</i>\n`;
        txt += `<code>--------------------------</code>`;
        const sentMsg = await bot.sendMessage(chatId, txt, { parse_mode: "HTML", reply_markup: { force_reply: true, selective: true } });
        userState[userId] = { step: "WAIT_FO_COOKIE", fo_prompt_id: sentMsg.message_id };
        return;
    }
    if (data === "fo_gen_fp_login") {
    await safeAnswerCallback(q.id);
    const us = userState[userId];
    
    if (!us || us.step !== "LOGIN_FO_FINGERPRINT") return;
    
    // Memanggil fungsi pool bawaan kodemu
    const genFp = getRandomFpFromPool(); 
    if (!genFp) {
        return await safeEditMessage(chatId, messageId, `❌ <b>Pool fingerprint kosong!</b>\n<code>--------------------------</code>\nBelum ada fingerprint tersimpan.\nSilakan kirim fingerprint secara manual.\n<code>--------------------------</code>`, { reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'method_cookie' }]] } });
    }
    
    us.foFingerprint = genFp;
    await bot.deleteMessage(chatId, messageId).catch(() => {});

    const cookie = us.foCookie;
    const loadMsg = await safeSendMessage(chatId, '⏳ Memvalidasi cookie dengan fingerprint generate & mendaftarkan ke database...');

    try {
        // 🔍 Deteksi Jenis Platform dari FP yang terambil dari pool
        let fpType = "Bawaan Akun / Sistem";
        const parts = genFp.split('|');
        const osCode = parts[3]; 
        const osSubCode = parts[4];
        const fullOsCode = osSubCode ? `${osCode}|${osSubCode}` : osCode;

        if (fullOsCode === "08|0") fpType = "🤖 Generator FP";
        else if (fullOsCode === "08|1") fpType = "📱 Android App";
        else if (fullOsCode === "08|2") fpType = "🍏 iOS App";
        else if (fullOsCode === "08|3") fpType = "🌐 Web Browser";
        else if (fullOsCode) fpType = `❓ Unknown (${fullOsCode})`;

        console.log(`\x1b[36m[USER-${userId}]\x1b[0m | \x1b[35mFP_GENERATED\x1b[0m | Mendapatkan dari Pool: \x1b[1m${fpType}\x1b[0m`);

        const headers = { host: "shopee.co.id", accept: "application/json", 'content-type': "application/json", 'user-agent': getUA(cookie), cookie };
        const accRes = await axios.get('https://shopee.co.id/api/v4/account/basic/get_account_info', { headers, timeout: 10000 });
        const accData = accRes.data;
        const username = accData?.data?.username || accData?.data?.phone || 'Unknown';
        const userPhone = accData?.data?.phone || null;

        // 💾 PROSES INTEGRASI INSERT SUPABASE DB (SESUAI CONFIG KAMU)
        const { error: insertErr } = await supabase.from('shopee_accounts').insert({
            user_id: userId,
            account_name: username,
            cookie: encryptCookie(cookie),
            device_identity: { 
                phone: userPhone, 
                device_id: (cookie.match(/SPC_F=([^;]+)/) || ['', ''])[1] || '', 
                sz_token: genFp, 
                x_sap_ri: '', 
                sz_token_ts: genFp ? Date.now() : null 
            }
        });

        if (insertErr) throw new Error(`Supabase Error: ${insertErr.message}`);

        // Hapus status state agar sesi chat bersih dan tidak berkelanjutan meminta link produk
        delete userState[userId];

        // Tampilan pesan sukses menyimpan akun kelolaan baru
        let sucMsg = `✅ <b>AKUN BERHASIL DISIMPAN!</b>\n<code>--------------------------</code>\n`;
        sucMsg += `👤 <b>Username :</b> <code>${username}</code>\n`;
        sucMsg += `🔑 <b>Jenis FP  :</b> <code>${fpType}</code> (Auto)\n`;
        sucMsg += `<code>--------------------------</code>\n\n`;
        sucMsg += `Sesi login kelola akun baru berhasil ditambahkan menggunakan sidik jari acak dari pool.`;

        await bot.editMessageText(sucMsg, { 
            chat_id: chatId, 
            message_id: loadMsg.message_id, 
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "➕ Tambah Akun Lagi", callback_data: "method_cookie" }],
                    [{ text: "🔙 Kembali ke Kelola Akun", callback_data: "manage_acc" }]
                ]
            }
        });
    } catch (e) {
        const errTxt = e.response?.data?.error_msg || e.message || 'unknown';
        await bot.editMessageText(`❌ <b>Gagal Menyimpan Akun</b>\n<code>--------------------------</code>\n<code>${errTxt}</code>\n\nSilakan coba lagi.`, { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔄 Ulangi", callback_data: "method_cookie" }, { text: "🏠 Menu", callback_data: "back_home" }]] } });
        delete userState[userId];
    }
    return;
}
    if (data === "fo_gen_fp") {
    await safeAnswerCallback(q.id);
    const us = userState[userId];
    if (!us || us.step !== "WAIT_FO_FINGERPRINT") return;
    
    const genFp = getRandomFpFromPool();
    if (!genFp) {
        return await safeEditMessage(chatId, messageId, `❌ <b>Pool fingerprint kosong!</b>\n<code>--------------------------</code>\nBelum ada fingerprint tersimpan.\nSilakan kirim fingerprint secara manual.\n<code>--------------------------</code>`, { reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'fo_cookie_start' }]] } });
    }
    us.foFingerprint = genFp;
    await bot.deleteMessage(chatId, messageId).catch(() => {});

    const cookie = us.foCookie;
    const loadMsg = await safeSendMessage(chatId, '⏳ Memvalidasi cookie dengan fingerprint generate...');

    try {
        // 🔍 Deteksi Jenis Platform dari FP yang terambil dari pool
        let fpType = "Bawaan Akun / Sistem";
        const parts = genFp.split('|');
        const osCode = parts[3]; 
        const osSubCode = parts[4];
        const fullOsCode = osSubCode ? `${osCode}|${osSubCode}` : osCode;

        if (fullOsCode === "08|0") fpType = "🤖 Generator FP";
        else if (fullOsCode === "08|1") fpType = "📱 Android App";
        else if (fullOsCode === "08|2") fpType = "🍏 iOS App";
        else if (fullOsCode === "08|3") fpType = "🌐 Web Browser";
        else if (fullOsCode) fpType = `❓ Unknown (${fullOsCode})`;


        console.log(`\x1b[36m[USER-${userId}]\x1b[0m | \x1b[35mFP_GENERATED\x1b[0m | Mendapatkan dari Pool: \x1b[1m${fpType}\x1b[0m`);

        const csrf = foExtractCsrfToken(cookie);
        const headers = { host: "shopee.co.id", accept: "application/json", 'content-type': "application/json", 'user-agent': getUA(cookie), cookie };
        const accRes = await axios.get('https://shopee.co.id/api/v4/account/basic/get_account_info', { headers, timeout: 10000 });
        const accData = accRes.data;
        const username = accData?.data?.username || accData?.data?.phone || 'Unknown';

        us.foUsername = username;
        us.foCsrf = csrf;
        us.step = "WAIT_FO_PRODUCT_LINK";
        us.cart = [];
        us.foMode = true;

        let sucMsg = `✅ <b>COOKIE VALID!</b>\n<code>--------------------------</code>\n`;
        sucMsg += `👤 <b>Username :</b> <code>${username}</code>\n`;
        sucMsg += `🔑 <b>Jenis FP  :</b> <code>${fpType}</code> (Auto)\n`; // <-- Menampilkan jenis device
        sucMsg += `<code>--------------------------</code>\n\n`;
        sucMsg += `🛍️ <b>MASUKKAN LINK PRODUK SHOPEE</b>\n`;
        sucMsg += `<code>--------------------------</code>\n`;
        sucMsg += `Silakan kirim link produk Shopee yang ingin di-checkout.\n\n`;
        sucMsg += `<i>Contoh: https://s.shopee.co.id/20tEhVS80q</i>\n`;
        sucMsg += `<code>--------------------------</code>`;

        await bot.editMessageText(sucMsg, { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML" });
        us.fo_link_prompt_id = loadMsg.message_id;
    } catch (e) {
        const errTxt = e.response?.data?.error_msg || e.message || 'unknown';
        await bot.editMessageText(`❌ <b>Cookie Ditolak / Expired</b>\n<code>--------------------------</code>\n<code>${errTxt}</code>\n\nSilakan coba lagi.`, { chat_id: chatId, message_id: loadMsg.message_id, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔄 Ulangi", callback_data: "fo_cookie_start" }, { text: "🏠 Menu", callback_data: "back_home" }]] } });
        delete userState[userId];
    }
    return;
}

    if (data.startsWith("fo_pay_")) {
        const idx = parseInt(data.replace("fo_pay_", ""));
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us || !us.foPayArr) return;
        const sel = us.foPayArr[idx];
        if (!sel) return;
        us.foPayIdx = idx;
        us.foPayment = sel.obj;
        us.foSpmChId = sel.spm_channel_id;
        us.foSpmOpt = sel.spm_option_info;
        return await foShowPaymentPage(chatId, messageId, userId);
    }

    if (data === "fo_goto_voucher") {
        await safeAnswerCallback(q.id, { text: "Mengambil voucher..." });
        const us = userState[userId];
        if (!us) return;
        return await foDoVouchers(chatId, messageId, userId);
    }

    if (data === "fo_back_pay") {
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us) return;
        us.step = 'FO_SELECT_PAY';
        return await foShowPaymentPage(chatId, messageId, userId);
    }

    if (data === "fo_toggle_coins") {
        await safeAnswerCallback(q.id, { text: "Toggle koin" });
        const us = userState[userId];
        if (!us) return;
        us.foUseCoins = !us.foUseCoins;
        return await foShowVoucherPage(chatId, messageId, userId);
    }

    if (data === "fo_pick_courier") {
        await safeAnswerCallback(q.id, { text: "Memuat kurir..." });
        const us = userState[userId];
        if (!us) return;
        const shipCh = us.foShipChannels || [];
        const rpC = (n) => n > 0 ? `Rp ${(n / 100000).toLocaleString('id-ID')}` : 'GRATIS';
        let txt = `📦 <b>PILIH KURIR</b>\n<code>--------------------------</code>\n`;
        txt += `✅ Terpilih: <b>${us.foLogisticName || 'Default'}</b>\n<code>--------------------------</code>`;
        const kb = [];
        if (!shipCh.length) {
            txt += `\n<i>Tidak ada opsi kurir terdeteksi. Gunakan default.</i>`;
            kb.push([{ text: '🔄 Default (Auto)', callback_data: 'fo_back_voucher' }]);
        } else {
            shipCh.forEach(c => {
                const chosen = us.foLogistic === c.id;
                kb.push([{ text: `${chosen ? '✅' : '🚚'} ${courierLabel(c.id, c.name)} (${rpC(c.fee)})`, callback_data: `fo_set_courier_${c.id}` }]);
            });
        }
        kb.push([{ text: '✅ Selesai / Kembali', callback_data: 'fo_back_voucher' }]);
        return await safeEditMessage(chatId, messageId, txt, { reply_markup: { inline_keyboard: kb } });
    }

    if (data.startsWith("fo_set_courier_")) {
        const cid = parseInt(data.replace("fo_set_courier_", ""));
        await safeAnswerCallback(q.id, { text: "Kurir dipilih" });
        const us = userState[userId];
        if (!us) return;
        us.foLogistic = cid;
        const ch = (us.foShipChannels || []).find(c => c.id === cid);
        us.foLogisticName = ch ? courierLabel(cid, ch.name) : courierLabel(cid);
        us.foLogisticFee = ch?.fee || 0;
        logger.engine("FO_COURIER", `User ${userId} pilih kurir: ${us.foLogisticName} (${cid})`, "INFO");
        const shipCh = us.foShipChannels || [];
        const rpC = (n) => n > 0 ? `Rp ${(n / 100000).toLocaleString('id-ID')}` : 'GRATIS';
        let txt = `📦 <b>PILIH KURIR</b>\n<code>--------------------------</code>\n`;
        txt += `✅ Terpilih: <b>${us.foLogisticName}</b>\n<code>--------------------------</code>`;
        const kb = [];
        shipCh.forEach(c => {
            const chosen = us.foLogistic === c.id;
            kb.push([{ text: `${chosen ? '✅' : '🚚'} ${courierLabel(c.id, c.name)} (${rpC(c.fee)})`, callback_data: `fo_set_courier_${c.id}` }]);
        });
        kb.push([{ text: '✅ Selesai / Kembali', callback_data: 'fo_back_voucher' }]);
        return await safeEditMessage(chatId, messageId, txt, { reply_markup: { inline_keyboard: kb } });
    }

    if (data === "fo_set_note") {
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us) return;
        us.step = "WAIT_FO_BUYER_NOTE";
        us.fo_voucher_msg_id = messageId;
        const sent = await bot.sendMessage(chatId, "📌 <b>Ketik catatan untuk seller</b> (maks 200 karakter).\nKirim <code>-</code> untuk hapus catatan.", { parse_mode: "HTML", reply_markup: { force_reply: true, selective: true } });
        us.fo_note_prompt_id = sent.message_id;
        return;
    }

    if (data === "fo_reset_voucher") {
        await safeAnswerCallback(q.id, { text: "Voucher direset" });
        const us = userState[userId];
        if (!us) return;
        us.foSelPV = [];
        us.foSelFsv = null;
        return await foShowVoucherPage(chatId, messageId, userId);
    }

    if (data.startsWith("fo_pv_")) {
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us) return;
        const i = parseInt(data.replace("fo_pv_", ""));
        const v = (us.foCompatPV || [])[i];
        if (!v) return;
        if (!us.foSelPV) us.foSelPV = [];
        const exists = us.foSelPV.findIndex(x => x.voucher_code === v.voucher_code);
        if (exists >= 0) us.foSelPV.splice(exists, 1);
        else us.foSelPV.push({ voucher_code: v.voucher_code, promotionid: v.promotionid || v.promotion_id });
        return await foShowVoucherPage(chatId, messageId, userId);
    }

    if (data.startsWith("fo_fsv_")) {
        const idx = parseInt(data.replace("fo_fsv_", ""));
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us || !us.foFsvList) return;
        const fsv = us.foFsvList[idx];
        if (!fsv) return;
        if (us.foSelFsv && us.foSelFsv.voucher_code === fsv.voucher_code) {
            us.foSelFsv = null;
        } else {
            us.foSelFsv = { promotionid: fsv.promotionid || fsv.promotion_id, voucher_code: fsv.voucher_code };
        }
        return await foShowVoucherPage(chatId, messageId, userId);
    }

    if (data === "fo_preview_price") {
        await safeAnswerCallback(q.id, { text: "Menghitung harga..." });
        const us = userState[userId];
        if (!us) return;
        us.step = 'FO_FINAL';
        return await foDoFinalCheckout(chatId, messageId, userId);
    }

    if (data === "fo_back_voucher") {
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us) return;
        us.step = 'FO_VOUCHER_PAGE';
        return await foShowVoucherPage(chatId, messageId, userId);
    }

    if (data === "fo_vf_rem_inv") {
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us) return;
        us.foSelPV = us.foValidPV || [];
        return await foDoFinalCheckout(chatId, messageId, userId);
    }
    if (data === "fo_vf_rem_all") {
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us) return;
        us.foSelPV = [];
        us.foSelFsv = null;
        return await foDoFinalCheckout(chatId, messageId, userId);
    }
    if (data === "fo_vf_cancel") {
        await safeAnswerCallback(q.id);
        delete userState[userId];
        return await safeEditMessage(chatId, messageId, "❌ Order dibatalkan.", { reply_markup: { inline_keyboard: [[{ text: "🏠 Menu Utama", callback_data: "back_home" }]] } });
    }

    if (data === "fo_order_yes") {
        await safeAnswerCallback(q.id, { text: "Memproses order..." });
        return await foDoPlaceOrder(chatId, messageId, userId);
    }
    if (data === "fo_order_no") {
        await safeAnswerCallback(q.id);
        delete userState[userId];
        return await safeEditMessage(chatId, messageId, "❌ Order dibatalkan.", { reply_markup: { inline_keyboard: [[{ text: "🏠 Menu Utama", callback_data: "back_home" }]] } });
    }

    if (data === "fo_cart_checkout") {
        await safeAnswerCallback(q.id, { text: "Memulai checkout..." });
        const us = userState[userId];
        if (!us || !us.cart || us.cart.length === 0) {
            return await safeEditMessage(chatId, messageId, "🛒 <b>Keranjang kosong.</b>\nTambahkan produk terlebih dahulu.", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] } });
        }
        logger.engine("FO_CHECKOUT", `User ${userId} memulai checkout dengan ${us.cart.length} item`, "INFO");
        return await foDoCheckoutInit(chatId, userId, messageId);
    }

    if (data.startsWith("fo_model_")) {
        const modelId = parseInt(data.replace("fo_model_", ""));
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us) return;
        us.modelid = modelId;
        const found = (us.models || []).find(m => m.model_id === modelId);
        us.variationName = found ? found.name : '';
        us.step = "WAIT_FO_QTY";
        let qMsg = `🔐 <b>MASUKKAN JUMLAH BARANG</b>\n<code>--------------------------</code>\n`;
        qMsg += `👤 <b>Akun   :</b> <code>${us.foUsername}</code>\n`;
        qMsg += `🛍️ <b>Produk :</b> <code>${(us.productName || '').substring(0, 40)}</code>\n`;
        qMsg += `🎨 <b>Variasi:</b> <code>${us.variationName}</code>\n`;
        qMsg += `<code>--------------------------</code>\n📌 <i>Pilih kuantitas:</i>`;
        const kb = [[{ text: "1 Pcs", callback_data: "fo_qty_1" }, { text: "2 Pcs", callback_data: "fo_qty_2" }, { text: "3 Pcs", callback_data: "fo_qty_3" }], [{ text: "🔢 Manual", callback_data: "fo_qty_manual" }], [{ text: "❌ Batal", callback_data: "back_home" }]];
        return await safeEditMessage(chatId, messageId, qMsg, { reply_markup: { inline_keyboard: kb } });
    }

    if (data === "fo_qty_manual") {
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us) return;
        us.step = "WAIT_FO_QTY_MANUAL";
        return await safeEditMessage(chatId, messageId, `🔢 <b>INPUT MANUAL JUMLAH</b>\n<code>--------------------------</code>\nSilakan ketik angka (1-100):\n<code>--------------------------</code>`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] } });
    }

    if (data.startsWith("fo_qty_") && data !== "fo_qty_manual") {
        const qty = parseInt(data.replace("fo_qty_", ""));
        await safeAnswerCallback(q.id, { text: `Qty: ${qty}` });
        const us = userState[userId];
        if (!us) return;
        us.cart.push({ shopid: us.shopid, itemid: us.itemid, modelid: us.modelid, quantity: qty, productName: us.productName || 'Produk Shopee', shopName: us.shopName || 'Shopee Store', variationName: us.variationName || '' });

        const cartNow = us.cart;
        const distinctShops = new Set(cartNow.map(c => c.shopid)).size;
        const cartFull = cartNow.length >= 2 || distinctShops >= 2;
        const last = cartNow[cartNow.length - 1];

        logger.engine("FO_CART", `User ${userId} tambah produk ke keranjang: ${last.productName} x${qty}`, "SUCCESS");
        let addMsg = `📥 <b>BERHASIL MASUK KERANJANG!</b>\n\n`;
        addMsg += `🏪 <b>Toko:</b> ${last.shopName}\n📦 <b>Produk:</b> ${last.productName.substring(0, 45)}\n`;
        if (last.variationName) addMsg += `👕 <b>Variasi:</b> ${last.variationName}\n`;
        addMsg += `🔢 <b>Jumlah:</b> ${qty} pcs\n<code>──────────────────────────</code>\n`;

        const addButtons = [];
        if (cartFull) {
            addMsg += `\n⚠️ <b>NOTIFIKASI:</b>\n`;
            addMsg += `Keranjang sudah mencapai batas maksimal (2 produk / 2 toko berbeda). Tombol tambah produk dinonaktifkan.\n\n`;
            addMsg += `<i>Untuk ganti produk, hapus salah satu item dulu:</i>`;
            const delRow = cartNow.map((c, i) => ({ text: `❌ Hapus Produk ${i + 1}`, callback_data: `fo_cart_del_${i}` }));
            addButtons.push(delRow);
            addButtons.push([{ text: "🛒 Lihat Isi Keranjang", callback_data: "fo_view_cart" }]);
            addButtons.push([{ text: "➡️ Lanjut ke Checkout", callback_data: "fo_cart_checkout" }]);
        } else {
            addMsg += `<i>Silakan pilih aksi selanjutnya:</i>`;
            addButtons.push([{ text: "➕ Tambah Produk Lain", callback_data: "fo_add_more" }]);
            addButtons.push([{ text: "🛒 Lihat Isi Keranjang", callback_data: "fo_view_cart" }]);
            addButtons.push([{ text: "➡️ Lanjut ke Checkout", callback_data: "fo_cart_checkout" }]);
        }
        return await safeEditMessage(chatId, messageId, addMsg, { reply_markup: { inline_keyboard: addButtons } });
    }

    if (data === "fo_view_cart") {
        await safeAnswerCallback(q.id, { text: "Keranjang" });
        const us = userState[userId];
        const cart = (us && us.cart) || [];
        if (!us || cart.length === 0) {
            return await safeEditMessage(chatId, messageId, "🛒 <b>Keranjang kosong.</b>", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] } });
        }
        const distinctShops = new Set(cart.map(c => c.shopid)).size;
        const isFull = cart.length >= 2 || distinctShops >= 2;

        let text = `🛒 <b>ISI KERANJANG (${cart.length} Item)</b>\n`;
        text += `<code>──────────────────────────</code>\n`;
        cart.forEach((c, i) => {
            text += `${i + 1}. 🛍️ <b>${c.productName.substring(0, 35)}</b>\n`;
            text += `   🏪 ${c.shopName} | 🔢 ${c.quantity} pcs\n`;
        });
        text += `<code>──────────────────────────</code>\n`;
        if (isFull) text += `⚠️ <i>Keranjang penuh (maks 2 produk/toko). Hapus item untuk ganti, atau lanjut checkout.</i>`;
        else text += `<i>Tambah produk lain atau lanjut checkout.</i>`;

        const buttons = [];
        const delRow = cart.map((c, i) => ({ text: `🗑️ Hapus #${i + 1}`, callback_data: `fo_cart_del_${i}` }));
        buttons.push(delRow);
        buttons.push([{ text: "➡️ Lanjut ke Checkout", callback_data: "fo_cart_checkout" }]);
        buttons.push([{ text: "🔙 Batal", callback_data: "back_home" }]);
        return await safeEditMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith("fo_cart_del_")) {
        const idx = parseInt(data.replace("fo_cart_del_", ""));
        await safeAnswerCallback(q.id, { text: "Dihapus" });
        const us = userState[userId];
        if (!us || !us.cart) return;
        if (idx >= 0 && idx < us.cart.length) {
            logger.engine("FO_CART", `User ${userId} hapus produk #${idx + 1} dari keranjang`, "INFO");
            us.cart.splice(idx, 1);
        }
        if (us.cart.length === 0) {
            return await safeEditMessage(chatId, messageId, "🛒 <b>Keranjang kosong.</b>\n\nSemua produk telah dihapus.", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] } });
        }
        return bot.emit("callback_query", { id: `synthetic_${Date.now()}`, from: q.from, message: { chat: { id: chatId }, message_id: messageId }, data: "fo_view_cart" });
    }

    if (data === "fo_add_more") {
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us) return;
        us.step = "WAIT_FO_PRODUCT_LINK";
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        let txt = `🛍️ <b>TAMBAH PRODUK LAIN</b>\n<code>--------------------------</code>\n`;
        txt += `📋 Keranjang: <b>${us.cart.length} item</b>\n`;
        txt += `Silakan reply dengan link produk Shopee berikutnya:\n<code>--------------------------</code>`;
        const sentMsg = await bot.sendMessage(chatId, txt, { parse_mode: "HTML", reply_markup: { force_reply: true, selective: true } });
        us.fo_link_prompt_id = sentMsg.message_id;
        return;
    }

    if (data === "memru_check_start") {
        await safeAnswerCallback(q.id, { text: "Memuat daftar slot akun..." });

        try {
            const { data: accounts, error } = await supabase
                .from('shopee_accounts')
                .select('*')
                .eq('user_id', String(userId));

            if (error || !accounts || accounts.length === 0) {
                return await safeEditMessage(chatId, messageId, "🚫 <b>Akses Ditolak:</b> Anda belum menghubungkan akun Shopee Anda.\n\nSilakan masuk ke menu <b>👤 KELOLA AKUN</b> untuk menambahkan sesi terlebih dahulu.", {
                    reply_markup: { inline_keyboard: [[{ text: "👤 KELOLA AKUN", callback_data: "manage_acc" }]] }
                });
            }

            let text = `📋 <b>CEK PESANAN MALL (MONITORING RIWAYAT)</b>\n`;
            text += `<code>--------------------------</code>\n`;
            text += `Sistem mendeteksi Anda memiliki <b>${accounts.length} akun</b> terikat.\n`;
            text += `Silakan pilih akun Shopee di bawah ini untuk melihat daftar riwayat transaksi terbaru Anda:\n`;
            text += `<code>--------------------------</code>`;

            const buttons = accounts.map(acc => [{
                text: `👤 Akun: ${acc.account_name}`,
                callback_data: `run_check_${acc.id}`
            }]);

            buttons.push([{ text: "🏠 Kembali ke Menu Utama", callback_data: "back_home" }]);

            return await safeEditMessage(chatId, messageId, text, {
                reply_markup: { inline_keyboard: buttons }
            });

        } catch (e) {
            logger.engine("CHECK_START_CRITICAL", e.message, "ERR");
            return await safeEditMessage(chatId, messageId, `❌ <b>Sistem Error:</b> <code>${e.message}</code>`, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "back_home" }]] }
            });
        }
    }
    if (data.startsWith("order_tgt_")) {
        const accId = data.replace("order_tgt_", "");
        await safeAnswerCallback(q.id);

        const acc = await getOwnedAccount(accId, userId, 'account_name');
        if (!acc) return await safeEditMessage(chatId, messageId, "👤 Sesi akun tidak ditemukan.");

        await bot.deleteMessage(chatId, messageId).catch(() => {});

        let replyInstr = `🛒 <b>ORDER TARGET UNTUK:</b> <code>${acc.account_name}</code>\n`;
        replyInstr += `<code>--------------------------</code>\n`;
        replyInstr += `📌 <b>TINDAKAN WAJIB:</b>\n`;
        replyInstr += `Silakan langsung ketik atau tempel link produk Shopee Anda pada kolom balasan di bawah ini.\n`;
        replyInstr += `<code>--------------------------</code>\n`;
        replyInstr += `📌 <i>Sistem otomatis mengunci Checkout pada akun ini.</i>`;

        const sentMsg = await bot.sendMessage(chatId, replyInstr, {
            parse_mode: "HTML",
            reply_markup: {
                force_reply: true,
                selective: true
            }
        });

        userState[userId] = {
            step: "WAIT_PRODUCT_LINK_REPLY",
            target_message_id: sentMsg.message_id,
            account_database_id: accId
        };
    }
    if (data.startsWith("pick_model_")) {
        const selectedModelId = data.replace("pick_model_", "");
        await safeAnswerCallback(q.id, { text: "Model variasi berhasil dikunci!" });

        userState[userId].modelid = parseInt(selectedModelId);
        const pickedModel = (userState[userId].models || []).find(m => String(m.model_id) === String(selectedModelId));
        userState[userId].variationName = pickedModel ? (pickedModel.name || '') : '';
        userState[userId].step = "WAIT_QUANTITY_INPUT";

        let qtyMsg = `🔐 <b>MASUKKAN JUMLAH BARANG</b>\n`;
        qtyMsg += `<code>--------------------------</code>\n`;
        qtyMsg += `🆔 <b>Shop ID   :</b> <code>${userState[userId].shopid}</code>\n`;
        qtyMsg += `🆔 <b>Item ID   :</b> <code>${userState[userId].itemid}</code>\n`;
        qtyMsg += `🆔 <b>Model ID  :</b> <code>${selectedModelId}</code>\n`;
        qtyMsg += `<code>--------------------------</code>\n\n`;
        qtyMsg += `📌 <i>Variasi aman terkonfirmasi. Silakan tentukan kuantitas jumlah barang:</i>`;

        const buttons = [
            [
                { text: "1 Pcs", callback_data: "set_qty_1" },
                { text: "2 Pcs", callback_data: "set_qty_2" },
                { text: "3 Pcs", callback_data: "set_qty_3" }
            ],
            [{ text: "🔢 Input Manual Jumlah Lain", callback_data: "set_qty_manual" }],
            [{ text: "❌ Batalkan Sesi", callback_data: "back_home" }]
        ];

        return await safeEditMessage(chatId, messageId, qtyMsg, {
            reply_markup: { inline_keyboard: buttons }
        });
    }
    const detMap = { det_unpaid_: ["unpaid","to_pay",""], det_pack_: ["to_ship","packing"], det_ship_: ["shipping","to_receive"], det_done_: ["completed"], det_cancel_: ["cancel","cancelled"] };
    const detLabelMap = { det_unpaid_: "❌ Belum Dibayar", det_pack_: "⏳ Dikemas", det_ship_: "🚚 Dikirim", det_done_: "✅ Selesai", det_cancel_: "🚫 Dibatalkan" };
    const detIconMap = { det_unpaid_: "❌", det_pack_: "⏳", det_ship_: "🚚", det_done_: "✅", det_cancel_: "🚫" };
    const detPrefix = Object.keys(detMap).find(p => data.startsWith(p));
    if (detPrefix) {
        const rest = data.replace(detPrefix, "");
        const pageMatch = rest.match(/^(.+?)_p(\d+)$/);
        const accId = pageMatch ? pageMatch[1] : rest;
        const page = pageMatch ? parseInt(pageMatch[2]) : 1;
        const PER_PAGE = 5;
        await safeAnswerCallback(q.id, { text: "Memuat daftar pesanan..." });
        try {
            const activeAccount = await getOwnedAccount(accId, userId);
            if (!activeAccount) throw new Error("Sesi akun terputus.");
            const orderRes = await fetchShopeeOrderList(activeAccount.cookie, activeAccount.device_identity);
            if (!orderRes.success) throw new Error(orderRes.msg);
            const keywords = detMap[detPrefix];
            const label = detLabelMap[detPrefix];
            const icon = detIconMap[detPrefix];
            const filtered = (orderRes.orders || []).filter(item => {
                const status = item.order_list_detail?.status?.text?.text?.toLowerCase() || "";
                if (detPrefix === 'det_unpaid_') return status.includes('to_pay') || status.includes('unpaid') || status === '';
                return keywords.some(k => k !== '' && status.includes(k));
            });

            if (!userState[userId]) userState[userId] = {};
            const orderMap = filtered.map(item => {
                const d = item.order_list_detail || {};
                return {
                    orderId: String(d.order_id || d.checkout_id || ''),
                    name: (d.items || [])[0]?.name || 'Produk Shopee',
                    shop: d.shop?.shop_name || '',

                    listItems: (d.items || []).map(it => ({ name: it.name || 'Produk', model: it.model_name || it.model || '', qty: it.amount || it.quantity || 1, price: it.order_price ?? it.item_price ?? it.price ?? 0 })),
                    listTotal: d.total_payment_amount?.total_price || 0
                };
            }).filter(x => x.orderId);
            userState[userId].orderDetailCtx = { accId, prefix: detPrefix, map: orderMap };

            const totalPages = Math.max(1, Math.ceil(orderMap.length / PER_PAGE));
            const curPage = Math.min(Math.max(1, page), totalPages);
            const start = (curPage - 1) * PER_PAGE;
            const slice = orderMap.slice(start, start + PER_PAGE);

            let detText = `${icon} <b>MENAMPILKAN TRANSAKSI (${label.replace(/^.\s/, '').toUpperCase()})</b>\n\n`;
            if (orderMap.length === 0) {
                detText += `<i>Tidak ada pesanan di kategori ini.</i>`;
                return await safeEditMessage(chatId, messageId, detText, {
                    reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali ke Ringkasan", callback_data: `run_check_${accId}` }]] }
                });
            }
            detText += `Halaman: ${curPage} / ${totalPages}\n`;
            detText += `Silakan klik salah satu produk di bawah untuk melihat rincian asli dari Shopee:`;

            const buttons = [];
            slice.forEach((o, i) => {
                const globalIdx = start + i;
                buttons.push([{ text: `📦 ${globalIdx + 1}. ${o.name.substring(0, 32)}`, callback_data: `vdet_${globalIdx}_p${curPage}` }]);
            });
            const navRow = [];
            if (curPage > 1) navRow.push({ text: "◀️ Sebelumnya", callback_data: `${detPrefix}${accId}_p${curPage - 1}` });
            if (curPage < totalPages) navRow.push({ text: "Selanjutnya ▶️", callback_data: `${detPrefix}${accId}_p${curPage + 1}` });
            if (navRow.length) buttons.push(navRow);
            buttons.push([{ text: "🔙 Kembali ke Ringkasan", callback_data: `run_check_${accId}` }]);

            return await safeEditMessage(chatId, messageId, detText, { reply_markup: { inline_keyboard: buttons } });
        } catch (err) {
            return await safeEditMessage(chatId, messageId, `❌ <b>Gagal:</b> <code>${err.message}</code>`, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: `run_check_${accId}` }]] }
            });
        }
    }

    if (data.startsWith("vdet_")) {
        const m = data.match(/^vdet_(\d+)_p(\d+)$/);
        if (!m) return await safeAnswerCallback(q.id, { text: "Data tidak valid", show_alert: true });
        const idx = parseInt(m[1]);
        const backPage = parseInt(m[2]);
        const ctx = userState[userId]?.orderDetailCtx;
        if (!ctx || !ctx.map[idx]) return await safeAnswerCallback(q.id, { text: "Sesi habis, buka ulang daftar.", show_alert: true });
        await safeAnswerCallback(q.id, { text: "Mengambil rincian asli Shopee..." });
        const backCb = `${ctx.prefix}${ctx.accId}_p${backPage}`;
        try {
            const acc = await getOwnedAccount(ctx.accId, userId, 'cookie');
            if (!acc) throw new Error("Sesi akun terputus.");
            const entry = ctx.map[idx];
            const orderId = entry.orderId;

            if (ctx.prefix === 'det_unpaid_') {
                await safeEditMessage(chatId, messageId, "🔍 <b>Mengambil nomor Virtual Account...</b>", { reply_markup: { inline_keyboard: [] } });
                const vaRes = await fetchPaymentVA(acc.cookie, orderId);
                const detail = {
                    orderId, shopName: entry.shop || '-', paymentMethod: null,
                    paymentName: vaRes.success ? vaRes.bankName : '-',
                    carrierName: '-', items: entry.listItems || [], finalTotal: entry.listTotal || 0,
                    codAmount: 0, tracking: [], isInstant: false, driver: null, trackingNumber: '',
                    statusHeader: 'Menunggu Pembayaran', noShipInfo: true, maskedType: '',
                    va: vaRes.success ? vaRes.va : null, vaBank: vaRes.bankName, vaCompanyCode: vaRes.companyCode
                };
                ctx.lastDetail = detail;
                const text = renderOrderDetail(detail, ctx.prefix);
                return await safeEditMessage(chatId, messageId, text, {
                    reply_markup: { inline_keyboard: [
                        [{ text: "🔄 Cek Status Pembayaran", callback_data: `${ctx.prefix}${ctx.accId}_p${backPage}` }],
                        [{ text: "🔙 Kembali ke Daftar", callback_data: backCb }]
                    ] }
                });
            }
            const res = await fetchOrderDetail(acc.cookie, orderId);
            if (!res.success) throw new Error(res.msg);
            ctx.lastDetail = res.detail;
            const text = renderOrderDetail(res.detail, ctx.prefix);
            const buttons = [];
            if (ctx.prefix === 'det_unpaid_') buttons.push([{ text: "📊 Cek Status Pembayaran", callback_data: `vdet_${idx}_p${backPage}` }]);
            else if (ctx.prefix === 'det_pack_' || ctx.prefix === 'det_ship_') {
                if (res.detail.isInstant && res.detail.driver?.phone) {
                    const wa = String(res.detail.driver.phone).replace(/^0/, '62').replace(/\D/g, '');
                    buttons.push([{ text: "🛵 Hubungi Driver via WhatsApp", url: `https://wa.me/${wa}` }]);
                }
                if ((res.detail.tracking || []).length > 0) {
                    buttons.push([{ text: "📋 Lihat Log Lengkap", callback_data: `vlog_${idx}_p${backPage}` }]);
                }
                buttons.push([{ text: "🔄 Refresh Status", callback_data: `vdet_${idx}_p${backPage}` }]);
            }
            buttons.push([{ text: "🔙 Kembali ke Daftar", callback_data: backCb }]);
            return await safeEditMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: buttons } });
        } catch (err) {
            return await safeEditMessage(chatId, messageId, `❌ <b>Gagal ambil detail:</b> <code>${err.message}</code>`, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: backCb }]] }
            });
        }
    }

    if (data.startsWith("vlog_")) {
        const m = data.match(/^vlog_(\d+)_p(\d+)$/);
        if (!m) return await safeAnswerCallback(q.id, { text: "Data tidak valid", show_alert: true });
        const idx = parseInt(m[1]);
        const backPage = parseInt(m[2]);
        const ctx = userState[userId]?.orderDetailCtx;
        if (!ctx || !ctx.lastDetail) return await safeAnswerCallback(q.id, { text: "Sesi habis, buka ulang detail.", show_alert: true });
        await safeAnswerCallback(q.id, { text: "Memuat log lengkap..." });
        const d = ctx.lastDetail;
        const isInstant = d.isInstant;
        let t = `📋 <b>LOG PELACAKAN PENUH (${isInstant ? 'INSTANT' : 'REGULER'})</b>\n\n`;
        t += `No. Pesanan: <code>${d.orderId}</code>\n`;
        t += `Kurir: ${d.carrierName}${d.trackingNumber ? ` | No. Resi: ${d.trackingNumber}` : ''}\n`;
        t += `<code>────────────────────────────────────</code>\n\n`;
        const logs = (d.tracking || []);
        if (logs.length === 0) {
            t += `<i>Belum ada riwayat pelacakan.</i>\n`;
        } else {
            logs.forEach(tr => {
                t += `[${TS(tr.time)}] ${isInstant ? '🛵' : '📍'} ${tr.desc}\n\n`;
            });
        }
        t += `<code>────────────────────────────────────</code>`;
        return await safeEditMessage(chatId, messageId, t, {
            reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali ke Rincian", callback_data: `vdet_${idx}_p${backPage}` }]] }
        });
    }

    if (data === "spay_menu" || data.startsWith("spay_acc_") || data.startsWith("spay_claim3k_")) {
        await safeAnswerCallback(q.id, { text: "Segera hadir" });
        let text = `🚧 <b>SHOPEEPAY & KOIN — COMING SOON</b>\n`;
        text += `<code>──────────────────────────</code>\n`;
        text += `Fitur cek saldo ShopeePay, set PIN, dan klaim koin sedang dalam pengembangan.\n\n`;
        text += `<i>🪙 Koin tetap otomatis dipakai saat checkout jika akun punya saldo koin.</i>`;
        return await safeEditMessage(chatId, messageId, text, {
            reply_markup: { inline_keyboard: [[{ text: "🔙 Menu Utama", callback_data: "back_home" }]] }
        });
    }
    if (data === "pick_payment_menu") {
        if (q.id && !String(q.id).startsWith('synthetic')) await safeAnswerCallback(q.id, { text: "Pilih metode pembayaran" });
        const us = userState[userId];
        if (!us || !us.cookie) {
            return await safeEditMessage(chatId, messageId, "⏰ <b>Sesi kedaluwarsa.</b>", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] } });
        }
        if (!us.payment) us.payment = DEFAULT_PAYMENT;

        let text = `💳 <b>PILIH METODE PEMBAYARAN</b>\n`;
        text += `<code>--------------------------</code>\n`;
        text += `🔢 Kuantitas : <b>${us.final_quantity} Pcs</b>\n`;
        text += `💳 Terpilih  : <b>${us.payment.emoji} ${us.payment.name}</b>\n`;
        text += `<code>--------------------------</code>\n`;
        text += `<i>Pilihan metode akan memfilter voucher yang valid.</i>\n`;
        text += `<i>Default: SeaBank.</i>`;

        const buttons = [];
        for (let i = 0; i < PAYMENT_CHANNELS.length; i += 2) {
            const row = [];
            for (let j = i; j < Math.min(i + 2, PAYMENT_CHANNELS.length); j++) {
                const c = PAYMENT_CHANNELS[j];
                const chosen = us.payment.name === c.name;
                row.push({ text: `${chosen ? '✅' : c.emoji} ${c.name}`, callback_data: `set_payment_idx_${j}` });
            }
            buttons.push(row);
        }
        buttons.push([{ text: "🎟️ LANJUT PILIH VOUCHER ▶️", callback_data: "voucher_select" }]);
        buttons.push([{ text: "❌ Batal", callback_data: "back_home" }]);

        return await safeEditMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: buttons } });
    }
    if (data.startsWith("set_payment_idx_")) {
        const idx = parseInt(data.replace("set_payment_idx_", ""));
        const ch = PAYMENT_CHANNELS[idx];
        const us = userState[userId];
        if (!us) return await safeAnswerCallback(q.id, { text: "Sesi kedaluwarsa", show_alert: true });
        if (ch) {
            us.payment = ch;
            us.voucherChannelMap = null;
            us.probeShipping = undefined;
            us.voucherSel = { platform: null, shop: null, fsv: null };
        }
        await safeAnswerCallback(q.id, { text: `Dipilih: ${ch?.name || '-'}` });
        return bot.emit("callback_query", { ...q, data: "pick_payment_menu" });
    }
    if (data === "voucher_select") {
        if (q.id && !String(q.id).startsWith('synthetic')) await safeAnswerCallback(q.id, { text: "Memuat voucher..." });
        const us = userState[userId];
        if (!us || !us.cookie) {
            return await safeEditMessage(chatId, messageId, "⏰ <b>Sesi kedaluwarsa.</b>", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] } });
        }
        if (!us.payment) us.payment = DEFAULT_PAYMENT;

        if (!us.voucherCache) {
            await safeEditMessage(chatId, messageId, "⏳ <b>Memindai voucher akun...</b>", { reply_markup: { inline_keyboard: [] } });
            const vRes = await fetchUserVouchers(us.cookie);
            us.voucherCache = vRes.success ? vRes.vouchers : [];
        }
        if (!us.voucherChannelMap) {
            await safeEditMessage(chatId, messageId, `⏳ <b>Validasi voucher untuk ${us.payment.emoji} ${us.payment.name}...</b>`, { reply_markup: { inline_keyboard: [] } });
            try {
                const probe = await executeShopeeCheckout(us.shopid, us.itemid, us.modelid, us.final_quantity || 1, us.cookie, us.identity, null, true, us.payment, us.useCoins, { cartItems: (us.cart && us.cart.length > 1) ? us.cart : null });
                us.voucherChannelMap = probe.success ? (probe.voucherChannelMap || {}) : {};
                if (!us.courierName && probe.selectedCourierName) us.courierName = probe.selectedCourierName;
                if (probe.success && probe.priceDetail) {
                    us.probeShipping = probe.priceDetail.shippingFee || 0;
                    us.probeMerchandise = probe.priceDetail.merchandise || 0;
                }
            } catch (e) {
                us.voucherChannelMap = {};
            }
        }
        if (us.coinBalance === undefined) {
            try {
                let w = await getShopeeCoinBalance(us.cookie, us.identity);
                if (!w.success && w.antibot) {
                    const wb = await fetchWalletViaBrowser(us.cookie);
                    if (wb.success) w = wb;
                }
                us.coinBalance = w.success ? (w.coinBalance || 0) : null;
            }
            catch (e) { us.coinBalance = null; }
        }
        const vouchers = us.voucherCache;
        const channelMap = us.voucherChannelMap || {};
        const sel = us.voucherSel || { platform: null, shop: null, fsv: null };
        us.voucherSel = sel;

        const isValid = (code) => channelMap[code] !== false;
        const productV = vouchers.filter(v => v.kind !== 'FSV' && isValid(v.code));
        const fsvV = vouchers.filter(v => v.kind === 'FSV' && isValid(v.code));
        const hiddenCount = vouchers.length - productV.length - fsvV.length;

        let text = `🎟️ <b>PILIH VOUCHER</b>\n`;
        text += `<code>──────────────────────────</code>\n`;
        const rpV = (n) => `Rp ${(Math.abs(n || 0) / 100000).toLocaleString('id-ID')}`;
        text += `💳 Pembayaran    : <b>${us.payment.emoji} ${us.payment.name}</b>\n`;
        text += `🪙 Pakai Koin    : <b>${us.useCoins ? 'OTOMATIS (pakai jika ada)' : 'OFF (manual)'}</b>\n`;
        text += `🪙 Saldo Koin    : <b>${us.coinBalance === null || us.coinBalance === undefined ? 'Tidak terdeteksi' : us.coinBalance.toLocaleString('id-ID') + ' Koin'}</b>\n`;
        text += `📦 Kurir         : <b>${us.courierName || 'Default'}</b>\n`;
        text += `🚚 Ongkir Kurir  : <b>${us.probeShipping ? rpV(us.probeShipping) : (us.probeShipping === 0 ? 'GRATIS' : '-')}</b>\n`;
        text += `🛍️ Voucher Produk: <b>${sel.platform ? sel.platform.discountText : (sel.shop ? sel.shop.discountText : 'Belum dipilih')}</b>\n`;
        text += `🚚 Voucher Ongkir: <b>${sel.fsv ? 'Gratis Ongkir' : 'Belum dipilih'}</b>\n`;
        const noteShort = (us.buyerNote || '').substring(0, 30);
        text += `📝 Catatan       : <b>${noteShort ? `"${noteShort}${us.buyerNote.length > 30 ? '...' : ''}"` : 'Tanpa catatan'}</b>\n`;
        text += `<code>──────────────────────────</code>\n`;
        if (hiddenCount > 0) text += `<i>ℹ️ ${hiddenCount} voucher disembunyikan oleh server Shopee (min belanja tak tercapai / tak cocok metode bayar / tak berlaku utk produk ini).</i>\n`;
        text += `<i>Pilih voucher lalu tekan PREVIEW HARGA.</i>`;

        const gated = us.deviceGatedCodes || [];
        const buttons = [];
        productV.slice(0, 10).forEach((v) => {
            const chosen = (sel.platform && sel.platform.code === v.code) || (sel.shop && sel.shop.code === v.code);
            const isGated = gated.includes(v.code);
            const icon = isGated ? '🔒' : (chosen ? '✅' : (v.isMemru ? '🏅' : '🛍️'));
            const memruTag = v.isMemru ? '[MEMRU] ' : '';
            const tag = isGated ? ' [terkunci device]' : '';
            buttons.push([{ text: `${icon} ${memruTag}${v.discountText}${v.minSpend > 0 ? ` (min ${(v.minSpend / 100000).toLocaleString('id-ID')})` : ''}${tag}`, callback_data: `vsel_p_${v.code}` }]);
        });
        fsvV.slice(0, 3).forEach((v) => {
            const chosen = sel.fsv && sel.fsv.code === v.code;
            const memruTag = v.isMemru ? '[MEMRU] ' : '';
            buttons.push([{ text: `${chosen ? '✅' : '🚚'} ${memruTag}Gratis Ongkir (${v.code.substring(0, 16)})`, callback_data: `vsel_f_${v.code}` }]);
        });
        if (productV.length === 0 && fsvV.length === 0) {
            text += `\n\n<i>🎟️ Tidak ada voucher kompatibel untuk metode ini. Lanjut tanpa voucher atau ganti pembayaran.</i>`;
        }
        const coinLabel = (us.coinBalance === null || us.coinBalance === undefined) ? '' : ` (${us.coinBalance.toLocaleString('id-ID')})`;
        buttons.push([{ text: "🔍 AUTO-CHECK SEMUA VOUCHER", callback_data: "voucher_autocheck" }]);
        buttons.push([{ text: "💳 Ubah Pembayaran", callback_data: "pick_payment_menu" }, { text: `🪙 Koin: ${us.useCoins ? 'AUTO' : 'OFF'}${coinLabel}`, callback_data: "toggle_coins" }]);
        buttons.push([{ text: "📦 Pilih Kurir", callback_data: "pick_courier_menu" }, { text: "📝 Catatan Seller", callback_data: "set_note_start" }]);
        buttons.push([{ text: "🧹 Reset Voucher", callback_data: "vsel_reset" }, { text: "💰 PREVIEW HARGA", callback_data: "voucher_preview" }]);
        buttons.push([{ text: "❌ Batalkan", callback_data: "back_home" }]);

        return await safeEditMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: buttons } });
    }
    if (data === "voucher_autocheck") {
        await safeAnswerCallback(q.id, { text: "Cek semua voucher..." });
        const us = userState[userId];
        if (!us || !us.cookie) return await safeEditMessage(chatId, messageId, "⏰ Sesi kedaluwarsa.", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] } });
        const vouchers = us.voucherCache || [];
        if (!vouchers.length) return await safeEditMessage(chatId, messageId, "🎟️ Tak ada voucher untuk dicek.", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "voucher_select" }]] } });

        const cartItems = (us.cart && us.cart.length > 1) ? us.cart : null;
        const valid = [], invalid = [], gated = [];
        if (!us.deviceGatedCodes) us.deviceGatedCodes = [];
        let done = 0;

        await safeEditMessage(chatId, messageId, `🔍 <b>Auto-Check Voucher</b>\n<code>──────────────────────────</code>\nMengecek <b>${vouchers.length}</b> voucher satu per satu...\n<i>Mohon tunggu (~${Math.ceil(vouchers.length * 2)} detik).</i>`, { reply_markup: { inline_keyboard: [] } });

        for (const v of vouchers) {
            const isFsv = v.kind === 'FSV';
            const vsel = { platform: isFsv ? null : { code: v.code, promotionid: v.promotionid, discountText: v.discountText }, shop: null, fsv: isFsv ? { code: v.code, promotionid: v.promotionid } : null };
            try {
                const pr = await executeShopeeCheckout(us.shopid, us.itemid, us.modelid, us.final_quantity || 1, us.cookie, us.identity, vsel, true, us.payment || DEFAULT_PAYMENT, us.useCoins, { note: us.buyerNote, courierMap: us.courierMap, courierId: us.courierId, cartItems, szToken: us.szToken, sapri: us.sapri });
                if (pr.szToken) us.szToken = pr.szToken; if (pr.sapri) us.sapri = pr.sapri;
                const info = (pr.priceDetail?.appliedVoucherInfo || []).find(x => x.code === v.code);
                if (info && info.valid) {
                    valid.push({ code: v.code, disc: v.discountText });
                } else if (info && /perangkat|device|s&k|tidak memenuhi syarat voucher/i.test(info.msg || '')) {
                    gated.push({ code: v.code, disc: v.discountText });
                    if (!us.deviceGatedCodes.includes(v.code)) us.deviceGatedCodes.push(v.code);
                } else {
                    invalid.push({ code: v.code, disc: v.discountText, msg: info?.msg || (pr.disabledReason || 'tak terpakai') });
                }
            } catch (e) {
                invalid.push({ code: v.code, disc: v.discountText, msg: 'error cek' });
            }
            done++;
        }

        let text = `🔍 <b>HASIL AUTO-CHECK (${done}/${vouchers.length})</b>\n<code>──────────────────────────</code>\n`;
        if (valid.length) {
            text += `\n✅ <b>BISA DIPAKAI (${valid.length}):</b>\n`;
            valid.forEach(v => { text += `✅ <code>${v.code}</code> — ${v.disc}\n`; });
        }
        if (gated.length) {
            text += `\n🔒 <b>TERKUNCI DEVICE (${gated.length}):</b>\n`;
            gated.forEach(v => { text += `🔒 <code>${v.code}</code> — ${v.disc}\n`; });
        }
        if (invalid.length) {
            text += `\n❌ <b>TIDAK BISA (${invalid.length}):</b>\n`;
            invalid.slice(0, 10).forEach(v => { text += `❌ <code>${v.code}</code> — ${v.msg}\n`; });
        }
        if (!valid.length && !gated.length && !invalid.length) text += `\n<i>Tak ada hasil.</i>`;
        text += `\n<code>──────────────────────────</code>\n📌 <i>Pilih voucher ✅ di menu, lalu PREVIEW HARGA.</i>`;

        return await safeEditMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: [[{ text: "🎟️ Pilih Voucher", callback_data: "voucher_select" }], [{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] } });
    }
    if (data === "toggle_coins") {
        await safeAnswerCallback(q.id, { text: "Toggle koin" });
        const us = userState[userId];
        if (us) us.useCoins = !us.useCoins;
        return bot.emit("callback_query", { ...q, data: "voucher_select" });
    }
    if (data === "pick_courier_menu") {
        await safeAnswerCallback(q.id, { text: "Memuat kurir..." });
        const us = userState[userId];
        if (!us || !us.cookie) return await safeEditMessage(chatId, messageId, "⏰ Sesi kedaluwarsa.", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] } });
        await safeEditMessage(chatId, messageId, "⏳ <b>Memindai kurir tersedia...</b>", { reply_markup: { inline_keyboard: [] } });
        try {
            const isMulti = us.cart && us.cart.length > 1;
            const pr = await executeShopeeCheckout(us.shopid, us.itemid, us.modelid, us.final_quantity || 1, us.cookie, us.identity, us.voucherSel, true, us.payment, us.useCoins, { note: us.buyerNote, courierMap: us.courierMap, courierMap: us.courierMap, courierId: us.courierId, cartItems: isMulti ? us.cart : null });
            const byShop = pr.couriersByShop || {};
            us.courierNameMap = us.courierNameMap || {};
            us.courierMap = us.courierMap || {};
            Object.values(byShop).flat().forEach(c => { us.courierNameMap[c.id] = courierLabel(c.id, c.name); });
            const rpC = (n) => n > 0 ? `Rp ${(n / 100000).toLocaleString('id-ID')}` : 'GRATIS';
            const shopIds = Object.keys(byShop);

            const shopNameOf = (sid) => {
                if (us.cart && us.cart.length) {
                    const ci = us.cart.find(c => String(c.shopid) === String(sid));
                    if (ci) return ci.shopName;
                }
                return us.shopName || `Toko ${sid}`;
            };

            let text = `📦 <b>PILIH KURIR${isMulti ? ' (PER TOKO)' : ''}</b>\n<code>──────────────────────────</code>\n`;
            const buttons = [];
            if (shopIds.length === 0) {
                text += `<i>Tidak ada opsi kurir terdeteksi. Gunakan default.</i>`;
                buttons.push([{ text: "📦 Default", callback_data: `set_courier_0_0` }]);
            } else {
                shopIds.forEach(sid => {
                    const chosenCid = us.courierMap[sid];
                    text += `🏪 <b>${shopNameOf(sid)}</b>${chosenCid ? ` — ✅ ${courierLabel(chosenCid, us.courierNameMap[chosenCid])}` : ''}\n`;
                    byShop[sid].forEach(c => {
                        const label = courierLabel(c.id, c.name);
                        if (c.enabled === false) { text += `   🔒 <s>${label}</s>\n`; return; }
                        const chosen = String(chosenCid) === String(c.id);
                        const codTag = c.cod ? ' 💵' : '';
                        buttons.push([{ text: `${chosen ? '✅' : '🚚'} ${shopIds.length > 1 ? '[' + shopNameOf(sid).substring(0, 10) + '] ' : ''}${label}${codTag} (${rpC(c.fee)})`, callback_data: `set_courier_${sid}_${c.id}` }]);
                    });
                    text += `<code>──────────────────────────</code>\n`;
                });
                if (isMulti) text += `<i>Pilih kurir untuk masing-masing toko.</i>`;
            }
            buttons.push([{ text: "✅ Selesai / Kembali", callback_data: "voucher_select" }]);
            return await safeEditMessage(chatId, messageId, text, { reply_markup: { inline_keyboard: buttons } });
        } catch (e) {
            return await safeEditMessage(chatId, messageId, `❌ <b>Error:</b> <code>${e.message}</code>`, { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "voucher_select" }]] } });
        }
    }
    if (data.startsWith("set_courier_")) {

        const rest = data.replace("set_courier_", "");
        const parts = rest.split("_");
        const sid = parts[0];
        const cid = parseInt(parts[1] || "0");
        await safeAnswerCallback(q.id, { text: "Kurir dipilih" });
        const us = userState[userId];
        if (us) {
            if (!us.courierMap) us.courierMap = {};
            if (cid) {
                us.courierMap[sid] = cid;
                us.courierId = cid;
                us.courierName = (us.courierNameMap && us.courierNameMap[cid]) || courierLabel(cid);
            } else {
                delete us.courierMap[sid];
                us.courierId = null;
                us.courierName = null;
            }
        }
        return bot.emit("callback_query", { ...q, data: "pick_courier_menu" });
    }
    if (data === "set_note_start") {
        await safeAnswerCallback(q.id);
        const us = userState[userId];
        if (!us) return;
        us.step = "WAIT_BUYER_NOTE";
        us.co_message_id = messageId;
        const sent = await bot.sendMessage(chatId, "📌 <b>Ketik catatan untuk seller</b> (maks 200 karakter).\nKirim <code>-</code> untuk hapus catatan.", { parse_mode: "HTML", reply_markup: { force_reply: true, selective: true } });
        us.note_prompt_id = sent.message_id;
        return;
    }
    if (data.startsWith("vsel_")) {
        await safeAnswerCallback(q.id, { text: "Dipilih" });
        const us = userState[userId];
        if (!us) return;
        const sel = us.voucherSel || { platform: null, shop: null, fsv: null };
        if (data === "vsel_reset") {
            us.voucherSel = { platform: null, shop: null, fsv: null };
        } else if (data.startsWith("vsel_p_")) {
            const code = data.replace("vsel_p_", "");
            const v = (us.voucherCache || []).find(x => x.code === code);
            if (v) {
                const already = (sel.platform && sel.platform.code === code) || (sel.shop && sel.shop.code === code);
                sel.platform = null; sel.shop = null;
                if (!already) { if (v.isShop) sel.shop = v; else sel.platform = v; }
            }
        } else if (data.startsWith("vsel_f_")) {
            const code = data.replace("vsel_f_", "");
            const v = (us.voucherCache || []).find(x => x.code === code);
            if (v) sel.fsv = (sel.fsv && sel.fsv.code === code) ? null : v;
        }
        us.voucherSel = sel;
        return bot.emit("callback_query", { ...q, data: "voucher_select" });
    }
    if (data === "voucher_preview") {
        await safeAnswerCallback(q.id, { text: "Menghitung harga..." });
        const us = userState[userId];
        if (!us || !us.cookie) return await safeEditMessage(chatId, messageId, "⏰ Sesi kedaluwarsa.", { reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] } });
        await safeEditMessage(chatId, messageId, "🧮 <b>Menghitung harga via Shopee (checkout/get)...</b>", { reply_markup: { inline_keyboard: [] } });
        try {
            const pr = await executeShopeeCheckout(us.shopid, us.itemid, us.modelid, us.final_quantity || 1, us.cookie, us.identity, us.voucherSel, true, us.payment || DEFAULT_PAYMENT, us.useCoins, { note: us.buyerNote, courierMap: us.courierMap, courierId: us.courierId, cartItems: (us.cart && us.cart.length > 1) ? us.cart : null, szToken: us.szToken, sapri: us.sapri });
            if (pr.szToken) us.szToken = pr.szToken; if (pr.sapri) us.sapri = pr.sapri;
            if (!us.courierName && pr.selectedCourierName) us.courierName = pr.selectedCourierName; // pakai nama kurir default Shopee
            if (!pr.success) {
                return await safeEditMessage(chatId, messageId, `❌ <b>Gagal Hitung Harga:</b> <code>${pr.msg}</code>`, {
                    reply_markup: { inline_keyboard: [[{ text: "🎟️ Pilih Voucher Lagi", callback_data: "voucher_select" }]] }
                });
            }
            const d = pr.priceDetail;
            const rp = (n) => `Rp ${(Math.abs(n) / 100000).toLocaleString('id-ID')}`;

            if (us.coinBalance === undefined) {
                try {
                    let w = await getShopeeCoinBalance(us.cookie, us.identity);
                    if (!w.success && w.antibot) {
                        const wb = await fetchWalletViaBrowser(us.cookie);
                        if (wb.success) w = wb;
                    }
                    us.coinBalance = w.success ? (w.coinBalance || 0) : null;
                }
                catch (e) { us.coinBalance = null; }
            }

            const totalDiscount = (d.voucherDiscount || 0) + (d.shippingDiscount || 0);
            const totalBeforeVoucher = (d.merchandise || 0) + (d.shippingFee || 0) + (d.insurance || 0);
            const totalAfterVoucher = totalBeforeVoucher - totalDiscount;

            const isMulti = us.cart && us.cart.length > 1;
            let text = `📝 <b>RINGKASAN AKHIR CHECKOUT (${isMulti ? 'MULTI-ORDER' : 'SINGLE ORDER'})</b>\n`;
            text += `<code>--------------------------</code>\n`;
            const cMap = us.courierMap || {};
            const cNames = us.courierNameMap || {};
            if (isMulti) {
                us.cart.forEach((c, i) => {
                    const kc = cMap[c.shopid];
                    text += `🏪 <b>TOKO ${i + 1}:</b> ${c.shopName}\n`;
                    text += `└─ 🔹 ${c.productName.substring(0, 32)}${c.variationName ? ` (${c.variationName})` : ''} | ${c.quantity} pcs\n`;
                    text += `└─ 🚚 Kurir: <b>${kc ? courierLabel(kc, cNames[kc]) : 'Default'}</b>\n`;
                });
                text += `<code>--------------------------</code>\n`;
            }
            text += `💳 Pembayaran      : <b>${(us.payment || DEFAULT_PAYMENT).emoji} ${(us.payment || DEFAULT_PAYMENT).name}</b>\n`;
            if (!isMulti) text += `📦 Kurir           : <b>${us.courierName || 'Default'}</b>\n`;
            text += `🚚 Ongkir Kurir    : <b>${d.shippingFee ? rp(d.shippingFee) : 'GRATIS'}</b>\n`;
            if (us.buyerNote) text += `📝 Catatan         : <i>"${us.buyerNote.substring(0, 40)}"</i>\n`;
            text += `🪙 Saldo Koin Akun : <b>${us.coinBalance === null ? 'Tidak terdeteksi' : us.coinBalance.toLocaleString('id-ID') + ' Koin'}</b>\n`;
            text += `<code>--------------------------</code>\n`;
            text += `🛍️ Subtotal Produk : ${rp(d.merchandise)}\n`;
            if (d.shippingFee) text += `🚚 Ongkir          : ${rp(d.shippingFee)}\n`;
            if (d.insurance) text += `🛡️ Asuransi        : ${rp(d.insurance)}\n`;
            text += `🎟️ Total Sblm Voucher: <b>${rp(totalBeforeVoucher)}</b>\n`;
            if (d.shippingDiscount) text += `🚚 Diskon Ongkir   : -${rp(d.shippingDiscount)}\n`;
            if (d.voucherDiscount) text += `🎟️ Diskon Voucher  : -${rp(d.voucherDiscount)}\n`;
            if (totalDiscount) text += `🎟️ Total Stlh Voucher: <b>${rp(totalAfterVoucher)}</b>\n`;
            if (d.coinOffset) text += `🪙 Potongan Koin   : -${rp(d.coinOffset)}\n`;
            else if (us.useCoins) text += `🪙 Koin            : <i>Otomatis (tak ada koin terpakai)</i>\n`;
            text += `<code>──────────────────────────</code>\n`;
            text += `💳 <b>TOTAL BAYAR    : ${rp(d.totalPayment)}</b>\n`;
            if (d.totalSavings) text += `📌 <i>Total Hemat   : ${rp(d.totalSavings)}</i>\n`;
            text += `<code>--------------------------</code>\n`;
            let hasDeviceGated = false;
            if (!us.deviceGatedCodes) us.deviceGatedCodes = [];
            if (d.appliedVoucherInfo.length > 0) {
                text += `\n<b>Status Voucher:</b>\n`;
                d.appliedVoucherInfo.forEach(v => {
                    const isDeviceGated = !v.valid && /perangkat|device|s&k|tidak memenuhi syarat voucher/i.test(v.msg || '');
                    if (isDeviceGated) {
                        hasDeviceGated = true;
                        if (!us.deviceGatedCodes.includes(v.code)) us.deviceGatedCodes.push(v.code);
                        text += `🔒 <code>${v.code}</code> — terkunci device (new-user)\n`;
                    } else {
                        text += `${v.valid ? '✅' : '❌'} <code>${v.code}</code>${v.valid ? '' : ` — ${v.msg || 'tidak valid'}`}\n`;
                    }
                });
            }
            if (hasDeviceGated) {
                text += `\n⚠️ <i>Voucher 🔒 terkunci ke HP asli pemilik akun (anti-fraud Shopee). Bot pakai sesi web, tak bisa lolos. Gunakan voucher lain (NU1DC / FSV / NU5NBEP dll).</i>\n`;
            }
            text += `\n📌 <i>Tombol di bawah membuat PESANAN NYATA (belum bayar).</i>`;

            return await safeEditMessage(chatId, messageId, text, {
                reply_markup: { inline_keyboard: [
                    [{ text: "🔥 PLACE ORDER SEKARANG", callback_data: "execute_sniper_now" }],
                    [{ text: "🎟️ Ubah Voucher", callback_data: "voucher_select" }, { text: "❌ Batal", callback_data: "back_home" }]
                ] }
            });
        } catch (e) {
            return await safeEditMessage(chatId, messageId, `❌ <b>Error:</b> <code>${e.message}</code>`, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "voucher_select" }]] }
            });
        }
    }
    if (data === "execute_sniper_now") {
        await safeAnswerCallback(q.id, { text: "Menembakkan checkout..." });
        const userSession = userState[userId];
        if (!userSession || !userSession.cookie) {
            return await safeEditMessage(chatId, messageId, "⏰ <b>Sesi telah kedaluwarsa.</b> Silakan ulangi dari awal.", {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Kembali", callback_data: "memru_order_start" }]] }
            });
        }
        await safeEditMessage(chatId, messageId, "🛒 <b>Eksekusi Checkout & Place Order ke server Shopee...</b>", { reply_markup: { inline_keyboard: [] } });
        try {
            const voucherOpts = userSession.voucherSel || null;
            if (voucherOpts) {
                const applied = [voucherOpts.platform, voucherOpts.shop, voucherOpts.fsv].filter(Boolean).map(v => v.code);
                logger.engine("VOUCHER_APPLY", `User-selected: ${applied.join(', ') || 'none'}`, "INFO");
            }

            const coRes = await executeShopeeCheckout(
                userSession.shopid,
                userSession.itemid,
                userSession.modelid,
                userSession.final_quantity || 1,
                userSession.cookie,
                userSession.identity,
                voucherOpts,
                false,
                userSession.payment || DEFAULT_PAYMENT,
                userSession.useCoins,
                { note: userSession.buyerNote, courierMap: userSession.courierMap, courierId: userSession.courierId, cartItems: (userSession.cart && userSession.cart.length > 1) ? userSession.cart : null, szToken: userSession.szToken, sapri: userSession.sapri }
            );

            if (coRes.success) {

                const vSel = userSession.voucherSel || {};
                const vList = [vSel.platform, vSel.shop, vSel.fsv].filter(Boolean)
                    .map(v => `${v.code}(${v.discountText || v.kind || '-'})`).join(', ') || 'tanpa voucher';
                const cartLog = (userSession.cart && userSession.cart.length)
                    ? userSession.cart.map(c => `${c.itemid}/${c.modelid}x${c.quantity}`).join(' | ')
                    : `${userSession.shopid}/${userSession.itemid}/${userSession.modelid}x${userSession.final_quantity || 1}`;
                const payName = (userSession.payment || DEFAULT_PAYMENT).name;
                const totalLog = coRes.totalPayment ? (coRes.totalPayment / 100000) : 0;
                logger.info(userId, "ORDER_SUCCESS",
                    `OrderID=${coRes.orderId} | akun=${userSession.shopName || '-'} | bayar=${payName} | kurir=${userSession.courierName || 'Default'} | total=Rp${totalLog.toLocaleString('id-ID')} | koin=${userSession.useCoins ? 'ON' : 'OFF'} | voucher=[${vList}] | item=[${cartLog}]${userSession.buyerNote ? ' | note="' + userSession.buyerNote.substring(0, 40) + '"' : ''}`);

                try {
                    const vSelDb = userSession.voucherSel || {};
                    const voucherCodeDb = (vSelDb.platform && vSelDb.platform.code) || (vSelDb.shop && vSelDb.shop.code) || null;
                    const fsvCodeDb = (vSelDb.fsv && vSelDb.fsv.code) || null;
                    const itemsDb = (userSession.cart && userSession.cart.length)
                        ? userSession.cart.map(c => ({ itemid: c.itemid, modelid: c.modelid, qty: c.quantity, name: c.productName || null }))
                        : [{ itemid: userSession.itemid, modelid: userSession.modelid, qty: userSession.final_quantity || 1, name: userSession.productName || null }];
                    saveOrderRecord({
                        order_id: String(coRes.orderId || ''),
                        checkout_id: String(coRes.checkoutId || ''),
                        telegram_id: String(userId),
                        account_name: userSession.shopName || null,
                        total: Math.round((coRes.totalPayment || 0) / 100000),
                        payment: payName,
                        courier: userSession.courierName || 'Default',
                        voucher_code: voucherCodeDb,
                        fsv_code: fsvCodeDb,
                        coin_used: Math.round((coRes.coinOffset || 0) / 100000),
                        items: itemsDb,
                        note: userSession.buyerNote || null,
                        created_at: new Date().toISOString()
                    });
                } catch (e) {
                    logger.engine("ORDER_SAVE", `Gagal simpan pesanan: ${e.message}`, "ERR");
                }

                delete userState[userId];
                const totalRp = coRes.totalPayment ? `Rp ${(coRes.totalPayment / 100000).toLocaleString('id-ID')}` : "-";
                const cartArr = (userSession.cart && userSession.cart.length) ? userSession.cart : null;
                const payObj = userSession.payment || DEFAULT_PAYMENT;
                const isCOD = payObj.id === 89000 || /cod/i.test(payObj.name);

                const vWin = userSession.voucherSel || {};
                const voucherCode = (vWin.platform && vWin.platform.code) || (vWin.shop && vWin.shop.code) || '-';
                const fsvCode = (vWin.fsv && vWin.fsv.code) || '-';
                const coinUsed = coRes.coinOffset ? `Rp ${(coRes.coinOffset / 100000).toLocaleString('id-ID')}` : 'Rp 0';

                let vaLine = '';
                if (isCOD) {
                    vaLine = `🏦 <b>VA        :</b> COD aja (tanpa VA)\n`;
                } else {
                    try {
                        const vaRes = await fetchPaymentVA(userSession.cookie, coRes.checkoutId);
                        if (vaRes.success && vaRes.va) {
                            vaLine = `🏦 <b>VA (${vaRes.bankName}):</b> <code>${vaRes.va}</code>\n`;
                        } else {
                            vaLine = `🏦 <b>VA        :</b> <i>Buka app Shopee untuk kode bayar</i>\n`;
                        }
                    } catch (e) { vaLine = `🏦 <b>VA        :</b> <i>Buka app Shopee untuk kode bayar</i>\n`; }
                }

                let winMsg = `🎉 <b>Pesanan berhasil dibuat!</b> 🎉\n`;
                winMsg += `<code>──────────────────────────</code>\n`;
                winMsg += `💰 <b>Total     :</b> <b>${totalRp}</b>\n`;
                winMsg += `💳 <b>Pembayaran:</b> <b>${payObj.emoji} ${payObj.name}</b>\n`;
                winMsg += `🚚 <b>Kurir     :</b> <b>${userSession.courierName || 'Default'}</b>\n`;
                winMsg += `🪙 <b>Koin      :</b> ${coinUsed}\n`;
                winMsg += `🎫 <b>Voucher   :</b> <code>${voucherCode}</code>\n`;
                winMsg += `🚚 <b>FSV       :</b> <code>${fsvCode}</code>\n`;
                winMsg += `📋 <b>Checkout ID:</b> <code>${coRes.checkoutId}</code>\n`;
                winMsg += vaLine;
                winMsg += `<code>──────────────────────────</code>\n`;
                if (cartArr) {
                    cartArr.forEach(c => { winMsg += `${c.productName.substring(0, 35)}${c.variationName ? ` (${c.variationName})` : ''}\n   ×${c.quantity}\n`; });
                } else {
                    winMsg += `${userSession.productName ? userSession.productName.substring(0, 35) : 'Produk'}${userSession.variationName ? ` (${userSession.variationName})` : ''}\n   ×${userSession.final_quantity}\n`;
                }
                winMsg += `<code>──────────────────────────</code>\n`;
                winMsg += `⚠️ <i>Status BELUM BAYAR. Selesaikan pembayaran${isCOD ? ' (COD bayar saat barang tiba)' : ' via VA/app Shopee'} sebelum kedaluwarsa!</i>`;
                return await safeEditMessage(chatId, messageId, winMsg, {
                    reply_markup: { inline_keyboard: [[{ text: "📋 Cek Pesanan", callback_data: "memru_check_start" }, { text: "🏠 Menu Utama", callback_data: "back_home" }]] }
                });
            }

            delete userState[userId];
            let failMsg = `⚡ <b>Checkout Gagal!</b>\n`;
            failMsg += `<code>--------------------------</code>\n`;
            failMsg += `<b>Tahap    :</b> <code>${coRes.stage || '-'}</code>\n`;
            failMsg += `<b>Penyebab :</b> <code>${coRes.msg}</code>\n`;
            failMsg += `<code>--------------------------</code>`;
            return await safeEditMessage(chatId, messageId, failMsg, {
                reply_markup: { inline_keyboard: [[{ text: "🔄 Coba Lagi", callback_data: "memru_order_start" }, { text: "🏠 Menu Utama", callback_data: "back_home" }]] }
            });
        } catch (err) {
            delete userState[userId];
            logger.engine("SNIPER_FAIL", err.message, "ERR");
            let failMsg = `⚡ <b>Checkout Error:</b> <code>${err.message}</code>`;
            return await safeEditMessage(chatId, messageId, failMsg, {
                reply_markup: { inline_keyboard: [[{ text: "🔄 Coba Lagi", callback_data: "memru_order_start" }, { text: "🏠 Menu Utama", callback_data: "back_home" }]] }
            });
        }
    }
});

(() => {
    console.clear();
    console.log("\x1b[35m%s\x1b[0m", "+----------------------------------------------------+");
    console.log("\x1b[35m%s\x1b[0m", "|          PAIZU AUTO CO MEMRU GATEWAY V5            |");
    console.log("\x1b[35m%s\x1b[0m", "|          UI INTERFACE & SYSTEM ROUTER READY        |");
    console.log("\x1b[35m%s\x1b[0m", "+----------------------------------------------------+");
    console.log("\x1b[32m%s\x1b[0m", ` [+] UI Router : Online & Safe Flow Connected`);
    console.log("\x1b[32m%s\x1b[0m", ` [+] Anti-Limit: Burst Rate Filter Standard Active`);
    console.log("\x1b[35m%s\x1b[0m", "------------------------------------------------------");
})();
const express = require('express');
const app = express();
app.use(express.json());

// Mengubah fungsi agar menerima parameter data payload opsional dari webhook
async function creditPremiumFromOrder(orderId, source = 'webhook', webhookPayload = null) {
    const { data: txCheck, error: txErr } = await supabase
        .from('transactions')
        .select('user_id, message_id, chat_id, amount, duration_days, status')
        .eq('order_id', orderId)
        .maybeSingle();

    if (txErr || !txCheck) return { status: 'ignored', msg: 'Order tak ditemukan.' };
    if (String(txCheck.status).toUpperCase() === 'SUCCESS') return { status: 'ok', msg: 'Sudah diproses.' };

    const userIdTelegram = Number(txCheck.user_id);
    if (!userIdTelegram || isNaN(userIdTelegram)) return { status: 'error', msg: 'Owner invalid.' };

    const expectedAmount = parseInt(txCheck.amount || 0);
    let verified = null;

    // ⚡️ OPTIMASI UTAMA: Jika dipicu oleh Webhook dan payload sudah membawa data sukses, gunakan langsung!
    if (source === 'webhook' && webhookPayload) {
        verified = webhookPayload;
    } else {
        // Jika dipicu oleh CRON / RECONCILE, baru tembak API Pakasir untuk cek status terbaru
        try {
            const vr = await axios.get('https://app.pakasir.com/api/transactiondetail', {
                params: { project: PAKASIR_SLUG, amount: expectedAmount, order_id: orderId, api_key: PAKASIR_API_KEY },
                timeout: 12000
            });
            verified = vr.data?.transaction || vr.data?.data || vr.data;
        } catch (ve) {
            return { status: 'pending', msg: 'Verifikasi gateway gagal.' };
        }
    }

    const verifiedStatus = String(verified?.status || '').toUpperCase();
    const verifiedAmount = parseInt(verified?.amount || 0);

    if (verifiedStatus !== 'SUCCESS' && verifiedStatus !== 'COMPLETED' && verifiedStatus !== 'SETTLED') {
        return { status: 'ignored', msg: 'Belum lunas.' };
    }
    const feeDiff = expectedAmount - verifiedAmount;
    if (feeDiff < 0 || feeDiff > 1000) {
        bot.sendMessage(ADMIN_ID, `⚠️ <b>AMOUNT MISMATCH</b> [${source}]\nOrder: <code>${orderId}</code>\nUser: <code>${userIdTelegram}</code>\nDibayar: Rp ${verifiedAmount.toLocaleString('id-ID')}\nSeharusnya: Rp ${expectedAmount.toLocaleString('id-ID')}`, { parse_mode: 'HTML' }).catch(() => {});
        return { status: 'error', msg: 'Amount tidak cocok.' };
    }

const amountPaid = expectedAmount;
let addedDays = parseInt(txCheck.duration_days || 0);

if (!addedDays) {
    // Toleransi pembayaran untuk Paket 1 Hari (21.500)
    if (amountPaid >= 20000 && amountPaid <= 23500) {
        addedDays = 1;
    } 
    // Toleransi pembayaran untuk Paket 3 Hari (59.000)
    else if (amountPaid >= 57000 && amountPaid <= 61000) {
        addedDays = 3;
    }
}

if (!addedDays) return { status: 'error', msg: 'Nominal paket salah.' };

    let finalExpiredDate = new Date();
    try {
        const { data: cur } = await supabase.from('profiles').select('expired_at').eq('id', userIdTelegram).maybeSingle();
        if (cur && cur.expired_at) {
            const old = new Date(cur.expired_at);
            if (old > new Date()) finalExpiredDate = old;
        }
    } catch (e) {}
    finalExpiredDate.setDate(finalExpiredDate.getDate() + addedDays);

    const { error: upsertProfileErr } = await supabase
        .from('profiles')
        .upsert({ id: userIdTelegram, expired_at: finalExpiredDate.toISOString() }, { onConflict: 'id' });
    if (upsertProfileErr) return { status: 'error', msg: upsertProfileErr.message };
    
    // Pastikan fungsi ini tersedia di bot Anda, jika tidak ada hapus/comment baris ini
    if (typeof invalidateLicenseCache === 'function') {
        invalidateLicenseCache(userIdTelegram);
    }

    await supabase.from('transactions')
        .upsert({ order_id: orderId, user_id: userIdTelegram, amount: amountPaid, duration_days: addedDays, status: 'SUCCESS' }, { onConflict: 'order_id' });

    logger.db("UPSERT", "transactions", `SUCCESS [${source}]: ${orderId}`);

    const expiredStringWIB = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(finalExpiredDate);
    let winPayMsg = `💳 <b>PEMBAYARAN QRIS TERVERIFIKASI LUNAS!</b> ✅\n`;
    winPayMsg += `<code>--------------------------</code>\n`;
    winPayMsg += `🆔 <b>Order ID   :</b> <code>${orderId}</code>\n`;
    winPayMsg += `💳 <b>Total Bayar :</b> Rp ${amountPaid.toLocaleString('id-ID')}\n`;
    winPayMsg += `🎟️ <b>License    :</b> <b>${addedDays} Hari Premium Access Active</b>\n`;
    winPayMsg += `⏰ <b>Masa Expire:</b> <code>${expiredStringWIB} WIB</code>\n`;
    winPayMsg += `<code>--------------------------</code>\n\n`;
    winPayMsg += `📌 <i>Akses premium Anda telah aktif. Ketik /start untuk muat ulang dashboard!</i>`;

    if (txCheck.message_id && txCheck.chat_id) {
        await bot.deleteMessage(txCheck.chat_id, txCheck.message_id).catch(() => {});
        await bot.sendMessage(txCheck.chat_id, winPayMsg, { parse_mode: 'HTML' }).catch(() => {});
    } else {
        await bot.sendMessage(userIdTelegram, winPayMsg, { parse_mode: 'HTML' }).catch(() => {});
    }
    return { status: 'success', msg: 'Premium aktif.' };
}

// Route Webhook yang disesuaikan
app.post('/webhook/pakasir-pay', async (req, res) => {
    try {
        const payload = req.body;
        const orderId = payload.order_id || payload.payment?.order_id || payload.data?.order_id || "UNKNOWN";
        
        // Meneruskan payload ke fungsi utama agar tidak perlu melakukan hit HTTP API ulang
        const r = await creditPremiumFromOrder(orderId, 'webhook', payload);
        
        return res.status(200).json({ status: r.status, message: r.msg });
    } catch (err) {
        logger.engine("EXPRESS", `Crash Webhook: ${err.message}`, "ERR");
        return res.status(500).json({ status: "error", message: "Internal error." });
    }
});

async function reconcilePendingPayments() {
    try {
        const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: pending } = await supabase
            .from('transactions')
            .select('order_id, created_at, status')
            .neq('status', 'SUCCESS')
            .gte('created_at', cutoff)
            .limit(30);
        if (!pending || !pending.length) return;
        let fixed = 0;
        for (const tx of pending) {
            const r = await creditPremiumFromOrder(tx.order_id, 'cron');
            if (r.status === 'success') fixed++;
            await new Promise(rs => setTimeout(rs, 500));
        }
        if (fixed > 0) logger.engine("RECONCILE", `${fixed} pembayaran tertunda berhasil dikredit ulang.`, "SUCCESS");
    } catch (e) {
        logger.engine("RECONCILE", `Gagal: ${e.message}`, "WARN");
    }
}
setInterval(reconcilePendingPayments, 3 * 60 * 1000);

const PORT = parseInt(process.env.PORT || "6969");
app.listen(PORT, '0.0.0.0', () => {
    logger.engine("SYSTEM", `Express Server Aktif Murni Terkunci Di Port ${PORT}`, "SUCCESS");
});

