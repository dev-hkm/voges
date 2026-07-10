# ARCHIVED — DO NOT IMPLEMENT THIS FILE

This document describes an older broken implementation and several hypotheses that are no longer current. The production fix is documented in `VOGES_PROJECT_HANDOFF.md`. In particular, do not restore automatic VAD responses, do not execute tools before `response.done`, and do not make `stopSession` depend on the live session timer.

# Voges — Prompt Fix Lỗi GPT Realtime "Connected rồi ngắt ngay"

## 1. Mô tả ứng dụng

**Voges** là một **voice-first AI Financial Concierge** — trợ lý ngân hàng điều khiển bằng giọng nói. Người dùng nói chuyện trực tiếp với GPT Realtime qua WebRTC. Giọng nói là giao diện chính; màn hình là lớp bảo mật và an toàn.

Kiến trúc luồng:
```
User voice → GPT intent → tool proposal → deterministic policy
→ pending action → visible approval → real passkey (WebAuthn)
→ backend execution → append-only audit → natural voice result
```

URL Production: https://voges.pages.dev

## 2. Stack công nghệ

| Layer | Technology |
|---|---|
| Frontend | React + Vite (JavaScript/JSX) |
| Icons | lucide-react |
| Voice | OpenAI GPT Realtime WebRTC, model `gpt-realtime-2.1` |
| Passkey client | @simplewebauthn/browser |
| Backend | Cloudflare Pages Functions (serverless) |
| Database | Cloudflare D1 (SQLite) |
| Passkey server | @simplewebauthn/server |
| PWA | vite-plugin-pwa (service worker) |
| Deploy | wrangler pages deploy → Cloudflare Pages `main` branch |

## 3. BUG CHÍNH: "Connected xong ngắt ngay"

### Triệu chứng

1. User bấm orb → thấy "connected" (hoặc connected xuất hiện rất nhanh)
2. Connection biến mất ngay lập tức hoặc trong vài giây
3. UI đôi khi vẫn hiển thị "Voges is speaking..." dù connection đã chết
4. Thỉnh thoảng kèm lỗi "invalid voice" hoặc "missing required parameter"
5. Không có bất kỳ log/error nào hiển thị trên màn hình (dù đã thêm diagnostic panel)
6. Lỗi xuất hiện không đều — đôi khi lúc nào cũng lỗi, đôi khi chạy được 1-2 lần

### Các lỗi đã từng thấy từ OpenAI Realtime

```
Invalid value: 'breeze'. Supported values are: 'alloy', 'ash', 'ballad', 'coral',
'echo', 'sage', 'shimmer', 'verse', 'marin', and 'cedar'.
```

```
[missing_required_parameter] Missing required parameter: 'session.audio.output.format.rate'.
```

### Lịch sử các fix đã thử (đều THẤT BẠI)

1. **Fix voice whitelist** — Thêm `SUPPORTED_ASSISTANT_VOICES` array, sanitize localStorage voice với `coerceAssistantVoice()`, cập nhật `<option>` trong Settings.
2. **Thêm output rate** — Thêm `output: { format: { type: 'audio/pcm', rate: 24000 } }` vào session.update.
3. **Thêm `type: 'realtime'`** — Thêm `session.type = 'realtime'` vào cả token endpoint và frontend session.update.
4. **Tách recoverable error vs fatal error** — Rồi sau đó lại gộp lại (regression).
5. **Thêm diagnostic panel** — Ring buffer 200 entries, console bridge, fetch interception, global error handler, DataChannel/SDP logging, diagnostics drawer (Ctrl+Shift+D hoặc icon Terminal). VẪN KHÔNG THẤY LOG.
6. **Deploy đúng branch `main`** — Phát hiện Cloudflare Pages production branch là `main` chứ không phải `production`, đã deploy lại.
7. **Cập nhật BUILD_TAG** — Thêm build tag ở footer để verify deployment.

## 4. KIẾN TRÚC CHI TIẾT

### File quan trọng nhất

**Frontend (React):**
- `src/App.jsx` — TOÀN BỘ logic WebRTC, Realtime events, UI. File cực kỳ quan trọng.
- `src/styles.css` — CSS, z-index stacking.
- `src/banking.js` — Tool schemas cho Realtime.

**Backend (Cloudflare Pages Functions):**
- `functions/api/realtime/token.js` — Cấp ephemeral token từ OpenAI API.
- `functions/_lib/session-history.js` — Tạo/finalize voice session trong D1.

**Config:**
- `wrangler.toml` — Project config, D1 binding.
- `package.json` — Scripts, dependencies.

### Luồng startSession (src/App.jsx, dòng 1367)

```
1. GET /api/realtime/token → nhận ephemeral key + session_id
2. getUserMedia({ audio: true }) → lấy mic stream
3. new RTCPeerConnection()
4. peer.createDataChannel('oai-events')
5. DataChannel 'open' → gửi session.update với:
   - type: 'realtime'
   - model: 'gpt-realtime-2.1'
   - tools: BANKING_TOOLS
   - tool_choice: 'auto'
   - audio.input: { format: { type: 'audio/pcm', rate: 24000 }, turn_detection: { type: 'semantic_vad', create_response: true, interrupt_response: true } }
   - audio.output: { format: { type: 'audio/pcm', rate: 24000 }, voice: safeVoice }
   - instructions: (prompt dài cho Voges)
6. peer.createOffer() → setLocalDescription
7. POST offer SDP lên https://api.openai.com/v1/realtime/calls
8. Nhận answer SDP → setRemoteDescription
9. Chờ DataChannel 'open' (timeout 20s)
```

### Token endpoint (functions/api/realtime/token.js)

```javascript
// Gửi POST đến https://api.openai.com/v1/realtime/client_secrets
// Body:
{
  session: {
    type: 'realtime',
    model: 'gpt-realtime-2.1',
    output_modalities: ['audio'],
    audio: { output: { voice: 'marin' } },
  },
}
// Response: { value: string, session_id: string, customer_id: string }
// NOTE: Token response có thể chứa client_secret.value + expires_at
```

### Luồng handleRealtimeEvent (src/App.jsx, dòng 1207)

Sau khi DataChannel 'open', các event Realtime chảy qua `channel.onmessage` → `handleRealtimeEvent`. Các event quan trọng:

- `session.created` → set status 'Listening...', voiceMode 'listening'
- `session.updated` → set `sessionInitializedRef`, gửi greeting nếu `sessionGreetingPendingRef`
- `response.created` → set `responseActiveRef = true`, status 'Voges is speaking...', voiceMode 'assistant-speaking'
- `response.done` → set `responseActiveRef = false`, xử lý queue
- `error` → **HIỆN TẠI** set `fatalError` và gọi `stopSession({ silent: true })` (DÒNG 1295-1309)
- `input_audio_buffer.speech_started/stopped` → xử lý interruption
- `response.output_audio.delta` → audio playback
- `conversation.item.input_audio_transcription.delta/completed` → user transcript

### stopSession và endSessionDueToError

`stopSession` (dòng 995): Đóng peer connection, data channel, stop tracks, clear all refs, set connected=false, voiceMode='idle'.

`endSessionDueToError` (dòng 1103): Gọi `stopSession({ silent: true })`, set fatalError và error, set status 'Connection ended'.

### Vấn đề z-index CSS

`body::before` có `z-index: 9999` (dòng 40 styles.css) — overlay full màn hình, `pointer-events: none`. Các UI element:
- Diagnostic drawer: `z-index: 80`
- Settings drawer: `z-index: 21`
- History drawer: `z-index: 21`
- Approval backdrop: `z-index: 20`

=> Diagnostic drawer z-index=80 nằm DƯỚI body::before z-index=9999. Mặc dù body::before có `pointer-events: none`, nó có background gradient có thể che khuất diagnostic drawer.

## 5. NGUYÊN NHÂN NGHI NGỜ

Dựa trên phân tích code, các nguyên nhân có thể nhất:

### A. Error event bị treat như fatal (CAO NHẤT)

```javascript
// src/App.jsx dòng 1295-1309
if (event.type === 'error') {
  // ANY error → teardown
  setFatalError(message);
  stopSession({ silent: true });
}
```

OpenAI Realtime có thể gửi `error` event không nghiêm trọng (ví dụ: warning về rate limit, tool call error, v.v.). Nếu **bất kỳ error nào cũng gọi stopSession**, session sẽ chết ngay lập tức.

**Cần phân biệt:**
- Session-level errors (fatal): `session.error`, lỗi cấu hình, lỗi auth
- Recoverable errors: tool execution errors, rate limit warnings, temporary server errors

### B. Token endpoint cấu hình không đúng

Token endpoint gọi `POST /v1/realtime/client_secrets` với body chỉ có:
```json
{
  "session": { "type": "realtime", "model": "gpt-realtime-2.1", "output_modalities": ["audio"], "audio": { "output": { "voice": "marin" } } }
}
```

Còn frontend gửi `session.update` qua DataChannel với cấu hình chi tiết hơn nhiều (tools, turn_detection, format rates...). Có thể có **conflict** hoặc session cần cấu hình đầy đủ ngay từ token request.

### C. PWA / Service Worker cache

`vite-plugin-pwa` đang được dùng. Service worker có thể cache asset cũ (phiên bản không có diagnostic). Khi deploy lên Cloudflare Pages, user có thể đang dùng phiên bản cũ do SW không update.

### D. DataChannel bị đóng bất ngờ

Channel 'close' event handler (dòng 1515) gọi `endSessionDueToError`. Nếu server đóng channel vì lý do nào đó (session timeout, config invalid, v.v.), session sẽ kết thúc.

### E. Thiếu rate trong session.update

Dù đã thêm `rate: 24000`, vẫn có thể OpenAI API yêu cầu format khác. Cần kiểm tra response từ SDP endpoint và session.updated event.

### F. Model không hỗ trợ voice đã chọn

Model `gpt-realtime-2.1` hỗ trợ các voice: alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar. Nếu voice không hợp lệ, session sẽ bị reject hoặc đóng.

## 6. YÊU CẦU FIX (QUAN TRỌNG)

### BẮT BUỘC phải làm:

1. **Phân loại error**: Error event từ Realtime KHÔNG phải lúc nào cũng fatal. Chỉ gọi stopSession với:
   - `session.error` — lỗi session level
   - Error codes: `invalid_config`, `session_expired`, `authentication_failed`, `authorization_failed`
   - Còn lại: log, hiển thị cảnh báo, nhưng KHÔNG dừng session

2. **Thêm diagnostic VISIBLE vĩnh viễn**: KHÔNG dùng drawer ẩn. Thêm một thanh diagnostic bar màu đỏ/cam ngay TRÊN cùng màn hình (z-index: 10000) hiển thị:
   - BUILD_TAG (để biết đang ở deployment nào)
   - Connection state realtime
   - Last event type
   - 5 dòng log gần nhất
   - Auto hiện khi có error, ko cần click

3. **Giải quyết z-index**: Diagnostic UI phải cao hơn body::before (z-index: 9999). Dùng `z-index: 10001` hoặc portal ra ngoài #root.

4. **Force disable service worker / PWA cache trong development**:
   - Xóa registration hiện tại
   - Set `self.__WB_DISABLE_DEV_LOGS = true` hoặc dùng `injectManifest` strategy
   - Hoặc xóa PWA plugin tạm thời

5. **Đảm bảo voice settings đúng**:
   - Settings dropdown chỉ chứa 10 voice hợp lệ
   - `coerceAssistantVoice()` được gọi TRƯỚC khi dùng voice trong session.update
   - localStorage voice được sanitize ngay khi load

6. **Kiểm tra cấu hình token endpoint / session.update consistency**:
   - Cấu hình trong token request và session.update phải khớp
   - Nếu có thể, gộp cấu hình tools + turn_detection vào token request luôn

7. **Thêm backend telemetry**: Token endpoint ghi log vào D1 (không ghi secret):
   - Request timestamp, IP hash
   - Session ID, model, voice
   - Response status từ OpenAI
   - Error message (nếu có)
   - Endpoint: có thể thêm endpoint GET /api/diag/session/:id để xem lifecycle

8. **Fix UI state cleanup**:
   - `stopSession` phải clear `responseActiveRef.current = false`
   - Sau `connected=false`, set `voiceMode='idle'`
   - Xóa "Voges is speaking..." khỏi status
   - Test edge case: stop gọi 2 lần liên tiếp

### KHÔNG được đụng vào:

- Banking layer (functions/_lib/banking.js, functions/_lib/actions.js)
- Policy engine (functions/_lib/policy.js)
- WebAuthn (functions/_lib/webauthn.js, các api/webauthn/*)
- Summary cards (shared/ui-contracts.js, SummaryCardRenderer.jsx, summary-ui.js)
- History (session-history.js, HistoryDrawer.jsx)
- Audit, Security
- Tool schemas (src/banking.js)
- Các migration D1 hiện có
- `sample_data/`

### KIỂM TRA SAU KHI FIX:

```bash
npm run typecheck    # TypeScript check
npm test             # Chạy unit tests
npm run build        # Build frontend
# Deploy:
npx wrangler pages deploy dist --project-name voges --branch main
```

Sau deploy:
1. Hard reload browser (Ctrl+Shift+R) — bypass cache
2. Kiểm tra build tag ở footer có thay đổi không
3. Bấm orb để start session
4. Kiểm tra diagnostic bar có hiện không (phải thấy log realtime)
5. Nếu vẫn lỗi: copy diagnostic log và phân tích

### FILE CẦN SỬA:

- `src/App.jsx` — **CHÍNH**: phân loại error, diagnostic bar, state cleanup
- `src/styles.css` — z-index, diagnostic bar style
- `functions/api/realtime/token.js` — backend telemetry, token config
- `wrangler.toml` — nếu cần thêm binding

### CÓ THỂ XÓA (nếu gây vấn đề):
- `vite-plugin-pwa` khỏi package.json và vite config — PWA không cần thiết cho MVP

## 7. CÁCH DEBUG NẾU VẪN LỖI

1. Mở `chrome://inspect/#service-workers` — kiểm tra service worker registration
2. Mở DevTools → Network → fetch `/api/realtime/token` — kiểm tra response có `value` (ephemeral key) không
3. DevTools → Console — kiểm tra có error nào không (console bridge đã replace console methods, có thể ko log ra browser console)
4. Sau khi thêm live diagnostic bar, không cần DevTools — nhìn thẳng vào màn hình
5. Nếu token endpoint lỗi: kiểm tra Cloudflare dashboard → Pages → voges → Functions → logs
6. Nếu SDP bị reject: kiểm tra response body từ `POST /v1/realtime/calls` (HTTP status, error message)
