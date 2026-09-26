import { app } from "./app";

const port = Number.parseInt(Bun.env.PORT ?? "3000", 10);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be an integer from 1 to 65535");
}

Bun.serve({ fetch: app.fetch, port });
