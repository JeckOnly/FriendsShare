import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createStore } from "./store.mjs";
import { createApi } from "./api.mjs";
const production =
  process.argv.includes("--production") ||
  process.env.NODE_ENV === "production";
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at < 0 ? fallback : process.argv[at + 1] || fallback;
};
const port = Number(arg("--port", process.env.PORT || "5173")),
  host = arg("--host", "127.0.0.1");
const store = createStore(
  resolve(process.env.READERWEB_DB || ".data/readerweb.sqlite"),
  { seed: !production },
);
const api = createApi(store, { development: !production });
let vite;
if (!production) {
  const { createServer } = await import("vite");
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
}
const server = createServer(async (req, res) => {
  if (req.url?.startsWith("/api/")) {
    try {
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 100000) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: "内容太长了。" } }));
          return;
        }
        chunks.push(chunk);
      }
      const origin = `http://${req.headers.host || `localhost:${port}`}`;
      const request = new Request(new URL(req.url, origin), {
        method: req.method,
        headers: req.headers,
        ...(!["GET", "HEAD"].includes(req.method)
          ? { body: Buffer.concat(chunks) }
          : {}),
      });
      const loopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress,
      );
      const response = await api(request, { loopback });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error(error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "暂时无法处理请求。" } }));
    }
    return;
  }
  if (vite)
    return vite.middlewares(req, res, () => {
      res.writeHead(404);
      res.end();
    });
  const root = resolve("dist/client"),
    pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
  const candidate = resolve(root, `.${pathname}`);
  const file =
    candidate.startsWith(root + "/") &&
    existsSync(candidate) &&
    statSync(candidate).isFile()
      ? candidate
      : join(root, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end("Build the client first.");
    return;
  }
  const ext = file.split(".").pop();
  res.setHeader(
    "Content-Type",
    {
      html: "text/html",
      js: "text/javascript",
      css: "text/css",
      png: "image/png",
      svg: "image/svg+xml",
    }[ext] || "application/octet-stream",
  );
  createReadStream(file).pipe(res);
});
server.listen(port, host, () =>
  console.log(`\nReaderWeb is running at http://localhost:${port}\n`),
);
async function close() {
  server.close();
  await vite?.close();
  store.close();
  process.exit(0);
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
