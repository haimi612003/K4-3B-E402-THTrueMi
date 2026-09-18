import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import { api } from "../lib/api";
import { fmt } from "../lib/data";
import { TableView } from "../ui/Charts";
import { useReveal, Kicker, Card, SectionTitle, Kpi, KpiGrid, Banner, Chip } from "../ui/Bits";

/* ══════════ THỬ TRỰC TIẾP ══════════
   Tab duy nhất gọi model thật. Mọi lời gọi đi qua api.* → máy chủ Python;
   trình duyệt KHÔNG BAO GIỜ cầm khoá Gemini.

   Hai chỗ tuyệt đối không được nới:
   · Bảng "hệ thống đã phải sửa gì" (mã bịa / xếp hai nơi / bỏ quên) nằm ở tầng
     LUÔN HIỆN. Đó là tín hiệu chất lượng thật của model, giấu đi là tô hồng.
   · Không animate con số. Chuyển động chỉ áp cho chiều dài thanh.                */

/* Bản cũ ghi localStorage bằng JSON.stringify và chạy CÙNG origin (127.0.0.1:8765),
   nên giá trị cũ về dạng có nháy kép. Bóc ra thay vì hiện “"RAG…"” cho người dùng. */
const lsGet = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    if (v == null) return d;
    if (v.startsWith('"')) { try { return JSON.parse(v); } catch { return v; } }
    return v;
  } catch { return d; }
};
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* chế độ riêng tư */ } };

const SRCS = [
  ["sample", "Bộ mẫu có thật"],
  ["gen", "Nhờ AI sinh"],
  ["type", "Tự gõ"],
];

const STEPS = [
  "Gửi câu hỏi lên máy chủ cục bộ",
  "Máy chủ gọi model Gemini",
  "Model trả JSON danh sách cụm",
  "Code tính số người và các cờ",
];

const ANSWER_FIELDS = [
  ["misread", "Học viên đang hiểu sai ở đâu", "suy từ chính chữ họ viết, không phải chẩn đoán chung chung"],
  ["different", "Giảng lại theo cách KHÁC slide", "học viên đã đọc slide rồi mà vẫn hỏi — lặp lại cách cũ thì vô ích"],
  ["example", "Ví dụ cụ thể", ""],
  ["check", "Câu kiểm tra nhanh", "phân biệt hiểu thật với thuộc lòng"],
];

const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

/* Câu nguyên văn kèm ID — ID trỏ thẳng về dòng log, không tóm tắt, không viết lại. */
function Quote({ turn_id, q }) {
  return (
    <li className="flex gap-2.5 items-start py-1.5 border-t border-[color:var(--line-2)] first:border-t-0">
      <span className="shrink-0 mt-0.5 rounded-md bg-[color:var(--surface-2)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--muted)]">{turn_id}</span>
      <span className="text-[13.5px] leading-relaxed text-[color:var(--ink-2)]">“{q}”</span>
    </li>
  );
}

function Steps({ step }) {
  return (
    <ol className="mt-4 flex flex-col gap-2">
      {STEPS.map((s, i) => {
        const done = step > i + 1, on = step === i + 1;
        return (
          <li key={i} className={"flex items-center gap-2.5 text-[13px] " + (done || on ? "text-[color:var(--ink)]" : "text-[color:var(--muted)]")}>
            <span className={"grid place-items-center w-5 h-5 shrink-0 rounded-full border text-[11px] font-semibold " +
              (done ? "border-transparent bg-[color:var(--go)] text-white"
                : on ? "border-[color:var(--primary)] text-[color:var(--primary)]"
                  : "border-[color:var(--line)] text-[color:var(--muted)]")}>
              {done ? "✓" : on ? <CircularProgress size={11} thickness={6} color="inherit" /> : i + 1}
            </span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

/* Nội dung ôn model vừa soạn. Luôn gắn nhãn "bản nháp": sản phẩm đưa vật liệu,
   người quyết định vẫn là Lab Coach. */
function AnswerBox({ state }) {
  if (!state) return null;
  if (state.loading) {
    return (
      <div className="mt-3 rounded-xl2 border border-[color:var(--line)] bg-[color:var(--surface-2)] px-4 py-3 text-[13px] text-[color:var(--ink-2)] flex items-center gap-2">
        <CircularProgress size={14} /> Đang nhờ AI soạn nội dung ôn…
      </div>
    );
  }
  if (state.err) {
    return (
      <div className="mt-3 rounded-xl2 border border-[color:var(--critical)] bg-[color:var(--panel)] px-4 py-3 text-[13px]">
        <b>Không soạn được:</b> {state.err}
      </div>
    );
  }
  const d = state.data || {};
  return (
    <div className="mt-3 rounded-xl2 border border-[color:var(--line)] bg-[color:var(--surface-2)] p-4">
      <div className="flex flex-wrap items-start gap-2">
        <Chip tone="n">bản nháp</Chip>
        <span className="text-[12.5px] leading-relaxed text-[color:var(--ink-2)] flex-1 min-w-[220px]">
          Lab Coach là người quyết định cuối cùng — đây là vật liệu, không phải chỉ thị.
          {d.minutes ? ` Ước lượng ~${d.minutes} phút trên lớp.` : ""} Độ chắc chắn model tự khai:{" "}
          <b className="text-[color:var(--ink)]">{d.confidence || "?"}</b>
        </span>
      </div>
      <dl className="mt-3 flex flex-col gap-3">
        {ANSWER_FIELDS.filter(([k]) => d[k]).map(([k, lb, hint]) => (
          <div key={k} className={"rounded-xl2 bg-[color:var(--panel)] border px-3.5 py-3 " +
            (k === "different" ? "border-[color:var(--primary)]" : "border-[color:var(--line)]")}>
            <dt className="text-[12px] font-semibold tracking-[.06em] uppercase text-[color:var(--muted)]">{lb}</dt>
            {hint && <dd className="mt-0.5 text-[12px] text-[color:var(--muted)]">{hint}</dd>}
            <dd className="mt-1.5 text-[13.5px] leading-relaxed whitespace-pre-line">{d[k]}</dd>
          </div>
        ))}
        {d.caveat && (
          <div className="rounded-xl2 bg-[color:var(--panel)] border border-[color:var(--warn)] px-3.5 py-3">
            <dt className="text-[12px] font-semibold tracking-[.06em] uppercase text-[color:var(--warn-ink)]">Chỗ cần tự kiểm trước khi dùng</dt>
            <dd className="mt-1.5 text-[13.5px] leading-relaxed whitespace-pre-line">{d.caveat}</dd>
          </div>
        )}
      </dl>
      {d.ai && (
        <p className="mt-3 text-[12px] text-[color:var(--muted)]">
          Soạn bằng <code className="font-mono">{d.ai.model}</code> · {fmt(d.ai.latency_ms)} ms · {fmt(d.ai.tokens_out)} token ra
        </p>
      )}
    </div>
  );
}

export default function Live() {
  const root = useRef(null);
  const [health, setHealth] = useState(null);      // null: đang kiểm · false: không có máy chủ
  const [samples, setSamples] = useState([]);
  const [src, setSrc] = useState("sample");
  const [text, setText] = useState("");
  const [items, setItems] = useState(null);        // giữ mã học viên thật của bộ mẫu
  const [label, setLabel] = useState(null);
  const [topic, setTopic] = useState(() => lsGet("cp.topic", "RAG và vector database"));
  const [genBusy, setGenBusy] = useState(false);
  const [genMeta, setGenMeta] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [answers, setAnswers] = useState({});

  /* Bản sao qua ref: các callback chạy sau setTimeout / sau await cần giá trị MỚI
     NHẤT, không phải giá trị đóng băng lúc render. */
  const stRef = useRef({ items: null, label: null, busy: false });
  stRef.current = { items, label, busy };
  const autorun = useRef(null);
  const timers = useRef([]);

  useReveal(root);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /* Deep-link ?sample=<id>&run=1 — đọc TRƯỚC khi máy chủ trả bộ mẫu, để lúc bộ
     mẫu về là chạy được ngay. Tiện khi demo. */
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("sample")) autorun.current = { sample: q.get("sample"), run: q.get("run") === "1" };
  }, []);

  useEffect(() => {
    let alive = true;
    api.health()
      .then((h) => api.samples().then((s) => { if (alive) { setHealth(h); setSamples(s.samples || []); } }))
      .catch(() => { if (alive) setHealth(false); });
    return () => { alive = false; };
  }, []);

  const max = (health && health.max_questions) || 60;
  const n = useMemo(() => lines(text).length, [text]);
  const tooMany = n > max;

  const pickSample = (s) => {
    setItems(s.items);
    setLabel(s.title);
    setText((s.items || []).map((i) => i.q).join("\n"));
  };

  /* Gom cụm. Nhận payload qua tham số để deep-link không phải đợi state kịp cập nhật. */
  const runCluster = (rawText, forceItems, forceLabel) => {
    const ls = lines(rawText);
    if (!ls.length || ls.length > max) return;
    const it = forceItems !== undefined ? forceItems : stRef.current.items;
    // Giữ mã học viên thật khi dùng bộ mẫu, để cờ tín hiệu lệch có ý nghĩa.
    const payload = it && it.length === ls.length && it.every((x, i) => x.q === ls[i]) ? it : ls;

    setBusy(true); setErr(null); setResult(null); setAnswers({}); setStep(1);
    const t = setTimeout(() => { if (stRef.current.busy) setStep(2); }, 350);
    timers.current.push(t);
    api.cluster({
      questions: payload,
      label: (forceLabel !== undefined ? forceLabel : stRef.current.label) || "Thử trực tiếp",
    })
      .then((r) => {
        clearTimeout(t);
        setBusy(false); setResult(r); setStep(4);
        const t2 = setTimeout(() => setStep(0), 600);
        timers.current.push(t2);
      })
      .catch((e) => {
        clearTimeout(t);
        setBusy(false); setStep(0); setErr(String(e.message || e));
      });
  };

  /* Chạy sẵn một kịch bản qua URL. Chỉ một lần. */
  useEffect(() => {
    if (!autorun.current || !samples.length) return;
    const want = autorun.current;
    autorun.current = null;
    const s = samples.find((x) => x.id === want.sample);
    if (!s) return;
    pickSample(s);
    if (want.run) {
      const t = setTimeout(() => runCluster((s.items || []).map((i) => i.q).join("\n"), s.items, s.title), 120);
      timers.current.push(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples]);

  const doGenerate = () => {
    const tp = (topic || "").trim();
    if (!tp) return;
    lsSet("cp.topic", tp);
    setGenBusy(true); setErr(null);
    api.generate({ topic: tp, n: 14 })
      .then((r) => {
        setGenBusy(false);
        setItems(null);
        setLabel("AI sinh · " + tp);
        setText((r.questions || []).join("\n"));
        setGenMeta(r.ai || null);
      })
      .catch((e) => { setGenBusy(false); setGenMeta(null); setResult(null); setErr(String(e.message || e)); });
  };

  const askAnswer = (i, c) => {
    if (answers[i] && answers[i].data) {
      setAnswers((a) => { const b = { ...a }; delete b[i]; return b; });
      return;
    }
    setAnswers((a) => ({ ...a, [i]: { loading: true } }));
    api.answer({
      lecture: stRef.current.label || "Thử trực tiếp",
      name: c.name, why: c.why, people: c.people,
      turn_ids: c.turn_ids,
      questions: (c.examples || []).map((e) => e.q),
    })
      .then((d) => setAnswers((a) => ({ ...a, [i]: { data: d } })))
      .catch((e) => setAnswers((a) => ({ ...a, [i]: { err: String(e.message || e) } })));
  };

  /* ── đang kiểm máy chủ ── */
  if (health === null) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 py-10">
        <Banner kind="info" tag="…">Đang kiểm tra máy chủ cục bộ…</Banner>
      </div>
    );
  }

  /* ── không có máy chủ: nói rõ cách chạy ── */
  if (health === false) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-16">
        <Kicker>Thử trực tiếp</Kicker>
        <h2 className="text-[clamp(24px,3.4vw,36px)] font-semibold tracking-tight">Tab này cần máy chủ cục bộ</h2>
        <Card className="mt-6 p-6">
          <p className="text-[14.5px] leading-relaxed text-[color:var(--ink-2)]">
            Tab này gọi AI thật nên cần máy chủ cục bộ — khoá API phải ở phía server chứ không nhúng vào trang web.
          </p>
          <p className="mt-4 text-[14.5px] text-[color:var(--ink-2)]">Mở terminal ở thư mục repo rồi chạy:</p>
          <pre className="mt-2 rounded-xl2 border border-[color:var(--line)] bg-[color:var(--surface-2)] px-4 py-3 font-mono text-[13.5px] overflow-x-auto">python codebase/serve.py</pre>
          <p className="mt-4 text-[14.5px] leading-relaxed text-[color:var(--ink-2)]">
            Trang sẽ tự mở ở <code className="font-mono rounded bg-[color:var(--surface-2)] px-1.5 py-0.5">http://127.0.0.1:8765</code>.
            Bốn tab còn lại vẫn xem được bình thường khi mở bằng <code className="font-mono">file://</code>.
          </p>
        </Card>
      </div>
    );
  }

  const H = health;
  const a = (result && result.ai_call) || {};
  const rep = (result && result.repairs) || {};

  return (
    <div ref={root} className="mx-auto max-w-[1180px] px-4 py-10 pb-24">
      <SectionTitle
        kicker="Thử trực tiếp"
        title="Gom cụm bằng model thật, ngay tại đây"
        sub="Ba cách đưa câu hỏi vào, một nút gọi model. Kết quả bên dưới là phản hồi thật của model, kể cả phần hệ thống phải sửa lại."
      />

      <div className="reveal">
        <Banner kind={H.ok === false ? "warn" : "info"} tag="LIVE">
          Máy chủ sẵn sàng · model <code className="font-mono">{H.model}</code> · khoá <code className="font-mono">{H.key}</code>
          {H.chatlog ? ` · chatlog K4 ${fmt(H.chatlog)} lượt` : " · không đọc được chatlog, dùng phần “Nhờ AI sinh”"}
          {H.chatlog_error ? ` (${H.chatlog_error})` : ""}
          . Câu hỏi bạn nhập được gửi tới model thật, kết quả bên dưới là phản hồi thật chứ không dựng sẵn.
        </Banner>
      </div>

      <div className="grid gap-6 items-start lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        {/* ── 1 · Lấy dữ liệu vào ── */}
        <Card className="reveal p-6 lg:sticky lg:top-4">
          <h3 className="text-[17px] font-semibold tracking-tight">1 · Lấy dữ liệu vào</h3>
          <p className="mt-1 text-[13px] text-[color:var(--muted)]">Ba cách, chọn một.</p>

          <ToggleButtonGroup
            exclusive value={src} onChange={(_, v) => v && setSrc(v)} size="small" fullWidth
            className="!mt-4 !rounded-full !bg-[color:var(--surface-2)] !p-1"
            aria-label="Nguồn câu hỏi">
            {SRCS.map(([k, lb]) => (
              <ToggleButton key={k} value={k}
                className={"!rounded-full !border-0 !py-1.5 !text-[13px] !normal-case " +
                  (src === k
                    ? "!bg-[color:var(--panel)] !text-[color:var(--ink)] !font-semibold shadow-card"
                    : "!bg-transparent !text-[color:var(--ink-2)]")}>
                {lb}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {src === "sample" && (
            <>
              <p className="mt-4 text-[13px] leading-relaxed text-[color:var(--muted)]">
                Lấy thẳng từ chatlog K4. Mỗi bộ dựng sẵn để lộ một hành vi khác nhau của hệ thống.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {samples.length ? samples.map((s) => (
                  <ButtonBase key={s.id} onClick={() => pickSample(s)}
                    className={"!block w-full !rounded-xl2 border !p-3 !text-left transition-colors " +
                      (label === s.title
                        ? "border-[color:var(--primary)] bg-[color:var(--surface-2)]"
                        : "border-[color:var(--line)] hover:bg-[color:var(--surface-2)]")}>
                    <span className="flex items-start gap-3">
                      <span className="shrink-0 rounded-lg bg-[color:var(--surface-2)] px-2 py-1 text-[12px] font-semibold num text-[color:var(--ink-2)]">{s.n} câu</span>
                      <span className="block">
                        <b className="block text-[14px] leading-snug">{s.title}</b>
                        <em className="block mt-0.5 not-italic text-[12.5px] leading-relaxed text-[color:var(--muted)]">{s.hint}</em>
                      </span>
                    </span>
                  </ButtonBase>
                )) : (
                  <p className="text-[13px] text-[color:var(--muted)]">Không đọc được chatlog — dùng “Nhờ AI sinh” hoặc “Tự gõ”.</p>
                )}
              </div>
            </>
          )}

          {src === "gen" && (
            <>
              <p className="mt-4 text-[13px] leading-relaxed text-[color:var(--muted)]">
                AI sinh một bộ câu hỏi giả lập giống log thật: hai chỗ kẹt chung từ khoá, cộng câu cụt, câu hành chính,
                và câu hỏi về chính con bot.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <TextField size="small" fullWidth label="Chủ đề buổi học" value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") doGenerate(); }} />
                <Button variant="outlined" onClick={doGenerate} disabled={genBusy || !topic.trim()}
                  className="!rounded-full !border-[color:var(--line)] !text-[color:var(--ink)]">
                  {genBusy
                    ? <><CircularProgress size={14} className="mr-2" /> Đang sinh…</>
                    : (genMeta ? "✨ Sinh lại" : "✨ Sinh 14 câu hỏi")}
                </Button>
                {genMeta && (
                  <p className="text-[12px] text-[color:var(--muted)]">
                    Sinh bằng <code className="font-mono">{genMeta.model}</code> · {fmt(genMeta.latency_ms)} ms · {fmt(genMeta.tokens_out)} token ra
                  </p>
                )}
              </div>
            </>
          )}

          {src === "type" && (
            <p className="mt-4 text-[13px] leading-relaxed text-[color:var(--muted)]">
              Dán câu hỏi của lớp bạn, mỗi dòng một câu. Mặc định mỗi dòng được coi là một học viên khác nhau.
            </p>
          )}

          <div className="mt-4">
            <TextField
              multiline minRows={8} maxRows={18} fullWidth
              placeholder="Mỗi dòng một câu hỏi…"
              spellCheck={false}
              inputProps={{ "aria-label": "Danh sách câu hỏi" }}
              value={text}
              onChange={(e) => { setText(e.target.value); setItems(null); }}
              InputProps={{ className: "!text-[13px] !rounded-xl2" }}
            />
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <span className={"text-[12.5px] num " + (tooMany ? "text-[color:var(--critical-ink)] font-semibold" : "text-[color:var(--muted)]")}>
                {n} câu{tooMany ? ` — quá ${max} câu, máy chủ sẽ từ chối` : ""}
              </span>
              <Tooltip title={tooMany ? `Tối đa ${max} câu một lần thử` : "Gửi lên máy chủ cục bộ, máy chủ gọi model"}>
                <span>
                  <Button variant="contained" onClick={() => runCluster(text)} disabled={busy || !n || tooMany}
                    className="!rounded-full !bg-black hover:!bg-neutral-800 !px-5 !py-2 disabled:!bg-[color:var(--surface-2)] disabled:!text-[color:var(--muted)]">
                    {busy ? <><CircularProgress size={14} color="inherit" className="mr-2" /> Đang gom…</> : "Gom cụm bằng AI →"}
                  </Button>
                </span>
              </Tooltip>
            </div>
            <Steps step={step} />
          </div>
        </Card>

        {/* ── 2 · Kết quả ── */}
        <div className="flex flex-col gap-4">
          {err && <div className="reveal"><Banner kind="bad" tag="LỖI">{err}</Banner></div>}

          {busy && (
            <Card className="p-6">
              <h3 className="text-[17px] font-semibold tracking-tight">Đang gọi model…</h3>
              <p className="mt-1 text-[13px] text-[color:var(--muted)]">
                Thường 1–3 giây cho một buổi nhỏ. Các bước đang chạy hiện ở cột bên trái.
              </p>
            </Card>
          )}

          {!busy && !result && !err && (
            <Card className="reveal p-6">
              <h3 className="text-[17px] font-semibold tracking-tight">2 · Kết quả hiện ở đây</h3>
              <p className="mt-1 text-[13.5px] leading-relaxed text-[color:var(--muted)]">
                Chọn một bộ mẫu bên trái, hoặc nhờ AI sinh, hoặc tự gõ — rồi bấm “Gom cụm bằng AI”.
              </p>
            </Card>
          )}

          {!busy && result && (
            <>
              <KpiGrid>
                <Kpi label="Câu vào" value={fmt((result.input || []).length)} />
                <Kpi label="Cụm tìm được" value={fmt((result.clusters || []).length)} note={result.sparse ? "quá ít câu để gom" : ""} />
                <Kpi label="Rải rác" value={fmt(result.scatter ? result.scatter.turns : 0)} note="lượt không vào cụm nào" />
                <Kpi label="Thời gian" value={((result.wall_ms || 0) / 1000).toFixed(1)} unit="s"
                  note={a.called ? `${fmt(a.n_calls)} lời gọi AI` : "không gọi AI"} />
                <Kpi label="Token" value={fmt(a.tokens_in || 0)} unit="vào" note={`${fmt(a.tokens_out || 0)} ra`} />
              </KpiGrid>

              {result.sparse && (
                <Banner kind="warn" tag="QUÁ ÍT CÂU">
                  {result.sparse_reason}
                  {!a.called && (
                    <> Hệ thống <b>KHÔNG gọi AI</b> ở nhánh này{a.reason ? ` — ${a.reason}` : ""}.</>
                  )}
                </Banner>
              )}

              {!!(result.clusters || []).length && (() => {
                const maxT = Math.max(...result.clusters.map((c) => c.turns), 1);
                return (
                  <Card className="p-6">
                    <h3 className="text-[17px] font-semibold tracking-tight">Cụm model vừa trả về</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--muted)]">
                      Thanh dài theo số lượt. Cờ “cụm yếu” và “tín hiệu lệch” nằm ngay trên tên cụm, không giấu ở chỗ phải bấm mới thấy.
                    </p>
                    <ol className="mt-4 flex flex-col gap-4">
                      {result.clusters.map((c, i) => (
                        <li key={i} className="rounded-xl2 border border-[color:var(--line)] p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[15px] font-semibold tracking-tight">{c.name}</span>
                            {c.skew && <Chip tone="warn">tín hiệu lệch {Math.round(c.skew_top_share * 100)}%</Chip>}
                            {c.weak && <Chip tone="no">cụm yếu</Chip>}
                          </div>
                          <div className="mt-2.5 flex items-center gap-3">
                            <div className="h-2.5 flex-1 rounded-full bg-[color:var(--surface-2)] overflow-hidden">
                              {/* chuyển động chỉ áp cho HÌNH HỌC — con số không bao giờ chạy */}
                              <i className="block h-full rounded-full transition-[width] duration-500"
                                style={{ width: `${Math.max(3, Math.round((c.turns / maxT) * 100))}%`, background: "var(--s1)" }} />
                            </div>
                            <span className="shrink-0 text-[13px] text-[color:var(--ink-2)]">
                              <b className="num">{fmt(c.turns)}</b> lượt · <b className="num">{fmt(c.people)}</b> người
                            </span>
                          </div>
                          {c.why && <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--ink-2)]">{c.why}</p>}
                          <p className="mt-3 text-[11.5px] font-semibold tracking-[.06em] uppercase text-[color:var(--muted)]">
                            Câu nguyên văn, ID trỏ về dòng log
                          </p>
                          <ul className="mt-1">
                            {(c.examples || []).map((e) => <Quote key={e.turn_id} turn_id={e.turn_id} q={e.q} />)}
                          </ul>
                          <Button size="small" variant="text" onClick={() => askAnswer(i, c)}
                            className="!mt-2 !rounded-full !px-0 !text-[13px] !text-[color:var(--primary)]">
                            {answers[i] && answers[i].data ? "Ẩn nội dung ôn" : "✨ Soạn nội dung ôn cho cụm này"}
                          </Button>
                          <AnswerBox state={answers[i]} />
                        </li>
                      ))}
                    </ol>
                    {/* Bản xem dạng bảng đi kèm — nơi duy nhất còn đủ dòng khi thanh bị cắt ngắn. */}
                    <TableView
                      cols={[{ t: "Cụm" }, { t: "Lượt", n: true }, { t: "Người", n: true }, { t: "Cờ" }]}
                      rows={result.clusters.map((c) => [
                        c.name, fmt(c.turns), fmt(c.people),
                        [c.weak ? "cụm yếu" : "", c.skew ? `tín hiệu lệch ${Math.round(c.skew_top_share * 100)}%` : ""]
                          .filter(Boolean).join(" · ") || "—",
                      ])}
                    />
                  </Card>
                );
              })()}

              {!!(result.scatter && result.scatter.turns) && (
                <Card className="p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-[17px] font-semibold tracking-tight">
                      Rải rác — <span className="num">{fmt(result.scatter.turns)}</span> lượt
                    </h3>
                    {result.scatter.examples_withheld && <Chip tone="n">giữ lại ví dụ vì quá ít người hỏi</Chip>}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--ink-2)]">
                    Câu quá ngắn, lạc đề, hành chính, hoặc hỏi về chính con bot.
                  </p>
                  <ul className="mt-2">
                    {(result.scatter.examples || []).map((e) => <Quote key={e.turn_id} turn_id={e.turn_id} q={e.q} />)}
                  </ul>
                </Card>
              )}

              {/* LUÔN HIỆN — tín hiệu chất lượng thật của model. Không gập, không giấu. */}
              <Card className="p-6">
                <h3 className="text-[17px] font-semibold tracking-tight">Hệ thống đã phải sửa gì</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--muted)]">
                  Model bịa mã, xếp một câu vào hai chỗ, hay bỏ quên câu — đều bị sửa và ghi lại chứ không giấu.
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-[13.5px] border-collapse">
                    <tbody>
                      {[
                        ["Model", (a.models_used || [a.model || "—"]).join(", ")],
                        ["Lời gọi AI", a.called
                          ? `${fmt(a.n_calls)} lời gọi${a.n_chunks ? ` · ${fmt(a.n_chunks)} lô` : ""}${a.fell_back ? " · có lời gọi rơi sang model dự phòng" : ""}`
                          : `không gọi${a.reason ? ` — ${a.reason}` : ""}`],
                        ["Độ trễ model", a.called ? `${fmt(a.latency_ms)} ms` : "—"],
                        ["Token vào / ra", `${fmt(a.tokens_in || 0)} / ${fmt(a.tokens_out || 0)}`],
                        ["Mã bịa", fmt((rep.invented_ids || []).length)],
                        ["Xếp hai nơi", fmt((rep.duplicates || []).length)],
                        ["Bỏ quên (đã đưa về rải rác)", fmt((rep.unplaced_added_to_scatter || []).length)],
                      ].map(([k, v], i) => (
                        <tr key={i}>
                          <th className="w-[46%] py-2 text-left align-top font-medium text-[color:var(--ink-2)] border-b border-[color:var(--line-2)]">{k}</th>
                          <td className="py-2 text-right align-top num border-b border-[color:var(--line-2)]">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
