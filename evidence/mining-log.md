# Log mining — bằng chứng đường B cho spec §1/§2

**Nguồn.** `data/vlearn-pack/chatlog/tutor_turns.csv` của data pack khoá (13.494 lượt hỏi-đáp thật,
22/07 → 15/09/2026, đã ẩn danh). Pack **không** được commit vào repo này theo luật `data/README.md` §4 —
file này chỉ chứa số đếm và trích ngắn kèm `turn_id`.

**Script.** [`evidence/mine_k4.py`](mine_k4.py) — chạy lại phải ra đúng các con số dưới đây:

```
python evidence/mine_k4.py <đường dẫn tới tutor_turns.csv>
```

**Chạy lần 1:** 18/09/2026 · Mai Huy Hoàng + Nguyễn Đức Tâm

---

## Quy tắc đếm (để người khác kiểm lại được)

| Khái niệm | Định nghĩa dùng trong mọi con số dưới đây |
|---|---|
| Phạm vi | `cohort_hint == "K4"` — chỉ khoá đang chạy, bỏ K3 |
| Câu mẫu | `is_preset == true` (câu bấm sẵn của giao diện) — **loại trước khi đếm bất cứ thứ gì** |
| Một "buổi học" | cặp `(course_id, lecture_code)`. `lecture_code` **không duy nhất** giữa các khoá học nên bắt buộc ghép với `course_id` — đếm theo mình `lecture_code` sẽ gộp nhầm hai lớp |
| Thân câu hỏi | bỏ tiền tố ngữ cảnh `(Đang học phần "…" của buổi này)` / `(Currently on the part "…" of this lesson)`, rồi gộp khoảng trắng |
| Trùng nguyên văn | so thân câu hỏi sau khi `lower()` + bỏ dấu câu ở hai đầu |

**Sai số đã biết:** câu mẫu nhận diện bằng cờ `is_preset` có sẵn của hệ thống, nhóm không kiểm lại regex gốc.
Vài câu học viên tự gõ trùng ý câu mẫu ("giải thích slide này", 5 lượt) vẫn nằm trong phần "thực".

---

## Kết quả

### 0 · Phạm vi

```
toàn file: 13494 lượt | câu mẫu toàn file: 3067 (22.7%)
K4: 3097 lượt | 448 học viên | 2026-09-09 22:31 -> 2026-09-15 17:57
K4 câu mẫu is_preset: 542 (17.5%) -> còn 2555 lượt thực
```

> **Đính chính so với Canvas CP1.** Canvas ghi "tách 22,7% `is_preset`" — đó là tỉ lệ của **cả file**.
> Riêng K4 là **17,5% (542/3.097)**. Số dùng trong spec là 17,5%.

### 1 · Khối lượng mỗi buổi (K4, đã bỏ câu mẫu)

```
  589 lượt thực |  127 HV |  64.9k ký tự | K4P1        D01 Day01                   | 09/09..15/09
  511 lượt thực |  127 HV |  31.5k ký tự | K4P1        D04 DAY03                   | 11/09..15/09
  453 lượt thực |  101 HV |  29.6k ký tự | K4P1        D08 DAY04                   | 13/09..15/09
  318 lượt thực |   94 HV |  29.2k ký tự | L2-L3-K4P1  D01 Data                     | 09/09..14/09
  266 lượt thực |   65 HV |  23.9k ký tự | L2-L3-K4P1  D02 Object Detection         | 10/09..15/09
  220 lượt thực |   71 HV |  14.8k ký tự | K4P1        D03 DAY02                    | 10/09..15/09
  108 lượt thực |   41 HV |   8.6k ký tự | L2-L3-K4P1  D03 MultiFrame Tracking      | 10/09..15/09
   67 lượt thực |   23 HV |   3.5k ký tự | K4P1        D09 Day05                    | 14/09..15/09
   14 lượt thực |   10 HV |   0.5k ký tự | L2-L3-K4P1  D04 Keypoint and Pose Data   | 14/09..15/09
```

Một buổi đông nhất: **589 lượt thực của 127 học viên, 64,9k ký tự** câu hỏi — cỡ 20 trang A4 chữ liền.
Buổi nhỏ nhất trong cùng khoá chỉ **14 lượt/10 HV**: cùng một sản phẩm phải chạy đúng ở cả hai đầu.

### 2 · Vì sao không gom được bằng cách thường

```
2555 lượt thực -> 2434 chuỗi khác nhau; 2366 chuỗi xuất hiện đúng 1 lần (97.2% chuỗi, 92.6% lượt)
chuỗi lặp nhiều nhất (đã bỏ câu mẫu):
    17 | hi
     7 | hello
     6 | xin chào
     5 | bạn là model gì
     5 | có
     5 | giải thích slide này
```

**Đây là con số quan trọng nhất của cả bài.** 92,6% lượt hỏi thực là một chuỗi chỉ xuất hiện **đúng một lần**.
Nhóm theo trùng khớp văn bản, đếm tần suất, `GROUP BY` — mọi cách "gom" không cần hiểu nghĩa đều vô dụng ở đây:
câu lặp nhiều nhất trong cả khoá K4 là "hi" (17 lần). Đây là lý do bài toán cần một quyết định AI, không phải một câu SQL.

### 3 · Nhưng vấn đề thì CÓ lặp — chỉ là lặp về ý (buổi K4P1/D04 · DAY03)

```
quy tắc: thân câu hỏi khớp /(react|agent|chatbot)/i
-> 140 lượt / 69 HV (buổi có 511 lượt thực / 127 HV)
   nhóm con A 'phân biệt chatbot/LLM/agent': 29 lượt / 26 HV
   nhóm con B 'chấm agentic fit cho use case': 17 lượt / 14 HV
```

**69/127 học viên — hơn một nửa lớp — hỏi quanh cùng một cụm khái niệm, bằng 140 cách diễn đạt khác nhau.**
Quy tắc trên đếm tay lại được: một regex, ai chạy cũng ra 140.

Và ngay trong 140 lượt đó đã có hai chỗ kẹt **khác hẳn nhau** dùng chung từ khoá `agent`
(nhóm con A: khái niệm — nhóm con B: cách chấm điểm bài lab). Đây là ca lớp ④ trong §5/§6.

### 4 · Tín hiệu lệch: một người chiếm bao nhiêu lượt của buổi

```
K4P1/D08: 453 lượt / 101 HV | top-1 S0452 = 58 lượt (12.8%) | trung vị 2 lượt/HV
K4P1/D01: 589 lượt / 127 HV | top-1 S0880 = 51 lượt (8.7%)  | trung vị 2 lượt/HV
K4P1/D04: 511 lượt / 127 HV | top-1 S0771 = 22 lượt (4.3%)  | trung vị 3 lượt/HV
```

Trung vị là **2 lượt/học viên**, còn người hỏi nhiều nhất là **58 lượt**. Chênh 29 lần.
Nếu chỉ đếm số lượt, một người đủ sức đẩy một cụm lên đầu danh sách — hard test "một người hỏi 20 lần"
là chuyện đã xảy ra thật trong data, không phải tình huống giả định.

### 5 · Câu quá ngắn / lạc đề

```
thân câu hỏi <= 15 ký tự: 325 / 2555 (12.7%)
```

Ví dụ: `hi` · `hello` · `có` · `tiếp` · `context ?` · `slide missing` · `who are you` · `đây`.
Cứ 8 lượt hỏi thực thì có 1 lượt không đủ chữ để quy vào vấn đề nào.

### 6 · Ngữ cảnh đi kèm câu hỏi

```
có tiền tố tên phần: 2545 (99.6%)
có neo 'trang N' trong câu: 151 (5.9%)
số phần khác nhau trong riêng buổi K4P1/D04: 20
```

> **Đính chính thứ hai — ảnh hưởng tới prototype.** Nhóm giả định câu hỏi neo theo **trang slide**.
> Thực tế: **99,6%** lượt neo theo **tên phần** (`Đang học phần "day03-tu-chatbot-den-agentic-agent-react"`),
> chỉ **5,9%** có số trang. Một buổi trải trên **20 phần** khác nhau.
> Prototype phải hiện **chip tên phần**, số trang chỉ là thông tin phụ khi có.

### 7 · Số cho bảng impact §2

```
K4 trả lời KHÔNG trích dẫn (has_citation=false): 839 (27.1%)
K4 lượt có rating: 12  (up 9 / down 3)  -> 0.4%
K4 understanding_level rỗng: 3091 / 3097  (99.8%)
K4 move_used: review_concept 2767 · give_direct_answer 152 · give_example 109 · give_hint 23 · (rỗng) 20
```

### 8 · Trích dẫn nguyên văn (≥5 ví dụ — `turn_id` trỏ về dòng log)

Cụm thật trong buổi `K4P1/D04` — **8 học viên khác nhau, 8 cách hỏi khác nhau, cùng một chỗ kẹt**:

| turn_id | Học viên | Thời điểm | Nguyên văn |
|---|---|---|---|
| `T11666` | S1537 | 12/09 12:16 | "ReAct Agent và Chatbot thông thường khác nhau thế nào?" |
| `T11701` | S1396 | 12/09 14:04 | "chatbot vs react Agent" |
| `T11704` | S0415 | 12/09 14:10 | "Agent là phiên bản nâng cấp của LLM?" |
| `T11706` | S0578 | 12/09 14:13 | "chat gpt là cả agent và chatbot đúng kh" |
| `T11708` | S0829 | 12/09 14:14 | "LLM khác agent như thế nào" |
| `T11715` | S1342 | 12/09 14:20 | "so sánh chatbot với agent" |
| `T11731` | S1471 | 12/09 14:29 | "sự khác biệt giữa chatbot và agent" |
| `T11737` | S0774 | 12/09 14:32 | "khác nhau giữa LLM chatbot và rulebase" |

Không hai câu nào trùng chuỗi. Gom bằng máy theo văn bản: 8 cụm. Gom theo ý: 1 cụm, 8 người.

Cụm nhỏ hơn cùng buổi — **cùng chủ đề, hỏi cách nhau gần 1 giờ, hai người không biết nhau đã hỏi**:

| turn_id | Học viên | Thời điểm | Nguyên văn |
|---|---|---|---|
| `T11824` | S1376 | 12/09 15:18 | "MCP là gì" |
| `T11850` | S0605 | 12/09 16:09 | "MCP là gì" |
| `T11881` | S0662 | 12/09 16:27 | "mcp khác gì function calling" |

Ca lớp ④ — **cùng từ khoá `agent`, khác chỗ kẹt**:

| turn_id | Học viên | Nguyên văn (cắt) |
|---|---|---|
| `T11773` | S0542 | "Bài tập nhanh: Chấm agentic fit cho use case của nhóm Mỗi nhóm điền bảng (use case của nhóm - reasoning - tool use - dynamic - tổng)…" |
| `T12145` | S0596 | "Use case 1: Trợ lý chẩn đoán lỗi xe & đặt lịch bảo dưỡng (Điểm: 14/15 - Agent) Bài toán này đòi hỏi khả năng…" |

Ca lớp ② — **câu không đủ thông tin để quy vào cụm nào**:

| turn_id | Học viên | Nguyên văn |
|---|---|---|
| `T13196` | S0452 | "tôi không hiểu câu này lắm" |
| `T10381` | S0518 | "slide missing" |

---

## Còn thiếu (tự khai)

- **Phỏng vấn Lab Coach chưa làm.** Mining chứng minh pain *tồn tại* (đường B). Chưa có số cho
  "Lab Coach hiện mất bao nhiêu phút mỗi buổi" và "họ có muốn nó được giải không" — phải phỏng vấn
  theo Mom Test, ≥2 người, log nguyên văn. Ô này trong bảng impact §2 vẫn đang là ước lượng, đã đánh dấu.
- **Golden set chưa dựng.** Sẽ lấy từ chính buổi `K4P1/D04` (511 lượt) — gán nhãn cụm bằng tay,
  ≥2 case cho mỗi lớp chỗ khó. Xem §7.
