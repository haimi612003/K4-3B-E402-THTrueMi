# Chạy eval trên implementation gốc

Các script eval dùng `codebase/class_pulse_legacy/`: bản module trước migration,
trả dictionary, schema JSON cũ và client Gemini urllib. Prompts, quy tắc gom cụm,
retry, fallback và cách ghi log được giữ nguyên. Các kết quả lịch sử không thay đổi.

Gom cụm không cần HTTP server:

```sh
python3 eval/run_eval.py --run 1
```

Eval nội dung ôn gọi HTTP server gốc:

```sh
python3 codebase/serve_eval.py
# Trong terminal khác:
python3 eval/run_eval_answer.py --run 1
python3 eval/run_eval_answer.py --selftest
```

Dừng `codebase/serve.py` trước khi bật `serve_eval.py`: cả hai mặc định dùng cổng
8765. `CLASS_PULSE_PORT` và `CLASS_PULSE_URL` vẫn dùng được để chọn cổng/URL khác.
Không trỏ `CLASS_PULSE_URL` vào backend Pydantic AI nếu muốn đo implementation gốc.

Cần chatlog `data/vlearn-pack/chatlog/tutor_turns.csv` và cấu hình Gemini như trước.
Backend mới vẫn chạy qua `codebase/serve.py`; eval không import backend mới.
