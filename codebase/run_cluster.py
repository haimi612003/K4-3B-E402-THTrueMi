# -*- coding: utf-8 -*-
"""
Chạy gom cụm cho một buổi rồi ghi kết quả ra JSON cho UI đọc.

    python codebase/run_cluster.py --list
    python codebase/run_cluster.py --course K4P1 --lecture D04
    python codebase/run_cluster.py --course K4P1 --lecture D04 --limit 120 --out codebase/ui/session-D04.json
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from class_pulse import cluster, config, loader  # noqa: E402
from class_pulse.console import use_utf8  # noqa: E402

use_utf8()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chatlog", default=config.DEFAULT_CHATLOG)
    ap.add_argument("--cohort", default="K4")
    ap.add_argument("--course")
    ap.add_argument("--lecture")
    ap.add_argument("--days", help="lọc chu kỳ, ví dụ 2026-09-12,2026-09-13")
    ap.add_argument("--limit", type=int, help="chỉ lấy N lượt đầu (tiết kiệm token khi thử)")
    ap.add_argument("--out")
    ap.add_argument("--list", action="store_true", help="liệt kê các buổi có trong log")
    a = ap.parse_args()

    turns = loader.load_turns(a.chatlog, a.cohort)

    if a.list or not (a.course and a.lecture):
        print("%-13s %-6s %-28s %6s %7s %6s %5s" % ("course_id", "lec", "tên buổi", "tổng", "câu mẫu", "thực", "HV"))
        for s in loader.sessions(turns):
            print("%-13s %-6s %-28s %6d %7d %6d %5d" % (
                s["course_id"], s["lecture_code"], s["lecture_title"][:28],
                s["total"], s["preset"], s["real"], s["students"]))
        if not (a.course and a.lecture):
            print("\nChọn một buổi:  --course K4P1 --lecture D04")
        return

    days = a.days.split(",") if a.days else None
    real, preset = loader.pick_session(turns, a.course, a.lecture, days)
    if a.limit:
        real = real[:a.limit]

    label = "%s/%s" % (a.course, a.lecture)
    print("Buổi %s — %d lượt thực, đã loại %d lượt câu mẫu, %d học viên"
          % (label, len(real), len(preset), len({t["student"] for t in real})))
    print("Model: %s  ·  khoá: %s" % (config.model_name(), config.mask(config.api_key())))
    if len(real) < config.SPARSE_MIN_TURNS:
        print("Dưới ngưỡng SPARSE (%d lượt) — KHÔNG gọi AI." % config.SPARSE_MIN_TURNS)
    else:
        n = -(-len(real) // config.CHUNK_SIZE)
        print("Đang gọi AI gom cụm… (%d phần × %d lượt%s)"
              % (n, config.CHUNK_SIZE, " + 1 lời gọi gộp cụm" if n > 1 else ""))

    res = cluster.cluster_session(real, len(preset), label, call_id="run:%s" % label)

    if res["sparse"]:
        print("\nSPARSE — %s" % res["sparse_reason"])
    else:
        ai = res["ai_call"]
        print("\n%d cụm · %d lượt rải rác · %dms · %s token vào / %s token ra"
              % (len(res["clusters"]), res["scatter"]["turns"],
                 ai["latency_ms"], ai["tokens_in"], ai["tokens_out"]))
        for i, c in enumerate(res["clusters"], 1):
            flags = "".join([" [yếu]" if c["weak"] else "", " [lệch]" if c["skew"] else ""])
            print("\n%d. %s%s" % (i, c["name"], flags))
            print("   %d lượt · %d người · %s" % (c["turns"], c["people"], ", ".join(c["parts"]) or "—"))
            for e in c["examples"]:
                print("   [%s] %s" % (e["turn_id"], e["q"][:90]))
        r = res["repairs"]
        print("\nSửa chữa: %d mã bịa · %d trùng · %d câu model bỏ quên"
              % (len(r["invented_ids"]), len(r["duplicates"]), len(r["unplaced_added_to_scatter"])))

    if a.out:
        os.makedirs(os.path.dirname(a.out), exist_ok=True)
        with open(a.out, "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=1)
        print("\nĐã ghi %s" % a.out)


if __name__ == "__main__":
    main()
