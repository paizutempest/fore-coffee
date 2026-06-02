import fs from "fs";
import { table } from "table";

const ACCOUNTS_FILE = "accounts.json";

export const loadAccounts = (filePath = ACCOUNTS_FILE) => {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

export const saveAccount = (account, filePath = ACCOUNTS_FILE) => {
  let accounts = [];
  if (fs.existsSync(filePath)) {
    accounts = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
  accounts.push(account);
  fs.writeFileSync(filePath, JSON.stringify(accounts, null, 2));
  return accounts;
};

export const formatAccountsTable = (accounts) => {
  const data = accounts.map((a) => [a.phone, a.name, a.email, a.point || 0]);
  return table([["Phone", "Name", "Email", "Points"], ...data]);
};
