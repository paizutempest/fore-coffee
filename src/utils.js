import dayjs from "dayjs";
import chalk from "chalk";

export const getRandomNumber = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const log = {
  info: (msg) =>
    console.log(`${chalk.blue("ℹ")} [${dayjs().format("HH:mm:ss")}] ${msg}`),
  success: (msg) =>
    console.log(
      `${chalk.green("✔")} [${dayjs().format("HH:mm:ss")}] ${msg}`
    ),
  warn: (msg) =>
    console.log(
      `${chalk.yellow("⚠")} [${dayjs().format("HH:mm:ss")}] ${msg}`
    ),
  error: (msg) =>
    console.log(`${chalk.red("✖")} [${dayjs().format("HH:mm:ss")}] ${msg}`),
  process: (msg) =>
    console.log(
      `${chalk.magenta("⚙")} [${dayjs().format("HH:mm:ss")}] ${chalk.italic(msg)}...`
    ),
};

export const getHeaders = (deviceId, accessToken = null) => {
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
