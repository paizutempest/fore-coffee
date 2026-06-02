import fetch from "node-fetch";
import chalk from "chalk";
import dayjs from "dayjs";
import log from "./logger.js";

const buildHeaders = (deviceId, accessToken = null) => {
  const headers = {
    Host: "api.fore.coffee",
    "Content-Type": "application/json",
    Accept: "*/*",
    "App-Version": process.env.FORE_VERSION,
    "Device-Id": deviceId,
    Platform: "android",
    "User-Agent": "okhttp/4.11.0",
    "Os-Version": "13",
    "Accept-Language": "id-ID;q=1.0, en-ID;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
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

const apiRequest = async (
  url,
  { deviceId, accessToken = null, method = "GET", body = null } = {}
) => {
  const options = {
    method,
    headers: buildHeaders(deviceId, accessToken),
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, options);
    return res.json();
  } catch (error) {
    log.error(`API request failed [${method} ${url}]: ${error.message}`);
    return null;
  }
};

export const formatPhone = (phone) => `+${phone}`;

export const getToken = (deviceId) =>
  apiRequest("https://api.fore.coffee/auth/get-token", { deviceId });

export const checkPhone = (deviceId, token, phone) =>
  apiRequest("https://api.fore.coffee/auth/check-phone", {
    deviceId,
    accessToken: token,
    method: "POST",
    body: { phone: formatPhone(phone) },
  });

export const reqLogin = (deviceId, token, phone) =>
  apiRequest("https://api.fore.coffee/auth/req-login-code", {
    deviceId,
    accessToken: token,
    method: "POST",
    body: { method: "", phone: formatPhone(phone) },
  });

export const signUp = (deviceId, token, phone, name, otp, referral) =>
  apiRequest("https://api.fore.coffee/auth/sign-up", {
    deviceId,
    accessToken: token,
    method: "POST",
    body: {
      whatsapp: 0,
      phone: formatPhone(phone),
      name,
      code: otp,
      referral_code: referral,
    },
  });

export const addPin = (deviceId, token, pin) =>
  apiRequest("https://api.fore.coffee/auth/pin", {
    deviceId,
    accessToken: token,
    method: "POST",
    body: { confirm_pin: pin, pin },
  });

export const updateProfile = (deviceId, token, name, email, birthday) =>
  apiRequest("https://api.fore.coffee/user/profile", {
    deviceId,
    accessToken: token,
    method: "PUT",
    body: { user_name: name, user_email: email, user_birthday: birthday },
  });

export const profileDetail = async (deviceId, token) => {
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD 00:00:00");
  const encodedDate = encodeURIComponent(yesterday);
  const url = `https://api.fore.coffee/user/profile/detail?last_seen=${encodedDate}`;

  log.process(`Sync Profile Data - Last Seen: ${yesterday}`);

  const response = await apiRequest(url, { deviceId, accessToken: token });

  if (!response) return null;

  if (response.payload) {
    log.success(
      `Data Berhasil Sinkron! User: ${chalk.cyan(response.payload.user_name)} | Point: ${chalk.yellow(response.payload.user_point)}`
    );
  } else {
    log.warn(
      `Respon Fore: ${response.message || "Data profile tidak ditemukan"}`
    );
  }

  return response;
};
