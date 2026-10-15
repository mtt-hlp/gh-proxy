'use strict'

const PREFIX = '/'
// 白名单：路径里包含这些字符串才放行。留空表示不限制。例如 ['/你的用户名/']
const WHITE_LIST = []
// 文件浏览类链接是否跳转 jsDelivr（0 关闭，1 开启）
const JSDELIVR = 0

const HOME_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GitHub 加速下载</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 640px; margin: 10vh auto; padding: 0 16px; color: #1f2328; }
  h2 { font-size: 22px; font-weight: 600; margin-bottom: 20px; }
  .input-group { 
    display: flex; 
    align-items: center; 
    border: 1px solid #d0d7de; 
    border-radius: 8px; 
    background: #fff; 
    padding: 4px 4px 4px 12px; 
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04); 
    transition: border-color 0.2s, box-shadow 0.2s; 
  }
  .input-group:focus-within { 
    border-color: #0969da; 
    box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.15); 
  }
  input { 
    flex: 1; 
    min-width: 0; 
    padding: 8px 8px 8px 0; 
    box-sizing: border-box; 
    font-size: 15px; 
    border: none; 
    outline: none; 
    background: transparent; 
    color: #1f2328; 
  }
  #go { 
    margin: 0; 
    padding: 8px 16px; 
    font-size: 14px; 
    font-weight: 500; 
    cursor: pointer; 
    color: #fff; 
    background: #0969da; 
    border: none; 
    border-radius: 6px; 
    white-space: nowrap; 
    display: inline-flex; 
    align-items: center; 
    gap: 6px; 
    transition: background 0.2s, transform 0.05s; 
  }
  #go:hover { background: #0856b3; }
  #go:active { transform: scale(0.97); background: #074796; }
  #go svg { flex-shrink: 0; }
  #out { margin-top: 16px; word-break: break-all; }
  .result-box { 
    display: flex; 
    align-items: center; 
    gap: 8px; 
    margin-top: 10px; 
    padding: 10px 14px; 
    background: #f6f8fa; 
    border: 1px solid #d0d7de; 
    border-radius: 6px; 
  }
  .result-link { 
    flex: 1; 
    color: #0969da; 
    text-decoration: none; 
    word-break: break-all; 
    font-size: 14px; 
    line-height: 1.5; 
  }
  .result-link:hover { text-decoration: underline; }
  .copy-btn { 
    margin: 0; 
    padding: 5px; 
    width: 32px; 
    height: 32px; 
    display: inline-flex; 
    align-items: center; 
    justify-content: center; 
    cursor: pointer; 
    border: 1px solid #d0d7de; 
    background: #fff; 
    border-radius: 6px; 
    color: #57606a; 
    flex-shrink: 0; 
    transition: background 0.15s, border-color 0.15s; 
  }
  .copy-btn:hover { background: #f3f4f6; color: #24292f; border-color: #afb8c1; }
  .tips { 
    margin-top: 32px; 
    padding-top: 18px; 
    border-top: 1px solid #eaecef; 
    font-size: 13px; 
    color: #656d76; 
    line-height: 1.8; 
  }
  .tips div { word-break: break-all; }
</style>
</head>
<body>
  <h2>GitHub 加速下载</h2>
  <div class="input-group">
    <input id="url" placeholder="粘贴 GitHub release / raw / clone 链接">
    <button id="go">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      <span>加速</span>
    </button>
  </div>
  <div id="out"></div>

  <div class="tips">
    <div>分支源码：https://github.com/xxxx/project/archive/master.zip</div>
    <div>release源码：https://github.com/xxx/project/archive/v1.0.0.tar.gz</div>
    <div>release文件：https://github.com/xxx/project/releases/download/v1.0.0/release.zip</div>
    <div>分支文件：https://github.com/xxxx/project/blob/master/filename</div>
  </div>

  <script>
    const COPY_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    const CHECK_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a7f37" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return new Promise((resolve, reject) => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }

    const input = document.getElementById('url');
    const goBtn = document.getElementById('go');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') goBtn.click();
    });

    goBtn.onclick = () => {
      const v = input.value.trim();
      const out = document.getElementById('out');
      if (!/^https?:\\/\\/(github\\.com|raw\\.githubusercontent\\.com|gist\\.github(usercontent)?\\.com)\\//i.test(v)) {
        out.innerHTML = '<span style="color: #cf222e; font-size: 14px;">请输入有效的 GitHub 链接</span>';
        return;
      }
      const link = location.origin + '/' + v;
      copyText(link);

      out.innerHTML = '';
      
      const box = document.createElement('div');
      box.className = 'result-box';

      const a = document.createElement('a');
      a.className = 'result-link';
      a.href = link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = link;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.title = '复制链接';
      btn.innerHTML = COPY_ICON;
      btn.onclick = () => {
        copyText(link).then(() => {
          btn.innerHTML = CHECK_ICON;
          setTimeout(() => { btn.innerHTML = COPY_ICON; }, 1500);
        });
      };

      box.appendChild(a);
      box.appendChild(btn);
      out.appendChild(box);
    };
  </script>
</body>
</html>`

const PREFLIGHT_INIT = {
  status: 204,
  headers: new Headers({
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,HEAD,OPTIONS',
    'access-control-max-age': '1728000',
  }),
}

const exp1 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:releases|archive)\/.*$/i
const exp2 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:blob|raw)\/.*$/i
const exp3 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/(?:info|git-).*$/i
const exp4 = /^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+?\/.+$/i
const exp5 = /^(?:https?:\/\/)?gist\.(?:githubusercontent|github)\.com\/.+?\/.+?\/.+$/i
const exp6 = /^(?:https?:\/\/)?github\.com\/.+?\/.+?\/tags.*$/i

function makeRes(body, status = 200, headers = {}) {
  headers['access-control-allow-origin'] = '*'
  return new Response(body, { status, headers })
}

function newUrl(s) {
  try { return new URL(s) } catch (e) { return null }
}

function checkUrl(u) {
  return [exp1, exp2, exp3, exp4, exp5, exp6].some((re) => u.search(re) === 0)
}

export default {
  async fetch(req) {
    try {
      return await handle(req)
    } catch (err) {
      return makeRes('worker error:\n' + err.stack, 502)
    }
  },
}

async function handle(req) {
  const urlObj = new URL(req.url)

  // 首页的 ?q= 跳转
  const q = urlObj.searchParams.get('q')
  if (q) {
    return Response.redirect('https://' + urlObj.host + PREFIX + q, 301)
  }

  // Cloudflare 会把路径中的 // 合并成 /
  let path = urlObj.href
    .slice(urlObj.origin.length + PREFIX.length)
    .replace(/^https?:\/+/, 'https://')

  if (path.search(exp1) === 0 || path.search(exp5) === 0 ||
      path.search(exp6) === 0 || path.search(exp3) === 0) {
    return httpHandler(req, path)
  }

  if (path.search(exp2) === 0) {
    if (JSDELIVR) {
      const u = path.replace('/blob/', '@')
        .replace(/^(?:https?:\/\/)?github\.com/, 'https://cdn.jsdelivr.net/gh')
      return Response.redirect(u, 302)
    }
    return httpHandler(req, path.replace('/blob/', '/raw/'))
  }

  if (path.search(exp4) === 0) {
    if (JSDELIVR) {
      const u = path.replace(/(?<=com\/.+?\/.+?)\/(.+?\/)/, '@$1')
        .replace(/^(?:https?:\/\/)?raw\.(?:githubusercontent|github)\.com/, 'https://cdn.jsdelivr.net/gh')
      return Response.redirect(u, 302)
    }
    return httpHandler(req, path)
  }

  // 非 GitHub 链接：返回内嵌首页
  if (path === '' || path === 'index.html') {
    return new Response(HOME_HTML, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
  }
  return new Response('Not Found', { status: 404 })
}

function httpHandler(req, pathname) {
  if (req.method === 'OPTIONS' && req.headers.has('access-control-request-headers')) {
    return new Response(null, PREFLIGHT_INIT)
  }

  if (WHITE_LIST.length && !WHITE_LIST.some((i) => pathname.includes(i))) {
    return new Response('blocked', { status: 403 })
  }

  let urlStr = pathname
  if (urlStr.search(/^https?:\/\//) !== 0) urlStr = 'https://' + urlStr
  const target = newUrl(urlStr)
  if (!target) return new Response('bad url', { status: 400 })

  const headers = new Headers(req.headers)
  headers.delete('authorization') // 不转发凭据

  return proxy(target, {
    method: req.method,
    headers,
    redirect: 'manual',
    body: req.body,
  })
}

async function proxy(urlObj, reqInit, depth = 0) {
  if (depth > 5) return new Response('too many redirects', { status: 508 })

  const res = await fetch(urlObj.href, reqInit)
  const resHdr = new Headers(res.headers)

  const loc = resHdr.get('location')
  if (loc) {
    if (checkUrl(loc)) {
      resHdr.set('location', PREFIX + loc)
    } else {
      const next = newUrl(new URL(loc, urlObj).href)
      if (!next) return new Response('bad redirect', { status: 502 })
      return proxy(next, { ...reqInit, redirect: 'manual' }, depth + 1)
    }
  }

  resHdr.set('access-control-expose-headers', '*')
  resHdr.set('access-control-allow-origin', '*')
  resHdr.delete('content-security-policy')
  resHdr.delete('content-security-policy-report-only')
  resHdr.delete('clear-site-data')

  return new Response(res.body, { status: res.status, headers: resHdr })
}
