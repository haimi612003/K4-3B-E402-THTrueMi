# -*- coding: utf-8 -*-
"""
Nạp log câu hỏi và chuẩn hoá trước khi đưa vào bước gom cụm.

Quy tắc đếm (giữ nguyên xuyên suốt spec §1, eval và UI):
  - Một "buổi học" = cặp (course_id, lecture_code). lecture_code KHÔNG duy nhất
    giữa các khoá học nên bắt buộc ghép với course_id.
  - Câu mẫu bấm sẵn (is_preset) bị LOẠI trước khi đếm bất cứ thứ gì, và số lượt
    đã loại được báo rõ ra ngoài.
  - "Thân câu hỏi" = bỏ tiền tố ngữ cảnh '(Đang học phần "..." của buổi này)'.
    Tên phần được giữ riêng làm metadata của cụm.
"""
import csv
import re

from . import config

csv.field_size_limit(10 ** 9)

PART_RE = re.compile(
    r'^\s*\((?:Đang học phần|Currently on the part)\s*[“"](.*?)[”"]\s*'
    r'(?:của buổi này|of this lesson)?\)\s*', re.S)

# Dạng tiền tố thứ hai, chiếm 70% lượt của khoá K3 (K4 không có câu nào).
# Không bóc nó thì cả đoạn slide được bôi đen lọt vào câu hỏi, và model sẽ gom cụm
# theo chữ của slide chứ không theo chữ học viên viết.
PAGE_RE = re.compile(
    r'^\s*\(Trang\s*(\d+)(?:,\s*đoạn được chọn:.*?)?\)\s*', re.S)


# Lưới an toàn ẩn danh. Data pack của khoá ĐÃ được ẩn danh sẵn (học viên -> S####,
# tên người -> [HV], email/điện thoại/MSSV -> nhãn). Lớp này chỉ bắt phần sót lại,
# vì spec §6 hứa "ví dụ nguyên văn đi qua bước ẩn danh" và lời hứa đó phải có code đỡ.
REDACT = [
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "[EMAIL]"),
    (re.compile(r"\b(?:0|\+84)\d{8,10}\b"), "[PHONE]"),
    (re.compile(r"\b\d[A-Z]\d{9,}\b"), "[MSSV]"),
    (re.compile(r"\bS\d{4}\b"), "[HV]"),          # mã học viên không được lọt ra ngoài
]


def redact(text):
    """Che thông tin nhận dạng còn sót trong câu hỏi trước khi đưa đi bất cứ đâu."""
    for rx, tag in REDACT:
        text = rx.sub(tag, text)
    return text


def _truthy(v):
    return str(v).strip().lower() in ("true", "1", "t", "yes")


def split_context(question):
    """
    Tách (ngữ cảnh, thân câu hỏi). Ngữ cảnh là tên phần bài, hoặc số trang.

    Hai dạng tiền tố có thật trong pack:
      (Đang học phần "...")             — 99,6% lượt của khoá K4
      (Trang N, đoạn được chọn: "...")  — 70% lượt của khoá K3
    """
    m = PART_RE.match(question)
    if m:
        return m.group(1).strip(), re.sub(r"\s+", " ", question[m.end():]).strip()
    m = PAGE_RE.match(question)
    if m:
        return "tr. " + m.group(1), re.sub(r"\s+", " ", question[m.end():]).strip()
    return None, re.sub(r"\s+", " ", question).strip()


def load_turns(path=None, cohort="K4"):
    """Đọc toàn bộ chatlog, trả list dict đã chuẩn hoá."""
    path = path or config.DEFAULT_CHATLOG
    out = []
    with open(path, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if cohort and r.get("cohort_hint") != cohort:
                continue
            part, body = split_context(r["student_question"])
            out.append({
                "turn_id": r["turn_id"],
                "student": r["student"],
                "at": r["asked_at_vn"],
                "course_id": r["course_id"],
                "lecture_code": r["lecture_code"],
                "lecture_title": r["lecture_title"],
                "part": part,
                "preset": _truthy(r["is_preset"]),
                "q": redact(body),
            })
    return out


def sessions(turns):
    """Liệt kê các buổi có trong log, kèm số đếm — dùng cho bộ chọn của UI."""
    agg = {}
    for t in turns:
        k = (t["course_id"], t["lecture_code"])
        s = agg.setdefault(k, {
            "course_id": t["course_id"], "lecture_code": t["lecture_code"],
            "lecture_title": t["lecture_title"], "total": 0, "preset": 0,
            "students": set(), "days": set(),
        })
        s["total"] += 1
        s["preset"] += 1 if t["preset"] else 0
        s["students"].add(t["student"])
        s["days"].add(t["at"][:10])
    rows = []
    for s in agg.values():
        rows.append({
            "course_id": s["course_id"], "lecture_code": s["lecture_code"],
            "lecture_title": s["lecture_title"],
            "total": s["total"], "preset": s["preset"],
            "real": s["total"] - s["preset"],
            "students": len(s["students"]),
            "days": sorted(s["days"]),
        })
    rows.sort(key=lambda r: -r["real"])
    return rows


def pick_session(turns, course_id, lecture_code, days=None):
    """
    Lấy các lượt của một buổi. days = danh sách 'YYYY-MM-DD' để giới hạn chu kỳ
    (None = lấy hết). Trả (lượt_thực, lượt_câu_mẫu_đã_loại).
    """
    sel = [t for t in turns
           if t["course_id"] == course_id and t["lecture_code"] == lecture_code
           and (days is None or t["at"][:10] in days)]
    real = [t for t in sel if not t["preset"]]
    preset = [t for t in sel if t["preset"]]
    return real, preset


def by_turn_ids(turns, turn_ids):
    """Lấy đúng các lượt theo danh sách turn_id, giữ nguyên thứ tự yêu cầu."""
    idx = {t["turn_id"]: t for t in turns}
    return [idx[i] for i in turn_ids if i in idx]
