/* =========================================================
   LearningNursing CMS — save gateway (Cloudflare Worker)
   ---------------------------------------------------------
   WHY THIS EXISTS
   GitHub Pages only serves static files. It cannot save anything.
   The admin page therefore sends changes to THIS Worker, and the
   Worker commits them to your GitHub repo using a token that lives
   ONLY here (as an encrypted Worker secret) — never in browser code.

   REQUIRED SETTINGS (Worker → Settings → Variables and Secrets)
     GITHUB_TOKEN    (secret)  fine-grained token, ONE repo, "Contents: Read and write"
     ADMIN_PASSWORD  (secret)  long passphrase (20+ characters)
     GITHUB_REPO     (text)    e.g. yourname/learningnursing
     GITHUB_BRANCH   (text)    e.g. main
     ALLOWED_ORIGIN  (text)    e.g. https://learningnursing.com  (no trailing slash)
   ========================================================= */

const enc = new TextEncoder();

/* Compare password without leaking timing information */
async function sha(s) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}
async function authorised(req, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const h = req.headers.get("Authorization") || "";
  const given = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [a, b] = await Promise.all([sha(given), sha(env.ADMIN_PASSWORD)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

/* Only these locations may be written. Everything else is refused. */
const JSON_PATH = /^content\/[a-z0-9_-]+\.json$/;
const MEDIA_PATH = /^(images|videos)\/[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp|gif|svg|mp4|webm)$/i;
const MAX_BASE64 = 40 * 1024 * 1024; // ~30 MB file

function gh(env, path, init = {}) {
  const url =
    `https://api.github.com/repos/${env.GITHUB_REPO}/contents/` +
    path.split("/").map(encodeURIComponent).join("/") +
    (init.method === "PUT" ? "" : `?ref=${env.GITHUB_BRANCH || "main"}`);
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "learningnursing-cms",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
}

async function commitFile(env, path, base64, message) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let sha;
    const cur = await gh(env, path);
    if (cur.ok) sha = (await cur.json()).sha;
    const put = await gh(env, path, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: base64,
        branch: env.GITHUB_BRANCH || "main",
        ...(sha ? { sha } : {}),
      }),
    });
    if (put.ok) return { ok: true };
    if (put.status !== 409) return { ok: false, status: put.status, detail: await put.text() };
  }
  return { ok: false, status: 409, detail: "Conflict — try again" };
}

const toBase64 = (str) => btoa(unescape(encodeURIComponent(str)));

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      Vary: "Origin",
    };
    const reply = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.headers.get("Origin") !== env.ALLOWED_ORIGIN) return reply({ error: "Origin not allowed" }, 403);
    if (!(await authorised(req, env))) return reply({ error: "Wrong password" }, 401);

    const route = new URL(req.url).pathname;

    if (route === "/api/ping") return reply({ ok: true });

    if (req.method !== "POST") return reply({ error: "POST only" }, 405);
    let body;
    try { body = await req.json(); } catch { return reply({ error: "Invalid JSON" }, 400); }

    /* Save a content/*.json file */
    if (route === "/api/save") {
      if (!JSON_PATH.test(body.path || "")) return reply({ error: "Path not allowed" }, 400);
      const text = JSON.stringify(body.json, null, 2);
      const r = await commitFile(env, body.path, toBase64(text), `CMS: update ${body.path}`);
      return r.ok ? reply({ ok: true }) : reply({ error: "GitHub rejected the save", detail: r }, 502);
    }

    /* Upload an image or video file */
    if (route === "/api/upload") {
      if (!MEDIA_PATH.test(body.path || "")) return reply({ error: "File name/type not allowed" }, 400);
      if (!body.base64 || body.base64.length > MAX_BASE64) return reply({ error: "File missing or too large" }, 400);
      const r = await commitFile(env, body.path, body.base64, `CMS: upload ${body.path}`);
      return r.ok ? reply({ ok: true }) : reply({ error: "GitHub rejected the upload", detail: r }, 502);
    }

    return reply({ error: "Not found" }, 404);
  },
};
