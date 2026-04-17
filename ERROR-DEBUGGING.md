# Error Debugging & Validation Guide

## How to Find Hidden Errors

### 1. Browser Console Errors (Most Important)
- Open DevTools: Press `F12`
- Click on **Console** tab
- Any red error messages = problem
- Click error to expand stack trace
- Common errors:
  - `Cannot read property 'xxx' of undefined` = State/Data missing
  - `Failed to fetch` = Backend not running or CORS issue
  - `Unexpected token < in JSON` = Server returned HTML error page (check Network tab)

### 2. Network Tab Errors
- Open DevTools: Press `F12`
- Click on **Network** tab
- Look for requests with red color or non-200 status codes
- Click on each failed request and check:
  - **Status**: Should be 200 or 201
  - **Response**: Should be JSON, not HTML
  - **Size**: Should not be 0
- Common patterns:
  - 401 = Authentication failed
  - 404 = Endpoint not found
  - 413 = File too large
  - 500 = Server crashed

### 3. Backend Console Errors
- Where backend is running (terminal window with npm start)
- Look for red error messages
- Look for 🔴 symbols
- Common backend errors:
  - `Port already in use` = Kill existing process
  - `Cannot find module` = Missing npm package (npm install)
  - `OPENROUTER_API_KEY missing` = Add to .env
  - `PRAGMA foreign_keys` = Database corruption (delete database.sqlite)

### 4. Application/Storage Errors
- Open DevTools: Press `F12`
- Click on **Application** tab
- Click on **localStorage** on left
- Verify these keys exist and have values:
  - `token` = JWT string (long)
  - `user` = JSON object
  - `authRole` = "student"
- If any are missing = Login failed

---

## Error Checklist

When you see an error, follow this:

```
1. [ ] Write down exact error message
2. [ ] Take screenshot of error
3. [ ] Check browser console (F12 > Console)
4. [ ] Check network tab (F12 > Network)
5. [ ] Check backend console (terminal)
6. [ ] Check error is reproducible (can you make it happen again?)
7. [ ] Restart backend + frontend
8. [ ] Try again
9. [ ] If still broken:
   a. [ ] Clear browser cache (Ctrl+Shift+Delete)
   b. [ ] Delete node_modules and npm install
   c. [ ] Check .env file has all required keys
   d. [ ] Verify database.sqlite exists
```

---

## Quick Validation Tests

### Test 1: Basic Connectivity
```
Expected: Can reach http://localhost:3000 and http://localhost:3001
Action: Open both URLs in browser
Result: Should see login page (frontend) and JSON response (backend)
```

### Test 2: Authentication
```
Expected: Can login with test@example.com / 123456
Action: Fill login form, click Sign In
Result: Should see dashboard (not login page anymore)
Error to check: Console for 401 or network 400 error
```

### Test 3: Chat Loading
```
Expected: Chat sidebar shows previous conversations
Action: Click on any chat in sidebar
Result: Messages load from database
Error to check: Network tab - GET /api/messages should return 200
```

### Test 4: Send Text Message
```
Expected: Message appears immediately, AI responds in 2-3 seconds
Action: Type "hello" and submit
Result: User message in chat, then AI message
Error to check: 
  - If instant error: Check network 500 error
  - If timeout: Backend offline or OpenRouter API down
  - If no response: Check "isLoading" button state (--> should change back to ➤)
```

### Test 5: Upload Text File
```
Expected: File appears as attachment chip, AI mentions file content
Action: Click 📎, select .txt file, send with message
Result: "📝 filename.txt" badge shown, response mentions file
Error to check:
  - If file not showing: Check browser file read permissions
  - If AI doesn't mention: File extraction failed, check backend logs
  - If 413 error: File > 20MB, use smaller file
```

### Test 6: Upload Image
```
Expected: Image badge shows, AI describes image content
Action: Click 📎, select .png file, send
Result: "🖼️ filename.png" badge, response describes image
Error to check:
  - If error: Check image is actual image (not renamed file)
  - If AI ignores image: Check Network request has image dataUrl
```

### Test 7: Upload PDF
```
Expected: PDF badge shows, AI summarizes PDF content
Action: Click 📎, select .pdf file, send
Result: "📋 filename.pdf" badge, response mentions PDF text
Error to check:
  - If extraction fails: Check backend logs for pdf-parse errors
  - If "cannot extract" message: PDF may be scanned/image-only
```

### Test 8: Persistent Chat History
```
Expected: After refresh (F5), chat history still visible
Action: Send message, press F5, verify message still there
Result: Chat loads from database
Error to check:
  - If messages gone: Database not saving (check backend GET /api/messages was called)
  - If only partial history: Check MAX_STORED_MESSAGES limit (50 by default)
```

---

## Auto-Fix Common Issues

### Issue: "Cannot find module 'xyz'"
**Fix:** Go to backend folder, run `npm install`, restart backend

### Issue: Backend shows "Port 3001 already in use"
**Fix:** Kill process on port 3001:
Windows:
```powershell
Get-NetTCPConnection -State Listen | Where-Object {$_.LocalPort -eq 3001} | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {Stop-Process -Id $_ -Force}
```
Linux/Mac:
```bash
lsof -ti:3001 | xargs kill -9
```

### Issue: Frontend shows blank page
**Fix:** 
1. Hard refresh: Ctrl+Shift+R
2. Clear cache: Ctrl+Shift+Delete
3. Check Network tab - verify main.xxx.js loads (200 status)
4. Check console for errors

### Issue: AI not responding
**Fix:**
1. Check backend console - look for "OpenRouter" error
2. Verify OPENROUTER_API_KEY in backend/.env
3. Check timeout (wait 25 seconds max)
4. Check network 500 error - screenshot and note exact message

### Issue: File upload fails with 413 error
**Fix:** File is > 50MB, use smaller file (< 20MB)

### Issue: Network shows "Failed to fetch"
**Fix:** Backend is down
1. Check backend terminal for crash
2. Restart: `npm start`
3. Verify http://localhost:3001 responds

---

## Validation Report Template

When everything works, create a report:

```
# Testing Report - [Date]

## Environment
- Backend: http://localhost:3001 ✅
- Frontend: http://localhost:3000 ✅
- Browser: Chrome / Firefox / Edge
- OS: Windows / Mac / Linux

## Features Tested
- [ ] Login / Authentication ✅
- [ ] Chat messaging ✅
- [ ] Text file upload ✅
- [ ] Image upload ✅
- [ ] PDF upload ✅
- [ ] PowerPoint upload ✅
- [ ] Persistent history ✅
- [ ] File badges show correctly ✅
- [ ] Error handling works ✅

## Console Errors Found
- None ✅

## Network Errors Found
- None ✅

## Overall Status
✅ All systems operational

## Known Limitations
- (if any)

## Next Steps
- (if any improvements needed)
```

---

## Quick Smoke Test Script (5 mins)

```
1. [ ] Login with test@example.com / 123456
2. [ ] Send: "test message 1"
   - Check: Message appears, AI responds, no console errors
3. [ ] Click 📎, select test.txt
   - Check: File name shows as badge
4. [ ] Send with message: "analyze this"
   - Check: 📝 badge appears, AI mentions file
5. [ ] Refresh page (F5)
   - Check: All messages still visible
6. [ ] Open DevTools Console (F12)
   - Check: No red error messages
7. [ ] Open DevTools Network
   - Check: No red requests (all 200 status)

PASSED = All 7 checks green ✅
FAILED = Note which check failed and screenshot error
```

---

## Getting Help

If you find an error you can't fix:

1. Take a screenshot of:
   - The error in browser
   - The error in console (F12)
   - The Network request that failed
   - The backend terminal output

2. Document:
   - What you clicked/typed
   - What you expected to happen
   - What actually happened
   - Error message (exact text)

3. Share:
   - Screenshots
   - Steps to reproduce
   - Browser type and version
   - Whether it's repeatable

This info allows quick debugging and fixing.
