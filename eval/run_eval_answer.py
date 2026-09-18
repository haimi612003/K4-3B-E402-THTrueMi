# -*- coding: utf-8 -*-
"""
Bộ đo cho QUYẾT ĐỊNH AI THỨ HAI: soạn nội dung ôn cho một cụm.

    python eval/run_eval_answer.py --run 1

Bộ này KHÔNG đo đúng-sai kiến thức sư phạm. Đó chính là thứ nhóm 4 người không đủ
thẩm quyền chấm, và là lý do nhóm loại đề A1 ở spec §2. Nó chỉ đo TÍNH KỶ LUẬT của
output — những thứ máy kiểm lại được và ai chạy cũng ra cùng kết quả:

  - chẩn đoán có bám vào chữ học viên viết không, hay đi mượn khái niệm khác
  - có kéo vào khái niệm không câu hỏi nào nhắc tới không
  - tín hiệu mỏng thì có tự khai độ chắc chắn thấp không
  - có giữ mức lớp không, hay tuột xuống nói về một cá nhân
  - có viết kiểu ra lệnh cho Lab Coach không
  - câu kiểm tra có phải dạng chép định nghĩa không

Phần đúng-sai kiến thức do Lab Coach chấm khi đọc bản nháp — spec §7 khai rõ.
"""
import argparse
import collections
import json
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "codebase"))
from class_pulse_legacy import config, loader  # noqa: E402
from class_pulse_legacy.console import use_utf8  # noqa: E402

use_utf8()

BASE = os.environ.get("CLASS_PULSE_URL", "http://127.0.0.1:8765")
STUDENT_ID_RE = re.compile(r"\bS\d{4}\b")
# "hãy/nên/cần phải + động từ" nhắm vào người đọc — bản nháp không được ra lệnh cho Lab Coach
IMPERATIVE_RE = re.compile(
    r"(?:^|[.!?;\n]\s*)(hãy\s+\w+|bạn\s+(?:nên|phải|cần)\s+\w+|cần\s+phải\s+\w+|"
    r"thầy\s+(?:nên|hãy)\s+\w+|cô\s+(?:nên|hãy)\s+\w+)", re.I)
VN_CHARS_RE = re.compile(r"[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]", re.I)
DEFINITION_RE = re.compile(r"^\s*[^.?!]{0,60}\blà\s+(gì|cái gì)\b", re.I)

FIELDS = ["misread", "different", "example", "check", "caveat"]
CONFIDENCE_OK = ("cao", "vừa", "thấp")

# Ngân hàng từ khoá DÙNG CHUNG cho từng loại cảnh báo.
# Lượt đo 1-2 dùng danh sách từ khoá viết riêng cho từng case, và đó là lỗi của bộ đo:
# A-07/A-08 bị chấm trượt trong khi caveat nói đúng điều cần nói, chỉ vì model dùng chữ
# khác chữ tôi đoán trước ("tối nghĩa" thay cho "mơ hồ"). Đo cách diễn đạt thì hai người
# chấm sẽ ra hai kết quả — đúng thứ guide §2.6 cấm. Gom về loại cảnh báo thì hết chuyện đó.
CAVEAT_BANK = {
    "tin_hieu_mong": ["mỏng", "quá ít", "rất ít", "ít câu", "thưa", "chưa đủ", "không đủ",
                      "hạn chế", "cụt", "mơ hồ", "tối nghĩa", "không rõ", "chưa rõ",
                      "2 câu", "hai câu", "dưới bốn", "dưới 4", "chưa đại diện", "diện rộng"],
    "khong_phai_kien_thuc": ["không phải chỗ kẹt", "không phải vấn đề", "không phải chuyên môn",
                             "hành chính", "thủ tục", "ngoài phạm vi", "không thuộc",
                             "không dính dáng", "không liên quan", "kênh khác", "quy chế",
                             "vận hành", "chuyển cho"],
    "thieu_ngu_canh": ["slide nào", "trang nào", "không rõ", "chưa rõ", "ngữ cảnh",
                       "không xác định", "thiếu thông tin", "cụ thể nào", "chưa xác định"],
}
MIN_CHARS = {"misread": 40, "different": 60, "example": 40, "check": 25, "caveat": 15}

ERROR_NAMES = {
    "all_fields_present": "thieu-phan — bản nháp thiếu phần hoặc phần quá cụt để dùng",
    "no_student_identifiers": "lo-ma-hoc-vien — output tuột xuống mức cá nhân",
    "no_imperative": "ra-lenh — viết kiểu chỉ thị cho Lab Coach thay vì đưa vật liệu",
    "check_not_definition_recall": "kiem-tra-chep-dinh-nghia — câu kiểm tra chỉ cần chép lại định nghĩa",
    "must_mention_any": "chan-doan-troi — chẩn đoán không bám vào chữ học viên viết",
    "must_not_mention": "keo-khai-niem-la — kéo vào khái niệm không câu hỏi nào nhắc tới",
    "expect_confidence_in": "tu-tin-qua — tín hiệu mỏng mà vẫn khai chắc chắn",
    "confidence_not": "tu-ti-qua — tín hiệu rõ mà vẫn khai không chắc",
    "caveat_flags": "caveat-rong — không cảnh báo được giới hạn của chính bản nháp",
    "confidence_valid": "confidence-la — model trả về mức tin cậy ngoài {cao, vừa, thấp}",
    "output_is_vietnamese": "sai-ngon-ngu — bản nháp không phải tiếng Việt",
}


def post(path, body, timeout=240):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def check(d, a):
    """Trả list {key, ok, detail}. Case đạt khi tất cả ok."""
    out = []

    def add(key, ok, detail=""):
        out.append({"key": key, "ok": bool(ok), "detail": detail})

    blob = " ".join(str(d.get(f) or "") for f in FIELDS)
    low = blob.lower()

    # Luôn kiểm: schema cho phép chuỗi tự do nên model có thể bịa mức lạ.
    # Lượt đo 2 nó trả về "vấp" — Lab Coach không đọc được đó là chắc hay không chắc.
    conf = str(d.get("confidence") or "").strip().lower()
    add("confidence_valid", any(w == conf or w in conf for w in CONFIDENCE_OK),
        "" if conf else "rỗng")

    if a.get("all_fields_present"):
        short = [f for f in FIELDS if len(str(d.get(f) or "").strip()) < MIN_CHARS[f]]
        add("all_fields_present", not short,
            "phần quá cụt hoặc rỗng: %s" % short if short else "")

    if a.get("no_student_identifiers"):
        hits = STUDENT_ID_RE.findall(blob)
        add("no_student_identifiers", not hits, "lộ mã: %s" % hits[:4] if hits else "")

    if a.get("no_imperative"):
        hits = [m.strip() for m in IMPERATIVE_RE.findall(blob)]
        add("no_imperative", not hits, "câu ra lệnh: %s" % hits[:3] if hits else "")

    if a.get("check_not_definition_recall"):
        q = str(d.get("check") or "")
        bad = bool(DEFINITION_RE.search(q))
        add("check_not_definition_recall", not bad,
            "câu kiểm tra là dạng chép định nghĩa: %s" % q[:80] if bad else "")

    m = a.get("must_mention_any")
    if m:
        field = m.get("field", "misread")
        txt = str(d.get(field) or "").lower()
        ok = any(k.lower() in txt for k in m["keywords"])
        add("must_mention_any", ok,
            "" if ok else "%s không nhắc tới bất kỳ từ nào trong %s" % (field, m["keywords"]))

    bad_kw = a.get("must_not_mention")
    if bad_kw:
        hits = [k for k in bad_kw if k.lower() in low]
        add("must_not_mention", not hits, "kéo vào: %s" % hits if hits else "")

    if a.get("expect_confidence_in"):
        c = str(d.get("confidence") or "").strip().lower()
        ok = any(w in c for w in a["expect_confidence_in"])
        add("expect_confidence_in", ok, "khai '%s', mong đợi một trong %s" % (c, a["expect_confidence_in"]))

    if a.get("confidence_not"):
        c = str(d.get("confidence") or "").strip().lower()
        ok = not any(w in c for w in a["confidence_not"])
        add("confidence_not", ok, "khai '%s', không được là %s" % (c, a["confidence_not"]))

    flags = a.get("caveat_flags")
    if flags:
        cav = str(d.get("caveat") or "").lower()
        hit = [f for f in flags if any(k in cav for k in CAVEAT_BANK.get(f, []))]
        add("caveat_flags", bool(hit),
            "" if hit else "cần cảnh báo %s; caveat: %s" % (flags, str(d.get("caveat") or "")[:120]))

    if a.get("output_is_vietnamese"):
        n = len(VN_CHARS_RE.findall(blob))
        add("output_is_vietnamese", n >= 12, "chỉ %d ký tự có dấu tiếng Việt" % n)

    return out


# ──────────────────────────────────────────────────────────────────────────
# Kiểm ngược: chứng minh bộ đo vẫn bắt được lỗi
# ──────────────────────────────────────────────────────────────────────────
# Lượt đo 3 đạt 8/8 NGAY SAU KHI tôi nới cách chấm caveat. Con số đó chỉ đáng tin nếu
# chứng minh được thước đo chưa bị nới tới mức không bắt được gì. Mỗi ca dưới đây là một
# output cố tình hỏng, kèm assertion PHẢI trượt. --selftest chạy hoàn toàn cục bộ, không
# gọi model, nên chạy lại lúc nào cũng được.
GOOD = {
    "misread": "Học viên đang lẫn giữa agent và chatbot ở chỗ ai là người quyết định gọi tool, "
               "thể hiện rõ trong câu hỏi so sánh hai khái niệm.",
    "different": "Đảo ngược thứ tự so với slide: cho lớp xem trước một nhật ký chạy thật của agent "
                 "rồi mới quay lại định nghĩa, thay vì đi từ định nghĩa xuống ví dụ như slide đang làm.",
    "example": "Cùng một yêu cầu đổi vé: chatbot trả về hướng dẫn 5 bước, agent gọi API đổi vé và "
               "báo lại mã vé mới trong 12 giây.",
    "check": "Đưa một nhật ký chạy và hỏi lớp bước nào là bước hệ thống tự quyết định gọi tool.",
    "caveat": "Tín hiệu mỏng: chỉ có 2 câu hỏi nên chưa đủ căn cứ cho cả lớp.",
    "confidence": "vừa",
}
SELFTEST = [
    ("thiếu phần", dict(GOOD, different="Ngắn."), {"all_fields_present": True}, "all_fields_present"),
    ("lộ mã học viên", dict(GOOD, misread=GOOD["misread"] + " Riêng S0452 hỏi nhiều nhất."),
     {"no_student_identifiers": True}, "no_student_identifiers"),
    ("ra lệnh cho Lab Coach", dict(GOOD, different="Hãy giảng lại phần này bằng ví dụ khác. " + GOOD["different"]),
     {"no_imperative": True}, "no_imperative"),
    ("câu kiểm tra chép định nghĩa", dict(GOOD, check="ReAct Agent là gì và có mấy bước?"),
     {"check_not_definition_recall": True}, "check_not_definition_recall"),
    ("chẩn đoán trôi khỏi chữ học viên", dict(GOOD, misread="Lớp chưa nắm vững nền tảng chung của môn học này."),
     {"must_mention_any": {"field": "misread", "keywords": ["agent", "chatbot"]}}, "must_mention_any"),
    ("kéo khái niệm lạ vào", dict(GOOD, example=GOOD["example"] + " Tương tự overfitting trong hồi quy."),
     {"must_not_mention": ["overfitting"]}, "must_not_mention"),
    ("tín hiệu mỏng mà khai chắc chắn", dict(GOOD, confidence="cao"),
     {"expect_confidence_in": ["thấp"]}, "expect_confidence_in"),
    ("mức tin cậy bịa", dict(GOOD, confidence="vấp"), {}, "confidence_valid"),
    ("caveat không cảnh báo gì", dict(GOOD, caveat="Cần đối chiếu lại số trang slide hiện hành."),
     {"caveat_flags": ["tin_hieu_mong"]}, "caveat_flags"),
    ("bản nháp ra tiếng Anh", {k: "The class confuses agents with chatbots in this lesson." for k in FIELDS},
     {"output_is_vietnamese": True}, "output_is_vietnamese"),
]


def selftest():
    print("Kiểm ngược bộ đo — mỗi ca là một output cố tình hỏng, assertion phải bắt được.\n")
    bad = 0
    for name, out, assertions, must_fail in SELFTEST:
        res = check(out, assertions)
        fired = [c["key"] for c in res if not c["ok"]]
        ok = must_fail in fired
        if not ok:
            bad += 1
        print("  %s  %-34s -> %s" % ("✓" if ok else "✗", name,
              ("bắt được " + must_fail) if ok else "KHÔNG bắt được %s (chỉ thấy %s)" % (must_fail, fired or "không gì")))
    # và output tốt thì không được trượt gì
    clean = check(GOOD, {"all_fields_present": True, "no_student_identifiers": True, "no_imperative": True,
                         "check_not_definition_recall": True, "output_is_vietnamese": True,
                         "caveat_flags": ["tin_hieu_mong"], "expect_confidence_in": ["vừa"]})
    fired = [c["key"] for c in clean if not c["ok"]]
    if fired:
        bad += 1
    print("  %s  %-34s -> %s" % ("✓" if not fired else "✗", "output tốt không bị bắt nhầm",
          "không trượt gì" if not fired else "trượt oan: %s" % fired))
    print("\n%s  %d/%d ca đúng" % ("BỘ ĐO CÒN RĂNG." if not bad else "BỘ ĐO CÓ LỖ HỔNG.",
          len(SELFTEST) + 1 - bad, len(SELFTEST) + 1))
    return 0 if not bad else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true", help="kiểm ngược bộ đo, không gọi model")
    ap.add_argument("--golden", default=os.path.join(HERE, "golden_set_answer.json"))
    ap.add_argument("--run", default="1")
    ap.add_argument("--note", default="")
    ap.add_argument("--only", nargs="*")
    a = ap.parse_args()
    if a.selftest:
        sys.exit(selftest())

    with open(a.golden, encoding="utf-8") as f:
        golden = json.load(f)
    cases = golden["cases"]
    ids = [c["id"] for c in cases]
    if len(set(ids)) != len(ids):
        raise SystemExit("golden_set_answer.json có mã case trùng.")
    if a.only:
        cases = [c for c in cases if c["id"] in set(a.only)]

    try:
        turns = loader.load_turns(config.DEFAULT_CHATLOG, cohort=None)
    except Exception as e:
        raise SystemExit("Không đọc được chatlog: %s" % e)
    idx = {t["turn_id"]: t for t in turns}

    try:
        urllib.request.urlopen(BASE + "/api/health", timeout=10).read()
    except Exception:
        raise SystemExit("Không thấy máy chủ ở %s. Chạy trước: python codebase/serve_eval.py" % BASE)

    print("Lượt đo %s · %d case · %s\n" % (a.run, len(cases), config.model_name()))
    results, errc = [], collections.Counter()

    for n, c in enumerate(cases, 1):
        missing = [t for t in c["turn_ids"] if t not in idx]
        row = {"id": c["id"], "title": c["title"], "measures": c.get("measures", ""),
               "n_inputs": len(c["turn_ids"]), "missing_turn_ids": missing}
        if missing:
            row.update({"passed": False, "note": "turn_id không có trong chatlog: %s" % missing[:4], "checks": []})
            errc["du-lieu-thieu — case trỏ vào turn_id không tồn tại"] += 1
            print("%2d. %-6s LỖI DỮ LIỆU" % (n, c["id"]))
            results.append(row)
            continue

        try:
            d = post("/api/answer", {
                # name = tên cụm, KHÔNG phải tiêu đề ca kiểm thử: tiêu đề mô tả kỳ vọng
                # ("phải tự nhận tín hiệu mỏng") nên truyền nó vào là mách đáp án.
                "lecture": "K4P1/D04", "name": c.get("cluster_name") or c["title"],
                "people": len({idx[t]["student"] for t in c["turn_ids"]}),
                "turn_ids": c["turn_ids"]})
        except Exception as e:
            row.update({"passed": False, "note": "%s: %s" % (type(e).__name__, str(e)[:160]), "checks": []})
            errc["loi-ky-thuat — gọi model thất bại"] += 1
            print("%2d. %-6s LỖI KỸ THUẬT  %s" % (n, c["id"], row["note"]))
            results.append(row)
            continue

        checks = check(d, c["assertions"])
        failed = [x for x in checks if not x["ok"]]
        for x in failed:
            errc[ERROR_NAMES.get(x["key"], x["key"])] += 1
        row.update({
            "passed": not failed, "checks": checks,
            "failed_keys": [x["key"] for x in failed],
            "confidence": d.get("confidence"), "minutes": d.get("minutes"),
            "ai": d.get("ai"), "output": {f: d.get(f) for f in FIELDS},
        })
        results.append(row)
        print("%2d. %-6s %-10s tin cậy=%-5s %s" % (
            n, c["id"], "ĐẠT" if row["passed"] else "KHÔNG ĐẠT",
            d.get("confidence"), "" if row["passed"] else "trượt: " + ", ".join(sorted({x["key"] for x in failed}))))

    n_pass = sum(1 for r in results if r["passed"])
    rate = round(100.0 * n_pass / len(results), 1) if results else 0.0
    calls = [r["ai"] for r in results if r.get("ai")]
    used = sorted({c["model"] for c in calls if c.get("model")})
    summary = {
        "run": a.run, "note": a.note, "kind": "answer",
        "model": config.model_name(), "models_actually_used": used,
        "n_cases": len(results), "n_pass": n_pass, "n_fail": len(results) - n_pass,
        "pass_rate": rate,
        "errors": [{"name": k, "count": v} for k, v in errc.most_common()],
        "ai_calls": len(calls),
        "tokens_in": sum(c.get("tokens_in") or 0 for c in calls),
        "tokens_out": sum(c.get("tokens_out") or 0 for c in calls),
        "latency_ms_avg": int(sum(c.get("latency_ms") or 0 for c in calls) / len(calls)) if calls else 0,
        "not_measured": "Đúng-sai kiến thức và 'có thật sự khác slide không' — cần Lab Coach chấm, "
                        "nhóm không đủ thẩm quyền. Xem spec §7.",
    }

    print("\n" + "=" * 62)
    print("ĐẠT %d/%d = %.1f%%   (lượt đo %s · nội dung ôn)" % (n_pass, len(results), rate, a.run))
    print("Model thật sự chạy: %s" % (", ".join(used) or "—"))
    if summary["errors"]:
        print("\nNhóm lỗi:")
        for e in summary["errors"]:
            print("   %2d ×  %s" % (e["count"], e["name"]))
    print("\n%d lời gọi AI · %d token vào · %d token ra · trung bình %d ms"
          % (summary["ai_calls"], summary["tokens_in"], summary["tokens_out"], summary["latency_ms_avg"]))
    print("\nKHÔNG đo: %s" % summary["not_measured"])

    out = os.path.join(HERE, "results-answer-run%s.json" % a.run)
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "results": results}, f, ensure_ascii=False, indent=1)
    print("\nĐã ghi %s" % out)


if __name__ == "__main__":
    main()
