# -*- coding: utf-8 -*-
"""
Sinh bản ẩn danh của khảo sát Lab Coach — bằng chứng đường A cho spec.md §1.

    python evidence/survey-lab-coach.py > evidence/survey-lab-coach.md

Đầu vào: evidence/_survey_raw.csv (tải từ Google Form của nhóm).
File thô KHÔNG commit: nó chứa họ tên và số điện thoại, mà chính form đã hứa
với người trả lời là "thông tin chỉ dùng nội bộ trong nhóm, nhóm không chia sẻ
câu trả lời của bạn cho bất kỳ ai khác". Script này bỏ hai cột đó và thay tên
bằng mã LC-01..LC-06 trước khi in ra.
"""
import collections
import csv
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "codebase"))
from class_pulse.console import use_utf8  # noqa: E402

use_utf8()
RAW = os.path.join(HERE, "_survey_raw.csv")

# Cột chứa thông tin nhận dạng — KHÔNG BAO GIỜ in ra
PII = {1, 32}


def main():
    if not os.path.exists(RAW):
        print("Không thấy %s — tải CSV từ Google Form về đó rồi chạy lại." % RAW)
        return 1
    rows = list(csv.reader(open(RAW, encoding="utf-8")))
    H = rows[0]
    D = [r for r in rows[1:] if any(x.strip() for x in r)]

    def cell(r, i):
        return " ".join((r[i] if i < len(r) else "").split()).strip()

    def q(i):
        return " ".join(H[i].split()).split("Thông tin chỉ dùng")[0].strip()

    def tally(i):
        c = collections.Counter(cell(r, i) for r in D if cell(r, i))
        return c.most_common()

    out = []
    A = out.append
    A("# Khảo sát Lab Coach — bằng chứng đường A cho `spec.md` §1")
    A("")
    A("> Sinh bởi `python evidence/survey-lab-coach.py`. **Đã ẩn danh**: cột họ tên và cột liên hệ")
    A("> bị loại khỏi đầu ra, người trả lời chỉ còn mã `LC-01`..`LC-%02d`." % len(D))
    A("> Form đã hứa với người trả lời rằng thông tin chỉ dùng nội bộ trong nhóm, nên bản thô")
    A("> `_survey_raw.csv` **không commit** (đã ghi trong `.gitignore`).")
    A("")
    A("**n = %d Lab Coach**, %d câu hỏi." % (len(D), len(H) - 1))
    A("")

    # ── phần đếm được ────────────────────────────────────────────────
    A("## Phần định lượng")
    A("")
    for i in [2, 5, 7, 8, 10, 14, 18, 20, 21, 22, 23, 27, 29, 31]:
        if i >= len(H):
            continue
        t = tally(i)
        if not t:
            continue
        A("**%s**" % q(i))
        A("")
        for v, n in t:
            A("- `%d/%d` — %s" % (n, len(D), v))
        A("")

    # ── phần trả lời mở, nguyên văn ──────────────────────────────────
    A("## Trả lời mở — nguyên văn, không sửa chữ")
    A("")
    for i in [6, 9, 15, 17, 19, 25, 26, 30, 33]:
        if i >= len(H):
            continue
        vals = [(k + 1, cell(r, i)) for k, r in enumerate(D) if cell(r, i)]
        if not vals:
            continue
        A("**%s**" % q(i))
        A("")
        for k, v in vals:
            A("- **LC-%02d:** “%s”" % (k, v))
        A("")

    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
