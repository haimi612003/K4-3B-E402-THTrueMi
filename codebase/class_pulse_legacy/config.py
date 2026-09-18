# -*- coding: utf-8 -*-
"""Cấu hình — đọc .env bằng thư viện chuẩn, không cần cài gì thêm."""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ENV_PATH = os.path.join(ROOT, ".env")
LOG_DIR = os.path.join(ROOT, "logs")
DEFAULT_CHATLOG = os.path.join(ROOT, "data", "vlearn-pack", "chatlog", "tutor_turns.csv")

# ── Ngưỡng của hệ thống (deterministic, đếm tay kiểm lại được) ────────────
# Dưới ngưỡng này thì KHÔNG gọi AI gom cụm: tín hiệu quá thưa, báo SPARSE và
# hiện câu nguyên văn. Thà không trả lời còn hơn nặn ra danh sách trông đáng tin.
SPARSE_MIN_TURNS = 6
# Số lượt tối đa nhét vào MỘT lời gọi AI. Buổi lớn hơn bị chia phần rồi gộp lại.
# Lý do có ngưỡng này: thử nhét cả 511 lượt của buổi K4P1/D04 vào một prompt thì
# model trả 503 "high demand" cả ba lần thử. Chia phần vừa chạy được vừa cho kết
# quả tốt hơn — prompt dài thì model bắt đầu bỏ sót câu ở giữa danh sách.
CHUNK_SIZE = 90
# Chu kỳ có ít hơn ngần này học viên thì KHÔNG hiện câu hỏi nguyên văn nữa,
# chỉ còn số đếm và mã dòng log. Ba câu nguyên văn của một buổi chỉ một người hỏi
# không còn là 'mức lớp' — đó là đọc trộm của một người.
MIN_STUDENTS_FOR_EXAMPLES = 3
# Cụm có <= ngần này người thì gắn cờ "cụm yếu".
WEAK_MAX_PEOPLE = 2
# Một người chiếm >= ngần này phần lượt của cụm (và cụm >= SKEW_MIN_TURNS lượt)
# thì gắn cờ "tín hiệu lệch" — không phải cả lớp kẹt, mà một người hỏi đi hỏi lại.
SKEW_RATIO = 0.5
SKEW_MIN_TURNS = 4


def load_env(path=ENV_PATH):
    """Nạp KEY=VALUE từ .env vào os.environ (không ghi đè biến đã có sẵn)."""
    if not os.path.exists(path):
        return {}
    found = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            found[k] = v
            os.environ.setdefault(k, v)
    return found


def api_key():
    load_env()
    k = os.environ.get("GEMINI_API_KEY", "").strip()
    if not k:
        raise RuntimeError(
            "Thiếu GEMINI_API_KEY. Copy .env.example thành .env rồi điền khoá.\n"
            "Lấy khoá tại https://aistudio.google.com/apikey"
        )
    return k


def model_name():
    load_env()
    return os.environ.get("GEMINI_MODEL", "gemini-3.6-flash").strip()


def mask(key):
    """Che khoá khi in ra log/màn hình."""
    return key[:6] + "…" + key[-4:] if len(key) > 12 else "…"
