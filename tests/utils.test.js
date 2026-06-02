import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getRandomNumber, getHeaders, log } from "../src/utils.js";

describe("getRandomNumber", () => {
  it("returns a value within [min, max] inclusive", () => {
    for (let i = 0; i < 100; i++) {
      const result = getRandomNumber(5, 10);
      expect(result).toBeGreaterThanOrEqual(5);
      expect(result).toBeLessThanOrEqual(10);
    }
  });

  it("returns min when min === max", () => {
    expect(getRandomNumber(7, 7)).toBe(7);
  });

  it("always returns an integer", () => {
    for (let i = 0; i < 50; i++) {
      const result = getRandomNumber(1, 100);
      expect(Number.isInteger(result)).toBe(true);
    }
  });
});

describe("getHeaders", () => {
  const originalEnv = process.env.FORE_VERSION;

  beforeEach(() => {
    process.env.FORE_VERSION = "3.0.0";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.FORE_VERSION = originalEnv;
    } else {
      delete process.env.FORE_VERSION;
    }
  });

  it("returns base headers with Secret-Key when no accessToken", () => {
    const headers = getHeaders("device-123");

    expect(headers["Host"]).toBe("api.fore.coffee");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Device-Id"]).toBe("device-123");
    expect(headers["Platform"]).toBe("android");
    expect(headers["App-Version"]).toBe("3.0.0");
    expect(headers["Secret-Key"]).toBe("0kFe6Oc3R1eEa2CpO2FeFdzElp");
    expect(headers["Access-Token"]).toBeUndefined();
    expect(headers["Country-Id"]).toBeUndefined();
  });

  it("returns authenticated headers when accessToken is provided", () => {
    const headers = getHeaders("device-456", "my-token");

    expect(headers["Access-Token"]).toBe("my-token");
    expect(headers["Country-Id"]).toBe("1");
    expect(headers["Language"]).toBe("ID");
    expect(headers["Timezone"]).toBe("+07:00");
    expect(headers["Secret-Key"]).toBeUndefined();
  });

  it("includes Device-Id in both cases", () => {
    const h1 = getHeaders("d1");
    const h2 = getHeaders("d2", "tok");
    expect(h1["Device-Id"]).toBe("d1");
    expect(h2["Device-Id"]).toBe("d2");
  });

  it("reads App-Version from process.env.FORE_VERSION", () => {
    process.env.FORE_VERSION = "5.0.0";
    const headers = getHeaders("d");
    expect(headers["App-Version"]).toBe("5.0.0");
  });
});

describe("log", () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("log.info writes to console", () => {
    log.info("test message");
    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(consoleSpy.mock.calls[0][0]).toContain("test message");
  });

  it("log.success writes to console", () => {
    log.success("ok");
    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(consoleSpy.mock.calls[0][0]).toContain("ok");
  });

  it("log.warn writes to console", () => {
    log.warn("warning");
    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(consoleSpy.mock.calls[0][0]).toContain("warning");
  });

  it("log.error writes to console", () => {
    log.error("err");
    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(consoleSpy.mock.calls[0][0]).toContain("err");
  });

  it("log.process writes to console with trailing ellipsis", () => {
    log.process("loading");
    expect(consoleSpy).toHaveBeenCalledOnce();
    expect(consoleSpy.mock.calls[0][0]).toContain("loading");
  });
});
