import { useMemo, useState } from "react";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Slider from "@mui/material/Slider";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";

import { D, TH, fmt, dmy, sessionsByDate } from "../lib/data";
import { Kicker, Card, Kpi, KpiGrid, Chip, Banner } from "../ui/Bits";
import { TableView, GroupedBars } from "../ui/Charts";
import LineChart from "../ui/LineChart";
import { HeroDots } from "../ui/BgFx";

/* ══════════ TRANG 1 · ĐẦU VÀO ══════════
   Trang này trả lời: "hệ thống nhận được cái gì". Thứ tự đọc cố định —
   lọc → số tổng → biểu đồ theo thời gian → bảng đầy đủ → cụm → chọn cụm.

   Gom cụm nằm ở ĐÂY chứ không ở trang Xử lý, vì mức độ quan trọng của một cụm
   đọc thẳng ra từ số câu hỏi và số học viên của chính đầu vào — đặt nó cạnh dữ
   liệu thô thì người đọc đối chiếu được ngay.                                */

/* Một hàng = một NGÀY của một BUỔI. Hai trục khác nhau nên không gộp: học viên
   vẫn hỏi về buổi cũ nhiều ngày sau khi buổi đó đã dạy, nên "ngày 13/09" có thể
   chứa câu hỏi của ba buổi khác nhau. */
function buildRows(sessions) {
  const out = [];
  sessions.forEach((s) => {
    (s.per_day || []).forEach((d) => {
      out.push({
        day: d.day,
        lecture: s.lecture || s.key,
        title: s.lecture_title || "",
        turns: d.turns,
        students: d.students,
        preset: d.preset,
      });
    });
  });
  return out.sort((a, b) => (a.day === b.day ? a.lecture.localeCompare(b.lecture) : a.day.localeCompare(b.day)));
}

/* Mức độ quan trọng KHÔNG phải điểm số tự nghĩ ra. Nó là đúng ba cờ mà phần gom
   cụm đã tính bằng ngưỡng trong config.py, viết lại thành chữ:
     · cụm yếu   — ít người quá, dễ là trùng hợp
     · tín hiệu lệch — nhiều lượt nhưng dồn vào một người
     · còn lại   — xếp theo SỐ NGƯỜI, không theo số lượt
   Sắp theo số người vì một vấn đề 30 người hỏi 1 lần quan trọng hơn một vấn đề
   1 người hỏi 30 lần. */
function rank(c) {
  if (c.weak) return 2;
  if (c.skew) return 1;
  return 0;
}

export default function InputPage({ sess, setSess, sel, setSel, goTab }) {
  const all = D.sessions || [];
  const s = all[sess] || null;
  const sKey = s ? s.key : "_";

  const [lecture, setLecture] = useState("all");
  const rowsAll = useMemo(() => buildRows(all), [all]);
  const days = useMemo(
    () => Array.from(new Set(rowsAll.map((r) => r.day))).sort(),
    [rowsAll]
  );
  const [from, setFrom] = useState("");   // "" = từ ngày đầu tiên
  const [to, setTo] = useState("");       // "" = tới ngày cuối cùng

  const lo = from || days[0] || "";
  const hi = to || days[days.length - 1] || "";

  const rows = useMemo(
    () => rowsAll.filter(
      (r) => (lecture === "all" || r.lecture === lecture) && r.day >= lo && r.day <= hi
    ),
    [rowsAll, lecture, lo, hi]
  );

  /* Biểu đồ đường đọc theo NGÀY, nên phải cộng các buổi trong cùng một ngày lại.
     Số học viên cộng theo buổi: một người hỏi ở hai buổi thì tính hai — không có
     cách nào biết đó là cùng một người từ dữ liệu đã tổng hợp, nên nói thẳng ở
     chú thích thay vì im lặng đưa ra một con số không kiểm được. */
  const byDay = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      const b = m.get(r.day) || { x: r.day, turns: 0, students: 0, preset: 0, n: 0 };
      b.turns += r.turns; b.students += r.students; b.preset += r.preset; b.n += 1;
      m.set(r.day, b);
    });
    return Array.from(m.values())
      .sort((a, b) => a.x.localeCompare(b.x))
      .map((b) => ({ ...b, note: b.n > 1 ? `${b.n} buổi cùng có câu hỏi trong ngày này` : "" }));
  }, [rows]);

  const tot = rows.reduce(
    (a, r) => ({ turns: a.turns + r.turns, students: a.students + r.students, preset: a.preset + r.preset }),
    { turns: 0, students: 0, preset: 0 }
  );

  /* ── Cụm của buổi đang chọn, xếp theo mức độ quan trọng ── */
  const cls = useMemo(() => {
    if (!s || !s.clusters) return [];
    return s.clusters
      .map((c, i) => ({ ...c, _i: i }))
      .sort((a, b) => rank(a) - rank(b) || b.people - a.people || b.turns - a.turns);
  }, [s]);

  /* Thanh kéo: "trả lời N cụm quan trọng nhất". Kéo tới đâu thì N cụm đầu danh
     sách được tick tới đó — nhưng người dùng vẫn bỏ tick tay được từng cụm, nên
     thanh kéo là LỐI TẮT chứ không phải cái khoá. */
  const [topN, setTopN] = useState(0);
  const applyTop = (n) => {
    setTopN(n);
    const next = {};
    cls.slice(0, n).forEach((c) => { next[sKey + "#" + c._i] = 1; });
    setSel((old) => {
      const keep = {};
      Object.keys(old).forEach((k) => { if (k.indexOf(sKey + "#") !== 0) keep[k] = old[k]; });
      return { ...keep, ...next };
    });
  };
  const toggle = (c) => {
    const id = sKey + "#" + c._i;
    setSel((old) => {
      const n = { ...old };
      if (n[id]) delete n[id]; else n[id] = 1;
      return n;
    });
    setTopN(-1);      // đã sửa tay thì thanh kéo không còn mô tả đúng lựa chọn
  };
  const picked = cls.filter((c) => sel[sKey + "#" + c._i]);
  const pTurns = picked.reduce((a, c) => a + c.turns, 0);
  const pPeople = picked.reduce((a, c) => Math.max(a, c.people), 0);

  const filtered = lecture !== "all" || !!from || !!to;
  const reset = () => { setLecture("all"); setFrom(""); setTo(""); };

  return (
    <>
      {/* ══════════ HERO ══════════ */}
      <div className="sky relative">
        <HeroDots />
        <div className="relative mx-auto max-w-[1080px] px-5 sm:px-8 pt-14 sm:pt-20 pb-8">
          <div className="reveal max-w-[820px]">
            <Kicker>Bước 1 / 3 · Đầu vào</Kicker>
            <h1 className="text-[clamp(32px,6vw,60px)] font-semibold tracking-tight leading-[1.04]">
              Hàng trăm câu hỏi.
              <br />
              <span className="text-[color:var(--ink-2)]">Vài vấn đề.</span>
            </h1>
            <p className="mt-5 max-w-[62ch] text-[clamp(15px,1.4vw,17px)] leading-relaxed text-[color:var(--ink-2)]">
              Đây là thứ hệ thống nhận được: log hỏi đáp của lớp, lọc theo buổi và theo khoảng ngày.
              Cuối trang là các cụm vấn đề tìm được và chỗ chọn cụm để soạn nội dung ôn.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1080px] px-5 sm:px-8 pb-16">
        {/* ══════════ BỘ LỌC ══════════ */}
        <section className="reveal mt-8">
          <div className="flex flex-wrap items-center gap-3">
            <FormControl size="small" className="min-w-[240px]">
              <InputLabel id="i-lec">Buổi học</InputLabel>
              <Select labelId="i-lec" label="Buổi học" value={lecture}
                onChange={(e) => {
                  const v = e.target.value;
                  setLecture(v);
                  if (v !== "all") {
                    const i = all.findIndex((x) => (x.lecture || x.key) === v);
                    if (i >= 0) setSess(i);
                  }
                }}>
                <MenuItem value="all">Tất cả các buổi</MenuItem>
                {sessionsByDate().map((x) => (
                  <MenuItem key={x.key} value={x.lecture || x.key}>
                    {(x.lecture_title ? x.lecture_title + " · " : "") + (x.lecture || x.key)}
                    {x.first_day ? " · " + dmy(x.first_day) : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Khoảng ngày bằng hai ô chọn chứ không phải lịch: dữ liệu chỉ có
                đúng những ngày này, lịch sẽ mời người dùng chọn ngày rỗng. */}
            <FormControl size="small" className="min-w-[150px]">
              <InputLabel id="i-from">Từ ngày</InputLabel>
              <Select labelId="i-from" label="Từ ngày" value={from}
                onChange={(e) => {
                  const v = e.target.value; setFrom(v);
                  if (v && to && v > to) setTo(v);      // giữ khoảng luôn hợp lệ
                }}>
                <MenuItem value="">Ngày đầu tiên</MenuItem>
                {days.map((d) => <MenuItem key={d} value={d}>{dmy(d)}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" className="min-w-[150px]">
              <InputLabel id="i-to">Đến ngày</InputLabel>
              <Select labelId="i-to" label="Đến ngày" value={to}
                onChange={(e) => {
                  const v = e.target.value; setTo(v);
                  if (v && from && v < from) setFrom(v);
                }}>
                <MenuItem value="">Ngày cuối cùng</MenuItem>
                {days.map((d) => <MenuItem key={d} value={d}>{dmy(d)}</MenuItem>)}
              </Select>
            </FormControl>

            {filtered && (
              <button type="button" onClick={reset}
                className="rounded-full border border-[color:var(--line)] px-3.5 py-1.5 text-[13px] text-[color:var(--ink-2)] hover:bg-[color:var(--surface-2)]">
                Bỏ lọc
              </button>
            )}
          </div>

          <p className="mt-3 text-[13px] text-[color:var(--ink-2)]">
            {lo && hi
              ? <>Đang xem <b>{dmy(lo)}</b>{lo !== hi && <> → <b>{dmy(hi)}</b></>} ·{" "}
                  <b className="num">{byDay.length}</b> ngày · <b className="num">{fmt(tot.turns)}</b> lượt hỏi thực</>
              : "Không có ngày nào trong dữ liệu."}
          </p>
        </section>

        {rows.length === 0 ? (
          <Card className="reveal mt-5 p-6 text-[13.5px] text-[color:var(--ink-2)]">
            Khoảng ngày này không có lượt hỏi nào. Bấm “Bỏ lọc”.
          </Card>
        ) : (
          <>
            {/* ══════════ SỐ TỔNG ══════════ */}
            <section className="reveal mt-5">
              <KpiGrid>
                <Kpi label="Lượt hỏi thực" value={fmt(tot.turns)} unit="lượt"
                     note="đầu vào của phần gom cụm" />
                <Kpi label="Lượt theo học viên" value={fmt(tot.students)} unit="người-buổi"
                     note="cộng theo buổi, không khử trùng người" />
                <Kpi label="Câu bấm nút có sẵn" value={fmt(tot.preset)} unit="lượt"
                     note="loại trước khi đếm bất cứ thứ gì" />
                <Kpi label="Số ngày" value={fmt(byDay.length)} unit="ngày" />
              </KpiGrid>
            </section>

            {/* ══════════ BIỂU ĐỒ ĐƯỜNG ══════════ */}
            <section className="reveal mt-2">
              <Card className="p-5">
                <h2 className="text-[17px] font-semibold tracking-tight">Câu hỏi tới vào những ngày nào</h2>
                <p className="mt-1 mb-3 text-[13px] text-[color:var(--ink-2)]">
                  Rê chuột vào biểu đồ để đọc số của đúng ngày đó. Câu bấm nút có sẵn vẽ chung được vì
                  cùng đơn vị, và <strong>phải</strong> vẽ — nó là phần hệ thống bỏ đi, không phải phần
                  người đọc được thấy sau khi đã lọc.
                </p>
                {byDay.length === 1 ? (
                  <p className="text-[13px] text-[color:var(--ink-2)]">
                    Khoảng lọc còn đúng một ngày nên không có xu hướng để vẽ — số đã nằm ở bốn ô trên.
                  </p>
                ) : (
                  <LineChart
                    rows={byDay}
                    series={[
                      { k: "turns", label: "Lượt hỏi thực" },
                      { k: "students", label: "Lượt theo học viên" },
                      { k: "preset", label: "Câu bấm nút có sẵn (đã loại)" },
                    ]}
                    alt="Số lượt hỏi thực, lượt theo học viên và câu bấm nút có sẵn theo từng ngày"
                    yLabel="lượt"
                    tableCols={[{ t: "Ngày" }, { t: "Lượt thực", n: 1 }, { t: "Lượt theo HV", n: 1 }, { t: "Câu mẫu đã loại", n: 1 }]}
                  />
                )}
              </Card>
            </section>

            {/* ══════════ BẢNG DỮ LIỆU ══════════ */}
            <section className="reveal mt-4">
              <Card className="p-5">
                <h2 className="text-[17px] font-semibold tracking-tight">Bảng dữ liệu</h2>
                <p className="mt-1 mb-3 text-[13px] text-[color:var(--ink-2)]">
                  Một hàng là <strong>một ngày của một buổi</strong>. Cùng một ngày có thể xuất hiện
                  nhiều lần vì học viên vẫn hỏi về buổi cũ sau khi buổi mới đã dạy — gộp lại là mất
                  đúng thông tin đó. Số khớp với <code>codebase/ui/data.js</code>, đếm tay kiểm lại được.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] border-collapse">
                    <thead>
                      <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--line)]">
                        <th className="py-2 pr-3 font-semibold">Ngày</th>
                        <th className="py-2 pr-3 font-semibold">Buổi</th>
                        <th className="py-2 pr-3 font-semibold">Tên buổi</th>
                        <th className="py-2 pr-3 font-semibold text-right">Lượt thực</th>
                        <th className="py-2 pr-3 font-semibold text-right">Học viên</th>
                        <th className="py-2 pr-3 font-semibold text-right">Câu mẫu đã loại</th>
                        <th className="py-2 font-semibold text-right">TB lượt/HV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-b border-[color:var(--line-2)]">
                          <td className="py-1.5 pr-3 num whitespace-nowrap">{dmy(r.day)}</td>
                          <td className="py-1.5 pr-3 whitespace-nowrap">{r.lecture}</td>
                          <td className="py-1.5 pr-3 text-[color:var(--ink-2)]">{r.title}</td>
                          <td className="py-1.5 pr-3 num text-right">{fmt(r.turns)}</td>
                          <td className="py-1.5 pr-3 num text-right">{fmt(r.students)}</td>
                          <td className="py-1.5 pr-3 num text-right text-[color:var(--muted)]">{fmt(r.preset)}</td>
                          <td className="py-1.5 num text-right">
                            {r.students ? Math.round((r.turns / r.students) * 10) / 10 : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-semibold">
                        <td className="py-2 pr-3" colSpan={3}>Tổng · {rows.length} hàng</td>
                        <td className="py-2 pr-3 num text-right">{fmt(tot.turns)}</td>
                        <td className="py-2 pr-3 num text-right">{fmt(tot.students)}</td>
                        <td className="py-2 pr-3 num text-right">{fmt(tot.preset)}</td>
                        <td className="py-2 num text-right">
                          {tot.students ? Math.round((tot.turns / tot.students) * 10) / 10 : "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            </section>
          </>
        )}

        {/* ══════════ GOM CỤM ══════════ */}
        <section className="reveal mt-10">
          <Kicker>Gom cụm</Kicker>
          <h2 className="text-[clamp(20px,2.6vw,28px)] font-semibold tracking-tight">
            Mức độ quan trọng của từng cụm
          </h2>
          <p className="mt-2 max-w-[68ch] text-[14px] leading-relaxed text-[color:var(--ink-2)]">
            Xếp theo <strong>số học viên khác nhau</strong>, không theo số lượt: một vấn đề 30 người
            hỏi một lần quan trọng hơn một vấn đề một người hỏi 30 lần. Đây không phải điểm số tự
            nghĩ ra — nó là đúng các cờ mà phần gom cụm đã tính bằng ngưỡng trong{" "}
            <code>config.py</code>.
          </p>

          {!s || !cls.length ? (
            <Card className="mt-4 p-6 text-[13.5px] text-[color:var(--ink-2)]">
              Buổi đang chọn không có cụm nào — hoặc quá ít câu để gom. Chọn buổi khác ở bộ lọc trên.
            </Card>
          ) : (
            <>
              <Card className="mt-4 p-5">
                <div className="flex gap-4 flex-wrap items-center text-[12.5px] text-[color:var(--ink-2)] mb-2">
                  <span className="inline-flex items-center gap-1.5">
                    <i className="inline-block w-3 h-[10px] rounded-sm" style={{ background: "var(--s1)" }} />
                    Số lượt hỏi
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <i className="inline-block w-3 h-[10px] rounded-sm" style={{ background: "var(--s2)" }} />
                    Số học viên khác nhau
                  </span>
                </div>
                <GroupedBars
                  rows={cls.slice(0, 10).map((c) => ({ label: c.name, a: c.turns, b: c.people }))}
                  alt="Số lượt hỏi và số học viên của mười cụm quan trọng nhất"
                />
                <TableView
                  cols={[{ t: "Cụm" }, { t: "Lượt", n: 1 }, { t: "Học viên", n: 1 }, { t: "Ghi chú" }]}
                  rows={cls.map((c) => [
                    c.name, fmt(c.turns), fmt(c.people),
                    c.weak ? "cụm yếu — ít người" : c.skew ? "tín hiệu lệch — dồn vào ít người" : "—",
                  ])}
                />
              </Card>

              {/* ══════════ CHỌN CỤM ══════════ */}
              <Card className="mt-4 p-5">
                <h3 className="text-[16px] font-semibold tracking-tight">Chọn cụm để soạn nội dung ôn</h3>
                <p className="mt-1 text-[13px] text-[color:var(--ink-2)]">
                  Kéo thanh để lấy <strong>N cụm quan trọng nhất</strong>, hoặc bỏ tick tay từng cụm.
                  Thanh kéo là lối tắt, không phải cái khoá.
                </p>

                <div className="mt-4 flex items-center gap-5">
                  <Slider
                    value={topN < 0 ? picked.length : topN}
                    onChange={(_, v) => applyTop(v)}
                    min={0} max={cls.length} step={1}
                    marks valueLabelDisplay="auto"
                    className="max-w-[420px]"
                  />
                  <span className="text-[13px] text-[color:var(--ink-2)] whitespace-nowrap">
                    <b className="num">{picked.length}</b> / {cls.length} cụm ·{" "}
                    <b className="num">{fmt(pTurns)}</b> lượt hỏi
                    {pPeople > 0 && <> · cụm đông nhất chạm <b className="num">{pPeople}</b> học viên</>}
                  </span>
                </div>

                <ul className="mt-4 divide-y divide-[color:var(--line-2)]">
                  {cls.map((c) => {
                    const id = sKey + "#" + c._i;
                    return (
                      <li key={id} className="flex items-center gap-3 py-1.5">
                        <Checkbox size="small" checked={!!sel[id]} onChange={() => toggle(c)}
                          inputProps={{ "aria-label": "Chọn cụm " + c.name }} />
                        <span className="flex-1 min-w-0 text-[13.5px] truncate">{c.name}</span>
                        {c.weak && <Chip tone="warn">cụm yếu</Chip>}
                        {c.skew && <Chip tone="warn">tín hiệu lệch</Chip>}
                        <span className="num text-[12.5px] text-[color:var(--ink-2)] whitespace-nowrap">
                          {fmt(c.turns)} lượt · {fmt(c.people)} người
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {picked.some((c) => c.weak || c.skew) && (
                  <Banner kind="warn" tag="Đọc kỹ">
                    Trong số đã chọn có cụm bị đánh cờ <strong>yếu</strong> hoặc <strong>tín hiệu lệch</strong>.
                    Ngưỡng đang chạy: cụm yếu ≤ {TH.weak_max_people ?? 2} người · lệch khi một người chiếm ≥{" "}
                    {Math.round((TH.skew_ratio ?? 0.5) * 100)}% số lượt. Soạn nội dung ôn cho những cụm
                    đó là dạy lại cả lớp vì một hai người hỏi nhiều.
                  </Banner>
                )}

                <div className="mt-5">
                  <Button variant="contained" disabled={!picked.length}
                    onClick={() => goTab("ra")}
                    endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
                    className="!rounded-full !bg-black hover:!bg-neutral-800 !text-white !px-6 !py-2.5 !text-[14.5px] disabled:!bg-[color:var(--surface-2)] disabled:!text-[color:var(--muted)]">
                    {picked.length ? `Sang Đầu ra với ${picked.length} cụm` : "Chọn ít nhất một cụm"}
                  </Button>
                </div>
              </Card>
            </>
          )}
        </section>
      </div>
    </>
  );
}
