import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";

import { D, TH, fmt, dmy, sessionsByDate, scatterCount } from "../lib/data";
import { GroupedBars, StackedBar, Columns, TableView, Legend } from "../ui/Charts";
import { useReveal, Kicker, Card, SectionTitle, Kpi, KpiGrid, Banner, Chip, Disclosure } from "../ui/Bits";
import Timeline from "../ui/Timeline";
import QuestionsDialog from "../ui/QuestionsDialog";

/* ══════════════════════════════════════════════════════════════════════════
   TAB TỔNG QUAN — dựng lại renderTong() của bản HTML một file.
   Chữ tiếng Việt bê nguyên từ bản cũ: nó đã qua biên tập, viết lại cho "hay
   hơn" là làm hỏng. Mọi con số bất lợi (cụm yếu, tín hiệu lệch, lượt chưa quy
   được, câu bấm nút đã loại) nằm ở tầng LUÔN HIỆN — không đẩy sau một cú bấm.
   TUYỆT ĐỐI không animate giá trị số: đã xảy ra thật, hiệu ứng đếm lên hiện
   509 trong khi sự thật là 511. Chuyển động chỉ áp cho hình học.
   ══════════════════════════════════════════════════════════════════════════ */

const HEAD = 6;                       // số thanh vẽ ở biểu đồ đầu, phần còn lại gập
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* chế độ riêng tư */ } };

/* Giống hệt niceMax trong Charts.jsx — hai biểu đồ (đầu + đuôi gập) BẮT BUỘC
   dùng chung một thang, không thì cụm 10 lượt vẽ dài ngang cụm 51 lượt. */
function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p) * p;
}

/* Lab Coach có thể gạt một lượt ra khỏi cụm ở tab "Cụm vấn đề". Danh sách đó
   sống trong localStorage theo khoá buổi; Tổng quan đọc lại để mọi con số ở
   đây khớp với thứ Lab Coach đang nhìn bên kia. */
const readMoved = (s) => (s ? lsGet("cp.moved." + s.key, {}) || {} : {});

/* Tính lại cụm sau khi trừ các lượt đã gạt: số lượt, số người, cờ cụm yếu và
   cờ tín hiệu lệch đều do code tính từ chính danh sách thành viên, không lấy
   lại số model nói. Thiếu people_key thì giữ nguyên cờ cũ và đánh dấu _approx. */
function liveClusters(s, moved) {
  if (!s || !s.clusters) return [];
  return s.clusters.map((c, i) => {
    const pk = c.people_key || [];
    const kept = [], keys = [];
    (c.turn_ids || []).forEach((t, j) => { if (!moved[t]) { kept.push(t); if (pk[j] != null) keys.push(pk[j]); } });
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
      weak: exact ? people <= (TH.weak_max_people || 2) : c.weak,
      skew: exact ? (kept.length >= (TH.skew_min_turns || 4) && top / kept.length >= (TH.skew_ratio || 0.5)) : c.skew,
      skew_top_share: exact && kept.length ? Math.round((top / kept.length) * 100) / 100 : c.skew_top_share,
    };
  });
}

function sortClusters(list, sort) {
  return list.slice().sort((x, y) => {
    if (!!x.weak !== !!y.weak) return x.weak ? 1 : -1;
    if ((x.turns === 0) !== (y.turns === 0)) return x.turns === 0 ? 1 : -1;
    return sort === "people" ? (y.people - x.people) || (y.turns - x.turns)
                             : (y.turns - x.turns) || (y.people - x.people);
  });
}

function applyFilter(list, filter) {
  if (filter === "strong") return list.filter((c) => !c.weak);
  if (filter === "weak") return list.filter((c) => c.weak);
  if (filter === "skew") return list.filter((c) => c.skew);
  return list;
}

function exportSession(s, all, moved) {
  const payload = {
    buoi: s.lecture, ten_buoi: s.lecture_title || null,
    luot_thuc: s.real_turns, hoc_vien: s.students, cau_mau_da_loai: s.preset_removed,
    ai: s.ai_call, sua_chua: s.repairs,
    cum: all.map((c) => ({
      ten: c.name, luot: c.turns, nguoi: c.people, yeu: c.weak, lech: c.skew,
      phan_bai: c.parts, turn_ids: c.turn_ids,
      vi_du: (c.examples || []).map((e) => ({ turn_id: e.turn_id, cau_hoi: e.q })),
    })),
    sua_tay_cua_lab_coach: Object.keys(moved).filter((k) => moved[k]),
  };
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "class-pulse-" + s.key + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

const Caption = ({ children }) => (
  <p className="text-[13px] leading-relaxed text-[color:var(--ink-2)] max-w-[74ch]">{children}</p>
);

/* ══════════ thanh công cụ: buổi học · xếp theo · xuất JSON ══════════ */
function Toolbar({ sess, setSess, sort, setSort, onExport, canExport }) {
  const ordered = useMemo(() => sessionsByDate(), []);
  return (
    <div className="flex flex-wrap items-center gap-3 mb-8">
      <FormControl size="small" className="min-w-[280px] grow sm:grow-0">
        <InputLabel id="cp-sess-lb">Buổi học</InputLabel>
        <Select
          labelId="cp-sess-lb" label="Buổi học" value={String(sess)}
          onChange={(e) => setSess(Number(e.target.value))}
          className="!rounded-full !bg-[color:var(--panel)]">
          {/* Hiện theo thứ tự buổi, gần nhất lên đầu — nhưng value vẫn là CHỈ SỐ
              TRONG MẢNG GỐC D.sessions. Đổi thứ tự hiển thị mà quên chỗ này là
              chọn một buổi ra một buổi khác. */}
          {ordered.map((x) => {
            const i = D.sessions.indexOf(x);
            return (
              <MenuItem key={x.key || i} value={String(i)}>
                {(x.lecture_title ? x.lecture_title + " · " : "") + x.lecture +
                 (x.first_day ? " · " + dmy(x.first_day) : "") +
                 " — " + fmt(x.real_turns) + " lượt thực" + (x.sparse ? " — quá ít câu để gom" : "")}
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>

      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold tracking-[.08em] uppercase text-[color:var(--muted)]">Xếp theo</span>
        <ToggleButtonGroup
          exclusive size="small" value={sort}
          onChange={(_e, v) => { if (v) { setSort(v); lsSet("cp.sort", v); } }}
          aria-label="Xếp cụm theo"
          className="!rounded-full overflow-hidden border border-[color:var(--line)] bg-[color:var(--panel)]">
          <ToggleButton value="turns" className="!rounded-full !border-0 !px-3.5 !py-1 !text-[13px] !normal-case">Số lượt hỏi</ToggleButton>
          <ToggleButton value="people" className="!rounded-full !border-0 !px-3.5 !py-1 !text-[13px] !normal-case">Số người hỏi</ToggleButton>
        </ToggleButtonGroup>
      </div>

      <Tooltip title="Tải cả buổi: cụm, số lượt, số người, cờ, câu nguyên văn và các lượt Lab Coach đã gạt ra">
        <span className="ml-auto">
          <Button onClick={onExport} disabled={!canExport} variant="outlined" size="small"
            startIcon={<FileDownloadOutlined fontSize="small" />}
            className="!rounded-full !border-[color:var(--line)] !text-[color:var(--ink-2)] !text-[13px]">
            Xuất JSON
          </Button>
        </span>
      </Tooltip>
    </div>
  );
}

/* ══════════ dòng tóm tắt gập được + 4 pill lọc + giải nghĩa ══════════ */
function FilterBox({ all, scatter, filter, setFilter }) {
  const defs = [
    { k: "all", nm: "Tất cả", n: all.length },
    { k: "strong", nm: "Cụm mạnh", n: all.filter((c) => !c.weak).length },
    { k: "weak", nm: "Cụm yếu", n: all.filter((c) => c.weak).length },
    { k: "skew", nm: "Tín hiệu lệch", n: all.filter((c) => c.skew).length },
  ];
  const nWeak = defs[2].n, nSkew = defs[3].n;
  const wmax = TH.weak_max_people || 2;

  /* Dòng summary LUÔN HIỆN phải chở đủ ba con số bất lợi: cụm yếu, tín hiệu
     lệch, lượt chưa quy được. Cờ tín hiệu lệch có đúng một nhiệm vụ — nói "con
     số này trông to nhưng là của một người" — nên đẩy nó ra sau một cú bấm là
     vô hiệu hoá chính nó. Chỉ HÀNG LỌC được gập. */
  const summary = (
    <span>
      <b className="num">{all.length}</b> cụm vấn đề
      {nWeak ? <> · <b className="num">{nWeak}</b> cụm yếu</> : null}
      {nSkew ? <> · <b className="num">{nSkew}</b> tín hiệu lệch</> : null}
      {" · "}<b className="num">{fmt(scatter)}</b> lượt chưa quy được vào đâu
      <span className="ml-2 font-normal text-[color:var(--muted)]">Lọc</span>
    </span>
  );

  return (
    <Card className="p-4 sm:p-5 mb-6">
      <Disclosure id="tong.filter" summary={summary} defaultOpen={filter !== "all"}>
        {/* Không in phần trăm ở hàng này: các ô chồng lấn nhau (một cụm mạnh
            cũng có thể có tín hiệu lệch) nên tổng cộng ra hơn 100% trong khi
            trình bày như một dải chia 100%. Tỉ lệ đúng và cộng đủ 100% nằm ở
            card "Thành phần lượt hỏi của buổi". */}
        <div className="flex flex-wrap gap-2">
          {defs.map((d) => {
            const on = filter === d.k;
            return (
              <Button key={d.k} type="button" onClick={() => setFilter(d.k)} aria-pressed={on}
                variant={on ? "contained" : "outlined"} size="small"
                className={"!rounded-full !text-[13px] !py-1 " + (on
                  ? "!bg-[color:var(--ink)] !text-[color:var(--panel)]"
                  : "!border-[color:var(--line)] !text-[color:var(--ink-2)]")}>
                {d.nm} <span className="num ml-1.5 opacity-70">{d.n}</span>
              </Button>
            );
          })}
        </div>
        <Disclosure id="tong.gloss" summary="Bốn chữ này nghĩa là gì?">
          <dl className="grid gap-x-5 gap-y-2 text-[13px] leading-relaxed"
              style={{ gridTemplateColumns: "max-content 1fr" }}>
            <dt className="font-semibold">Cụm mạnh</dt>
            <dd className="text-[color:var(--ink-2)] m-0">Từ {wmax + 1} học viên khác nhau trở lên cùng hỏi một chỗ.</dd>
            <dt className="font-semibold">Cụm yếu</dt>
            <dd className="text-[color:var(--ink-2)] m-0">Chỉ {wmax} người trở xuống, dù nhiều lượt. Chưa đủ để kết luận cả lớp kẹt.</dd>
            <dt className="font-semibold">Tín hiệu lệch</dt>
            <dd className="text-[color:var(--ink-2)] m-0">
              Một học viên chiếm từ {Math.round((TH.skew_ratio || 0.5) * 100)}% lượt của cụm trở lên — con số trông to nhưng là của một người.
            </dd>
            <dt className="font-semibold">Chưa quy được vào đâu</dt>
            <dd className="text-[color:var(--ink-2)] m-0">
              Câu quá ngắn, câu hành chính, câu lạc đề. Hệ thống <strong>không</strong> nhét chúng vào cụm gần nhất cho đẹp số.
            </dd>
          </dl>
        </Disclosure>
      </Disclosure>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function Overview({ sess, setSess, goTab }) {
  const root = useRef(null);
  useReveal(root);

  const [sort, setSort] = useState(() => (lsGet("cp.sort", "turns") === "people" ? "people" : "turns"));
  const [filter, setFilter] = useState("all");

  const s = (D.sessions || [])[sess] || null;
  const moved = useMemo(() => readMoved(s), [s, sess]);

  const all = useMemo(() => sortClusters(liveClusters(s, moved), sort), [s, moved, sort]);
  const cls = useMemo(() => applyFilter(all, filter), [all, filter]);

  /* Lưới an toàn cho hiệu ứng hiện dần: useReveal chỉ quan sát những nút có
     mặt lúc gắn. Đổi buổi hay đổi bộ lọc sinh nút MỚI, không ai quan sát chúng
     nữa — mà .js-reveal .reveal{opacity:0} thì nút đó biến mất vĩnh viễn.
     Giao diện này chở số liệu: thà mất hiệu ứng còn hơn mất nội dung. */
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const host = root.current;
    if (!host) return;
    host.querySelectorAll(".reveal:not(.in)").forEach((el) => el.classList.add("in"));
  }, [sess, filter, sort]);

  const nSess = (D.sessions || []).length;

  const shell = (children) => (
    <div ref={root} className="mx-auto w-full max-w-[1080px] px-4 sm:px-6 py-8 sm:py-12">{children}</div>
  );

  if (!nSess || !s) {
    return shell(
      <Banner kind="warn" tag="TRỐNG">
        Chưa có dữ liệu buổi học. Chạy<br />
        <code className="text-[12px] px-1.5 py-0.5 rounded bg-[color:var(--surface-2)]">
          python codebase/run_cluster.py --course K4P1 --lecture D04 --out codebase/ui/data/session-K4P1-D04.json
        </code><br />
        rồi <code className="text-[12px] px-1.5 py-0.5 rounded bg-[color:var(--surface-2)]">python codebase/ui/build_data.py</code>.
        Hoặc sang tab{" "}
        <button type="button" onClick={() => goTab("live")} className="font-semibold text-[color:var(--primary)] hover:underline">Thử trực tiếp</button>
        {" "}để gom cụm ngay.
      </Banner>
    );
  }

  const header = (
    <div className="reveal mb-6">
      <Kicker>Tổng quan buổi học</Kicker>
      <h1 className="text-[clamp(26px,4vw,40px)] font-semibold tracking-tight">
        {(s.lecture_title ? s.lecture_title + " · " : "") + s.lecture}
      </h1>
      <p className="mt-2 text-[15px] text-[color:var(--ink-2)]">
        Khoá K4 · Lớp 3B{s.first_day ? " · " + dmy(s.first_day) : ""}
        {s.last_day && s.last_day !== s.first_day ? " – " + dmy(s.last_day) : ""}
      </p>
    </div>
  );

  const toolbar = (
    <Toolbar sess={sess} setSess={setSess} sort={sort} setSort={setSort}
      canExport={!s.sparse} onExport={() => exportSession(s, all, moved)} />
  );

  /* ─── nhánh buổi QUÁ ÍT CÂU: báo rõ, không gọi AI, không gom cụm ─── */
  if (s.sparse) {
    return shell(
      <>
        {header}
        {toolbar}
        <Banner kind="warn" tag="QUÁ ÍT CÂU">{s.sparse_reason}</Banner>
        <Card className="p-6 sm:p-8">
          <p className="text-[clamp(44px,8vw,76px)] leading-none font-semibold num tracking-tight">{fmt(s.real_turns)}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--ink-2)] max-w-[62ch]">
            lượt hỏi thật trong chu kỳ này — dưới ngưỡng {TH.sparse_min_turns || 6} lượt nên hệ thống{" "}
            <strong className="text-[color:var(--ink)]">không gọi AI và không gom cụm</strong>.{" "}
            Thà không trả lời còn hơn nặn ra một danh sách trông đáng tin.
          </p>
        </Card>
      </>
    );
  }

  const top = all[0];
  const nWeak = all.filter((c) => c.weak).length;
  const nSkew = all.filter((c) => c.skew).length;
  const movedN = Object.keys(moved).filter((k) => moved[k]).length;
  const scatter = scatterCount(s) + movedN;

  /* Ba cụm đông nhất. Tiêu đề MÔ TẢ chứ không khuyên — sản phẩm đưa vật liệu,
     không khuyến nghị. "Ba cụm mạnh đông nhất" là một sự thật đếm được;
     "Ba việc nên làm" là một lời khuyên. */
  const base = filter === "all" ? all : cls;
  const top3 = base.filter((c) => !c.weak && c.turns > 0).slice(0, 3);

  const head = cls.slice(0, HEAD);
  const rest = cls.slice(HEAD);
  const restTurns = rest.reduce((a, c) => a + c.turns, 0);
  const outside = restTurns + scatter;
  const MX = cls.length
    ? niceMax(Math.max(...cls.map((c) => Math.max(c.turns, c.people)), 1))
    : 1;
  const rowsOf = (list) => list.map((c) => ({ label: c.name, a: c.turns, b: c.people }));
  const legend = [{ c: "var(--s1)", label: "Lượt hỏi" }, { c: "var(--s2)", label: "Người hỏi" }];

  const ps = s.per_student;
  const inCluster = all.reduce((a, c) => a + c.turns, 0);

  /* Cụm đang mở trong cửa sổ câu hỏi gốc. null = đóng. */
  const [peek, setPeek] = useState(null);

  /* Ô "lượt" trong bảng là NÚT, không phải chữ: bấm vào ra câu học viên đã gõ.
     Đây là chỗ nối con số với bằng chứng của nó — thứ mà cả sản phẩm dựa vào. */
  const turnsCell = (c) => (
    /* Phải tự gỡ style mặc định của <button>: preflight của Tailwind bị tắt nên
       trình duyệt vẫn vẽ nền xám và viền, con số trong bảng thành một ô nút. */
    <button type="button" onClick={() => setPeek(c)}
      title={"Xem câu hỏi gốc của cụm: " + c.name}
      className="num appearance-none bg-transparent border-0 p-0 font-inherit text-[13px] cursor-pointer
                 underline decoration-dotted underline-offset-2 text-[color:var(--primary)] hover:decoration-solid">
      {fmt(c.turns)}
    </button>
  );

  const goCluster = (c) => {
    try { sessionStorage.setItem("cp.goto", s.key + "#" + c._i); } catch { /* chế độ riêng tư */ }
    goTab("cum");
  };

  return shell(
    <>
      {header}
      {toolbar}

      {/* ─── số dẫn đầu. KHÔNG animate giá trị số, chỉ hình học ─── */}
      <Card className="reveal p-6 sm:p-8 mb-5">
        <p className="text-[clamp(44px,8vw,76px)] leading-none font-semibold num tracking-tight">
          {(top ? top.people : 0)}/{s.students}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--ink-2)] max-w-[62ch]">
          học viên của buổi cùng vướng <strong className="text-[color:var(--ink)]">{top ? top.name : "—"}</strong>
          {top ? ` — ${top.turns} lượt hỏi trong ${fmt(s.real_turns)} lượt của cả buổi.` : ""}
          {" "}Đọc log thô thì không thấy được điều này.
        </p>
      </Card>

      {/* ─── dòng tin cậy — LUÔN HIỆN, cố ý chứa cả những con số bất lợi ─── */}
      <p className="text-[13px] leading-relaxed text-[color:var(--ink-2)] mb-6">
        <span className="num font-semibold text-[color:var(--ink)]">{fmt(s.real_turns)}</span> lượt hỏi thực ·{" "}
        <span className="num font-semibold text-[color:var(--ink)]">{all.length}</span> cụm
        {nWeak ? <> (<span className="num font-semibold text-[color:var(--ink)]">{nWeak}</span> cụm yếu)</> : null}
        {nSkew ? <> · <span className="num font-semibold text-[color:var(--ink)]">{nSkew}</span> cụm có tín hiệu lệch</> : null}
        {" · "}<span className="num font-semibold text-[color:var(--ink)]">{fmt(scatter)}</span> lượt chưa quy được vào đâu ·{" "}
        <span className="num font-semibold text-[color:var(--ink)]">{fmt(s.preset_removed)}</span>/
        <span className="num font-semibold text-[color:var(--ink)]">{fmt(s.total_turns)}</span> câu bấm nút có sẵn đã loại trước khi đếm
      </p>

      <FilterBox all={all} scatter={scatter} filter={filter} setFilter={setFilter} />

      {top3.length > 0 && (
        <section className="mb-10">
          <SectionTitle kicker="Đông nhất" title="Ba cụm mạnh đông nhất"
            sub={"Xếp theo " + (sort === "people" ? "số người hỏi" : "số lượt hỏi") +
                 (filter !== "all" ? ", trong bộ lọc đang bật" : "") +
                 ". Cụm yếu và " + (all.length - top3.length) + " cụm còn lại nằm đầy đủ ở phần dưới."} />
          <ol className="list-none p-0 m-0 grid gap-3">
            {top3.map((c, i) => (
              <li key={c._i}>
                <Card className="p-4 sm:p-5 flex items-start gap-4">
                  <span className="num shrink-0 w-8 h-8 rounded-full grid place-items-center text-[14px] font-semibold bg-[color:var(--surface-2)] text-[color:var(--ink-2)]">{i + 1}</span>
                  <div className="min-w-0 grow">
                    <p className="text-[16px] font-semibold tracking-tight">{c.name}</p>
                    <p className="mt-1 text-[13px] text-[color:var(--ink-2)] flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <b className="num">{c.people}</b>/{s.students} học viên · <b className="num">{c.turns}</b> lượt
                      {c.skew ? <Chip tone="warn">tín hiệu lệch</Chip> : null}
                      {c._removed ? <Chip tone="n">{c._removed} lượt đã gạt ra</Chip> : null}
                    </p>
                    <Button onClick={() => goCluster(c)} size="small" variant="text"
                      endIcon={<ArrowForwardRounded fontSize="small" />}
                      className="!mt-2 !px-0 !text-[13px] !text-[color:var(--primary)]">
                      Đọc câu nguyên văn
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ─── biểu đồ: đầu 6 dòng + đuôi gập, CÙNG một thang ─── */}
      {cls.length ? (
        <Card className="p-4 sm:p-6 mb-5">
          <h3 className="text-[17px] font-semibold tracking-tight">Cụm vấn đề theo số lượt và số người</h3>
          <Caption>
            Hai con số này phải đọc cùng nhau: nhiều lượt mà ít người là một bạn hỏi đi hỏi lại, không phải cả lớp kẹt.
          </Caption>
          <div className="mt-3">
            <Legend items={legend} />
            <GroupedBars rows={rowsOf(head)} max={MX} alt="Sáu cụm vấn đề lớn nhất theo số lượt và số người" />
            {/* Bảng khớp ĐÚNG số thanh của biểu đồ ngay trên nó. Trước đây bảng
                này liệt kê cả những cụm không có trong biểu đồ, nên hai thứ nằm
                cạnh nhau mà đếm ra hai con số khác nhau. Phần còn lại có bảng
                riêng, nằm cùng biểu đồ của nó trong cửa gập bên dưới. */}
            <TableView
              label={`Xem dạng bảng (${head.length} cụm trong biểu đồ trên)`}
              cols={[{ t: "Cụm vấn đề" }, { t: "Lượt", n: 1 }, { t: "Người", n: 1 }, { t: "Cờ" }]}
              rows={head.map((c) => [c.name, turnsCell(c), fmt(c.people),
                [c.weak ? "cụm yếu" : "", c.skew ? "tín hiệu lệch" : ""].filter(Boolean).join(", ") || "—"])} />
          </div>
          {rest.length > 0 && (
            /* Mẫu số tính trên LƯỢT CỦA BUỔI, không trên riêng phần đã gom, và
               nói thêm cả phần rải rác — nếu không, con số bị giấu trông nhỏ
               hơn sự thật. */
            <Disclosure id="tong.rest"
              summary={`${rest.length} cụm nhỏ còn lại (${fmt(restTurns)} lượt · ${Math.round(restTurns / s.real_turns * 100)}% lượt của buổi) — cùng với ${fmt(scatter)} lượt rải rác, ${Math.round(outside / s.real_turns * 100)}% lượt của buổi không nằm trong ${head.length} thanh trên`}>
              <Legend items={legend} />
              <GroupedBars rows={rowsOf(rest)} max={MX} alt="Các cụm nhỏ còn lại, cùng thang với biểu đồ trên" />
              <TableView
                label={`Xem dạng bảng (${rest.length} cụm còn lại)`}
                cols={[{ t: "Cụm vấn đề" }, { t: "Lượt", n: 1 }, { t: "Người", n: 1 }, { t: "Cờ" }]}
                rows={rest.map((c) => [c.name, turnsCell(c), fmt(c.people),
                  [c.weak ? "cụm yếu" : "", c.skew ? "tín hiệu lệch" : ""].filter(Boolean).join(", ") || "—"])} />
            </Disclosure>
          )}
        </Card>
      ) : (
        <Banner kind="info" tag="LỌC">
          Bộ lọc hiện tại không khớp cụm nào. Bấm “Tất cả” ở hàng lọc phía trên.
        </Banner>
      )}

      {/* ─── Card này ở lại TẦNG LUÔN HIỆN. Nó là chỗ DUY NHẤT trên sản phẩm
             cộng đủ 100% lượt của buổi; gập nó xuống là lý lẽ vòng tròn. ─── */}
      <Card className="reveal p-4 sm:p-6 mb-8">
        <h3 className="text-[17px] font-semibold tracking-tight">Thành phần lượt hỏi của buổi</h3>
        <Caption>Câu bấm nút có sẵn bị loại trước khi đếm bất cứ thứ gì — để lẫn vào sẽ ra cụm giả.</Caption>
        <div className="mt-3">
          <StackedBar parts={[
            { label: "Trong cụm", v: inCluster, c: "var(--s1)" },
            { label: "Rải rác", v: scatter, c: "var(--s3)" },
            { label: "Câu bấm nút có sẵn đã loại", v: s.preset_removed, c: "var(--baseline)" },
          ]} />
          <TableView
            cols={[{ t: "Thành phần" }, { t: "Lượt", n: 1 }]}
            rows={[["Trong cụm", fmt(inCluster)], ["Rải rác", fmt(scatter)],
                   ["Câu bấm nút có sẵn đã loại", fmt(s.preset_removed)],
                   ["Tổng lượt của buổi", fmt(s.total_turns)]]} />
        </div>
      </Card>

      {/* ─── ba số kỹ thuật + phân bố: giám khảo cần, Lab Coach không ─── */}
      <Disclosure id="tong.proof" summary="Vì sao tin được mấy con số trên">
        <KpiGrid>
          <Kpi label="Học viên đã hỏi" value={fmt(s.students)}
            note={"trung vị " + ((ps && ps.median) || "—") + " lượt/người"} />
          <Kpi label="Thời gian gom"
            value={s.ai_call && s.ai_call.called ? (s.ai_call.latency_ms / 1000).toFixed(1) : "0"} unit="s"
            note={s.ai_call && s.ai_call.called ? s.ai_call.n_calls + " lời gọi AI" : "không gọi AI"} />
          <Kpi label="Cụm con trước khi gộp"
            value={String((s.repairs && s.repairs.protos_before_merge) || all.length)}
            unit={"→ " + all.length} note="AI gộp lại một lần nữa" />
        </KpiGrid>
        {ps && (
          <Card className="p-4 sm:p-6">
            <h3 className="text-[17px] font-semibold tracking-tight">Phân bố lượt hỏi trên mỗi học viên</h3>
            <Caption>
              Trung vị <strong className="text-[color:var(--ink)]">{ps.median} lượt</strong>/học viên, nhưng người hỏi nhiều nhất là{" "}
              <strong className="text-[color:var(--ink)]">{ps.max} lượt</strong> ({Math.round(ps.top_share * 100)}% cả buổi).
              Đó là lý do cần cờ “tín hiệu lệch”.
            </Caption>
            <Columns bins={ps.hist} alt="Phân bố lượt hỏi trên mỗi học viên" />
            <TableView
              cols={[{ t: "Số lượt hỏi" }, { t: "Số học viên", n: 1 }]}
              rows={ps.hist.map((b) => [b.label, fmt(b.count)])} />
          </Card>
        )}
      </Disclosure>

      {/* Dòng thời gian + ba bộ lọc (buổi/tháng/ngày) + biểu đồ đường + input→output.
          Đặt SAU phần bằng chứng vì nó trả lời câu khác: không phải "buổi này lớp
          kẹt đâu" mà "câu hỏi tới vào những ngày nào". */}
      <Timeline sess={sess} setSess={setSess} />

      {/* Cửa sổ câu hỏi gốc — mở từ ô "lượt" trong các bảng ở trên. */}
      <QuestionsDialog cluster={peek} onClose={() => setPeek(null)} />
    </>
  );
}
