# -*- coding: utf-8 -*-
"""
Sinh eval/README.md từ kết quả đo thật.

    python eval/report.py            # dùng lượt đo mới nhất
    python eval/report.py --run 1

Báo cáo được SINH RA chứ không gõ tay, để con số trong tài liệu không bao giờ lệch
với con số trong results-run*.json. Muốn kiểm thì chạy lại run_eval.py rồi chạy lại file này.
"""
import argparse
import collections
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

CLS = {
    "lop1": "① Nguồn sự thật",
    "lop2": "② Mơ hồ / thiếu thông tin",
    "lop3": "③ Ngoài phạm vi / thẩm quyền",
    "lop4": "④ Đặc thù domain",
    "thuong": "Thường gặp",
    "hiem": "Hiếm",
}
ORDER = ["lop1", "lop2", "lop3", "lop4", "thuong", "hiem"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run")
    a = ap.parse_args()

    if a.run:
        path = os.path.join(HERE, "results-run%s.json" % a.run)
    else:
        import re as _re
        runs = sorted(glob.glob(os.path.join(HERE, "results-run*.json")),
                      key=lambda p_: (int(_re.search(r"run(\d+)", os.path.basename(p_)).group(1))
                                      if _re.search(r"run(\d+)", os.path.basename(p_)) else -1))
        if not runs:
            raise SystemExit("Chưa có kết quả nào. Chạy: python eval/run_eval.py")
        path = runs[-1]

    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    sm, rs = data["summary"], data["results"]

    with open(os.path.join(HERE, "golden_set.json"), encoding="utf-8") as f:
        gs = json.load(f)

    L = []
    w = L.append

    w("# Kết quả đo — lượt %s\n" % sm["run"])
    w("> File này **được sinh ra** bởi `python eval/report.py`, không gõ tay. "
      "Nguồn: `%s`.\n" % os.path.basename(path))

    if sm.get("note"):
        w("> **Lượt đo này khác lượt trước ở chỗ:** %s\n" % sm["note"])

    w("## Con số\n")
    w("**Chạy %d case, %d đạt, %d không đạt — tỉ lệ đạt %.1f%%.**\n"
      % (sm["n_cases"], sm["n_pass"], sm["n_fail"], sm["pass_rate"]))
    w("| | |")
    w("|---|---|")
    used = sm.get("models_actually_used")
    if not used:
        used = sorted({m for r in rs for m in ((r.get("ai_call") or {}).get("models_used") or [])})
    w("| Model cấu hình | `%s` |" % sm["model"])
    w("| Model **thật sự chạy** | %s |" % (", ".join("`%s`" % m for m in used) or "—"))
    fb = sm.get("cases_fell_back")
    if fb is None:
        fb = sum(1 for r in rs if (r.get("ai_call") or {}).get("fell_back"))
    if fb:
        w("| Case rơi sang model dự phòng | %d — model chính trả 503, xem `logs/gemini-calls.jsonl` |" % fb)
    w("| Lời gọi AI | %d |" % sm["ai_calls"])
    w("| Token vào / ra | %s / %s |" % (f"{sm['tokens_in']:,}".replace(",", "."),
                                        f"{sm['tokens_out']:,}".replace(",", ".")))
    w("| Độ trễ trung bình | %s ms/lượt |" % f"{sm['latency_ms_avg']:,}".replace(",", "."))
    w("| Case model trả kết quả phải sửa chữa | %d/%d |" % (sm["cases_needing_repair"], sm["n_cases"]))
    w("")

    w("## Đạt theo từng lớp chỗ khó\n")
    w("| Lớp | Đạt | Tổng |")
    w("|---|---:|---:|")
    for k in ORDER:
        if k in sm["by_class"]:
            v = sm["by_class"][k]
            w("| %s | %d | %d |" % (CLS.get(k, k), v["pass"], v["total"]))
    w("")

    if sm["errors"]:
        w("## Nhóm lỗi — xếp theo số lần gặp\n")
        w("Mỗi assertion trượt được quy về một tên lỗi. Đây là danh sách việc cần sửa, đã xếp theo ưu tiên.\n")
        w("| Số lần | Nhóm lỗi |")
        w("|---:|---|")
        for e in sm["errors"]:
            w("| %d | %s |" % (e["count"], e["name"]))
        w("")

    fails = [r for r in rs if not r["passed"]]
    if fails:
        w("## Từng case không đạt — trượt ở đâu và vì sao\n")
        for r in fails:
            w("### `%s` · %s — %s\n" % (r["id"], CLS.get(r["cls"], r["cls"]), r["title"]))
            w("*Case này đo:* %s\n" % r.get("measures", "—"))
            if r.get("note"):
                w("**%s**\n" % r["note"])
            bad = [c for c in r.get("checks", []) if not c["ok"]]
            if bad:
                w("| Assertion trượt | Thực tế |")
                w("|---|---|")
                for c in bad:
                    w("| `%s` | %s |" % (c["key"], (c["detail"] or "—").replace("|", "\\|")))
                w("")
            if r.get("cluster_names"):
                w("Cụm hệ thống trả về: %s\n" % ", ".join("*%s*" % n for n in r["cluster_names"]))

    w("## Toàn bộ case\n")
    w("| Mã | Lớp | Case | Input | Cụm | Kết quả | Trượt ở đâu |")
    w("|---|---|---|---:|---:|---|---|")
    for r in rs:
        w("| `%s` | %s | %s | %d | %s | %s | %s |" % (
            r["id"], CLS.get(r["cls"], r["cls"]), r["title"].replace("|", "\\|"),
            r.get("n_inputs", 0),
            "—" if r.get("n_clusters") is None else r["n_clusters"],
            "ĐẠT" if r["passed"] else "**KHÔNG ĐẠT**",
            ", ".join(r.get("failed_keys", [])) or r.get("note", "") or "—"))
    w("")

    c = gs["counts"]
    w("## Golden set\n")
    w("%d case, %d case lấy hoặc phát triển từ chatlog K4 thật. "
      "Tổng %d lượt hỏi được đưa qua hệ thống.\n"
      % (c["total"], c["from_real_chatlog"],
         sum(len(x.get("input_turn_ids") or []) + len(x.get("synthetic_inputs") or [])
             for x in gs["cases"])))
    w("| Nhóm | Số case | Yêu cầu CP3 |")
    w("|---|---:|---|")
    req = {"lop1": "≥2", "lop2": "≥2", "lop3": "≥2", "lop4": "≥2", "thuong": "8–10", "hiem": "2–4"}
    for k in ORDER:
        if k in c["by_class"]:
            w("| %s | %d | %s |" % (CLS.get(k, k), c["by_class"][k], req.get(k, "")))
    w("")
    w("**Vì sao chấm bằng assertion chứ không chấm cảm tính.** Guide §2.6 đòi định nghĩa \"đạt\" "
      "phải rõ tới mức hai người chấm độc lập ra cùng kết quả. Mỗi case ở đây khai một bộ "
      "assertion máy kiểm được (`must_group_together`, `must_not_group_together`, "
      "`must_be_unclustered`, `expect_sparse`, `must_flag_skew_for_turn`…), nên hai người chạy lại "
      "luôn ra cùng con số — và người ngoài nhóm kiểm lại được.\n")
    w("Ngoài assertion do case khai, runner **luôn** kiểm thêm ba thứ cho mọi case: "
      "`no_invented_ids` (model không được trả về câu không có trong đầu vào), "
      "`no_duplicate_ids` (model không được xếp một câu vào hai cụm) và "
      "`counts_reconcile` (lượt các cụm cộng nhóm rải rác phải bằng tổng đầu vào).\n")
    w("**Hai assertion dưới đây là bảo đảm bằng CẤU TRÚC, không phải phép thử.** "
      "Nói rõ để không ai đọc nhầm chúng thành bằng chứng model làm tốt:\n")
    w("| Assertion | Vì sao nó không thể trượt |")
    w("|---|---|")
    w("| `no_student_identifiers` | `build_prompt()` không bao giờ đưa mã học viên vào prompt, "
      "nên model không có gì để lộ. Đây là thiết kế, không phải kết quả đo. |")
    w("| `counts_reconcile` | `cluster_session()` luôn đưa câu model bỏ quên về nhóm rải rác, "
      "nên tổng luôn khớp. Thứ đáng đọc là `no_invented_ids`, `no_duplicate_ids` và "
      "số case phải sửa chữa ở bảng trên. |")
    w("")

    out = os.path.join(HERE, "README.md")
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(L))
    print("Đã ghi %s (%d dòng)" % (out, len(L)))


if __name__ == "__main__":
    main()
