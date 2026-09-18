import { useMemo, useRef, useState } from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";

import { D, TH, fmt, dmy } from "../lib/data";
import { StackedBar, TableView } from "../ui/Charts";
import { useReveal, Card, SectionTitle, Kpi, KpiGrid, Banner, Chip } from "../ui/Bits";

/* call_id có dạng "run:K4P1/D04:p1/6", "eval3:C1-01", "live:answer"…
   Nhóm theo tiền tố để người đọc lọc được đúng loại bằng chứng họ đang nghi.

   Trước đây bảng này lấy thẳng calls.slice(-40): trên dữ liệu thật ra 29 lời
   gọi "live" (bấm demo) + 11 "eval", và KHÔNG lời gọi gom cụm nào — tức bảng
   mang nhãn "bằng chứng CP3" lại không chứa bằng chứng cho quyết định AI
   chính. Giờ lọc theo mục đích, mặc định mở đúng loại đó. */
const CALLKIND = [
  { k: "run",  nm: "Gom cụm buổi học", re: /^run\b/,  c: "var(--s1)",
    hint: "Quyết định AI chính — chạy khi dựng dữ liệu một buổi" },
  { k: "eval", nm: "Chạy bộ kiểm thử", re: /^eval/,   c: "var(--s2)",
    hint: "Mỗi case một lời gọi, số đo ở tab Chất lượng ra từ đây" },
  { k: "live", nm: "Thử trực tiếp",    re: /^live/,   c: "var(--s3)",
    hint: "Bấm nút trên tab Thử trực tiếp, kể cả soạn nội dung ôn và hỏi đáp" },
];
const OTHER = { k: "khac", nm: "Khác", c: "var(--muted)",
  hint: "Lời gọi không rơi vào nhóm nào ở trên" };

function callKind(c) {
  const id = String((c && c.call_id) || "");
  for (const x of CALLKIND) if (x.re.test(id)) return x.k;
  return "khac";
}
const kindMeta = (k) => CALLKIND.filter((x) => x.k === k)[0] || OTHER;

/* Hàng "nhãn — giá trị" dùng chung cho hai bảng thông số. Dùng Table của MUI
   để không phải dựng lại phần viền, hover và nền đầu bảng. */
const cellL = "!border-[color:var(--line-2)] !text-[13.5px] !py-2.5 !px-3 align-top";

function Row({ label, children, note }) {
  return (
    <TableRow>
      <TableCell component="th" scope="row"
        className={cellL + " !font-semibold !text-[color:var(--ink-2)] w-[46%]"}>
        {label}
      </TableCell>
      <TableCell className={cellL + " !text-[color:var(--ink)]"}>
        {children}
        {note && <span className="block mt-0.5 text-[12px] text-[color:var(--muted)]">{note}</span>}
      </TableCell>
    </TableRow>
  );
}

/* Danh sách mã lượt (mã model bịa ra, câu bị xếp hai nơi…). Đây là bằng chứng
   bất lợi nên nó nằm ở tầng LUÔN HIỆN, chỉ cắt bớt phần đuôi khi quá dài. */
function Ids({ list }) {
  const a = list || [];
  if (!a.length) return null;
  const head = a.slice(0, 8);
  return (
    <span className="block mt-1 text-[12px] text-[color:var(--muted)] break-all">
      {head.map((x) => String(x)).join(" · ")}
      {a.length > head.length ? " … +" + (a.length - head.length) : ""}
    </span>
  );
}

export default function AiLog({ sess, setSess }) {
  const root = useRef(null);
  useReveal(root);

  const calls = D.calls || [];
  const sessions = D.sessions || [];
  const s = sessions[sess] || null;

  const ok = useMemo(() => calls.filter((c) => c.ok), [calls]);
  const ti = useMemo(() => ok.reduce((a, c) => a + (c.tokens_in || 0), 0), [ok]);
  const to = useMemo(() => ok.reduce((a, c) => a + (c.tokens_out || 0), 0), [ok]);
  const fb = useMemo(() => calls.filter((c) => c.fell_back).length, [calls]);

  const kindCounts = useMemo(() => {
    const m = {};
    calls.forEach((c) => { const k = callKind(c); m[k] = (m[k] || 0) + 1; });
    return m;
  }, [calls]);

  const kinds = useMemo(
    () => CALLKIND.concat([OTHER]).filter((x) => kindCounts[x.k]),
    [kindCounts]
  );

  /* Mặc định mở nhóm "run" — nhóm chứa bằng chứng cho quyết định AI chính. */
  const [lk, setLk] = useState(() =>
    kindCounts.run ? "run" : kindCounts.eval ? "eval" : kindCounts.live ? "live" : "khac"
  );
  const active = kindCounts[lk] ? lk : (kinds[0] ? kinds[0].k : "run");
  const meta = kindMeta(active);

  /* Giữ chỉ số gốc để key của hàng là duy nhất — call_id lặp lại giữa các lần thử. */
  const shown = useMemo(
    () => calls.map((c, i) => ({ c, i })).filter((x) => callKind(x.c) === active),
    [calls, active]
  );
  const last40 = shown.slice(-40).slice().reverse();

  const parts = kinds.map((x) => ({ label: x.nm, v: kindCounts[x.k], c: x.c }));

  const a = s && s.ai_call ? s.ai_call : null;
  const r = (s && s.repairs) || {};
  const nCluster = s && s.clusters ? s.clusters.length : 0;

  return (
    <div ref={root} className="mx-auto w-full max-w-[1120px] px-5 sm:px-8 py-10 sm:py-14">
      <SectionTitle
        kicker="CP3 · Nhật ký AI"
        title="Mọi lời gọi model đều để lại dấu vết"
        sub="Không số nào trên trang này được gán cứng: mỗi lần gọi Gemini ghi thành một dòng, kể cả những lần hỏng."
      />

      <div className="reveal">
        <Banner kind="info" tag="CP3">
          Bằng chứng AI chạy thật, không gán cứng: mọi lời gọi model ghi vào{" "}
          <code className="px-1 py-0.5 rounded bg-[color:var(--surface-2)] text-[12.5px]">logs/gemini-calls.jsonl</code>{" "}
          kèm prompt đầy đủ và phản hồi thô. Trang này chỉ hiện <strong>metadata</strong> — prompt chứa
          nguyên văn câu hỏi học viên nên không đưa lên giao diện.
        </Banner>
      </div>

      <div className="reveal">
        <KpiGrid>
          <Kpi label="Lời gọi đã ghi" value={fmt(calls.length)} note="toàn bộ lịch sử" />
          <Kpi label="Thành công" value={fmt(ok.length)} unit={"/ " + fmt(calls.length)}
               note={(calls.length - ok.length) + " lần lỗi đã tự thử lại"} />
          <Kpi label="Token vào" value={fmt(ti)} />
          <Kpi label="Token ra" value={fmt(to)} />
          <Kpi label="Rơi model dự phòng" value={String(fb)}
               note={fb ? "model chính trả 503" : "không lần nào"} />
        </KpiGrid>
      </div>

      {/* ── Lần chạy của buổi đang chọn ── */}
      <Card className="p-5 sm:p-6 mb-5 reveal">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-[17px] font-semibold tracking-tight">
            Lần chạy của buổi đang chọn{s ? " — " + s.lecture : ""}
          </h3>
          {sessions.length > 1 && (
            <FormControl size="small" className="min-w-[210px]">
              <InputLabel id="log-sess">Buổi học</InputLabel>
              <Select labelId="log-sess" label="Buổi học" value={String(sess)}
                      onChange={(e) => setSess(Number(e.target.value))}
                      className="!rounded-full">
                {sessions.map((x, i) => (
                  <MenuItem key={x.key || i} value={String(i)}>
                    {x.lecture}{x.lecture_title ? " · " + x.lecture_title : ""}
                    {x.first_day ? " · " + dmy(x.first_day) : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </div>

        {a && a.called ? (
          <>
            <Table size="small">
              <TableBody>
                <Row label="Model">
                  {(a.models_used || [a.model]).filter(Boolean).join(", ")}
                  {a.fell_back ? <em className="text-[color:var(--warn-ink)]"> (có rơi sang dự phòng)</em> : null}
                </Row>
                <Row label="Số lời gọi">
                  <span className="num">{a.n_calls}</span>{" "}
                  ({a.n_chunks} phần × {TH.chunk_size || "?"} lượt
                  {a.n_chunks > 1 ? " + 1 lời gọi gộp cụm" : ""})
                </Row>
                {a.attempts != null ? (
                  <Row label="Lần gọi API thực tế"
                       note={a.attempts > a.n_calls
                         ? (a.attempts - a.n_calls) + " lần phải thử lại vì model trả lỗi"
                         : "không lần nào phải thử lại"}>
                    <span className="num">{a.attempts}</span>
                  </Row>
                ) : null}
                <Row label="Tổng độ trễ"><span className="num">{fmt(a.latency_ms)}</span> ms</Row>
                <Row label="Token">
                  <span className="num">{fmt(a.tokens_in)}</span> vào ·{" "}
                  <span className="num">{fmt(a.tokens_out)}</span> ra
                </Row>
                <Row label="Mã model bịa ra">
                  <span className="num">{(r.invented_ids || []).length}</span>
                  <Ids list={r.invented_ids} />
                </Row>
                <Row label="Câu bị xếp hai nơi">
                  <span className="num">{(r.duplicates || []).length}</span>
                  <Ids list={r.duplicates} />
                </Row>
                <Row label="Câu model bỏ quên">
                  <span className="num">{(r.unplaced_added_to_scatter || []).length}</span>{" "}
                  <em className="text-[color:var(--ink-2)]">(đã đưa về nhóm rải rác)</em>
                  <Ids list={r.unplaced_added_to_scatter} />
                </Row>
                {r.protos_before_merge ? (
                  <Row label="Cụm con trước khi gộp">
                    <span className="num">{r.protos_before_merge}</span> → <span className="num">{nCluster}</span> cụm
                  </Row>
                ) : null}
              </TableBody>
            </Table>
            <p className="mt-3 text-[12.5px] leading-relaxed text-[color:var(--ink-2)]">
              Ba dòng giữa — mã model bịa ra, câu bị xếp hai nơi, câu model bỏ quên — là chỗ model làm
              sai và code phải sửa lại. Chúng để nguyên ở đây, không gập.
            </p>
          </>
        ) : (
          <p className="text-[13.5px] leading-relaxed text-[color:var(--ink-2)]">
            Buổi này không gọi model{a && a.reason ? " — " + a.reason : ""}.
            {s && s.sparse_reason ? " " + s.sparse_reason : ""}
          </p>
        )}
      </Card>

      {/* ── Ngưỡng hệ thống ── */}
      <Card className="p-5 sm:p-6 mb-5 reveal">
        <h3 className="text-[17px] font-semibold tracking-tight">Ngưỡng của hệ thống</h3>
        <p className="mt-1 mb-3 text-[12.5px] text-[color:var(--ink-2)]">
          Deterministic, nằm trong{" "}
          <code className="px-1 py-0.5 rounded bg-[color:var(--surface-2)]">codebase/class_pulse/config.py</code>{" "}
          — không do model quyết.
        </p>
        <Table size="small">
          <TableBody>
            <Row label="Dưới bao nhiêu lượt thì không gom cụm">{TH.sparse_min_turns || "?"} lượt thực</Row>
            <Row label="Mỗi lời gọi tối đa">{TH.chunk_size || "?"} lượt</Row>
            <Row label="Cụm yếu khi">≤ {TH.weak_max_people || "?"} người</Row>
            <Row label="Tín hiệu lệch khi">
              một người chiếm ≥ {Math.round((TH.skew_ratio || 0) * 100)}% lượt và cụm ≥ {TH.skew_min_turns || "?"} lượt
            </Row>
            <Row label="Giấu câu nguyên văn khi">
              chu kỳ có dưới {TH.min_students_for_examples || "?"} học viên
            </Row>
          </TableBody>
        </Table>
      </Card>

      {/* ── Từng lời gọi model ── */}
      <Card className="p-5 sm:p-6 reveal">
        <h3 className="text-[17px] font-semibold tracking-tight">Từng lời gọi model</h3>

        {parts.length > 1 && (
          <div className="mt-4">
            <StackedBar parts={parts} />
            <TableView
              cols={[{ t: "Mục đích" }, { t: "Lời gọi", n: true }, { t: "Thành công", n: true }, { t: "Lỗi", n: true }]}
              rows={kinds.map((x) => {
                const all = calls.filter((c) => callKind(c) === x.k);
                const g = all.filter((c) => c.ok).length;
                return [x.nm, fmt(all.length), fmt(g), fmt(all.length - g)];
              })}
            />
          </div>
        )}

        <div className="mt-5">
          <ToggleButtonGroup exclusive size="small" value={active}
            onChange={(_e, v) => { if (v) setLk(v); }}
            aria-label="Lọc lời gọi theo mục đích"
            className="flex-wrap !gap-2">
            {/* ToggleButton phải là con TRỰC TIẾP của group — group đọc prop
                `value` của con để biết nút nào đang bật. Tooltip nằm bên trong. */}
            {kinds.map((x) => (
              <ToggleButton key={x.k} value={x.k}
                className="!rounded-full !border !border-[color:var(--line)] !px-3.5 !py-1.5 !text-[13px] !normal-case">
                <Tooltip title={x.hint}>
                  <span className="inline-flex items-center gap-2">
                    <i className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: x.c }} />
                    {x.nm}
                    <b className="num text-[color:var(--ink-2)]">{kindCounts[x.k]}</b>
                  </span>
                </Tooltip>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>

        <p className="mt-3 text-[12.5px] leading-relaxed text-[color:var(--ink-2)]">
          {meta.hint}. Hiện {Math.min(shown.length, 40)}/{shown.length} lời gọi gần nhất của nhóm này.
        </p>

        <div className="mt-3 overflow-x-auto">
          <Table size="small">
            <TableHead>
              <TableRow className="bg-[color:var(--surface-2)]">
                <TableCell className={cellL + " !font-semibold"}>Nhãn</TableCell>
                <TableCell className={cellL + " !font-semibold"}>Model</TableCell>
                <TableCell align="right" className={cellL + " !font-semibold"}>Lần thử</TableCell>
                <TableCell align="right" className={cellL + " !font-semibold"}>ms</TableCell>
                <TableCell align="right" className={cellL + " !font-semibold"}>Token vào</TableCell>
                <TableCell align="right" className={cellL + " !font-semibold"}>Token ra</TableCell>
                <TableCell className={cellL + " !font-semibold"}>Kết quả</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {last40.map(({ c, i }) => (
                <TableRow key={i} hover>
                  <TableCell className={cellL}>
                    <code className="text-[12px] break-all">{c.call_id}</code>
                  </TableCell>
                  <TableCell className={cellL}>
                    <span className="inline-flex items-center gap-1.5 flex-wrap">
                      {c.model}
                      {c.fell_back ? <Chip tone="warn">dự phòng</Chip> : null}
                    </span>
                  </TableCell>
                  <TableCell align="right" className={cellL + " num"}>{c.attempt || ""}</TableCell>
                  <TableCell align="right" className={cellL + " num"}>{fmt(c.latency_ms)}</TableCell>
                  <TableCell align="right" className={cellL + " num"}>{fmt(c.tokens_in)}</TableCell>
                  <TableCell align="right" className={cellL + " num"}>{fmt(c.tokens_out)}</TableCell>
                  <TableCell className={cellL}>
                    {c.ok ? (
                      <Chip tone="ok">OK</Chip>
                    ) : (
                      <Tooltip title={String(c.error || "") || "Không có nội dung lỗi"}>
                        <span><Chip tone="no">{String(c.status || "lỗi")}</Chip></span>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!last40.length && (
                <TableRow>
                  <TableCell colSpan={7} className={cellL + " !text-[color:var(--muted)]"}>
                    Nhóm này chưa có lời gọi nào.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
