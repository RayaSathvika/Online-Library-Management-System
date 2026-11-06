(function () {
  const path = window.location.pathname.split("/").pop() || "login.html";
  if (path === "login.html" || path === "" || path === "/") return;

  const admin = sessionStorage.getItem("admin");
  if (!admin) {
    window.location.href = "login.html";
  }
})();

function requireAdmin() {
  return !!sessionStorage.getItem("admin");
}

function logout() {
  sessionStorage.removeItem("admin");
  window.location.href = "login.html";
}

function showMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = "msg show " + (type || "info");
}

function clearMsg(el) {
  if (!el) return;
  el.textContent = "";
  el.className = "msg";
}

async function api(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options && options.headers) },
    ...options,
  });
  const data = await res.json().catch(() => ({ success: false, message: "Invalid server response" }));
  if (!res.ok && !data.message) data.message = "Request failed";
  return data;
}
