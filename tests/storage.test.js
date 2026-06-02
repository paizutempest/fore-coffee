import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import { loadAccounts, saveAccount, formatAccountsTable } from "../src/storage.js";

vi.mock("fs");

describe("loadAccounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when file does not exist", () => {
    fs.existsSync.mockReturnValue(false);

    const result = loadAccounts("accounts.json");

    expect(result).toBeNull();
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it("returns parsed JSON when file exists", () => {
    const accounts = [{ phone: "628111", name: "Alice" }];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(accounts));

    const result = loadAccounts("accounts.json");

    expect(result).toEqual(accounts);
    expect(fs.readFileSync).toHaveBeenCalledWith("accounts.json", "utf8");
  });

  it("uses default file path", () => {
    fs.existsSync.mockReturnValue(false);
    loadAccounts();
    expect(fs.existsSync).toHaveBeenCalledWith("accounts.json");
  });
});

describe("saveAccount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates new file when it doesn't exist", () => {
    fs.existsSync.mockReturnValue(false);
    fs.writeFileSync.mockImplementation(() => {});

    const account = { phone: "628222", name: "Bob" };
    const result = saveAccount(account, "accounts.json");

    expect(result).toEqual([account]);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "accounts.json",
      JSON.stringify([account], null, 2)
    );
  });

  it("appends to existing accounts", () => {
    const existing = [{ phone: "628111", name: "Alice" }];
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(existing));
    fs.writeFileSync.mockImplementation(() => {});

    const newAccount = { phone: "628333", name: "Charlie" };
    const result = saveAccount(newAccount, "accounts.json");

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(newAccount);
    const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
    expect(writtenData).toEqual([...existing, newAccount]);
  });

  it("uses default file path", () => {
    fs.existsSync.mockReturnValue(false);
    fs.writeFileSync.mockImplementation(() => {});

    saveAccount({ phone: "628444" });

    expect(fs.existsSync).toHaveBeenCalledWith("accounts.json");
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "accounts.json",
      expect.any(String)
    );
  });
});

describe("formatAccountsTable", () => {
  it("formats accounts into a table string with headers", () => {
    const accounts = [
      { phone: "628111", name: "Alice", email: "alice@test.com", point: 50 },
      { phone: "628222", name: "Bob", email: "bob@test.com" },
    ];

    const result = formatAccountsTable(accounts);

    expect(result).toContain("Phone");
    expect(result).toContain("Name");
    expect(result).toContain("Email");
    expect(result).toContain("Points");
    expect(result).toContain("Alice");
    expect(result).toContain("Bob");
    expect(result).toContain("50");
    expect(result).toContain("0"); // default for missing point
  });

  it("handles empty array", () => {
    const result = formatAccountsTable([]);
    expect(result).toContain("Phone");
    expect(result).toContain("Name");
  });
});
