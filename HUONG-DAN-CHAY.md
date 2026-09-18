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
python eval/run_eval.py --run 2
```

---

## 4. Dựng và mở dashboard

```bash
python codebase/ui/build_data.py
```

Nó gom kết quả gom cụm + kết quả eval + nhật ký gọi model thành `codebase/ui/data.js`.
Rồi mở bằng trình duyệt:

```bash
start codebase/ui/index.html        # Windows
# open codebase/ui/index.html       # macOS
```

Mở thẳng bằng `file://` được, **không cần chạy server** — đó là lý do dữ liệu ghi ra `.js` chứ không `.json`.

Dashboard có 5 tab:

| Tab | Nội dung |
|---|---|
| **Tổng quan** | Số dẫn đầu, các chỉ số, biểu đồ cụm theo lượt/người, thành phần lượt hỏi, phân bố lượt/học viên |
| **Cụm vấn đề** | Danh sách cụm, mở ra đọc câu nguyên văn có ID, tick chọn cụm, bấm "Không thuộc cụm" để sửa tay |
| **Chất lượng** | Kết quả bộ kiểm thử: tỉ lệ đạt, đạt theo từng lớp chỗ khó, nhóm lỗi, từng case |
| **Nhật ký AI** | Bằng chứng AI chạy thật: model, số lời gọi, token, độ trễ, số lần model bịa mã / bỏ sót câu |
| **Mô tả bài toán** | Bài toán, lát cắt, hệ thống làm gì khi không chắc, an toàn |

---

## 5. Chạy lại toàn bộ từ đầu

```bash
python codebase/run_cluster.py --course K4P1 --lecture D04 --out codebase/ui/data/session-K4P1-D04.json
python codebase/run_cluster.py --course K4P1 --lecture D08 --out codebase/ui/data/session-K4P1-D08.json
python codebase/run_cluster.py --course K4P1 --lecture D10 --out codebase/ui/data/session-K4P1-D10.json
python eval/run_eval.py --run 1
python eval/report.py
python codebase/ui/build_data.py
start codebase/ui/index.html
```

---

## 6. Demo CP3 — trình tự nên đi

CP3 cần hai bằng chứng: **AI chạy thật** và **có số đo**. Trình tự này phủ cả hai trong 5 phút:

1. **Mở terminal, chạy thật một buổi** — `python codebase/run_cluster.py --course K4P1 --lecture D04 --limit 40`.
   Cho người xem thấy dòng `Đang gọi AI gom cụm…`, đợi, rồi các cụm hiện ra kèm câu nguyên văn có ID.
2. **Mở `logs/gemini-calls.jsonl`** — mỗi dòng là một lời gọi, có prompt gửi đi và phản hồi thô của model.
   Đây là chỗ chứng minh không gán cứng.
3. **Mở dashboard, tab Tổng quan** — chỉ vào số dẫn đầu: bao nhiêu học viên cùng vướng một chỗ.
4. **Tab Cụm vấn đề** — mở một cụm, đọc câu nguyên văn, bấm "Không thuộc cụm" cho thấy số lượt trừ lại ngay.
5. **Đổi buổi sang `D10`** — cho thấy trạng thái `SPARSE`: hệ thống không gom, không gọi AI.
6. **Tab Chất lượng** — tỉ lệ đạt, và **một lỗi nhóm sẽ ưu tiên sửa** kèm lý do.

Khi nộp form CP3 nhớ kèm: đường dẫn video, **con số đo được** và **số case đã đo** (lấy ở `eval/README.md`).

---

## 7. Gặp lỗi

| Lỗi | Xử lý |
|---|---|
| `Thiếu GEMINI_API_KEY` | Chưa có `.env`, hoặc chưa điền khoá. Xem mục 1.1. |
| `503 Service Unavailable` | Model đang quá tải. Code tự thử lại 3 lần rồi rơi sang model dự phòng — cứ đợi. Nếu vẫn hỏng, đổi `GEMINI_MODEL` trong `.env`. |
| `Gemini trả 404 … no longer available` | Model trong `.env` đã bị gỡ. Xem danh sách model còn dùng được:<br>`curl -H "x-goog-api-key: $KEY" https://generativelanguage.googleapis.com/v1beta/models` |
| Dashboard trắng trơn | Chưa chạy `build_data.py`, hoặc `data.js` chưa có. Mở Console trình duyệt xem lỗi. |
| `FileNotFoundError: tutor_turns.csv` | Chưa chép data pack vào `data/`. Xem mục 1.2. |
| Chạy chậm | Bình thường — mỗi 90 lượt là một lời gọi AI. Dùng `--limit` khi thử. |

---

## 8. Sửa hành vi hệ thống ở đâu

| Muốn đổi | Sửa file |
|---|---|
| Ngưỡng SPARSE, kích thước phần, ngưỡng cụm yếu / tín hiệu lệch | `codebase/class_pulse/config.py` |
| Luật gom cụm (cái model được dặn) | `codebase/class_pulse/cluster.py` — biến `PROMPT` và `MERGE_PROMPT` |
| Model và chuỗi dự phòng | `.env` và `codebase/class_pulse/gemini.py` — `FALLBACK_MODELS` |
| Thêm/bớt test case | `eval/golden_set.json` |
| Cách chấm đạt/không đạt | `eval/run_eval.py` — hàm `check()` |

Đổi ngưỡng trong `config.py` thì **chạy lại bộ đo**, vì một số case bám sát ngưỡng
(ví dụ case `C2-01` có đúng 6 lượt, sát ngưỡng `SPARSE_MIN_TURNS = 6`).
