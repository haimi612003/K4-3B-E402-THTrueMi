import { useEffect, useRef, useState } from "react";
import Paper from "@mui/material/Paper";

/* Hiện dần khi cuộn tới. Lớp .js-reveal chỉ được thêm khi JS chắc chắn chạy và
   IntersectionObserver có thật — nhờ vậy nội dung KHÔNG BAO GIỜ bị giấu vĩnh
   viễn nếu có gì hỏng. Đây là điều kiện bắt buộc: giao diện này chở số liệu,
   không phải trang quảng cáo. */
/* Giữ tên hàm để các tab không phải sửa import, nhưng nó KHÔNG CÒN LÀM GÌ.
   Hiệu ứng hiện dần giờ nằm hoàn toàn trong CSS (xem .reveal trong index.css).

   Vì sao bỏ bản JS: nó bật một class lên khối cha để giấu MỌI .reveal rồi chỉ
   hiện lại danh sách phần tử chụp tại một thời điểm. Khối sinh ra sau — dữ liệu
   tới muộn, hoặc React dựng lại khi đổi nền sáng/tối — bị giấu mà không ai hiện
   lại. Đo được trên trang chủ: 0/23 khối hiện. Không có cách vá nào an toàn cho
   một cơ chế mà đường mặc định của nó là GIẤU nội dung. */
export function useReveal() { /* no-op, xem .reveal trong index.css */ }

export const Kicker = ({ children }) => (
  <p className="text-[12px] font-semibold tracking-[.12em] uppercase text-[color:var(--primary)] mb-2">{children}</p>
);

export const Card = ({ className = "", children, ...p }) => (
  <Paper elevation={0} className={"rounded-xl2 border border-[color:var(--line)] bg-[color:var(--panel)] shadow-card " + className} {...p}>
    {children}
  </Paper>
);

export const SectionTitle = ({ kicker, title, sub }) => (
  <div className="reveal mb-6">
    {kicker && <Kicker>{kicker}</Kicker>}
    <h2 className="text-[clamp(22px,3.2vw,34px)] font-semibold tracking-tight">{title}</h2>
    {sub && <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--ink-2)] max-w-[62ch]">{sub}</p>}
  </div>
);

export function Kpi({ label, value, unit, note }) {
  return (
    <div className="p-4 bg-[color:var(--panel)]">
      <p className="text-[11.5px] font-semibold tracking-[.08em] uppercase text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 text-[26px] font-semibold num leading-none">
        {value}{unit && <span className="text-[13px] font-normal text-[color:var(--muted)] ml-1">{unit}</span>}
      </p>
      {note && <p className="mt-1.5 text-[12.5px] text-[color:var(--ink-2)]">{note}</p>}
    </div>
  );
}

export const KpiGrid = ({ children }) => (
  <div className="grid gap-px bg-[color:var(--line-2)] border border-[color:var(--line)] rounded-xl2 overflow-hidden mb-4"
       style={{ gridTemplateColumns: "repeat(auto-fit,minmax(168px,1fr))" }}>{children}</div>
);

export function Banner({ kind = "info", tag, children }) {
  const tone = {
    info: "border-[color:var(--primary)] text-[color:var(--ink)]",
    warn: "border-[color:var(--warn)] text-[color:var(--ink)]",
    bad: "border-[color:var(--critical)] text-[color:var(--ink)]",
    good: "border-[color:var(--good)] text-[color:var(--ink)]",
  }[kind];
  return (
    <div className={"flex gap-3 items-start rounded-xl2 border border-l-[3px] bg-[color:var(--panel)] px-4 py-3 text-[13.5px] mb-4 " + tone}>
      {tag && <span className="shrink-0 text-[10.5px] font-bold tracking-[.09em] mt-0.5 text-[color:var(--muted)]">{tag}</span>}
      <span>{children}</span>
    </div>
  );
}

export function Chip({ tone = "n", children }) {
  const t = {
    n: "bg-[color:var(--surface-2)] text-[color:var(--ink-2)] border-[color:var(--line)]",
    top: "bg-[color:color-mix(in_srgb,var(--s2)_15%,var(--panel))] text-[color:var(--s2)] border-transparent",
    warn: "bg-[color:color-mix(in_srgb,var(--warn)_18%,var(--panel))] text-[color:var(--warn-ink)] border-transparent",
    ok: "bg-[color:color-mix(in_srgb,var(--good)_14%,var(--panel))] text-[color:var(--good-ink)] border-transparent",
    no: "bg-[color:color-mix(in_srgb,var(--critical)_12%,var(--panel))] text-[color:var(--critical-ink)] border-transparent",
  }[tone];
  return <span className={"inline-block rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap " + t}>{children}</span>;
}

/* <details> giữ trạng thái NGOÀI DOM để lần dựng lại không đóng sập nó. */
export function Disclosure({ id, summary, children, defaultOpen = false }) {
  const [open, setOpen] = useState(() => {
    try { return defaultOpen || sessionStorage.getItem("cp.det." + id) === "1"; } catch { return defaultOpen; }
  });
  const toggle = () => setOpen((o) => {
    const n = !o;
    try { sessionStorage.setItem("cp.det." + id, n ? "1" : "0"); } catch {}
    return n;
  });
  return (
    <div className="mt-3">
      <button type="button" onClick={toggle} aria-expanded={open}
        className="text-[13.5px] font-semibold text-[color:var(--primary)] hover:underline">
        {open ? "▾ " : "▸ "}{summary}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
