# Dataset — Khảo sát thời gian & quy trình tạo ticket hỗ trợ

- **Nguồn:** `Khao sat thoi gian va quy trinh tao ticket ho tro (Câu trả lời).xlsx`
- **Sheet:** `Câu trả lời biểu mẫu 1`
- **Số phản hồi (n):** 19
- **Mục đích:** Bằng chứng khảo sát cho spec "Duplicate Ticket Checker" (xem `spec.md` §1, `canvas.md` mục 4).

## Fields

| Mã | Câu hỏi gốc |
|---|---|
| `ts` | Dấu thời gian |
| `q1` | Bạn cảm thấy như thế nào về thời gian dành ra để tạo ticket hỗ trợ và chờ phản hồi? |
| `q2` | Theo bạn, bước nào trong quá trình tạo ticket hoặc tìm kiếm giải pháp đang tốn nhiều thời gian nhất? |
| `q3a` | Checklist — Search forum bằng phím tắt để kiểm tra đã có người gặp vấn đề tương tự chưa |
| `q3b` | Checklist — Tự thử ít nhất hai cách xử lý và đọc kỹ tài liệu/thông báo lỗi |
| `q3c` | Checklist — Hỏi trong forum của team trước nếu câu hỏi liên quan mã nguồn team |
| `q4` | Mức độ hài lòng với quy trình hỗ trợ giải đáp thắc mắc hiện tại (1–5) |
| `q5` | Nếu nhóm tạo được giải pháp xử lý vấn đề của bạn, bạn có sẵn sàng dùng thử không? |

### Miền giá trị

- `q1`: Rất nhanh và thuận tiện · Bình thường · Hơi mất thời gian
- `q2`: Mô tả vấn đề bạn đang gặp phải · Tìm kiếm giải pháp đã tồn tại trên channel · Chờ đợi phản hồi từ labcoach
- `q3a`/`q3b`/`q3c`: Luôn luôn thực hiện · Thỉnh thoảng thực hiện · Chưa bao giờ thực hiện
- `q4`: 1 → 5 (1 = rất không hài lòng, 5 = rất hài lòng)
- `q5`: Có · Không

## Dữ liệu (19 phản hồi)

| # | ts | q1 | q2 | q3a | q3b | q3c | q4 | q5 |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-09-17 19:02:42 | Hơi mất thời gian | Mô tả vấn đề bạn đang gặp phải | Luôn luôn thực hiện | Thỉnh thoảng thực hiện | Thỉnh thoảng thực hiện | 3 | Có |
| 2 | 2026-09-17 19:02:44 | Bình thường | Tìm kiếm giải pháp đã tồn tại trên channel | Thỉnh thoảng thực hiện | Luôn luôn thực hiện | Luôn luôn thực hiện | 4 | Có |
| 3 | 2026-09-17 19:04:02 | Bình thường | Tìm kiếm giải pháp đã tồn tại trên channel | Thỉnh thoảng thực hiện | Chưa bao giờ thực hiện | Chưa bao giờ thực hiện | 3 | Có |
| 4 | 2026-09-17 19:11:39 | Rất nhanh và thuận tiện | Mô tả vấn đề bạn đang gặp phải | Luôn luôn thực hiện | Luôn luôn thực hiện | Luôn luôn thực hiện | 1 | Không |
| 5 | 2026-09-17 19:11:41 | Bình thường | Mô tả vấn đề bạn đang gặp phải | Thỉnh thoảng thực hiện | Thỉnh thoảng thực hiện | Chưa bao giờ thực hiện | 3 | Có |
| 6 | 2026-09-17 19:19:31 | Hơi mất thời gian | Tìm kiếm giải pháp đã tồn tại trên channel | Chưa bao giờ thực hiện | Luôn luôn thực hiện | Thỉnh thoảng thực hiện | 2 | Có |
| 7 | 2026-09-17 19:55:46 | Bình thường | Tìm kiếm giải pháp đã tồn tại trên channel | Thỉnh thoảng thực hiện | Thỉnh thoảng thực hiện | Luôn luôn thực hiện | 4 | Có |
| 8 | 2026-09-17 19:56:34 | Hơi mất thời gian | Mô tả vấn đề bạn đang gặp phải | Luôn luôn thực hiện | Thỉnh thoảng thực hiện | Luôn luôn thực hiện | 3 | Có |
| 9 | 2026-09-17 19:56:48 | Bình thường | Chờ đợi phản hồi từ labcoach | Chưa bao giờ thực hiện | Thỉnh thoảng thực hiện | Thỉnh thoảng thực hiện | 3 | Có |
| 10 | 2026-09-17 19:58:47 | Hơi mất thời gian | Tìm kiếm giải pháp đã tồn tại trên channel | Thỉnh thoảng thực hiện | Thỉnh thoảng thực hiện | Chưa bao giờ thực hiện | 3 | Không |
| 11 | 2026-09-17 19:58:47 | Hơi mất thời gian | Chờ đợi phản hồi từ labcoach | Luôn luôn thực hiện | Luôn luôn thực hiện, Thỉnh thoảng thực hiện | Chưa bao giờ thực hiện | 3 | Có |
| 12 | 2026-09-17 19:59:19 | Rất nhanh và thuận tiện | Mô tả vấn đề bạn đang gặp phải | Chưa bao giờ thực hiện | Luôn luôn thực hiện | — | 1 | Có |
| 13 | 2026-09-17 20:03:41 | Rất nhanh và thuận tiện | Tìm kiếm giải pháp đã tồn tại trên channel | Luôn luôn thực hiện | Luôn luôn thực hiện | Luôn luôn thực hiện | 5 | Có |
| 14 | 2026-09-17 20:06:37 | Hơi mất thời gian | Tìm kiếm giải pháp đã tồn tại trên channel | Luôn luôn thực hiện | Luôn luôn thực hiện | Luôn luôn thực hiện | 2 | Có |
| 15 | 2026-09-17 20:06:43 | Hơi mất thời gian | Tìm kiếm giải pháp đã tồn tại trên channel | Luôn luôn thực hiện | Thỉnh thoảng thực hiện | Chưa bao giờ thực hiện | 3 | Có |
| 16 | 2026-09-17 20:08:14 | Bình thường | Mô tả vấn đề bạn đang gặp phải | Luôn luôn thực hiện | Thỉnh thoảng thực hiện | Chưa bao giờ thực hiện | 3 | Có |
| 17 | 2026-09-17 20:09:19 | Bình thường | Chờ đợi phản hồi từ labcoach | Luôn luôn thực hiện | Luôn luôn thực hiện | Chưa bao giờ thực hiện | 4 | Có |
| 18 | 2026-09-17 20:10:03 | Hơi mất thời gian | Tìm kiếm giải pháp đã tồn tại trên channel | Thỉnh thoảng thực hiện | Thỉnh thoảng thực hiện | Thỉnh thoảng thực hiện | 3 | Có |
| 19 | 2026-09-17 20:13:26 | Bình thường | Tìm kiếm giải pháp đã tồn tại trên channel | Chưa bao giờ thực hiện | Chưa bao giờ thực hiện | Chưa bao giờ thực hiện | 3 | Không |

## Ghi chú

- Phản hồi #12: `q3c` bỏ trống (không có dữ liệu), ký hiệu `—`.
- Phản hồi #11: `q3b` chọn nhiều đáp án (`Luôn luôn thực hiện, Thỉnh thoảng thực hiện`).
- `q4` lưu dạng số thực (1.0–5.0) trong file gốc; bảng trên làm tròn về số nguyên.
