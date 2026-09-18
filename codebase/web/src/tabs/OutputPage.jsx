import { useEffect, useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";

import { D, fmt } from "../lib/data";
import { api } from "../lib/api";
import { downloadFaqDoc } from "../lib/docExport";
import { Kicker, Card, Chip, Banner } from "../ui/Bits";

/* ══════════ TRANG 3 · ĐẦU RA ══════════
   Chỉ có đúng một việc: những cụm đã chọn ở trang Đầu vào → vật liệu giảng lại,
   rồi xuất thành file .doc đăng lên VLearn.

   Trang này KHÔNG có bộ lọc, không có sắp xếp, không sửa cụm. Đó là việc của
   đầu vào. Trộn vào đây thì người dùng lại phải quyết định lần nữa ở đúng lúc
   họ đã quyết xong.                                                          */

const ANSWER_FIELDS = [
  ["misread", "Học viên đang hiểu sai ở đâu", "suy từ chính chữ họ viết, không phải chẩn đoán chung chung"],
  ["different", "Giảng lại theo cách KHÁC slide", "học viên đã đọc slide rồi mà vẫn hỏi — lặp lại cách cũ thì vô ích"],
  ["example", "Ví dụ cụ thể", ""],
  ["check", "Câu kiểm tra nhanh", "phân biệt hiểu thật với thuộc lòng"],
];

function AnswerBox({ a }) {
  if (a.loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-[13px] text-[color:var(--ink-2)]">
        <CircularProgress size={14} /> Đang soạn…
      </div>
    );
  }
  if (a.err) {
    return <Banner kind="bad" tag="Lỗi">{a.err}</Banner>;
  }
  const d = a.data || {};
  return (
    <div className="mt-3 rounded-xl2 border border-[color:var(--line)] bg-[color:var(--surface-2)] p-4">
      {ANSWER_FIELDS.map(([k, label, hint]) =>
        d[k] ? (
          <div key={k} className="mb-3 last:mb-0">
            <p className="text-[11.5px] font-bold tracking-[.07em] uppercase text-[color:var(--muted)]">
              {label}
            </p>
            {hint && <p className="text-[11.5px] italic text-[color:var(--muted)]">{hint}</p>}
            <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-line">{d[k]}</p>
          </div>
        ) : null
      )}
      {d.note && <p className="mt-2 text-[12.5px] text-[color:var(--ink-2)]">{d.note}</p>}
    </div>
  );
}

export default function OutputPage({ sess, sel, goTab }) {
  const all = D.sessions || [];
  const s = all[sess] || null;
  const sKey = s ? s.key : "_";

  const [serverUp, setServerUp] = useState(null);
  const [answers, setAnswers] = useState({});
  const [faq, setFaq] = useState({ running: false, items: null, err: null });

  useEffect(() => {
    let alive = true;
    api.health().then(() => { if (alive) setServerUp(true); })
      .catch(() => { if (alive) setServerUp(false); });
    return () => { alive = false; };
  }, []);

  const picked = useMemo(() => {
    if (!s || !s.clusters) return [];
    return s.clusters
      .map((c, i) => ({ ...c, _i: i }))
      .filter((c) => sel[sKey + "#" + c._i])
      .sort((a, b) => b.people - a.people || b.turns - a.turns);
  }, [s, sel, sKey]);

  const lectureLabel = s ? (s.lecture_title ? s.lecture_title + " · " : "") + s.lecture : "";
  const noServer = "Cần máy chủ cục bộ để gọi AI. Chạy: python codebase/serve.py";

  const requestAnswer = (c) => {
    const id = sKey + "#" + c._i;
    if (answers[id] && answers[id].data) {
      setAnswers((a) => { const n = { ...a }; delete n[id]; return n; });
      return;
    }
    if (serverUp === false) { setAnswers((a) => ({ ...a, [id]: { err: noServer } })); return; }
    setAnswers((a) => ({ ...a, [id]: { loading: true } }));
    api.answer({
      lecture: lectureLabel, name: c.name, why: c.why, people: c.people,
      turn_ids: c.turn_ids || [],
      questions: (c.examples || []).map((e) => e.q),
    })
      .then((d) => setAnswers((a) => ({ ...a, [id]: { data: d } })))
      .catch((e) => setAnswers((a) => ({ ...a, [id]: { err: String(e.message || e) } })));
  };

  /* Soạn tất cả cùng lúc — mỗi cụm một lời gọi, chạy song song, và mỗi cụm tự
     báo trạng thái của nó. Một cụm hỏng không kéo theo các cụm còn lại. */
  const startFaq = () => {
    if (!s) return;
    if (serverUp === false) { setFaq({ running: false, items: null, err: noServer }); return; }
    const use = picked.filter((c) => c.turns > 0);
    if (!use.length) return;
    setFaq({ running: true, err: null, items: use.map((c) => ({ name: c.name, people: c.people, turns: c.turns, state: "cho" })) });
    const jobs = use.map((c, i) =>
      api.faq({ lecture: lectureLabel, name: c.name, people: c.people, turn_ids: c.turn_ids || [] })
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

  const faqItems = faq.items || [];
  const faqReady = faqItems.filter((x) => x.on && x.d && x.d.publishable).length;
  const faqRefused = faqItems.filter((x) => x.d && !x.d.publishable);

  /* ── Chưa chọn gì thì đừng dựng một trang rỗng: nói thẳng phải làm gì ── */
  if (!s || !picked.length) {
    return (
      <div className="mx-auto max-w-[1080px] px-5 sm:px-8 py-16">
        <Kicker>Bước 3 / 3 · Đầu ra</Kicker>
        <h1 className="text-[clamp(26px,4vw,40px)] font-semibold tracking-tight">Chưa có cụm nào được chọn</h1>
        <p className="mt-3 max-w-[60ch] text-[14.5px] leading-relaxed text-[color:var(--ink-2)]">
          Trang này soạn vật liệu giảng lại cho những cụm bạn đã chọn. Quay lại{" "}
          <strong>Đầu vào</strong>, kéo thanh “trả lời N cụm quan trọng nhất” rồi sang đây.
        </p>
        <Button variant="outlined" onClick={() => goTab("vao")} startIcon={<ArrowBackRoundedIcon fontSize="small" />}
          className="!mt-6 !rounded-full !border-[color:var(--line)] !text-[color:var(--ink)] !px-5 !py-2">
          Về trang Đầu vào
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px] px-5 sm:px-8 py-12 pb-24">
      <Kicker>Bước 3 / 3 · Đầu ra</Kicker>
      <h1 className="text-[clamp(26px,4vw,40px)] font-semibold tracking-tight">Vật liệu giảng lại</h1>
      <p className="mt-3 max-w-[66ch] text-[14.5px] leading-relaxed text-[color:var(--ink-2)]">
        <b className="num">{picked.length}</b> cụm đã chọn từ buổi <strong>{lectureLabel}</strong> ·{" "}
        <b className="num">{fmt(picked.reduce((a, c) => a + c.turns, 0))}</b> lượt hỏi. Mỗi mục dưới đây
        là <strong>bản nháp</strong> — AI soạn, người duyệt. Không có nút đăng thẳng lên VLearn.
      </p>

      {serverUp === false && (
        <Banner kind="warn" tag="Không có máy chủ">
          Đang mở bằng bản tĩnh nên không gọi được AI. Chạy <code>python codebase/serve.py</code> rồi mở lại.
        </Banner>
      )}

      {/* ══════════ TỪNG CỤM ══════════ */}
      <section className="reveal mt-8">
        <h2 className="text-[17px] font-semibold tracking-tight mb-3">Soạn từng cụm</h2>
        {picked.map((c) => {
          const id = sKey + "#" + c._i;
          const a = answers[id];
          return (
            <Card key={id} className="p-5 mb-3">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <p className="text-[15px] font-semibold tracking-tight">{c.name}</p>
                  <p className="mt-1 text-[12.5px] text-[color:var(--ink-2)]">
                    <b className="num">{fmt(c.turns)}</b> lượt · <b className="num">{fmt(c.people)}</b> học viên
                    {c.weak && <> · <Chip tone="warn">cụm yếu</Chip></>}
                    {c.skew && <> · <Chip tone="warn">tín hiệu lệch</Chip></>}
                  </p>
                </div>
                <Button size="small" variant={a && a.data ? "outlined" : "contained"}
                  onClick={() => requestAnswer(c)} disabled={a && a.loading}
                  startIcon={<AutoAwesomeRoundedIcon fontSize="small" />}
                  className={a && a.data
                    ? "!rounded-full !border-[color:var(--line)] !text-[color:var(--ink-2)]"
                    : "!rounded-full !bg-black hover:!bg-neutral-800 !text-white"}>
                  {a && a.data ? "Thu gọn" : "Soạn nội dung ôn"}
                </Button>
              </div>
              {(c.examples || []).length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[12.5px] text-[color:var(--primary)]">
                    Câu hỏi nguyên văn của học viên ({(c.examples || []).length})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {(c.examples || []).map((e, i) => (
                      <li key={i} className="text-[13px] text-[color:var(--ink-2)]">
                        <span className="num text-[11.5px] text-[color:var(--muted)] mr-2">{e.turn_id}</span>
                        “{e.q}”
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {a && <AnswerBox a={a} />}
            </Card>
          );
        })}
      </section>

      {/* ══════════ XUẤT HỎI ĐÁP ══════════ */}
      <section className="reveal mt-10">
        <h2 className="text-[17px] font-semibold tracking-tight">Xuất hỏi đáp cho VLearn</h2>
        <p className="mt-2 max-w-[66ch] text-[14px] leading-relaxed text-[color:var(--ink-2)]">
          Đây là thứ <strong>duy nhất</strong> trong sản phẩm đi tới học viên, nên nó qua ba cửa:
          bạn chọn cụm · hệ thống tự từ chối cụm không phải câu hỏi kiến thức · bạn bỏ tick từng mục
          trước khi tải. File tải về máy, người đăng là người.
        </p>

        <Card className="mt-4 p-5">
          <Button variant="contained" onClick={startFaq} disabled={faq.running || serverUp === false}
            startIcon={faq.running ? <CircularProgress size={16} color="inherit" /> : <DescriptionRoundedIcon fontSize="small" />}
            className="!rounded-full !bg-black hover:!bg-neutral-800 !text-white !px-5 !py-2">
            {faq.running ? "Đang soạn…" : `Soạn hỏi đáp cho ${picked.filter((c) => c.turns > 0).length} cụm`}
          </Button>
          {faq.err && <Banner kind="bad" tag="Lỗi">{faq.err}</Banner>}

          {faqItems.length > 0 && (
            <>
              <ul className="mt-4 divide-y divide-[color:var(--line-2)]">
                {faqItems.map((it, i) => {
                  const ok = it.state === "xong" && it.d && it.d.publishable;
                  return (
                    <li key={i} className="flex items-start gap-3 py-2">
                      <Checkbox size="small" checked={!!it.on} disabled={!ok}
                        onChange={(e) => setFaq((f) => {
                          const items = (f.items || []).slice();
                          items[i] = { ...items[i], on: e.target.checked };
                          return { ...f, items };
                        })}
                        inputProps={{ "aria-label": "Đưa mục này vào file" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px]">
                          {it.state === "xong" && it.d ? it.d.question : it.name}
                        </p>
                        {it.state === "cho" && <p className="text-[12px] text-[color:var(--muted)]">đang chờ…</p>}
                        {it.state === "loi" && <p className="text-[12px] text-[color:var(--critical-ink)]">{it.err}</p>}
                        {it.state === "xong" && it.d && !it.d.publishable && (
                          <p className="text-[12px] text-[color:var(--warn-ink)]">
                            hệ thống tự loại — {it.d.refuse_reason}
                          </p>
                        )}
                      </div>
                      <span className="num text-[12px] text-[color:var(--muted)] whitespace-nowrap">
                        {fmt(it.people)} người
                      </span>
                    </li>
                  );
                })}
              </ul>

              {faqRefused.length > 0 && (
                <Banner kind="info" tag="Đã tự loại">
                  <b className="num">{faqRefused.length}</b> cụm bị hệ thống loại khỏi bản hỏi đáp vì
                  không phải câu hỏi kiến thức (yêu cầu thao tác, câu hành chính…). Chúng vẫn nằm
                  nguyên ở phần soạn từng cụm bên trên — chỉ không đi vào file gửi học viên.
                </Banner>
              )}

              <Button variant="outlined" disabled={!faqReady || faq.running}
                onClick={() => downloadFaqDoc(faqItems, s)}
                startIcon={<DescriptionRoundedIcon fontSize="small" />}
                className="!mt-4 !rounded-full !border-[color:var(--line)] !text-[color:var(--ink)] !px-5 !py-2">
                Tải file .doc ({faqReady} mục)
              </Button>
            </>
          )}
        </Card>
      </section>

      <Button variant="text" onClick={() => goTab("vao")} startIcon={<ArrowBackRoundedIcon fontSize="small" />}
        className="!mt-8 !rounded-full !text-[color:var(--ink-2)]">
        Chọn lại cụm ở trang Đầu vào
      </Button>
    </div>
  );
}
