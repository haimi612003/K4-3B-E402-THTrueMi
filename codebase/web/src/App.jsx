import { useEffect, useMemo, useRef, useState } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import { makeTheme } from "./theme";
import { api } from "./lib/api";
import { D, TH, sessionsByDate } from "./lib/data";

import Home from "./tabs/Home.jsx";
import Overview from "./tabs/Overview.jsx";
import Clusters from "./tabs/Clusters.jsx";
import Live from "./tabs/Live.jsx";

const TABS = [
  { k: "home", label: "Trang chủ" },
  { k: "tong", label: "Tổng quan" },
  { k: "cum", label: "Cụm vấn đề" },
  { k: "live", label: "Thử trực tiếp" },
];

const qs = () => new URLSearchParams(location.search);
const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* chế độ riêng tư */ } };

function Gate({ onOk }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { await api.login(pass); onOk(); }
    catch (ex) { setErr(String(ex.message || ex)); setBusy(false); }
  };
  return (
    <div className="sky min-h-full grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-[420px] rounded-xl3 border border-[color:var(--line)] bg-[color:var(--panel)] p-8 shadow-float">
        <div className="w-10 h-10 rounded-xl2 bg-[color:var(--primary)] text-white grid place-items-center text-lg mb-4">◎</div>
        <h1 className="text-[22px] font-semibold tracking-tight">Class Pulse</h1>
        <p className="mt-2 text-[14px] text-[color:var(--ink-2)]">
          Bảng điều khiển này đọc câu hỏi thật của học viên. Dùng mã nhóm đã cấp cho bạn.
        </p>
        {err && (
          <p className="mt-4 rounded-lg border border-[color:var(--critical)] px-3 py-2 text-[13px] text-[color:var(--critical-ink)]">{err}</p>
        )}
        <TextField type="password" value={pass} onChange={(e) => setPass(e.target.value)}
          label="Mã truy cập" size="small" fullWidth autoFocus className="mt-4" autoComplete="current-password" />
        <Button type="submit" variant="contained" fullWidth disabled={busy}
          className="mt-4 !rounded-xl2 !bg-black hover:!bg-neutral-800 !py-2.5">
          {busy ? <CircularProgress size={18} color="inherit" /> : "Đăng nhập"}
        </Button>
        <p className="mt-4 text-[12px] leading-relaxed text-[color:var(--muted)]">
          Mã đặt ở <code>CLASS_PULSE_PASSCODE</code> trong <code>.env</code> của máy chủ. Đăng nhập chặn người khác
          trên cùng máy hoặc cùng mạng mở cổng này; nó không thay được tài khoản thật khi đem lên máy chủ chung.
        </p>
      </form>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState(() => {
    const q = qs().get("theme");
    if (q === "dark" || q === "light") return q;
    return lsGet("cp.theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });
  const [tab, setTab] = useState(() => {
    const h = location.hash.slice(1);
    if (TABS.some((t) => t.k === h)) return h;
    // ?sample=... là deep-link demo cho tab Thử trực tiếp — phải mở đúng tab đó,
    // nếu không tab Live không bao giờ được mount và tham số rơi vào hư không.
    if (qs().get("sample")) return "live";
    return lsGet("cp.tab", "home");
  });
  /* Mặc định mở buổi gần nhất CÓ cụm, không phải phần tử đầu mảng: thứ tự mảng
     là thứ tự tên file, không phải thứ tự thời gian. */
  const [sess, setSess] = useState(() => {
    const all = D.sessions || [];
    const pick = sessionsByDate().filter((s) => !s.sparse && s.clusters && s.clusters.length)[0];
    const i = pick ? all.indexOf(pick) : 0;
    return Math.max(0, i);
  });
  const [auth, setAuth] = useState({ need: false, ok: true, checked: false });
  const scrollRef = useRef(null);
  const theme = useMemo(() => makeTheme(mode), [mode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", mode);
    lsSet("cp.theme", mode);
  }, [mode]);

  useEffect(() => {
    api.session()
      .then((j) => setAuth({ need: !!j.need_passcode, ok: !j.need_passcode || !!j.authed, checked: true }))
      .catch(() => setAuth({ need: false, ok: true, checked: true })); // mở bằng file:// thì không có máy chủ
  }, []);

  /* Ngưỡng THẬT đang chạy lấy từ máy chủ, không phải bản đóng băng trong data.js.
     Nếu ai đổi config.py mà quên chạy lại build_data.py thì chữ trên màn hình sẽ
     lệch khỏi ngưỡng thật — và màn hình đang HỨA với người đọc rằng con số đó là
     ngưỡng thật. Gộp tại chỗ vì TH là cùng một object mọi tab đã import. */
  useEffect(() => {
    api.health()
      .then((h) => { if (h && h.thresholds) Object.assign(TH, h.thresholds); })
      .catch(() => { /* không có máy chủ: dùng ngưỡng trong data.js */ });
  }, []);

  useEffect(() => {
    lsSet("cp.tab", tab);
    if (location.hash.slice(1) !== tab) history.replaceState(null, "", "#" + tab);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [tab]);

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.slice(1);
      if (TABS.some((t) => t.k === h)) setTab(h);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  if (!auth.checked) return null;
  if (auth.need && !auth.ok) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Gate onOk={() => setAuth((a) => ({ ...a, ok: true }))} />
      </ThemeProvider>
    );
  }

  const shared = { sess, setSess, goTab: setTab };
  // Tab "eval" và "log" đã bỏ khỏi thanh điều hướng. Người dùng cũ có thể còn
  // localStorage cp.tab="eval" hoặc một dấu trang #log — cả hai rơi về Home chứ
  // không để trang trắng.
  const Panel = { home: Home, tong: Overview, cum: Clusters, live: Live }[tab] || Home;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div className="h-full grid" style={{ gridTemplateRows: "56px 1fr" }}>
        <header className="flex items-center gap-1 px-4 border-b border-[color:var(--line)] bg-[color:var(--panel)] z-10">
          <div className="flex items-center gap-2 pr-4 mr-2 font-bold tracking-tight border-r border-[color:var(--line)] shrink-0">
            <span className="w-6 h-6 rounded-lg bg-[color:var(--primary)] text-white grid place-items-center text-[13px]">◎</span>
            Class Pulse
          </div>
          <nav className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {TABS.map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} aria-current={tab === t.k ? "page" : undefined}
                className={
                  "whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13.5px] transition-colors " +
                  (tab === t.k
                    ? "bg-[color:var(--ink)] text-[color:var(--panel)] font-semibold"
                    : "text-[color:var(--ink-2)] hover:bg-[color:var(--surface-2)]")
                }>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Button size="small" variant="outlined" onClick={() => setMode(mode === "dark" ? "light" : "dark")}
              className="!rounded-full !border-[color:var(--line)] !text-[color:var(--ink-2)] !text-[12.5px]">
              {mode === "dark" ? "Nền sáng" : "Nền tối"}
            </Button>
            {auth.need && (
              <Button size="small" variant="text" onClick={() => api.logout().then(() => location.reload())}
                className="!rounded-full !text-[color:var(--ink-2)] !text-[12.5px]">Thoát</Button>
            )}
          </div>
        </header>
        <main ref={scrollRef} data-scroll className="overflow-y-auto">
          <Panel {...shared} />
        </main>
      </div>
    </ThemeProvider>
  );
}
