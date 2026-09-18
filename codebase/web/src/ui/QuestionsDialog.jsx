import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

import { TH, fmt } from "../lib/data";
import { Banner } from "./Bits";

/* ══════════ CỬA SỔ NHỎ: CÂU HỎI GỐC CỦA MỘT CỤM ══════════
   Mở từ con số "lượt" trong bảng. Ý nghĩa của nó là: mọi con số trên màn hình
   đều lần ngược được về chữ mà học viên đã gõ — không phải tin lời máy.

   Hai chỗ bắt buộc phải nói thật, không được lấp liếm:

   1. Đây là MẪU, không phải toàn bộ. Cụm 51 lượt chỉ kèm vài câu ví dụ, vì
      data.js cố ý không mang nguyên văn mọi lượt hỏi vào giao diện.
   2. Cụm dưới ngưỡng số học viên thì KHÔNG có câu nào — câu nguyên văn của một
      người là thông tin nhận dạng được. Lúc đó cửa sổ nói thẳng lý do và ngưỡng
      đang chạy, chứ không hiện một danh sách rỗng để người đọc tưởng lỗi.     */

export default function QuestionsDialog({ cluster, onClose }) {
  const c = cluster;
  const open = !!c;
  /* KHÔNG chỉ tin cờ examples_withheld: file kết quả sinh trước khi luật được
     sửa thì không có cờ đó, mà vẫn kèm câu nguyên văn của cụm 1 người. Tự kiểm
     lại bằng chính số học viên — lớp chặn cuối, ngay trước khi vẽ ra màn hình. */
  const min = TH.min_students_for_examples ?? 3;
  const tooFew = !!c && (c.people || 0) < min;
  const withheld = tooFew || !!(c && c.examples_withheld);
  const ex = withheld ? [] : (c && c.examples) || [];

  return (
    /* container: BẮT BUỘC. MUI Dialog dựng qua portal, mặc định gắn vào
       document.body — tức NGOÀI #root. Mà tailwind.config đặt important:"#root",
       nên mọi lớp Tailwind bên trong biến thành "#root .flex" và không khớp gì
       cả: nút đóng rơi xuống dòng dưới, danh sách lộ dấu đầu dòng, thẻ mất nền.
       Gắn portal vào chính #root là mọi lớp ăn lại bình thường. */
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      container={() => document.getElementById("root") || document.body}
      PaperProps={{ className: "!rounded-xl3 !bg-[color:var(--panel)] !text-[color:var(--ink)]" }}>
      {c && (
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] font-bold tracking-[.08em] uppercase text-[color:var(--muted)]">
                Câu hỏi gốc của cụm
              </p>
              <h2 className="mt-1 text-[18px] font-semibold tracking-tight">{c.name}</h2>
              <p className="mt-1 text-[13px] text-[color:var(--ink-2)]">
                <b className="num">{fmt(c.turns)}</b> lượt · <b className="num">{fmt(c.people)}</b> học viên khác nhau
              </p>
            </div>
            <IconButton size="small" onClick={onClose} aria-label="Đóng"
              className="!text-[color:var(--ink-2)]">
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </div>

          <div className="mt-4">
            {withheld || !ex.length ? (
              <Banner kind="info" tag="Đã giữ lại">
                Cụm này chỉ có <b className="num">{fmt(c.people)}</b> học viên, dưới ngưỡng{" "}
                <b className="num">{min}</b> nên hệ thống{" "}
                <strong>không hiện câu nguyên văn</strong> — câu hỏi của một hai người là thông tin
                nhận dạng được. Mã lượt hỏi vẫn còn trong <code>codebase/ui/data/</code> để đối chiếu.
              </Banner>
            ) : (
              <>
                {/* list-none: preflight của Tailwind bị tắt trong dự án này nên <ul> vẫn
    giữ dấu đầu dòng mặc định của trình duyệt, nằm chỏng chơ ngoài thẻ. */}
                <ul className="list-none p-0 m-0 space-y-2.5">
                  {ex.map((e, i) => (
                    <li key={i} className="rounded-xl2 border border-[color:var(--line)] bg-[color:var(--surface-2)] px-3.5 py-2.5">
                      <p className="num text-[11px] text-[color:var(--muted)]">{e.turn_id}</p>
                      <p className="mt-0.5 text-[13.5px] leading-relaxed">“{e.q}”</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12.5px] leading-relaxed text-[color:var(--muted)]">
                  Đây là <strong>{ex.length} câu ví dụ</strong> trong tổng số{" "}
                  <b className="num">{fmt(c.turns)}</b> lượt của cụm, không phải toàn bộ —{" "}
                  <code>data.js</code> cố ý không mang nguyên văn mọi lượt hỏi vào giao diện. Mã lượt
                  hỏi ở trên lần ngược được về chatlog gốc.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
