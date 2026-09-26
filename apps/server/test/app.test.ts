import { describe, expect, test } from "bun:test";
import { apkDownloadUrl, app } from "../src/app";

describe("public server", () => {
  test("serves the landing page with secure headers", async () => {
    const response = await app.request("/");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(body).toContain("The cash register is already in your pocket.");
    expect(body).toContain(apkDownloadUrl);
  });

  test("serves the responsive stylesheet", async () => {
    const response = await app.request("/styles.css");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
    expect(await response.text()).toContain("@media (max-width:800px)");
  });

  test("never renders unverified payment query data", async () => {
    const unsafe = "<script>untrusted()</script>";
    const first = await app.request(`/p?merchant=${encodeURIComponent(unsafe)}&amount=5000000`);
    const second = await app.request("/p?merchant=someone-else.tap.eth&amount=1");
    const firstBody = await first.text();
    const secondBody = await second.text();

    expect(first.status).toBe(200);
    expect(firstBody).toBe(secondBody);
    expect(firstBody).not.toContain(unsafe);
    expect(firstBody).not.toContain("someone-else.tap.eth");
    expect(firstBody).toContain("never displays payment details from the link");
  });

  test("reports service health", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
