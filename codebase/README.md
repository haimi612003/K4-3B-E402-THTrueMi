# Class Pulse — mã nguồn

Gom câu hỏi rời rạc của lớp thành **cụm vấn đề** để Lab Coach biết buổi sau ôn lại chỗ nào.
Đây là phần CP3: lời gọi AI thật ở mắt xích quyết định trung tâm, cộng bộ đo trong [`eval/`](../eval).

## Chạy thử trong 3 lệnh

```bash
cp .env.example .env          # rồi điền GEMINI_API_KEY
python codebase/run_cluster.py --list                        # xem có những buổi nào
python codebase/run_cluster.py --course K4P1 --lecture D04 \
       --out codebase/ui/data/session-K4P1-D04.json          # gom cụm thật
python codebase/ui/build_data.py                             # dựng dữ liệu cho dashboard
```

Rồi mở `codebase/ui/index.html` bằng trình duyệt. Không cần server, không cần `pip install` —
module chỉ dùng thư viện chuẩn của Python 3.8+.

## Cấu trúc

| Đường dẫn | Việc |
|---|---|
| `class_pulse/config.py` | Đọc `.env`; giữ mọi **ngưỡng** của hệ thống ở một chỗ |
| `class_pulse/loader.py` | Đọc chatlog, tách theo buổi, loại câu mẫu, bóc tiền tố ngữ cảnh |
| `class_pulse/gemini.py` | **Lời gọi Gemini thật** + ghi vết + thử lại + rơi sang model dự phòng |
| `class_pulse/cluster.py` | **Mắt xích quyết định trung tâm** — gom cụm |
| `run_cluster.py` | CLI: chạy một buổi, in ra màn hình, ghi JSON |
| `serve.py` | Máy chủ cục bộ cho tab "Thử trực tiếp" — giữ khoá API ở phía server |
| `ui/build_data.py` | Gom kết quả + kết quả eval + nhật ký thành `ui/data.js` |
| `ui/index.html` | Dashboard 5 tab |

## Tab "Thử trực tiếp"

`python codebase/serve.py` bật một máy chủ trên `127.0.0.1:8765` (chỉ máy bạn, không ra mạng ngoài)
và mở dashboard. Ở tab đó người dùng nhập câu hỏi — chọn bộ mẫu lấy từ chatlog thật, nhờ AI sinh
theo chủ đề, hoặc tự gõ — rồi bấm một nút để **gọi Gemini thật** và xem cụm trả về trong 1–3 giây.

Vì sao phải có máy chủ chứ không gọi thẳng từ trình duyệt: khoá API sẽ nằm trong mã nguồn trang,
ai mở DevTools cũng lấy được. Máy chủ giữ khoá, trình duyệt chỉ gửi câu hỏi và nhận cụm.

| Đầu API | Việc |
|---|---|
| `GET /api/health` | có khoá chưa, model nào, đọc được chatlog không, các ngưỡng |
| `GET /api/samples` | năm bộ câu hỏi thật, mỗi bộ lộ một hành vi (cụm lớn, tín hiệu lệch, injection, câu hành chính, SPARSE) |
| `POST /api/generate` | nhờ model sinh bộ câu hỏi giả lập theo chủ đề — dùng khi máy không có data pack |
| `POST /api/cluster` | gom cụm thật, trả cụm + cờ + số đo + phần đã phải sửa chữa |

## Bốn chủ đích thiết kế

**1. Model không bao giờ nhìn thấy mã học viên.**
`build_prompt()` chỉ đưa vào `[turn_id]` và câu hỏi. Số người, cờ tín hiệu lệch được tính
**trong code** sau khi model trả về danh sách thành viên cụm. Nhờ vậy "output không lộ mã học viên"
là bảo đảm bằng cấu trúc, không phải bằng cách dặn model đừng làm — và không có prompt injection nào
lấy ra được thứ chưa từng đưa vào.

**2. Mọi con số đếm tay kiểm lại được.**
Model chỉ quyết định *câu nào thuộc cụm nào* và *cụm tên gì*. Số lượt, số người, tên phần bài,
cờ cụm yếu, cờ tín hiệu lệch đều do code tính từ chính danh sách thành viên đó
(`_finalize()` trong `cluster.py`). Ngưỡng nằm trong `config.py`, không do model quyết:

| Ngưỡng | Giá trị | Ý nghĩa |
|---|---|---|
| `SPARSE_MIN_TURNS` | 6 | Dưới ngần này lượt thực thì **không gọi AI**, báo `SPARSE` và hiện câu nguyên văn |
| `CHUNK_SIZE` | 90 | Số lượt tối đa trong một lời gọi |
| `WEAK_MAX_PEOPLE` | 2 | Cụm ≤ ngần này người thì gắn cờ *cụm yếu* |
| `SKEW_RATIO` / `SKEW_MIN_TURNS` | 0,5 / 4 | Một người chiếm ≥ 50% lượt của cụm ≥ 4 lượt thì gắn cờ *tín hiệu lệch* |

**3. Buổi lớn thì chia phần rồi gộp lại.**
Thử nhét cả 511 lượt của buổi `K4P1/D04` vào một prompt: model trả `503 high demand` cả ba lần.
Chia thành từng phần ≤ 90 lượt, gom cụm từng phần, rồi **một lời gọi AI nữa để nối các cụm con
cùng một vấn đề lại** — vừa chạy được vừa tốt hơn, vì prompt quá dài thì model bắt đầu bỏ sót câu
ở giữa danh sách. Bước gộp giữ nguyên luật *thà để riêng còn hơn gộp nhầm*.

**4. Sửa chữa được ghi lại, không giấu.**
Model bịa `turn_id`, xếp một câu vào hai cụm, bỏ quên câu — tất cả bị sửa và ghi vào trường
`repairs` của kết quả. Câu bị bỏ quên luôn được đưa về nhóm rải rác: **không bao giờ mất câu hỏi
của học viên**. Bộ đo báo luôn số case phải sửa, vì đó là tín hiệu chất lượng thật của model.

## Ghi vết

Mỗi lời gọi model ghi một dòng JSON vào `logs/gemini-calls.jsonl`:

```json
{"call_id":"run:K4P1/D04:p1/6","ok":true,"model":"gemini-3.5-flash","latency_ms":38819,
 "usage":{...},"prompt":"<prompt đầy đủ>","raw_response":"<phản hồi thô>"}
```

`logs/` **không** được commit: prompt chứa nguyên văn hàng trăm câu hỏi học viên, mà luật
`data/README.md` §4 cấm đưa data pack lên repo công khai. Dashboard chỉ hiện *metadata* của nhật ký
(model, độ trễ, token, mã lỗi) — đủ để xác minh AI chạy thật mà không lộ nội dung.

Khi chấm trực tiếp, mở file đó ra là thấy prompt và phản hồi thô của từng lời gọi.

## Xử lý khi model quá tải

`gemini-3.6-flash` trả `503` liên tục trong lúc làm bài, nên `gemini.py` có sẵn chuỗi dự phòng:

```python
FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.1-flash-lite"]
```

Thử lại 3 lần mỗi model với backoff tăng dần, chỉ với mã lỗi đáng thử lại (429/500/502/503/504);
lỗi 4xx khác thì dừng ngay vì đổi model cũng vô ích. Mỗi lần rơi sang model dự phòng đều được ghi log
và báo ra kết quả (`ai_call.fell_back`) — con số đo được ra từ model nào thì nói đúng model đó.
