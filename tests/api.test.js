import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock node-fetch before importing api module
const mockFetch = vi.fn();
vi.mock("node-fetch", () => ({ default: mockFetch }));

// Suppress log output during tests
vi.mock("../src/utils.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    log: {
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      process: vi.fn(),
    },
  };
});

const {
  getToken,
  checkPhone,
  reqLogin,
  signUp,
  addPin,
  updateProfile,
  profileDetail,
  fetchRandomUser,
} = await import("../src/api.js");

const { log } = await import("../src/utils.js");

function mockJsonResponse(data) {
  return { json: () => Promise.resolve(data) };
}

describe("getToken", () => {
  beforeEach(() => mockFetch.mockReset());

  it("calls /auth/get-token and returns parsed JSON", async () => {
    const payload = { payload: { access_token: "tok123" } };
    mockFetch.mockResolvedValue(mockJsonResponse(payload));

    const result = await getToken("device-1");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.fore.coffee/auth/get-token");
    expect(opts.headers["Device-Id"]).toBe("device-1");
    expect(result).toEqual(payload);
  });
});

describe("checkPhone", () => {
  beforeEach(() => mockFetch.mockReset());

  it("sends POST with phone prefixed by +", async () => {
    const payload = { payload: { is_registered: 0 } };
    mockFetch.mockResolvedValue(mockJsonResponse(payload));

    const result = await checkPhone("dev-1", "token-1", "628123456");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.fore.coffee/auth/check-phone");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ phone: "+628123456" });
    expect(result).toEqual(payload);
  });
});

describe("reqLogin", () => {
  beforeEach(() => mockFetch.mockReset());

  it("sends POST to /auth/req-login-code", async () => {
    const payload = { payload: { code: "sent" } };
    mockFetch.mockResolvedValue(mockJsonResponse(payload));

    const result = await reqLogin("dev-2", "tok-2", "628999");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.fore.coffee/auth/req-login-code");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.phone).toBe("+628999");
    expect(body.method).toBe("");
    expect(result).toEqual(payload);
  });
});

describe("signUp", () => {
  beforeEach(() => mockFetch.mockReset());

  it("sends POST to /auth/sign-up with all fields", async () => {
    const payload = { payload: { text: "Success" } };
    mockFetch.mockResolvedValue(mockJsonResponse(payload));

    const result = await signUp("dev-3", "tok-3", "628111", "John", "1234", "REF");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.fore.coffee/auth/sign-up");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      whatsapp: 0,
      phone: "+628111",
      name: "John",
      code: "1234",
      referral_code: "REF",
    });
    expect(result).toEqual(payload);
  });
});

describe("addPin", () => {
  beforeEach(() => mockFetch.mockReset());

  it("sends POST to /auth/pin with pin and confirm_pin", async () => {
    const payload = { payload: { text: "Success" } };
    mockFetch.mockResolvedValue(mockJsonResponse(payload));

    const result = await addPin("dev-4", "tok-4", "9999");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.fore.coffee/auth/pin");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body).toEqual({ confirm_pin: "9999", pin: "9999" });
    expect(result).toEqual(payload);
  });
});

describe("updateProfile", () => {
  beforeEach(() => mockFetch.mockReset());

  it("sends PUT to /user/profile", async () => {
    const payload = { payload: { text: "Success" } };
    mockFetch.mockResolvedValue(mockJsonResponse(payload));

    const result = await updateProfile("dev-5", "tok-5", "Jane", "jane@test.com", "2000-01-15");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.fore.coffee/user/profile");
    expect(opts.method).toBe("PUT");
    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      user_name: "Jane",
      user_email: "jane@test.com",
      user_birthday: "2000-01-15",
    });
    expect(result).toEqual(payload);
  });
});

describe("profileDetail", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  it("fetches profile detail with yesterday's date and returns payload", async () => {
    const payload = {
      payload: { user_name: "Alice", user_point: 100 },
    };
    mockFetch.mockResolvedValue(mockJsonResponse(payload));

    const result = await profileDetail("dev-6", "tok-6");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("https://api.fore.coffee/user/profile/detail?last_seen=");
    expect(result).toEqual(payload);
    expect(log.success).toHaveBeenCalled();
  });

  it("logs a warning when payload is missing", async () => {
    const response = { message: "Not found" };
    mockFetch.mockResolvedValue(mockJsonResponse(response));

    const result = await profileDetail("dev-7", "tok-7");

    expect(result).toEqual(response);
    expect(log.warn).toHaveBeenCalled();
  });

  it("logs a default warning when both payload and message are missing", async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({}));

    const result = await profileDetail("dev-8", "tok-8");

    expect(result).toEqual({});
    expect(log.warn).toHaveBeenCalled();
  });

  it("returns null and logs error on fetch failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await profileDetail("dev-9", "tok-9");

    expect(result).toBeNull();
    expect(log.error).toHaveBeenCalled();
  });
});

describe("fetchRandomUser", () => {
  beforeEach(() => mockFetch.mockReset());

  it("fetches from randomuser.me and returns first result", async () => {
    const user = { name: { first: "Budi", last: "Santoso" } };
    mockFetch.mockResolvedValue(
      mockJsonResponse({ results: [user, { name: { first: "X", last: "Y" } }] })
    );

    const result = await fetchRandomUser();

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://randomuser.me/api?nat=id");
    expect(result).toEqual(user);
  });
});
