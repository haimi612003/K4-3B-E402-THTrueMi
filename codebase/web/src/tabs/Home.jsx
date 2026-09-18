import { useEffect, useMemo, useRef } from "react";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

import { D, TH, fmt, dmy, sessionsByDate, latestSession, biggestSession, scatterCount } from "../lib/data";
import { useReveal, Kicker, Card, Chip } from "../ui/Bits";
import { TableView } from "../ui/Charts";

/* ══════════ CHỮ NGHĨA BÊ NGUYÊN TỪ BẢN CŨ ══════════
   STEPS3 và PRINS chép đúng từng chữ từ codebase/ui/index.html. Đây là phần đã
   được biên tập kỹ — viết lại cho "hay hơn" là làm hỏng. */
const STEPS3 = [
  ["Nạp log một buổi",
   "Câu mẫu bấm sẵn bị loại trước khi đếm bất cứ thứ gì. Để lẫn vào là ra cụm giả — buổi nào cũng có người bấm nút “giải thích đoạn này” hàng chục lần."],
  ["Gom thành cụm vấn đề",
   "Mỗi cụm kèm số lượt, số người, phần bài, và câu hỏi nguyên văn có mã trỏ ngược về dòng log. Không viết lại, không tóm tắt."],
  ["Chọn chỗ để ôn",
   "Tick cụm rồi để AI soạn vật liệu giảng lại, hoặc xuất một bản hỏi đáp cho học viên khoá sau tra cứu."],
];

const PRINS = [
  ["Mọi con số đếm tay kiểm lại được.",
   "Model chỉ quyết một việc: câu nào thuộc cụm nào. Số lượt, số người, cờ cụm yếu, cờ tín hiệu lệch đều do code tính lại từ chính danh sách thành viên cụm."],
  ["Model không bao giờ thấy mã học viên.",
   "Prompt gửi đi chỉ có số thứ tự và câu hỏi. “Không lộ danh tính” vì thế là bảo đảm bằng cấu trúc, không phải một lời dặn model có thể quên."],
  ["Không chắc thì nói không chắc.",
   "Dưới sáu lượt hỏi thật, hệ thống báo “quá ít câu để kết luận” và không gọi AI. Thà không trả lời còn hơn nặn ra một danh sách trông đáng tin."],
  ["Thà tách nhỏ dư còn hơn gộp nhầm.",
   "Hai chỗ kẹt dùng chung một từ khoá vẫn là hai vấn đề. Tách dư thì giảng viên nhìn phát biết; gộp nhầm thì cả lớp mất một buổi mà không ai phát hiện."],
  ["Sửa chữa được ghi lại, không giấu.",
   "Model bịa mã, bỏ quên câu, xếp một câu vào hai cụm — đều bị sửa và ghi vào báo cáo. Số case phải sửa là một cột trong bảng kết quả đo."],
  ["Giảng viên quyết định cuối cùng.",
   "Hệ thống đưa vật liệu, không khuyến nghị. Thứ duy nhất đi tới học viên phải qua ba cửa duyệt, và không có nút đăng thẳng."],
];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const reduced = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* "DAY03 · K4P1/D04 · 11/09/2026" — đúng cách bản cũ đặt tiêu đề buổi. */
const label = (s) =>
  s ? (s.lecture_title ? s.lecture_title + " · " : "") + s.lecture + (s.first_day ? " · " + dmy(s.first_day) : "") : "";

/* ══════════ KHUNG MOCKUP NÂNG LÊN THEO TIẾN ĐỘ CUỘN ══════════
   · Bắt scroll trên phần tử cha [data-scroll] (App đặt nó trên <main>), không
     phải trên window — trang này không cuộn ở window.
   · listener {passive:true}; mọi lần gọi gộp vào MỘT requestAnimationFrame.
   · CHỈ ghi `transform`. Không ghi width/height: đổi kích thước thật là bắt
     trình duyệt layout lại cả trang ở từng frame.
   · prefers-reduced-motion: thoát sớm, không gắn listener nào. Trạng thái mặc
     định là KHÔNG có transform, nên khung vẫn hiện đủ và đúng cỡ. */
function useScrollLift(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced()) return;
    const scroller = el.closest("[data-scroll]");
    const target = scroller || window;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = scroller ? scroller.getBoundingClientRect().height : window.innerHeight;
      if (!vh) return;
      const p = clamp((vh - r.top) / (vh * 0.72), 0, 1);
      const e = p * p * (3 - 2 * p); // smoothstep
      el.style.transform = "translateY(" + ((1 - e) * 36).toFixed(2) + "px) scale(" + (0.9 + e * 0.1).toFixed(4) + ")";
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    apply();
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      el.style.transform = "";
    };
  }, [ref]);
}

/* Ô bằng chứng. Con số là TEXT TĨNH — tuyệt đối không có hiệu ứng đếm lên: đã
   xảy ra thật chuyện hiệu ứng hiện 509 trong khi sự thật là 511. */
function Evid({ big, children }) {
  return (
    <Card className="reveal p-5">
      <p className="num text-[clamp(26px,3.4vw,38px)] font-semibold leading-none tracking-tight">{big}</p>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-[color:var(--ink-2)]">{children}</p>
    </Card>
  );
}

/* ══════════ MOCKUP: bản thu nhỏ của bảng cụm, dựng từ DỮ LIỆU THẬT ══════════ */
function Mockup({ s, onOpen }) {
  const rows = useMemo(() => {
    if (!s || !s.clusters) return [];
    return s.clusters.slice().sort((a, b) => b.turns - a.turns).slice(0, 5);
  }, [s]);
  if (!s || !rows.length) return null;
  const max = rows[0].turns || 1;

  return (
    <div className="rounded-xl3 border border-[color:var(--line)] bg-[color:var(--panel)] shadow-float overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[color:var(--line)] bg-[color:var(--surface-2)]">
        <span className="flex gap-1.5 shrink-0" aria-hidden="true">
          <i className="inline-block w-[10px] h-[10px] rounded-full" style={{ background: "#ff5f57" }} />
          <i className="inline-block w-[10px] h-[10px] rounded-full" style={{ background: "#febc2e" }} />
          <i className="inline-block w-[10px] h-[10px] rounded-full" style={{ background: "#28c840" }} />
        </span>
        <span className="flex-1 truncate rounded-full border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-1 text-[11.5px] text-[color:var(--muted)]">
          class-pulse.local/#cum — {s.lecture}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <p className="text-[12.5px] font-semibold text-[color:var(--ink-2)]">Cụm vấn đề · {label(s)}</p>
        <p className="mt-0.5 text-[12px] text-[color:var(--muted)]">
          <span className="num">{fmt(s.real_turns)}</span> lượt hỏi thật của <span className="num">{s.students}</span> học viên ·{" "}
          <span className="num">{s.clusters.length}</span> cụm · năm cụm nhiều lượt nhất
        </p>

        <ol className="mt-3.5 grid gap-2.5">
          {rows.map((c, i) => (
            <li key={i} className="grid gap-1.5">
              <div className="flex items-baseline gap-2">
                <span className="num text-[11.5px] text-[color:var(--muted)] w-4 shrink-0">{i + 1}</span>
                <span className="text-[13px] font-medium leading-snug flex-1 min-w-0">{c.name}</span>
                <span className="num text-[12px] text-[color:var(--ink-2)] shrink-0 whitespace-nowrap">
                  {c.turns} lượt · {c.people} người
                </span>
              </div>
              {/* MỘT chuỗi duy nhất (lượt hỏi), và mọi giá trị đều in ra bằng số
                  ngay cạnh thanh — nên không cần chú giải riêng. Thanh chỉ là
                  hình học; con số không bao giờ chuyển động. */}
              <div className="ml-6 h-[7px] rounded-full bg-[color:var(--line-2)] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: (c.turns / max) * 100 + "%", background: "var(--s1)" }} />
              </div>
              {(c.weak || c.skew) && (
                <div className="ml-6 flex gap-1.5 flex-wrap">
                  {c.weak && <Chip tone="warn">cụm yếu</Chip>}
                  {c.skew && <Chip tone="warn">tín hiệu lệch</Chip>}
                </div>
              )}
            </li>
          ))}
        </ol>

        <TableView
          label="Xem dạng bảng"
          cols={[{ t: "Cụm vấn đề" }, { t: "Lượt", n: true }, { t: "Người", n: true }, { t: "Cờ" }]}
          rows={rows.map((c) => [
            c.name,
            c.turns,
            c.people,
            [c.weak ? "cụm yếu" : "", c.skew ? "tín hiệu lệch" : ""].filter(Boolean).join(" · ") || "—",
          ])}
        />

        <div className="mt-3 pt-3 border-t border-[color:var(--line-2)]">
          <Button size="small" variant="text" onClick={onOpen}
            className="!rounded-full !px-2 !text-[12.5px] !text-[color:var(--primary)]">
            Mở danh sách đầy đủ →
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Home({ sess, setSess, goTab }) {
  const root = useRef(null);
  const frame = useRef(null);
  useReveal(root);
  useScrollLift(frame);

  const ev = D.eval && D.eval.summary;
  const ea = D.eval_answer && D.eval_answer.summary;

  const big = biggestSession();    // buổi ĐÔNG NHẤT — dải bằng chứng và mockup
  const latest = latestSession();  // buổi GẦN NHẤT — có thể là buổi quá ít câu
  const withCls = useMemo(
    () => sessionsByDate().filter((x) => !x.sparse && x.clusters && x.clusters.length)[0] || null,
    []
  );

  /* Cụm đông NGƯỜI nhất — khác cụm nhiều LƯỢT nhất mà tab Tổng quan dẫn đầu.
     Nói rõ đang tính gì thay vì để hai con số chọi nhau. */
  const peak = useMemo(() => {
    let p = null;
    if (big && big.clusters) big.clusters.forEach((c) => { if (!p || c.people > p.people) p = c; });
    return p;
  }, [big]);

  const open = (s) => {
    const i = (D.sessions || []).indexOf(s);
    if (i >= 0) setSess(i);
    goTab("cum");
  };
  const toHow = () => {
    const el = document.getElementById("how");
    if (el) el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  };

  /* Con số bất lợi của buổi đông nhất — ở tầng LUÔN HIỆN, ngay dưới mockup,
     không đẩy vào chỗ phải bấm mới thấy. */
  const scat = scatterCount(big);
  const scatPct = big && big.real_turns ? Math.round((scat / big.real_turns) * 100) : 0;
  const weakN = big && big.clusters ? big.clusters.filter((c) => c.weak).length : 0;
  const skewN = big && big.clusters ? big.clusters.filter((c) => c.skew).length : 0;
  const rep = (big && big.repairs) || {};
  const dupN = (rep.duplicates || []).length;
  const invN = (rep.invented_ids || []).length;

  return (
    <div ref={root}>
      {/* ══════════ HERO — trên nền trời ══════════ */}
      <div className="sky">
        <div className="mx-auto max-w-[1080px] px-5 sm:px-8 pt-16 sm:pt-24 pb-10">
          <div className="reveal max-w-[820px]">
            <Kicker>VLearn · Bản đồ vấn đề của lớp</Kicker>
            <h1 className="text-[clamp(38px,7vw,74px)] font-semibold tracking-tight leading-[1.02]">
              Hàng trăm câu hỏi.
              <br />
              <span className="text-[color:var(--ink-2)]">Vài vấn đề.</span>
            </h1>
            <p className="mt-6 max-w-[62ch] text-[clamp(15px,1.5vw,18px)] leading-relaxed text-[color:var(--ink-2)]">
              Sau mỗi buổi học, câu hỏi của lớp nằm rải rác trong log — hàng trăm dòng, không nhóm, không đếm.
              Class Pulse gom chúng lại thành những{" "}
              <strong className="font-semibold text-[color:var(--ink)]">cụm vấn đề có số lượng và câu nguyên văn</strong>,
              để giảng viên biết buổi sau nên ôn lại chỗ nào thay vì đoán.
            </p>

            <div className="mt-8 flex flex-wrap gap-2.5">
              <Button variant="contained" onClick={() => open(withCls || big)}
                endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                className="!rounded-full !bg-black hover:!bg-neutral-800 !text-white !px-6 !py-2.5 !text-[14.5px]">
                Xem lớp tôi kẹt ở đâu
              </Button>
              <Button variant="outlined" onClick={toHow}
                className="!rounded-full !border-[color:var(--line)] !bg-[color:var(--panel)] !text-[color:var(--ink)] !px-6 !py-2.5 !text-[14.5px]">
                Cách hoạt động
              </Button>
              <Button variant="outlined" onClick={() => goTab("live")}
                startIcon={<BoltRoundedIcon fontSize="small" />}
                className="!rounded-full !border-[color:var(--line)] !bg-[color:var(--panel)] !text-[color:var(--ink)] !px-6 !py-2.5 !text-[14.5px]">
                Thử với AI thật
              </Button>
            </div>
          </div>

          {/* Dải 3 ô bằng chứng */}
          <div className="mt-12 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(248px,1fr))" }}>
            <Evid big="92,6%">
              câu hỏi thực của khoá K4 là chuỗi chỉ xuất hiện{" "}
              <strong className="text-[color:var(--ink)]">đúng một lần</strong> — gom bằng trùng khớp văn bản là vô dụng
            </Evid>
            <Evid big={peak && big ? peak.people + "/" + big.students : "—"}>
              {peak ? (
                <>
                  học viên của một buổi cùng kẹt ở <strong className="text-[color:var(--ink)]">{peak.name}</strong>, hỏi bằng{" "}
                  <span className="num">{peak.turns}</span> lượt khác nhau
                </>
              ) : (
                "học viên của một buổi cùng kẹt ở một chỗ"
              )}
            </Evid>
            <Evid big={big ? fmt(big.real_turns) : "—"}>
              lượt hỏi thật một buổi, tương đương 20 trang A4 nếu đọc tay
            </Evid>
          </div>

          {/* Mockup sản phẩm — nâng lên và nở ra khi cuộn tới */}
          {big && (
            <div className="mt-12 reveal">
              <div ref={frame} style={{ willChange: "transform", transformOrigin: "50% 100%" }}>
                <Mockup s={big} onOpen={() => open(big)} />
              </div>
            </div>
          )}

          {big && (
            <p className="mt-4 max-w-[76ch] text-[12.5px] leading-relaxed text-[color:var(--ink-2)]">
              Cùng buổi đó, phần không đẹp cũng được đếm: <b className="num">{fmt(scat)}</b> lượt ({scatPct}%) rải rác{" "}
              <strong>không quy được về cụm nào</strong> · <b className="num">{weakN}</b> cụm yếu (≤{TH.weak_max_people || 2} người) ·{" "}
              <b className="num">{skewN}</b> cụm bị cờ tín hiệu lệch · <b className="num">{invN}</b> mã bịa và{" "}
              <b className="num">{dupN}</b> câu bị xếp vào hai cụm đã phải sửa lại ·{" "}
              <b className="num">{fmt(big.preset_removed || 0)}</b> lượt câu mẫu bấm sẵn bị loại trước khi đếm.
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1080px] px-5 sm:px-8 pb-20">
        {/* ══════════ BUỔI GẦN NHẤT ══════════ */}
        {latest && (
          <section className="mt-14 sm:mt-20">
            <div className="reveal">
              <Kicker>Buổi gần nhất</Kicker>
              <h2 className="text-[clamp(22px,3.2vw,34px)] font-semibold tracking-tight">{label(latest)}</h2>
            </div>

            {latest.sparse || !latest.clusters || !latest.clusters.length ? (
              /* Buổi gần nhất thật có thể là buổi quá ít câu để kết luận. Nói
                 thẳng — đây chính là hành vi sản phẩm muốn khoe, không phải
                 chuyện cần giấu. Rồi chỉ sang buổi gần nhất CÓ cụm, gọi đúng
                 tên nó. */
              <Card className="reveal mt-4 p-5 sm:p-6 border-l-[3px] !border-l-[color:var(--warn)]">
                <p className="max-w-[70ch] text-[15px] leading-relaxed text-[color:var(--ink-2)]">
                  Buổi này chỉ có <b className="num text-[color:var(--ink)]">{fmt(latest.real_turns)}</b> lượt hỏi thật của{" "}
                  <span className="num">{latest.students}</span> học viên — dưới ngưỡng{" "}
                  <span className="num">{TH.sparse_min_turns || 6}</span> lượt, nên hệ thống{" "}
                  <strong className="text-[color:var(--ink)]">không gọi AI và không gom cụm</strong>. Thà không trả lời còn
                  hơn nặn ra một danh sách trông đáng tin.
                </p>
                {withCls && (
                  <>
                    <p className="mt-4 max-w-[70ch] text-[15px] leading-relaxed text-[color:var(--ink-2)]">
                      Buổi gần nhất có đủ dữ liệu để gom là{" "}
                      <strong className="text-[color:var(--ink)]">{label(withCls)}</strong> —{" "}
                      <span className="num">{fmt(withCls.real_turns)}</span> lượt,{" "}
                      <span className="num">{withCls.clusters.length}</span> cụm.
                    </p>
                    <Button variant="contained" onClick={() => open(withCls)}
                      endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                      className="!mt-5 !rounded-full !bg-black hover:!bg-neutral-800 !text-white !px-5 !py-2 !text-[14px]">
                      Mở buổi đó
                    </Button>
                  </>
                )}
              </Card>
            ) : (
              <>
                <p className="reveal mt-2 max-w-[70ch] text-[15px] leading-relaxed text-[color:var(--ink-2)]">
                  <span className="num">{fmt(latest.real_turns)}</span> lượt hỏi của{" "}
                  <span className="num">{latest.students}</span> học viên, gom thành{" "}
                  <span className="num">{latest.clusters.length}</span> cụm vấn đề. Ba cụm đông nhất:
                </p>
                <ol className="mt-4 grid gap-2.5">
                  {latest.clusters
                    .slice()
                    .sort((a, b) => b.turns - a.turns)
                    .filter((c) => !c.weak)
                    .slice(0, 3)
                    .map((c, i) => (
                      <li key={i}>
                        <Card className="reveal flex items-start gap-4 p-4">
                          <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--surface-2)] text-[13px] font-semibold">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[15px] font-medium leading-snug">{c.name}</p>
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[color:var(--ink-2)]">
                              <span>
                                <b className="num text-[color:var(--ink)]">{c.people}</b>/{latest.students} học viên ·{" "}
                                <b className="num text-[color:var(--ink)]">{c.turns}</b> lượt
                              </span>
                              {c.skew && (
                                <Tooltip title={"Một người chiếm " + Math.round((c.skew_top_share || 0) * 100) + "% số lượt của cụm này"}>
                                  <span><Chip tone="warn">tín hiệu lệch</Chip></span>
                                </Tooltip>
                              )}
                            </p>
                          </div>
                        </Card>
                      </li>
                    ))}
                </ol>
                <Button variant="contained" onClick={() => open(latest)}
                  endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                  className="!mt-5 !rounded-full !bg-black hover:!bg-neutral-800 !text-white !px-5 !py-2 !text-[14px]">
                  Mở danh sách đầy đủ
                </Button>
              </>
            )}
          </section>
        )}

        {/* ══════════ CÁCH HOẠT ĐỘNG ══════════ */}
        <section id="how" className="mt-16 sm:mt-24 scroll-mt-6">
          <div className="reveal">
            <Kicker>Cách hoạt động</Kicker>
            <h2 className="text-[clamp(22px,3.2vw,34px)] font-semibold tracking-tight">
              Ba bước, từ log thô tới quyết định dạy.
            </h2>
          </div>
          <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(272px,1fr))" }}>
            {STEPS3.map((x, i) => (
              <Card key={i} className="reveal p-5 sm:p-6">
                <span className="num inline-grid h-9 w-9 place-items-center rounded-full bg-[color:var(--ink)] text-[14px] font-semibold text-[color:var(--panel)]">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-[17px] font-semibold tracking-tight">{x[0]}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--ink-2)]">{x[1]}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ══════════ NGUYÊN TẮC THIẾT KẾ ══════════ */}
        <section className="mt-16 sm:mt-24">
          <div className="reveal max-w-[70ch]">
            <Kicker>Nguyên tắc thiết kế</Kicker>
            <h2 className="text-[clamp(22px,3.2vw,34px)] font-semibold tracking-tight">
              Sáu điều hệ thống này không đánh đổi.
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--ink-2)]">
              Sản phẩm đọc câu hỏi của người học và đưa kết luận cho người dạy. Sai một lần là cả lớp mất một buổi, nên
              mỗi nguyên tắc dưới đây đều có một cơ chế trong code đỡ nó, không chỉ là lời hứa.
            </p>
          </div>
          <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(288px,1fr))" }}>
            {PRINS.map((x, i) => (
              <Card key={i} className="reveal p-5 sm:p-6">
                <h3 className="text-[16px] font-semibold leading-snug tracking-tight">{x[0]}</h3>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-[color:var(--ink-2)]">{x[1]}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ══════════ ĐO ĐƯỢC ══════════ */}
        {(ev || ea) && (
          <section className="mt-16 sm:mt-24">
            <div className="reveal max-w-[70ch]">
              <Kicker>Đo được</Kicker>
              <h2 className="text-[clamp(22px,3.2vw,34px)] font-semibold tracking-tight">Nói có sách.</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--ink-2)]">
                Hai quyết định AI, hai bộ kiểm thử riêng, chấm bằng assertion máy kiểm được — hai người chạy lại đều ra
                cùng con số.
              </p>
            </div>
            <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(248px,1fr))" }}>
              {ev && (
                <Evid big={ev.n_pass + "/" + ev.n_cases}>
                  case đạt ở bộ đo <strong className="text-[color:var(--ink)]">gom cụm</strong> — lượt đo {ev.run}
                </Evid>
              )}
              {ea && (
                <Evid big={ea.n_pass + "/" + ea.n_cases}>
                  case đạt ở bộ đo <strong className="text-[color:var(--ink)]">soạn nội dung ôn</strong> — chỉ đo tính kỷ
                  luật, không đo đúng-sai kiến thức
                </Evid>
              )}
              <Evid big="11/11">ca kiểm ngược: output cố tình hỏng vẫn bị bộ đo bắt được</Evid>
            </div>

            {/* Case TRƯỢT nằm cùng tầng với case ĐẠT — không gập, không giấu. */}
            <p className="mt-4 max-w-[76ch] text-[12.5px] leading-relaxed text-[color:var(--ink-2)]">
              Phần trượt, để nguyên:{" "}
              {ev && (
                <>
                  <b className="num">{ev.n_fail}</b> case trượt ở bộ đo gom cụm
                  {ev.errors && ev.errors.length ? " (" + ev.errors.map((e) => e.name).join("; ") + ")" : ""}
                </>
              )}
              {ev && ea ? " · " : ""}
              {ea && (
                <>
                  <b className="num">{ea.n_fail}</b> case trượt ở bộ đo soạn nội dung ôn
                  {ea.errors && ea.errors.length ? " (" + ea.errors.map((e) => e.name).join("; ") + ")" : ""}
                </>
              )}
              {ev && ev.cases_fell_back ? (
                <> · <b className="num">{ev.cases_fell_back}</b> case phải rơi sang model dự phòng</>
              ) : null}
              {ev && ev.cases_needing_repair != null ? (
                <> · <b className="num">{ev.cases_needing_repair}</b> case phải sửa lại output của model</>
              ) : null}
              .
            </p>

            <div className="reveal mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button variant="outlined" onClick={() => goTab("eval")}
                endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                className="!rounded-full !border-[color:var(--line)] !bg-[color:var(--panel)] !text-[color:var(--ink)] !px-5 !py-2 !text-[14px]">
                Xem chi tiết kết quả đo
              </Button>
              {/* Tab Nhật ký AI đã bỏ khỏi thanh điều hướng, nên đường tới nhật ký
                  từng lời gọi phải được nói ra ở đây — đó là bằng chứng "AI chạy
                  thật", không để nó biến mất theo cái tab. */}
              <span className="text-[13px] text-[color:var(--muted)]">
                Nhật ký từng lời gọi model: <code>logs/gemini-calls.jsonl</code>, kèm prompt đầy đủ và phản hồi thô.
              </span>
            </div>
          </section>
        )}

        {/* ══════════ CHÂN TRANG ══════════ */}
        <footer className="mt-16 flex flex-wrap justify-between gap-x-6 gap-y-1.5 border-t border-[color:var(--line)] pt-6 text-[12.5px] text-[color:var(--muted)] sm:mt-24">
          <span>Nhóm THTrueMi · Lớp 3B · E402 · VinUni AI20k</span>
          <span>Số liệu trên trang này lấy từ chatlog VLearn khoá K4 đã ẩn danh.</span>
        </footer>
      </div>
    </div>
  );
}
