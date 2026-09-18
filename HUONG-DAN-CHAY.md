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

Nó cũng dựng **chuỗi theo ngày**: `per_day` cho từng buổi và `timeline` gộp cả lớp — nguồn cho
biểu đồ đường và ba bộ lọc ở mục 4e. Một ngày có thể chứa câu hỏi của nhiều buổi (học viên hỏi về
buổi cũ sau khi buổi mới đã dạy), nên `timeline` **cộng dồn** chứ không ghi đè, và ghi luôn danh
sách buổi đã đóng góp vào ngày đó.

Đổi dữ liệu thì **không cần** `npm run build` lại — `data.js` nằm ngoài gói build.

**Cách chạy được khuyên dùng — có đủ 5 tab, kể cả tab gọi AI thật:**

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

Dashboard có **3 trang**, đi theo đúng một mạch: nhận cái gì → làm gì với nó → ra cái gì.

| Trang | Nội dung |
|---|---|
| **Đầu vào** | Hero mở đầu · **bộ lọc buổi + khoảng ngày (từ ngày → đến ngày)** · bốn số tổng · **biểu đồ đường** thời gian × số câu hỏi (rê chuột ra số của đúng ngày đó) · **bảng dữ liệu** đầy đủ, một hàng là một ngày của một buổi · **biểu đồ mức độ quan trọng của từng cụm** · và chỗ **chọn cụm** bằng thanh kéo “trả lời N cụm quan trọng nhất” |
| **Xử lý** | Bốn bước hệ thống đã làm · **bảng ngưỡng đang chạy thật** lấy từ máy chủ · **từ đầu vào tới đầu ra** (năm thanh cùng một thang) · một dòng kết luận về bộ đo. Ba tầng kiểm chứng nằm sau cửa gập: **Chất lượng**, **Nhật ký AI**, **Thử trực tiếp** |
| **Đầu ra** | Những cụm đã chọn ở trang Đầu vào → **soạn nội dung ôn** từng cụm · **xuất hỏi đáp `.doc`** cho VLearn. Không có bộ lọc, không sắp xếp — đó là việc của đầu vào |

Lựa chọn cụm **đi theo bạn qua các trang và qua cả lần tải lại** (giữ trong `localStorage`), vì chọn
cụm là bước tốn công nhất.

**Bản 5 tab cũ** (Trang chủ · Tổng quan · Cụm vấn đề · Chất lượng · Thử trực tiếp) vẫn còn nguyên
trong `codebase/web/src/tabs/`. Quay về đầy đủ:

```bash
git checkout truoc-tai-cau-truc-3-trang     # hoặc: git reset --hard truoc-tai-cau-truc-3-trang
```

Dấu trang cũ không hỏng: `#home`, `#tong`, `#cum` rơi về **Đầu vào**; `#eval`, `#log`, `#live` rơi
về **Xử lý**.

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

**Kiểm cổng đăng nhập:**

```bash
python codebase/test_serve.py
```

Dựng máy chủ thật trên một cổng trống rồi gọi HTTP thật — không cần mạng, không gọi model. Nó kiểm
đúng một thứ dễ hỏng âm thầm: **cổng phải mở cho vỏ ứng dụng (`/`, `/assets/*.js|css`) và chặn dữ
liệu (`/data.js`, `/api/*`)**. Chặn nhầm gói JavaScript thì màn hình đăng nhập — vốn nằm bên trong
chính gói đó — không bao giờ hiện, người dùng chỉ thấy trang trắng và không còn đường nào đăng nhập,
trong khi máy chủ vẫn trả 200 cho `/` và log không có gì bất thường. Lỗi này đã xảy ra thật khi
chuyển giao diện từ một file HTML sang bản React có gói rời.

### 4b · "Thử trực tiếp" — thao tác thật với model

_Nằm trong cửa gập cuối trang **Xử lý**._

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

_Nằm ở trang **Đầu ra**, chạy cho những cụm đã chọn ở trang Đầu vào._

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

_Nằm ở nửa dưới trang **Đầu ra**._

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

### 4e · Lọc theo ngày, bảng dữ liệu, biểu đồ đường

Tất cả nằm ở trang **Đầu vào**. Mã: [`src/tabs/InputPage.jsx`](codebase/web/src/tabs/InputPage.jsx).

**Ba ô lọc trên một hàng, ngay trên dữ liệu:**

| Ô | Làm gì |
|---|---|
| **Buổi học** | `Tất cả các buổi` hoặc một buổi. Chọn một buổi thì phần gom cụm bên dưới đổi theo |
| **Từ ngày** | Mốc đầu khoảng. Bỏ trống = ngày đầu tiên có dữ liệu |
| **Đến ngày** | Mốc cuối khoảng. Bỏ trống = ngày cuối cùng |

Chọn **cùng một ngày** cho cả hai ô thì ra dữ liệu đúng một ngày; chọn khoảng rộng thì ra nhiều
ngày. Hai ô tự giữ khoảng luôn hợp lệ — đặt “từ” muộn hơn “đến” thì ô kia nhảy theo chứ không để
người dùng cầm một khoảng rỗng. Danh sách chỉ liệt kê **những ngày thật sự có dữ liệu**, nên không
có chuyện chọn trúng một ngày trống.

**Bảng dữ liệu** — một hàng là **một ngày của một buổi**, bảy cột: ngày · buổi · tên buổi · lượt
thực · học viên · câu mẫu đã loại · TB lượt/HV, kèm hàng tổng. Cùng một ngày xuất hiện nhiều lần là
đúng: học viên vẫn hỏi về buổi cũ sau khi buổi mới đã dạy, gộp lại là mất đúng thông tin đó.

**Biểu đồ đường** — ba chuỗi cùng đơn vị theo ngày. Rê chuột có **đường dóng + bảng nhỏ** đọc thẳng
số của ngày đó; nhãn số chỉ in ở điểm cuối mỗi đường; có **“Xem dạng bảng”** cho người đọc bằng
trình đọc màn hình. Lọc còn đúng một ngày thì không vẽ đường nữa — một điểm không thành đường, số
đã nằm ở bốn ô tổng bên trên.

**Mức độ quan trọng của cụm** — biểu đồ hai thanh (số lượt · số học viên khác nhau), xếp theo **số
người** chứ không theo số lượt. Đây **không phải điểm số tự nghĩ ra**: thứ tự và hai cờ *cụm yếu* /
*tín hiệu lệch* đều là kết quả ngưỡng trong `config.py`, in nguyên ở trang Xử lý.

**Chọn cụm** — thanh kéo *“trả lời N cụm quan trọng nhất”* tự tick N cụm đầu; vẫn bỏ tick tay được
từng cụm, và khi đó thanh kéo thôi mô tả lựa chọn chứ không ghi đè nó. Chọn trúng cụm bị đánh cờ
thì có cảnh báo kèm ngưỡng thật, không chặn.

### 4f · Nền động — ba lớp

Mã ở [`codebase/web/src/ui/BgFx.jsx`](codebase/web/src/ui/BgFx.jsx) và phần cuối `src/index.css`.

| Lớp | Nó làm gì | Dẫn động bằng |
|---|---|---|
| **Thị sai** | Lưới điểm ở hai lề trôi lên chậm hơn nội dung, tỉ lệ 9:100 — mắt đọc ra là “ở xa hơn”, không phải “có vật đang chạy” | `transform` theo `scrollTop` |
| **Độ sâu** | Lớp ánh sáng phủ màn, đậm dần theo % trang đã đọc. **Không** có thị sai — một trường lớn trượt theo cuộn là công thức gây chóng mặt | `opacity` theo `scrollTop`, cộng hai `@keyframes` rất chậm |
| **Tụ cụm** | 48 chấm rời dồn thành 4 cụm khi cuộn — **chỉ trang chủ**. Hình nói đúng câu tiêu đề “Hàng trăm câu hỏi. Vài vấn đề.” Ba chấm **cố ý** không vào cụm nào và mờ đi — đó là nhóm *rải rác* có thật | một custom property `--t`; 48 chấm tự nội suy trong `calc()` |

Bốn cụm cố ý **không đều** (18/12/9/6): bốn cụm bằng nhau đọc ra là trang trí, lệch nhau đọc ra là
dữ liệu. Vị trí từng chấm sinh bằng bộ ngẫu nhiên **có gieo hạt cố định**, nên ảnh chụp nộp giám khảo
tái lập được y hệt trên mọi máy.

Mỗi khung hình chỉ ghi `transform` và `opacity` — hai thuộc tính chạy trên compositor, không paint
lại, không layout lại. **Không làm mượt** (không lerp, không quán tính): vị trí là hàm thuần tuý của
`scrollTop`, nên cuộn ngược là nền tua lại đúng đường cũ từng pixel trong cùng khung hình đó.

`prefers-reduced-motion: reduce` thì **giữ hoạ tiết, bỏ chuyển động**, và ghim lớp chấm ở trạng thái
**đã tụ** — vẫn giữ được nghĩa “vài cụm, không đều”, không còn một pixel nào bám cuộn. Dưới 900px
lớp chấm ẩn hẳn thay vì chen vào chữ. Bản in không có lớp nào trong ba lớp này.

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
| Dashboard trắng trơn | Chưa chạy `build_data.py`, hoặc `data.js` chưa có. Mở Console trình duyệt xem lỗi. Nếu tab Network báo **401 ở `/assets/index-*.js`** thì là lỗi cổng đăng nhập chặn nhầm gói giao diện — `git pull` rồi chạy `python codebase/test_serve.py` để xác nhận đã hết. |
| Đăng nhập xong mà **mọi con số là `—`** | Trang chưa tải lại sau khi đăng nhập nên `data.js` chưa vào. Đã sửa: đăng nhập thành công là trang tự tải lại. Nhấn F5 là xong. |
| Gõ mã đúng mà báo lỗi 500 | Mã trong `.env` có chữ tiếng Việt có dấu, bản cũ so sánh mã bằng chuỗi nên ném lỗi. Đã sửa (so trên bytes). |
| **Trình duyệt báo không kết nối được `127.0.0.1:8765`** | Xem lại cửa sổ đã chạy `serve.py`: nếu ở đó là `UnicodeEncodeError: 'charmap' codec can't encode character` thì **máy chủ đã chết trước khi mở cổng** — console Windows không in được chữ có dấu. Đã sửa trong mã (`class_pulse/console.py`), `git pull` rồi chạy lại. Cách chữa tạm không cần sửa mã: `set PYTHONUTF8=1` (cmd) hoặc `$env:PYTHONUTF8=1` (PowerShell) trước khi chạy. |
| Vào được nhưng chỉ thấy ô nhập mã | Đúng như thiết kế — xem mục 4a. Mã nằm ở `CLASS_PULSE_PASSCODE` trong `.env`. |
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
