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
import collections
import json
import os
import secrets
import sys
import threading
import time
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# Giao diện: ưu tiên bản React đã build (codebase/web/dist), rơi về bản HTML một file
# (codebase/ui) khi chưa chạy `npm run build`. Nhờ vậy người chấm không có Node
# vẫn mở được sản phẩm, và nhóm không phải commit thư mục dist.
_DIST = os.path.join(HERE, "web", "dist")
UI = _DIST if os.path.isfile(os.path.join(_DIST, "index.html")) else os.path.join(HERE, "ui")
sys.path.insert(0, HERE)

from class_pulse import cluster, config, gemini, loader  # noqa: E402
from class_pulse.console import use_utf8  # noqa: E402

use_utf8()

PORT = int(os.environ.get("CLASS_PULSE_PORT", "8765"))
MAX_QUESTIONS = 60          # trần cho một lần thử, đủ để thấy hành vi mà không đốt token

# ── Đăng nhập ────────────────────────────────────────────────────────────
# Phạm vi bảo vệ, nói thẳng để không ai hiểu nhầm là đã có bảo mật thật:
#   CÓ chặn: người khác trên cùng máy hoặc cùng mạng mở trình duyệt vào cổng này,
#            và mọi API gọi model (tốn tiền) lẫn data.js (chứa câu hỏi học viên).
#   KHÔNG chặn: ai có quyền đọc ổ đĩa. Mở thẳng file index.html bằng file:// thì
#            không qua máy chủ nên không qua đăng nhập — đó là giới hạn của kiến
#            trúc chạy cục bộ, không phải lỗ hổng giấu đi.
# Khi đem lên máy chủ thật thì thay bằng tài khoản thật của VLearn.
SESSION_COOKIE = "cp_session"
SESSIONS = set()
LOGIN_FAILS = collections.defaultdict(list)   # ip -> các mốc thời gian gõ sai
LOCK_AFTER = 8                                # sai quá ngần này lần thì khoá
LOCK_WINDOW = 300                             # trong ngần này giây


def passcode():
    config.load_env()
    return os.environ.get("CLASS_PULSE_PASSCODE", "").strip()


def new_session():
    t = secrets.token_urlsafe(32)
    SESSIONS.add(t)
    return t


def rate_limited(ip):
    now = time.time()
    hits = [t for t in LOGIN_FAILS[ip] if now - t < LOCK_WINDOW]
    LOGIN_FAILS[ip] = hits
    return len(hits) >= LOCK_AFTER

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
     "hint": "Dưới ngưỡng %d lượt — hệ thống phải báo quá ít câu để kết luận, không gọi AI" % config.SPARSE_MIN_TURNS,
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

# ── Soạn nội dung ôn cho một cụm ─────────────────────────────────────────
ANSWER_SCHEMA = {
    "type": "object",
    "properties": {
        "misread": {"type": "string",
                    "description": "Học viên đang hiểu sai ở chỗ nào, suy từ chính chữ họ viết"},
        "different": {"type": "string",
                      "description": "Giảng lại theo đường KHÁC slide: đổi thứ tự, đổi chất liệu, hoặc đổi câu hỏi mở đầu"},
        "example": {"type": "string", "description": "Một ví dụ cụ thể, có con số hoặc tình huống"},
        "check": {"type": "string", "description": "Một câu kiểm tra phân biệt được hiểu thật với thuộc lòng"},
        "minutes": {"type": "integer", "description": "Ước lượng số phút cần trên lớp"},
        "confidence": {"type": "string", "description": "cao | vừa | thấp"},
        "caveat": {"type": "string", "description": "Chỗ nào Lab Coach phải tự kiểm lại trước khi dùng"},
    },
    "required": ["misread", "different", "example", "check", "confidence", "caveat"],
}

ANSWER_PROMPT = """Bạn soạn VẬT LIỆU ÔN TẬP cho một giảng viên (Lab Coach), dựa trên một cụm câu hỏi
mà nhiều học viên trong lớp cùng vướng. Người đọc là người có chuyên môn, không phải người học.

BUỔI HỌC: {lecture}
CỤM VẤN ĐỀ: {name}
{why}

{n} CÂU HỎI NGUYÊN VĂN CỦA HỌC VIÊN — {people} người khác nhau:
{questions}

LUẬT BẮT BUỘC:

1. HỌC VIÊN ĐÃ ĐỌC SLIDE RỒI MÀ VẪN HỎI. Nghĩa là cách trình bày cũ không ăn với họ. Phần "giảng lại"
   phải đi một đường KHÁC: đổi thứ tự (đưa ví dụ/dữ liệu trước, khái niệm sau), đổi chất liệu (bảng số
   thật thay cho định nghĩa), hoặc mở đầu bằng một câu hỏi khiến họ tự thấy chỗ hổng. Nếu chỉ diễn đạt
   lại cùng một cách thì phần này vô dụng và Lab Coach sẽ bỏ đi.

2. CHẨN ĐOÁN TỪ CHÍNH CHỮ HỌC VIÊN VIẾT. Phần "hiểu sai ở đâu" phải chỉ được ra chỗ hổng nằm trong câu
   nào. Không viết chẩn đoán chung chung áp cho mọi lớp.

3. VÍ DỤ PHẢI CỤ THỂ — có con số, có tình huống, có thể nói ra miệng trong 30 giây.
   Không viết kiểu "ví dụ như trong thực tế thì...".

4. CÂU KIỂM TRA PHẢI PHÂN BIỆT HIỂU THẬT VỚI THUỘC LÒNG. Câu mà học viên chép lại định nghĩa là trả
   lời được thì không đạt.

5. KHÔNG CHẮC THÌ NÓI KHÔNG CHẮC. Nếu các câu hỏi quá mơ hồ hoặc quá tản mạn để chẩn đoán, đặt
   confidence = "thấp" và ghi rõ vào caveat chỗ nào Lab Coach phải tự kiểm.

6. ĐÂY LÀ BẢN NHÁP, KHÔNG PHẢI CHỈ THỊ. Lab Coach là người quyết định cuối cùng dạy gì. Đừng viết kiểu
   ra lệnh ("hãy giảng…", "bạn nên…"). Viết kiểu đưa vật liệu để họ chọn dùng hay bỏ.

7. KHÔNG NHẮC TỚI HỌC VIÊN CỤ THỂ NÀO. Chỉ nói ở mức lớp.

8. CAVEAT PHẢI NÓI ĐIỀU QUAN TRỌNG NHẤT TRƯỚC. Hai chuyện dưới đây, nếu có, phải là câu ĐẦU TIÊN
   của caveat — trước mọi ghi chú về slide hay thuật ngữ:
   a) TÍN HIỆU MỎNG: dưới 4 câu hỏi, hoặc các câu quá cụt/mơ hồ để chẩn đoán. Nói thẳng là chưa đủ
      căn cứ và bản nháp này dựa trên rất ít dữ liệu. Lab Coach phải biết bản nào đáng tin tới đâu.
   b) KHÔNG PHẢI CHỖ KẸT KIẾN THỨC: cụm gồm câu hành chính (hạn nộp, điểm danh, lịch học, quy chế),
      câu hỏi về chính con bot, hoặc câu lạc đề. Nói thẳng đây không phải vấn đề của bài học và
      nên chuyển sang kênh khác, đừng để Lab Coach mang 15 phút đầu buổi đi trả lời nó.
   Trong cả hai trường hợp vẫn trả đủ năm phần, nhưng caveat phải cảnh báo trước.

Trả JSON đúng schema. Viết tiếng Việt, gọn, không sáo rỗng."""

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


FAQ_SCHEMA = {
    "type": "object",
    "properties": {
        "publishable": {"type": "boolean",
                        "description": "false nếu cụm này không phải câu hỏi kiến thức của bài học"},
        "refuse_reason": {"type": "string", "description": "nếu publishable=false thì vì sao"},
        "question": {"type": "string", "description": "Câu hỏi chuẩn hoá, viết như học viên sẽ gõ vào ô tìm"},
        "answer": {"type": "string", "description": "Câu trả lời cho HỌC VIÊN đọc một mình, không có giảng viên bên cạnh"},
        "variants": {"type": "array", "items": {"type": "string"},
                     "description": "Các cách hỏi khác của chính học viên, để tìm kiếm khớp được"},
        "needs_review": {"type": "string", "description": "Chỗ Lab Coach phải kiểm trước khi đăng"},
        "confidence": {"type": "string", "description": "cao | vừa | thấp"},
    },
    "required": ["publishable", "question", "answer", "variants", "needs_review", "confidence"],
}

FAQ_PROMPT = """Bạn soạn một mục HỎI ĐÁP để đăng lên trang học, cho HỌC VIÊN KHOÁ SAU đọc.

Đây là người đọc khác hẳn với giảng viên: họ đọc MỘT MÌNH, không có ai giảng bên cạnh, và họ tới đây
vì vừa gõ một câu hỏi vào ô tìm kiếm. Câu trả lời phải tự đứng được.

BUỔI HỌC: {lecture}
CỤM VẤN ĐỀ: {name}
{n} CÂU HỎI NGUYÊN VĂN, {people} học viên khoá trước đã hỏi:
{questions}

LUẬT BẮT BUỘC:

1. TỪ CHỐI KHI KHÔNG PHẢI CÂU HỎI KIẾN THỨC. Nếu cụm này là câu hành chính (hạn nộp, điểm danh,
   lịch học, quy chế), câu hỏi về chính con bot, câu chào hỏi, hay câu quá cụt để biết người ta hỏi gì
   — đặt publishable = false, ghi lý do vào refuse_reason, và ĐỪNG soạn câu trả lời. Đăng một mục hỏi đáp
   về hạn nộp bài lên trang học là sai chỗ, và hạn nộp thì mỗi khoá một khác nên nó còn thành sai thông tin.

2. CÂU HỎI PHẢI VIẾT NHƯ HỌC VIÊN GÕ, không phải như mục lục sách. Lấy đúng cách nói của họ trong các
   câu nguyên văn phía trên. "Chatbot và Agent khác nhau chỗ nào?" chứ không phải "Phân tích sự khác biệt
   giữa kiến trúc hội thoại và kiến trúc tác tử".

3. CÂU TRẢ LỜI PHẢI TỰ ĐỨNG ĐƯỢC. Không viết "hỏi giảng viên", "xem lại slide", "tham khảo tài liệu" —
   người đọc đang ở đây chính vì slide chưa giúp được họ. Trả lời thẳng, có ví dụ cụ thể, dài vừa phải
   để đọc hết trong một phút.

4. CHỈ NÓI ĐIỀU BẠN CHẮC. Không bịa con số, không bịa tên tài liệu, không bịa quy định của khoá.
   Chỗ nào cần giảng viên xác nhận thì ghi vào needs_review chứ đừng viết bừa vào câu trả lời.

5. VARIANTS LẤY TỪ CHÍNH CÂU HỌC VIÊN ĐÃ HỎI. Đây là để học viên khoá sau gõ kiểu gì cũng tìm ra mục này —
   kể cả khi họ gõ tắt, sai chính tả, hay trộn tiếng Anh. Giữ nguyên cách họ viết, đừng sửa lại cho đẹp.

6. KHÔNG NHẮC TỚI HỌC VIÊN CỤ THỂ NÀO, không nhắc tới lớp nào, không nhắc tới buổi nào cụ thể —
   mục này sẽ sống lâu hơn khoá học hiện tại.

Trả JSON đúng schema. Viết tiếng Việt."""


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

    # ── đăng nhập ────────────────────────────────────────────────────────
    def _token(self):
        for part in (self.headers.get("Cookie") or "").split(";"):
            k, _, v = part.strip().partition("=")
            if k == SESSION_COOKIE:
                return v
        return None

    def _authed(self):
        if not passcode():          # chưa đặt mã thì chạy mở, và nói rõ ở màn hình
            return True
        t = self._token()
        return bool(t) and t in SESSIONS

    def _deny(self):
        self._send({"error": "Chưa đăng nhập.", "need_login": True}, 401)

    def _needs_auth(self, path):
        """Cho qua: trang đăng nhập và chính lời gọi đăng nhập. Còn lại phải có phiên."""
        p = path.split("?")[0]
        return p not in ("/", "/index.html", "/api/login", "/api/session")

    # ── GET ──────────────────────────────────────────────────────────────
    def do_GET(self):
        if self.path.startswith("/api/session"):
            return self._send({"need_passcode": bool(passcode()), "authed": self._authed()})

        if self._needs_auth(self.path) and not self._authed():
            if self.path.startswith("/api/"):
                return self._deny()
            self.send_response(401)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write("Chua dang nhap.".encode("utf-8"))
            return

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
            if self.path.startswith("/api/login"):
                ip = self.client_address[0]
                if rate_limited(ip):
                    return self._send({"error": "Gõ sai quá nhiều lần. Đợi 5 phút rồi thử lại."}, 429)
                given = str((self._body() or {}).get("passcode", ""))
                if not passcode():
                    return self._send({"ok": True, "note": "Máy chủ chưa đặt mã, đang chạy mở."})
                # so sánh theo thời gian hằng định để không lộ độ dài mã
                if not secrets.compare_digest(given, passcode()):
                    LOGIN_FAILS[ip].append(time.time())
                    left = max(0, LOCK_AFTER - len(LOGIN_FAILS[ip]))
                    return self._send({"error": "Mã không đúng. Còn %d lần thử." % left}, 403)
                LOGIN_FAILS.pop(ip, None)
                tok = new_session()
                body = json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Set-Cookie",
                                 "%s=%s; Path=/; HttpOnly; SameSite=Strict" % (SESSION_COOKIE, tok))
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            if self.path.startswith("/api/logout"):
                t = self._token()
                if t:
                    SESSIONS.discard(t)
                return self._send({"ok": True})

            if self._needs_auth(self.path) and not self._authed():
                return self._deny()

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

            if self.path.startswith("/api/faq"):
                b = self._body()
                qs, ids = [], b.get("turn_ids") or []
                if ids:
                    idx = {t["turn_id"]: t for t in turns()}
                    qs = [idx[i]["q"] for i in ids if i in idx][:24]
                if not qs:
                    qs = [loader.redact(str(q).strip()) for q in (b.get("questions") or []) if str(q).strip()][:24]
                if not qs:
                    return self._send({"error": "Cụm này không có câu hỏi nào."}, 400)
                raw, meta = gemini.generate_json(
                    FAQ_PROMPT.format(
                        lecture=(b.get("lecture") or "buổi này")[:120],
                        name=(b.get("name") or "").strip()[:200],
                        n=len(qs), people=b.get("people") or "?",
                        questions="\n".join("- " + q[:300] for q in qs)),
                    FAQ_SCHEMA, call_id="live:faq", temperature=0.3)
                raw["ai"] = {"model": meta["model"], "latency_ms": meta["latency_ms"],
                             "tokens_in": meta["tokens_in"], "tokens_out": meta["tokens_out"]}
                raw["cluster"] = b.get("name")
                raw["people"] = b.get("people")
                raw["turns"] = len(qs)
                return self._send(raw)

            if self.path.startswith("/api/answer"):
                b = self._body()
                # Ưu tiên tra ngược từ turn_id: cụm 50 câu thì soạn trên cả 50 câu,
                # chứ không chỉ trên 3 ví dụ mà giao diện đang hiện.
                qs = []
                ids = b.get("turn_ids") or []
                if ids:
                    idx = {t["turn_id"]: t for t in turns()}
                    qs = [idx[i]["q"] for i in ids if i in idx][:24]
                if not qs:
                    qs = [loader.redact(str(q).strip()) for q in (b.get("questions") or []) if str(q).strip()][:24]
                if not qs:
                    return self._send({"error": "Cụm này không có câu hỏi nào để soạn."}, 400)
                name = (b.get("name") or "Cụm chưa đặt tên").strip()[:200]
                raw, meta = gemini.generate_json(
                    ANSWER_PROMPT.format(
                        lecture=(b.get("lecture") or "buổi này")[:120],
                        name=name,
                        why=("Ghi chú khi gom cụm: " + b["why"][:300]) if b.get("why") else "",
                        n=len(qs), people=b.get("people") or "?",
                        questions="\n".join("- " + q[:300] for q in qs)),
                    ANSWER_SCHEMA, call_id="live:answer", temperature=0.4)
                raw["ai"] = {"model": meta["model"], "latency_ms": meta["latency_ms"],
                             "tokens_in": meta["tokens_in"], "tokens_out": meta["tokens_out"]}
                raw["cluster"] = name
                return self._send(raw)

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
    if passcode():
        auth_line = "đăng nhập: BẬT (mã lấy từ CLASS_PULSE_PASSCODE trong .env)"
    else:
        auth_line = ("đăng nhập: TẮT — đặt CLASS_PULSE_PASSCODE trong .env để bật.\n"
                     "  Không có mã thì ai vào được cổng này cũng đọc được câu hỏi học viên.")

    url = "http://127.0.0.1:%d/" % PORT
    print("Class Pulse — máy chủ cục bộ")
    print("  %s" % key_line)
    print("  %s" % log_line)
    print("  %s" % auth_line)
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
