import http from "node:http";

const page = `<!doctype html><html><head><title>KageTarget Fixture</title><link rel="canonical" href="/canonical"><meta name="robots" content="index, follow"><meta name="generator" content="WordPress 6.8"><link rel="stylesheet" href="/wp-includes/css/test.css"><script id="__NEXT_DATA__" type="application/json">{}</script></head><body><a href="/internal">Internal</a><a href="https://external.example/test">External</a><script src="/_next/static/app.js"></script><script src="/wp-content/plugins/test/app.js"></script><form action="/login" method="post"><input type="email"><input type="password"><button>Login</button></form></body></html>`;
const login = `<!doctype html><html><head><title>Administration Login</title></head><body><form><input name="username"><input type="password"></form></body></html>`;

export function startFixture() {
  const requests = [];
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      requests.push({ method: req.method, url: req.url, cookie: req.headers.cookie ?? "" });
      const headers = { "Content-Security-Policy": "default-src 'self'; script-src 'self'", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin", "X-Frame-Options": "DENY", "content-type": "text/html" };
      if (req.url === "/login") { res.writeHead(302, { Location: "/auth/signin" }); res.end(); return; }
      if (req.url === "/auth/signin" || req.url === "/admin" || req.url === "/admin/" || req.url === "/admin/login" || req.url === "/admin/login/") { res.writeHead(200, headers); res.end(req.method === "HEAD" ? "" : login); return; }
      if (req.url === "/administrator" || req.url === "/administrator/") { res.writeHead(403, headers); res.end(); return; }
      if (req.url?.startsWith("/.kagetarget-probe-")) { res.writeHead(404, headers); res.end(); return; }
      if (req.url === "/fixture-script.js" || req.url === "/_next/static/app.js" || req.url === "/wp-content/plugins/test/app.js") { res.writeHead(200, { "content-type": "application/javascript" }); res.end("void 0"); return; }
      if (req.url === "/" || req.url === "/canonical") { res.writeHead(200, { ...headers, server: "nginx/1.27.0", "cf-ray": "fixture" }); res.end(req.method === "HEAD" ? "" : page); return; }
      if (req.url === "/robots.txt") { res.writeHead(200, { "content-type": "text/plain" }); res.end("User-agent: *\nDisallow: /private"); return; }
      if (req.url === "/.well-known/security.txt" || req.url === "/security.txt") { res.writeHead(200, { "content-type": "text/plain" }); res.end("Contact: mailto:security@example.test"); return; }
      if (req.url === "/sitemap.xml") { res.writeHead(200, { "content-type": "application/xml" }); res.end("<urlset></urlset>"); return; }
      res.writeHead(404, headers); res.end();
    }).listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port, requests }));
  });
}
