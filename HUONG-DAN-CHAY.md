# Hướng dẫn chạy Class Pulse

Không cần cài gì ngoài **Python 3.8+**. Module chỉ dùng thư viện chuẩn (`csv`, `json`, `urllib`) —
`pip install` không cần chạy.

---

## 1. Chuẩn bị — làm một lần

### 1.1 Khoá API

```bash
cp .env.example .env
```

Mở `.env`, điền khoá lấy từ https://aistudio.google.com/apikey:

```
GEMINI_API_KEY=<khoá của bạn>
GEMINI_MODEL=gemini-3.5-flash-lite
```

`.env` đã nằm trong `.gitignore` — không bao giờ bị commit. Kiểm lại cho chắc:

```bash
git check-ignore -v .env        # phải in ra dòng .gitignore khớp
```

### 1.2 Data pack

Data pack của khoá **không nằm trong repo** (luật `data/README.md` §4: không commit pack vào repo nộp bài).
Chép thư mục `data/` của khoá vào gốc repo, để thành:

```
K4-3B-E402-THTrueMi/
└── data/vlearn-pack/chatlog/tutor_turns.csv
```

`data/` cũng đã bị `.gitignore` chặn.

Kiểm tra đọc được chưa:

```bash
python codebase/run_cluster.py --list
```

Phải ra bảng các buổi học, ví dụ:

```
course_id     lec    tên buổi                       tổng câu mẫu   thực    HV
K4P1          D01    Day01                           643      54    589   139
K4P1          D04    DAY03                           630     119    511   155
...
```

Nếu báo lỗi không tìm thấy file, trỏ thẳng đường dẫn: `--chatlog <đường dẫn tới tutor_turns.csv>`.

---

## 2. Chạy gom cụm cho một buổi

```bash
python codebase/run_cluster.py --course K4P1 --lecture D04 \
       --out codebase/ui/data/session-K4P1-D04.json
```

Nó sẽ in ra ngay trên màn hình: mỗi cụm kèm số lượt, số người, phần bài, và **câu hỏi nguyên văn có ID**.
Buổi 511 lượt được chia thành 6 phần (90 lượt/lời gọi) cộng 1 lời gọi gộp cụm — mất khoảng 3–5 phút.

Tham số hay dùng:

| Cờ | Việc |
|---|---|
| `--limit 40` | Chỉ lấy 40 lượt đầu — chạy thử cho nhanh, đỡ tốn token |
| `--days 2026-09-12,2026-09-13` | Giới hạn chu kỳ theo ngày |
| `--out <file>` | Ghi kết quả ra JSON cho dashboard đọc |
| `--list` | Xem có những buổi nào |

**Ba buổi nên dựng sẵn cho demo** — mỗi buổi cho thấy một trạng thái khác nhau:

```bash
# buổi đông nhất — luồng chính
python codebase/run_cluster.py --course K4P1 --lecture D04 --out codebase/ui/data/session-K4P1-D04.json

# buổi có một học viên chiếm 58/453 lượt — cờ "tín hiệu lệch"
python codebase/run_cluster.py --course K4P1 --lecture D08 --out codebase/ui/data/session-K4P1-D08.json

# buổi chỉ 3 lượt thật — trạng thái SPARSE, hệ thống KHÔNG gọi AI và KHÔNG gom cụm
python codebase/run_cluster.py --course K4P1 --lecture D10 --out codebase/ui/data/session-K4P1-D10.json
```

---

## 3. Chạy bộ kiểm thử

```bash
python eval/run_eval.py --run 1        # chạy cả 24 case
python eval/report.py                  # sinh eval/README.md từ kết quả
```

Kết quả ghi vào `eval/results-run1.json`, báo cáo ghi vào `eval/README.md`.
Mất khoảng 8–12 phút (mỗi case một lời gọi AI).

Chạy vài case thôi:

```bash
python eval/run_eval.py --run 1 --only C1-01 C4-02
```

Sau khi sửa prompt hoặc đổi model, chạy lượt đo mới để so sánh — **đừng ghi đè lượt cũ**:

```bash
python eval/run_eval.py --run 2 --note "sửa gì so với lượt trước"
```

### 3b · Bộ đo cho "Soạn nội dung ôn"

Quyết định AI thứ hai có bộ đo riêng. Nó **cần máy chủ đang chạy** vì gọi qua `/api/answer`:

```bash
python codebase/serve.py            # cửa sổ 1
python eval/run_eval_answer.py --run 1     # cửa sổ 2
```

Bộ này chỉ đo **tính kỷ luật** của output, không đo đúng-sai kiến thức — lý do ghi ở `spec.md` §7.

Kiểm ngược bộ đo (không gọi model, chạy trong một giây):

```bash
python eval/run_eval_answer.py --selftest
```

Nó cho 11 output cố tình hỏng chạy qua bộ chấm và xác nhận từng assertion vẫn bắt được lỗi.
Cần cái này vì nới thước đo rồi báo điểm cao là chuyện quá dễ.

---

## 4. Dựng và mở dashboard

```bash
python codebase/ui/build_data.py
```

Nó gom kết quả gom cụm + kết quả eval + nhật ký gọi model thành `codebase/ui/data.js`.

**Cách chạy được khuyên dùng — có đủ 5 tab, kể cả tab gọi AI thật:**

```bash
python codebase/serve.py
```

Trang tự mở ở `http://127.0.0.1:8765`. Máy chủ chỉ lắng nghe trên máy bạn, không mở ra mạng ngoài.

**Cách nhẹ hơn, không cần máy chủ:** mở thẳng `codebase/ui/index.html` bằng trình duyệt
(`start codebase/ui/index.html` trên Windows). Bốn tab đầu chạy bình thường; riêng tab
**Thử trực tiếp** cần máy chủ vì nó gọi Gemini thật — khoá API phải ở phía server chứ không
nhúng vào trang web.

Dashboard có 5 tab:

| Tab | Nội dung |
|---|---|
| **Tổng quan** | Số dẫn đầu, dải chỉ số, biểu đồ cụm theo lượt/người, thành phần lượt hỏi, phân bố lượt/học viên. Hàng chip phía trên lọc nhanh: tất cả / đông nhất / cụm mạnh / cụm yếu / tín hiệu lệch |
| **Cụm vấn đề** | Danh sách cụm, mở ra đọc câu nguyên văn có ID, tick chọn cụm, bấm "Không thuộc cụm" để sửa tay (lưu lại giữa các lần mở trang), và **"✨ Soạn nội dung ôn"** để AI soạn vật liệu giảng lại — xem mục 4c |
| **Chất lượng** | Kết quả bộ kiểm thử: tỉ lệ đạt, đạt theo từng lớp chỗ khó, nhóm lỗi, từng case |
| **Nhật ký AI** | Bằng chứng AI chạy thật: model, số lời gọi, token, độ trễ, số lần model bịa mã / bỏ sót câu |
| **Thử trực tiếp** | **Gọi AI thật ngay trên trang.** Xem mục 4b |

### 4b · Tab "Thử trực tiếp" — thao tác thật với model

Ba cách lấy dữ liệu vào, chọn một:

1. **Bộ mẫu có thật** — lấy thẳng từ chatlog K4. Năm bộ, mỗi bộ dựng để lộ một hành vi:
   cụm lớn nhất buổi · một người hỏi dồn dập (cờ tín hiệu lệch) · câu cài chỉ thị cho AI ·
   câu hành chính lẫn vào · quá ít câu để kết luận (`SPARSE`).
2. **Nhờ AI sinh** — gõ một chủ đề, model sinh ra bộ câu hỏi giả lập giống log thật
   (hai chỗ kẹt chung từ khoá, cộng câu cụt, câu hành chính, câu hỏi về chính con bot).
   Dùng khi máy không có data pack.
3. **Tự gõ** — dán câu hỏi của lớp bạn, mỗi dòng một câu.

Bấm **Gom cụm bằng AI** → câu hỏi được gửi lên máy chủ cục bộ → máy chủ gọi Gemini →
kết quả thật hiện bên phải trong 1–3 giây, kèm số cụm, cờ, câu nguyên văn có ID, token,
độ trễ, và bảng "hệ thống đã phải sửa gì".

**Mở thẳng một kịch bản bằng URL** (tiện khi demo, khỏi phải bấm):

```
http://127.0.0.1:8765/?sample=skew&run=1#live
```

`sample` nhận: `agent` · `skew` · `inject` · `admin` · `sparse`. Thêm `run=1` để chạy luôn.

### 4c · "Soạn nội dung ôn" — AI trả lời hộ, Lab Coach khỏi phải nhớ

Mỗi cụm có nút **✨ Soạn nội dung ôn**. Bấm là AI đọc **toàn bộ câu hỏi trong cụm** (không phải chỉ
2–3 ví dụ đang hiện) rồi soạn ra năm phần:

| Phần | Nội dung |
|---|---|
| **Học viên đang hiểu sai ở đâu** | Chẩn đoán suy từ chính chữ học viên viết, chỉ được ra chỗ hổng nằm ở câu nào |
| **Giảng lại theo cách KHÁC slide** | Phần quan trọng nhất. Học viên đã đọc slide rồi mà vẫn hỏi, nên lặp lại cách cũ là vô ích — AI bị buộc đổi thứ tự, đổi chất liệu, hoặc đổi câu hỏi mở đầu |
| **Ví dụ cụ thể** | Có con số, có tình huống, nói ra miệng được trong 30 giây |
| **Câu kiểm tra nhanh** | Phải phân biệt được hiểu thật với thuộc lòng |
| **Chỗ cần tự kiểm** | Model tự khai chỗ nào Lab Coach phải kiểm lại trước khi dùng |

Kèm theo là độ chắc chắn model tự khai và ước lượng số phút trên lớp.

Nút này cũng có trong tab **Thử trực tiếp**, cho từng cụm model vừa trả về.

**Đây là bản nháp, không phải chỉ thị.** Giao diện gắn nhãn `BẢN NHÁP` và ghi rõ Lab Coach là người
quyết định cuối cùng — hệ thống đưa vật liệu, không bảo phải dạy gì. Nút cần máy chủ (`serve.py`);
mở bằng `file://` thì nút sẽ nói rõ lý do.

Demo nhanh: `http://127.0.0.1:8765/?answer=1#cum` — soạn luôn cho cụm đông nhất.

---

## 5. Chạy lại toàn bộ từ đầu

```bash
python codebase/run_cluster.py --course K4P1 --lecture D04 --out codebase/ui/data/session-K4P1-D04.json
python codebase/run_cluster.py --course K4P1 --lecture D08 --out codebase/ui/data/session-K4P1-D08.json
python codebase/run_cluster.py --course K4P1 --lecture D10 --out codebase/ui/data/session-K4P1-D10.json
python eval/run_eval.py --run 1
python eval/report.py
python codebase/serve.py &            # cần cho bộ đo nội dung ôn
python eval/run_eval_answer.py --run 1
python eval/run_eval_answer.py --selftest
python codebase/ui/build_data.py
```

---

## 6. Demo CP3 — trình tự nên đi

CP3 cần hai bằng chứng: **AI chạy thật** và **có số đo**. Trình tự này phủ cả hai trong 5 phút:

1. **Tab Thử trực tiếp — gọi AI ngay trước mặt người xem.** Chọn bộ *"Chatbot và Agent khác nhau chỗ nào"*,
   bấm **Gom cụm bằng AI**. Bốn bước chạy hiện ra, 1–3 giây sau có cụm thật kèm token và độ trễ.
   Đây là bằng chứng mạnh nhất cho "AI chạy thật, không gán cứng" — mạnh hơn mọi ảnh chụp.
2. **Chọn tiếp bộ *"Một người hỏi dồn dập"*** — cùng một hệ thống, lần này ra cụm 6 lượt / 1 người
   bị gắn cờ **tín hiệu lệch 100%**. Cho thấy sản phẩm phân biệt "cả lớp kẹt" với "một bạn hỏi nhiều".
3. **Chọn bộ *"Quá ít câu để kết luận"*** — hệ thống báo `SPARSE` và **không gọi AI**.
   Cho thấy nó biết lúc nào nên im lặng.
4. **Mở `logs/gemini-calls.jsonl`** — mỗi dòng một lời gọi, có prompt gửi đi và phản hồi thô.
5. **Tab Tổng quan** — chỉ vào số dẫn đầu: bao nhiêu học viên cùng vướng một chỗ trên buổi 511 lượt thật.
6. **Tab Cụm vấn đề** — mở một cụm, đọc câu nguyên văn, bấm "Không thuộc cụm": số lượt, số người và các cờ
   tính lại ngay.
7. **Bấm "✨ Soạn nội dung ôn" trên cụm đông nhất** — AI đọc cả cụm rồi soạn vật liệu giảng lại,
   trong đó phần *"giảng lại theo cách KHÁC slide"* là chỗ đáng chỉ vào: học viên đã đọc slide rồi
   mà vẫn hỏi, nên nội dung ôn phải đi một đường khác.
8. **Tab Chất lượng** — tỉ lệ đạt, và **một nhóm lỗi sẽ ưu tiên sửa** kèm lý do.

Khi nộp form CP3 nhớ kèm: đường dẫn video, **con số đo được** và **số case đã đo** (lấy ở `eval/README.md`).

---

## 7. Gặp lỗi

| Lỗi | Xử lý |
|---|---|
| `Thiếu GEMINI_API_KEY` | Chưa có `.env`, hoặc chưa điền khoá. Xem mục 1.1. |
| `503 Service Unavailable` | Model đang quá tải. Code tự thử lại 3 lần rồi rơi sang model dự phòng — cứ đợi. Nếu vẫn hỏng, đổi `GEMINI_MODEL` trong `.env`. |
| `Gemini trả 404 … no longer available` | Model trong `.env` đã bị gỡ. Xem danh sách model còn dùng được:<br>`curl -H "x-goog-api-key: $KEY" https://generativelanguage.googleapis.com/v1beta/models` |
| Dashboard trắng trơn | Chưa chạy `build_data.py`, hoặc `data.js` chưa có. Mở Console trình duyệt xem lỗi. |
| Tab Thử trực tiếp báo OFFLINE | Đang mở bằng `file://`. Chạy `python codebase/serve.py` rồi mở `http://127.0.0.1:8765`. |
| `Address already in use` khi chạy serve | Còn một tiến trình cũ giữ cổng. Đổi cổng: `CLASS_PULSE_PORT=8800 python codebase/serve.py` |
| `FileNotFoundError: tutor_turns.csv` | Chưa chép data pack vào `data/`. Xem mục 1.2. |
| Chạy chậm | Bình thường — mỗi 90 lượt là một lời gọi AI. Dùng `--limit` khi thử. |

---

## 8. Sửa hành vi hệ thống ở đâu

| Muốn đổi | Sửa file |
|---|---|
| Nội dung ôn gồm những mục gì | `codebase/serve.py` — `ANSWER_SCHEMA` và `ANSWER_PROMPT` |
| Ngưỡng SPARSE, kích thước phần, ngưỡng cụm yếu / tín hiệu lệch | `codebase/class_pulse/config.py` |
| Luật gom cụm (cái model được dặn) | `codebase/class_pulse/cluster.py` — biến `PROMPT` và `MERGE_PROMPT` |
| Model và chuỗi dự phòng | `.env` và `codebase/class_pulse/gemini.py` — `FALLBACK_MODELS` |
| Thêm/bớt test case | `eval/golden_set.json` |
| Cách chấm đạt/không đạt | `eval/run_eval.py` — hàm `check()` |

Đổi ngưỡng trong `config.py` thì **chạy lại bộ đo**, vì một số case bám sát ngưỡng
(ví dụ case `C2-01` có đúng 6 lượt, sát ngưỡng `SPARSE_MIN_TURNS = 6`).
