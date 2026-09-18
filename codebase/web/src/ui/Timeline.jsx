import { useMemo, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

import { D, fmt, dmy, sessionsByDate } from "../lib/data";
import { Card, Kicker, Kpi, KpiGrid } from "./Bits";
import { TableView } from "./Charts";
import LineChart from "./LineChart";

/* ══════════ DÒNG THỜI GIAN + BỘ LỌC ══════════
   Ba bộ lọc nằm trên MỘT hàng, ngay trên biểu đồ — đúng chỗ người đọc tìm.
   Lọc chỉ đổi TẬP DỮ LIỆU, không đổi màu chuỗi: màu đi theo thực thể, nên bỏ
   một buổi ra khỏi bộ lọc thì hai chuỗi còn lại giữ nguyên màu.               */

const css = (v) =>
  typeof window === "undefined" ? ""
    : getComputedStyle(document.documentElement).getPropertyValue(v).trim();

const monthOf = (iso) => String(iso || "").slice(0, 7);
const monthLabel = (m) => {
  const p = m.split("-");
  return p.length === 2 ? `Tháng ${+p[1]}/${p[0]}` : m;
};

export default function Timeline({ sess, setSess }) {
  const all = D.sessions || [];
  const timeline = D.timeline || [];

  /* Bộ lọc buổi DÙNG CHUNG với thanh chọn buổi ở đầu tab. Trước đây đây là một
     state riêng, nên trang có HAI ô “Buổi học” cách nhau cả màn hình mà đổi ô
     này không đổi ô kia — người đọc không có cách nào biết mình đang xem buổi
     nào. Giờ chỉ còn một nguồn sự thật: `sess`. Phần thêm của riêng dòng thời
     gian là lựa chọn “tất cả các buổi”, nên chỉ cần nhớ đang ở chế độ nào. */
  const [scope, setScope] = useState("all");       // "all" | "one"
  const [month, setMonth] = useState("all");       // lọc theo THÁNG
  const [day, setDay] = useState("all");           // lọc theo NGÀY

  const cur = all[sess] || null;
  const lecture = scope === "one" && cur ? cur.lecture : "all";

  const months = useMemo(
    () => Array.from(new Set(timeline.map((r) => monthOf(r.day)))).sort(),
    [timeline]
  );

  /* Nguồn dữ liệu đổi theo bộ lọc buổi: "tất cả" thì dùng dòng thời gian gộp,
     chọn một buổi thì dùng per_day của chính buổi đó. */
  const base = useMemo(() => {
    if (lecture === "all") return timeline;
    const s = all.find((x) => x.lecture === lecture);
    return (s && s.per_day) || [];
  }, [lecture, all, timeline]);

  const rows = useMemo(
    () =>
      base
        .filter((r) => (month === "all" ? true : monthOf(r.day) === month))
        .filter((r) => (day === "all" ? true : r.day === day))
        .map((r) => ({
          x: r.day,
          turns: r.turns,
          students: r.students,
          preset: r.preset,
          note: r.lectures && r.lectures.length > 1 ? `${r.lectures.length} buổi cùng có câu hỏi trong ngày này` : "",
        })),
    [base, month, day]
  );

  const dayOptions = useMemo(
    () => base.filter((r) => (month === "all" ? true : monthOf(r.day) === month)).map((r) => r.day),
    [base, month]
  );

  const tot = rows.reduce(
    (a, r) => ({ turns: a.turns + r.turns, students: a.students + r.students, preset: a.preset + r.preset }),
    { turns: 0, students: 0, preset: 0 }
  );

  /* ── Input → Output: cùng MỘT thang, nên so trực tiếp được ──
     Chỉ dựng được khi đang xem một buổi cụ thể, vì "cụm" là kết quả của một lần
     gom trên trọn buổi — không có khái niệm cụm theo ngày. Nói thẳng chuyện đó
     thay vì bịa ra một phép chia theo ngày. */
  const io = useMemo(() => {
    if (lecture === "all") return null;
    const s = all.find((x) => x.lecture === lecture);
    if (!s || s.sparse || !s.clusters || !s.clusters.length) return null;
    const inClusters = s.clusters.reduce((a, c) => a + c.turns, 0);
    const scat = (s.scatter && s.scatter.turns) || 0;
    return { s, inClusters, scat, preset: s.preset_removed || 0, total: s.total_turns || 0 };
  }, [lecture, all]);

  const S1 = css("--s1") || "#2a78d6", S2 = css("--s2") || "#eb6834", S3 = css("--s3") || "#1baf7a";
  const BASE = css("--baseline") || "#c3c2b7";

  const reset = () => { setScope("all"); setMonth("all"); setDay("all"); };
  const filtered = lecture !== "all" || month !== "all" || day !== "all";

  return (
    <section className="reveal mt-10">
      <Kicker>Dòng thời gian</Kicker>
      <h2 className="text-[clamp(20px,2.6vw,28px)] font-semibold tracking-tight">
        Câu hỏi tới vào những ngày nào
      </h2>
      <p className="mt-2 text-[14.5px] leading-relaxed text-[color:var(--ink-2)] max-w-[68ch]">
        Học viên vẫn hỏi về một buổi trong nhiều ngày sau khi buổi đó đã dạy xong. Đó là lý do
        “buổi” và “ngày” là hai trục khác nhau, và vì sao bộ lọc để riêng.
      </p>

      {/* ── BA BỘ LỌC, MỘT HÀNG, NGAY TRÊN BIỂU ĐỒ ── */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <FormControl size="small" className="min-w-[230px]">
          <InputLabel id="f-lec">Buổi học</InputLabel>
          {/* value là CHỈ SỐ trong D.sessions, giống thanh chọn ở đầu tab — danh
              sách hiển thị theo thứ tự buổi nên không được dùng chỉ số của mảng
              đã sắp lại. */}
          <Select labelId="f-lec" label="Buổi học"
            value={scope === "one" ? String(sess) : "all"}
            onChange={(e) => {
              const v = e.target.value;
              setDay("all");
              if (v === "all") { setScope("all"); return; }
              setScope("one");
              setSess(Number(v));
            }}>
            <MenuItem value="all">Tất cả các buổi</MenuItem>
            {sessionsByDate().map((x) => {
              const i = all.indexOf(x);
              return (
                <MenuItem key={x.key || i} value={String(i)}>
                  {(x.lecture_title ? x.lecture_title + " · " : "") + x.lecture}
                  {x.first_day ? " · " + dmy(x.first_day) : ""}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>

        <FormControl size="small" className="min-w-[160px]">
          <InputLabel id="f-mon">Tháng</InputLabel>
          <Select labelId="f-mon" label="Tháng" value={month}
            onChange={(e) => { setMonth(e.target.value); setDay("all"); }}>
            <MenuItem value="all">Tất cả</MenuItem>
            {months.map((m) => <MenuItem key={m} value={m}>{monthLabel(m)}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" className="min-w-[160px]">
          <InputLabel id="f-day">Ngày</InputLabel>
          <Select labelId="f-day" label="Ngày" value={day} onChange={(e) => setDay(e.target.value)}>
            <MenuItem value="all">Tất cả</MenuItem>
            {dayOptions.map((d) => <MenuItem key={d} value={d}>{dmy(d)}</MenuItem>)}
          </Select>
        </FormControl>

        {filtered && (
          <button type="button" onClick={reset}
            className="rounded-full border border-[color:var(--line)] px-3.5 py-1.5 text-[13px] text-[color:var(--ink-2)] hover:bg-[color:var(--surface-2)]">
            Bỏ lọc
          </button>
        )}

        <span className="ml-auto text-[13px] text-[color:var(--ink-2)]">
          <b className="num">{rows.length}</b> ngày · <b className="num">{fmt(tot.turns)}</b> lượt thực ·{" "}
          <b className="num">{fmt(tot.preset)}</b> câu bấm nút có sẵn đã loại
        </span>
      </div>

      {rows.length === 0 ? (
        <Card className="mt-4 p-6 text-[13.5px] text-[color:var(--ink-2)]">
          Bộ lọc hiện tại không còn ngày nào. Bấm “Bỏ lọc”.
        </Card>
      ) : rows.length === 1 ? (
        /* MỘT ngày thì không có gì để nối thành đường. Vẽ biểu đồ đường ở đây sẽ
           ra ba chấm dính mép trái và 90% khung trống — đúng kiểu biểu đồ sai
           dạng. Một điểm dữ liệu thì đọc thẳng con số là nhanh nhất. */
        <Card className="mt-4 p-5">
          <h3 className="text-[16px] font-semibold tracking-tight">Ngày {dmy(rows[0].x)}</h3>
          <p className="mt-1 mb-3 text-[13px] text-[color:var(--ink-2)]">
            Bộ lọc còn đúng một ngày nên không có xu hướng để vẽ — số đọc thẳng nhanh hơn một
            biểu đồ đường chỉ có một điểm. Bỏ lọc ngày để xem lại đường theo thời gian.
          </p>
          <KpiGrid>
            <Kpi label="Lượt hỏi thực" value={fmt(rows[0].turns)} unit="lượt" />
            <Kpi label="Học viên đã hỏi" value={fmt(rows[0].students)} unit="người" />
            <Kpi label="Câu bấm nút có sẵn (đã loại)" value={fmt(rows[0].preset)} unit="lượt" />
            <Kpi label="Trung bình" value={rows[0].students ? (Math.round((rows[0].turns / rows[0].students) * 10) / 10) : 0}
                 unit="lượt/HV" />
          </KpiGrid>
          {rows[0].note && <p className="text-[12.5px] text-[color:var(--muted)]">{rows[0].note}</p>}
        </Card>
      ) : (
        <>
          {/* ── LINE CHART 1 · INPUT theo ngày ── */}
          <Card className="mt-4 p-5">
            <h3 className="text-[16px] font-semibold tracking-tight">Đầu vào theo ngày</h3>
            <p className="mt-1 mb-3 text-[13px] text-[color:var(--ink-2)]">
              Ba đại lượng cùng đơn vị “lượt/người” nên vẽ chung một trục được. Câu bấm nút có sẵn
              vẽ riêng vì nó bị <strong>loại trước khi đếm</strong> — nó là thứ hệ thống bỏ đi, không
              phải thứ Lab Coach cần đọc.
            </p>
            <LineChart
              rows={rows}
              series={[
                { k: "turns", label: "Lượt hỏi thực" },
                { k: "students", label: "Học viên đã hỏi" },
                { k: "preset", label: "Câu bấm nút có sẵn (đã loại)" },
              ]}
              alt="Lượt hỏi thực, số học viên và số câu bấm nút có sẵn theo từng ngày"
              yLabel="lượt"
              tableCols={[{ t: "Ngày" }, { t: "Lượt thực", n: 1 }, { t: "Học viên", n: 1 }, { t: "Câu mẫu đã loại", n: 1 }]}
            />
          </Card>

          {/* ── LINE CHART 2 · lượt trên mỗi học viên ──
              Tách thành biểu đồ RIÊNG chứ không nhét trục thứ hai vào biểu đồ
              trên: hai trục y trong một khung là lỗi biểu đồ phổ biến nhất. */}
          <Card className="mt-4 p-5">
            <h3 className="text-[16px] font-semibold tracking-tight">Trung bình lượt hỏi trên mỗi học viên</h3>
            <p className="mt-1 mb-3 text-[13px] text-[color:var(--ink-2)]">
              Tách khỏi biểu đồ trên vì khác thang đo. Ngày nào đường này vọt lên mà số học viên
              không tăng thì đó là dấu hiệu <strong>một vài người hỏi dồn</strong>, không phải cả lớp kẹt.
            </p>
            <LineChart
              rows={rows.map((r) => ({ x: r.x, avg: r.students ? Math.round((r.turns / r.students) * 10) / 10 : 0 }))}
              series={[{ k: "avg", label: "Lượt / học viên" }]}
              alt="Số lượt hỏi trung bình trên mỗi học viên theo ngày"
              height={200}
              yLabel="lượt/HV"
              tableCols={[{ t: "Ngày" }, { t: "Lượt / học viên", n: 1 }]}
            />
          </Card>
        </>
      )}

      {/* ── INPUT → OUTPUT ── */}
      <Card className="mt-4 p-5">
        <h3 className="text-[16px] font-semibold tracking-tight">Từ đầu vào tới đầu ra</h3>
        {io ? (
          <>
            <p className="mt-1 mb-4 text-[13px] text-[color:var(--ink-2)]">
              Cùng một thang, nên đọc được ngay tỉ lệ: bao nhiêu lượt bị loại trước khi đếm, bao
              nhiêu vào được cụm, và bao nhiêu <strong>không quy được vào đâu</strong>.
            </p>
            {[
              { lb: "Tổng lượt trong log", v: io.total, c: BASE },
              { lb: "Câu bấm nút có sẵn — loại trước khi đếm", v: io.preset, c: BASE },
              { lb: "Lượt hỏi thực (đầu vào của AI)", v: io.s.real_turns, c: S1 },
              { lb: "Vào được cụm", v: io.inClusters, c: S3 },
              { lb: "Rải rác — không quy được vào đâu", v: io.scat, c: S2 },
            ].map((r, i) => (
              <div key={i} className="mb-2.5">
                <div className="flex items-baseline gap-3 text-[13px]">
                  <span className="flex-1 min-w-0 text-[color:var(--ink-2)]">{r.lb}</span>
                  <b className="num">{fmt(r.v)}</b>
                  <span className="num text-[12px] text-[color:var(--muted)] w-12 text-right">
                    {io.total ? Math.round((r.v / io.total) * 100) : 0}%
                  </span>
                </div>
                <div className="mt-1 h-2.5 rounded-full bg-[color:var(--surface-2)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${io.total ? (r.v / io.total) * 100 : 0}%`, background: r.c }} />
                </div>
              </div>
            ))}
            <p className="mt-4 text-[13px] text-[color:var(--ink-2)]">
              Đầu ra cuối cùng: <b className="num">{io.s.clusters.length}</b> cụm vấn đề — từ{" "}
              <b className="num">{fmt(io.s.real_turns)}</b> lượt hỏi của{" "}
              <b className="num">{io.s.students}</b> học viên.
            </p>
            <TableView
              cols={[{ t: "Giai đoạn" }, { t: "Lượt", n: 1 }, { t: "% tổng log", n: 1 }]}
              rows={[
                ["Tổng lượt trong log", fmt(io.total), "100%"],
                ["Câu bấm nút có sẵn (loại)", fmt(io.preset), Math.round((io.preset / io.total) * 100) + "%"],
                ["Lượt hỏi thực", fmt(io.s.real_turns), Math.round((io.s.real_turns / io.total) * 100) + "%"],
                ["Vào được cụm", fmt(io.inClusters), Math.round((io.inClusters / io.total) * 100) + "%"],
                ["Rải rác", fmt(io.scat), Math.round((io.scat / io.total) * 100) + "%"],
                ["Số cụm tìm được", fmt(io.s.clusters.length), "—"],
              ]}
            />
          </>
        ) : (
          <p className="mt-2 text-[13.5px] text-[color:var(--ink-2)]">
            {lecture === "all"
              ? "Chọn một buổi cụ thể ở bộ lọc trên để xem. Việc gom cụm chạy trên trọn một buổi, nên không có khái niệm “cụm theo ngày” — dựng một phép chia theo ngày ở đây sẽ là con số bịa."
              : "Buổi này quá ít câu nên hệ thống không gom cụm — không có đầu ra để đối chiếu."}
          </p>
        )}
      </Card>
    </section>
  );
}
