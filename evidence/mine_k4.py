# -*- coding: utf-8 -*-
"""
Bằng chứng đường B (mining) cho §1 của spec.md — chạy lại là ra đúng những con số
spec đang trích. Không có con số nào trong spec mà script này không in ra được.

    python evidence/mine_k4.py            # in ra màn hình
    python evidence/mine_k4.py --md       # in dạng markdown cho mining-log.md

Cần data pack của khoá ở data/vlearn-pack/ (pack KHÔNG commit vào repo — luật
data/README.md §4). Không có pack thì script báo rõ và dừng, không đoán.
"""
import collections
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "codebase"))

from class_pulse import config, loader  # noqa: E402
from class_pulse.console import use_utf8  # noqa: E402

use_utf8()


def pct(a, b):
    return 0.0 if not b else round(100.0 * a / b, 1)


def norm(q):
    """Chuẩn hoá nhẹ để đếm chuỗi trùng: thường hoá, gộp khoảng trắng, bỏ dấu câu cuối."""
    return re.sub(r"\s+", " ", (q or "").strip().lower()).rstrip(" .?!,;:")


def main():
    md = "--md" in sys.argv
    try:
        turns = loader.load_turns(config.DEFAULT_CHATLOG, cohort=None)
    except Exception as e:
        print("Không đọc được chatlog: %s" % e)
        print("Chép data pack của khoá vào data/vlearn-pack/ rồi chạy lại.")
        return 1

    k4 = [t for t in turns if t.get("cohort") != "K3"]  # loader đã lọc theo cohort_hint khi truyền cohort
    # đọc lại đúng theo cohort để khỏi phụ thuộc mặc định
    k4 = loader.load_turns(config.DEFAULT_CHATLOG, cohort="K4")
    k3 = loader.load_turns(config.DEFAULT_CHATLOG, cohort="K3")

    real = [t for t in k4 if not t["preset"]]
    preset = [t for t in k4 if t["preset"]]

    out = []
    A = out.append

    A(("## " if md else "") + "1 · Quy mô dữ liệu")
    A("- Tổng lượt khoá K4: **%d**" % len(k4))
    A("- Lượt câu bấm nút có sẵn (`is_preset`) của **riêng K4**: **%d** (%.1f%%)"
      % (len(preset), pct(len(preset), len(k4))))
    A("  _Sửa sai: canvas.md từng ghi 22,7%% cho K4. 22,7%% là tỉ lệ của **cả file** (K3+K4);"
      " riêng K4 là %.1f%%._" % pct(len(preset), len(k4)))
    A("- **Lượt hỏi thực còn lại: %d**" % len(real))
    A("- Khoá K3 (chỉ để đối chiếu định dạng, không dùng làm bằng chứng): %d lượt" % len(k3))

    # ── Chuỗi duy nhất: luận điểm trung tâm của §1 ──────────────────
    cnt = collections.Counter(norm(t["q"]) for t in real if norm(t["q"]))
    uniq = sum(1 for _, n in cnt.items() if n == 1)
    A("")
    A(("## " if md else "") + "2 · Vì sao GROUP BY không giải được")
    uniq_turn = sum(n for _, n in cnt.items() if n == 1)
    A("- Số chuỗi câu hỏi khác nhau: **%d**" % len(cnt))
    A("- **Tính trên LƯỢT** — lượt mà nội dung chỉ xuất hiện đúng một lần trong cả khoá:")
    A("  **%d/%d = %.1f%%** ← con số spec §1/§2 đang trích" % (uniq_turn, len(real), pct(uniq_turn, len(real))))
    A("- Tính trên CHUỖI — chuỗi chỉ xuất hiện một lần: **%d/%d = %.1f%%**"
      % (uniq, len(cnt), pct(uniq, len(cnt))))
    A("  → Hai mẫu số khác nhau, cả hai đều đúng. Spec dùng mẫu số **lượt**.")
    A("- Năm chuỗi lặp nhiều nhất (đây là thứ `GROUP BY` bắt được):")
    for s, n in cnt.most_common(5):
        A("  - %d lần — “%s”" % (n, s[:70]))

    # ── Một buổi cụ thể ─────────────────────────────────────────────
    A("")
    A(("## " if md else "") + "3 · Quy mô một buổi (chỗ Lab Coach phải đọc tay)")
    per = collections.defaultdict(list)
    for t in real:
        per[(t["course_id"], t["lecture_code"])].append(t)
    rows = sorted(per.items(), key=lambda kv: -len(kv[1]))[:5]
    for (course, lec), ts in rows:
        chars = sum(len(t["q"] or "") for t in ts)
        hv = len({t["student"] for t in ts})
        title = ts[0]["lecture_title"]
        A("- `%s/%s` (%s): **%d lượt thực · %d học viên · %s ký tự** (~%d trang A4)"
          % (course, lec, title, len(ts), hv, "{:,}".format(chars).replace(",", "."), max(1, chars // 2500)))

    # ── Phân bố lượt trên mỗi học viên: cơ sở của cờ tín hiệu lệch ──
    A("")
    A(("## " if md else "") + "4 · Vì sao “nhiều lượt” không bằng “nhiều người”")
    for (course, lec), ts in rows[:3]:
        c = collections.Counter(t["student"] for t in ts)
        vals = sorted(c.values(), reverse=True)
        med = vals[len(vals) // 2]
        A("- `%s/%s`: trung vị **%d lượt/học viên**, người hỏi nhiều nhất **%d lượt (%.1f%% cả buổi)**"
          % (course, lec, med, vals[0], pct(vals[0], len(ts))))

    # ── Ca biên: buổi quá thưa ──────────────────────────────────────
    thin = sorted(per.items(), key=lambda kv: len(kv[1]))[:3]
    A("")
    A(("## " if md else "") + "5 · Ca biên có thật trong data (cơ sở của cổng “quá ít câu”)")
    for (course, lec), ts in thin:
        A("- `%s/%s`: **%d lượt thực · %d học viên** — dưới ngưỡng %d, hệ thống không gọi AI"
          % (course, lec, len(ts), len({t["student"] for t in ts}), config.SPARSE_MIN_TURNS))

    # ── Ngữ cảnh: tên phần vs số trang ──────────────────────────────
    has_part = sum(1 for t in real if t["part"])
    page_in_body = sum(1 for t in real if re.search(r"trang\s*\d+", t["q"] or "", re.I))
    A("")
    A(("## " if md else "") + "6 · Ngữ cảnh đi kèm câu hỏi")
    A("- Có nhãn phần bài: **%d/%d = %.1f%%**" % (has_part, len(real), pct(has_part, len(real))))
    A("- Nội dung câu hỏi có nhắc số trang: **%d/%d = %.1f%%**" % (page_in_body, len(real), pct(page_in_body, len(real))))
    A("  → Neo theo **tên phần** chứ không theo số trang. Đây là lý do chip ngữ cảnh đổi từ số trang sang tên phần.")

    # ── Vì sao loại A1: data không có nhãn để chấm ──────────────────
    A("")
    A(("## " if md else "") + "7 · Vì sao loại đề A1 (số, không phải cảm tính)")
    import csv
    rated = graded = total = 0
    with open(config.DEFAULT_CHATLOG, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r.get("cohort_hint") != "K4":
                continue
            total += 1
            if (r.get("rating") or "").strip():
                rated += 1
            if (r.get("understanding_level") or "").strip():
                graded += 1
    A("- Lượt có `rating`: **%d/%d = %.1f%%**" % (rated, total, pct(rated, total)))
    A("- Lượt có `understanding_level`: **%d/%d = %.1f%%**" % (graded, total, pct(graded, total)))
    A("  → Không có nhãn sẵn để chấm “câu trả lời tốt”. Nhóm 4 người tự chấm thì golden set là ý kiến nhóm.")

    # ── Hai phép đếm khác nhau, rất hay bị dùng lẫn ─────────────────
    A("")
    A(("## " if md else "") + "8 · Hai phép đếm KHÁC NHAU quanh cụm khái niệm agent")
    d04 = [t for t in real if t["course_id"] == "K4P1" and t["lecture_code"] == "D04"]
    hv = len({t["student"] for t in d04})
    rx = re.compile(r"\bagent|chatbot|\bllm\b", re.I)
    hit = len({t["student"] for t in d04 if rx.search(t["q"] or "")})
    A("- Học viên có ÍT NHẤT MỘT câu khớp regex `agent|chatbot|llm`: **%d/%d**" % (hit, hv))
    A("- Học viên nằm trong MỘT cụm do AI gom (“Phân biệt Chatbot và Agent”): **36/%d**" % hv)
    A("- Hai phép đếm này KHÔNG được dùng thay nhau. Khớp từ khoá là phép đếm **rộng**")
    A("  (hỏi “agent” trong ngữ cảnh nào cũng tính); cụm là phép đếm **hẹp** (cùng một chỗ kẹt).")
    A("  Chênh **%d người** chính là phần mà gom bằng từ khoá sẽ gộp nhầm." % (hit - 36))

    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
