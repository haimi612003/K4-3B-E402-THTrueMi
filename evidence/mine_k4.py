#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mining bằng chứng cho spec §1/§2 — lát cắt "Class Pulse" (hướng A2).

Chạy:
    python evidence/mine_k4.py <đường dẫn tới tutor_turns.csv>
Mặc định:
    ../K4-3B-Day05-06-AI-Product-Hackathon-main/data/vlearn-pack/chatlog/tutor_turns.csv

Data pack KHÔNG được commit vào repo này (luật data/README.md §4). Script đọc file
tại chỗ và chỉ in ra số đếm + trích ngắn kèm turn_id. Toàn bộ output đã lưu ở
evidence/mining-log.md — chạy lại script này phải ra đúng những con số đó.

Quy tắc đếm (để người khác kiểm lại được):
  - Phạm vi      : cohort_hint == "K4"  (khoá hiện tại)
  - Loại câu mẫu : is_preset == true    (câu bấm sẵn của giao diện)
  - "Buổi học"   : một cặp (course_id, lecture_code) — lecture_code KHÔNG duy nhất
                   giữa các khoá học nên bắt buộc ghép với course_id
  - "Thân câu hỏi": bỏ tiền tố ngữ cảnh '(Đang học phần "..." của buổi này)' /
                   '(Currently on the part "..." of this lesson)' rồi gộp khoảng trắng
  - "Trùng nguyên văn": so thân câu hỏi sau khi lower + bỏ dấu câu ở hai đầu
"""
import csv
import collections
import re
import sys
import os

DEFAULT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..",
    "K4-3B-Day05-06-AI-Product-Hackathon-main", "data", "vlearn-pack", "chatlog",
    "tutor_turns.csv",
)

PART = re.compile(
    r'^\s*\((?:Đang học phần|Currently on the part)\s*[“"].*?[”"]\s*'
    r'(?:của buổi này|of this lesson)?\)\s*', re.S)
PAGE = re.compile(r'tr(?:ang|\.)\s*\d+', re.I)


def truthy(v):
    return str(v).strip().lower() in ("true", "1", "t", "yes")


def body(q):
    """Thân câu hỏi: bỏ tiền tố ngữ cảnh, gộp khoảng trắng."""
    m = PART.match(q)
    return re.sub(r"\s+", " ", (q[m.end():] if m else q)).strip()


def norm(q):
    return body(q).lower().strip(" .?!,")


def session(r):
    return (r["course_id"], r["lecture_code"], r["lecture_title"])


def main(path):
    csv.field_size_limit(10 ** 9)
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    k4 = [r for r in rows if r["cohort_hint"] == "K4"]
    preset = [r for r in k4 if truthy(r["is_preset"])]
    real = [r for r in k4 if not truthy(r["is_preset"])]

    print("== 0. Phạm vi ==")
    print(f"toàn file: {len(rows)} lượt | câu mẫu toàn file: "
          f"{sum(1 for r in rows if truthy(r['is_preset']))} "
          f"({sum(1 for r in rows if truthy(r['is_preset'])) / len(rows) * 100:.1f}%)")
    print(f"K4: {len(k4)} lượt | {len({r['student'] for r in k4})} học viên | "
          f"{min(r['asked_at_vn'] for r in k4)} -> {max(r['asked_at_vn'] for r in k4)}")
    print(f"K4 câu mẫu is_preset: {len(preset)} ({len(preset) / len(k4) * 100:.1f}%) "
          f"-> còn {len(real)} lượt thực")

    print("\n== 1. Khối lượng mỗi buổi (K4, đã bỏ câu mẫu) ==")
    g = collections.defaultdict(list)
    for r in k4:
        g[session(r)].append(r)
    for k, v in sorted(g.items(), key=lambda x: -len(x[1])):
        vr = [r for r in v if not truthy(r["is_preset"])]
        if len(v) < 20:
            continue
        days = sorted({r["asked_at_vn"][:10] for r in v})
        chars = sum(len(body(r["student_question"])) for r in vr)
        print(f"{len(vr):5d} lượt thực | {len({r['student'] for r in vr}):4d} HV | "
              f"{chars / 1000:5.1f}k ký tự | {k[0]:12s} {k[1]} {k[2][:26]:26s} | "
              f"{days[0]}..{days[-1]}")

    print("\n== 2. Vì sao không gom được bằng cách thường ==")
    c = collections.Counter(norm(r["student_question"]) for r in real)
    once = sum(1 for _, n in c.items() if n == 1)
    print(f"{len(real)} lượt thực -> {len(c)} chuỗi khác nhau; "
          f"{once} chuỗi xuất hiện đúng 1 lần "
          f"({once / len(c) * 100:.1f}% chuỗi, {once / len(real) * 100:.1f}% lượt)")
    print("chuỗi lặp nhiều nhất (đã bỏ câu mẫu):")
    for k, n in c.most_common(6):
        print(f"   {n:3d} | {k[:60]}")

    print("\n== 3. Vấn đề CÓ lặp, chỉ là lặp về ý — buổi K4P1/D04 (DAY03) ==")
    d4 = [r for r in real if r["course_id"] == "K4P1" and r["lecture_code"] == "D04"]
    rule = re.compile(r"(react|agent|chatbot)", re.I)
    hits = [r for r in d4 if rule.search(body(r["student_question"]))]
    print("quy tắc: thân câu hỏi khớp /(react|agent|chatbot)/i")
    print(f"-> {len(hits)} lượt / {len({r['student'] for r in hits})} HV "
          f"(buổi có {len(d4)} lượt thực / {len({r['student'] for r in d4})} HV)")
    sub_a = [r for r in d4
             if re.search(r"(khác|vs|so s[aá]nh|phân biệt)", body(r["student_question"]), re.I)
             and re.search(r"(agent|chatbot|react|llm)", body(r["student_question"]), re.I)]
    sub_b = [r for r in d4
             if re.search(r"agentic fit|4 tiêu chí|chấm điểm", body(r["student_question"]), re.I)]
    print(f"   nhóm con A 'phân biệt chatbot/LLM/agent': {len(sub_a)} lượt / "
          f"{len({r['student'] for r in sub_a})} HV")
    print(f"   nhóm con B 'chấm agentic fit cho use case': {len(sub_b)} lượt / "
          f"{len({r['student'] for r in sub_b})} HV")
    print("   -> cùng từ khoá 'agent' nhưng là hai chỗ kẹt khác nhau (lớp 4)")

    print("\n== 4. Tín hiệu lệch: một người chiếm bao nhiêu lượt của buổi ==")
    for key in [("K4P1", "D08"), ("K4P1", "D01"), ("K4P1", "D04")]:
        sub = [r for r in real if r["course_id"] == key[0] and r["lecture_code"] == key[1]]
        st = collections.Counter(r["student"] for r in sub)
        (top_s, top_n) = st.most_common(1)[0]
        med = sorted(st.values())[len(st) // 2]
        print(f"{key[0]}/{key[1]}: {len(sub)} lượt / {len(st)} HV | "
              f"top-1 {top_s} = {top_n} lượt ({top_n / len(sub) * 100:.1f}%) | "
              f"trung vị {med} lượt/HV")

    print("\n== 5. Câu quá ngắn / lạc đề ==")
    short = [r for r in real if len(body(r["student_question"])) <= 15]
    print(f"thân câu hỏi <= 15 ký tự: {len(short)} / {len(real)} "
          f"({len(short) / len(real) * 100:.1f}%)")

    print("\n== 6. Ngữ cảnh đi kèm câu hỏi ==")
    has_part = sum(1 for r in real if PART.match(r["student_question"]))
    has_page = sum(1 for r in real if PAGE.search(body(r["student_question"])[:120]))
    parts_d4 = {PART.match(r["student_question"]).group(0)
                if PART.match(r["student_question"]) else None for r in d4}
    print(f"có tiền tố tên phần: {has_part} ({has_part / len(real) * 100:.1f}%)")
    print(f"có neo 'trang N' trong câu: {has_page} ({has_page / len(real) * 100:.1f}%)")
    print(f"số phần khác nhau trong riêng buổi K4P1/D04: {len(parts_d4)}")

    print("\n== 7. Số cho bảng impact §2 (ứng viên đã loại) ==")
    print(f"K4 trả lời KHÔNG trích dẫn (has_citation=false): "
          f"{sum(1 for r in k4 if not truthy(r['has_citation']))} "
          f"({sum(1 for r in k4 if not truthy(r['has_citation'])) / len(k4) * 100:.1f}%)")
    print(f"K4 lượt có rating: {sum(1 for r in k4 if r['rating'].strip())} "
          f"({collections.Counter(r['rating'] for r in k4 if r['rating'].strip())})")
    print(f"K4 understanding_level rỗng: "
          f"{sum(1 for r in k4 if not r['understanding_level'].strip())} / {len(k4)}")
    print(f"K4 move_used: {collections.Counter(r['move_used'] for r in k4).most_common(5)}")

    print("\n== 8. Trích dẫn nguyên văn (turn_id · student · thân câu hỏi) ==")
    for tid in ["T11666", "T11701", "T11704", "T11706", "T11708", "T11715",
                "T11731", "T11737", "T11824", "T11850", "T11881",
                "T11773", "T12145", "T13196", "T10381"]:
        r = next((x for x in rows if x["turn_id"] == tid), None)
        if r:
            print(f"[{tid}] {r['student']} · {r['course_id']}/{r['lecture_code']} · "
                  f"{r['asked_at_vn']} · {body(r['student_question'])[:110]}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT)
