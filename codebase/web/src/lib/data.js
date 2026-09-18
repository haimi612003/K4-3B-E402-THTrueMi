/* data.js do build_data.py sinh ra và gán window.CP_DATA. Giữ nguyên cách đó
   thay vì import JSON, để đường ống Python không phải đổi và bản build vẫn
   nạp được dữ liệu mới mà không cần build lại. */
export const D = (typeof window !== "undefined" && window.CP_DATA) || {
  sessions: [], calls: [], thresholds: {},
};
export const TH = D.thresholds || {};

export const fmt = (n) =>
  n == null ? "—" : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const dmy = (iso) => {
  if (!iso) return "";
  const p = String(iso).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
};

/* Thứ tự buổi bám vào first_day — ngày câu hỏi ĐẦU TIÊN, tức lúc buổi diễn ra.
   KHÔNG dùng last_day: học viên vẫn hỏi về buổi cũ sau khi buổi mới đã dạy,
   nên câu hỏi cuối không phản ánh thứ tự dạy. */
export const sessionsByDate = () =>
  (D.sessions || []).slice().sort((a, b) => {
    const da = a.first_day || "", db = b.first_day || "";
    if (da && db && da !== db) return db.localeCompare(da);
    if (da && !db) return -1;
    if (db && !da) return 1;
    return String(b.lecture || "").localeCompare(String(a.lecture || ""), undefined, { numeric: true });
  });

export const latestSession = () => sessionsByDate()[0] || null;

/* Buổi ĐÔNG NHẤT — dùng cho dải bằng chứng ở hero. Khác buổi gần nhất: luận
   điểm "hàng trăm câu hỏi, vài vấn đề" chỉ có nghĩa trên một buổi có hàng trăm câu. */
export const biggestSession = () =>
  (D.sessions || []).slice().sort((a, b) => (b.real_turns || 0) - (a.real_turns || 0))[0] || null;

export const scatterCount = (s) => (s && s.scatter && s.scatter.turns) || 0;
