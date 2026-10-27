// hash router: #/lab/1/part1 → handler(params)
const routes = [];

export function route(pattern, handler) {
  const keys = [];
  const re = new RegExp(
    "^" + pattern.replace(/:([a-z]+)/gi, (_, k) => (keys.push(k), "([^/]+)")) + "/?$"
  );
  routes.push({ re, keys, handler });
}

export function navigate(path) {
  if (location.hash === "#" + path) dispatch();
  else location.hash = path;
}

export function dispatch() {
  const path = location.hash.replace(/^#/, "") || "/";
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      r.handler(params, path);
      return;
    }
  }
  location.hash = "/";
}

export function start() {
  window.addEventListener("hashchange", dispatch);
  dispatch();
}
