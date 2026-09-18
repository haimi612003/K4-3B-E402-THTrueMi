# Hướng dẫn chạy Class Pulse

Phần xử lý (đọc log, gọi AI, gom cụm, chấm bộ đo) chỉ cần **Python 3.8+**, thư viện chuẩn,
**không `pip install`**.

Giao diện có **hai bản**, chạy được cả khi máy không có Node:

| Bản | Cần gì | Khi nào dùng |
|---|---|---|
| **React** (`codebase/web`) — giao diện chính | Node 18+, chạy `npm install` và `npm run build` một lần | Bản đầy đủ, giao diện mới |
| **HTML một file** (`codebase/ui/index.html`) — bản dự phòng | không cần gì | Máy không có Node, hoặc bản React lỗi |

`serve.py` **tự chọn**: thấy `codebase/web/dist` thì phục vụ bản React, không thấy thì rơi về bản
HTML một file. Người chấm không có Node vẫn mở được sản phẩm.

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
CLASS_PULSE_PASSCODE=<mã nhóm tự đặt>
```

`CLASS_PULSE_PASSCODE` là mã đăng nhập vào dashboard — xem mục 4a.
**Bỏ trống dòng này thì máy chủ chạy mở, không hỏi mã** (tiện khi làm một mình).

`.env` đã nằm trong `.gitignore` — không bao giờ bị commit. Kiểm lại cho chắc:

```bash
git check-ignore -v .env        # phải in ra dòng .gitignore khớp
```

### 1.2 Dựng giao diện React (bỏ qua được nếu máy không có Node)

```bash
cd codebase/web
npm install          # một lần, khoảng 120 gói
npm run build        # sinh codebase/web/dist
cd ../..
```

Sau bước này `python codebase/serve.py` sẽ tự phục vụ bản React. **Không chạy bước này cũng không
sao** — máy chủ rơi về bản HTML một file, đủ mọi tính năng, chỉ khác giao diện.

Khi sửa giao diện thì chạy `npm run dev` ở `codebase/web` (cổng 5173, tự nạp lại khi lưu file).
Nó proxy `/api/*` sang `serve.py` ở cổng 8765, nên **vẫn phải bật `serve.py` song song** thì các
nút gọi AI mới chạy.

`node_modules/`, `dist/` và `public/data.js` đều đã bị `.gitignore` chặn — đừng commit chúng.

### 1.3 Data pack

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

Nó gom kết quả gom cụm + kết quả eval + nhật ký gọi model thành `data.js`, ghi cho **cả hai**
giao diện (`codebase/ui/data.js` và `codebase/web/public/data.js`). Cả hai đọc cùng một
`window.CP_DATA` nên không có hai định dạng dữ liệu phải đồng bộ bằng tay.

Đổi dữ liệu thì **không cần** `npm run build` lại — `data.js` nằm ngoài gói build.

**Cách chạy được khuyên dùng — có đủ 6 tab, kể cả tab gọi AI thật:**

```bash
python codebase/serve.py
```

Trang tự mở ở `http://127.0.0.1:8765`. Máy chủ chỉ lắng nghe trên máy bạn, không mở ra mạng ngoài.
Nếu `.env` có `CLASS_PULSE_PASSCODE`, trang sẽ hỏi mã trước — xem mục 4a.

**Cách nhẹ hơn, không cần máy chủ:** mở thẳng `codebase/ui/index.html` bằng trình duyệt
(`start codebase/ui/index.html` trên Windows). Năm tab đầu chạy bình thường; riêng tab
**Thử trực tiếp**, nút **Soạn nội dung ôn** và nút **Xuất hỏi đáp** cần máy chủ vì chúng gọi
Gemini thật — khoá API phải ở phía server chứ không nhúng vào trang web. Mở bằng `file://`
thì không có cổng đăng nhập, vì lúc đó dữ liệu đã nằm sẵn trên ổ đĩa của chính người mở.

Dashboard có 6 tab:

| Tab | Nội dung |
|---|---|
| **Trang chủ** | **Buổi gần nhất và ba cụm đông nhất của lớp**, rồi mới tới sản phẩm này là gì, **cách hoạt động** (ba bước: đọc log → gom cụm → soạn vật liệu) và **sáu nguyên tắc** hệ thống không đánh đổi. Đây là tab mở đầu — người lần đầu vào đọc ở đây trước khi xem số |
| **Tổng quan** | Số dẫn đầu, một dòng tin cậy, **ba cụm mạnh đông nhất**, biểu đồ sáu cụm lớn nhất (đuôi gập lại, cùng thang), thành phần lượt hỏi. Số kỹ thuật và phân bố lượt/học viên nằm sau cửa “Vì sao tin được mấy con số trên” |
| **Cụm vấn đề** | Danh sách cụm **chia ba băng theo số người** (ngưỡng in thẳng trên màn hình), mở ra đọc câu nguyên văn có ID, tick chọn cụm, bấm "Không thuộc cụm" để sửa tay (lưu lại giữa các lần mở trang), và **"✨ Soạn nội dung ôn"** để AI soạn vật liệu giảng lại — xem mục 4c |
| **Chất lượng** | Tỉ lệ đạt + **một câu kết luận nói thẳng chỗ sản phẩm còn sai**. Toàn bộ phương pháp đo (lịch sử các lượt, đạt theo lớp chỗ khó, nhóm lỗi, từng trường hợp) nằm sau một cửa gập |
| **Nhật ký AI** | Bằng chứng AI chạy thật: model, số lời gọi, token, độ trễ, số lần model bịa mã / bỏ sót câu. **Bảng lời gọi lọc theo mục đích** — gom cụm / bộ kiểm thử / thử trực tiếp |
| **Thử trực tiếp** | **Gọi AI thật ngay trên trang.** Xem mục 4b |

### 4a · Đăng nhập

Dashboard đọc **câu hỏi thật của học viên có mã định danh**, nên nó không nên mở toang cho bất kỳ ai
gõ trúng cổng 8765. Đặt mã trong `.env`:

```
CLASS_PULSE_PASSCODE=<một chuỗi dài, khó đoán, chỉ nhóm bạn biết>
```

Đừng chép nguyên một mã từ tài liệu nào — kể cả tài liệu này.

Khởi động lại `serve.py`. Từ lúc đó:

- Vào `http://127.0.0.1:8765` sẽ gặp màn hình nhập mã trước khi thấy bất cứ dữ liệu nào.
- **`data.js` và toàn bộ `/api/*` trả 401 nếu chưa đăng nhập** — không phải chỉ giấu giao diện.
- Gõ sai 8 lần trong 5 phút thì IP đó bị khoá tạm; màn hình đếm ngược số lần còn lại.
- Phiên nằm trong cookie `HttpOnly; SameSite=Strict`, mất khi tắt máy chủ. Nút **Thoát** ở góc phải
  huỷ phiên ngay.

**Đây bảo vệ được gì và không bảo vệ được gì.** Nó chặn người khác trên cùng máy hoặc cùng mạng LAN
mở cổng này — đúng phạm vi rủi ro của một công cụ chạy cục bộ. Nó **không** thay được tài khoản thật,
phân quyền theo lớp, hay nhật ký truy cập; những thứ đó chỉ cần khi đem sản phẩm lên máy chủ chung,
và lúc đó phải làm lại đàng hoàng chứ không nới cái mã này ra.

Bỏ trống `CLASS_PULSE_PASSCODE` thì máy chủ chạy mở và màn hình nói rõ là đang chạy mở.

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

### 4d · Xuất hỏi đáp để đăng lên VLearn

Tick vài cụm → thanh dưới hiện nút **📄 Xuất hỏi đáp cho VLearn** → AI soạn mỗi cụm thành một mục
hỏi đáp cho **học viên khoá sau** đọc, rồi tải về **file Word (`.doc`)** để đăng lên trang học.

File mở được bằng Word, Google Docs hay WPS: có tiêu đề, cỡ chữ, đường kẻ phân mục, khổ A4 — Lab Coach
sửa vài chữ rồi đăng luôn, không phải qua khâu chuyển định dạng nào. Tiếng Việt có dấu đúng nhờ BOM UTF-8.

Đây là thứ **duy nhất** trong sản phẩm đi tới học viên, nên nó qua ba cửa:

1. **Lab Coach chọn cụm** — không có chuyện tự xuất cả buổi.
2. **Hệ thống tự từ chối** cụm không phải câu hỏi kiến thức. Thử trên buổi `K4P1/D04`: hai cụm
   *"Yêu cầu tóm tắt bài học"* và *"Yêu cầu trích xuất nội dung"* bị loại vì đó là yêu cầu thao tác,
   không phải chỗ kẹt; cụm câu hành chính cũng bị loại vì *"thông tin này thay đổi theo từng khoá"*.
3. **Lab Coach bỏ tick từng mục** trong bảng duyệt trước khi tải.

**Không có nút đăng thẳng lên VLearn.** File tải về máy, người đăng là người.

Mỗi mục gồm: câu hỏi viết theo cách học viên gõ · câu trả lời tự đứng được (không có "hỏi giảng viên",
"xem lại slide" — người đọc tới đây chính vì slide chưa giúp được họ) · **các cách hỏi khác lấy nguyên
văn từ học viên** để khoá sau gõ kiểu gì cũng tìm ra, kể cả gõ sai chính tả · số người đã hỏi · chỗ
Lab Coach cần kiểm.

Demo nhanh: `http://127.0.0.1:8765/?filter=top&faq=1#cum`

**Deep-link khi demo:**

| Tham số | Tác dụng |
|---|---|
| `?filter=all\|strong\|weak\|skew` | Mở sẵn một bộ lọc cụm |
| `?judge=1` | **Mở sẵn mọi tầng sâu** — phương pháp đo, bảng từng trường hợp, đuôi biểu đồ, băng cụm yếu. Dùng khi nộp bài hoặc khi người chấm muốn kiểm chứng mà không phải đi bấm từng cửa |
| `?theme=dark\|light` | Chọn nền |
| `?sample=<id>&run=1` | Chạy sẵn một kịch bản ở tab Thử trực tiếp |
| `?answer=1` · `?faq=N` | Soạn nội dung ôn / xuất hỏi đáp cho cụm đông nhất |

**Giao diện mặc định ưu tiên Lab Coach, không ưu tiên người chấm.** Các bảng dài,
biểu đồ đuôi và toàn bộ phần phương pháp đo nằm sau một cửa gập — **không bị xoá, chỉ
đổi chỗ đứng**. Con số bất lợi (cụm yếu, tín hiệu lệch, lượt chưa quy được, số lần
model trả kết quả hỏng) đều nằm trên dòng luôn hiện, không nằm trong cửa gập.

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
| Trang hỏi mã mà không biết mã | Mã nằm ở `CLASS_PULSE_PASSCODE` trong `.env` của máy chủ. Xoá dòng đó rồi khởi động lại là chạy mở. |
| `Thử sai quá nhiều. Đợi N giây.` | Gõ sai 8 lần trong 5 phút. Đợi hết 5 phút, hoặc khởi động lại `serve.py`. |
| Đăng nhập xong vẫn trắng trơn | Trình duyệt đang chặn cookie cho `127.0.0.1`. Mở tab thường (không ẩn danh), hoặc bật lại cookie. |
| Tab Thử trực tiếp báo OFFLINE | Đang mở bằng `file://`. Chạy `python codebase/serve.py` rồi mở `http://127.0.0.1:8765`. |
| `Address already in use` khi chạy serve | Còn một tiến trình cũ giữ cổng. Đổi cổng: `CLASS_PULSE_PORT=8800 python codebase/serve.py` |
| `FileNotFoundError: tutor_turns.csv` | Chưa chép data pack vào `data/`. Xem mục 1.2. |
| Chạy chậm | Bình thường — mỗi 90 lượt là một lời gọi AI. Dùng `--limit` khi thử. |

---

## 8. Sửa hành vi hệ thống ở đâu

| Muốn đổi | Sửa file |
|---|---|
| Nội dung ôn gồm những mục gì | `codebase/serve.py` — `ANSWER_SCHEMA` và `ANSWER_PROMPT` |
| Luật từ chối khi xuất hỏi đáp | `codebase/serve.py` — `FAQ_PROMPT` luật 1 |
| Định dạng file Word xuất ra | `codebase/ui/index.html` — hàm `faqDoc()` |
| Chữ trên trang chủ, ba bước, sáu nguyên tắc | `codebase/ui/index.html` — `STEPS3` và `PRINS` trong `renderHome()` |
| Mã đăng nhập, ngưỡng khoá IP | `.env` (`CLASS_PULSE_PASSCODE`) và `codebase/serve.py` — `LOCK_AFTER`, `LOCK_WINDOW` |
| Ngưỡng SPARSE, kích thước phần, ngưỡng cụm yếu / tín hiệu lệch | `codebase/class_pulse/config.py` |
| Luật gom cụm (cái model được dặn) | `codebase/class_pulse/cluster.py` — biến `PROMPT` và `MERGE_PROMPT` |
| Model và chuỗi dự phòng | `.env` và `codebase/class_pulse/gemini.py` — `FALLBACK_MODELS` |
| Thêm/bớt test case | `eval/golden_set.json` |
| Cách chấm đạt/không đạt | `eval/run_eval.py` — hàm `check()` |

Đổi ngưỡng trong `config.py` thì **chạy lại bộ đo**, vì một số case bám sát ngưỡng
(ví dụ case `C2-01` có đúng 6 lượt, sát ngưỡng `SPARSE_MIN_TURNS = 6`).
