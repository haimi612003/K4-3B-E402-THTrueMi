import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";

import { D, TH, fmt, dmy, sessionsByDate, scatterCount } from "../lib/data";
import { api } from "../lib/api";
import { TableView } from "../ui/Charts";
import { useReveal, Kicker, Card, Chip, Banner, Disclosure } from "../ui/Bits";

/* ══════════════════════════════════════════════════════════════════════
   TAB CỤM VẤN ĐỀ — nơi Lab Coach làm việc thật.
   Cổng ra duy nhất tới HỌC VIÊN nằm ở đây (bản hỏi đáp VLearn), nên nó là
   thứ duy nhất phải đi qua ba cửa: Lab Coach tick cụm → hệ thống tự từ chối
   cụm không phải câu hỏi kiến thức → Lab Coach bỏ tick từng mục. Không có
   nút "đăng thẳng lên VLearn": file tải về máy, người đăng là người.
   ══════════════════════════════════════════════════════════════════════ */

const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* chế độ riêng tư */ } };

/* Chữ do model sinh ra phải được làm sạch TRƯỚC khi ghép vào chuỗi HTML của
   file .doc. Trong React thì JSX tự escape, nhưng file Word thì không. */
const AMP = "&" + "amp;", LT = "&" + "lt;", GT = "&" + "gt;", QUOT = "&" + "quot;";
const esc = (x) => String(x == null ? "" : x)
  .replace(/&/g, AMP).replace(/</g, LT).replace(/>/g, GT).replace(/"/g, QUOT);

/* ─── Gộp biến thể tên phần bài ────────────────────────────────────────
   Cùng một bài giảng xuất hiện hai kiểu trong dữ liệu: bản có dấu
   "Day03: Từ chatbot đến agentic agent react (Mr. [HV])" và bản slug
   "day03-tu-chatbot-den-agentic-agent-react". In cả hai lên cùng một thẻ là
   nói một chuyện hai lần — 11/19 thẻ đang mắc lỗi này. Chuẩn hoá NFD về cùng
   một khoá rồi giữ bản người đọc được. */
function partKey(p) {
  return String(p || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function dedupeParts(parts) {
  const out = [];
  (parts || []).forEach((p) => {
    const k = partKey(p);
    if (!k) return;
    for (let i = 0; i < out.length; i++) {
      const ok = partKey(out[i]);
      if (ok === k || (ok.length >= 12 && k.length >= 12 && (ok.indexOf(k) === 0 || k.indexOf(ok) === 0))) {
        /* giữ bản dễ đọc hơn: bản có khoảng trắng/chữ hoa, không phải slug */
        if (/[ A-Z]/.test(p) && !/[ A-Z]/.test(out[i])) out[i] = p;
        return;
      }
    }
    out.push(p);
  });
  return out;
}
/* Nhãn nào có mặt ở quá nửa số cụm thì không phân biệt được gì giữa các cụm —
   nói MỘT LẦN ở đầu danh sách, đừng lặp 16 lần. */
function commonParts(cls) {
  const n = cls.length;
  if (n < 4) return {};
  const cnt = {}, label = {};
  cls.forEach((c) => {
    const seen = {};
    dedupeParts(c.parts).forEach((p) => {
      const k = partKey(p);
      if (seen[k]) return;
      seen[k] = 1;
      cnt[k] = (cnt[k] || 0) + 1;
      if (!label[k] || /[ A-Z]/.test(p)) label[k] = p;
    });
  });
  const out = {};
  Object.keys(cnt).forEach((k) => { if (cnt[k] / n > 0.5) out[k] = label[k]; });
  return out;
}

/* ─── Tính lại cụm sau khi Lab Coach chuyển câu ra rải rác ─────────────
   Model chỉ quyết MỘT việc: câu nào thuộc cụm nào. Số lượt, số người, cờ cụm
   yếu, cờ tín hiệu lệch đều do code này tính lại từ danh sách thành viên. */
function liveClusters(s, mv, th) {
  if (!s) return [];
  return (s.clusters || []).map((c, i) => {
    const pk = c.people_key || [], kept = [], keys = [];
    (c.turn_ids || []).forEach((t, j) => { if (!mv[t]) { kept.push(t); if (pk[j] != null) keys.push(pk[j]); } });
    const removed = (c.turn_ids || []).length - kept.length;
    if (!removed) return { ...c, _i: i, _removed: 0 };
    const cnt = {};
    let top = 0;
    keys.forEach((k) => { cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] > top) top = cnt[k]; });
    const people = Object.keys(cnt).length;
    const exact = pk.length === (c.turn_ids || []).length;
    return {
      ...c, _i: i, _removed: removed, turns: kept.length,
      people: exact ? people : c.people, _approx: !exact,
      weak: exact ? people <= (th.weak_max_people || 2) : c.weak,
      skew: exact ? (kept.length >= (th.skew_min_turns || 4) && top / kept.length >= (th.skew_ratio || 0.5)) : c.skew,
      skew_top_share: exact && kept.length ? Math.round((top / kept.length) * 100) / 100 : c.skew_top_share,
    };
  });
}

const ANSWER_FIELDS = [
  ["misread", "Học viên đang hiểu sai ở đâu", "suy từ chính chữ họ viết, không phải chẩn đoán chung chung"],
  ["different", "Giảng lại theo cách KHÁC slide", "học viên đã đọc slide rồi mà vẫn hỏi — lặp lại cách cũ thì vô ích"],
  ["example", "Ví dụ cụ thể", ""],
  ["check", "Câu kiểm tra nhanh", "phân biệt hiểu thật với thuộc lòng"],
];

/* ══════════ COMPONENT ══════════ */
export default function Clusters({ sess, setSess }) {
  const root = useRef(null);
  useReveal(root);

  const [th, setTh] = useState(() => ({ ...TH }));
  const [serverUp, setServerUp] = useState(null);
  const [sort, setSort] = useState(() => lsGet("cp.sort", "turns"));
  const [filter, setFilter] = useState(() => {
    const f = lsGet("cp.filter", "all");
    return ["all", "strong", "weak", "skew"].includes(f) ? f : "all";
  });
  /* Tổng quan ghi khoá "cp.goto" khi người dùng bấm "Đọc câu nguyên văn →" ở
     một cụm cụ thể. Đọc nó MỘT LẦN rồi xoá, để lần sau vào tab không tự mở lại
     một cụm mà người dùng không hề bấm. */
  const [open, setOpen] = useState(() => {
    try {
      const g = sessionStorage.getItem("cp.goto");
      if (g) { sessionStorage.removeItem("cp.goto"); return { [g]: 1 }; }
    } catch { /* chế độ riêng tư */ }
    return {};
  });
  const [sel, setSel] = useState({});
  const [movedMap, setMovedMap] = useState({});
  const [bandOpen, setBandOpen] = useState({});
  const [answers, setAnswers] = useState({});
  const [faq, setFaq] = useState({ running: false, items: null, err: null });

  /* Dò một lần: mở bằng file:// thì không có máy chủ, nút soạn nội dung sẽ nói
     rõ lý do thay vì quay vòng mãi. Ngưỡng lấy từ máy chủ nếu có. */
  useEffect(() => {
    let alive = true;
    api.health()
      .then((h) => { if (!alive) return; setServerUp(true); if (h && h.thresholds) setTh((t) => ({ ...t, ...h.thresholds })); })
      .catch(() => { if (alive) setServerUp(false); });
    return () => { alive = false; };
  }, []);

  const all = D.sessions || [];
  const s = all[sess] || null;
  const sKey = s ? s.key : "_";

  /* Đọc thẳng localStorage khi chưa có trong state: tránh một nhịp render đầu
     hiện số CHƯA trừ các câu Lab Coach đã chuyển đi. */
  const mv = useMemo(
    () => (movedMap[sKey] ? movedMap[sKey] : (lsGet("cp.moved." + sKey, {}) || {})),
    [movedMap, sKey]
  );
  const nMoved = useMemo(() => Object.keys(mv).filter((k) => mv[k]).length, [mv]);

  const writeMoved = (next) => {
    setMovedMap((m) => ({ ...m, [sKey]: next }));
    lsSet("cp.moved." + sKey, next);
  };
  const toggleMove = (tid) => {
    const next = { ...mv };
    if (next[tid]) delete next[tid]; else next[tid] = 1;
    writeMoved(next);
  };

  const sorted = useMemo(() => {
    const a = liveClusters(s, mv, th).slice();
    a.sort((x, y) => {
      if (!!x.weak !== !!y.weak) return x.weak ? 1 : -1;
      if ((x.turns === 0) !== (y.turns === 0)) return x.turns === 0 ? 1 : -1;
      return sort === "people" ? (y.people - x.people) || (y.turns - x.turns)
                               : (y.turns - x.turns) || (y.people - x.people);
    });
    return a;
  }, [s, mv, th, sort]);

  const cls = useMemo(() => {
    if (filter === "strong") return sorted.filter((c) => !c.weak);
    if (filter === "weak") return sorted.filter((c) => c.weak);
    if (filter === "skew") return sorted.filter((c) => c.skew);
    return sorted;
  }, [sorted, filter]);

  /* maxT tính trên TOÀN BỘ cụm của buổi, KHÔNG phải trên danh sách đã lọc.
     Nếu tính trên danh sách lọc thì cụm 6 lượt sẽ vẽ hết chiều rộng khi đang
     lọc "Cụm yếu" — cùng một giá trị hiện dài ngắn khác nhau tuỳ bộ lọc, tức
     thanh đang đo THỨ HẠNG chứ không đo SỐ LƯỢT. */
  const maxT = useMemo(() => Math.max(1, ...sorted.map((x) => x.turns || 0)), [sorted]);

  const common = useMemo(() => commonParts(cls), [cls]);
  const commonKeys = Object.keys(common);

  const scatterTotal = (s ? scatterCount(s) : 0) + nMoved;

  const wmax = th.weak_max_people || 2;
  const big = Math.max(wmax + 1, Math.ceil(((s && s.students) || 0) * 0.1));

  /* Ba băng theo SỐ NGƯỜI, vì đó là thứ quyết định "cả lớp kẹt" hay "một bạn
     hỏi nhiều". Ngưỡng in thẳng lên màn hình để kiểm tay được bằng cột số
     người, và đọc từ TH chứ không gõ cứng. Tên băng MÔ TẢ, không khuyên —
     hệ thống đưa vật liệu, không khuyến nghị. */
  const bands = [
    { k: "b1", nm: `Từ ${big} học viên trở lên cùng hỏi`,
      sub: "Đủ đông để đáng dành thời gian trên lớp.",
      rows: cls.filter((c) => !c.weak && c.people >= big) },
    { k: "b2", nm: `Từ ${wmax + 1} đến ${big - 1} học viên`,
      sub: "Có thật nhưng chưa phải cả lớp — cân nhắc gộp vào phần khác.",
      rows: cls.filter((c) => !c.weak && c.people < big) },
    { k: "b3", nm: `Cụm yếu — ${wmax} người trở xuống`,
      sub: "Chưa đủ căn cứ để kết luận cả lớp kẹt. Vẫn hiện đủ, không xoá.",
      rows: cls.filter((c) => c.weak) },
  ];
  const onlyBand = bands.filter((b) => b.rows.length).length === 1;

  const counts = {
    all: sorted.length,
    strong: sorted.filter((c) => !c.weak).length,
    weak: sorted.filter((c) => c.weak).length,
    skew: sorted.filter((c) => c.skew).length,
  };

  /* ─── chọn cụm ─── */
  const picked = cls.filter((c) => sel[sKey + "#" + c._i]);
  const nsel = picked.length;
  const tsel = picked.reduce((a, c) => a + c.turns, 0);
  const psel = picked.reduce((a, c) => Math.max(a, c.people), 0);

  const setFilterP = (k) => { setFilter(k); lsSet("cp.filter", k); };
  const setSortP = (k) => { if (!k) return; setSort(k); lsSet("cp.sort", k); };

  /* ─── Soạn nội dung ôn ─── */
  const requestAnswer = (id, c) => {
    if (answers[id] && answers[id].data) { setAnswers((a) => { const n = { ...a }; delete n[id]; return n; }); return; }
    if (serverUp === false) {
      setAnswers((a) => ({ ...a, [id]: { err: "Cần máy chủ cục bộ để gọi AI. Chạy: python codebase/serve.py" } }));
      return;
    }
    setAnswers((a) => ({ ...a, [id]: { loading: true } }));
    api.answer({
      lecture: (s.lecture_title ? s.lecture_title + " · " : "") + s.lecture,
      name: c.name, why: c.why, people: c.people,
      turn_ids: (c.turn_ids || []).filter((x) => !mv[x]),
      questions: (c.examples || []).map((e) => e.q),
    })
      .then((d) => setAnswers((a) => ({ ...a, [id]: { data: d } })))
      .catch((e) => setAnswers((a) => ({ ...a, [id]: { err: String(e.message || e) } })));
  };

  /* ─── Xuất hỏi đáp cho VLearn ─── */
  const startFaq = () => {
    if (!s) return;
    if (serverUp === false) { setFaq({ running: false, items: null, err: "Cần máy chủ cục bộ. Chạy: python codebase/serve.py" }); return; }
    const use = picked.filter((c) => c.turns > 0);
    if (!use.length) return;
    const items = use.map((c) => ({ name: c.name, people: c.people, turns: c.turns, state: "cho" }));
    setFaq({ running: true, items, err: null });
    const lecture = (s.lecture_title ? s.lecture_title + " · " : "") + s.lecture;
    const jobs = use.map((c, i) =>
      api.faq({ lecture, name: c.name, people: c.people, turn_ids: (c.turn_ids || []).filter((t) => !mv[t]) })
        .then((d) => setFaq((f) => {
          if (!f.items) return f;
          const it = f.items.slice();
          it[i] = { ...it[i], state: "xong", d, on: !!d.publishable };
          return { ...f, items: it };
        }))
        .catch((e) => setFaq((f) => {
          if (!f.items) return f;
          const it = f.items.slice();
          it[i] = { ...it[i], state: "loi", err: String(e.message || e) };
          return { ...f, items: it };
        }))
    );
    Promise.all(jobs).then(() => setFaq((f) => ({ ...f, running: false })));
  };

  const faqDoc = () => {
    const items = faq.items || [];
    const on = items.filter((x) => x.on && x.d && x.d.publishable);
    const off = items.filter((x) => x.d && !x.d.publishable);
    const title = "Hỏi đáp thường gặp — " + ((s.lecture_title ? s.lecture_title + " · " : "") + s.lecture);
    let b = "<h1>" + esc(title) + "</h1>";
    b += '<p class="note">Tổng hợp từ câu hỏi thật của học viên khoá trước trong chính buổi học này. ' +
      "Bản nháp do AI soạn từ " + fmt(s.real_turns) + " lượt hỏi của " + s.students + " học viên, " +
      "<b>đã được Lab Coach đọc và duyệt</b> trước khi đăng. Thấy chỗ nào chưa đúng, báo lại để sửa.</p>";
    on.forEach((it, i2) => {
      const d = it.d;
      b += "<h2>" + (i2 + 1) + ". " + esc(d.question) + "</h2>";
      b += "<p>" + esc(d.answer) + "</p>";
      if ((d.variants || []).length) {
        b += '<p class="alt"><i>Câu này còn hay được hỏi theo kiểu:</i> ' +
          d.variants.map((v) => "&ldquo;" + esc(v) + "&rdquo;").join(" &middot; ") + "</p>";
      }
      b += '<p class="meta">' + it.people + " học viên khoá trước đã hỏi chuyện này (" + it.turns + " lượt).</p>";
      if (i2 < on.length - 1) b += "<hr>";
    });
    if (off.length) {
      /* nội dung này do model sinh ra: phải làm sạch trước khi đặt vào HTML
         comment, nếu không một dấu "--" hay ">" trong tên cụm sẽ làm vỡ comment
         và đẩy chữ ra file. */
      const safe = (x) => String(x == null ? "" : x).replace(/[<>]/g, " ").replace(/-{2,}/g, "-");
      b += "<!-- Hệ thống đã tự loại " + off.length + " cụm khỏi bản hỏi đáp này: " +
        off.map((it) => safe(it.name) + " — " + safe(it.d.refuse_reason)).join(" | ") + " -->";
    }
    // Word mở được HTML mang đuôi .doc — cách này giữ được tiêu đề, in đậm, danh
    // sách mà không cần thư viện ngoài. Có BOM UTF-8 để Word đọc đúng tiếng Việt.
    return "﻿<html xmlns:o='urn:schemas-microsoft-com:office:office' " +
      "xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>" +
      "<head><meta charset='utf-8'><title>" + esc(title) + "</title>" +
      "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom>" +
      "</w:WordDocument></xml><![endif]-->" +
      "<style>@page{size:A4;margin:2.2cm}" +
      "body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5;color:#111}" +
      "h1{font-family:Arial,sans-serif;font-size:19pt;margin:0 0 4pt}" +
      "h2{font-family:Arial,sans-serif;font-size:14pt;margin:18pt 0 5pt}" +
      "p{margin:0 0 9pt;text-align:justify}" +
      "p.note{font-size:10.5pt;color:#444;border-left:3pt solid #2563eb;padding-left:9pt;margin-bottom:16pt}" +
      "p.alt{font-size:11pt;color:#333}" +
      "p.meta{font-size:9.5pt;color:#666}" +
      "hr{border:0;border-top:1pt solid #ddd;margin:16pt 0}" +
      "</style></head><body>" + b + "</body></html>";
  };

  const downloadFaq = () => {
    const blob = new Blob([faqDoc()], { type: "application/msword;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hoi-dap-" + s.key + ".doc";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  };

  /* ══════════ dựng hình ══════════ */
  if (!s) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 md:px-8 py-10">
        <Banner kind="warn" tag="TRỐNG">
          Chưa có dữ liệu buổi học. Chạy{" "}
          <code className="rounded bg-[color:var(--surface-2)] px-1.5 py-0.5 text-[12px]">
            python codebase/run_cluster.py --course K4P1 --lecture D04 --out codebase/ui/data/session-K4P1-D04.json
          </code>{" "}
          rồi{" "}
          <code className="rounded bg-[color:var(--surface-2)] px-1.5 py-0.5 text-[12px]">python codebase/ui/build_data.py</code>.
        </Banner>
      </div>
    );
  }

  const bandTier = {
    b1: { bar: "h-2.5", name: "text-[16.5px]", pad: "p-5" },
    b2: { bar: "h-2", name: "text-[15px]", pad: "p-4" },
    b3: { bar: "h-1.5", name: "text-[14px]", pad: "p-4" },
  };

  const cardOf = (c, rank, band) => {
    const id = sKey + "#" + c._i;
    const isOpen = !!open[id];
    const isSel = !!sel[id];
    const first = rank === 0 && band === "b1" && !s.sparse && filter === "all";
    const parts = dedupeParts(c.parts).filter((p) => !common[partKey(p)]);
    const t = bandTier[band];
    const a = answers[id];
    const pct = Math.max(3, Math.round((c.turns / maxT) * 100));

    return (
      <li
        key={id}
        className={
          "rounded-xl2 border bg-[color:var(--panel)] shadow-card transition-colors " +
          (isSel ? "border-[color:var(--primary)]" : "border-[color:var(--line)]")
        }
      >
        <div className={"flex gap-3 " + t.pad}>
          <Checkbox
            size="small"
            checked={isSel}
            onChange={(e) => setSel((x) => { const n = { ...x }; if (e.target.checked) n[id] = 1; else delete n[id]; return n; })}
            inputProps={{ "aria-label": "Chọn cụm " + c.name }}
            className="!p-0 !mt-0.5 !self-start"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={"font-semibold tracking-tight " + t.name}>{c.name}</span>
              {first && <Chip tone="top">đông nhất</Chip>}
              {c.skew && <Chip tone="warn">tín hiệu lệch</Chip>}
              {c.weak && <Chip tone="n">cụm yếu</Chip>}
            </div>

            {parts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {parts.map((p, i) => (
                  <span key={i} className="rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[11.5px] text-[color:var(--ink-2)]">
                    {p}
                  </span>
                ))}
              </div>
            )}

            {/* Thanh tỉ lệ: track LUÔN rộng hết, chỉ chiều cao đổi theo băng —
                thu track lại là làm cùng một giá trị trông khác nhau. */}
            <div className="mt-3 flex items-center gap-4 flex-wrap">
              <div className={"flex-1 min-w-[140px] rounded-full bg-[color:var(--line-2)] overflow-hidden " + t.bar}>
                <div
                  className={"rounded-full transition-[width] duration-700 ease-out " + t.bar}
                  style={{ width: pct + "%", background: "var(--s1)" }}
                />
              </div>
              <div className="flex gap-4 text-[13px] text-[color:var(--ink-2)] shrink-0">
                <span><b className="num text-[color:var(--ink)]">{c.turns}</b> lượt</span>
                <span><b className="num text-[color:var(--ink)]">{c.people}</b> người</span>
              </div>
            </div>

            {c.why && <p className="mt-2.5 text-[13.5px] leading-relaxed text-[color:var(--ink-2)]">{c.why}</p>}

            {c.skew && (
              <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--warn-ink)]">
                Một học viên chiếm {Math.round((c.skew_top_share || 0) * 100)}% lượt của cụm — việc cần làm là nhắn riêng,
                không phải dành 15 phút của cả lớp.
              </p>
            )}

            {c._removed > 0 && (
              <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--ink-2)]">
                Đã chuyển {c._removed} câu ra nhóm rải rác — số lượt{c._approx ? "" : ", số người và các cờ"} đã tính lại.
                {c.turns === 0 ? " Cụm đã rỗng; mở ra bấm “Hoàn tác”." : ""}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="small" variant="text"
                onClick={() => setOpen((o) => { const n = { ...o }; if (n[id]) delete n[id]; else n[id] = 1; return n; })}
                aria-expanded={isOpen}
                className="!rounded-full !px-3 !text-[13px] !text-[color:var(--primary)]"
              >
                {isOpen ? "Ẩn" : "Đọc"} {(c.examples || []).length} câu nguyên văn
              </Button>
              {c.turns > 0 && (
                <Button
                  size="small" variant="outlined"
                  onClick={() => requestAnswer(id, c)}
                  disabled={!!(a && a.loading)}
                  className="!rounded-full !px-3 !text-[13px] !border-[color:var(--line)] !text-[color:var(--ink-2)]"
                >
                  {a && a.loading
                    ? <><CircularProgress size={13} color="inherit" className="!mr-2" /> Đang soạn…</>
                    : (a && a.data ? "Ẩn nội dung ôn" : "✨ Soạn nội dung ôn")}
                </Button>
              )}
            </div>

            <AnswerBox a={a} />
          </div>
        </div>

        {isOpen && (
          <div className="border-t border-[color:var(--line)] bg-[color:var(--surface-2)] px-4 py-4 rounded-b-xl2">
            <p className="text-[12px] font-semibold uppercase tracking-[.08em] text-[color:var(--muted)]">
              Câu nguyên văn, ID trỏ về dòng log — không viết lại, không tóm tắt
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {(c.examples || []).map((e) => (
                <li
                  key={e.turn_id}
                  className={
                    "flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl2 border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-2 " +
                    (mv[e.turn_id] ? "opacity-60" : "")
                  }
                >
                  <span className="font-mono text-[11.5px] text-[color:var(--muted)] shrink-0">{e.turn_id}</span>
                  <span className={"flex-1 min-w-[180px] text-[13.5px] " + (mv[e.turn_id] ? "line-through" : "")}>“{e.q}”</span>
                  <Button
                    size="small" variant="text" onClick={() => toggleMove(e.turn_id)}
                    className="!rounded-full !text-[12.5px] !px-3 !text-[color:var(--ink-2)]"
                  >
                    {mv[e.turn_id] ? "Hoàn tác" : "Không thuộc cụm"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </li>
    );
  };

  return (
    <div ref={root} className="mx-auto max-w-[1180px] px-4 md:px-8 py-10 pb-28">
      {/* ── đầu trang ── */}
      <header className="reveal">
        <Kicker>Cụm vấn đề</Kicker>
        <h1 className="text-[clamp(28px,4.4vw,44px)] font-semibold tracking-tight leading-[1.08]">
          Hàng trăm câu hỏi, vài chỗ thật sự kẹt
        </h1>
        <p className="mt-3 max-w-[64ch] text-[15.5px] leading-relaxed text-[color:var(--ink-2)]">
          Mở một cụm để đọc câu nguyên văn · bấm “Không thuộc cụm” để sửa bằng tay. Mọi con số dưới đây do code
          tính lại từ danh sách thành viên cụm, không phải do model tự khai.
        </p>
      </header>

      {/* ── bộ chọn buổi + xếp theo ── */}
      <Card className="reveal mt-7 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <FormControl size="small" className="min-w-[280px] flex-1">
            <InputLabel id="cp-sess-lb">Buổi học</InputLabel>
            <Select
              labelId="cp-sess-lb" label="Buổi học" value={sess}
              onChange={(e) => { setSess(Number(e.target.value)); lsSet("cp.sess", Number(e.target.value)); setSel({}); setOpen({}); setFaq({ running: false, items: null, err: null }); }}
              className="!rounded-full"
            >
              {/* Hiện theo thứ tự buổi, gần nhất lên đầu — nhưng value vẫn là CHỈ SỐ
                  TRONG MẢNG GỐC. Đổi thứ tự hiển thị mà quên chỗ này là chọn một
                  buổi ra một buổi khác. */}
              {sessionsByDate().map((x) => {
                const i = all.indexOf(x);
                return (
                  <MenuItem key={x.key} value={i}>
                    {(x.lecture_title ? x.lecture_title + " · " : "") + x.lecture}
                    {x.first_day ? " · " + dmy(x.first_day) : ""}
                    {" — " + fmt(x.real_turns) + " lượt thực"}
                    {x.sparse ? " — quá ít câu để gom" : ""}
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <div className="flex items-center gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-[.08em] text-[color:var(--muted)]">Xếp theo</span>
            <ToggleButtonGroup
              exclusive size="small" value={sort} onChange={(_, v) => setSortP(v)} aria-label="Xếp cụm theo"
            >
              <ToggleButton value="turns" className="!rounded-l-full !text-[12.5px] !px-3.5 !border-[color:var(--line)]">Số lượt hỏi</ToggleButton>
              <ToggleButton value="people" className="!rounded-r-full !text-[12.5px] !px-3.5 !border-[color:var(--line)]">Số người hỏi</ToggleButton>
            </ToggleButtonGroup>
          </div>

          <span className="ml-auto text-[12.5px] text-[color:var(--muted)]">
            {s.sparse ? "QUÁ ÍT CÂU — KHÔNG GOM" : "ĐÃ GOM " + fmt(s.real_turns) + " LƯỢT · " + s.students + " học viên"}
          </span>
        </div>

        {/* Dòng luôn hiện phải chở đủ ba con số bất lợi: cụm yếu, tín hiệu lệch,
            lượt chưa quy được. Không được đẩy xuống dưới một cú bấm. */}
        <p className="mt-4 text-[14px] text-[color:var(--ink-2)]">
          <b className="num text-[color:var(--ink)]">{counts.all}</b> cụm vấn đề
          {counts.weak > 0 && <> · <b className="num">{counts.weak}</b> cụm yếu</>}
          {counts.skew > 0 && <> · <b className="num">{counts.skew}</b> tín hiệu lệch</>}
          {" · "}<b className="num">{fmt(scatterTotal)}</b> lượt chưa quy được vào đâu
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { k: "all", nm: "Tất cả", n: counts.all },
            { k: "strong", nm: "Cụm mạnh", n: counts.strong },
            { k: "weak", nm: "Cụm yếu", n: counts.weak },
            { k: "skew", nm: "Tín hiệu lệch", n: counts.skew },
          ].map((d) => (
            <Button
              key={d.k} size="small" variant={filter === d.k ? "contained" : "outlined"}
              aria-pressed={filter === d.k} onClick={() => setFilterP(d.k)}
              className={
                "!rounded-full !text-[13px] !px-4 " +
                (filter === d.k
                  ? "!bg-[color:var(--ink)] !text-[color:var(--panel)]"
                  : "!border-[color:var(--line)] !text-[color:var(--ink-2)]")
              }
            >
              {d.nm} <span className="num ml-1.5 opacity-70">{d.n}</span>
            </Button>
          ))}
        </div>

        <Disclosure id="cum.gloss" summary="Bốn chữ này nghĩa là gì?">
          <dl className="grid gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-2">
            <div><dt className="font-semibold">Cụm mạnh</dt><dd className="text-[color:var(--ink-2)]">Từ {wmax + 1} học viên khác nhau trở lên cùng hỏi một chỗ.</dd></div>
            <div><dt className="font-semibold">Cụm yếu</dt><dd className="text-[color:var(--ink-2)]">Chỉ {wmax} người trở xuống, dù nhiều lượt. Chưa đủ để kết luận cả lớp kẹt.</dd></div>
            <div><dt className="font-semibold">Tín hiệu lệch</dt><dd className="text-[color:var(--ink-2)]">Một học viên chiếm từ {Math.round((th.skew_ratio || 0.5) * 100)}% lượt của cụm trở lên — con số trông to nhưng là của một người.</dd></div>
            <div><dt className="font-semibold">Chưa quy được vào đâu</dt><dd className="text-[color:var(--ink-2)]">Câu quá ngắn, câu hành chính, câu lạc đề. Hệ thống <b>không</b> nhét chúng vào cụm gần nhất cho đẹp số.</dd></div>
          </dl>
        </Disclosure>
      </Card>

      {s.sparse && (
        <div className="mt-6">
          <Banner kind="warn" tag="QUÁ ÍT CÂU">{s.sparse_reason}</Banner>
        </div>
      )}
      {serverUp === false && (
        <div className="mt-6">
          <Banner kind="warn" tag="KHÔNG CÓ MÁY CHỦ">
            Đang mở không qua máy chủ cục bộ, nên nút “Soạn nội dung ôn” và “Xuất hỏi đáp” sẽ không gọi được AI.
            Chạy <code className="rounded bg-[color:var(--surface-2)] px-1.5 py-0.5 text-[12px]">python codebase/serve.py</code>.
            Mọi số đếm trên trang vẫn đúng — chúng không cần AI.
          </Banner>
        </div>
      )}

      {/* ── tiêu đề danh sách + bảng đối chiếu ── */}
      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold tracking-tight">
          {cls.length} cụm · xếp theo {sort === "people" ? "số người hỏi" : "số lượt hỏi"}
          {filter !== "all" ? " · đang lọc" : ""}
        </h2>
        <div className="flex items-center gap-3">
          {nMoved > 0 && (
            <>
              <span className="text-[13px] text-[color:var(--ink-2)]"><b className="num">{nMoved}</b> câu đã sửa bằng tay</span>
              <Button size="small" variant="text" onClick={() => writeMoved({})}
                className="!rounded-full !text-[12.5px] !text-[color:var(--primary)]">
                Hoàn tác tất cả
              </Button>
            </>
          )}
        </div>
      </div>
      <p className="mt-1 text-[13px] text-[color:var(--muted)]">
        Thanh trong mỗi thẻ đo <b>số lượt hỏi</b>, cùng một thang cho cả buổi — cụm dài nhất là {maxT} lượt.
        Thang không đổi theo bộ lọc.
      </p>
      <TableView
        label="Xem dạng bảng — toàn bộ cụm đang hiện"
        cols={[{ t: "Cụm" }, { t: "Lượt", n: 1 }, { t: "Người", n: 1 }, { t: "Băng" }, { t: "Cờ" }]}
        rows={cls.map((c) => [
          c.name,
          c.turns,
          c.people,
          c.weak ? "Cụm yếu" : (c.people >= big ? "≥ " + big + " học viên" : (wmax + 1) + "–" + (big - 1) + " học viên"),
          [c.skew ? "tín hiệu lệch" : "", c.weak ? "cụm yếu" : "", c._removed ? c._removed + " câu đã chuyển ra" : ""].filter(Boolean).join(" · ") || "—",
        ])}
      />

      {/* Nhãn chung nói MỘT LẦN ở đầu danh sách, không lặp ở từng thẻ. */}
      {commonKeys.length > 0 && (
        <p className="mt-5 rounded-xl2 border border-dashed border-[color:var(--line)] px-4 py-3 text-[13.5px] text-[color:var(--ink-2)]">
          Mọi cụm dưới đây đều thuộc{" "}
          {commonKeys.map((k) => (
            <span key={k} className="mx-1 inline-block rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[12px] text-[color:var(--ink)]">
              {common[k]}
            </span>
          ))}{" "}
          — bên trong mỗi cụm chỉ còn nhãn khác nhau.
        </p>
      )}

      {/* ── ba băng theo số người ── */}
      {bands.map((b) => {
        if (!b.rows.length) return null;
        /* Băng cụm yếu gập sẵn khi đang xem tất cả — nhưng nếu người dùng vừa
           bấm đúng bộ lọc "Cụm yếu", hoặc nó là băng DUY NHẤT có cụm, thì gập
           lại là trả về một trang trống đúng lúc họ xin thấy. Con số "N cụm"
           vẫn nằm ngay trên nhãn, nên không có chuyện nó biến mất khỏi màn hình. */
        const collapsible = b.k === "b3" && filter !== "weak" && !onlyBand;
        const isOpen = collapsible ? !!bandOpen.b3 : true;
        return (
          <section key={b.k} className="mt-7">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-[color:var(--line)] pt-4">
              <h3 className="text-[15px] font-semibold tracking-tight">{b.nm}</h3>
              <span className="num rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[12px] text-[color:var(--ink-2)]">
                {b.rows.length} cụm
              </span>
              <span className="text-[13px] text-[color:var(--muted)]">{b.sub}</span>
              {collapsible && (
                <Button size="small" variant="text" onClick={() => setBandOpen((o) => ({ ...o, b3: !o.b3 }))}
                  aria-expanded={isOpen} className="!ml-auto !rounded-full !text-[12.5px] !text-[color:var(--primary)]">
                  {isOpen ? "▾ Thu gọn" : "▸ Mở " + b.rows.length + " cụm yếu"}
                </Button>
              )}
            </div>
            {isOpen && (
              <ol className="mt-4 flex flex-col gap-3">
                {b.rows.map((c, r) => cardOf(c, r, b.k))}
              </ol>
            )}
          </section>
        );
      })}

      {cls.length === 0 && (
        <p className="mt-6 rounded-xl2 border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-6 text-center text-[14px] text-[color:var(--ink-2)]">
          Không có cụm nào khớp bộ lọc đang bật.
        </p>
      )}

      {/* ── rải rác ── */}
      <Card className="mt-8 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <strong className="text-[15px] tracking-tight">Rải rác / không phân loại được</strong>
          <span className="num text-[13px] text-[color:var(--ink-2)]">{fmt(scatterTotal)} lượt</span>
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--ink-2)]">
          Câu quá ngắn, câu hành chính, câu lạc đề. Vẫn hiện để Lab Coach tự đọc — không nhét vào cụm gần nhất.
        </p>
        {s.scatter && s.scatter.examples_withheld && (
          <div className="mt-3">
            <Banner kind="warn" tag="ẨN">
              Chu kỳ này chỉ có <b>{s.students} học viên</b> hỏi. Dưới ngưỡng {th.min_students_for_examples || 3} người thì
              hệ thống <b>không hiện câu nguyên văn</b> — ba câu của một người không còn là bức tranh của lớp, mà là đọc
              trộm của một người. Số đếm vẫn hiện đầy đủ.
            </Banner>
          </div>
        )}
        <ul className="mt-3 flex flex-col gap-2">
          {((s.scatter && s.scatter.examples) || []).map((e) => (
            <li key={e.turn_id} className="flex flex-wrap items-baseline gap-x-3 rounded-xl2 bg-[color:var(--surface-2)] px-3 py-2">
              <span className="font-mono text-[11.5px] text-[color:var(--muted)]">{e.turn_id}</span>
              <span className="flex-1 min-w-[180px] text-[13.5px] text-[color:var(--ink-2)]">“{e.q}”</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* ── bảng duyệt hỏi đáp ── */}
      {faq.err && <div className="mt-8"><Banner kind="bad" tag="LỖI">{faq.err}</Banner></div>}
      {faq.items && (
        <Card className="mt-8 p-5">
          <h3 className="text-[16px] font-semibold tracking-tight">Hỏi đáp để đăng lên VLearn</h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--ink-2)]">
            Học viên khoá sau sẽ đọc thứ này một mình, không có giảng viên bên cạnh. Bỏ tick mục nào bạn chưa muốn đăng —
            file chỉ chứa mục còn tick.
          </p>
          {faq.running && (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-[color:var(--ink-2)]">
              <CircularProgress size={14} color="inherit" />
              Đang soạn {faq.items.filter((x) => x.state !== "cho").length}/{faq.items.length} mục…
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3">
            {faq.items.map((it, i) => {
              if (it.state === "cho") {
                return (
                  <div key={i} className="rounded-xl2 border border-[color:var(--line)] p-4">
                    <Skeleton variant="text" width="70%" /><Skeleton variant="text" width="90%" />
                  </div>
                );
              }
              if (it.state === "loi") {
                return (
                  <div key={i} className="rounded-xl2 border border-[color:var(--line)] p-4 opacity-70">
                    <div className="font-semibold text-[14px]">{it.name}</div>
                    <p className="mt-1 text-[13px] text-[color:var(--critical-ink)]">Không soạn được: {it.err}</p>
                  </div>
                );
              }
              const d = it.d, ok = !!d.publishable;
              return (
                <div key={i} className={"rounded-xl2 border border-[color:var(--line)] p-4 " + (it.on ? "" : "opacity-65")}>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      size="small" checked={!!it.on} disabled={!ok}
                      onChange={(e) => setFaq((f) => {
                        const items = f.items.slice();
                        items[i] = { ...items[i], on: e.target.checked };
                        return { ...f, items };
                      })}
                      inputProps={{ "aria-label": "Đăng mục này" }}
                      className="!p-0 !mt-0.5"
                    />
                    <span className="font-semibold text-[14.5px]">{ok ? d.question : it.name}</span>
                  </div>
                  {ok ? (
                    <>
                      <p className="mt-2 pl-7 text-[13.5px] leading-relaxed">{d.answer}</p>
                      <p className="mt-2 pl-7 text-[12.5px] text-[color:var(--muted)]">
                        <b>{it.people} học viên</b> đã hỏi chuyện này · {it.turns} lượt · {(d.variants || []).length} cách hỏi khác ·
                        tin cậy <b>{d.confidence || "?"}</b>
                      </p>
                      {d.needs_review && <p className="mt-1 pl-7 text-[12.5px] text-[color:var(--warn-ink)]">Cần bạn kiểm: {d.needs_review}</p>}
                    </>
                  ) : (
                    <p className="mt-2 pl-7 text-[12.5px] text-[color:var(--critical-ink)]">
                      Hệ thống từ chối đăng: {d.refuse_reason || "không phải câu hỏi kiến thức"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              variant="contained" onClick={downloadFaq}
              disabled={!faq.items.filter((x) => x.on).length}
              className="!rounded-full !bg-black hover:!bg-neutral-800 !text-[13.5px]"
            >
              ⭳ Tải file Word (.doc) — {faq.items.filter((x) => x.on).length} mục
            </Button>
            <Button variant="outlined" onClick={() => setFaq({ running: false, items: null, err: null })}
              className="!rounded-full !border-[color:var(--line)] !text-[color:var(--ink-2)] !text-[13.5px]">
              Đóng
            </Button>
            <span className="text-[12.5px] text-[color:var(--muted)]">
              File tải về máy bạn. Không có nút đăng thẳng lên VLearn — người đăng là bạn.
            </span>
          </div>
        </Card>
      )}

      {/* ── thanh dưới khi đã tick cụm ── */}
      {nsel > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[color:var(--line)] bg-[color:var(--panel)]/95 backdrop-blur px-4 py-3 shadow-float">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-3">
            <span className="text-[13.5px] text-[color:var(--ink-2)]">
              <b className="num text-[color:var(--ink)]">{nsel}</b> cụm đã chọn · {tsel} lượt hỏi · cụm đông nhất chạm {psel}/{s.students} học viên
            </span>
            <span className="ml-auto flex flex-wrap gap-2">
              <Tooltip title="Soạn bản hỏi đáp cho từng cụm đã chọn, rồi bạn duyệt lại trước khi tải file">
                <span>
                  <Button variant="contained" onClick={startFaq} disabled={faq.running}
                    className="!rounded-full !bg-black hover:!bg-neutral-800 !text-[13.5px]">
                    {faq.running
                      ? <><CircularProgress size={14} color="inherit" className="!mr-2" /> Đang soạn…</>
                      : "📄 Xuất hỏi đáp cho VLearn"}
                  </Button>
                </span>
              </Tooltip>
              <Button variant="outlined" onClick={() => { setSel({}); setFaq({ running: false, items: null, err: null }); }}
                className="!rounded-full !border-[color:var(--line)] !text-[color:var(--ink-2)] !text-[13.5px]">
                Bỏ chọn
              </Button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════ NỘI DUNG ÔN DO AI SOẠN ══════════
   Năm phần: bốn phần chính + chỗ cần tự kiểm. Gắn nhãn BẢN NHÁP ngay trên
   cùng — Lab Coach là người quyết định cuối cùng, đây là vật liệu. */
function AnswerBox({ a }) {
  if (!a) return null;
  if (a.loading) {
    return (
      <div className="mt-3 rounded-xl2 border border-[color:var(--line)] bg-[color:var(--surface-2)] p-4">
        <p className="flex items-center gap-2 text-[13px] text-[color:var(--ink-2)]">
          <CircularProgress size={14} color="inherit" /> Đang nhờ AI soạn nội dung ôn…
        </p>
      </div>
    );
  }
  if (a.err) {
    return (
      <div className="mt-3 rounded-xl2 border border-[color:var(--critical)] bg-[color:var(--panel)] p-4">
        <p className="text-[13px] text-[color:var(--critical-ink)]"><b>Không soạn được:</b> {a.err}</p>
      </div>
    );
  }
  const d = a.data;
  return (
    <div className="mt-3 rounded-xl2 border border-[color:var(--line)] bg-[color:var(--surface-2)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="warn">bản nháp</Chip>
        <span className="text-[12.5px] leading-relaxed text-[color:var(--ink-2)]">
          Lab Coach là người quyết định cuối cùng — đây là vật liệu, không phải chỉ thị.
          {d.minutes ? ` Ước lượng ~${d.minutes} phút trên lớp.` : ""} Độ chắc chắn model tự khai: <b>{d.confidence || "?"}</b>
        </span>
      </div>
      <dl className="mt-3 flex flex-col gap-3">
        {ANSWER_FIELDS.map((f) => (d[f[0]] ? (
          <div key={f[0]} className={"rounded-xl2 bg-[color:var(--panel)] px-3.5 py-3 " + (f[0] === "different" ? "border-l-[3px] border-[color:var(--primary)]" : "")}>
            <dt className="text-[13px] font-semibold">{f[1]}</dt>
            {f[2] && <dd className="text-[12px] text-[color:var(--muted)]">{f[2]}</dd>}
            <dd className="mt-1 text-[13.5px] leading-relaxed">{d[f[0]]}</dd>
          </div>
        ) : null))}
        {d.caveat && (
          <div className="rounded-xl2 border-l-[3px] border-[color:var(--warn)] bg-[color:var(--panel)] px-3.5 py-3">
            <dt className="text-[13px] font-semibold">Chỗ cần tự kiểm trước khi dùng</dt>
            <dd className="mt-1 text-[13.5px] leading-relaxed">{d.caveat}</dd>
          </div>
        )}
      </dl>
      {d.ai && (
        <p className="mt-3 text-[12px] text-[color:var(--muted)]">
          Soạn bằng <code>{d.ai.model}</code> · {fmt(d.ai.latency_ms)} ms · {fmt(d.ai.tokens_out)} token ra
        </p>
      )}
    </div>
  );
}
