/* =========================================================
   LearningNursing — CMS LOADER (public site)
   ---------------------------------------------------------
   Loads /content/*.json (written by /admin/) and applies it on
   top of your existing index.html. If a JSON file is missing
   or fails to load, the page simply keeps its built-in content,
   so the public site can never be "broken" by the CMS.

   Load this file AFTER your main <script> block:
       <script src="cms-loader.js"></script>
   ========================================================= */
(async function () {
  "use strict";

  const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const url = (u) => (/^\s*(javascript|data|vbscript):/i.test(u || "") ? "#" : e(u || ""));
  const J = async (f) => {
    try {
      const r = await fetch("content/" + f, { cache: "no-cache" });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  };

  const [P, N, V, R, S] = await Promise.all([
    J("procedures.json"), J("notes.json"), J("videos.json"), J("resources.json"), J("site.json"),
  ]);

  /* ---------- small extra styles for CMS-only content ---------- */
  const st = document.createElement("style");
  st.textContent = `
    .note-body{margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:14px;color:#475467}
    .note-body h4{color:var(--navy);margin:14px 0 6px;font-size:15px}
    .note-body p{margin:6px 0}.note-body ul{padding:4px 0 8px 22px}
    .note-body img{max-width:100%;border-radius:12px;margin:8px 0}
    .note-body figcaption{font-size:12px;color:var(--muted)}
    .note-body table{border-collapse:collapse;width:100%;margin:8px 0;font-size:13px}
    .note-body th,.note-body td{border:1px solid var(--border);padding:6px 9px;text-align:left}
    .note-body th{background:var(--blue-light);color:var(--navy)}
    .note-body a{color:var(--blue);font-weight:700}
    .cms-media{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
    .cms-media img,.cms-media video{width:100%;border-radius:14px;background:#06182d}
    .cms-media figcaption{font-size:12px;color:var(--muted);margin-top:4px}
    .video-extra{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-top:18px}
    .video-extra video{width:100%;border-radius:18px;background:#06182d}
    .video-extra h3{color:var(--navy);margin-top:8px}.video-extra p{color:var(--muted);font-size:13px}`;
  document.head.appendChild(st);

  /* ---------- 1. WEBSITE TEXT ---------- */
  if (S && Array.isArray(S.text)) {
    S.text.forEach((f) => {
      if (!f.selector || f.value === undefined || f.value === "") return;
      if (f.selector === "title") { document.title = f.value; return; }
      const el = document.querySelector(f.selector);
      if (!el) return;
      if (f.attr) el.setAttribute(f.attr, f.value);
      else el.innerHTML = f.value;
    });
  }

  /* ---------- 2. IMAGES / APPEARANCE ---------- */
  if (S && Array.isArray(S.images)) {
    S.images.forEach((f) => {
      if (!f.value) return;
      if (f.attr === "bg") {
        document.documentElement.style.setProperty("--site-bg", `url("${f.value.replace(/"/g, "%22")}")`);
      } else if (f.attr === "favicon") {
        let l = document.querySelector('link[rel~="icon"]');
        if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); }
        l.href = f.value;
      } else {
        const el = document.querySelector(f.selector);
        if (el) el.setAttribute(f.attr || "src", f.value);
      }
    });
  }

  /* ---------- 3. PROCEDURES (same data structure as Hand Hygiene) ---------- */
  if (P && Array.isArray(P.items)) {
    // `procedures` is the const array from index.html — replace its contents in place
    procedures.splice(0, procedures.length, ...P.items.filter((p) => p.published !== false));
  }

  if (P && Array.isArray(P.categories) && P.categories.length) {
    const tb = document.querySelector(".procedure-toolbar");
    if (tb) {
      tb.innerHTML =
        `<button class="filter-btn active" onclick="filterCategory('all')">All</button>` +
        P.categories.filter((c) => c.filter).map((c) =>
          `<button class="filter-btn" onclick="filterCategory('${e(c.id)}')">${e(c.filterLabel || c.name)}</button>`).join("");
    }
    const cg = document.querySelector(".category-grid");
    if (cg) {
      cg.innerHTML = P.categories.filter((c) => c.card).map((c) => `
        <div class="category-card" onclick="filterCategory('${e(c.id)}')">
          <div class="category-icon">${e(c.icon)}</div><h3>${e(c.name)}</h3><p>${e(c.blurb)}</p>
        </div>`).join("");
    }
  }

  /* Unknown "art" keywords used to render a blank box — show a neutral icon instead */
  const origIllustration = window.illustration;
  window.illustration = function (t) {
    const r = origIllustration(t);
    return /<(circle|img)/.test(r) ? r :
      `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="100" cy="100" r="80" fill="#eaf4ff"/><path d="M100 62v76M62 100h76" stroke="#1769aa" stroke-width="14" stroke-linecap="round"/></svg>`;
  };

  /* Wrap the existing detail-page renderer: it still builds the page exactly as
     before; we then add the optional sections (indications, media, precautions…) */
  const origOpen = window.openProcedure;
  window.openProcedure = function (id) {
    origOpen(id);
    const p = procedures.find((x) => x.id === id);
    const root = document.getElementById("procedureContent");
    if (!p || !root) return;

    const listSection = (title, items) =>
      items && items.length
        ? `<section class="article-section"><h2>${title}</h2><div class="check-list">${items.map((i) => `<div>${e(i)}</div>`).join("")}</div></section>` : "";

    const eq = root.querySelector("#equipment");
    if (eq) eq.insertAdjacentHTML("beforebegin", listSection("Indications", p.indications) + listSection("Contraindications", p.contraindications));

    const media = [
      ...(p.images || []).filter((m) => m.src).map((m) => `<figure><img src="${url(m.src)}" alt="${e(m.caption || p.title)}" loading="lazy"><figcaption>${e(m.caption)}</figcaption></figure>`),
      ...(p.videos || []).filter((m) => m.src).map((m) => `<figure><video src="${url(m.src)}" ${m.poster ? `poster="${url(m.poster)}"` : ""} controls preload="metadata" playsinline></video><figcaption>${e(m.title)}</figcaption></figure>`),
    ];
    const ov = root.querySelector("#overview");
    if (ov && media.length) ov.insertAdjacentHTML("afterend", `<section class="article-section"><h2>Images &amp; Videos</h2><div class="cms-media">${media.join("")}</div></section>`);

    if (p.precautions && p.precautions.length) {
      const cl = root.querySelector("#safety .check-list");
      if (cl) cl.innerHTML = p.precautions.map((x) => `<div>✓ ${e(x)}</div>`).join("");
    }
    document.title = (p.seo && p.seo.title) || `${p.title} | LearningNursing.com`;
  };

  const origHome = window.showHome;
  const homeTitle = document.title;
  window.showHome = function () { document.title = homeTitle; origHome(); };

  renderProcedures(procedures);

  /* ---------- 4. NOTES ---------- */
  if (N && Array.isArray(N.items)) {
    const grid = document.querySelector(".notes-grid");
    if (grid) {
      const block = (b) => {
        switch (b.type) {
          case "heading": return `<h4>${e(b.text)}</h4>`;
          case "paragraph": return `<p>${e(b.text)}</p>`;
          case "bullets": return `<ul>${(b.items || []).map((i) => `<li>${e(i)}</li>`).join("")}</ul>`;
          case "table": {
            const rows = String(b.rows || "").split("\n").filter((r) => r.trim()).map((r) => r.split("|").map((c) => e(c.trim())));
            if (!rows.length) return "";
            return `<table><thead><tr>${rows[0].map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
          }
          case "image": return `<figure><img src="${url(b.src)}" alt="${e(b.caption)}" loading="lazy"><figcaption>${e(b.caption)}</figcaption></figure>`;
          case "link": return `<p><a href="${url(b.url)}" target="_blank" rel="noopener noreferrer">${e(b.text || b.url)} ↗</a></p>`;
          default: return "";
        }
      };
      grid.innerHTML = N.items.filter((n) => n.published !== false).map((n) => {
        const topics = (n.topics || []).map((t) => {
          const ul = `<ul>${(t.items || []).map((i) => `<li>${e(i)}</li>`).join("")}</ul>`;
          return t.title ? `<details><summary>${e(t.title)}</summary>${ul}</details>` : ul;
        }).join("");
        const body = (n.blocks || []).length ? `<details><summary>Full notes</summary><div class="note-body">${n.blocks.map(block).join("")}</div></details>` : "";
        const refs = (n.references || []).length
          ? `<details><summary>References</summary><div class="note-body">${n.references.map((r) => `<p><a href="${url(r.url)}" target="_blank" rel="noopener noreferrer">${e(r.title || r.url)} ↗</a></p>`).join("")}</div></details>` : "";
        return `<div class="notes-card"><div class="notes-icon">${e(n.icon)}</div><h3>${e(n.title)}</h3><p>${e(n.description)}</p>
          <details><summary>View Topics</summary><div class="subtopics">${topics}${body}${refs}</div></details></div>`;
      }).join("");
    }
  }

  /* ---------- 5. RESOURCES: learning modules + trending ---------- */
  if (R) {
    const mg = document.querySelector(".learning-modules-grid");
    if (mg && Array.isArray(R.modules)) {
      mg.innerHTML = R.modules.filter((m) => m.published !== false).map((m) => `
        <article class="learning-module"><div class="module-icon">${e(m.icon)}</div><h3>${e(m.title)}</h3><p>${e(m.description)}</p>
        <div class="module-pop">${e(m.cta)}</div></article>`).join("");
    }
    const ts = document.getElementById("trendingScroller");
    if (ts && Array.isArray(R.trending)) {
      ts.innerHTML = R.trending.filter((t) => t.published !== false && procedures.some((p) => p.id === t.procedureId)).map((t, i) => `
        <article class="trending-card"><div class="trending-number">Trending ${String(i + 1).padStart(2, "0")}</div>
        <h3>${e(t.title)}</h3><p>${e(t.description)}</p>
        <button onclick="openProcedure('${e(t.procedureId)}')">${e(t.label || "Open Guide →")}</button></article>`).join("");
    }
  }

  /* ---------- 6. VIDEOS ---------- */
  const section = document.getElementById("nursing-video");
  if (V && Array.isArray(V.items) && section) {
    const vids = V.items.filter((v) => v.published !== false);
    if (!vids.length) section.style.display = "none";
    else {
      const main = vids.find((v) => v.featured) || vids[0];
      const vid = document.getElementById("nursingVideo");
      const source = vid.querySelector("source");
      if (main.src && source.getAttribute("src") !== main.src) {
        source.setAttribute("src", main.src);
        source.setAttribute("type", /\.webm$/i.test(main.src) ? "video/webm" : "video/mp4");
        vid.load();
      }
      if (main.poster) vid.poster = main.poster;
      vid.autoplay = !!main.autoplay; vid.muted = !!main.muted; vid.loop = !!main.loop; vid.controls = !!main.controls;
      const h = section.querySelector(".video-overlay-content h2");
      const d = section.querySelector(".video-overlay-content p");
      if (h && main.title) h.textContent = main.title;
      if (d && main.description) d.textContent = main.description;
      if (vid.autoplay) vid.play().catch(() => {});

      const extra = vids.filter((v) => v !== main);
      if (extra.length) {
        section.insertAdjacentHTML("beforeend", `<div class="video-extra">${extra.map((v) => `
          <div><video src="${url(v.src)}" ${v.poster ? `poster="${url(v.poster)}"` : ""} ${v.muted ? "muted" : ""} ${v.loop ? "loop" : ""} controls preload="metadata" playsinline></video>
          <h3>${e(v.title)}</h3><p>${e(v.description)}</p></div>`).join("")}</div>`);
      }
    }
  }
})();
