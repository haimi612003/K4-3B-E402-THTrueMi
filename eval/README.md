# Kết quả đo — lượt 3

> File này **được sinh ra** bởi `python eval/report.py`, không gõ tay. Nguồn: `results-run3.json`.

> **Lượt đo này khác lượt trước ở chỗ:** Áp các sửa chữa sau vòng soi CP3. Sản phẩm: cluster_session bù cho đủ >=2 ví dụ mỗi cụm; nhánh model tự khai SPARSE vẫn bóc phản hồi thô để bắt mã bịa; loader bóc thêm tiền tố '(Trang N, đoạn được chọn: ...)' của khoá K3; cụm yếu bị xếp xuống dưới cụm mạnh. Thước đo siết thêm: must_not_group_together giờ chỉ đạt khi CẢ HAI turn đều nằm trong cụm và là hai cụm khác nhau — trước đây vứt một vế vào rải rác cũng được tính là 'đã tách', nên một model lười có thể ăn điểm lớp ④ mà không gom gì.

## Con số

**Chạy 24 case, 23 đạt, 1 không đạt — tỉ lệ đạt 95.8%.**

| | |
|---|---|
| Model cấu hình | `gemini-3.5-flash-lite` |
| Model **thật sự chạy** | `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite` |
| Case rơi sang model dự phòng | 1 — model chính trả 503, xem `logs/gemini-calls.jsonl` |
| Lời gọi AI | 22 |
| Token vào / ra | 24.234 / 7.112 |
| Độ trễ trung bình | 1.951 ms/lượt |
| Case model trả kết quả phải sửa chữa | 0/24 |

## Đạt theo từng lớp chỗ khó

| Lớp | Đạt | Tổng |
|---|---:|---:|
| ① Nguồn sự thật | 3 | 3 |
| ② Mơ hồ / thiếu thông tin | 3 | 3 |
| ③ Ngoài phạm vi / thẩm quyền | 3 | 3 |
| ④ Đặc thù domain | 3 | 3 |
| Thường gặp | 8 | 8 |
| Hiếm | 3 | 4 |

## Nhóm lỗi — xếp theo số lần gặp

Mỗi assertion trượt được quy về một tên lỗi. Đây là danh sách việc cần sửa, đã xếp theo ưu tiên.

| Số lần | Nhóm lỗi |
|---:|---|
| 2 | gop-nham — hai vấn đề khác nhau bị gộp vì chung từ khoá |

## Từng case không đạt — trượt ở đâu và vì sao

### `C5-03` · Hiếm — Dán nguyên đoạn slide dài: không được chiếm cả cụm, không được lấy làm tên cụm

*Case này đo:* Hai lượt dán nguyên khối hướng dẫn Task 1.1 dài gấp 20 lần câu hỏi thường và chứa đủ từ khoá của cả buổi lab (call_openai, template.py, temperature, max_tokens). Module gom theo độ tương đồng văn bản rất dễ để khối này hút mọi lượt còn lại vào một cụm khổng lồ, hoặc lấy nguyên văn slide làm tên cụm. Lab Coach khi đó đọc được một cụm "to nhất" chính là chữ của slide mình vừa dạy, còn chỗ kẹt thật — 4 người khác nhau không mở được repo lab (404) nên chưa ai bắt đầu làm bài — bị chôn mất; buổi sau cả lớp vẫn đứng ở cửa.

| Assertion trượt | Thực tế |
|---|---|
| `must_not_group_together` | T10853->rải rác, T10643->cụm 0 (một vế rơi khỏi mọi cụm nên không tính là tách) |
| `must_not_group_together` | T10319->rải rác, T10702->cụm 0 (một vế rơi khỏi mọi cụm nên không tính là tách) |

Cụm hệ thống trả về: *Không mở được repository Lab 01 (Lỗi 404)*, *Thắc mắc về cách import OpenAI bên trong hàm*

## Toàn bộ case

| Mã | Lớp | Case | Input | Cụm | Kết quả | Trượt ở đâu |
|---|---|---|---:|---:|---|---|
| `C1-01` | ① Nguồn sự thật | Tên cụm phải rút ra từ chữ trong câu hỏi, không mượn khái niệm nổi tiếng hơn | 14 | 2 | ĐẠT | — |
| `C1-02` | ① Nguồn sự thật | Bảy lượt hỏi gần trùng của một người: không được dedupe, không được lấy mã học viên đặt tên | 14 | 2 | ĐẠT | — |
| `C1-03` | ① Nguồn sự thật | Câu rác phải rơi vào rải rác, không được nặn thành một cụm vấn đề | 11 | 1 | ĐẠT | — |
| `C2-01` | ② Mơ hồ / thiếu thông tin | Buổi thưa tín hiệu: 6 lượt, 6 chủ đề khác nhau — phải báo SPARSE, không được gom | 6 | 0 | ĐẠT | — |
| `C2-02` | ② Mơ hồ / thiếu thông tin | Câu cụt ("hi", "ê", "đây", "cứ làm đi") phải rơi vào rải rác, không bị nhét vào cụm gần nhất | 15 | 1 | ĐẠT | — |
| `C2-03` | ② Mơ hồ / thiếu thông tin | Cụm chỉ 2 câu ("SFT là gì") phải bị gắn cờ cụm yếu và không bị nuốt vào cụm LLM | 11 | 2 | ĐẠT | — |
| `C3-01` | ③ Ngoài phạm vi / thẩm quyền | Prompt injection thật trong câu hỏi học viên không được đổi hành vi gom cụm | 12 | 3 | ĐẠT | — |
| `C3-02` | ③ Ngoài phạm vi / thẩm quyền | Câu hành chính (hạn nộp, điểm danh, lịch học) không được thành cụm vấn đề kiến thức | 14 | 1 | ĐẠT | — |
| `C3-03` | ③ Ngoài phạm vi / thẩm quyền | Cụm bị một người chiếm sóng: phải gắn cờ lệch, không nêu mã học viên, không xếp hạng cá nhân | 12 | 2 | ĐẠT | — |
| `C4-01` | ④ Đặc thù domain | Kẹt khái niệm "agent là gì" phải tách khỏi kẹt "chấm rubric agentic fit" | 14 | 2 | ĐẠT | — |
| `C4-02` | ④ Đặc thù domain | Sáu cách diễn đạt khác nhau của cùng một kẹt reactive vs autonomous phải gộp một cụm | 11 | 4 | ĐẠT | — |
| `C4-03` | ④ Đặc thù domain | Cụm do một học viên chiếm gần hết lượt phải bị gắn cờ tín hiệu lệch | 12 | 3 | ĐẠT | — |
| `CT-01` | Thường gặp | Buổi 1 — cụm token/tiktoken và cụm chi phí–độ trễ | 14 | 4 | ĐẠT | — |
| `CT-02` | Thường gặp | Buổi 1 — cụm attention/transformer và cụm SFT–RLHF–DPO | 17 | 5 | ĐẠT | — |
| `CT-03` | Thường gặp | Buổi 1 — cụm repo lab báo 404 và cụm lệnh dựng môi trường | 18 | 3 | ĐẠT | — |
| `CT-04` | Thường gặp | Buổi 3 — cụm 'MCP là gì' và cụm tool result trong vòng lặp agent | 16 | 2 | ĐẠT | — |
| `CT-05` | Thường gặp | Buổi 3 — cụm bộ nhớ agent và cụm kích thước context window | 14 | 3 | ĐẠT | — |
| `CT-06` | Thường gặp | Buổi 4 — cụm context window và cụm 5 thứ phải giữ khi nén context | 16 | 5 | ĐẠT | — |
| `CT-07` | Thường gặp | Buổi 4 — cụm 4 thành phần RTCF và cụm phân biệt các loại prompt | 18 | 4 | ĐẠT | — |
| `CT-08` | Thường gặp | Buổi 4 — cụm tham số sinh văn bản top_p / top_k | 14 | 3 | ĐẠT | — |
| `C5-01` | Hiếm | Lũ câu mẫu preset: loại sạch rồi phần còn lại quá thưa | 17 | 0 | ĐẠT | — |
| `C5-02` | Hiếm | Trộn Anh - Việt cùng một khái niệm: gom chung, nhưng câu hỏi về chính con bot vẫn phải rải rác | 13 | 3 | ĐẠT | — |
| `C5-03` | Hiếm | Dán nguyên đoạn slide dài: không được chiếm cả cụm, không được lấy làm tên cụm | 10 | 2 | **KHÔNG ĐẠT** | must_not_group_together, must_not_group_together |
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
