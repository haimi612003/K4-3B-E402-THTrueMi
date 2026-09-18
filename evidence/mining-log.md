# Mining log — bằng chứng đường B cho spec.md §1

> Sinh tự động bởi `python evidence/mine_k4.py --md`. Chạy lại là ra đúng những con số này.
> Nguồn: `data/vlearn-pack/chatlog/tutor_turns.csv` — data pack **không** commit vào repo
> (luật `data/README.md` §4), nên file này là bản ghi KẾT QUẢ, không phải bản sao dữ liệu.

## 1 · Quy mô dữ liệu
- Tổng lượt khoá K4: **3097**
- Lượt câu bấm nút có sẵn (`is_preset`) của **riêng K4**: **542** (17.5%)
  _Sửa sai: canvas.md từng ghi 22,7% cho K4. 22,7% là tỉ lệ của **cả file** (K3+K4); riêng K4 là 17.5%._
- **Lượt hỏi thực còn lại: 2555**
- Khoá K3 (chỉ để đối chiếu định dạng, không dùng làm bằng chứng): 10397 lượt

## 2 · Vì sao GROUP BY không giải được
- Số chuỗi câu hỏi khác nhau: **2434**
- **Tính trên LƯỢT** — lượt mà nội dung chỉ xuất hiện đúng một lần trong cả khoá:
  **2366/2555 = 92.6%** ← con số spec §1/§2 đang trích
- Tính trên CHUỖI — chuỗi chỉ xuất hiện một lần: **2366/2434 = 97.2%**
  → Hai mẫu số khác nhau, cả hai đều đúng. Spec dùng mẫu số **lượt**.
- Năm chuỗi lặp nhiều nhất (đây là thứ `GROUP BY` bắt được):
  - 17 lần — “hi”
  - 7 lần — “hello”
  - 6 lần — “xin chào”
  - 5 lần — “bạn là model gì”
  - 5 lần — “có”

## 3 · Quy mô một buổi (chỗ Lab Coach phải đọc tay)
- `K4P1/D01` (Day01): **589 lượt thực · 127 học viên · 64.894 ký tự** (~25 trang A4)
- `K4P1/D04` (DAY03): **511 lượt thực · 127 học viên · 31.498 ký tự** (~12 trang A4)
- `K4P1/D08` (DAY04): **453 lượt thực · 101 học viên · 29.631 ký tự** (~11 trang A4)
- `L2-L3-K4P1/D01` (Data): **318 lượt thực · 94 học viên · 29.181 ký tự** (~11 trang A4)
- `L2-L3-K4P1/D02` (Object Detection): **266 lượt thực · 65 học viên · 23.883 ký tự** (~9 trang A4)

## 4 · Vì sao “nhiều lượt” không bằng “nhiều người”
- `K4P1/D01`: trung vị **2 lượt/học viên**, người hỏi nhiều nhất **51 lượt (8.7% cả buổi)**
- `K4P1/D04`: trung vị **3 lượt/học viên**, người hỏi nhiều nhất **22 lượt (4.3% cả buổi)**
- `K4P1/D08`: trung vị **2 lượt/học viên**, người hỏi nhiều nhất **58 lượt (12.8% cả buổi)**

## 5 · Ca biên có thật trong data (cơ sở của cổng “quá ít câu”)
- `K4P1/D11`: **2 lượt thực · 1 học viên** — dưới ngưỡng 6, hệ thống không gọi AI
- `K4P1/D10`: **3 lượt thực · 1 học viên** — dưới ngưỡng 6, hệ thống không gọi AI
- `K4P1/D12`: **4 lượt thực · 2 học viên** — dưới ngưỡng 6, hệ thống không gọi AI

## 6 · Ngữ cảnh đi kèm câu hỏi
- Có nhãn phần bài: **2545/2555 = 99.6%**
- Nội dung câu hỏi có nhắc số trang: **154/2555 = 6.0%**
  → Neo theo **tên phần** chứ không theo số trang. Đây là lý do chip ngữ cảnh đổi từ số trang sang tên phần.

## 7 · Vì sao loại đề A1 (số, không phải cảm tính)
- Lượt có `rating`: **12/3097 = 0.4%**
- Lượt có `understanding_level`: **6/3097 = 0.2%**
  → Không có nhãn sẵn để chấm “câu trả lời tốt”. Nhóm 4 người tự chấm thì golden set là ý kiến nhóm.

## 8 · Hai phép đếm KHÁC NHAU quanh cụm khái niệm agent
- Học viên có ÍT NHẤT MỘT câu khớp regex `agent|chatbot|llm`: **67/127**
- Học viên nằm trong MỘT cụm do AI gom (“Phân biệt Chatbot và Agent”): **36/127**
- Hai phép đếm này KHÔNG được dùng thay nhau. Khớp từ khoá là phép đếm **rộng**
  (hỏi “agent” trong ngữ cảnh nào cũng tính); cụm là phép đếm **hẹp** (cùng một chỗ kẹt).
  Chênh **31 người** chính là phần mà gom bằng từ khoá sẽ gộp nhầm.
