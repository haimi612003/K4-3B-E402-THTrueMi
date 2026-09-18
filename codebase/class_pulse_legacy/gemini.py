# -*- coding: utf-8 -*-
"""
Lời gọi Gemini THẬT + ghi vết.

Mọi lần gọi đều ghi một dòng JSON vào logs/gemini-calls.jsonl gồm:
prompt gửi đi, phản hồi THÔ của model, usage token, độ trễ, mã lỗi.
Đó là bằng chứng để xác minh AI chạy thật, không gán cứng.

Chỉ dùng thư viện chuẩn (urllib) — không cần pip install.
"""
import json
import os
import time
import urllib.error
import urllib.request

from . import config

ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
LOG_FILE = "gemini-calls.jsonl"

# Model dự phòng khi model chính trả 503 "high demand". Thứ tự này là thứ tự thử.
# Mọi lần rơi sang model dự phòng đều được ghi vào log và báo ra kết quả, không giấu.
FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3-flash-preview"]
RETRYABLE_STATUS = (429, 500, 502, 503, 504)


class GeminiError(RuntimeError):
    pass


def _log(record):
    os.makedirs(config.LOG_DIR, exist_ok=True)
    with open(os.path.join(config.LOG_DIR, LOG_FILE), "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def generate_json(prompt, response_schema, *, call_id, temperature=0.0,
                  model=None, max_retries=3, timeout=180):
    """
    Gọi Gemini, ép trả JSON đúng response_schema, trả về (dict_đã_parse, meta).

    call_id  — nhãn để đối chiếu log với case/buổi nào (ví dụ "eval:C4-01").
    meta     — {model, latency_ms, tokens_in, tokens_out, attempts, raw_text}.
    """
    primary = model or config.model_name()
    chain = [primary] + [m for m in FALLBACK_MODELS if m != primary]
    key = config.api_key()
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "responseMimeType": "application/json",
            "responseSchema": response_schema,
        },
    }
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")

    last_err = None
    total_attempts = 0

    for mdl in chain:
        for attempt in range(1, max_retries + 1):
            total_attempts += 1
            started = time.time()
            try:
                req = urllib.request.Request(
                    ENDPOINT.format(model=mdl), data=payload, method="POST",
                    headers={"Content-Type": "application/json", "x-goog-api-key": key},
                )
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    raw = resp.read().decode("utf-8")
                elapsed = int((time.time() - started) * 1000)
                data = json.loads(raw)

                if "candidates" not in data:
                    raise GeminiError(str(data.get("error", data))[:300])

                text = data["candidates"][0]["content"]["parts"][0]["text"]
                usage = data.get("usageMetadata", {})
                parsed = json.loads(text)

                meta = {
                    "model": mdl,
                    "fell_back": mdl != primary,
                    "latency_ms": elapsed,
                    "tokens_in": usage.get("promptTokenCount"),
                    # candidates + thoughts: model suy luận cũng tính token, bỏ sót
                    # thoughtsTokenCount thì báo cáo chi phí thấp hơn thực tế.
                    "tokens_out": ((usage.get("candidatesTokenCount") or 0)
                                   + (usage.get("thoughtsTokenCount") or 0)) or None,
                    "attempts": total_attempts,
                    "raw_text": text,
                }
                _log({
                    "call_id": call_id, "ok": True, "attempt": total_attempts, "model": mdl,
                    "fell_back": mdl != primary, "latency_ms": elapsed, "usage": usage,
                    "prompt": prompt, "raw_response": text,
                })
                return parsed, meta

            except (urllib.error.HTTPError, urllib.error.URLError, GeminiError,
                    json.JSONDecodeError, KeyError, IndexError) as e:
                elapsed = int((time.time() - started) * 1000)
                code, detail = None, ""
                if isinstance(e, urllib.error.HTTPError):
                    code = e.code
                    try:
                        detail = e.read().decode("utf-8")[:400]
                    except Exception:
                        detail = ""
                last_err = "%s: %s %s" % (type(e).__name__, e, detail)
                _log({
                    "call_id": call_id, "ok": False, "attempt": total_attempts, "model": mdl,
                    "latency_ms": elapsed, "error": last_err,
                    "prompt_chars": len(prompt), "prompt": prompt,
                })
                # Lỗi không phải quá tải (ví dụ schema sai, 400) thì đổi model cũng vô ích.
                if code is not None and code not in RETRYABLE_STATUS:
                    raise GeminiError("Gemini trả %s: %s" % (code, detail[:200]))
                if attempt < max_retries:
                    time.sleep(3 * attempt)

    raise GeminiError(
        "Gọi Gemini thất bại sau %d lần trên %d model (%s). Lỗi cuối: %s"
        % (total_attempts, len(chain), ", ".join(chain), last_err))


def selftest():
    """Chứng minh nhanh là đang gọi model thật, không gán cứng."""
    schema = {
        "type": "object",
        "properties": {"echo": {"type": "string"}, "sum": {"type": "integer"}},
        "required": ["echo", "sum"],
    }
    out, meta = generate_json(
        "Trả JSON: echo = chuỗi 'class-pulse-selftest', sum = 17 + 25.",
        schema, call_id="selftest",
    )
    return out, meta
