# Complete Feature Testing Checklist

## Pre-Test Setup
- [ ] Backend running on http://localhost:3001
- [ ] Frontend running on http://localhost:3000
- [ ] Browser DevTools open (F12) with Console tab visible
- [ ] Browser DevTools Network tab open to monitor API calls

---

## 1. Authentication & Login
- [ ] Sign up with new email and password
- [ ] Verify token is stored in localStorage
- [ ] Login with correct credentials
- [ ] Login with wrong password (should error)
- [ ] Check that student is logged in (footer shows "School")
- [ ] Clear localStorage and verify logged out

---

## 2. Pluto Chat - Basic Messaging
- [ ] Open Pluto chat (🪐 button)
- [ ] Send: "Hello Pluto"
- [ ] Verify immediate user message appears in chat
- [ ] Verify AI response appears after 2-3 seconds
- [ ] Check message timestamp is correct
- [ ] Send multiple messages and verify conversation history shows
- [ ] Verify no console errors in DevTools

---

## 3. Pluto Chat - Persistent Storage
- [ ] In active chat, send: "remember this test message"
- [ ] Refresh page (F5)
- [ ] Verify chat history still shows (old messages visible)
- [ ] Click on different chat in sidebar
- [ ] Click back to first chat
- [ ] Verify message history intact
- [ ] Check Network tab: verify GET /api/messages requests succeed (200 status)

---

## 4. Pluto Chat - Sidebar & Chat Management
- [ ] Fullscreen chat (□ button)
- [ ] Verify sidebar shows "Conversations"
- [ ] Click "+ New Chat" button
- [ ] Verify new empty chat created
- [ ] Send message in new chat
- [ ] Verify chat title auto-updated from first message
- [ ] Click on old chat - switch works
- [ ] Click delete button (x) next to chat
- [ ] Verify chat deleted and replaced with new default chat
- [ ] Minimize chat (- button) - should show unread badge
- [ ] Send message while minimized
- [ ] Verify badge increments
- [ ] Click 🪐 icon to restore
- [ ] Badge should disappear, all messages visible

---

## 5. Pluto Chat - Text File Upload
- [ ] Send text message: "here is a python question"
- [ ] Click 📎 paperclip button
- [ ] Select a .txt or .py file from your computer
- [ ] Verify "Attached: filename.txt" appears below input
- [ ] Send the message
- [ ] Verify chat shows: message text + "📝 filename.txt" badge
- [ ] Pluto should respond mentioning the file content
- [ ] Refresh page
- [ ] Verify attachment badge still shows for that message

---

## 6. Pluto Chat - Image Upload
- [ ] Click 📎 button
- [ ] Select a .png or .jpg screenshot
- [ ] Verify "Attached: screenshot.png" shown
- [ ] Send with message: "analyze this screenshot"
- [ ] Verify chat shows: message + "🖼️ screenshot.png" badge
- [ ] Pluto should describe what's in the image
- [ ] Check Network tab: POST /api/chat shows dataUrl in request body (Network > Chat > Request > Payload)

---

## 7. Pluto Chat - PDF Upload
- [ ] Click 📎 button
- [ ] Select a PDF file
- [ ] Send: "what topics are in this PDF?"
- [ ] Verify "📋 filename.pdf" badge appears
- [ ] Pluto should list topics extracted from PDF
- [ ] Network check: POST /api/chat request should show pdf in attachment

---

## 8. Pluto Chat - PowerPoint Upload
- [ ] Click 📎 button
- [ ] Select a .pptx file
- [ ] Send: "summarize these slides"
- [ ] Verify "📊 filename.pptx" badge
- [ ] Pluto should summarize slide content
- [ ] Check if text extraction worked (should mention key points from slides)

---

## 9. Pluto Chat - File Size Limits
- [ ] Try to attach a file > 20MB
- [ ] Should show error: "This file is too large..."
- [ ] Try to attach a binary/executable file
- [ ] Should either show error or fallback gracely
- [ ] Attach a valid file - send works

---

## 10. Pluto Chat - Error Handling
- [ ] Disconnect network (DevTools > Network > Offline)
- [ ] Try to send message
- [ ] Should show timeout error
- [ ] Reconnect network
- [ ] Try again - should work
- [ ] Stop backend (close terminal)
- [ ] Try to send message
- [ ] Should show "Server error" or connection refused
- [ ] Restart backend: success

---

## 11. Chat Response Quality
- [ ] Send: "be friendly not robotic"
- [ ] Verify response sounds natural (not corporate tone)
- [ ] Send: "give me 3 tips"
- [ ] Verify response shows list with each item on new line (not dense paragraph)
- [ ] Send long question
- [ ] Verify response is concise (no unnecessary padding)
- [ ] Send ambiguous question: "how can I improve"
- [ ] Verify Pluto asks clarifying question before answering

---

## 12. Console Error Check
Open DevTools Console (F12) and:
- [ ] No red error messages visible
- [ ] No "undefined" errors
- [ ] No "Cannot read property" errors
- [ ] Filter for errors: type "error" in console - should be empty or only network timeouts
- [ ] Check Network tab for 404 or 500 responses - should be none

---

## 13. Browser Storage Check
Open DevTools Storage tab:
- [ ] localStorage should contain:
  - `token` (JWT string)
  - `user` (JSON user object)
  - `authRole` (should be "student")
- [ ] All values non-empty

---

## 14. API Response Validation
Network tab > Chat requests:
- [ ] POST /api/chat
  - Request includes: message, systemPrompt, contextMessages, attachment (if file sent)
  - Response: { reply: "..." } (valid JSON)
  - Status: 200
- [ ] GET /api/messages/:chatId
  - Response: { messages: [...] } with timestamps
  - Status: 200
- [ ] GET /api/chats
  - Response: { chats: [...] }
  - Status: 200

---

## Quick Smoke Test (5 minutes)
1. Login ✓
2. Send plain text message ✓
3. Attach file and send ✓
4. Verify response ✓
5. Refresh and verify history ✓
6. No console errors ✓

---

## Error Rectification Checklist
If you find an error:
1. Take screenshot of error
2. Note exact error message
3. Check DevTools Console for stack trace
4. Note which feature/step triggered it
5. Check Network tab for failed requests
6. Restart backend/frontend if needed
7. Report:
   - Error message
   - Steps to reproduce
   - Screenshot of console error
   - Expected vs actual behavior
