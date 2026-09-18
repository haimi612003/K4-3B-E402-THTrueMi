# Class Pulse — mã nguồn

Gom câu hỏi rời rạc của lớp thành **cụm vấn đề** để Lab Coach biết buổi sau ôn lại chỗ nào.
Đây là phần CP3: lời gọi AI thật ở mắt xích quyết định trung tâm, cộng bộ đo trong [`eval/`](../eval).

## Chuẩn bị và chạy thử

Cần **Python 3.10+**. Cài dependency trong môi trường riêng trước:

```bash
python3 -m venv .venv
source .venv/bin/activate    # Windows PowerShell: .venv\Scripts\Activate.ps1
python -m pip install -r codebase/requirements.txt
```

```bash
cp .env.example .env          # rồi điền GEMINI_API_KEY
python codebase/run_cluster.py --list                        # xem có những buổi nào
python codebase/run_cluster.py --course K4P1 --lecture D04 \
       --out codebase/ui/data/session-K4P1-D04.json          # gom cụm thật
python codebase/ui/build_data.py                             # dựng dữ liệu cho dashboard
```

Rồi bật dashboard:

```bash
python codebase/serve.py          # mở http://127.0.0.1:8765, có đủ 6 tab
```

`serve.py` phục vụ bản React nếu `codebase/web/dist` tồn tại, không thì rơi về bản HTML một file.
Dựng bản React: `cd codebase/web && npm install && npm run build`.

**MUI và Tailwind sống chung cần đủ hai nửa**, thiếu một nửa là utility của Tailwind im lặng không
có tác dụng (không báo lỗi, chỉ là không chạy):
1. `important: "#root"` trong `web/tailwind.config.js` — nâng đặc hiệu của utility Tailwind.
2. `<StyledEngineProvider injectFirst>` trong `web/src/main.jsx` — đẩy style Emotion của MUI lên
   trước thẻ `<style>` của Tailwind trong `<head>`.

Kèm `corePlugins.preflight: false`, vì preflight reset lại baseline mà `CssBaseline` của MUI đã đặt.

Đặt `CLASS_PULSE_PASSCODE` trong `.env` thì trang hỏi mã trước khi cho xem bất cứ dữ liệu nào —
xem *Đăng nhập* bên dưới. Bỏ trống thì chạy mở.

Hoặc mở thẳng `codebase/ui/index.html` bằng trình duyệt — năm tab đầu chạy bình thường, riêng
ba tính năng gọi AI (tab *Thử trực tiếp*, nút *Soạn nội dung ôn*, nút *Xuất hỏi đáp*) cần máy chủ.
Backend dùng Pydantic v2, Pydantic AI, FastAPI và Uvicorn. Chỉ cài extras `google,ag-ui` của
`pydantic-ai-slim`; không cài bản `pydantic-ai` đầy đủ.

## Cấu trúc

| Đường dẫn | Việc |
|---|---|
| `class_pulse/config.py` | Đọc `.env`; giữ mọi **ngưỡng** của hệ thống ở một chỗ |
| `class_pulse/loader.py` | Đọc chatlog, tách theo buổi, loại câu mẫu, bóc tiền tố ngữ cảnh |
| `class_pulse/gemini.py` | Client Gemini gốc dùng urllib, giữ API `generate_json(prompt, response_schema, ...)` cho eval |
| `class_pulse/pydantic_ai_client.py` | Client Pydantic AI cho backend/AG-UI và clustering hiện tại, native structured output, ghi vết, thử lại, model dự phòng |
| `class_pulse/models.py` | Pydantic models cho lượt hỏi, kết quả, schema AI và HTTP |
| `class_pulse/service.py` | Luồng async dùng chung cho JSON và AG-UI |
| `class_pulse/ag_ui.py` | AG-UI SSE, tiến độ và huỷ khi client ngắt kết nối |
| `class_pulse/cluster.py` | **Mắt xích quyết định trung tâm** — gom cụm |
| `run_cluster.py` | CLI: chạy một buổi, in ra màn hình, ghi JSON |
| `serve.py` | FastAPI + Uvicorn, JSON API và AG-UI — giữ khoá API ở server |
| `ui/build_data.py` | Gom kết quả + kết quả eval + nhật ký thành `ui/data.js` |
| `ui/index.html` | Dashboard 6 tab, **bản dự phòng** một file HTML thuần — không cần Node |
| `web/` | Dashboard 6 tab, **bản chính**: Vite + React + MUI + Tailwind |
| `web/src/tabs/*.jsx` | Một file cho mỗi tab |
| `web/src/ui/Charts.jsx` | Biểu đồ vẽ tay bằng SVG, mang theo luật dataviz |
| `web/src/lib/api.js` | Gọi `/api/*`; trình duyệt **không bao giờ** cầm khoá Gemini |

## Tab "Thử trực tiếp"

`python codebase/serve.py` bật một máy chủ trên `127.0.0.1:8765` (chỉ máy bạn, không ra mạng ngoài)
và mở dashboard. Ở tab đó người dùng nhập câu hỏi — chọn bộ mẫu lấy từ chatlog thật, nhờ AI sinh
theo chủ đề, hoặc tự gõ — rồi bấm một nút để **gọi Gemini thật** và xem cụm trả về trong 1–3 giây.

Vì sao phải có máy chủ chứ không gọi thẳng từ trình duyệt: khoá API sẽ nằm trong mã nguồn trang,
ai mở DevTools cũng lấy được. Máy chủ giữ khoá, trình duyệt chỉ gửi câu hỏi và nhận cụm.

| Đầu API | Việc |
|---|---|
| `GET /api/session` | có đặt mã không, phiên hiện tại đã đăng nhập chưa — đầu duy nhất trả lời khi chưa đăng nhập |
| `POST /api/login` / `POST /api/logout` | mở và huỷ phiên |
| `GET /api/health` | có khoá chưa, model nào, đọc được chatlog không, các ngưỡng |
| `GET /api/samples` | năm bộ câu hỏi thật, mỗi bộ lộ một hành vi (cụm lớn, tín hiệu lệch, injection, câu hành chính, SPARSE) |
| `POST /api/generate` | nhờ model sinh bộ câu hỏi giả lập theo chủ đề — dùng khi máy không có data pack |
| `POST /api/cluster` | gom cụm thật, trả cụm + cờ + số đo + phần đã phải sửa chữa |
| `POST /api/answer` | soạn nội dung ôn cho một cụm: nhận `turn_ids` rồi tra ngược cả cụm trong chatlog, không chỉ dựa vào vài ví dụ |
| `POST /api/ag-ui/{operation}` | Stream AG-UI cho `cluster`, `generate`, `answer`, `faq`; xem [hợp đồng](AG-UI.md) |
| `POST /api/faq` | soạn một mục hỏi đáp cho **học viên khoá sau**, hoặc **từ chối** nếu cụm không phải câu hỏi kiến thức (`publishable: false` kèm lý do) |

Nội dung ôn là **quyết định AI thứ hai** của sản phẩm, tách hẳn khỏi việc gom cụm. Nó chỉ chạy khi
Lab Coach bấm, luôn được gắn nhãn *bản nháp*, và prompt buộc model đi một đường khác slide — vì học
viên đã đọc slide rồi mà vẫn hỏi, nên nhắc lại cách cũ là vô ích.

## Đăng nhập

Máy chủ này phục vụ câu hỏi thật của học viên, nên nó không mở toang cho bất kỳ ai gõ trúng cổng.
Đặt `CLASS_PULSE_PASSCODE` trong `.env` là bật cổng đăng nhập:

- Chỉ `/`, `/index.html`, `/api/login`, `/api/session` đi qua khi chưa đăng nhập. **`data.js` và mọi
  `/api/*` khác trả `401`** — chặn ở tầng máy chủ, không phải chỉ ẩn giao diện.
- Phiên là token `secrets.token_urlsafe(32)` trong cookie `HttpOnly; SameSite=Strict`, giữ trong bộ nhớ
  tiến trình nên tắt máy chủ là mất hết phiên.
- So mã bằng `secrets.compare_digest`; sai 8 lần trong 5 phút thì IP đó bị khoá tạm.

**Phạm vi bảo vệ, nói thẳng:** đủ chặn người khác trên cùng máy hoặc cùng LAN, đúng mức rủi ro của một
công cụ chạy cục bộ. **Không** phải tài khoản thật, không phân quyền theo lớp, không nhật ký truy cập —
mang lên máy chủ chung thì phải làm lại ba thứ đó chứ không nới cái mã dùng chung này ra.

## Xuất hỏi đáp ra file Word

`faqDoc()` trong `ui/index.html` dựng HTML mang namespace Word (`urn:schemas-microsoft-com:office:word`)
kèm khối `<!--[if gte mso 9]>` và BOM UTF-8, rồi tải xuống với đuôi `.doc` và kiểu MIME
`application/msword`. Word, Google Docs và WPS đều mở được, giữ tiêu đề, cỡ chữ, đường kẻ, khổ A4 —
không cần thư viện ngoài nào. Chữ do model sinh ra đều đi qua `esc()` trước khi vào file, và phần
ghi chú các cụm bị từ chối bị lọc `<`, `>`, `--` để không phá cấu trúc HTML comment.

## Bốn chủ đích thiết kế

**1. Model không bao giờ nhìn thấy mã học viên.**
`build_prompt()` chỉ đưa vào số thứ tự `[1..n]` và câu hỏi. Số người, cờ tín hiệu lệch được tính
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

**2b. Model chép SỐ THỨ TỰ, không chép mã dài.**
Lượt đo 1 cho thấy model chép hỏng `turn_id`: trả `T1085` thay cho `T11085`, `T12626` thay cho
`T12826`. Ba case trượt vì lỗi cơ học đó chứ không phải vì gom sai. Prompt giờ đánh số `1..n` và
code ánh xạ ngược — số ngoài khoảng `1..n` bị phát hiện ngay là bịa. Lượt đo 2 có 0 mã bịa.

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

`gemini-3.6-flash` trả `503` liên tục trong lúc làm bài (và `gemini-2.5-flash` đã bị gỡ khỏi API),
nên cả `gemini.py` và `pydantic_ai_client.py` có sẵn chuỗi dự phòng:

```python
FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3-flash-preview"]
```

Thử lại 3 lần mỗi model với backoff tăng dần, chỉ với mã lỗi đáng thử lại (429/500/502/503/504);
lỗi 4xx khác thì dừng ngay vì đổi model cũng vô ích. Mỗi lần rơi sang model dự phòng đều được ghi log
và báo ra kết quả (`ai_call.fell_back`) — con số đo được ra từ model nào thì nói đúng model đó.

## Kiểm backend

```bash
python -m unittest discover -s codebase -p test_backend.py -v
python codebase/test_serve.py
python eval/run_eval_answer.py --selftest
```

Bộ kiểm đầu dùng model thử và Google transport giả lập, không gọi API thật. Bộ kiểm thứ hai
bật Uvicorn trên localhost và kiểm HTTP/SSE thật. Golden set đầy đủ cần data pack bên ngoài repo.
Frontend hiện tại tiếp tục dùng JSON; AG-UI được chuẩn bị cho phiên bản frontend mới.
