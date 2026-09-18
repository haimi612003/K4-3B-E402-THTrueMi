import { useMemo } from "react";
import { fmt } from "../lib/data";

/* ══════════ LUẬT VẼ — giữ nguyên từ bản cũ, đừng nới ══════════
   · ≥2 chuỗi thì LUÔN có chú giải; 1 chuỗi thì tiêu đề đã gọi tên, không cần.
   · Trục số nguyên KHÔNG được lặp nhãn ("0,0,1,1,1" là lỗi đã từng xảy ra).
   · Mỗi biểu đồ có bản "xem dạng bảng" đi kèm — đó là nơi duy nhất còn ĐỦ dòng
     sau khi biểu đồ bị cắt bớt.
   · Màu đi theo THỰC THỂ, không theo thứ hạng: lọc mà đổi màu các mục còn lại
     là sai.
   · TUYỆT ĐỐI không animate giá trị số. Đã xảy ra thật: hiệu ứng đếm lên hiện
     509 trong khi sự thật là 511. Chuyển động chỉ áp cho HÌNH HỌC.            */

const css = (v) =>
  typeof window === "undefined" ? "" :
  getComputedStyle(document.documentElement).getPropertyValue(v).trim();

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p) * p;
}
/* Trục số nguyên: nếu max nhỏ thì bước phải là số nguyên, nếu không nhãn sẽ
   làm tròn thành các số trùng nhau. */
function ticks(max) {
  const want = 5;
  if (max <= want) return Array.from({ length: max + 1 }, (_, i) => i / max);
  const step = Math.ceil(max / want);
  const out = [];
  for (let v = 0; v <= max; v += step) out.push(v / max);
  if (out[out.length - 1] < 1) out.push(1);
  return out;
}

export function TableView({ cols, rows, label = "Xem dạng bảng" }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[12.5px] text-[color:var(--primary)] font-semibold">{label}</summary>
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-[color:var(--surface-2)]">
              {cols.map((c, i) => (
                <th key={i} className={"px-2.5 py-2 text-left font-semibold border-b border-[color:var(--line-2)] " + (c.n ? "text-right" : "")}>{c.t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j} className={"px-2.5 py-2 border-b border-[color:var(--line-2)] align-top " + (cols[j] && cols[j].n ? "text-right num" : "")}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function Legend({ items }) {
  if (!items || items.length < 2) return null;   // 1 chuỗi: tiêu đề đã gọi tên
  return (
    <div className="flex gap-4 flex-wrap text-[12.5px] text-[color:var(--ink-2)] mb-2">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: it.c }} />{it.label}
        </span>
      ))}
    </div>
  );
}

/* Thanh ngang nhóm đôi. opts.max: khi một bảng dữ liệu bị vẽ làm HAI biểu đồ
   (đầu + đuôi gập), cả hai BẮT BUỘC dùng chung một thang, không thì cụm 10 lượt
   vẽ dài ngang cụm 51 lượt. */
export function GroupedBars({ rows, single = false, labelW = 230, max: maxIn, alt = "", aLabel = "Lượt hỏi", bLabel = "Người hỏi" }) {
  const { max, W, H, ROW, BAR, GAP, PT, R } = useMemo(() => {
    const R = 52, PT = 8, ROW = single ? 30 : 44, BAR = 13, GAP = 2, W = 800;
    const m = maxIn || niceMax(Math.max(...rows.map((r) => (single ? r.a || 0 : Math.max(r.a || 0, r.b || 0))), 1));
    return { max: m, W, H: PT + rows.length * ROW + 26, ROW, BAR, GAP, PT, R };
  }, [rows, single, maxIn]);

  if (!rows.length) return <p className="text-[13px] text-[color:var(--muted)]">Không có dữ liệu để vẽ.</p>;
  const PW = W - labelW - R;
  const x = (v) => labelW + (v / max) * PW;
  const S1 = css("--s1") || "#2a78d6", S2 = css("--s2") || "#eb6834";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt} className="w-full h-auto">
      {ticks(max).map((f, i) => (
        <g key={i}>
          <line x1={x(max * f)} y1={PT} x2={x(max * f)} y2={PT + rows.length * ROW} stroke="var(--grid)" strokeWidth="1" />
          <text x={x(max * f)} y={H - 8} textAnchor="middle" fontSize="11.5" fill="var(--muted)">{fmt(Math.round(max * f))}</text>
        </g>
      ))}
      <line x1={labelW} y1={PT} x2={labelW} y2={PT + rows.length * ROW} stroke="var(--baseline)" strokeWidth="1" />
      {rows.map((r, i) => {
        const top = PT + i * ROW + 4;
        const nm = r.label.length > 32 ? r.label.slice(0, 31) + "…" : r.label;
        const series = single ? [["a", S1, 0]] : [["a", S1, 0], ["b", S2, BAR + GAP]];
        return (
          <g key={i}>
            <text x={labelW - 10} y={top + (single ? BAR - 1 : BAR + 1)} textAnchor="end" fontSize="12.5" fill="var(--ink-2)">{nm}</text>
            {series.map(([k, c, dy], j) => {
              const v = r[k] || 0, w = Math.max(v > 0 ? 2 : 0, x(v) - labelW);
              return (
                <g key={j}>
                  <rect x={labelW} y={top + dy} width={w} height={BAR} rx="3" fill={c} />
                  <text x={labelW + w + 6} y={top + dy + BAR - 2} fontSize="12" fill="var(--ink-2)" className="num">{fmt(v)}</text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

export function StackedBar({ parts }) {
  const tot = parts.reduce((a, p) => a + (p.v || 0), 0) || 1;
  return (
    <div>
      <div className="flex h-9 rounded-lg overflow-hidden gap-0.5">
        {parts.map((p, i) => (
          <div key={i} style={{ width: `${(p.v / tot) * 100}%`, background: p.c }} title={`${p.label}: ${fmt(p.v)}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-[12.5px] text-[color:var(--ink-2)]">
        {parts.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.c }} />
            {p.label} · <b className="num">{fmt(p.v)}</b> ({Math.round((p.v / tot) * 100)}%)
          </span>
        ))}
      </div>
    </div>
  );
}

export function Columns({ bins, alt = "" }) {
  const max = niceMax(Math.max(...bins.map((b) => b.count), 1));
  const S1 = css("--s1") || "#2a78d6";
  return (
    <div role="img" aria-label={alt} className="flex items-end gap-2 h-40 mt-2">
      {bins.map((b, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5">
          <span className="text-[12px] num text-[color:var(--ink-2)]">{b.count}</span>
          {/* scaleY chứ không animate height: height gây layout lại mỗi khung hình */}
          <div className="w-full rounded-t origin-bottom" style={{ height: `${(b.count / max) * 100}%`, background: S1, minHeight: b.count ? 3 : 0 }} />
          <span className="text-[11.5px] text-[color:var(--muted)] text-center">{b.label}</span>
        </div>
      ))}
    </div>
  );
}
