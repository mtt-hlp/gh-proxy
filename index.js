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
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 10vh auto; padding: 0 16px; }
  input { width: 100%; padding: 10px; box-sizing: border-box; font-size: 16px; }
  button { margin-top: 10px; padding: 10px 20px; font-size: 16px; cursor: pointer; }
  #out { margin-top: 16px; word-break: break-all; }
</style>
</head>
<body>
  <h2>GitHub 加速下载</h2>
  <input id="url" placeholder="粘贴 GitHub release / raw / clone 链接">
  <button id="go">生成加速链接</button>
  <div id="out"></div>
  <script>
    document.getElementById('go').onclick = () => {
      const v = document.getElementById('url').value.trim();
      const out = document.getElementById('out');
      if (!/^https?:\\/\\/(github\\.com|raw\\.githubusercontent\\.com|gist\\.github(usercontent)?\\.com)\\//i.test(v)) {
        out.textContent = '请输入有效的 GitHub 链接';
        return;
      }
      const link = location.origin + '/' + v;
      out.textContent = link;
      navigator.clipboard && navigator.clipboard.writeText(link);
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
