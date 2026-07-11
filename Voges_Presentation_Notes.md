# Voges — Presentation Notes

Companion notes for `Voges_Presentation.pptx` (12 slides).
For each slide: **VN explanation** (ghi chú tiếng Việt), **EN speaking script** (đọc to khi trình bày), and **Demo instruction** where relevant.

> Core message: **Voice is the primary interface. The screen is the safety layer.**

---

## Slide 1 — Title: Voges

**VN — Ghi chú:**
Mở đầu ngắn gọn. Voges là trợ lý ngân hàng điều khiển bằng giọng nói. Câu chốt: giọng nói là giao diện chính, còn màn hình là lớp an toàn. Nhấn mạnh đây không phải chatbot thông thường.

**EN — Speaking script:**
"This is Voges, a voice-first AI financial concierge. The one line to remember: voice is the primary interface, and the screen is the safety layer. Let me show you why that matters for banking."

---

## Slide 2 — Problem

**VN — Ghi chú:**
App ngân hàng nhiều menu, người dùng khó tìm đúng chỗ. Chatbot truyền thống chỉ trả lời câu hỏi, không thể thực hiện hành động an toàn. Thách thức lớn nhất của AI tài chính là vừa hữu ích vừa không nguy hiểm.

**EN — Speaking script:**
"Banking apps are deep and menu-heavy. Users get lost finding a single toggle. Chatbots can answer questions but cannot safely take action. The real challenge is being useful without becoming dangerous."

---

## Slide 3 — Solution

**VN — Ghi chú:**
Người dùng nói chuyện tự nhiên với AI. Voges đọc dữ liệu ngân hàng, giải thích vấn đề, đề xuất bước tiếp theo. Nhưng mọi hành động nhạy cảm đều bị kiểm soát bởi policy, approval, passkey và audit ở phía backend.

**EN — Speaking script:**
"Voges lets users speak naturally. It reads their banking data, explains problems, and proposes next steps. Every sensitive action is controlled server-side by policy, approval, passkey, and an audit trail."

---

## Slide 4 — Product Demo Overview

**VN — Ghi chú:**
Ba khoảnh khắc demo: (1) câu hỏi chỉ đọc — vì sao Netflix bị từ chối; (2) hành động nhạy cảm — bật thanh toán online, đi qua approval và passkey; (3) yêu cầu nguy hiểm — chuyển hết tiền và bỏ qua xác thực, bị chặn. Ba màu xanh/vàng/đỏ xuất hiện xuyên suốt bài.

**EN — Speaking script:**
"Three demo moments. A safe read-only question. A sensitive action that goes through approval and passkey. And a dangerous request that gets blocked. Watch the green, amber, and red pattern throughout."

**Demo instruction:**
Chuẩn bị sẵn 3 câu thoại này để đọc ở phần demo trực tiếp. Đây là bản đồ tổng cho các slide sau.

---

## Slide 5 — System Architecture

**VN — Ghi chú:**
Kiến trúc một đường ống liền mạch. Giọng nói vào GPT Realtime, model gọi tool, tool router chạy backend. Policy engine quyết định, cổng approval, WebAuthn xác thực, thực thi tool, ghi audit, rồi trả kết quả bằng giọng nói. Màu vàng là bước kiểm soát, màu xanh là thực thi thật.

**EN — Speaking script:**
"This is the full pipeline. Voice goes into GPT Realtime, the model calls a tool, the router hits the backend. The policy engine decides, the approval gate and WebAuthn verify, the tool executes, everything is audited, and the answer comes back as voice."

**Pipeline:**
`Voice → GPT Realtime → Tool Router → Policy Engine → Approval Gate → WebAuthn → Execute Tool → Audit Log → Voice Response`

---

## Slide 6 — Voice + Tool Calling

**VN — Ghi chú:**
Voges dùng GPT Realtime model `gpt-realtime-2.1`, kết nối bằng WebRTC trực tiếp từ trình duyệt. Model gọi các tool ngân hàng cố định kiểu để đọc dữ liệu thật từ Cloudflare D1. Đây là các tool chỉ đọc, không bịa số liệu.

**EN — Speaking script:**
"Voges uses GPT Realtime, model gpt-realtime-2.1, connected over WebRTC straight from the browser. The model calls typed banking tools to read real data from Cloudflare D1. These read tools never invent numbers."

**Read-only tools shown:**
`getCustomerProfile`, `getRecentTransactions`, `getCardStatus`, `getKycStatus`, `explainDeclineReason`, `generateFundingInstruction`

---

## Slide 7 — Safety Layer

**VN — Ghi chú:**
Lớp an toàn là trái tim của Voges. AI chỉ đề xuất, backend mới quyết định. Policy engine tất định và có tính phân quyền: allow, confirm, passkey, hoặc block. Trạng thái frontend chỉ để hiển thị. Những thứ luôn bị chặn: chuyển tiền, bỏ qua xác thực, lộ CVV/OTP/số thẻ đầy đủ, đổi danh tính KYC, tư vấn đầu tư.

**EN — Speaking script:**
"This is the heart of Voges. The AI only proposes; the backend decides. The policy engine is deterministic: allow, confirm, passkey, or block. Money transfers, verification bypass, revealing secrets, KYC identity changes, and investment advice are always blocked."

---

## Slide 8 — Approval + WebAuthn

**VN — Ghi chú:**
Với hành động nhạy cảm, backend tạo pending action hết hạn. UI hiện approval sheet: trạng thái hiện tại, trạng thái mới, mức rủi ro, lý do policy. Người dùng xác nhận, rồi hệ điều hành bật passkey thật. Backend xác minh chữ ký WebAuthn rồi mới thực thi. Voges không nhận dữ liệu vân tay hay khuôn mặt — chỉ nhận một chữ ký mật mã.

**EN — Speaking script:**
"For sensitive actions the backend creates an expiring pending action. The approval sheet shows the current state, the new state, the risk, and the policy reason. The user confirms, the OS runs a real passkey, and the server verifies the cryptographic assertion before executing. Voges never sees your fingerprint or face, only a signed assertion."

**Demo instruction:**
Khi demo bật thanh toán online, dừng lại ở approval sheet để khán giả thấy rõ current state / new state / risk, rồi mới chạm passkey.

---

## Slide 9 — Audit Trail

**VN — Ghi chú:**
Mọi tool call và mọi action đều được ghi vào log chỉ-thêm (append-only). Log gồm kết quả policy, pending action, xác nhận, trạng thái WebAuthn, kết quả thực thi. Kể cả yêu cầu bị chặn cũng được ghi lại. Đây là nền tảng cho tuân thủ, gỡ lỗi và niềm tin.

**EN — Speaking script:**
"Everything is written to an append-only audit log: the policy result, the pending action, the confirmation, the passkey status, and the execution result. Even a blocked request is logged. This is what makes the system trustworthy and auditable."

---

## Slide 10 — Demo Scenarios

**VN — Ghi chú:**
Sáu kịch bản demo: (1) giải thích giao dịch bị từ chối; (2) hiện giao dịch gần đây; (3) kiểm tra KYC; (4) hướng dẫn nạp tiền; (5) bật thanh toán online với approval và passkey; (6) yêu cầu nguy hiểm bị chặn. Bốn cái đầu là chỉ-đọc màu xanh, cái thứ năm màu vàng, cái cuối màu đỏ.

**EN — Speaking script:**
"Six scenarios. Four safe read-only ones: explaining a decline, showing transactions, checking KYC, and funding guidance. One sensitive action with approval and passkey. And one dangerous request that gets blocked."

**Demo instruction:**
Nếu thời gian ngắn, chạy tối thiểu 3 kịch bản: card declined (xanh), enable online payments (vàng), dangerous request (đỏ).

---

## Slide 11 — What Makes Voges Different

**VN — Ghi chú:**
Chatbot truyền thống: ưu tiên text, trả lời FAQ, an toàn hành động yếu, ít minh bạch. Voges: ưu tiên giọng nói, dựa trên tool, kiểm soát bằng policy, bảo mật bằng passkey, có audit, và dùng màn hình như lớp an toàn. Đó chính là câu chốt mở đầu.

**EN — Speaking script:**
"A traditional chatbot is text-first, answers FAQs, has weak action safety, and little visibility. Voges is voice-first, tool-based, policy-controlled, passkey-secured, audit-backed, and uses the screen as a safety layer."

---

## Slide 12 — Roadmap / Next Steps

**VN — Ghi chú:**
Lộ trình thẳng thắn. Giới hạn demo: hiện tại app dùng một khách hàng demo cố định, bước đầu tiên là danh tính xác thực thật. Sau đó: chuyển đổi nhiều khách hàng sau khi đã ràng buộc danh tính, mở rộng luật policy, observability production, tích hợp core ngân hàng, luồng chuyển người thật và đa ngôn ngữ. Không nói quá, chỉ nói đúng những gì còn thiếu.

**EN — Speaking script:**
"Let me be honest about what is next. Today the demo resolves a single customer, so real authenticated identity is the first step. After that: multi-customer switching, more policy rules, production observability, bank core integration, human escalation, and better multilingual support."

---

## Assumptions & accuracy notes

- **Demo data theme:** the seeded sample data (`sample_data/seed.sql`) is themed around **GoTyme Bank** and uses **PHP** currency for a hackathon context. Slides keep the product story bank-agnostic; the specific bank name is not emphasized so the deck stays reusable.
- **Single demo customer:** the backend currently resolves one demo customer identity. This is presented honestly on the roadmap slide as the first production step, not hidden.
- **Model / stack claims** (`gpt-realtime-2.1`, WebRTC, Cloudflare Pages Functions + D1, WebAuthn via `@simplewebauthn`) are taken directly from the source and config, not invented.
- **Tool names** shown are the real read-only tools defined in `src/banking.js` / `functions/_lib/banking.js`.
- No app source code was modified; only the presentation and this notes file were created.
