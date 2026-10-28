import { resolve } from "node:path";

const port = Number(process.env["PORT"] ?? "8080");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new RangeError("PORT must be an integer between 1 and 65535");
}

const directory = resolve(import.meta.dir, "dist");
if (!(await Bun.file(resolve(directory, "index.html")).exists())) {
  throw new Error("Production assets are missing. Run bun run build first.");
}

const server = Bun.serve({
  hostname: process.env["HOST"] ?? "0.0.0.0",
  port,
  routes: {
    "/healthz": () => Response.json({ status: "ok", mode: "frontend-demo" }),
    "/*": { dir: directory },
  },
});

console.info(`DEMO_READY ${server.url}`);

async function shutdown() {
  await server.stop(true);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
