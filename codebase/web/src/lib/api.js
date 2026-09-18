/* Mọi lời gọi AI đi qua máy chủ Python. Trình duyệt KHÔNG BAO GIỜ cầm khoá
   Gemini — ai mở DevTools cũng lấy được nếu để ở đây. */
async function call(path, body) {
  const r = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Lỗi ${r.status}`);
  return j;
}
export const api = {
  session: () => call("/api/session"),
  login: (passcode) => call("/api/login", { passcode }),
  logout: () => call("/api/logout", {}),
  health: () => call("/api/health"),
  samples: () => call("/api/samples"),
  generate: (b) => call("/api/generate", b),
  cluster: (b) => call("/api/cluster", b),
  answer: (b) => call("/api/answer", b),
  faq: (b) => call("/api/faq", b),
};
