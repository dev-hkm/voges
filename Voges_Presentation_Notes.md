# Voges — Premium 6-Slide Pitch Presentation Notes

Companion notes for `Voges_Presentation.pptx` (6 slides), matching the **Agentic AI Build Week 2026 Pitching Playbook** guidelines.

For each slide, you will find:
- **VN Ghi chú (VN Notes):** Thuyết minh bằng tiếng Việt để chuẩn bị tinh thần và nắm rõ mục tiêu của slide.
- **EN Speaking Script:** Lời thoại nói bằng tiếng Anh, tối ưu hóa để diễn thuyết ngắn gọn, mạch lạc trong khoảng 30s-45s/slide (tổng cộng 4.5 phút cho toàn bộ pitching).
- **Demo / Interaction:** Hướng dẫn demo và hành động trực quan tại slide đó.

---

## Slide 1 — Team & Promise (Title Slide - Dark Background)

**VN Ghi chú:**
Mở đầu ấn tượng và dứt khoát. Giới thiệu tên dự án Voges và định vị sản phẩm: một "Voice-First AI Financial Concierge" dành riêng cho GoTyme Bank. Hãy nhấn mạnh thông điệp cốt lõi quyết định kiến trúc: Giọng nói là giao diện chính để tương tác, còn màn hình điện thoại đóng vai trò là lớp bảo vệ an toàn để xác nhận.

**EN Speaking Script:**
"Good afternoon, judges. We are the team behind Voges, a voice-first AI financial concierge built specifically for GoTyme Bank. Our core architectural promise is simple: voice is the primary interface, and the screen is the safety layer. We eliminate the friction of complex banking menus while keeping your transactions completely secure. Let me show you why this is the future of mobile banking."

---

## Slide 2 — Problem Insight (Light Background)

**VN Ghi chú:**
Trình bày nỗi đau thực tế một cách sắc bén (insight). 
1. Giao diện app ngân hàng hiện tại quá nhiều menu lồng nhau (4+ tầng) khiến việc thực hiện các tính năng khẩn cấp (như khóa thẻ, mở thanh toán trực tuyến) cực kỳ chậm chạp và khó tìm.
2. Việc đưa AI vào để thực hiện giao dịch tự động bằng giọng nói lại vấp phải bài toán bảo mật: AI thông thường chỉ biết trả lời FAQ (vô dụng), còn nếu cấp quyền ghi trực tiếp cho AI (writes) thì rủi ro từ prompt injection và ảo giác (hallucination) sẽ dẫn đến thất thoát tiền của khách hàng.

**EN Speaking Script:**
"Modern banking apps are powerful but suffer from buried navigation. Crucial security settings like freezing a card or toggling online payments are hidden under 4 or 5 layers of sub-menus, causing high user anxiety and support overhead. While natural voice control is the obvious solution, financial AI faces a security dilemma: standard chatbots are FAQ-only and useless, while AI agents with direct write access are a massive liability due to hallucinations."

---

## Slide 3 — Agentic Workflow (Light Background)

**VN Ghi chú:**
Giải thích quy trình hoạt động của Voges (Goal -> Plan -> Tools -> Act -> Verify). Điểm quan trọng nhất là tính chất "Zero-Trust": AI (GPT Realtime) chỉ có quyền "Đề xuất" (Propose) hành động, còn việc "Quyết định" và "Thực thi" (Decide & Execute) hoàn toàn nằm ở phía máy chủ (Server-side Policy Engine) kết hợp xác thực sinh trắc học phần cứng (WebAuthn Passkeys).

**EN Speaking Script:**
"To solve this, we built a Zero-Trust agentic workflow. The user states their Goal naturally over a WebRTC voice stream. GPT Realtime parses the intent and proposes a structured tool call. Our server-side Tool Router intercepts it immediately. If it is a sensitive write action, our deterministic Policy Engine triggers an expiring Pending Action on screen. The user must explicitly confirm it using a native hardware Passkey, after which the server executes the secure D1 transaction."

---

## Slide 4 — Why It Wins (Dark Background)

**VN Ghi chú:**
Nêu bật 3 trụ cột kỹ thuật giúp Voges giành chiến thắng:
1. **Policy-Controlled:** Bộ lọc quy tắc backend tất định, ngăn chặn hoàn toàn việc AI bị thao túng để thực hiện chuyển khoản trái phép hoặc đổi thông tin danh tính.
2. **Passkey-Secured:** Xác thực WebAuthn chuẩn hóa. Hệ thống chỉ nhận chữ ký mã hóa từ chip bảo mật phần cứng, Voges không bao giờ tiếp cận hay lưu trữ dữ liệu vân tay/khuôn mặt của người dùng.
3. **Audit-Backed:** Mọi thao tác từ hội thoại, đề xuất tool, đánh giá policy cho tới kết quả thực thi đều được ghi lại vĩnh viễn vào D1 logs chống sửa xóa (append-only audit trail).

**EN Speaking Script:**
"Voges wins because of three strict design pillars. First, it is Policy-Controlled: deterministic backend rules override the LLM. Hallucinations cannot compromise security. Second, it is Passkey-Secured: we verify identity cryptographically using WebAuthn. Fingerprints and face data never touch our servers. Third, it is Audit-Backed: an append-only audit trail records every intent, block, and state change for total auditability."

---

## Slide 5 — Evidence + Impact (Light Background)

**VN Ghi chú:**
Đưa ra số liệu chứng minh dự án hoạt động thực tế. Voges đã vượt qua 34 kịch bản kiểm thử tự động (tests) về bảo mật, chặn đứng 100% các cuộc tấn công lừa đảo (Scam Risk Advisor). Về mặt hiệu quả kinh doanh, việc điều khiển bằng giọng nói giúp giảm tới 90% thời gian thực hiện thao tác so với tìm kiếm thủ công trên app. Toàn bộ dữ liệu demo đều được ánh xạ dựa trên các dòng sản phẩm thật của GoTyme như tài khoản Everyday Account, tài khoản tiết kiệm Go Save (lãi suất 5%), và tài khoản mua bán Vàng (PAX Gold).

**EN Speaking Script:**
"To validate credibility, we built a test suite with 34 automated scenarios covering scam risk, frozen account checks, and international payments. All 34 tests pass successfully. In terms of impact, Voges reduces settings navigation time by 90%—completing complex toggles in 5 seconds instead of 1 minute. We also seeded our database with GoTyme's actual product lines, including Everyday Accounts, high-yield Go Save goals, and tokenized PAX Gold accounts."

---

## Slide 6 — Demo + Close (Dark Background)

**VN Ghi chú:**
Chốt lại bài pitching bằng kịch bản Demo 3 bước (Xanh - Vàng - Đỏ) và Lộ trình phát triển sản xuất trung thực (Roadmap). 
- *Bước 1 (Xanh - Chỉ đọc):* Hỏi lý do Netflix bị decline.
- *Bước 2 (Vàng - Hành động nhạy cảm):* Yêu cầu bật thanh toán trực tuyến (Bật approval sheet + quét Passkey).
- *Bước 3 (Đỏ - Nguy hiểm):* Yêu cầu chuyển hết tiền và bỏ qua xác thực (Bị chặn hoàn toàn).
Lộ trình sắp tới tập trung vào bảo mật định danh động và tích hợp Core API.

**EN Speaking Script:**
"For our live demo, we will show three moments. First, a safe query explaining why a Netflix payment failed. Second, a sensitive toggle to enable online payments using a real phone passkey. Third, a dangerous request to bypass security that is blocked. Our roadmap moves from this single-client demo to core banking API integration. Talk to Voges at master.voges.pages.dev. Thank you."