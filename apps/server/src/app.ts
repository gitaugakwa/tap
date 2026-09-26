import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { handoffPage, landingPage } from "./pages";
import { styles } from "./styles";

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
app.get("/styles.css", (context) =>
  context.body(styles, 200, {
    "cache-control": "public, max-age=3600",
    "content-type": "text/css; charset=UTF-8",
  }),
);

app.get("/", (context) => context.html(landingPage(apkDownloadUrl)));
app.get("/p", (context) => context.html(handoffPage(apkDownloadUrl)));

app.notFound((context) => context.text("Not found", 404));

export { app };
