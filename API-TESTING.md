# API Testing Guide

Test these endpoints directly using curl, Postman, or browser DevTools Network tab.

---

## Setup
1. Get a valid JWT token by logging in via web app
2. Copy token from browser localStorage (DevTools > Application > localStorage > token)
3. Use token in Authorization header for all requests

---

## 1. Health Check
```bash
curl http://localhost:3001
```
Expected: `{"message":"Student Wellness Backend API is running"}`

---

## 2. Create Chat
```bash
curl -X POST http://localhost:3001/api/chats \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title":"Test Chat"}'
```
Expected Response:
```json
{"chatId": 123}
```

Note the chatId for next tests.

---

## 3. Send Message (Text Only)
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "chatId": 123,
    "message": "Hello Pluto",
    "systemPrompt": "You are helpful"
  }'
```
Expected Response:
```json
{"reply": "Hey! How can I help you today?"}
```

---

## 4. Send Message with Text File Attachment
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "chatId": 123,
    "message": "analyze this file",
    "attachment": {
      "kind": "file",
      "name": "notes.txt",
      "mimeType": "text/plain",
      "textContent": "This is my study notes..."
    }
  }'
```
Expected: AI response that mentions the file content

---

## 5. Send Message with Image Attachment
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "chatId": 123,
    "message": "what is in this screenshot?",
    "attachment": {
      "kind": "image",
      "name": "screenshot.png",
      "mimeType": "image/png",
      "dataUrl": "data:image/png;base64,iVBORw0KG..."
    }
  }'
```
Expected: AI response describing image content

---

## 6. Get all chats for user
```bash
curl http://localhost:3001/api/chats \
  -H "Authorization: Bearer YOUR_TOKEN"
```
Expected:
```json
{"chats": [{"id": 123, "title": "Test Chat", "createdAt": "...", "updatedAt": "..."}]}
```

---

## 7. Get messages from a chat
```bash
curl http://localhost:3001/api/messages/123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```
Expected:
```json
{"messages": [
  {"id": 1, "chatId": 123, "role": "user", "content": "Hello Pluto", "timestamp": "..."},
  {"id": 2, "chatId": 123, "role": "assistant", "content": "Hey! How can I help?", "timestamp": "..."}
]}
```

---

## 8. Save Message
```bash
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "chatId": 123,
    "role": "user",
    "content": "test message"
  }'
```
Expected:
```json
{"messageId": 42}
```

---

## Error Codes to Watch For

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | ✅ Expected |
| 201 | Created | ✅ Expected for creation endpoints |
| 400 | Bad Request | ❌ Check request body format |
| 401 | Unauthorized | ❌ Token missing or expired |
| 413 | Payload Too Large | ❌ File > 50MB, reduce size |
| 500 | Server Error | ❌ Check backend console for errors |

---

## Testing with Postman (Recommended)

1. Download Postman from postman.com
2. Create new collection "Student Wellness Tests"
3. Create request for each endpoint above
4. Store token in Postman environment variable:
   - In Postman, go to Environments
   - Create new env: "Local Dev"
   - Add variable: key=`token`, value=`YOUR_JWT_TOKEN`
5. In requests, use `{{token}}` in Authorization header
6. Save responses and compare with expected output

---

## Automated Testing Commands

Test all endpoints in sequence:
```bash
# Get token (first login via web, then copy from devtools)
TOKEN="your_jwt_token"
CHATID=123

# Test 1: Health
curl http://localhost:3001

# Test 2: Send message
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"chatId": '$CHATID', "message": "test"}'

# Test 3: Get chats
curl http://localhost:3001/api/chats \
  -H "Authorization: Bearer $TOKEN"

# Test 4: Get messages
curl http://localhost:3001/api/messages/$CHATID \
  -H "Authorization: Bearer $TOKEN"
```

---

## Common Issues & Fixes

### Issue: 401 Unauthorized
- **Cause**: Token missing or invalid
- **Fix**: Copy fresh token from browser localStorage after login

### Issue: 413 Payload Too Large
- **Cause**: File attachment > 50MB
- **Fix**: Use smaller file (< 20MB recommended)

### Issue: 500 Server Error
- **Cause**: Backend crashed or missing OpenRouter API key
- **Fix**: 
  1. Check backend console for error message
  2. Verify `OPENROUTER_API_KEY` in `.env`
  3. Restart backend: `npm start`

### Issue: Timeout (no response after 20 seconds)
- **Cause**: OpenRouter API slow or offline
- **Fix**:
  1. Check OpenRouter status
  2. Verify internet connection
  3. Check backend console for request logs

---

## Success Indicators

| Test | Success Indicator |
|------|---|
| Health Check | Returns message about API running |
| Create Chat | Returns chatId (number) |
| Send Message | Returns reply text from AI |
| File Upload | Reply mentions file content |
| Get Chats | Returns array of chat objects |
| Get Messages | Returns array with proper timestamps |
| Error Handling | Returns 4xx/5xx with error message (not HTML) |
