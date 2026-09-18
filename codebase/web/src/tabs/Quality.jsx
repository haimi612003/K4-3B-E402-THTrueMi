import { useMemo, useRef, useState } from "react";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Button from "@mui/material/Button";

import { D, fmt } from "../lib/data";
import { GroupedBars, TableView, Legend } from "../ui/Charts";
import { useReveal, Kicker, Card, Kpi, KpiGrid, Banner, Chip, Disclosure } from "../ui/Bits";

/* ══════════ CHẤT LƯỢNG ══════════ */

const CLSNAME = {
  lop1: "① Nguồn sự thật",
  lop2: "② Mơ hồ / thiếu thông tin",
  lop3: "③ Ngoài phạm vi",
  lop4: "④ Đặc thù domain",
  thuong: "Thường gặp",
  hiem: "Hiếm",
};

/* Dữ liệu đã chứa sẵn "slug — giải thích tiếng Việt"; code cũ cắt bằng
   split("—")[0] và giữ đúng nửa không ai đọc được. Giờ lấy nửa tiếng Việt làm
   nhãn, slug làm phụ chú cho người đi kiểm chứng. */
const errVi = (name) => {
  const p = String(name || "").split("—");
  return (p.length > 1 ? p.slice(1).join("—") : p[0]).trim();
};
const errSlug = (name) => String(name || "").split("—")[0].trim();

/* Khoá assertion là tiếng Anh vì nó là tên trong mã nguồn — giữ nguyên cho
   người đi kiểm, nhưng kèm nghĩa. Và bỏ trùng: một case trượt cùng một
   assertion bảy lần thì in bảy lần là nhiễu, không phải thông tin. */
const ASSERT_VI = {
  must_not_group_together: "gộp nhầm hai vấn đề khác nhau",
  must_be_unclustered: "nặn câu rác thành cụm",
  must_group_together: "tách nhầm một vấn đề thành hai cụm",
  no_invented_ids: "bịa mã câu hỏi không có thật",
  no_duplicate_ids: "xếp một câu vào hai cụm",
  counts_reconcile: "số đếm không khớp đầu vào",
  min_clusters: "gom ra quá ít cụm",
  max_clusters: "gom ra quá nhiều cụm",
  all_fields_present: "thiếu phần bắt buộc trong kết quả",
  no_student_identifiers: "để lộ mã học viên",
  no_imperative: "viết như ra lệnh cho giảng viên",
  output_is_vietnamese: "trả lời không phải tiếng Việt",
  expect_confidence_in: "tự khai độ chắc chắn sai mức",
  caveat_flags: "không nêu đúng cảnh báo cần có",
  must_mention_any: "không bám vào chữ học viên viết",
  must_not_mention: "kéo vào khái niệm không ai hỏi",
  check_not_definition_recall: "câu kiểm tra chỉ hỏi thuộc lòng",
};

/* Bỏ trùng TRƯỚC khi in, nhưng GIỮ số lần: xoá hẳn con số là giấu bằng chứng. */
function FailVi({ keys, fallback }) {
  const counts = new Map();
  (keys || []).forEach((k) => counts.set(k, (counts.get(k) || 0) + 1));
  const uniq = [...counts.keys()];
  if (!uniq.length) return <span>{fallback || "—"}</span>;
  return (
    <span>
      {uniq.map((k, i) => (
        <span key={k}>
          {i > 0 && <span className="text-[color:var(--muted)]"> · </span>}
          {ASSERT_VI[k] ? (
            <>
              {ASSERT_VI[k]} <code className="text-[color:var(--muted)] text-[.85em]">{k}</code>
            </>
          ) : (
            <code>{k}</code>
          )}
          {counts.get(k) > 1 && (
            <span className="text-[color:var(--muted)] num"> ×{counts.get(k)}</span>
          )}
        </span>
      ))}
    </span>
  );
}

const firstSentence = (t) => {
  const m = String(t || "").match(/^[\s\S]*?[.!?](\s|$)/);
  return (m ? m[0] : String(t || "")).trim();
};

const cssVar = (v) =>
  typeof window === "undefined"
    ? ""
    : getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/* ── Ô bảng: component MUI, Tailwind lo hình thức. `!` vì Emotion đặc hiệu cao. ── */
const Th = ({ n, children, ...p }) => (
  <TableCell
    {...p}
    className={
      "!border-b !border-[color:var(--line-2)] !bg-[color:var(--surface-2)] !px-2.5 !py-2 !text-[12.5px] !font-semibold !text-[color:var(--ink)] " +
      (n ? "!text-right" : "")
    }
  >
    {children}
  </TableCell>
);

const Td = ({ n, children, className = "", ...p }) => (
  <TableCell
    {...p}
    className={
      "!border-b !border-[color:var(--line-2)] !px-2.5 !py-2 !align-top !text-[13px] !text-[color:var(--ink)] " +
      (n ? "!text-right num " : "") +
      className
    }
  >
    {children}
  </TableCell>
);

const CardTitle = ({ children }) => (
  <h3 className="text-[16px] font-semibold tracking-tight">{children}</h3>
);

const Capt = ({ children }) => (
  <p className="mt-1 mb-3 text-[12.5px] leading-relaxed text-[color:var(--ink-2)] max-w-[74ch]">
    {children}
  </p>
);

const Kbd = ({ children }) => (
  <code className="rounded-[5px] border border-[color:var(--line)] bg-[color:var(--surface-2)] px-1.5 py-0.5 text-[11.5px] whitespace-nowrap">
    {children}
  </code>
);

export default function Quality() {
  const sets = useMemo(() => {
    const out = [];
    if (D.eval)
      out.push({
        k: "cluster",
        lb: "Gom cụm",
        d: D.eval,
        hist: D.eval_history || [],
        sub: "Quyết định AI chính — chạy tự động khi mở một buổi",
      });
    if (D.eval_answer)
      out.push({
        k: "answer",
        lb: "Soạn nội dung ôn",
        d: D.eval_answer,
        hist: D.eval_answer_history || [],
        sub: "Quyết định AI thứ hai — chỉ chạy khi Lab Coach bấm",
      });
    return out;
  }, []);

  const [kind, setKind] = useState(sets[0] ? sets[0].k : "cluster");
  /* Mở tầng phương pháp từ chỗ khác: remount Disclosure với defaultOpen. */
  const [forceOpen, setForceOpen] = useState(0);
  const detRef = useRef(null);

  /* Ref MỚI mỗi lần đổi bộ đo, để useReveal chạy lại và quan sát các nút vừa
     dựng. Không có nó thì host vẫn mang lớp .js-reveal trong khi các nút mới
     không ai gắn .in — nội dung sẽ bị giấu vĩnh viễn. */
  const revealRef = useMemo(() => ({ current: null }), [kind]);
  const attach = (el) => {
    revealRef.current = el;
  };
  useReveal(revealRef);

  const E = sets.find((x) => x.k === kind) || sets[0];

  if (!E) {
    return (
      <div className="px-4 sm:px-8 py-10 max-w-[1120px] mx-auto">
        <Kicker>Chất lượng</Kicker>
        <Banner kind="warn" tag="TRỐNG">
          Chưa có kết quả đo. Chạy <Kbd>python eval/run_eval.py</Kbd> rồi{" "}
          <Kbd>python codebase/ui/build_data.py</Kbd>.
        </Banner>
      </div>
    );
  }

  const sm = E.d.summary || {};
  const rs = E.d.results || [];
  const used = sm.models_actually_used || [sm.model];
  const lvl = sm.pass_rate >= 85 ? "good" : sm.pass_rate >= 70 ? "warn" : "bad";
  const meterColor = { good: "var(--good)", warn: "var(--warn)", bad: "var(--critical)" }[lvl];
  const topErr = sm.errors && sm.errors.length ? sm.errors[0] : null;

  const S1 = cssVar("--s1") || "#2a78d6";
  const S2 = cssVar("--s2") || "#eb6834";
  const passLegend = [
    { c: S1, label: "Đạt" },
    { c: S2, label: "Không đạt" },
  ];

  const classRows = sm.by_class
    ? Object.keys(sm.by_class).map((k) => {
        const v = sm.by_class[k];
        return { label: CLSNAME[k] || k, a: v.pass, b: v.total - v.pass, _t: v.total };
      })
    : null;

  const openDet = () => {
    setForceOpen((n) => n + 1);
    setTimeout(
      () => detRef.current && detRef.current.scrollIntoView({ block: "start", behavior: "smooth" }),
      40
    );
  };

  return (
    <div className="px-4 sm:px-8 py-10 max-w-[1120px] mx-auto">
      <div className="reveal mb-7">
        <Kicker>Chất lượng</Kicker>
        <h2 className="text-[clamp(22px,3.2vw,34px)] font-semibold tracking-tight">
          Đo bằng phép kiểm máy tự chấm
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--ink-2)] max-w-[68ch]">
          Hai quyết định AI, hai bộ đo riêng. Các lượt đo KHÔNG so trực tiếp được với nhau vì thước đo
          có thay đổi giữa chừng — mỗi lượt ghi rõ đổi gì.
        </p>
      </div>

      {sets.length > 1 && (
        <ToggleButtonGroup
          exclusive
          value={kind}
          onChange={(_, v) => v && setKind(v)}
          aria-label="Chọn bộ đo"
          className="reveal mb-6 !rounded-full !border !border-[color:var(--line)] !bg-[color:var(--panel)] !p-1 !shadow-card"
        >
          {sets.map((x) => (
            <ToggleButton
              key={x.k}
              value={x.k}
              className={
                "!rounded-full !border-0 !px-4 !py-1.5 !text-[13px] !font-semibold !normal-case " +
                (x.k === kind
                  ? "!bg-[color:var(--ink)] !text-[color:var(--panel)]"
                  : "!bg-transparent !text-[color:var(--ink-2)]")
              }
            >
              {x.lb} ·{" "}
              <span className="num ml-1">
                {x.d.summary.n_pass}/{x.d.summary.n_cases}
              </span>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}

      {/* key={kind}: dựng lại thân trang khi đổi bộ đo, khớp với revealRef mới. */}
      <div key={kind} ref={attach}>
        {/* ── Con số lớn. TUYỆT ĐỐI không đếm lên: hiệu ứng đếm từng hiện 509
             trong khi sự thật là 511. Chuyển động chỉ áp cho chiều dài thanh. ── */}
        <Card className="reveal p-5 sm:p-6 mb-4">
          <p className="text-[clamp(40px,6vw,50px)] font-semibold leading-[1.05] tracking-[-.03em] num">
            {sm.pass_rate}%
          </p>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-[color:var(--ink-2)] max-w-[62ch]">
            <strong className="text-[color:var(--ink)]">
              {sm.n_pass}/{sm.n_cases} case đạt
            </strong>{" "}
            ở lượt đo {sm.run}, model{" "}
            <code className="rounded-[5px] bg-[color:var(--surface-2)] px-1.5 py-0.5 text-[12px]">
              {used.join(", ")}
            </code>
            . {E.sub}. Mỗi trường hợp chấm bằng phép kiểm máy tự chấm — hai người chạy lại đều ra cùng
            con số.
          </p>
          <div
            className="mt-3.5 h-2.5 rounded-full overflow-hidden"
            style={{ background: "color-mix(in srgb, var(--primary) 14%, var(--surface-2))" }}
            role="img"
            aria-label={`Tỉ lệ đạt ${sm.pass_rate}%`}
          >
            <i
              className="block h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${sm.pass_rate}%`, background: meterColor }}
            />
          </div>
        </Card>

        {/* Banner này KHÔNG được gập: nó nói thẳng rằng đúng-sai kiến thức cần Lab
            Coach chấm vì nhóm không đủ thẩm quyền — thông tin làm đổi cách dùng
            sản phẩm, phải đọc TRƯỚC khi tin con số phía trên. */}
        {sm.not_measured && (
          <div className="reveal">
            <Banner kind="warn" tag="KHÔNG ĐO">
              {sm.not_measured}
            </Banner>
          </div>
        )}

        {/* Chỉ câu đầu, NGUYÊN VĂN từ dữ liệu. Cố ý KHÔNG template hoá: bộ gom cụm
            và bộ soạn nội dung ôn khai hai chuyện khác hẳn nhau, và lời tự khai
            "SỬA BỘ ĐO, không sửa sản phẩm" là thứ một câu mẫu chung sẽ nói ngược. */}
        {sm.note && (
          <p className="reveal text-[12.5px] leading-relaxed text-[color:var(--ink-2)] mb-4">
            Lượt đo {sm.run}: {firstSentence(sm.note)}{" "}
            <Button
              variant="text"
              size="small"
              onClick={openDet}
              className="!p-0 !min-w-0 !align-baseline !text-[12.5px] !font-semibold !normal-case !text-[color:var(--primary)] hover:!bg-transparent hover:!underline"
            >
              Xem đầy đủ →
            </Button>
          </p>
        )}

        {/* Kết luận: câu Lab Coach thật sự cần, và nó phải nói chỗ sản phẩm CÒN SAI
            chứ không chỉ khoe tỉ lệ đạt. Lấy thẳng từ nhóm lỗi còn lại. */}
        <p className="reveal rounded-xl2 border border-[color:var(--line)] bg-[color:var(--panel)] px-4 py-3.5 text-[14px] leading-relaxed shadow-card mb-2">
          {sm.n_fail ? (
            <>
              Còn <b className="num">{sm.n_fail}</b> trong <span className="num">{sm.n_cases}</span>{" "}
              trường hợp chưa đạt
              {topErr && (
                <>
                  , chủ yếu là <b>{errVi(topErr.name)}</b>
                </>
              )}
              . Nghĩa là khi đọc kết quả, hãy soi kỹ nhất chỗ đó.
            </>
          ) : (
            "Không trường hợp nào trượt ở lượt đo này."
          )}
          {sm.cases_needing_repair != null && sm.cases_needing_repair > 0 && (
            <>
              {" "}
              Ngoài ra <b className="num">{sm.cases_needing_repair}</b> lần model trả kết quả hỏng và
              hệ thống phải tự sửa.
            </>
          )}
        </p>

        {/* Tầng phương pháp: giám khảo cần để kiểm chứng, Lab Coach không. Giữ
            NGUYÊN VẸN — ba biểu đồ và bảng từng trường hợp không cắt dòng nào. */}
        <div ref={detRef} className="reveal">
          <Disclosure
            key={`eval.method.${kind}.${forceOpen}`}
            id={`eval.method.${kind}`}
            defaultOpen={forceOpen > 0}
            summary="Xem phương pháp đo và toàn bộ kết quả"
          >
            <KpiGrid>
              <Kpi
                label="Trường hợp đã chạy"
                value={String(sm.n_cases)}
                note="bộ kiểm thử trong eval/"
              />
              <Kpi
                label="Không đạt"
                value={String(sm.n_fail)}
                note={sm.n_fail ? "xem bảng dưới" : "không trường hợp nào trượt"}
              />
              <Kpi label="Lời gọi AI" value={String(sm.ai_calls)} note="thật, có ghi log" />
              <Kpi
                label="Độ trễ trung bình"
                value={fmt(sm.latency_ms_avg)}
                unit="ms"
                note="mỗi lời gọi"
              />
              <Kpi label="Token vào" value={fmt(sm.tokens_in)} note={`${fmt(sm.tokens_out)} token ra`} />
              {sm.cases_needing_repair != null ? (
                <Kpi
                  label="Phải sửa chữa"
                  value={String(sm.cases_needing_repair)}
                  note="lần model trả kết quả hỏng"
                />
              ) : (
                <Kpi
                  label="Kiểm ngược bộ đo"
                  value="11/11"
                  note="--selftest: thước đo còn bắt được lỗi"
                />
              )}
            </KpiGrid>

            {E.hist.length > 1 && (
              <Card className="p-5 mb-4">
                <CardTitle>Các lượt đo — sửa gì thì số đổi thế nào</CardTitle>
                <Capt>
                  Các lượt KHÔNG so trực tiếp được với nhau vì thước đo có thay đổi giữa chừng. Mỗi
                  dòng ghi rõ đổi gì. Bảng ngay dưới là bản đầy đủ của chính biểu đồ này.
                </Capt>
                <Legend items={passLegend} />
                <GroupedBars
                  rows={E.hist.map((r) => ({
                    label: "Lượt " + r.run,
                    a: r.n_pass,
                    b: r.n_cases - r.n_pass,
                  }))}
                  labelW={90}
                  alt="Tỉ lệ đạt qua các lượt đo"
                  aLabel="Đạt"
                  bLabel="Không đạt"
                />
                <TableContainer className="mt-2">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <Th>Lượt</Th>
                        <Th n>Đạt</Th>
                        <Th>Nhóm lỗi còn lại</Th>
                        <Th>Đổi gì so với lượt trước</Th>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {E.hist.map((r, i) => (
                        <TableRow key={`${r.run}-${i}`}>
                          <Td>
                            <b>{r.run}</b>
                          </Td>
                          <Td n>
                            {r.n_pass}/{r.n_cases} = {r.pass_rate}%
                          </Td>
                          <Td>
                            {(r.errors || []).length
                              ? (r.errors || [])
                                  .map((e) => `${e.count}× ${errVi(e.name)}`)
                                  .join(" · ")
                              : "không còn lỗi nào"}
                          </Td>
                          <Td className="!text-[12.5px] !text-[color:var(--ink-2)]">
                            {i === 0 ? "gốc" : r.note || "—"}
                          </Td>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            )}

            {classRows && (
              <Card className="p-5 mb-4">
                <CardTitle>Đạt theo từng lớp chỗ khó</CardTitle>
                <Capt>Mỗi lớp phải có ít nhất 2 case. Lớp nào trượt nhiều là chỗ sản phẩm yếu nhất.</Capt>
                <Legend items={passLegend} />
                <GroupedBars
                  rows={classRows}
                  labelW={210}
                  alt="Đạt theo lớp chỗ khó"
                  aLabel="Đạt"
                  bLabel="Không đạt"
                />
                <TableView
                  cols={[
                    { t: "Lớp chỗ khó" },
                    { t: "Đạt", n: 1 },
                    { t: "Không đạt", n: 1 },
                    { t: "Tổng", n: 1 },
                  ]}
                  rows={classRows.map((r) => [r.label, r.a, r.b, r._t])}
                />
              </Card>
            )}

            {sm.errors && sm.errors.length ? (
              <Card className="p-5 mb-4">
                <CardTitle>Nhóm lỗi — xếp theo số lần gặp</CardTitle>
                <Capt>
                  Mỗi phép kiểm trượt được quy về một tên lỗi. Đây là danh sách việc cần sửa, xếp sẵn
                  theo ưu tiên.
                </Capt>
                {/* Nhãn là nửa TIẾNG VIỆT của tên lỗi; slug nằm ở cột "Tên trong
                    mã nguồn" của bảng. Bản cũ vẽ đúng nửa không ai đọc được. */}
                <GroupedBars
                  rows={sm.errors.map((e) => ({ label: errVi(e.name), a: e.count, extra: e.name }))}
                  labelW={270}
                  single
                  alt="Nhóm lỗi xếp theo số lần gặp"
                  aLabel="Số lần gặp"
                />
                <TableView
                  cols={[{ t: "Nhóm lỗi" }, { t: "Tên trong mã nguồn" }, { t: "Số lần", n: 1 }]}
                  rows={sm.errors.map((e) => [errVi(e.name), errSlug(e.name), e.count])}
                />
              </Card>
            ) : (
              <Banner kind="info" tag="SẠCH">
                Không phép kiểm nào trượt ở lượt đo này.
              </Banner>
            )}

            <Card className="p-5">
              <CardTitle>Từng trường hợp</CardTitle>
              <Capt>
                Trỏ vào tên case để đọc nguyên văn phần "case này đo cái gì" trong bộ kiểm thử.
              </Capt>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <Th>Mã</Th>
                      {sm.by_class && <Th>Lớp</Th>}
                      <Th>Case</Th>
                      <Th n>Input</Th>
                      {sm.by_class ? <Th n>Cụm</Th> : <Th>Tin cậy</Th>}
                      <Th>Kết quả</Th>
                      <Th>Trượt ở đâu</Th>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rs.map((r) => (
                      <TableRow key={r.id}>
                        <Td>
                          <code>{r.id}</code>
                        </Td>
                        {sm.by_class && <Td>{CLSNAME[r.cls] || r.cls}</Td>}
                        <Td>
                          {r.measures ? (
                            <Tooltip title={r.measures} placement="top-start">
                              <span className="cursor-help">{r.title}</span>
                            </Tooltip>
                          ) : (
                            r.title
                          )}
                        </Td>
                        <Td n>{r.n_inputs || 0}</Td>
                        {sm.by_class ? (
                          <Td n>{r.n_clusters == null ? "—" : r.n_clusters}</Td>
                        ) : (
                          <Td>{r.confidence || "—"}</Td>
                        )}
                        <Td>
                          <Chip tone={r.passed ? "ok" : "no"}>{r.passed ? "ĐẠT" : "KHÔNG ĐẠT"}</Chip>
                        </Td>
                        <Td>
                          <FailVi keys={r.failed_keys} fallback={r.note} />
                        </Td>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Disclosure>
        </div>
      </div>
    </div>
  );
}
