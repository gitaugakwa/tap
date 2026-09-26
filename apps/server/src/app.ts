import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";

export const apkDownloadUrl =
  "https://github.com/gitaugakwa/tap/releases/latest/download/tap-android.apk";

const app = new Hono();

app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: {
      baseUri: ["'self'"],
      defaultSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'none'"],
      styleSrc: ["'self'"],
    },
  }),
);

app.get("/health", (context) => context.json({ status: "ok" }));

app.get("/", (context) =>
  context.html(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tap - payments at the pace of a tap</title></head><body><main><p>TAP</p><h1>Payments, at the pace of a tap.</h1><p>Turn an Android phone into a payment terminal, with merchant identity verified through ENS.</p><a href="${apkDownloadUrl}">Download Android demo</a></main></body></html>`,
  ),
);

const handoffPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Open in Tap</title></head><body><main><p>TAP</p><h1>Open this payment in Tap.</h1><p>This page never displays payment details from the link. The Tap app verifies the merchant, signature, network, token, amount, and expiry before showing them.</p><a href="${apkDownloadUrl}">Download Tap for Android</a></main></body></html>`;

app.get("/p", (context) => context.html(handoffPage));

app.notFound((context) => context.text("Not found", 404));

export { app };
