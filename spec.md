# AI SPEC — Class Pulse: bản đồ vấn đề của lớp · Nhóm THTrueMi · Zone E402 (cụm C2)

Hướng: [x] A — VLearn (đề **A2** · tính năng mới cho giảng viên) [ ] B — Trợ lý Học viên [ ] C — Làn mở
Loại: [ ] Tối ưu tính năng có sẵn [x] Tính năng mới

> Prototype: [Claude Artifact](https://claude.ai/artifact/BHZpGwAdpKiAvULpymV8Xb) — link cũng nằm ở `codebase/Prototype design`.
> Bằng chứng: script `evidence/mine_k4.py` + log đầy đủ `evidence/mining-log.md`.

## §1. User & Job

- **Job executor + workflow:**

  **Lab Coach / giảng viên phụ trách một lớp.** Người thụ hưởng gián tiếp là học viên của lớp đó.

  Workflow hiện tại, 5 bước — chỗ gãy nằm ở bước 3:

  | #   | Bước                               | Làm bằng gì hôm nay                                      | Fail ở đâu                                                           |
  | --- | ---------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
  | 1   | Dạy xong một buổi                  | —                                                        | —                                                                    |
  | 2   | Muốn biết lớp kẹt ở đâu            | Nhớ lại vài câu học viên hỏi to trong lớp                | Chỉ nhớ được câu hỏi _to tiếng_, không phải câu _đông người_         |
  | 3   | **Tìm tín hiệu trong log câu hỏi** | Mở log, đọc từ trên xuống                                | **453–589 dòng mỗi buổi, không nhóm, không đếm → thực tế là bỏ qua** |
  | 4   | Quyết định ôn lại gì               | Cảm tính, hoặc hỏi miệng "có ai chưa hiểu chỗ nào không" | Lớp im lặng; người kẹt nhất thường là người không giơ tay            |
  | 5   | Lên lớp buổi sau                   | Ôn theo trí nhớ                                          | Có thể ôn đúng chỗ ít người vướng, trượt chỗ hơn nửa lớp vướng       |

  _Worksheet JTBD đầy đủ: chưa đính kèm — sẽ bổ sung sau khi phỏng vấn Lab Coach (xem phần "còn thiếu" cuối §1)._

  **Job story:** _Khi vừa dạy xong một buổi và phải soạn buổi kế tiếp trong vài tiếng, tôi muốn biết cả lớp đang vướng những vấn đề gì và vấn đề nào đông người vướng nhất, để dành thời gian đầu buổi sau vào đúng chỗ đó thay vì đoán._

- **Core JTBD (không tên sản phẩm/AI trong câu):**

  > Sau một chu kỳ dạy, **biết cả lớp đang vướng những vấn đề gì và vấn đề nào nhiều người vướng nhất**, để quyết định buổi sau ôn lại chỗ nào.

  _Tự kiểm (guide §1.1 câu 2): bỏ AI đi việc này vẫn tồn tại — Lab Coach vẫn phải ra quyết định "ôn gì" sau mỗi buổi, hôm nay họ làm bằng trí nhớ. Không phải đi tìm chỗ nhét AI._

- **Problem statement (KHÔNG chữ AI):**

  > Sau mỗi buổi học, Lab Coach cần biết cả lớp đang vướng những vấn đề gì và vấn đề nào nhiều người vướng nhất, để quyết định buổi sau ôn lại chỗ nào. Thông tin đó nằm rải rác trong log câu hỏi của trang học — hàng trăm dòng mỗi buổi, không nhóm, không đếm. Muốn biết thì phải đọc thủ công và gộp bằng trí nhớ, nên thực tế Lab Coach thường bỏ qua, hoặc chỉ nhớ vài câu ấn tượng và ôn theo cảm tính — trong khi vấn đề đông người vướng nhất có thể không phải câu nào trong số đó.

- **Evidence — đường B (mining), log đầy đủ trong repo:**
  - Số liệu mining / kết quả khảo sát (n = ?, % xác nhận):
  - ≥5 quote/ví dụ nguyên văn + nguồn:

## §2. Impact & quyết định chọn

Ứng viên ở đây là **các đề trong 5 track** của `01-challenge-brief.md`. Nhóm đã bắt đầu ở B2 tại CP1, bỏ, và chuyển sang A2 — lý do ở ngay dưới bảng.

- **Bảng impact (6 ứng viên):**

  | Đề                                                     | Bao nhiêu người                                                                                | Tần suất                           | Tốn gì mỗi lần                                                                        | Khả thi trong 39h                                                                                            |          |
  | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- |
  | **A2 · Bản đồ lỗ hổng của lớp cho giảng viên**         | 1 Lab Coach/lớp (khoá K4: 448 HV đang hoạt động, chia nhiều lớp) — **ít người dùng nhất bảng** | Mỗi buổi dạy                       | Đọc tay 453–589 lượt (30–65k ký tự), hoặc bỏ qua và ôn theo cảm tính                  | **Cao** — 2.555 lượt K4 gán nhãn được sẵn; đúng **một** quyết định AI; mọi con số đếm tay kiểm lại được      | **CHỌN** |
  | A1 · Tối ưu tutor (trả lời có căn cứ)                  | 448 HV K4 (1.617 toàn file) — **đông nhất bảng**                                               | Mỗi lượt hỏi (~425 lượt/ngày ở K4) | 27,1% lượt (839/3.097) tutor trả lời không trích dẫn → học viên tự kiểm hoặc tin nhầm | Trung bình — data sẵn, nhưng "trả lời tốt" phải có người chấm                                                | Loại     |
  | B2 · Bản tin cuối ngày cho TA _(hướng nhóm làm ở CP1)_ | TA/Mod của 2 server Discord                                                                    | Mỗi ngày                           | Đọc tin tồn, trả lời trùng                                                            | Thấp — data mỏng, xem lý do dưới                                                                             | Loại     |
  | C5 · FeedbackRadar (gom góp ý thành vấn đề)            | Studio team (vài người) + giảng viên                                                           | Mỗi đợt phát hành video            | Đọc tay ~100 góp ý, thường làm lại gần cả video                                       | Thấp — phải tự thu ~100 góp ý **kèm đáp án**, và phải phỏng vấn ≥3 người Studio team                         | Loại     |
  | D2/D3 · Học từ lỗi trước / học bằng cách dạy           | Học viên cả lớp                                                                                | Mỗi bài                            | Trình tự học hiện tại passive                                                         | Thấp — track D bắt buộc **≥5 bạn thật sự học một đoạn** bằng prototype + quality bar phải có chỉ số về _học_ | Loại     |
  | E · Làn mở                                             | tự xác định                                                                                    | —                                  | —                                                                                     | —                                                                                                            | Loại     |

- **Ứng viên ĐÃ LOẠI + vì sao:**
  - **A1 (tối ưu tutor).** Impact lớn nhất bảng về số người — nhưng nghẽn ở chỗ **đo**. Chuẩn "câu trả lời tốt" là phán đoán sư phạm; data không có nhãn sẵn để dựa vào: **chỉ 12/3.097 lượt K4 có rating (0,4% — 9 up / 3 down)** và `understanding_level` rỗng ở **3.091/3.097 lượt (99,8%)**. Nhóm 4 người tự chấm "trả lời này tốt hay không" thì golden set là ý kiến nhóm, không phải bằng chứng. Ngược lại, quyết định AI của A2 (gom cụm) **đếm tay kiểm lại được**: mở cụm ra, đếm câu, xem đúng hay sai. Loại vì đo được, không vì dễ.
  - **B2 (bản tin cho TA) — hướng nhóm đã làm ở CP1 rồi bỏ.** Ba lý do, theo `data/README.md`: pack chỉ **1.092 tin trong 3 ngày (12–14/09)**, chỉ kênh public — so với **2.555 lượt hỏi thực trong 6 ngày** của chatlog K4; data lệch hẳn về **câu hỏi hành chính tuần onboarding** (điểm danh, deadline, XP), không phải chỗ kẹt kiến thức; và **Mod/TA với học viên đều là `D####`, không phân biệt được** nên không đếm nổi "ai đang chịu tải" — tức là không xây được bảng impact cho chính nó. Đổi hướng ở CP1 → CP2 (ghi trong §9).
  - **C5 (FeedbackRadar).** Quyết định AI gần **giống hệt** A2: gom góp ý rời rạc thành vấn đề có số lượng và bằng chứng gốc. Loại vì hai thứ nhóm không có: bộ ~100 góp ý kèm đáp án phải **tự thu** (A2 đã có sẵn 2.555 lượt thật), và người dùng là Studio team mà chuẩn evidence track C đòi **phỏng vấn ≥3 người** — nhóm chưa có đầu mối.
  - **D2/D3.** Ràng buộc riêng của track D: phải có **≥5 bạn cùng lớp thực sự học một đoạn** bằng prototype và log được họ hiểu gì, và quality bar phải chứa ít nhất một chỉ số về _học_. Đó là một vòng validation dài hơn 39 giờ.
  - **E.** Chỉ dùng khi bài toán không nằm trong A–D. Bài toán này nằm đúng trong A2.

- **Ứng viên CHỌN + vì sao (bằng số):**

  A2 **không** phải ứng viên nhiều người dùng nhất — 1 Lab Coach/lớp so với 448 học viên của A1. Chọn vì bốn con số:
  1. **92,6% lượt hỏi thực là chuỗi duy nhất.** Không có cách rẻ hơn. Nếu `GROUP BY` giải được thì đề này không cần AI — và câu lặp nhiều nhất của cả khoá là "hi" (17 lần) đã chứng minh là không.
  2. **69/127 học viên một buổi hỏi quanh cùng một cụm khái niệm.** Cụm có thật, đủ lớn để đáng ôn, và đếm tay lại được bằng một regex công bố sẵn — sản phẩm không phải nặn ra vấn đề.
  3. **Một Lab Coach quyết định thay cho cả lớp.** Ít người dùng, nhưng mỗi quyết định sai làm 101–127 học viên mất 15 phút đầu buổi. Đòn bẩy nằm ở đó, không ở số người dùng.
  4. **Đúng một quyết định AI (gom cụm), mọi thứ khác là của con người**, và cả hai ca biên đều đã có sẵn trong data thật để test: buổi thưa nhất **14 lượt/10 HV** và ca một người chiếm **58/453 lượt**.

## §3. Giải pháp tương tự đã nghiên cứu

- [Sản phẩm 1]: flow / đáng học / đáng né / mình khác gì
- [Sản phẩm 2]: ...

## §4. Thiết kế

- **Lát cắt MỘT CÂU (1 user · 1 việc · 1 quyết định AI · 1 kết quả):**

  > Một **Lab Coach** · sau một chu kỳ dạy tự chọn (1 buổi, 2 buổi…) · hệ thống **gom các câu hỏi rời rạc của lớp thành những cụm vấn đề** kèm số lượt, số người, phần bài liên quan và ví dụ nguyên văn có ID · Lab Coach **thấy vấn đề nào nhiều người vướng nhất và tick chỗ để ôn buổi sau**.

  **Hai quyết định AI, tách hẳn nhau, cost-of-error khác nhau.** Chọn bao nhiêu cụm, ôn cụm nào, có dùng bản nháp hay không — đều là quyết định của Lab Coach.

  | | Quyết định 1 — **gom cụm** | Quyết định 2 — **soạn nội dung ôn** |
  |---|---|---|
  | Chạy khi nào | Tự động khi mở một buổi | **Chỉ khi Lab Coach bấm nút**, từng cụm một |
  | Sai thì hậu quả gì | Lab Coach ôn nhầm chỗ, 101–127 học viên mất 15 phút đầu buổi | Lab Coach đọc một bản nháp sai và phải bỏ đi |
  | Phát hiện sai dễ hay khó | **Dễ** — mở cụm ra, đọc 3 câu nguyên văn, 5 giây là biết | **Khó hơn** — nội dung sai mà nghe hợp lý thì phải có chuyên môn mới thấy |
  | Ai chặn ở giữa | Lab Coach duyệt trước khi lên lớp | Lab Coach duyệt trước khi lên lớp |
  | Đo bằng gì | 24 case, assertion máy kiểm được | 8 case, chỉ đo **tính kỷ luật** của output |
  | **Không** đo được gì | — | Đúng-sai kiến thức, và "có thật sự khác slide không" — cần Lab Coach chấm |

  **Vì sao quyết định 2 không phải là quay lại đề A1.** A1 là tối ưu tutor trả lời cho **học viên** — output đi thẳng tới người học, không ai chặn ở giữa, và toàn bộ chất lượng sản phẩm nằm ở phán đoán sư phạm mà nhóm không đo được. Ở đây output đi tới **Lab Coach**, người có chuyên môn, dưới nhãn *bản nháp*, và quyết định chính (gom cụm) đã có số đo độc lập. Học viên không bao giờ nhìn thấy nội dung này.

  Quyết định 2 vốn đã nằm trong luồng chính của bài toán từ đầu ("sang màn kết quả: nội dung ôn cho từng cụm đã chọn"). Hai câu hỏi treo lúc đó là *template gồm những gì* và *Lab Coach có thật sự cần nội dung soạn sẵn không* — câu thứ nhất đã chốt bằng 5 mục dưới đây, câu thứ hai vẫn chờ phỏng vấn.

  **Chủ đích thiết kế — vì sao bỏ con số 5.** Lát cắt gợi ý của đề ghi "gom thành **5** chỗ khó nhất". Nhóm bỏ con số 5: nó là cảm quan, không có căn cứ. Buổi `K4P1/D04` có ít nhất 3 cụm đếm tay được; buổi `L2-L3-K4P1/D04` chỉ có **14 lượt thực** — ép về 5 thì hoặc **nặn ra vấn đề không tồn tại**, hoặc **cắt mất vấn đề có thật**. Thay vào đó: gom được bao nhiêu cụm thì hiện bấy nhiêu, xếp giảm dần, **ngưỡng xử lý do Lab Coach chọn**.

- **Non-goals (≥3 thứ KHÔNG build):**
  1. **Không có bất kỳ view nào ở mức cá nhân học viên** — không xếp hạng, không "em nào yếu nhất", không hiện tên/ID người trên giao diện Lab Coach. Loại theo nguyên tắc an toàn, không phải vì thiếu thời gian.
  2. **Không tự chốt số cụm và không tự quyết ôn gì.** Không có nút "áp dụng cho buổi sau". Nội dung ôn chỉ sinh ra khi Lab Coach bấm từng cụm, luôn mang nhãn `BẢN NHÁP`, và prompt cấm viết kiểu ra lệnh — có assertion `no_imperative` canh chỗ này. Hệ thống đưa vật liệu, không khuyến nghị.
  3. **Không đánh giá chất lượng câu trả lời của tutor** (đó là A1) và không đụng vào tutor đang chạy — chỉ đọc log.
  4. **Không theo dõi xuyên buổi** (vấn đề này buổi trước đã ôn chưa, ôn rồi mà vẫn hỏi lại không) — ghi nhận cho V1+.
  5. **Không đánh giá bối cảnh slide** (slide dạng keyword tóm tắt và slide giải thích chi tiết cần giảng lại theo kiểu khác nhau) — có giá trị thật nhưng không phải đường xương sống của MVP.

- **Mức prototype nhắm tới:** [ ] Sketch [ ] Mock [x] **Working**

  Dashboard chạy trên kết quả AI thật: `codebase/ui/index.html`, bật bằng `python codebase/serve.py`.
  Bản mock của CP2 giữ lại để đối chiếu: [Claude Artifact](https://claude.ai/artifact/BHZpGwAdpKiAvULpymV8Xb).

  | | Nội dung |
  |---|---|
  | **Thật, có số đo** | Gom cụm bằng lời gọi Gemini thật trên 3 buổi K4 (511 / 453 / 3 lượt) · soạn nội dung ôn bằng lời gọi thật, từng cụm · tab **Thử trực tiếp**: người dùng nhập câu hỏi (bộ mẫu thật / nhờ AI sinh / tự gõ) và nhận cụm trong 1–3 giây · mọi lời gọi ghi prompt và phản hồi thô vào `logs/gemini-calls.jsonl` |
  | **Tính trong code, không do model quyết** | Số lượt, số người, cờ cụm yếu, cờ tín hiệu lệch, tên phần bài, cổng `SPARSE`, việc lọc câu mẫu — đều đếm tay kiểm lại được. Ngưỡng nằm ở `codebase/class_pulse/config.py` |
  | **Còn mock** | Không còn gì. Toàn bộ số trên giao diện sinh từ dữ liệu thật |
  | **Giới hạn đã biết** | Một số cụm là *yêu cầu thao tác* ("tóm tắt bài học", "trích xuất slide") chứ không phải chỗ kẹt kiến thức — sản phẩm chưa phân biệt được hai loại. Ghi nhận cho vòng sau |

  **Hai chỗ mining chỉ ra và đã sửa:** chip ngữ cảnh đổi từ số trang sang **tên phần** (99,6% câu neo theo tên phần, chỉ 5,9% có số trang); và mọi cụm trên giao diện giờ là cụm thật từ `K4P1/D04` chứ không phải ví dụ ML nhập môn dựng tay.

- **Automation:** [x] augment [ ] conditional [ ] automate

  **Lý do theo cost-of-error.** Gom sai thì **Lab Coach ôn nhầm chỗ, và 101–127 học viên mất 15 phút đầu buổi** — sai một lần, cả lớp trả giá, và không có đường lùi vì buổi học đã trôi. Nhưng **sửa thì rẻ**, với điều kiện người sửa nhìn thấy căn cứ: mở cụm ra, đọc 3 câu nguyên văn, 5 giây là biết gom đúng hay sai. Đó đúng là hình dạng của augment — AI làm phần người không làm nổi (đọc 2.555 câu và tìm ý chung), người giữ phần AI không được làm (quyết định dạy gì).

  Ba câu theo PAIR 1.3:
  - **AI luôn phải** đưa kèm mỗi cụm **≥2 câu nguyên văn có ID trỏ về dòng log**, và **cả hai** con số lượt/người.
  - **AI không được** đặt tên cụm bằng thứ không suy ra được từ các câu trong cụm, không được nhét câu lạc đề vào cụm gần nhất, và **không được xếp hạng hay hiển thị bất cứ gì ở mức cá nhân học viên** — kể cả khi Lab Coach yêu cầu.
  - **Nếu AI gom yếu**, Lab Coach không phiền **kéo vài câu ra khỏi cụm bằng tay**, miễn là nhìn thấy đủ câu nguyên văn để biết câu nào sai chỗ.

  Ba câu tương đương cho **quyết định 2 (soạn nội dung ôn)**:
  - **AI luôn phải** nói ra giới hạn của chính bản nháp: tín hiệu mỏng, hoặc cụm không phải chỗ kẹt kiến thức, phải là câu đầu tiên của phần *chỗ cần tự kiểm*.
  - **AI không được** viết kiểu ra lệnh cho Lab Coach, không được nhắc tới học viên cụ thể, và không được kéo vào khái niệm mà **không câu hỏi nào trong cụm nhắc tới**.
  - **Nếu AI soạn dở**, Lab Coach không phiền bỏ cả bản nháp — vì nó tốn một cú bấm và 2,5 giây, không phải một buổi soạn bài.

- **§4b. Nguyên tắc đã áp dụng (6 — HAX/PAIR):**

  | Nguyên tắc                                          | Áp cụ thể vào đâu trong prototype                                                                                                                                                                                                                                                                                                                                        |
  | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | **G1 — Làm rõ hệ thống làm được gì**                | Dòng dưới tiêu đề: "Bản đồ vấn đề của lớp cho Lab Coach". Ngay dưới bộ chọn là dòng `srcnote` gắn nhãn nguồn data (`mẫu từ chatlog K4` / `fixture giả lập`) — người dùng biết mình đang nhìn cái gì trước khi đọc bất kỳ con số nào. Dòng gợi ý cạnh tiêu đề danh sách nói thẳng hai thao tác có thể làm: mở cụm đọc câu nguyên văn, và bấm "Không thuộc cụm" để sửa tay |
  | **G2 — Làm rõ nó làm tốt đến đâu**                  | Ba tín hiệu khác nhau, mỗi tín hiệu một hình dạng riêng chứ không chỉ khác con số: chip **"cụm yếu"** (cụm ít người, đẩy xuống dưới các cụm mạnh) · chip **"tín hiệu lệch"** + thanh bar kẻ sọc (một người chiếm phần lớn lượt) · ô chỉ số **"đã loại N lượt câu mẫu"** hiện ngay trên đầu, nói rõ đã bỏ gì trước khi đếm                                                |
  | **G10 — Thu hẹp phạm vi khi nghi ngờ** _(bắt buộc)_ | Banner `SPARSE` ở buổi D5: khi số lượt thực quá ít, hệ thống **không gom cụm** mà nói thẳng "tín hiệu quá thưa để gom thành vấn đề của lớp — dưới đây là câu nguyên văn", kèm gợi ý mở rộng sang chu kỳ 2 buổi. Thà không trả lời còn hơn nặn ra một danh sách trông đáng tin                                                                                            |
  | **G9 — Sửa dễ dàng**                                | Mở cụm → mỗi câu nguyên văn có nút **"Không thuộc cụm"** → câu bị gạch ngang, chuyển sang nhóm rải rác, **số lượt của cụm trừ lại ngay** và hiện dòng "Đã chuyển N câu ra nhóm rải rác — số lượt đã trừ". Có **"Hoàn tác"**. Mỗi lần sửa cũng là một điểm dữ liệu đo chất lượng gom (§7)                                                                                 |
  | **G11 — Giải thích vì sao**                         | Căn cứ của việc gom **không giấu sau một icon**: mở cụm ra là câu nguyên văn kèm `turn_id`, dưới nhãn "ID trỏ về dòng log — không viết lại, không tóm tắt". Cụm nào có điểm đáng ngờ thì kèm một dòng giải thích ngay dưới thanh bar (ví dụ: "1 học viên chiếm 8/9 lượt")                                                                                                |
  | **G17 — Quyền kiểm soát tổng**                      | Bốn chỗ người dùng nắm quyền: chọn **chu kỳ** (1 buổi / 2 buổi) · đổi **trục xếp hạng** (số lượt ↔ số người — chính là thao tác lật tẩy cụm lệch) · **số cụm không cố định**, không cắt ở con số nào · **không tick cụm nào cũng là một kết quả hợp lệ**, trang tổng quan tự nó đã dùng được                                                                             |
  | _(PAIR — Mental Models)_                            | Đặt kỳ vọng **thấp hơn** khả năng: banner `NHÁP` trên màn 2 nói rõ template nội dung ôn **chưa chốt**; footer nói rõ phần gom cụm hiện là mock. Không có chỗ nào trong prototype hứa "AI biết lớp bạn cần học gì"                                                                                                                                                        |
  | _(PAIR — Errors + Graceful Failure)_                | Hai loại lỗi, hai đường lui khác nhau: **thiếu dữ liệu** → `SPARSE`, hiện câu thô, gợi ý đổi chu kỳ · **input mơ hồ** (câu quá ngắn, lạc đề) → nhóm "rải rác / không phân loại được", luôn hiện, không bị giấu và không bị nhét vào cụm gần nhất                                                                                                                         |

## §5. Kiểu lỗi — 4 lớp chỗ khó + kịch bản (≥8) [bảng theo guide §2.5]

## §6. Bốn đường đi của trải nghiệm

- **Happy path:**

  Buổi tối sau buổi học. Lab Coach mở trang, để mặc định "buổi gần nhất".

  Màn hình: **118 lượt · 34 học viên · đã loại 26 lượt câu mẫu · 4 cụm + 1 nhóm rải rác**. Danh sách xếp giảm dần, cụm đầu gắn chip **"đông nhất"** và thanh bar màu nóng:
  1. Phân biệt supervised và unsupervised — **41 lượt, 19 người** · _(3 câu nguyên văn có ID khi mở ra)_
  2. Overfitting là gì và vì sao xấu — 23 lượt, 14 người
  3. Train/test split chia bao nhiêu là đúng — 15 lượt, 11 người
  4. Đọc biểu đồ loss — 8 lượt, 6 người · chip **"cụm yếu"**
  5. Rải rác / không phân loại được — 5 lượt

  Lab Coach nhìn hai giây là thấy thứ mà đọc log thô không thấy được: **hơn một nửa lớp kẹt ở cùng một chỗ**, và đó là khái niệm nền của cả chương. Chị tick cụm 1 và 2 → thanh dưới hiện "**2 cụm đã chọn · 64 lượt hỏi · tới 19/34 học viên trong lớp**" → bấm sang màn nội dung ôn.

  Buổi sau, 15 phút đầu dành cho đúng hai chỗ đó — thay vì đoán, hoặc hỏi "có ai chưa hiểu gì không" rồi nhận lại im lặng.

  _(Nếu ép về con số 5 cứng như đề gốc, hệ thống sẽ phải nặn thêm một cụm thứ 5 từ nhóm rải rác — một vấn đề không tồn tại, đặt cạnh một vấn đề 41 lượt.)_

- **Low-confidence (②):**

  Cụm "Đọc biểu đồ loss" chỉ có **8 lượt / 6 người trên 34**. Hệ thống **vẫn hiện** — không giấu — nhưng làm cho nó **trông khác**: chip **"cụm yếu"**, thanh bar màu xám thay vì màu nóng, đặt **dưới** mọi cụm mạnh, kèm một dòng nói thẳng lý do: _"6 người trên 34 — dưới ngưỡng tin cậy, nên đọc tay trước khi quyết định ôn."_

  Không viết "độ tin cậy 62%". Con số đó không kiểm chứng được và chỉ tạo cảm giác chính xác giả. Viết **tử số và mẫu số** để Lab Coach tự phán đoán.

- **Failure / không căn cứ (①):**

  Buổi ôn tập, lớp hỏi ít. **19 lượt · 7 học viên · đã loại 9 lượt câu mẫu · còn 10 lượt thực.**

  Hệ thống **không gom**. Banner `SPARSE`: _"Chu kỳ này chỉ còn 10 lượt hỏi thật sau khi loại câu mẫu. Tín hiệu quá thưa để gom thành vấn đề của lớp — dưới đây là câu nguyên văn, chưa qua gom cụm. Cân nhắc chọn chu kỳ 2 buổi."_

  Ca này có thật trong data: buổi `L2-L3-K4P1/D04` chỉ có **14 lượt thực / 10 học viên**.

  Ba ràng buộc chống bịa, áp cho mọi đường đi:
  - Ví dụ minh hoạ mỗi cụm là **câu nguyên văn có `turn_id`** — không viết lại, không tóm tắt. Nhãn trên panel nói đúng điều đó.
  - **Tên cụm phải suy ra được từ các câu trong cụm.** Mở cụm ra mà không thấy tên cụm ở đâu trong các câu thì đó là lỗi.
  - **Mọi con số đếm lại được bằng tay.** Lượt + người + nhóm rải rác phải cộng đúng bằng tổng lượt thực.

- **Correction (user sửa):**

  Lab Coach thấy một câu bị gom nhầm → mở cụm → bấm **"Không thuộc cụm"** ngay cạnh câu đó. Câu bị gạch ngang, chuyển sang nhóm rải rác, **số lượt của cụm trừ lại ngay**, thanh bar co lại, và cụm hiện thêm dòng _"Đã chuyển N câu ra nhóm rải rác — số lượt đã trừ"_. Có **"Hoàn tác"**.

  Hai chủ đích: Lab Coach không phải chấp nhận cả cụm hay bỏ cả cụm — sửa được từng câu; và **mỗi lần bấm là một điểm dữ liệu đo chất lượng gom**, thu ngay trong luồng dùng thật thay vì phải hỏi "bạn thấy nó gom đúng không" (§7).

  Đường lùi thô hơn, luôn có: **không tick cụm nào**. Trang tổng quan tự nó đã là một deliverable — Lab Coach có thể chỉ xem rồi tự lên lớp trả lời.

- **Khi bị đòi ngoài phạm vi (③):**

  Lab Coach hỏi _"em nào yếu nhất lớp"_ / _"cho tôi xem bạn S0452 hỏi những gì"_ → **từ chối, và giải thích**: hệ thống chỉ làm việc ở **mức lớp**; dữ liệu này không dùng để đánh giá học viên dưới bất kỳ hình thức nào. Rồi đưa lại thứ gần nhất **có** làm được: cụm nào đang gắn cờ "tín hiệu lệch" — tức là _có_ một người đang kẹt nhiều, và việc cần làm là **nhắn riêng**, không phải dành 15 phút của cả lớp.

  Ca thật trong data: `S0452` chiếm **58/453 lượt (12,8%)** của buổi `K4P1/D08`, trong khi trung vị là 2 lượt/học viên. Xếp theo lượt thì cụm của bạn này lên đầu; đổi sang xếp theo **số người** thì nó rơi xuống cuối. Đó là lý do nút đổi trục xếp hạng tồn tại.

  **Tự khai — chưa làm xong:** prototype hiện thực thi điều này **bằng thiết kế** (không có chỗ nào trên giao diện hiện tên/ID học viên, không có ô nhập câu hỏi tự do). Nhưng chưa có **trạng thái từ chối nhìn thấy được**. Khi thêm ô hỏi tự do thì phải có màn từ chối kèm giải thích — hiện đang là non-goal, ghi ở đây để không quên.

  Ràng buộc an toàn đi kèm: ID trong giao diện là **mã dòng log**, không phải mã người · ví dụ nguyên văn đi qua bước ẩn danh, câu chứa thông tin nhận dạng thì lọc hoặc che · Lab Coach là người quyết định cuối cùng về nội dung dạy · data trong pack không ra khỏi khoá, không commit vào repo nộp bài.

- **Case đặc thù domain (④):**

  Chỗ nguy hiểm nhất **không phải** gom sót, mà là **gộp hai vấn đề khác nhau chỉ vì chúng dùng chung một từ khoá**. Gom sót thì Lab Coach thiếu một cụm nhỏ. Gộp nhầm thì Lab Coach nhìn thấy một cụm to giả và dạy sai chỗ cho cả lớp.

  Ca thật, đếm được, trong buổi `K4P1/D04`:

  |                                            | Lượt / người    | Học viên đang kẹt ở đâu                       | Ví dụ                                                             |
  | ------------------------------------------ | --------------- | --------------------------------------------- | ----------------------------------------------------------------- |
  | Nhóm A — _phân biệt chatbot / LLM / agent_ | 29 lượt / 26 HV | Khái niệm nền: agent khác chatbot ở chỗ nào   | `T11666` "ReAct Agent và Chatbot thông thường khác nhau thế nào?" |
  | Nhóm B — _chấm agentic fit cho use case_   | 17 lượt / 14 HV | Cách chấm điểm bài lab theo rubric 4 tiêu chí | `T11773` "Bài tập nhanh: Chấm agentic fit cho use case của nhóm…" |

  Cả hai đều khớp từ khoá `agent`. Gộp lại → một cụm "46 lượt / 40 người về agent", và Lab Coach sẽ giảng lại khái niệm agent cho 40 người, trong khi 14 người trong số đó chỉ đang không biết cách điền bảng chấm điểm.

  **Quy tắc đã chốt: thà tách nhỏ dư còn hơn gộp nhầm.** Hai cụm nhỏ đặt cạnh nhau thì Lab Coach nhìn phát biết và tự gộp. Một cụm to gộp nhầm thì không ai phát hiện ra — vì nó trông đúng.

  _(Nguyên tắc nội dung cho màn 2, nhóm đã thống nhất, cần Lab Coach xác nhận: học viên **đã đọc slide rồi mà vẫn hỏi** — nên nội dung ôn không được lặp lại cách slide đã trình bày. Đó là lý do mục "Giảng lại theo cách khác slide" được tô nền riêng trong prototype. Nếu mục đó chỉ diễn đạt lại slide thì màn 2 không có lý do tồn tại.)_

## §7. Kiểm thử

- **Chiều chất lượng + định nghĩa kiểm chứng được:**

  Hai quyết định AI, hai bộ đo riêng, và **hai mức tham vọng khác nhau** — nói rõ để không ai đọc nhầm.

  | Quyết định | Chiều đo | Định nghĩa "đạt" |
  |---|---|---|
  | 1 · Gom cụm | **Factuality** | Mọi câu trong đầu ra phải có trong đầu vào (`no_invented_ids`), không câu nào bị xếp hai chỗ (`no_duplicate_ids`), tổng lượt cộng lại bằng số câu thực (`counts_reconcile`) |
  | 1 · Gom cụm | **Relevance** | Câu cùng một chỗ kẹt phải chung cụm; hai chỗ kẹt khác nhau dùng chung từ khoá phải tách; câu lạc đề phải do **model tự khai** là rải rác, không tính công bước dọn dẹp của code |
  | 1 · Gom cụm | **Sensitivity** | Tín hiệu thưa → `SPARSE`, không gom. Một người chiếm phần lớn lượt → cờ tín hiệu lệch. Cụm ít người → cờ cụm yếu |
  | 2 · Soạn nội dung ôn | **Tính kỷ luật của output** | Chẩn đoán bám vào chữ học viên viết · không kéo vào khái niệm không ai hỏi · giữ mức lớp · không ra lệnh cho Lab Coach · câu kiểm tra không phải dạng chép định nghĩa · tự khai đúng mức tin cậy |
  | 2 · Soạn nội dung ôn | **Biết nói "không chắc"** | Cụm mỏng hoặc không phải chỗ kẹt kiến thức → phần *chỗ cần tự kiểm* phải cảnh báo trước mọi ghi chú khác |

  **Thứ nhóm CỐ Ý KHÔNG đo, và vì sao.** Với quyết định 2: **đúng-sai kiến thức** và **"có thật sự khác slide không"**. Hai thứ đó là phán đoán sư phạm; nhóm 4 người tự chấm thì kết quả là ý kiến nhóm, không phải bằng chứng — đúng lý do nhóm loại đề A1 ở §2. Người chấm hai thứ đó là Lab Coach, khi đọc bản nháp. Giao diện vì thế gắn nhãn `BẢN NHÁP` và không bao giờ đưa nội dung này tới học viên.

- **Golden set:**

  | Bộ | File | Số case | Cơ cấu |
  |---|---|---|---|
  | Gom cụm | `eval/golden_set.json` | 24 | lop1 3 · lop2 3 · lop3 3 · lop4 3 · thuong 8 · hiem 4 · toàn bộ turn_id đối chiếu chatlog K4 thật |
  | Soạn nội dung ôn | `eval/golden_set_answer.json` | 8 | cụm rõ · cụm mỏng · có injection · toàn câu hành chính · khái niệm hẹp · trộn Anh-Việt · một người hỏi dồn · toàn câu cụt |

  Bộ thứ hai có **kiểm ngược**: `python eval/run_eval_answer.py --selftest` chạy 11 output cố tình hỏng qua bộ chấm và xác nhận từng assertion vẫn bắt được lỗi, cộng một output tốt không bị bắt nhầm. Cần cái này vì lượt đo 3 đạt 8/8 ngay sau khi nới cách chấm caveat — con số đó chỉ đáng tin nếu chứng minh được thước đo chưa bị nới tới mức vô dụng.

- **Quality bar (chốt tại hạn chốt spec, giữ nguyên sau đó):**

  > **Gom cụm — đạt khi ≥ 85% qua bộ, VÀ không case nào trượt `no_invented_ids` hoặc `must_not_group_together`.**
  > Hai assertion đó là hai kiểu sai làm Lab Coach dạy nhầm chỗ cho cả lớp: bịa ra câu hỏi không ai hỏi, và gộp hai vấn đề khác nhau thành một cụm to giả.

  > **Soạn nội dung ôn — đạt khi ≥ 75% qua bộ, VÀ bộ chấm phải qua `--selftest` 11/11.**
  > Bar thấp hơn vì đây là bản nháp có người duyệt, không phải thứ đi thẳng tới học viên. Điều kiện cứng nằm ở chỗ khác: thước đo phải chứng minh được là còn bắt được lỗi.

- **Kết quả các lượt chạy:**

  **Quyết định 1 — gom cụm** (gemini-3.1-flash-lite, gemini-3.5-flash-lite)

  | Lượt | Đạt | Nhóm lỗi còn lại | Đổi gì so với lượt trước |
  |---|---|---|---|
  | 1 | 18/24 = 75,0% | 5× nhét câu lạc vào cụm · 4× tách nhầm · 3× **model bịa mã** | gốc |
  | 2 | 23/24 = 95,8% | 1× tách nhầm | Prompt cho model chép **số thứ tự 1..n** thay vì mã `T#####` — lượt 1 nó trả `T1085` thay cho `T11085`. Bịa mã về **0**. Đồng thời siết thước đo |
  | 3 | **23/24 = 95,8%** | 2× gop-nham | Siết tiếp: `must_not_group_together` chỉ đạt khi **cả hai** turn nằm trong cụm — vứt một vế vào rải rác không còn tính là "đã tách" |

  **Quyết định 2 — soạn nội dung ôn** (gemini-3.5-flash-lite)

  | Lượt | Đạt | Nhóm lỗi còn lại | Đổi gì so với lượt trước |
  |---|---|---|---|
  | 1 | 6/8 = 75,0% | 2× caveat rỗng | gốc |
  | 2 | 6/8 = 75,0% | 2× caveat rỗng (khác case) | **Sửa sản phẩm**: prompt thêm luật 8 — caveat phải cảnh báo tín hiệu mỏng / cụm không phải kiến thức trước mọi ghi chú khác |
  | 3 | **8/8 = 100,0%** | không còn lỗi nào | **Sửa bộ đo, không sửa sản phẩm**: lượt 1–2 chấm caveat bằng từ khoá viết riêng từng case nên A-07/A-08 trượt oan khi model dùng chữ khác. Chuyển sang ngân hàng từ khoá theo **loại cảnh báo**. Thêm `confidence_valid` — lượt 2 model trả mức `"vấp"` |

  **Ba lượt không so trực tiếp được với nhau** vì thước đo thay đổi giữa các lượt. Mỗi lượt ghi rõ đổi gì trong trường `note` của `eval/results-*.json` và hiện luôn trên dashboard tab *Chất lượng*.

## §8. Phân công & kế hoạch

- Phân công có tên: spec / evidence / prompt / code / demo
- Willing users (≥2 tên) + kế hoạch vòng validation _(bonus, nếu làm)_:
- Multi-prototype (nếu làm): trục khác biệt của ≥2 phương án + lý do chọn:

## §9. Changelog

| Thời điểm | Đổi gì | Vì sao (trỏ về feedback/case nào) |
