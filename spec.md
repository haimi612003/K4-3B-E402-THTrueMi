# Template AI Spec *(spec.md — commit trước hạn chốt spec: 21:00 18/9, tại CP4 · quality bar chốt từ thời điểm nộp)*

> Cấu trúc phủ đúng "SPEC 8 phần" của chương trình: Bằng chứng (§1-§2) · Lát cắt (§4) · Canvas (đính kèm CP1) · Augment/Automate (§4) · 4 đường đi của trải nghiệm (§6) · Kiểu lỗi (§5) · Kiểm thử (§7) · Phân công (§8). Hướng dẫn viết từng mục: `02-guide.md`.

```markdown
# AI SPEC — Trợ lý Discord: Duplicate Ticket Checker · Nhóm [XX] · Zone [X]
Hướng: [ ] A — VLearn  [x] B — Trợ lý Học viên  [ ] C — Làn mở
Loại: [ ] Tối ưu tính năng có sẵn  [x] Tính năng mới

> Track + đề: B · Trợ lý Discord — Duplicate Ticket Checker: hỗ trợ Learner kiểm tra câu hỏi/ticket tương tự đã tồn tại trong channel #hỏi-đáp trước khi tạo ticket mới; nếu chưa có, hỗ trợ Learner soạn ticket mới.

## §1. User & Job
- Job executor + workflow (đính kèm worksheet JTBD / ảnh sơ đồ):
  - **Learner:** học viên chương trình AI Thực Chiến tại VinUni, đang làm bài/lab và gặp vấn đề cần hỗ trợ; trước khi đăng vào #hỏi-đáp, Learner cần kiểm tra xem vấn đề tương tự đã được hỏi và xử lý trước đó hay chưa.
  - **Lab Coach:** người trực tiếp hỗ trợ và hướng dẫn Learner, đang theo dõi #hỏi-đáp và xử lý các ticket; cần nhận diện ticket mới có trùng/tương tự với vấn đề đã được hỗ trợ trước đó hay không để tránh phải kiểm tra và xử lý lặp lại.
- Core JTBD (không tên sản phẩm/AI trong câu):
  - Khi đang làm bài/lab và gặp vướng mắc, Learner muốn biết ngay liệu vấn đề của mình đã từng được hỏi và xử lý trong #hỏi-đáp hay chưa, để không phải mô tả lại từ đầu và chờ đợi một câu trả lời đã có sẵn.
  - Khi có ticket mới xuất hiện, Lab Coach muốn nhận diện ngay ticket nào trùng/tương tự vấn đề đã xử lý trước đó, để không phải đọc lại và giải quyết lặp lại cùng một việc.
- Problem statement (KHÔNG chữ AI):
  - Khi cần hỗ trợ, Learner phải tự tìm kiếm, đọc và đối chiếu các ticket cũ để biết vấn đề của mình đã được hỏi hay chưa, gây mất thời gian và dễ bỏ sót nên vẫn có thể tạo ticket trùng; các ticket trùng khiến Lab Coach phải dành thêm thời gian kiểm tra và xử lý lại vấn đề tương tự, làm tăng khối lượng ticket và có thể kéo dài thời gian phản hồi cho Learner. (Canvas mục 3)
- Evidence (chuẩn A và/hoặc B — log đầy đủ trong repo):
  - **Chuẩn B — Khảo sát** (`dataset.md`, n = 19, biểu mẫu "Khảo sát thời gian & quy trình tạo ticket hỗ trợ"):
    - **q2:** 10/19 (53%) chọn "tìm kiếm giải pháp đã tồn tại trên channel" là bước tốn nhiều thời gian nhất trong quy trình — đúng bước mà Duplicate Ticket Checker can thiệp.
    - **q3a:** 10/19 (53%) KHÔNG "luôn luôn" search trước khi tạo ticket (6 "thỉnh thoảng" + 4 "chưa bao giờ") → hơn một nửa Learner có nguy cơ tạo ticket trùng vì bỏ qua bước kiểm tra.
    - **q1:** 8/19 (42%) thấy quy trình hiện tại "hơi mất thời gian"; chỉ 3/19 (16%) thấy "rất nhanh và thuận tiện".
    - **q4:** điểm hài lòng trung bình 2,95/5; 15/19 (79%) chấm ≤ 3/5 cho quy trình hỗ trợ hiện tại.
    - **q5:** 16/19 (84%) sẵn sàng dùng thử nếu nhóm làm được giải pháp xử lý vấn đề này.
  - **Chuẩn A — Data mining** (`discord-pack/`, canvas mục 4 — đang thực hiện): kiểm tra [N] ticket trong #hỏi-đáp, xác định [X]/[N] ticket thuộc các nhóm trùng/tương tự bằng cách chuẩn hoá nội dung → nhóm ticket cùng lỗi/vấn đề → kiểm tra thủ công → ghi cặp/nhóm duplicate. Mã ticket minh hoạ: [ID-01] ↔ [ID-02], [ID-03] ↔ [ID-04], [ID-05] ↔ [ID-06]. *(Số và ID sẽ thay bằng kết quả mining thực tế — dataset.md hiện chỉ gồm câu hỏi trắc nghiệm, chưa có quote nguyên văn; ≥5 quote/ví dụ ticket thật sẽ lấy từ discord-pack khi mining xong.)*

## §2. Impact & quyết định chọn
- Bảng impact ≥3 ứng viên (bao nhiêu người · tần suất · tốn gì mỗi lần · khả thi):

  | Ứng viên | Bao nhiêu người | Tần suất | Tốn gì mỗi lần | Khả thi |
  |---|---|---|---|---|
  | **Duplicate Ticket Checker** — kiểm tra ticket trùng trước khi đăng | Toàn bộ Learner tạo ticket + Lab Coach trực #hỏi-đáp (19/19 khảo sát từng tạo ticket) | Mỗi lần Learner gặp vướng mắc cần hỏi — bước "tìm kiếm giải pháp đã tồn tại" chiếm 53% (q2) | Thời gian Learner tự search/đối chiếu ticket cũ; thời gian Lab Coach kiểm tra & xử lý lại ticket trùng | Cao — dữ liệu ticket cũ có sẵn trong `discord-pack/`, dùng retrieval/similarity trên text là đủ |
  | Auto-answer — AI trả lời trực tiếp thay Lab Coach | Toàn bộ Learner đặt câu hỏi kỹ thuật | Mỗi ticket mới | Rủi ro Learner làm sai bài nếu câu trả lời sai; Lab Coach mất kiểm soát chất lượng hỗ trợ | Thấp — cost-of-error cao, cần review người trước khi trả lời domain-specific |
  | Ticket triage/priority tagging cho Lab Coach | Chỉ Lab Coach (không giảm việc cho Learner) | Mỗi ticket mới vào hàng đợi | Không giải quyết được việc Learner vẫn phải tự mô tả lại vấn đề đã có sẵn | Trung bình — không chạm root pain (q2 cho thấy pain nằm ở phía Learner tìm kiếm) |
  | Digest/reminder nhắc Learner tự search trước khi hỏi | Toàn bộ Learner | Định kỳ (không đúng lúc Learner cần) | Nhắc suông không đảm bảo Learner thực sự search kỹ | Thấp — q3a cho thấy 53% đã không luôn luôn search dù quy trình đã yêu cầu, nhắc thêm khó thay đổi hành vi |

- Ứng viên ĐÃ LOẠI + vì sao:
  - **Auto-answer:** loại vì cost-of-error cao — AI trả lời sai thay Lab Coach có thể khiến Learner đi sai hướng khi làm bài, không phù hợp mức độ willing (không ai trong khảo sát yêu cầu AI tự trả lời thay).
  - **Ticket triage cho Lab Coach:** loại vì chỉ hỗ trợ phía Lab Coach, không giảm được pain chính của Learner (q2: 53% pain nằm ở bước "tìm kiếm giải pháp đã tồn tại", không phải bước Lab Coach xử lý).
  - **Digest/reminder:** loại vì can thiệp thụ động, không đúng thời điểm Learner cần nhất (lúc gõ ticket); dữ liệu q3a cho thấy nhắc suông (dạng checklist) không đủ vì 53% Learner vẫn không luôn luôn search.
- Ứng viên CHỌN + vì sao (bằng số): **Duplicate Ticket Checker** — chọn vì: (1) q2: 10/19 (53%) xác nhận đúng bước "tìm kiếm giải pháp đã tồn tại" là bước tốn thời gian nhất; (2) q3a: 10/19 (53%) không luôn luôn search trước khi hỏi → nguy cơ tạo ticket trùng cao, đúng vấn đề cần giải; (3) q4: mức hài lòng hiện tại chỉ 2,95/5 (15/19 ≤ 3/5) cho thấy dư địa cải thiện lớn; (4) q5: 16/19 (84%) sẵn sàng dùng thử giải pháp — đủ willing user để validate; (5) khả thi kỹ thuật cao vì dữ liệu ticket cũ đã có sẵn trong `discord-pack/`.

## §3. Giải pháp tương tự đã nghiên cứu
- [Sản phẩm 1]: flow / đáng học / đáng né / mình khác gì
- [Sản phẩm 2]: ...

## §4. Thiết kế
- Lát cắt MỘT CÂU (1 user · 1 việc · 1 quyết định AI · 1 kết quả):
- Non-goals (≥3 thứ KHÔNG build):
- Mức prototype nhắm tới: [ ] Sketch [ ] Mock [ ] Working — phần nào mock, phần nào thật:
- Automation: [ ] augment [ ] conditional [ ] automate — lý do theo cost-of-error:
- §4b. Nguyên tắc đã áp dụng (≥4 — HAX/PAIR, xem guide):
  | Nguyên tắc | Áp cụ thể vào đâu trong prototype |
  |---|---|

## §5. Kiểu lỗi — 4 lớp chỗ khó + kịch bản (≥8) [bảng theo guide §2.5]

## §6. Bốn đường đi của trải nghiệm
- Happy path: · Low-confidence (②): · Failure/không căn cứ (①): · Correction (user sửa):
- Khi bị đòi ngoài phạm vi (③): · Case đặc thù domain (④):

## §7. Kiểm thử
- Chiều chất lượng + định nghĩa kiểm chứng được:
- Golden set (≥20 case theo cơ cấu trong guide §2.6, file trong eval/):
- Quality bar (chốt từ hạn chốt spec của khoá, giữ nguyên sau đó): "Đạt khi ≥ ___% qua bộ, và ___"
- Kết quả các lượt chạy (bảng % — cập nhật đến trước CP6):

## §8. Phân công & kế hoạch
- Phân công có tên: spec / evidence / prompt / code / demo
- Willing users (≥2 tên) + kế hoạch vòng validation *(bonus, nếu làm)*:
- Multi-prototype (nếu làm): trục khác biệt của ≥2 phương án + lý do chọn:

## §9. Changelog
| Thời điểm | Đổi gì | Vì sao (trỏ về feedback/case nào) |
```
