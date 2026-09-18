import { useMemo, useRef, useState } from "react";
import { fmt } from "../lib/data";
import { TableView } from "./Charts";

/* ══════════ BIỂU ĐỒ ĐƯỜNG — thay đổi theo thời gian ══════════
   Quy cách bắt buộc, giữ nguyên:
   · nét 2px, điểm ≥8px đường kính, lưới và trục lùi về sau
   · ≥2 chuỗi thì LUÔN có chú giải; nhãn trực tiếp CHỈ ở điểm cuối mỗi chuỗi
     (không in số lên mọi điểm — đó là cách nhanh nhất làm hỏng một biểu đồ đường)
   · có lớp hover: đường dóng + tooltip. Biểu đồ đường mà không hover được thì
     người đọc phải ước lượng bằng mắt từng điểm
   · KHÔNG BAO GIỜ hai trục y. Hai đại lượng khác thang → hai biểu đồ
   · màu đi theo THỰC THỂ: lọc bớt chuỗi thì các chuỗi còn lại KHÔNG đổi màu
   · bảng màu --s1/--s2/--s3 đã qua validator ở cả nền sáng và nền tối. Nền sáng
     có cảnh báo tương phản <3:1, nên bắt buộc kèm nhãn trực tiếp + bản xem dạng
     bảng — cả hai đều có ở dưới.                                              */

const css = (v) =>
  typeof window === "undefined" ? ""
    : getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = Math.ceil(v / p) * p;
  return n === v ? n + p / 2 : n;
}
/* Trục số nguyên: max nhỏ thì bước phải là số nguyên, nếu không nhãn làm tròn
   thành các số trùng nhau ("0,0,1,1,1" — lỗi đã từng xảy ra). */
function ticks(max) {
  const want = 5;
  if (max <= want) return Array.from({ length: max + 1 }, (_, i) => i);
  const step = Math.ceil(max / want);
  const out = [];
  for (let v = 0; v <= max; v += step) out.push(v);
  if (out[out.length - 1] < max) out.push(max);
  return out;
}
const dm = (iso) => {
  const p = String(iso || "").split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : iso;
};

export default function LineChart({
  rows,                 // [{x:'2026-09-11', a:12, b:1, c:0}, ...]
  series,               // [{k:'a', label:'Lượt hỏi thực'}, ...] — thứ tự CỐ ĐỊNH
  alt = "",
  height = 260,
  yLabel = "",
  tableCols = null,
}) {
  const wrap = useRef(null);
  const [hi, setHi] = useState(-1);

  const COLORS = [css("--s1") || "#2a78d6", css("--s2") || "#eb6834", css("--s3") || "#1baf7a"];

  const geom = useMemo(() => {
    const W = 760, H = height, L = 46, R = 78, T = 12, B = 30;
    const max = niceMax(Math.max(1, ...rows.flatMap((r) => series.map((s) => +r[s.k] || 0))));
    const n = Math.max(1, rows.length - 1);
    const x = (i) => L + (i / n) * (W - L - R);
    const y = (v) => T + (1 - v / max) * (H - T - B);
    return { W, H, L, R, T, B, max, x, y };
  }, [rows, series, height]);

  if (!rows.length) return <p className="text-[13px] text-[color:var(--muted)]">Không có dữ liệu để vẽ.</p>;
  const { W, H, L, R, T, B, max, x, y } = geom;

  /* Gỡ chồng nhãn cuối đường: xếp theo y rồi đẩy xuống cho đủ khoảng cách tối
     thiểu. Giữ nguyên thứ tự trên-dưới của các chuỗi để nhãn vẫn khớp đường. */
  const endLabels = (() => {
    const GAP = 14;
    const items = series.map((s, si) => ({
      k: s.k,
      x: x(rows.length - 1),
      y: y(+rows[rows.length - 1][s.k] || 0),
      text: fmt(+rows[rows.length - 1][s.k] || 0),
    })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) {
      if (items[i].y - items[i - 1].y < GAP) items[i].y = items[i - 1].y + GAP;
    }
    const over = items.length ? items[items.length - 1].y - (H - B) : 0;
    if (over > 0) items.forEach((it) => { it.y -= over; });   // tràn đáy thì đẩy cả cụm lên
    return items;
  })();

  const onMove = (e) => {
    const el = wrap.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;          // px màn hình → toạ độ viewBox
    const n = Math.max(1, rows.length - 1);
    const i = Math.round(((px - L) / (W - L - R)) * n);
    setHi(i >= 0 && i < rows.length ? i : -1);
  };

  return (
    <div>
      {/* chú giải: bắt buộc khi ≥2 chuỗi. Đơn vị trục y đứng ở đây chứ không vẽ
          trong SVG — trong đó nó đè lên vạch trục cao nhất. */}
      <div className="flex gap-4 flex-wrap items-center text-[12.5px] text-[color:var(--ink-2)] mb-2">
        {series.length >= 2 &&
          series.map((s, i) => (
            <span key={s.k} className="inline-flex items-center gap-1.5">
              <i className="inline-block w-3 h-[3px] rounded-full" style={{ background: COLORS[i % 3] }} />
              {s.label}
            </span>
          ))}
        {yLabel && <span className="ml-auto text-[color:var(--muted)]">đơn vị trục dọc: {yLabel}</span>}
      </div>

      <div ref={wrap} className="relative" onMouseMove={onMove} onMouseLeave={() => setHi(-1)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt} className="w-full h-auto block">
          {/* lưới + trục y, lùi về sau */}
          {ticks(max).map((v, i) => (
            <g key={i}>
              <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="var(--grid)" strokeWidth="1" />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11.5" fill="var(--muted)" className="num">{fmt(v)}</text>
            </g>
          ))}
          {/* yLabel KHÔNG vẽ trong SVG: đặt ở góc trên trái nó đè lên vạch trục
              cao nhất. Đơn vị hiện thành caption ngoài khung, xem dưới. */}

          {/* nhãn trục x — thưa bớt khi nhiều điểm để chữ không chồng nhau */}
          {rows.map((r, i) => {
            const every = Math.ceil(rows.length / 8);
            if (i % every !== 0 && i !== rows.length - 1) return null;
            return <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11.5" fill="var(--muted)">{dm(r.x)}</text>;
          })}

          {/* đường dóng khi rê chuột */}
          {hi >= 0 && <line x1={x(hi)} y1={T} x2={x(hi)} y2={H - B} stroke="var(--baseline)" strokeWidth="1" strokeDasharray="3 3" />}

          {series.map((s, si) => {
            const c = COLORS[si % 3];
            const pts = rows.map((r, i) => [x(i), y(+r[s.k] || 0)]);
            const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
            return (
              <g key={s.k}>
                <path d={d} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {pts.map((p, i) => (
                  <circle key={i} cx={p[0]} cy={p[1]} r={hi === i ? 5 : 4}
                    fill={c} stroke="var(--panel)" strokeWidth="2" />
                ))}
              </g>
            );
          })}

          {/* Nhãn trực tiếp CHỈ ở điểm cuối, và vẽ SAU mọi đường để không bị đè.
              Hai chuỗi kết thúc gần nhau thì nhãn chồng lên nhau thành chữ không
              đọc được — đã xảy ra thật với 11 và 5. Đẩy nhau ra tối thiểu 14px. */}
          {endLabels.map((e) => (
            <text key={e.k} x={e.x + 10} y={e.y + 4} fontSize="12" fill="var(--ink-2)" className="num">
              {e.text}
            </text>
          ))}
        </svg>

        {hi >= 0 && (
          <div className="pointer-events-none absolute z-10 rounded-lg border border-[color:var(--line)] bg-[color:var(--panel)] px-3 py-2 text-[12.5px] shadow-card"
            style={{ left: `calc(${(x(hi) / W) * 100}% + 10px)`, top: 8, transform: x(hi) > W * 0.62 ? "translateX(-108%)" : "none" }}>
            <p className="font-semibold mb-1">{dm(rows[hi].x)}</p>
            {series.map((s, si) => (
              <p key={s.k} className="flex items-center gap-2 whitespace-nowrap">
                <i className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[si % 3] }} />
                <span className="text-[color:var(--ink-2)]">{s.label}</span>
                <b className="num ml-auto">{fmt(+rows[hi][s.k] || 0)}</b>
              </p>
            ))}
            {rows[hi].note && <p className="mt-1 text-[11.5px] text-[color:var(--muted)]">{rows[hi].note}</p>}
          </div>
        )}
      </div>

      {/* bản xem dạng bảng — bắt buộc đi kèm, và là chỗ duy nhất còn đủ mọi điểm */}
      <TableView
        cols={tableCols || [{ t: "Ngày" }, ...series.map((s) => ({ t: s.label, n: 1 }))]}
        rows={rows.map((r) => [dm(r.x), ...series.map((s) => fmt(+r[s.k] || 0))])}
      />
    </div>
  );
}
