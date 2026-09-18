import { D, TH, fmt } from "../lib/data";
import { Kicker, Card, Banner, Disclosure } from "../ui/Bits";
import Flow from "../ui/Flow";
import Quality from "./Quality";
import AiLog from "./AiLog";
import Live from "./Live";

/* ══════════ TRANG 2 · XỬ LÝ ══════════
   Trả lời: "giữa đầu vào và đầu ra, hệ thống đã làm gì và có tin được không".

   Ba phần đo chất lượng, nhật ký gọi model và thử trực tiếp là ba tab cũ, được
   dùng LẠI nguyên vẹn chứ không chép lại — sửa một chỗ thì cả hai nơi cùng đổi.
   Chúng nằm sau cửa gập vì đây là tầng kiểm chứng: người dùng thường ngày không
   cần mở, người chấm thì mở ra là có đủ.                                     */

const STEPS = [
  {
    n: 1,
    t: "Đọc log, loại câu bấm nút có sẵn",
    d: "Câu do học viên bấm nút mẫu bị loại TRƯỚC khi đếm bất cứ thứ gì. Để lẫn vào là ra cụm giả — " +
       "một câu mẫu 100 người bấm sẽ trông y hệt một vấn đề 100 người vướng.",
  },
  {
    n: 2,
    t: "Gom cụm bằng AI, theo lô",
    d: "Câu hỏi được chia lô rồi gộp lại, vì một buổi có hàng trăm lượt. AI trả về mã lượt hỏi, " +
       "không trả về chữ — nên mọi cụm đều truy ngược được về câu gốc.",
  },
  {
    n: 3,
    t: "Đếm người, không chỉ đếm lượt",
    d: "Mỗi cụm có hai con số tách biệt: số lượt và số HỌC VIÊN KHÁC NHAU. Cụm nào ít người thì bị " +
       "đánh cờ yếu; cụm nào nhiều lượt mà dồn vào ít người thì bị đánh cờ tín hiệu lệch.",
  },
  {
    n: 4,
    t: "Soạn vật liệu giảng lại",
    d: "Chỉ chạy cho những cụm Lab Coach đã chọn. Không có chuyện tự soạn cả buổi rồi bắt người đọc lọc.",
  },
];

export default function ProcessPage({ sess, setSess, goTab }) {
  const all = D.sessions || [];
  const s = all[sess] || null;
  const ev = D.eval || null;
  const calls = D.calls || [];
  const okCalls = calls.filter((c) => c.ok).length;

  return (
    <div className="mx-auto max-w-[1080px] px-5 sm:px-8 py-12 pb-20">
      <Kicker>Bước 2 / 3 · Xử lý</Kicker>
      <h1 className="text-[clamp(26px,4vw,40px)] font-semibold tracking-tight">
        Hệ thống đã làm gì với chỗ dữ liệu đó
      </h1>
      <p className="mt-3 max-w-[66ch] text-[14.5px] leading-relaxed text-[color:var(--ink-2)]">
        Bốn bước, chạy bằng ngưỡng ghi trong <code>config.py</code> — không có bước nào do người
        chỉnh tay giữa chừng. Ngưỡng in dưới đây là ngưỡng <strong>đang chạy thật</strong>, lấy từ
        máy chủ chứ không phải bản đóng băng trong <code>data.js</code>.
      </p>

      {/* ══════════ BỐN BƯỚC ══════════ */}
      <section className="reveal mt-8 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(248px,1fr))" }}>
        {STEPS.map((st) => (
          <Card key={st.n} className="p-5">
            <span className="inline-grid place-items-center w-7 h-7 rounded-full bg-[color:var(--ink)] text-[color:var(--panel)] text-[13px] font-semibold num">
              {st.n}
            </span>
            <p className="mt-3 text-[15px] font-semibold tracking-tight">{st.t}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--ink-2)]">{st.d}</p>
          </Card>
        ))}
      </section>

      {/* ══════════ NGƯỠNG ĐANG CHẠY ══════════ */}
      <section className="reveal mt-8">
        <Card className="p-5">
          <h2 className="text-[17px] font-semibold tracking-tight">Ngưỡng đang chạy</h2>
          <p className="mt-1 mb-3 text-[13px] text-[color:var(--ink-2)]">
            In thẳng ra màn hình chứ không giấu trong mã, để ai đọc cũng đối chiếu được với kết quả.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="text-left text-[color:var(--muted)] border-b border-[color:var(--line)]">
                  <th className="py-2 pr-3 font-semibold">Ngưỡng</th>
                  <th className="py-2 pr-3 font-semibold text-right">Giá trị</th>
                  <th className="py-2 font-semibold">Nó quyết định gì</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Buổi quá ít câu để gom", TH.sparse_min_turns, "dưới mức này thì không gom cụm, báo thẳng là thiếu dữ liệu"],
                  ["Cỡ mỗi lô gửi model", TH.chunk_size, "một buổi hàng trăm lượt phải chia lô rồi gộp lại"],
                  ["Cụm yếu khi ≤ N người", TH.weak_max_people, "ít người quá thì dễ là trùng hợp, không phải vấn đề của lớp"],
                  ["Tín hiệu lệch khi một người chiếm ≥", TH.skew_ratio, "nhiều lượt nhưng dồn vào một người — không phải cả lớp kẹt"],
                  ["…và cụm có ít nhất N lượt", TH.skew_min_turns, "cụm quá nhỏ thì tỉ lệ không nói lên gì"],
                  ["Chỉ hiện câu ví dụ khi ≥ N học viên", TH.min_students_for_examples, "câu nguyên văn của một người là thông tin nhận dạng được"],
                ].map(([k, v, why], i) => (
                  <tr key={i} className="border-b border-[color:var(--line-2)]">
                    <td className="py-2 pr-3">{k}</td>
                    <td className="py-2 pr-3 num text-right font-semibold">{v == null ? "—" : String(v)}</td>
                    <td className="py-2 text-[color:var(--ink-2)]">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ══════════ ĐẦU VÀO → ĐẦU RA ══════════ */}
      <section className="reveal mt-8">
        <Flow s={s} />
      </section>

      {/* ══════════ KẾT QUẢ ĐO, GỌN ══════════ */}
      <section className="reveal mt-8">
        <h2 className="text-[17px] font-semibold tracking-tight">Có tin được không</h2>
        {ev && ev.summary ? (
          <Banner kind={ev.summary.pass_rate >= 0.85 ? "good" : "warn"} tag="Bộ đo">
            Bộ kiểm thử gom cụm: <b className="num">{ev.summary.n_pass}/{ev.summary.n_cases}</b> đạt
            ({Math.round(ev.summary.pass_rate * 100)}%) ở lượt đo thứ {ev.summary.run}.{" "}
            {calls.length > 0 && (
              <>Nhật ký ghi <b className="num">{fmt(calls.length)}</b> lời gọi model thật,{" "}
              <b className="num">{fmt(okCalls)}</b> thành công.</>
            )}{" "}
            Toàn bộ phương pháp đo và từng trường hợp nằm trong cửa gập bên dưới — không bị xoá, chỉ đổi chỗ đứng.
          </Banner>
        ) : (
          <Banner kind="warn" tag="Chưa đo">
            Chưa có kết quả bộ kiểm thử trong <code>data.js</code>. Chạy <code>python eval/run_eval.py</code>{" "}
            rồi <code>python codebase/ui/build_data.py</code>.
          </Banner>
        )}
      </section>

      {/* ══════════ BA TẦNG KIỂM CHỨNG ══════════ */}
      <section className="reveal mt-6">
        <Disclosure id="xl.quality" summary="Chất lượng — phương pháp đo, lịch sử các lượt, từng trường hợp">
          <Quality sess={sess} setSess={setSess} goTab={goTab} />
        </Disclosure>

        <Disclosure id="xl.log" summary="Nhật ký AI — bằng chứng model chạy thật: token, độ trễ, số lần trả kết quả hỏng">
          <AiLog sess={sess} setSess={setSess} goTab={goTab} />
        </Disclosure>

        <Disclosure id="xl.live" summary="Thử trực tiếp — gọi model thật ngay trên trang, với dữ liệu bạn chọn">
          <Live sess={sess} setSess={setSess} goTab={goTab} />
        </Disclosure>
      </section>

      {s && (
        <p className="mt-8 text-[13px] text-[color:var(--ink-2)]">
          Buổi đang xem: <strong>{(s.lecture_title ? s.lecture_title + " · " : "") + s.lecture}</strong> ·{" "}
          <b className="num">{fmt(s.real_turns)}</b> lượt thực → <b className="num">{(s.clusters || []).length}</b> cụm.
          Đổi buổi ở trang <button type="button" onClick={() => goTab("vao")} className="underline text-[color:var(--primary)]">Đầu vào</button>.
        </p>
      )}
    </div>
  );
}
