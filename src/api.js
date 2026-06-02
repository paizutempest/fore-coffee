import fetch from "node-fetch";
import dayjs from "dayjs";
import { getHeaders, log } from "./utils.js";

export const getToken = async (deviceId) => {
  const res = await fetch("https://api.fore.coffee/auth/get-token", {
    headers: getHeaders(deviceId),
  });
  return res.json();
};

export const checkPhone = async (deviceId, token, phone) => {
  const res = await fetch("https://api.fore.coffee/auth/check-phone", {
    method: "POST",
    headers: getHeaders(deviceId, token),
    body: JSON.stringify({ phone: `+${phone}` }),
  });
  return res.json();
};

export const reqLogin = async (deviceId, token, phone) => {
  const res = await fetch("https://api.fore.coffee/auth/req-login-code", {
    method: "POST",
    headers: getHeaders(deviceId, token),
    body: JSON.stringify({ method: "", phone: `+${phone}` }),
  });
  return res.json();
};

export const signUp = async (deviceId, token, phone, name, otp, referral) => {
  const res = await fetch("https://api.fore.coffee/auth/sign-up", {
    method: "POST",
    headers: getHeaders(deviceId, token),
    body: JSON.stringify({
      whatsapp: 0,
      phone: `+${phone}`,
      name: name,
      code: otp,
      referral_code: referral,
    }),
  });
  return res.json();
};

export const addPin = async (deviceId, token, pin) => {
  const res = await fetch("https://api.fore.coffee/auth/pin", {
    method: "POST",
    headers: getHeaders(deviceId, token),
    body: JSON.stringify({ confirm_pin: pin, pin: pin }),
  });
  return res.json();
};

export const updateProfile = async (deviceId, token, name, email, birthday) => {
  const res = await fetch("https://api.fore.coffee/user/profile", {
    method: "PUT",
    headers: getHeaders(deviceId, token),
    body: JSON.stringify({
      user_name: name,
      user_email: email,
      user_birthday: birthday,
    }),
  });
  return res.json();
};

export const profileDetail = async (deviceId, token) => {
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD 00:00:00");
  const encodedDate = encodeURIComponent(yesterday);
  const url = `https://api.fore.coffee/user/profile/detail?last_seen=${encodedDate}`;

  log.process(`Sync Profile Data - Last Seen: ${yesterday}`);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: getHeaders(deviceId, token),
    });

    const response = await res.json();

    if (response.payload) {
      log.success(
        `Data Berhasil Sinkron! User: ${response.payload.user_name} | Point: ${response.payload.user_point}`
      );
    } else {
      log.warn(
        `Respon Fore: ${response.message || "Data profile tidak ditemukan"}`
      );
    }

    return response;
  } catch (error) {
    log.error(`Gagal Fetch Profile: ${error.message}`);
    return null;
  }
};

export const fetchRandomUser = async () => {
  const res = await fetch("https://randomuser.me/api?nat=id");
  const data = await res.json();
  return data.results[0];
};
