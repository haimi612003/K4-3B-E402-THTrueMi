# Kết quả đo — lượt 4

> File này **được sinh ra** bởi `python eval/report.py`, không gõ tay. Nguồn: `results-run4.json`.

> **Lượt đo này khác lượt trước ở chỗ:** SUA BO DO, khong sua san pham. Luot 1-3 truyen case[title] lam nhan buoi, ma PROMPT nhet nhan do vao dong 'cau hoi hoc vien da hoi trong buoi "{lecture}"' — nen model doc duoc nguyen van tieu de ca kiem thu, vot chinh la dap an (vi du 'Cau rac phai roi vao rai rac, khong duoc nan thanh mot cum'). Log tho xac nhan ca 22 loi goi deu dinh. Luot 4 truyen nhan buoi trung tinh 'K4P1/D04' dung nhu san pham that. Con so luot 4 KHONG so truc tiep duoc voi luot 1-3.

## Con số

**Chạy 24 case, 22 đạt, 2 không đạt — tỉ lệ đạt 91.7%.**

| | |
|---|---|
| Model cấu hình | `gemini-3.5-flash-lite` |
| Model **thật sự chạy** | `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite` |
| Case rơi sang model dự phòng | 1 — model chính trả 503, xem `logs/gemini-calls.jsonl` |
| Lời gọi AI | 22 |
| Token vào / ra | 23.915 / 7.101 |
| Độ trễ trung bình | 1.915 ms/lượt |
| Case model trả kết quả phải sửa chữa | 0/24 |

## Đạt theo từng lớp chỗ khó

| Lớp | Đạt | Tổng |
|---|---:|---:|
| ① Nguồn sự thật | 3 | 3 |
| ② Mơ hồ / thiếu thông tin | 2 | 3 |
| ③ Ngoài phạm vi / thẩm quyền | 2 | 3 |
| ④ Đặc thù domain | 3 | 3 |
| Thường gặp | 8 | 8 |
| Hiếm | 4 | 4 |

## Nhóm lỗi — xếp theo số lần gặp

Mỗi assertion trượt được quy về một tên lỗi. Đây là danh sách việc cần sửa, đã xếp theo ưu tiên.

| Số lần | Nhóm lỗi |
|---:|---|
| 7 | nhet-cau-lac — câu lạc đề/quá ngắn bị nhét vào cụm gần nhất |
| 1 | nan-cum-khi-thua — tín hiệu quá thưa mà vẫn nặn ra cụm |

## Từng case không đạt — trượt ở đâu và vì sao

### `C2-01` · ② Mơ hồ / thiếu thông tin — Buổi thưa tín hiệu: 6 lượt, 6 chủ đề khác nhau — phải báo SPARSE, không được gom

*Case này đo:* Đo xem hệ thống có dám nói "chưa đủ dữ liệu" thay vì cố nặn ra cụm. Đây là tập con THẬT của buổi L2-L3-K4P1/D04: cả buổi 23 lượt, trong đó 9 lượt câu mẫu, còn 14 lượt thực (khớp con số trong spec §6). Từ 14 lượt thực đã cố tình loại hết nhóm lặp (4 lượt hỏi "bán kính dung sai", chùm YOLO-Pose/ViTPose/Transformer, cặp "giải thích trang 20"), giữ lại 6 lượt là 6 chỗ kẹt rời rạc: xin ví dụ cho "1. Lệch nhẹ" (T12553), COCO là gì (T13209), xác định khớp trái/phải (T13360), tóm tắt bài (T13381), OKS chấm điểm (T13389), YOLO11-Pose (T13404). Lấy đúng 6 lượt là có chủ đích: cổng SPARSE deterministic trong codebase chỉ bật khi số lượt < SPARSE_MIN_TURNS = 6, nên ở đúng 6 lượt cổng KHÔNG bật và model buộc phải tự quyết — case này đo model, không đo cổng; nếu ai đó đổi ngưỡng thì phải xem lại case. Hai cặp dễ bị gộp nhầm đã cân nhắc trước: T13209 (định nghĩa bộ dữ liệu COCO) với T13360 (cách phân biệt khớp trái/phải), và T12553 (xin ví dụ cho một gạch đầu dòng trên slide) với T13389 (cơ chế OKS chấm điểm) — mỗi cặp chung từ khoá nhưng kẹt ở hai chỗ khác nhau, đúng trường hợp luật 1 của prompt bắt phải để riêng, nên gộp lại là gộp nhầm chứ không phải một cách đọc hợp lý khác. Nếu hệ thống vẫn nặn ra cụm, Lab Coach sẽ mang một 'vấn đề chung của lớp' hoàn toàn bịa lên đầu buổi sau, dạy lại thứ chỉ đúng một người hỏi, và mất niềm tin vào toàn bộ báo cáo.

| Assertion trượt | Thực tế |
|---|---|
| `expect_sparse` | sparse=False, mong đợi True |

Cụm hệ thống trả về: *Hiểu khái niệm Coco trong bài học*, *Cách xác định khớp trái phải trên cơ thể người*, *Ảnh hưởng của OKS đến việc chấm điểm pose*

### `C3-02` · ③ Ngoài phạm vi / thẩm quyền — Câu hành chính (hạn nộp, điểm danh, lịch học) không được thành cụm vấn đề kiến thức

*Case này đo:* Bảy lượt hành chính thật, trong đó ba lượt về hạn nộp bài (T11408, T11650, T12540) và hai lượt về điểm danh (T11354, T12877) giống nhau tới mức mọi bộ gom cụm theo độ tương đồng ngữ nghĩa sẽ dựng thành cụm. Case đo ranh giới thẩm quyền: sản phẩm chỉ báo chỗ kẹt KIẾN THỨC, việc hạn nộp/điểm danh/lịch học là của vận hành lớp, không phải thứ Lab Coach dạy lại — luật 3 trong prompt của cluster.py gọi đích danh loại này và bắt cho vào nhóm rải rác. Đặt cạnh đó là bảy lượt kiến thức thật cùng buổi quanh dòng 'FAQ nội bộ HR' trong bảng chấm agentic fit (T11801, T11802, T11803, T12094, T12155, T12160, T12165 — bảy học viên khác nhau), để cụm kiến thức đủ dày, model không có cớ báo sparse, và để thấy rõ nếu cụm hành chính chiếm chỗ. Nếu sai, báo cáo sau buổi đẩy 'Hạn nộp bài' lên thành cụm lớn nhất, Lab Coach mất thời gian đầu buổi sau giảng lại một thứ không phải kiến thức, trong khi cụm thật sự kẹt bị đẩy xuống dưới; tệ hơn là module ngầm hứa trả lời chuyện hành chính mà nó không có thẩm quyền.

| Assertion trượt | Thực tế |
|---|---|
| `must_be_unclustered` | T10692: nằm ở cụm 0 |
| `must_be_unclustered` | T10713: nằm ở cụm 0 |
| `must_be_unclustered` | T11354: nằm ở cụm 0 |
| `must_be_unclustered` | T11408: nằm ở cụm 0 |
| `must_be_unclustered` | T11650: nằm ở cụm 0 |
| `must_be_unclustered` | T12540: nằm ở cụm 0 |
| `must_be_unclustered` | T12877: nằm ở cụm 0 |

Cụm hệ thống trả về: *Quy chế lớp học, lịch học, điểm danh và hạn nộp bài*, *Tại sao FAQ nội bộ HR lại chỉ dùng một tool*

## Toàn bộ case

| Mã | Lớp | Case | Input | Cụm | Kết quả | Trượt ở đâu |
|---|---|---|---:|---:|---|---|
| `C1-01` | ① Nguồn sự thật | Tên cụm phải rút ra từ chữ trong câu hỏi, không mượn khái niệm nổi tiếng hơn | 14 | 2 | ĐẠT | — |
| `C1-02` | ① Nguồn sự thật | Bảy lượt hỏi gần trùng của một người: không được dedupe, không được lấy mã học viên đặt tên | 14 | 2 | ĐẠT | — |
| `C1-03` | ① Nguồn sự thật | Câu rác phải rơi vào rải rác, không được nặn thành một cụm vấn đề | 11 | 1 | ĐẠT | — |
| `C2-01` | ② Mơ hồ / thiếu thông tin | Buổi thưa tín hiệu: 6 lượt, 6 chủ đề khác nhau — phải báo SPARSE, không được gom | 6 | 3 | **KHÔNG ĐẠT** | expect_sparse |
| `C2-02` | ② Mơ hồ / thiếu thông tin | Câu cụt ("hi", "ê", "đây", "cứ làm đi") phải rơi vào rải rác, không bị nhét vào cụm gần nhất | 15 | 1 | ĐẠT | — |
| `C2-03` | ② Mơ hồ / thiếu thông tin | Cụm chỉ 2 câu ("SFT là gì") phải bị gắn cờ cụm yếu và không bị nuốt vào cụm LLM | 11 | 2 | ĐẠT | — |
| `C3-01` | ③ Ngoài phạm vi / thẩm quyền | Prompt injection thật trong câu hỏi học viên không được đổi hành vi gom cụm | 12 | 3 | ĐẠT | — |
| `C3-02` | ③ Ngoài phạm vi / thẩm quyền | Câu hành chính (hạn nộp, điểm danh, lịch học) không được thành cụm vấn đề kiến thức | 14 | 2 | **KHÔNG ĐẠT** | must_be_unclustered, must_be_unclustered, must_be_unclustered, must_be_unclustered, must_be_unclustered, must_be_unclustered, must_be_unclustered |
| `C3-03` | ③ Ngoài phạm vi / thẩm quyền | Cụm bị một người chiếm sóng: phải gắn cờ lệch, không nêu mã học viên, không xếp hạng cá nhân | 12 | 3 | ĐẠT | — |
| `C4-01` | ④ Đặc thù domain | Kẹt khái niệm "agent là gì" phải tách khỏi kẹt "chấm rubric agentic fit" | 14 | 2 | ĐẠT | — |
| `C4-02` | ④ Đặc thù domain | Sáu cách diễn đạt khác nhau của cùng một kẹt reactive vs autonomous phải gộp một cụm | 11 | 2 | ĐẠT | — |
| `C4-03` | ④ Đặc thù domain | Cụm do một học viên chiếm gần hết lượt phải bị gắn cờ tín hiệu lệch | 12 | 3 | ĐẠT | — |
| `CT-01` | Thường gặp | Buổi 1 — cụm token/tiktoken và cụm chi phí–độ trễ | 14 | 2 | ĐẠT | — |
| `CT-02` | Thường gặp | Buổi 1 — cụm attention/transformer và cụm SFT–RLHF–DPO | 17 | 5 | ĐẠT | — |
| `CT-03` | Thường gặp | Buổi 1 — cụm repo lab báo 404 và cụm lệnh dựng môi trường | 18 | 3 | ĐẠT | — |
| `CT-04` | Thường gặp | Buổi 3 — cụm 'MCP là gì' và cụm tool result trong vòng lặp agent | 16 | 3 | ĐẠT | — |
| `CT-05` | Thường gặp | Buổi 3 — cụm bộ nhớ agent và cụm kích thước context window | 14 | 3 | ĐẠT | — |
| `CT-06` | Thường gặp | Buổi 4 — cụm context window và cụm 5 thứ phải giữ khi nén context | 16 | 5 | ĐẠT | — |
| `CT-07` | Thường gặp | Buổi 4 — cụm 4 thành phần RTCF và cụm phân biệt các loại prompt | 18 | 4 | ĐẠT | — |
| `CT-08` | Thường gặp | Buổi 4 — cụm tham số sinh văn bản top_p / top_k | 14 | 4 | ĐẠT | — |
| `C5-01` | Hiếm | Lũ câu mẫu preset: loại sạch rồi phần còn lại quá thưa | 17 | 0 | ĐẠT | — |
| `C5-02` | Hiếm | Trộn Anh - Việt cùng một khái niệm: gom chung, nhưng câu hỏi về chính con bot vẫn phải rải rác | 13 | 3 | ĐẠT | — |
| `C5-03` | Hiếm | Dán nguyên đoạn slide dài: không được chiếm cả cụm, không được lấy làm tên cụm | 10 | 2 | ĐẠT | — |
| `C5-04` | Hiếm | Chỉ một lượt hỏi duy nhất: không được nặn ra cụm | 1 | 0 | ĐẠT | — |

## Golden set

24 case, 24 case lấy hoặc phát triển từ chatlog K4 thật. Tổng 314 lượt hỏi được đưa qua hệ thống.

| Nhóm | Số case | Yêu cầu CP3 |
|---|---:|---|
| ① Nguồn sự thật | 3 | ≥2 |
| ② Mơ hồ / thiếu thông tin | 3 | ≥2 |
| ③ Ngoài phạm vi / thẩm quyền | 3 | ≥2 |
| ④ Đặc thù domain | 3 | ≥2 |
| Thường gặp | 8 | 8–10 |
| Hiếm | 4 | 2–4 |

**Vì sao chấm bằng assertion chứ không chấm cảm tính.** Guide §2.6 đòi định nghĩa "đạt" phải rõ tới mức hai người chấm độc lập ra cùng kết quả. Mỗi case ở đây khai một bộ assertion máy kiểm được (`must_group_together`, `must_not_group_together`, `must_be_unclustered`, `expect_sparse`, `must_flag_skew_for_turn`…), nên hai người chạy lại luôn ra cùng con số — và người ngoài nhóm kiểm lại được.

Ngoài assertion do case khai, runner **luôn** kiểm thêm ba thứ cho mọi case: `no_invented_ids` (model không được trả về câu không có trong đầu vào), `no_duplicate_ids` (model không được xếp một câu vào hai cụm) và `counts_reconcile` (lượt các cụm cộng nhóm rải rác phải bằng tổng đầu vào).

**Hai assertion dưới đây là bảo đảm bằng CẤU TRÚC, không phải phép thử.** Nói rõ để không ai đọc nhầm chúng thành bằng chứng model làm tốt:

| Assertion | Vì sao nó không thể trượt |
|---|---|
| `no_student_identifiers` | `build_prompt()` không bao giờ đưa mã học viên vào prompt, nên model không có gì để lộ. Đây là thiết kế, không phải kết quả đo. |
| `counts_reconcile` | `cluster_session()` luôn đưa câu model bỏ quên về nhóm rải rác, nên tổng luôn khớp. Thứ đáng đọc là `no_invented_ids`, `no_duplicate_ids` và số case phải sửa chữa ở bảng trên. |
