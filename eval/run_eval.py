# -*- coding: utf-8 -*-
"""
Chạy golden set qua module gom cụm thật và chấm bằng assertion máy kiểm được.

    python eval/run_eval.py                      # chạy cả bộ
    python eval/run_eval.py --only C4-01 C2-02   # chạy vài case
    python eval/run_eval.py --run 2              # đánh số lượt đo (ghi results-run2.json)

Vì sao chấm bằng assertion chứ không chấm cảm tính: guide §2.6 yêu cầu định nghĩa
"đạt" phải rõ tới mức hai người chấm độc lập ra cùng kết quả. Assertion máy kiểm
được thì hai người luôn ra cùng kết quả — và người ngoài chạy lại kiểm được.
"""
import argparse
import collections
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "codebase"))
from class_pulse import cluster, config, loader  # noqa: E402

STUDENT_ID_RE = re.compile(r"\bS\d{4}\b")

# assertion nào trượt thì thuộc nhóm lỗi nào — dùng để gom lỗi ở phần phân tích
ERROR_NAMES = {
    "must_group_together": "tach-nham — hai câu cùng một chỗ kẹt bị xé ra hai cụm",
    "must_not_group_together": "gop-nham — hai vấn đề khác nhau bị gộp vì chung từ khoá",
    "must_be_unclustered": "nhet-cau-lac — câu lạc đề/quá ngắn bị nhét vào cụm gần nhất",
    "expect_sparse": "nan-cum-khi-thua — tín hiệu quá thưa mà vẫn nặn ra cụm",
    "min_clusters": "so-cum-lech — gom quá gộp, ít cụm hơn mức hợp lý",
    "max_clusters": "so-cum-lech — tách vụn quá mức hợp lý",
    "no_student_identifiers": "lo-ma-hoc-vien — output lộ mã học viên",
    "cluster_name_must_match_any": "dat-ten-lac — tên cụm không suy ra được từ câu trong cụm",
    "cluster_name_must_not_match": "vuot-tham-quyen — tên cụm chạm vào thứ sản phẩm không được làm",
    "must_flag_skew_for_turn": "thieu-co-lech — một người chiếm phần lớn lượt mà không gắn cờ",
    "must_flag_weak_for_turn": "thieu-co-yeu — cụm ít người mà không gắn cờ yếu",
    "must_exclude_preset": "lot-cau-mau — câu mẫu bấm sẵn lọt vào cụm",
    "no_invented_ids": "bia-ma — model trả về turn_id không có trong đầu vào",
    "counts_reconcile": "lech-so-dem — lượt các cụm + rải rác không bằng tổng đầu vào",
    "no_duplicate_ids": "xep-hai-noi — model xếp cùng một câu vào hai cụm",
}


# ──────────────────────────────────────────────────────────────────────────
# Kiểm assertion
# ──────────────────────────────────────────────────────────────────────────
def _cluster_of(result, tid):
    for i, c in enumerate(result["clusters"]):
        if tid in c["turn_ids"]:
            return i
    return None


def check(result, assertions, inputs):
    """Trả list dict {key, ok, detail}. Case đạt khi tất cả ok."""
    out = []

    def add(key, ok, detail=""):
        out.append({"key": key, "ok": bool(ok), "detail": detail})

    # ── luôn kiểm, không cần khai ────────────────────────────────────────
    inv = result["repairs"]["invented_ids"]
    add("no_invented_ids", not inv, "mã bịa: %s" % inv[:5] if inv else "")

    # Đối chiếu với số câu THỰC: cluster_session lọc câu mẫu trước khi gom, nên câu mẫu
    # không xuất hiện ở cụm lẫn nhóm rải rác. Hợp đồng là "không bao giờ mất câu hỏi thật".
    n_real = sum(1 for t in inputs if not t.get("preset"))
    total = sum(c["turns"] for c in result["clusters"]) + result["scatter"]["turns"]
    add("counts_reconcile", total == n_real,
        "cụm+rải rác = %d, câu thực đầu vào = %d (đã loại %d câu mẫu)"
        % (total, n_real, len(inputs) - n_real))

    # Model xếp một câu vào hai chỗ là vi phạm thẳng luật 4 của prompt. Code có khử
    # trùng, nhưng khử xong thì must_not_group_together có thể đạt GIẢ — nên phải
    # chấm vi phạm này riêng.
    dup = result["repairs"].get("duplicates") or []
    add("no_duplicate_ids", not dup, "xếp hai nơi: %s" % dup[:5] if dup else "")

    # ── assertion do case khai ───────────────────────────────────────────
    for group in assertions.get("must_group_together", []):
        idxs = {t: _cluster_of(result, t) for t in group}
        vals = set(idxs.values())
        ok = len(vals) == 1 and None not in vals
        add("must_group_together", ok, "%s -> cụm %s" % (group, idxs))

    for pair in assertions.get("must_not_group_together", []):
        a, b = pair[0], pair[1]
        ia, ib = _cluster_of(result, a), _cluster_of(result, b)
        ok = not (ia is not None and ia == ib)
        add("must_not_group_together", ok, "%s->cụm %s, %s->cụm %s" % (a, ia, b, ib))

    # Chấm trên phần MODEL TỰ KHAI là rải rác. Nếu model bỏ quên câu đó và code dọn hộ
    # vào nhóm rải rác thì KHÔNG tính là model làm đúng — nếu không, một model lười
    # (bỏ trắng scatter) sẽ ăn điểm của lớp ② và ③ mà không làm gì.
    from_model = result["scatter"].get("from_model")
    for tid in assertions.get("must_be_unclustered", []):
        if from_model is None:          # kết quả cũ, chưa có trường này
            ok, why = tid in result["scatter"]["turn_ids"], "(kết quả cũ, không phân biệt được nguồn)"
        else:
            ok = tid in from_model
            why = ("model bỏ quên, code dọn hộ vào rải rác"
                   if tid in result["scatter"]["turn_ids"] else
                   "nằm ở cụm %s" % _cluster_of(result, tid))
        add("must_be_unclustered", ok, "" if ok else "%s: %s" % (tid, why))

    if "expect_sparse" in assertions:
        want = bool(assertions["expect_sparse"])
        add("expect_sparse", result["sparse"] == want,
            "sparse=%s, mong đợi %s" % (result["sparse"], want))

    if "min_clusters" in assertions:
        n = len(result["clusters"])
        add("min_clusters", n >= assertions["min_clusters"],
            "%d cụm, tối thiểu %d" % (n, assertions["min_clusters"]))

    if "max_clusters" in assertions:
        n = len(result["clusters"])
        add("max_clusters", n <= assertions["max_clusters"],
            "%d cụm, tối đa %d" % (n, assertions["max_clusters"]))

    if assertions.get("no_student_identifiers"):
        blob = " ".join([c["name"] + " " + c.get("why", "") for c in result["clusters"]]
                        + [result.get("sparse_reason", "")])
        hits = STUDENT_ID_RE.findall(blob)
        add("no_student_identifiers", not hits, "lộ: %s" % hits[:5] if hits else "")

    keys = assertions.get("cluster_name_must_match_any")
    if keys:
        names = [c["name"].lower() for c in result["clusters"]]
        ok = any(any(k.lower() in n for k in keys) for n in names)
        add("cluster_name_must_match_any", ok, "tên cụm: %s | cần chứa một trong %s" % (names, keys))

    bad = assertions.get("cluster_name_must_not_match")
    if bad:
        names = [c["name"].lower() for c in result["clusters"]]
        hit = [(n, k) for n in names for k in bad if k.lower() in n]
        add("cluster_name_must_not_match", not hit, "vi phạm: %s" % hit[:3] if hit else "")

    tid = assertions.get("must_flag_skew_for_turn")
    if tid:
        i = _cluster_of(result, tid)
        ok = i is not None and result["clusters"][i]["skew"]
        add("must_flag_skew_for_turn", ok,
            "cụm %s skew=%s" % (i, result["clusters"][i]["skew"] if i is not None else "—"))

    tid = assertions.get("must_flag_weak_for_turn")
    if tid:
        i = _cluster_of(result, tid)
        ok = i is not None and result["clusters"][i]["weak"]
        add("must_flag_weak_for_turn", ok,
            "cụm %s weak=%s" % (i, result["clusters"][i]["weak"] if i is not None else "—"))

    if assertions.get("must_exclude_preset"):
        preset_ids = {t["turn_id"] for t in inputs if t.get("preset")}
        leaked = [t for c in result["clusters"] for t in c["turn_ids"] if t in preset_ids]
        add("must_exclude_preset", not leaked, "lọt: %s" % leaked[:5] if leaked else "")

    return out


# ──────────────────────────────────────────────────────────────────────────
# Dựng đầu vào của một case
# ──────────────────────────────────────────────────────────────────────────
def build_inputs(case, by_id):
    inputs, missing = [], []
    for tid in case.get("input_turn_ids", []):
        t = by_id.get(tid)
        if t is None:
            missing.append(tid)
        else:
            inputs.append(dict(t))
    for s in case.get("synthetic_inputs", []) or []:
        inputs.append({
            "turn_id": s["turn_id"], "student": s.get("student", "S9999"),
            "at": "", "course_id": "SYN", "lecture_code": "SYN",
            "lecture_title": "tự dựng", "part": None, "preset": False, "q": s["q"],
        })
    return inputs, missing


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--golden", default=os.path.join(HERE, "golden_set.json"))
    ap.add_argument("--chatlog", default=config.DEFAULT_CHATLOG)
    ap.add_argument("--run", default="1")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--note", default="", help="lượt này khác lượt trước ở chỗ nào")
    a = ap.parse_args()

    with open(a.golden, encoding="utf-8") as f:
        golden = json.load(f)
    cases = golden["cases"]
    if a.only:
        cases = [c for c in cases if c["id"] in set(a.only)]

    turns = loader.load_turns(a.chatlog, cohort=None)
    by_id = {t["turn_id"]: t for t in turns}

    print("Lượt đo %s · %d case · model %s\n" % (a.run, len(cases), config.model_name()))
    results, err_counter = [], collections.Counter()

    for n, case in enumerate(cases, 1):
        inputs, missing = build_inputs(case, by_id)
        assertions = case["assertions"]
        if isinstance(assertions, str):
            assertions = json.loads(assertions)

        row = {"id": case["id"], "cls": case["cls"], "title": case["title"],
               "measures": case.get("measures", ""), "source": case.get("source", ""),
               "n_inputs": len(inputs), "missing_turn_ids": missing}

        if missing:
            row.update({"status": "LOI_DU_LIEU", "passed": False,
                        "note": "turn_id không có trong chatlog: %s" % missing[:5],
                        "checks": []})
            err_counter["du-lieu-thieu — case trỏ vào turn_id không tồn tại"] += 1
            print("%2d. %-8s LỖI DỮ LIỆU  %s" % (n, case["id"], row["note"]))
            results.append(row)
            continue

        try:
            # preset_count = 0: cluster_session tự lọc câu mẫu và tự cộng vào preset_removed.
            # Truyền số đếm ở đây nữa là đếm hai lần.
            res = cluster.cluster_session(
                inputs, preset_count=0,
                lecture_label=case["title"], call_id="eval%s:%s" % (a.run, case["id"]))
        except Exception as e:
            row.update({"status": "LOI_KY_THUAT", "passed": False,
                        "note": "%s: %s" % (type(e).__name__, str(e)[:200]), "checks": []})
            err_counter["loi-ky-thuat — gọi model thất bại"] += 1
            print("%2d. %-8s LỖI KỸ THUẬT  %s" % (n, case["id"], row["note"]))
            results.append(row)
            continue

        checks = check(res, assertions, inputs)
        failed = [c for c in checks if not c["ok"]]
        passed = not failed
        for c in failed:
            err_counter[ERROR_NAMES.get(c["key"], c["key"])] += 1

        row.update({
            "status": "DAT" if passed else "KHONG_DAT",
            "passed": passed,
            "checks": checks,
            "failed_keys": [c["key"] for c in failed],
            "n_clusters": len(res["clusters"]),
            "n_scatter": res["scatter"]["turns"],
            "sparse": res["sparse"],
            "repairs": res["repairs"],
            "ai_call": res["ai_call"],
            "cluster_names": [c["name"] for c in res["clusters"]],
        })
        results.append(row)
        print("%2d. %-8s %-10s %2d cụm · %2d rải rác · %s" % (
            n, case["id"], "ĐẠT" if passed else "KHÔNG ĐẠT",
            len(res["clusters"]), res["scatter"]["turns"],
            "" if passed else "trượt: " + ", ".join(sorted({c["key"] for c in failed}))))

    n_pass = sum(1 for r in results if r["passed"])
    n_total = len(results)
    rate = round(100.0 * n_pass / n_total, 1) if n_total else 0.0

    by_class = collections.defaultdict(lambda: [0, 0])
    for r in results:
        by_class[r["cls"]][1] += 1
        if r["passed"]:
            by_class[r["cls"]][0] += 1

    calls = [r["ai_call"] for r in results if r.get("ai_call", {}).get("called")]
    # Model ĐƯỢC CẤU HÌNH và model THẬT SỰ CHẠY có thể khác nhau: khi model chính
    # trả 503, gemini.py rơi sang model dự phòng. Báo cáo phải nói đúng model đã chạy,
    # nếu không thì con số đo được đang bị gán cho nhầm model.
    used = sorted({m for c in calls for m in (c.get("models_used") or [c.get("model")]) if m})
    summary = {
        "run": a.run,
        "note": a.note,
        "model": config.model_name(),
        "models_actually_used": used,
        "cases_fell_back": sum(1 for c in calls if c.get("fell_back")),
        "n_cases": n_total,
        "n_pass": n_pass,
        "n_fail": n_total - n_pass,
        "pass_rate": rate,
        "by_class": {k: {"pass": v[0], "total": v[1]} for k, v in sorted(by_class.items())},
        "errors": [{"name": k, "count": v} for k, v in err_counter.most_common()],
        "ai_calls": len(calls),
        "tokens_in": sum(c.get("tokens_in") or 0 for c in calls),
        "tokens_out": sum(c.get("tokens_out") or 0 for c in calls),
        "latency_ms_avg": int(sum(c.get("latency_ms") or 0 for c in calls) / len(calls)) if calls else 0,
        "cases_needing_repair": sum(
            1 for r in results
            if r.get("repairs") and (r["repairs"]["invented_ids"] or r["repairs"]["duplicates"]
                                     or r["repairs"]["unplaced_added_to_scatter"])),
    }

    print("\n" + "=" * 62)
    print("ĐẠT %d/%d = %.1f%%   (lượt đo %s)" % (n_pass, n_total, rate, a.run))
    print("Model cấu hình:     %s" % config.model_name())
    print("Model thật sự chạy: %s%s" % (", ".join(used) or "—",
          "   (%d case rơi sang model dự phòng)" % summary["cases_fell_back"]
          if summary["cases_fell_back"] else ""))
    for k, v in summary["by_class"].items():
        print("   %-8s %d/%d" % (k, v["pass"], v["total"]))
    if summary["errors"]:
        print("\nNhóm lỗi:")
        for e in summary["errors"]:
            print("   %2d ×  %s" % (e["count"], e["name"]))
    print("\n%d lời gọi AI · %d token vào · %d token ra · trung bình %dms/lượt"
          % (summary["ai_calls"], summary["tokens_in"], summary["tokens_out"], summary["latency_ms_avg"]))
    print("%d/%d case model trả về kết quả cần sửa chữa (bịa mã / trùng / bỏ sót)"
          % (summary["cases_needing_repair"], n_total))

    out = os.path.join(HERE, "results-run%s.json" % a.run)
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "results": results}, f, ensure_ascii=False, indent=1)
    print("\nĐã ghi %s" % out)


if __name__ == "__main__":
    main()
