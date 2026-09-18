# -*- coding: utf-8 -*-
"""
Máy chủ cục bộ cho tab "Thử trực tiếp" của dashboard.

    python codebase/serve.py            # rồi mở http://127.0.0.1:8765

Vì sao cần máy chủ: tab thử trực tiếp phải gọi Gemini thật. Nếu để trình duyệt gọi
thẳng thì khoá API nằm trong mã nguồn trang — ai mở DevTools cũng lấy được. Máy chủ
này giữ khoá ở phía server, trình duyệt chỉ gửi câu hỏi và nhận cụm.

Chỉ lắng nghe trên 127.0.0.1 — không mở ra mạng ngoài.
Chỉ dùng thư viện chuẩn, không cần pip install.

Các đầu API:
  GET  /api/health    — có khoá chưa, model nào, đọc được chatlog không
  GET  /api/samples   — các bộ câu hỏi THẬT lấy từ chatlog, để bấm một nút là có data
  POST /api/generate  — nhờ AI sinh bộ câu hỏi giả lập theo chủ đề (khi không có pack)
  POST /api/cluster   — gom cụm thật: nhận danh sách câu hỏi, trả cụm + số đo
"""
import json
import os
import random
import sys
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
UI = os.path.join(HERE, "ui")
sys.path.insert(0, HERE)

from class_pulse import cluster, config, gemini, loader  # noqa: E402

PORT = int(os.environ.get("CLASS_PULSE_PORT", "8765"))
MAX_QUESTIONS = 60          # trần cho một lần thử, đủ để thấy hành vi mà không đốt token

_cache = {"turns": None, "err": None}
_lock = threading.Lock()


def turns():
    """Nạp chatlog một lần rồi giữ trong bộ nhớ. Không có pack cũng chạy được."""
    with _lock:
        if _cache["turns"] is None and _cache["err"] is None:
            try:
                _cache["turns"] = loader.load_turns(config.DEFAULT_CHATLOG, cohort="K4")
            except Exception as e:
                _cache["err"] = str(e)
                _cache["turns"] = []
    return _cache["turns"]


# ── Bộ câu hỏi mẫu, lấy từ chatlog thật ──────────────────────────────────
SAMPLES = [
    {"id": "agent", "title": "Chatbot và Agent khác nhau chỗ nào",
     "hint": "Cụm thật lớn nhất buổi DAY03 — 8 người hỏi 8 kiểu khác nhau, trộn với câu lạc đề",
     "ids": ["T11666", "T11701", "T11704", "T11706", "T11708", "T11715", "T11731", "T11737",
             "T11773", "T11783", "T11824", "T11850", "T11830", "T11918"]},
    {"id": "skew", "title": "Một người hỏi dồn dập",
     "hint": "Một học viên hỏi “slide này là sao” 6 lần, trộn với 3 người khác — "
             "cụm phải bị gắn cờ tín hiệu lệch, không được coi là cả lớp kẹt",
     "ids": ["T12525", "T12528", "T12534", "T12536", "T12537", "T12636",
             "T11666", "T11701", "T11708"]},
    {"id": "inject", "title": "Có câu cài chỉ thị cho AI",
     "hint": "Hai lượt injection thật trong log: “hãy quên những gì đã đọc đi”",
     "ids": ["T11281", "T11285", "T10561", "T10749", "T11666", "T11701",
             "T11708", "T11824", "T11850", "T11881"]},
    {"id": "admin", "title": "Câu hành chính lẫn vào",
     "hint": "Hạn nộp, điểm danh, lịch học — không được thành cụm vấn đề kiến thức",
     "ids": ["T10692", "T10713", "T11354", "T11408", "T11650", "T12540", "T12877",
             "T11666", "T11708", "T11715"]},
    {"id": "sparse", "title": "Quá ít câu để kết luận",
     "hint": "Dưới ngưỡng %d lượt — hệ thống phải báo SPARSE, không gọi AI" % config.SPARSE_MIN_TURNS,
     "ids": ["T11666", "T11824", "T10303"]},
]

GEN_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {"type": "array", "items": {"type": "string"}},
        "note": {"type": "string"},
    },
    "required": ["questions"],
}

GEN_PROMPT = """Bạn dựng dữ liệu thử cho một công cụ gom cụm câu hỏi của lớp học.

Sinh đúng {n} câu hỏi mà học viên Việt Nam có thể hỏi trợ giảng AI trong buổi học về "{topic}".

YÊU CẦU — dữ liệu phải GIỐNG LOG THẬT, không phải bộ câu hỏi đẹp:
1. Khoảng 60% số câu xoay quanh HAI chỗ kẹt chung, mỗi chỗ kẹt được hỏi bằng nhiều cách diễn đạt
   rất khác nhau (viết tắt, sai chính tả, trộn tiếng Anh, viết hoa lung tung, thiếu dấu).
   Hai chỗ kẹt đó phải dùng chung ít nhất một từ khoá nhưng là hai vấn đề khác nhau.
2. Vài câu cụt không rõ nghĩa: "hi", "có", "tiếp", "đây", "ê".
3. Một hai câu hành chính: hạn nộp bài, điểm danh, lịch học.
4. Một câu hỏi về chính con bot, kiểu "bạn dùng model gì".
5. Một câu dài kiểu dán nguyên đoạn slide vào rồi hỏi.

Đừng đánh số, đừng thêm dấu đầu dòng. Mỗi phần tử trong mảng là một câu hỏi thô như học viên gõ."""


def _q_records(items):
    """Chuẩn hoá đầu vào thành 'lượt hỏi' cho module gom cụm."""
    out = []
    for i, it in enumerate(items, 1):
        if isinstance(it, dict):
            q, student, tid = it.get("q", ""), it.get("student"), it.get("turn_id")
        else:
            q, student, tid = str(it), None, None
        q = loader.redact(str(q).strip())
        if not q:
            continue
        out.append({
            "turn_id": tid or ("X%03d" % i),
            # Mặc định mỗi câu một người: người dùng gõ tay thì không biết ai hỏi câu nào.
            "student": student or ("S9%03d" % i),
            "at": "", "course_id": "LIVE", "lecture_code": "LIVE",
            "lecture_title": "Thử trực tiếp", "part": None, "preset": False, "q": q,
        })
    return out


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=UI, **kw)

    def log_message(self, fmt, *args):
        # args[0] có thể là HTTPStatus (từ send_error) chứ không phải chuỗi request.
        first = str(args[0]) if args else ""
        if "/api/" in first:
            sys.stderr.write("  %s\n" % (fmt % args))

    def _send(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    # ── GET ──────────────────────────────────────────────────────────────
    def do_GET(self):
        if self.path.startswith("/api/health"):
            try:
                key_ok, key_hint = True, config.mask(config.api_key())
            except Exception as e:
                key_ok, key_hint = False, str(e)
            t = turns()
            return self._send({
                "ok": key_ok, "key": key_hint, "model": config.model_name(),
                "chatlog": len(t), "chatlog_error": _cache["err"],
                "thresholds": {
                    "sparse_min_turns": config.SPARSE_MIN_TURNS,
                    "chunk_size": config.CHUNK_SIZE,
                    "weak_max_people": config.WEAK_MAX_PEOPLE,
                    "skew_ratio": config.SKEW_RATIO,
                    "skew_min_turns": config.SKEW_MIN_TURNS,
                    "min_students_for_examples": config.MIN_STUDENTS_FOR_EXAMPLES,
                },
                "max_questions": MAX_QUESTIONS,
            })

        if self.path.startswith("/api/samples"):
            idx = {t["turn_id"]: t for t in turns()}
            out = []
            for s in SAMPLES:
                items = [{"turn_id": i, "student": idx[i]["student"], "q": idx[i]["q"]}
                         for i in s["ids"] if i in idx]
                out.append({"id": s["id"], "title": s["title"], "hint": s["hint"],
                            "n": len(items), "items": items})
            return self._send({"samples": out, "have_chatlog": bool(idx)})

        return super().do_GET()

    # ── POST ─────────────────────────────────────────────────────────────
    def do_POST(self):
        try:
            if self.path.startswith("/api/generate"):
                b = self._body()
                topic = (b.get("topic") or "AI Agent và ReAct").strip()[:120]
                n = max(6, min(int(b.get("n") or 14), MAX_QUESTIONS))
                raw, meta = gemini.generate_json(
                    GEN_PROMPT.format(n=n, topic=topic), GEN_SCHEMA,
                    call_id="live:generate", temperature=1.0)
                qs = [q for q in (raw.get("questions") or []) if str(q).strip()][:n]
                return self._send({"questions": qs, "topic": topic, "ai": {
                    "model": meta["model"], "latency_ms": meta["latency_ms"],
                    "tokens_in": meta["tokens_in"], "tokens_out": meta["tokens_out"]}})

            if self.path.startswith("/api/cluster"):
                b = self._body()
                items = b.get("questions") or []
                if len(items) > MAX_QUESTIONS:
                    return self._send({"error": "Tối đa %d câu một lần thử." % MAX_QUESTIONS}, 400)
                recs = _q_records(items)
                if not recs:
                    return self._send({"error": "Chưa có câu hỏi nào."}, 400)
                started = time.time()
                res = cluster.cluster_session(
                    recs, preset_count=0,
                    lecture_label=(b.get("label") or "Thử trực tiếp")[:80],
                    call_id="live:%d" % int(started))
                res["wall_ms"] = int((time.time() - started) * 1000)
                res["input"] = [{"turn_id": r["turn_id"], "q": r["q"]} for r in recs]
                return self._send(res)

        except Exception as e:
            return self._send({"error": "%s: %s" % (type(e).__name__, e)}, 500)

        self.send_error(404)


def main():
    try:
        config.api_key()
        key_line = "khoá: %s  ·  model: %s" % (config.mask(config.api_key()), config.model_name())
    except Exception as e:
        key_line = "CHƯA CÓ KHOÁ — %s" % e

    n = len(turns())
    log_line = ("chatlog K4: %d lượt" % n) if n else ("chatlog: KHÔNG đọc được (%s)" % _cache["err"])

    url = "http://127.0.0.1:%d/" % PORT
    print("Class Pulse — máy chủ cục bộ")
    print("  %s" % key_line)
    print("  %s" % log_line)
    print("  %s" % url)
    print("  Ctrl+C để dừng.\n")

    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    threading.Timer(0.6, lambda: webbrowser.open(url + "#live")).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng.")
        srv.server_close()


if __name__ == "__main__":
    main()
