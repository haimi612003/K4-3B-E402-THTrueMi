# -*- coding: utf-8 -*-
"""
Gom kết quả thật thành codebase/ui/data.js cho dashboard đọc.

    python codebase/ui/build_data.py

Vì sao ghi ra .js chứ không .json: dashboard mở thẳng bằng file:// để demo không
cần server; fetch() một file .json qua file:// bị CORS chặn, còn <script src> thì không.

Nguồn vào:
  codebase/ui/data/session-*.json   — kết quả gom cụm thật (run_cluster.py)
  eval/results-run*.json            — kết quả bộ kiểm thử (eval/run_eval.py)
  logs/gemini-calls.jsonl           — nhật ký gọi model (chỉ lấy phần metadata,
                                      KHÔNG đưa prompt/nguyên văn câu hỏi vào UI)
  data/.../tutor_turns.csv          — để tính phân bố lượt hỏi trên mỗi học viên
"""
import collections
import glob
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, "codebase"))
from class_pulse import config, loader  # noqa: E402


def histogram(values, edges):
    """Đếm số học viên rơi vào từng khoảng lượt hỏi."""
    out = [{"label": lb, "count": 0} for lb, _, _ in edges]
    for v in values:
        for i, (_, lo, hi) in enumerate(edges):
            if lo <= v and (hi is None or v <= hi):
                out[i]["count"] += 1
                break
    return out


def main():
    sessions = []
    turns_all = None
    try:
        turns_all = loader.load_turns(config.DEFAULT_CHATLOG, cohort=None)
    except Exception as e:
        print("Không đọc được chatlog (%s) — bỏ qua phần phân bố." % e)

    for path in sorted(glob.glob(os.path.join(HERE, "data", "session-*.json"))):
        with open(path, encoding="utf-8") as f:
            s = json.load(f)
        key = os.path.basename(path)[len("session-"):-len(".json")]
        s["key"] = key

        if turns_all and "-" in key:
            course, lecture = key.rsplit("-", 1)
            real = [t for t in turns_all
                    if t["course_id"] == course and t["lecture_code"] == lecture and not t["preset"]]
            per_student = collections.Counter(t["student"] for t in real)
            vals = sorted(per_student.values(), reverse=True)
            s["lecture_title"] = real[0]["lecture_title"] if real else key
            # Ngày thật của buổi, lấy từ cột asked_at_vn của chatlog.
            # Trước đây giao diện đoán "buổi gần nhất" bằng phần tử đầu mảng, nên
            # nói DAY03 là buổi gần nhất trong khi thực tế là Day06.
            # DÙNG first_day CHỨ KHÔNG DÙNG last_day: học viên vẫn hỏi về buổi cũ sau
            # khi buổi mới đã dạy, nên câu hỏi CUỐI không phản ánh thứ tự dạy
            # (D04 và D08 cùng có câu hỏi tới 15/09). Câu hỏi ĐẦU tiên mới là
            # lúc buổi đó diễn ra: 11/09 → 13/09 → 14/09, khớp thứ tự DAY03/DAY04/Day06.
            days = sorted({t["at"][:10] for t in real if t.get("at")})
            if days:
                s["days"] = days
                s["first_day"] = days[0]    # ngày buổi được DẠY — dùng để sắp thứ tự buổi
                s["last_day"] = days[-1]    # câu hỏi cuối cùng về buổi này
            s["per_student"] = {
                "median": vals[len(vals) // 2] if vals else 0,
                "max": vals[0] if vals else 0,
                "top_share": round(vals[0] / len(real), 3) if real else 0,
                "hist": histogram(vals, [
                    ("1 lượt", 1, 1), ("2–3", 2, 3), ("4–6", 4, 6),
                    ("7–10", 7, 10), ("11–20", 11, 20), ("trên 20", 21, None),
                ]),
            }
        sessions.append(s)
        print("nạp %-26s %d cụm · %d lượt thực" % (key, len(s["clusters"]), s["real_turns"]))

    # Sắp theo SỐ lượt đo, không theo thứ tự chữ cái: "run10" phải sau "run9".
    def _run_no(pth):
        m = re.search(r"run(\d+)\.json$", os.path.basename(pth))
        return (int(m.group(1)) if m else -1, pth)

    def _latest(pattern):
        runs = sorted(glob.glob(os.path.join(ROOT, "eval", pattern)), key=_run_no)
        if not runs:
            return None, []
        with open(runs[-1], encoding="utf-8") as f:
            latest = json.load(f)
        print("nạp %-26s %d/%d đạt" % (os.path.basename(runs[-1]),
                                       latest["summary"]["n_pass"], latest["summary"]["n_cases"]))
        # Lịch sử các lượt: để dashboard kể được câu chuyện sửa rồi đo lại.
        hist = []
        for r in runs:
            with open(r, encoding="utf-8") as f:
                sm = json.load(f)["summary"]
            hist.append({"run": sm["run"], "n_pass": sm["n_pass"], "n_cases": sm["n_cases"],
                         "pass_rate": sm["pass_rate"], "note": sm.get("note", ""),
                         "errors": sm.get("errors", [])})
        return latest, hist

    # Hai quyết định AI, hai bộ đo riêng.
    ev, ev_hist = _latest("results-run*.json")
    ev_answer, ev_answer_hist = _latest("results-answer-run*.json")

    calls = []
    logp = os.path.join(config.LOG_DIR, "gemini-calls.jsonl")
    if os.path.exists(logp):
        with open(logp, encoding="utf-8") as f:
            for line in f:
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                # Cố ý KHÔNG lấy 'prompt' và 'raw_response': chúng chứa nguyên văn
                # câu hỏi học viên. UI chỉ cần metadata để chứng minh AI chạy thật.
                calls.append({
                    "call_id": d.get("call_id"), "ok": d.get("ok"),
                    "model": d.get("model"), "attempt": d.get("attempt"),
                    "latency_ms": d.get("latency_ms"),
                    "tokens_in": (d.get("usage") or {}).get("promptTokenCount"),
                    "tokens_out": (((d.get("usage") or {}).get("candidatesTokenCount") or 0)
                                   + ((d.get("usage") or {}).get("thoughtsTokenCount") or 0)) or None,
                    "fell_back": d.get("fell_back"),
                    "error": (d.get("error") or "")[:120],
                })
        print("nạp %-26s %d lời gọi" % ("gemini-calls.jsonl", len(calls)))

    payload = {
        "sessions": sessions,
        "eval": ev,
        "eval_history": ev_hist,
        "eval_answer": ev_answer,
        "eval_answer_history": ev_answer_hist,
        "calls": calls,
        "thresholds": {
            "sparse_min_turns": config.SPARSE_MIN_TURNS,
            "chunk_size": config.CHUNK_SIZE,
            "weak_max_people": config.WEAK_MAX_PEOPLE,
            "skew_ratio": config.SKEW_RATIO,
            "skew_min_turns": config.SKEW_MIN_TURNS,
            "min_students_for_examples": config.MIN_STUDENTS_FOR_EXAMPLES,
        },
    }
    out = os.path.join(HERE, "data.js")
    with open(out, "w", encoding="utf-8") as f:
        f.write("// Sinh tự động bởi codebase/ui/build_data.py — đừng sửa tay.\n")
        f.write("window.CP_DATA = ")
        json.dump(payload, f, ensure_ascii=False)
        f.write(";\n")
    print("\nĐã ghi %s (%.0f KB)" % (out, os.path.getsize(out) / 1024))


if __name__ == "__main__":
    main()
