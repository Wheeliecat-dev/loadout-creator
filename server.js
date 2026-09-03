// Local dev server for Loadout Creator.
//
// Serves the static site AND provides POST /api/save-transforms, which
// Admin Mode uses to write calibration data straight to
// data/itemTransforms.js so it's committed and shipped for every visitor.
// Regular `npx serve` works fine for just browsing; use this one when
// calibrating items.
//
// No dependencies — plain Node. Run with: node server.js

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const TRANSFORMS_PATH = path.join(ROOT, "data", "itemTransforms.js");
const PORT = process.env.PORT || 5544;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(ROOT, urlPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function handleSaveTransforms(req, res) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 5_000_000) req.destroy(); // guard against runaway payloads
  });
  req.on("end", () => {
    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid JSON" }));
    }

    const contents =
      "// Loadout Creator — per-item layer calibration\n" +
      "//\n" +
      "// Gear art doesn't all share the base body's canvas size/framing, so each\n" +
      "// item can be nudged/scaled to line up. Keyed by item id -> per-view\n" +
      "// { x, y, scale } (x/y are percent offsets, scale is a multiplier; the\n" +
      "// default when an item has no entry is { x: 0, y: 0, scale: 1 }).\n" +
      "//\n" +
      "// Written by Admin Mode's \"Save site-wide\" button (via server.js) — hand\n" +
      "// edits are fine too, but let the tool do it when you can.\n" +
      `const ITEM_TRANSFORMS = ${JSON.stringify(data, null, 2)};\n`;

    fs.writeFile(TRANSFORMS_PATH, contents, "utf8", (err) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Write failed" }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/save-transforms") {
    return handleSaveTransforms(req, res);
  }
  if (req.method === "GET") {
    return serveStatic(req, res);
  }
  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`Loadout Creator running at http://localhost:${PORT}`);
});
