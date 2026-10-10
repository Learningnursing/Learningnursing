/* LearningNursing — site-extras.js
   Runs on every public page. Reads content/settings.json and content/pages.json
   (both written by the admin panel) and applies:
   theme colours, font, custom CSS, announcement banner, per-page backgrounds,
   extra menu / footer links, and renders custom pages (page.html?p=slug).
   Also exposes window.LN.buildPage() so the admin can create static page files. */
(function () {
  'use strict';
  var SC = (typeof document !== 'undefined') ? document.currentScript : null;
  var ROOT = (SC && SC.src) ? new URL('.', SC.src).href : (typeof location !== 'undefined' ? location.href.replace(/[^\/]*$/, '') : '');
  var LN = (typeof window !== 'undefined' ? (window.LN = window.LN || {}) : {});
  if (typeof module !== 'undefined') module.exports = LN;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function paras(t) { return String(t || '').split(/\n{2,}/).filter(function (x) { return x.trim(); }).map(function (p) { return '<p>' + p.trim().replace(/\n/g, '<br>') + '</p>'; }).join(''); }
  function cols(rows) { return String(rows || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { return l.split('|').map(function (c) { return c.trim(); }); }); }
  function li(x) { return '<li>' + esc(x) + '</li>'; }

  /* ---------- content blocks ---------- */
  LN.renderBlocks = function (blocks) {
    return (blocks || []).map(function (b) {
      switch (b.type) {
        case 'heading': var h = b.level === 'h3' ? 'h3' : 'h2'; return '<' + h + '>' + esc(b.text) + '</' + h + '>';
        case 'paragraph': return paras(b.text);
        case 'bullets': return '<ul>' + (b.items || []).map(li).join('') + '</ul>';
        case 'numbered': return '<ol style="padding-left:22px;color:#475467">' + (b.items || []).map(li).join('') + '</ol>';
        case 'table':
          var r = cols(b.rows); if (!r.length) return '';
          return '<div class="lnb-table"><table><thead><tr>' + r[0].map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
            r.slice(1).map(function (row) { return '<tr>' + row.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
        case 'image':
          return b.src ? '<figure><img src="' + esc(b.src) + '" alt="' + esc(b.alt || b.caption || '') + '" loading="lazy">' + (b.caption ? '<figcaption>' + esc(b.caption) + '</figcaption>' : '') + '</figure>' : '';
        case 'video':
          return b.src ? '<video controls playsinline preload="metadata"' + (b.poster ? ' poster="' + esc(b.poster) + '"' : '') + '><source src="' + esc(b.src) + '"></video>' : '';
        case 'button':
          return b.text ? '<a class="btn' + (b.style === 'secondary' ? ' secondary' : '') + '" href="' + esc(b.url || '#') + '">' + esc(b.text) + '</a>' : '';
        case 'callout': return '<div class="' + (b.style === 'warn' ? 'notice' : 'callout-info') + '">' + paras(b.text) + '</div>';
        case 'cards':
          return '<div class="card-grid">' + cols(b.rows).map(function (c) {
            var inner = '<strong>' + esc(c[0]) + '</strong><span>' + esc(c[1] || '') + '</span>';
            return c[2] ? '<a class="card" href="' + esc(c[2]) + '">' + inner + '</a>' : '<div class="card">' + inner + '</div>';
          }).join('') + '</div>';
        case 'faq':
          return cols(b.rows).map(function (c) { return '<details><summary>' + esc(c[0]) + '</summary><p>' + esc(c[1] || '') + '</p></details>'; }).join('');
        case 'divider': return '<hr>';
        case 'html': return b.html || '';
      }
      return '';
    }).join('\n');
  };

  var NAV = [['Home', 'index.html'], ['Categories', 'index.html#categories'], ['Procedures', 'index.html#procedures'], ['Modules', 'index.html#learning-modules'], ['Resources', 'index.html#resources']];
  var WIDTH = { narrow: '780px', normal: '1050px', wide: '1250px' };

  LN.pageBody = function (p) {
    var head = p.showHeader === false ? '' :
      '<div class="page-header">' + (p.label ? '<div class="label">' + esc(p.label) + '</div>' : '') + '<h1>' + esc(p.title) + '</h1>' + (p.intro ? '<p>' + esc(p.intro) + '</p>' : '') + '</div>';
    return '<div class="crumbs"><a href="index.html">Home</a> / ' + esc(p.title) + '</div>' + head +
      '<section class="article-section lnb">' + LN.renderBlocks(p.blocks) + '</section>';
  };

  /* Full static HTML file for one custom page (same look as the other pages) */
  LN.buildPage = function (p, o) {
    o = o || {}; var site = o.site || '';
    var live = p.published !== false;
    var title = live ? ((p.seoTitle || p.title) + ' | LearningNursing.com') : 'Page not available | LearningNursing.com';
    var desc = live ? (p.description || p.intro || p.title) : 'This page is not available.';
    var body = live ? LN.pageBody(p) : '<div class="page-header"><h1>Page not available</h1><p>This page has been unpublished.</p></div>';
    var img = p.shareImage ? (/^https?:/.test(p.shareImage) ? p.shareImage : site + p.shareImage) : site + 'images/a_clean_modern_futuristic_healthcare_themed_digi.PNG';
    var nav = NAV.map(function (n) { return '<a href="' + n[1] + '">' + n[0] + '</a>'; }).join('');
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>' + esc(title) + '</title>\n<meta name="description" content="' + esc(desc) + '">\n' + (live ? '' : '<meta name="robots" content="noindex">\n') +
      '<link rel="canonical" href="' + site + p.id + '.html">\n<link rel="icon" href="favicon.svg" type="image/svg+xml">\n' +
      '<meta property="og:type" content="article">\n<meta property="og:site_name" content="LearningNursing.com">\n<meta property="og:title" content="' + esc(title) + '">\n' +
      '<meta property="og:description" content="' + esc(desc) + '">\n<meta property="og:url" content="' + site + p.id + '.html">\n<meta property="og:image" content="' + esc(img) + '">\n' +
      '<meta name="twitter:card" content="summary_large_image">\n<link rel="stylesheet" href="pages.css">\n</head>\n<body>\n' +
      '<header class="header"><nav class="navbar">\n<a href="index.html" class="logo"><div class="logo-mark">LN</div><div class="logo-text">Learning<span>Nursing</span>.com</div></a>\n<div class="nav-links">' + nav + '</div>\n</nav></header>\n' +
      '<main class="page" style="max-width:' + (WIDTH[p.width] || WIDTH.normal) + '">\n' + body + '\n</main>\n' +
      '<footer><div class="footer-inner"><div class="footer-grid">\n<div class="footer-brand"><div class="logo-text" style="color:#fff;font-size:20px;">Learning<span>Nursing</span>.com</div><p>Learn nursing. Understand better. Care better. A visual-first nursing education platform.</p></div>\n' +
      '<div class="footer-column"><h4>Learn</h4><a href="index.html#procedures">Procedures</a><a href="index.html#categories">Categories</a><a href="index.html#resources">Resources</a><a href="all-guides.html">All Guides</a></div>\n' +
      '<div class="footer-column"><h4>Platform</h4><a href="about.html">About</a><a href="contact.html">Contact</a><a href="report-issue.html">Report an Issue</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a></div>\n' +
      '</div><div class="footer-bottom">© 2026 LearningNursing.com · Educational content should always be checked against current professional and institutional guidance.</div></div></footer>\n' +
      '<script src="site-extras.js" defer></script>\n</body>\n</html>\n';
  };

  if (typeof window === 'undefined' || window.LN_NO_AUTORUN || typeof document === 'undefined') return;

  /* ---------- runtime: apply admin settings ---------- */
  function getJSON(f) {
    return fetch(ROOT + 'content/' + f + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function addStyle(id, css) {
    if (!css) return; var s = document.getElementById(id);
    if (!s) { s = document.createElement('style'); s.id = id; document.head.appendChild(s); }
    s.textContent = css;
  }
  function pageKey() {
    var f = location.pathname.split('/').pop();
    if (!f) return 'index';
    if (f === 'page.html') return new URLSearchParams(location.search).get('p') || 'page';
    return f.replace(/\.html$/, '');
  }
  function url(p) { return /^(https?:)?\/\/|^data:/.test(p) ? p : new URL(p.replace(/^\//, ''), ROOT).href; }
  function filled(b) {
    var o = {}; if (!b) return o;
    ['image', 'color', 'blur', 'overlay'].forEach(function (k) { if (b[k] !== '' && b[k] != null) o[k] = b[k]; });
    if (b.none === true || b.none === 'true') o.none = true; return o;
  }
  function bgCss(e) {
    var css = '';
    if (e.none) css += 'body::before{display:none!important}';
    else if (e.image) css += 'body::before{background-image:url("' + url(e.image) + '")!important}';
    if (e.blur !== undefined && !isNaN(parseFloat(e.blur))) css += 'body::before{filter:blur(' + parseFloat(e.blur) + 'px)!important}';
    if (e.color) css += 'body{background-color:' + e.color + '!important}';
    var ov = parseFloat(e.overlay);
    if (ov > 0) css += 'body::after{content:"";position:fixed;inset:0;background:rgba(255,255,255,' + Math.min(ov, 100) / 100 + ');z-index:0;pointer-events:none}';
    return css;
  }
  function pageHref(p) { return p.static ? p.id + '.html' : 'page.html?p=' + encodeURIComponent(p.id); }
  function addLinks(container, links) {
    if (!container) return;
    var have = {}; [].forEach.call(container.querySelectorAll('a'), function (a) { have[a.getAttribute('href')] = 1; });
    links.forEach(function (l) {
      if (!l.label || !l.url || have[l.url]) return;
      var a = document.createElement('a'); a.href = l.url; a.textContent = l.label; container.appendChild(a);
    });
  }

  function applyAll(S, P) {
    var root = document.documentElement, key = pageKey();
    var map = { navy: '--navy', blue: '--blue', teal: '--teal', blueLight: '--blue-light', bg: '--bg', text: '--text', muted: '--muted', border: '--border' };
    var th = S.theme || {};
    Object.keys(map).forEach(function (k) { if (th[k]) root.style.setProperty(map[k], th[k]); });
    if (S.font) addStyle('ln-font', 'body,button,input,select,textarea{font-family:' + S.font + '!important}');
    if (S.customCss) addStyle('ln-custom', S.customCss);

    /* backgrounds: default < page-specific (only fields that are filled in) */
    var bgs = S.backgrounds || {}, cp = (P.items || []).filter(function (x) { return x.id === key; })[0];
    var merged = {}, a = filled(bgs.default), b = filled(bgs[key]), c = filled(cp && cp.bg), k;
    for (k in a) merged[k] = a[k]; for (k in b) merged[k] = b[k]; for (k in c) merged[k] = c[k];
    addStyle('ln-bg', bgCss(merged));

    /* announcement banner */
    var bn = S.banner;
    if (bn && (bn.enabled === true || bn.enabled === 'true') && bn.text) {
      var d = document.createElement('div');
      d.setAttribute('style', 'background:' + (bn.bg || '#0f8b8d') + ';color:' + (bn.color || '#fff') + ';text-align:center;padding:9px 16px;font-size:14px;font-weight:600');
      d.innerHTML = bn.link ? '<a href="' + esc(bn.link) + '" style="color:inherit;text-decoration:underline">' + esc(bn.text) + '</a>' : esc(bn.text);
      document.body.insertBefore(d, document.body.firstChild);
    }

    /* extra menu + footer links */
    var pub = (P.items || []).filter(function (p) { return p.published !== false; });
    var hl = pub.filter(function (p) { return p.showInMenu; }).map(function (p) { return { label: p.menuLabel || p.title, url: pageHref(p) }; }).concat((S.header && S.header.links) || []);
    addLinks(document.querySelector('.nav-links'), hl);
    var fl = pub.filter(function (p) { return p.showInFooter; }).map(function (p) { return { label: p.menuLabel || p.title, url: pageHref(p) }; }).concat((S.footer && S.footer.links) || []);
    var cols_ = document.querySelectorAll('.footer-column'); addLinks(cols_[cols_.length - 1], fl);
  }

  function renderDynamic(P) {
    var root = document.getElementById('pageRoot'); if (!root) return;
    var key = pageKey(), p = (P.items || []).filter(function (x) { return x.id === key && x.published !== false; })[0];
    var main = root.closest ? root.closest('main') : null;
    if (!p) { root.innerHTML = '<div class="page-header"><h1>Page not found</h1><p>This page does not exist or is not published.</p></div>'; return; }
    document.title = (p.seoTitle || p.title) + ' | LearningNursing.com';
    var m = document.querySelector('meta[name="description"]'); if (m) m.setAttribute('content', p.description || p.intro || p.title);
    if (main) main.style.maxWidth = WIDTH[p.width] || WIDTH.normal;
    root.innerHTML = LN.pageBody(p);
  }

  Promise.all([getJSON('settings.json'), getJSON('pages.json')]).then(function (r) {
    var S = r[0] || {}, P = r[1] || { items: [] };
    try { applyAll(S, P); } catch (e) { if (window.console) console.warn('site-extras:', e); }
    renderDynamic(P);
  });
})();
