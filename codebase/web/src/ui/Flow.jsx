import { fmt } from "../lib/data";
import { Card } from "./Bits";
import { TableView } from "./Charts";

/* ══════════ TỪ ĐẦU VÀO TỚI ĐẦU RA ══════════
   Năm thanh trên CÙNG MỘT THANG (mẫu số luôn là tổng lượt trong log), nên đọc
   được ngay tỉ lệ: bao nhiêu bị loại trước khi đếm, bao nhiêu vào được cụm, và
   bao nhiêu không quy được vào đâu.

   Hai thanh đầu cố ý dùng màu trung tính chứ không lấy màu chuỗi dữ liệu: chúng
   là tổng và là phần bị bỏ đi, không phải hai "loại" ngang hàng với ba thanh
   dưới.

   Chỉ dựng được cho MỘT buổi cụ thể: gom cụm chạy trên trọn một buổi nên không
   có khái niệm "cụm theo ngày", và dựng một phép chia theo ngày ở đây sẽ là con
   số bịa.                                                                    */

const css = (v) =>
  typeof window === "undefined" ? ""
    : getComputedStyle(document.documentElement).getPropertyValue(v).trim();

export default function Flow({ s }) {
  if (!s || s.sparse || !s.clusters || !s.clusters.length) {
    return (
      <Card className="p-5">
        <h2 className="text-[17px] font-semibold tracking-tight">Từ đầu vào tới đầu ra</h2>
        <p className="mt-2 text-[13.5px] text-[color:var(--ink-2)]">
          Buổi này quá ít câu nên hệ thống không gom cụm — không có đầu ra để đối chiếu.
        </p>
      </Card>
    );
  }

  const S1 = css("--s1") || "#2a78d6", S2 = css("--s2") || "#eb6834", S3 = css("--s3") || "#1baf7a";
  const BASE = css("--baseline") || "#c3c2b7";

  const inClusters = s.clusters.reduce((a, c) => a + c.turns, 0);
  const scat = (s.scatter && s.scatter.turns) || 0;
  const preset = s.preset_removed || 0;
  const total = s.total_turns || 0;
  const pct = (v) => (total ? Math.round((v / total) * 100) : 0);

  const rows = [
    { lb: "Tổng lượt trong log", v: total, c: BASE },
    { lb: "Câu bấm nút có sẵn — loại trước khi đếm", v: preset, c: BASE },
    { lb: "Lượt hỏi thực (đầu vào của AI)", v: s.real_turns, c: S1 },
    { lb: "Vào được cụm", v: inClusters, c: S3 },
    { lb: "Rải rác — không quy được vào đâu", v: scat, c: S2 },
  ];

  return (
    <Card className="p-5">
      <h2 className="text-[17px] font-semibold tracking-tight">Từ đầu vào tới đầu ra</h2>
      <p className="mt-1 mb-4 text-[13px] text-[color:var(--ink-2)]">
        Cùng một thang, nên đọc được ngay tỉ lệ. Thanh <strong>rải rác</strong> là phần hệ thống
        thừa nhận không quy được về cụm nào — nó nằm trên dòng luôn hiện, không nằm trong cửa gập.
      </p>

      {rows.map((r, i) => (
        <div key={i} className="mb-2.5">
          <div className="flex items-baseline gap-3 text-[13px]">
            <span className="flex-1 min-w-0 text-[color:var(--ink-2)]">{r.lb}</span>
            <b className="num">{fmt(r.v)}</b>
            <span className="num text-[12px] text-[color:var(--muted)] w-12 text-right">{pct(r.v)}%</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-[color:var(--surface-2)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct(r.v)}%`, background: r.c }} />
          </div>
        </div>
      ))}

      <p className="mt-4 text-[13px] text-[color:var(--ink-2)]">
        Đầu ra cuối cùng: <b className="num">{s.clusters.length}</b> cụm vấn đề — từ{" "}
        <b className="num">{fmt(s.real_turns)}</b> lượt hỏi của <b className="num">{s.students}</b> học viên.
      </p>

      <TableView
        cols={[{ t: "Giai đoạn" }, { t: "Lượt", n: 1 }, { t: "% tổng log", n: 1 }]}
        rows={[
          ["Tổng lượt trong log", fmt(total), "100%"],
          ["Câu bấm nút có sẵn (loại)", fmt(preset), pct(preset) + "%"],
          ["Lượt hỏi thực", fmt(s.real_turns), pct(s.real_turns) + "%"],
          ["Vào được cụm", fmt(inClusters), pct(inClusters) + "%"],
          ["Rải rác", fmt(scat), pct(scat) + "%"],
          ["Số cụm tìm được", fmt(s.clusters.length), "—"],
        ]}
      />
    </Card>
  );
}
