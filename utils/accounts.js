import fs from "fs";

const ACCOUNTS_FILE = "accounts.json";

export const loadAccounts = () => {
  if (!fs.existsSync(ACCOUNTS_FILE)) return null;
  return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
};

export const saveAccount = (account) => {
  const accounts = loadAccounts() || [];
  accounts.push(account);
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
};
