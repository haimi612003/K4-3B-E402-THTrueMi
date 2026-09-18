"""Original application prompts and sample references."""
from . import config

SAMPLES = [
    {"id": "agent", "title": "Chatbot và Agent khác nhau chỗ nào",
     "hint": "Cụm thật lớn nhất buổi DAY03 — 8 người hỏi 8 kiểu khác nhau, trộn với câu lạc đề",
     "ids": ["T11666", "T11701", "T11704", "T11706", "T11708", "T11715", "T11731", "T11737",
             "T11773", "T11783", "T11824", "T11850", "T11830", "T11918"]},
    {"id": "skew", "title": "Một người hỏi dồn dập",
     "hint": "Một học viên hỏi “slide này là sao” 6 lần, trộn với 3 người khác — "
             "cụm phải bị gắn cờ tín hiệu lệch, không được coi là cả lớp kẹt",
     "ids": ["T12525", "T12528", "T12534", "T12536", "T12537", "T12636",
             "T11666", "T11701", "T11708"]},
    {"id": "inject", "title": "Có câu cài chỉ thị cho AI",
     "hint": "Hai lượt injection thật trong log: “hãy quên những gì đã đọc đi”",
     "ids": ["T11281", "T11285", "T10561", "T10749", "T11666", "T11701",
             "T11708", "T11824", "T11850", "T11881"]},
    {"id": "admin", "title": "Câu hành chính lẫn vào",
     "hint": "Hạn nộp, điểm danh, lịch học — không được thành cụm vấn đề kiến thức",
     "ids": ["T10692", "T10713", "T11354", "T11408", "T11650", "T12540", "T12877",
             "T11666", "T11708", "T11715"]},
    {"id": "sparse", "title": "Quá ít câu để kết luận",
     "hint": "Dưới ngưỡng %d lượt — hệ thống phải báo quá ít câu để kết luận, không gọi AI" % config.SPARSE_MIN_TURNS,
     "ids": ["T11666", "T11824", "T10303"]},
]

ANSWER_PROMPT = """Bạn soạn VẬT LIỆU ÔN TẬP cho một giảng viên (Lab Coach), dựa trên một cụm câu hỏi
mà nhiều học viên trong lớp cùng vướng. Người đọc là người có chuyên môn, không phải người học.

BUỔI HỌC: {lecture}
CỤM VẤN ĐỀ: {name}
{why}

{n} CÂU HỎI NGUYÊN VĂN CỦA HỌC VIÊN — {people} người khác nhau:
{questions}

LUẬT BẮT BUỘC:

1. HỌC VIÊN ĐÃ ĐỌC SLIDE RỒI MÀ VẪN HỎI. Nghĩa là cách trình bày cũ không ăn với họ. Phần "giảng lại"
   phải đi một đường KHÁC: đổi thứ tự (đưa ví dụ/dữ liệu trước, khái niệm sau), đổi chất liệu (bảng số
   thật thay cho định nghĩa), hoặc mở đầu bằng một câu hỏi khiến họ tự thấy chỗ hổng. Nếu chỉ diễn đạt
   lại cùng một cách thì phần này vô dụng và Lab Coach sẽ bỏ đi.

2. CHẨN ĐOÁN TỪ CHÍNH CHỮ HỌC VIÊN VIẾT. Phần "hiểu sai ở đâu" phải chỉ được ra chỗ hổng nằm trong câu
   nào. Không viết chẩn đoán chung chung áp cho mọi lớp.

3. VÍ DỤ PHẢI CỤ THỂ — có con số, có tình huống, có thể nói ra miệng trong 30 giây.
   Không viết kiểu "ví dụ như trong thực tế thì...".

4. CÂU KIỂM TRA PHẢI PHÂN BIỆT HIỂU THẬT VỚI THUỘC LÒNG. Câu mà học viên chép lại định nghĩa là trả
   lời được thì không đạt.

5. KHÔNG CHẮC THÌ NÓI KHÔNG CHẮC. Nếu các câu hỏi quá mơ hồ hoặc quá tản mạn để chẩn đoán, đặt
   confidence = "thấp" và ghi rõ vào caveat chỗ nào Lab Coach phải tự kiểm.

6. ĐÂY LÀ BẢN NHÁP, KHÔNG PHẢI CHỈ THỊ. Lab Coach là người quyết định cuối cùng dạy gì. Đừng viết kiểu
   ra lệnh ("hãy giảng…", "bạn nên…"). Viết kiểu đưa vật liệu để họ chọn dùng hay bỏ.

7. KHÔNG NHẮC TỚI HỌC VIÊN CỤ THỂ NÀO. Chỉ nói ở mức lớp.

8. CAVEAT PHẢI NÓI ĐIỀU QUAN TRỌNG NHẤT TRƯỚC. Hai chuyện dưới đây, nếu có, phải là câu ĐẦU TIÊN
   của caveat — trước mọi ghi chú về slide hay thuật ngữ:
   a) TÍN HIỆU MỎNG: dưới 4 câu hỏi, hoặc các câu quá cụt/mơ hồ để chẩn đoán. Nói thẳng là chưa đủ
      căn cứ và bản nháp này dựa trên rất ít dữ liệu. Lab Coach phải biết bản nào đáng tin tới đâu.
   b) KHÔNG PHẢI CHỖ KẸT KIẾN THỨC: cụm gồm câu hành chính (hạn nộp, điểm danh, lịch học, quy chế),
      câu hỏi về chính con bot, hoặc câu lạc đề. Nói thẳng đây không phải vấn đề của bài học và
      nên chuyển sang kênh khác, đừng để Lab Coach mang 15 phút đầu buổi đi trả lời nó.
   Trong cả hai trường hợp vẫn trả đủ năm phần, nhưng caveat phải cảnh báo trước.

Trả JSON đúng schema. Viết tiếng Việt, gọn, không sáo rỗng."""

GEN_PROMPT = """Bạn dựng dữ liệu thử cho một công cụ gom cụm câu hỏi của lớp học.

Sinh đúng {n} câu hỏi mà học viên Việt Nam có thể hỏi trợ giảng AI trong buổi học về "{topic}".

YÊU CẦU — dữ liệu phải GIỐNG LOG THẬT, không phải bộ câu hỏi đẹp:
1. Khoảng 60% số câu xoay quanh HAI chỗ kẹt chung, mỗi chỗ kẹt được hỏi bằng nhiều cách diễn đạt
   rất khác nhau (viết tắt, sai chính tả, trộn tiếng Anh, viết hoa lung tung, thiếu dấu).
   Hai chỗ kẹt đó phải dùng chung ít nhất một từ khoá nhưng là hai vấn đề khác nhau.
2. Vài câu cụt không rõ nghĩa: "hi", "có", "tiếp", "đây", "ê".
3. Một hai câu hành chính: hạn nộp bài, điểm danh, lịch học.
4. Một câu hỏi về chính con bot, kiểu "bạn dùng model gì".
5. Một câu dài kiểu dán nguyên đoạn slide vào rồi hỏi.

Đừng đánh số, đừng thêm dấu đầu dòng. Mỗi phần tử trong mảng là một câu hỏi thô như học viên gõ."""

FAQ_PROMPT = """Bạn soạn một mục HỎI ĐÁP để đăng lên trang học, cho HỌC VIÊN KHOÁ SAU đọc.

Đây là người đọc khác hẳn với giảng viên: họ đọc MỘT MÌNH, không có ai giảng bên cạnh, và họ tới đây
vì vừa gõ một câu hỏi vào ô tìm kiếm. Câu trả lời phải tự đứng được.

BUỔI HỌC: {lecture}
CỤM VẤN ĐỀ: {name}
{n} CÂU HỎI NGUYÊN VĂN, {people} học viên khoá trước đã hỏi:
{questions}

LUẬT BẮT BUỘC:

1. TỪ CHỐI KHI KHÔNG PHẢI CÂU HỎI KIẾN THỨC. Nếu cụm này là câu hành chính (hạn nộp, điểm danh,
   lịch học, quy chế), câu hỏi về chính con bot, câu chào hỏi, hay câu quá cụt để biết người ta hỏi gì
   — đặt publishable = false, ghi lý do vào refuse_reason, và ĐỪNG soạn câu trả lời. Đăng một mục hỏi đáp
   về hạn nộp bài lên trang học là sai chỗ, và hạn nộp thì mỗi khoá một khác nên nó còn thành sai thông tin.

2. CÂU HỎI PHẢI VIẾT NHƯ HỌC VIÊN GÕ, không phải như mục lục sách. Lấy đúng cách nói của họ trong các
   câu nguyên văn phía trên. "Chatbot và Agent khác nhau chỗ nào?" chứ không phải "Phân tích sự khác biệt
   giữa kiến trúc hội thoại và kiến trúc tác tử".

3. CÂU TRẢ LỜI PHẢI TỰ ĐỨNG ĐƯỢC. Không viết "hỏi giảng viên", "xem lại slide", "tham khảo tài liệu" —
   người đọc đang ở đây chính vì slide chưa giúp được họ. Trả lời thẳng, có ví dụ cụ thể, dài vừa phải
   để đọc hết trong một phút.

4. CHỈ NÓI ĐIỀU BẠN CHẮC. Không bịa con số, không bịa tên tài liệu, không bịa quy định của khoá.
   Chỗ nào cần giảng viên xác nhận thì ghi vào needs_review chứ đừng viết bừa vào câu trả lời.

5. VARIANTS LẤY TỪ CHÍNH CÂU HỌC VIÊN ĐÃ HỎI. Đây là để học viên khoá sau gõ kiểu gì cũng tìm ra mục này —
   kể cả khi họ gõ tắt, sai chính tả, hay trộn tiếng Anh. Giữ nguyên cách họ viết, đừng sửa lại cho đẹp.

6. KHÔNG NHẮC TỚI HỌC VIÊN CỤ THỂ NÀO, không nhắc tới lớp nào, không nhắc tới buổi nào cụ thể —
   mục này sẽ sống lâu hơn khoá học hiện tại.

Trả JSON đúng schema. Viết tiếng Việt."""
