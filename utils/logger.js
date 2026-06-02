import chalk from "chalk";
import dayjs from "dayjs";

const timestamp = () => dayjs().format("HH:mm:ss");

const log = {
  info: (msg) => console.log(`${chalk.blue("\u2139")} [${timestamp()}] ${msg}`),
  success: (msg) =>
    console.log(`${chalk.green("\u2714")} [${timestamp()}] ${msg}`),
  warn: (msg) =>
    console.log(`${chalk.yellow("\u26A0")} [${timestamp()}] ${msg}`),
  error: (msg) =>
    console.log(`${chalk.red("\u2716")} [${timestamp()}] ${msg}`),
  process: (msg) =>
    console.log(
      `${chalk.magenta("\u2699")} [${timestamp()}] ${chalk.italic(msg)}...`
    ),
};

export default log;
