# VoiceFlow Integration - Verification Checklist

Use this checklist to verify that the backend integration is working correctly.

## Pre-Flight Checks

### Dependencies
- [ ] Node.js is installed (v18+): `node --version`
- [ ] npm is installed: `npm --version`
- [ ] Python is installed (v3.8+): `python --version`
- [ ] Git is installed: `git --version`

### Repositories
- [ ] Backend repository cloned
- [ ] Backend dependencies installed: `pip install -r requirements.txt`
- [ ] Frontend dependencies installed: `npm install` (in d:\College\NLP)

## Backend Startup

### Environment
- [ ] Backend `.env` file created with at least:
  ```
  WHISPER_MODEL=tiny
  PORT=5000
  ```

### Startup
- [ ] Backend running: `python websocket_api.py`
- [ ] See message: `Running on http://localhost:5000` or similar
- [ ] No errors in backend terminal

## Frontend Startup

### Configuration
- [ ] Frontend `.env.local` created (optional):
  ```
  VITE_BACKEND_URL=http://localhost:5000
  ```

### Startup
- [ ] Frontend running: `npm run dev`
- [ ] See message: `Local: http://localhost:5173` or similar
- [ ] No compilation errors

## Browser Testing

### Access
- [ ] Browser opens to `http://localhost:5173`
- [ ] VoiceFlow interface loads
- [ ] All UI elements visible
- [ ] No console errors (press F12 to check)

### Connection Status
- [ ] Green dot in header (connected indicator)
- [ ] Message shows "✓ Connected to Backend"
- [ ] If red/connecting, wait 5 seconds and refresh

### If Not Connected
- [ ] Check backend is running in terminal
- [ ] Check backend URL in `.env.local` or code
- [ ] Check browser console for error messages
- [ ] Look for CORS errors (connection issue)

## Microphone Setup

### Permissions
- [ ] Browser shows microphone permission prompt
- [ ] You allow microphone access
- [ ] Browser shows "Microphone allowed" in address bar

### Testing Microphone
- [ ] System microphone works (test in Discord/Teams first)
- [ ] Microphone not muted
- [ ] No other app using microphone exclusively

## Recording Test

### Start Recording
- [ ] Click "Start Recording" button
- [ ] Button changes to red "Stop" button
- [ ] Recording timer counts up (00:00, 00:01, etc.)
- [ ] Microphone indicator shows activity
- [ ] "Recording Live" message visible

### Speak into Microphone
- [ ] Speak naturally and clearly
- [ ] Speak for at least 1-2 seconds
- [ ] You hear no audio feedback (expected)
- [ ] Browser DevTools shows no errors

### Stop Recording
- [ ] Click "Stop" button
- [ ] Timer stops
- [ ] "Ready to Record" message appears

### Check for Transcription
- [ ] Wait 2-5 seconds for backend to process
- [ ] Transcription appears in right panel
- [ ] Transcribed text is readable
- [ ] Text matches what you said (approximately)

## Advanced Tests

### Copy Functionality
- [ ] Click Copy button (clipboard icon)
- [ ] Button shows checkmark briefly
- [ ] Open notepad/document and paste
- [ ] Transcription text pastes correctly

### Download Functionality
- [ ] Click Download button
- [ ] File downloads to Downloads folder
- [ ] Filename: `voiceflow-transcript-YYYY-MM-DD.txt`
- [ ] Open file and verify content

### Clear Functionality
- [ ] Click Clear button (trash icon)
- [ ] Current text in transcript disappears
- [ ] Transcript buffer clears
- [ ] Button remains disabled until new content

### Multiple Recordings
- [ ] Record again (Start → Speak → Stop)
- [ ] New text appends to transcript
- [ ] Word/character counts update
- [ ] All features still work

## Developer Console Checks

### Open DevTools
- [ ] Press F12 or right-click → Inspect
- [ ] Go to Console tab
- [ ] Look for these messages:

```
✓ Connected to backend
✓ Audio recording started
✓ Transcription result: { text: "...", success: true }
```

### Check Network
- [ ] Go to Network tab
- [ ] Filter for "WS" (WebSocket)
- [ ] Should show socket.io connection
- [ ] Should show audio_stream and transcribe_request events

### No Errors
- [ ] No red error messages in console
- [ ] No CORS errors
- [ ] No connection timeout errors
- [ ] No audio errors

## Backend Verification

### Check Backend Terminal
- [ ] Look for connection messages:
  ```
  Received message: connect
  Received message: audio_stream
  Received message: transcribe_request
  ```

### Backend Processing
- [ ] Backend processes audio (may see output)
- [ ] No Python errors/tracebacks
- [ ] Transcription result sent back

## Final Validation

### End-to-End Test
1. [ ] Start fresh browser session
2. [ ] See "Connected" status
3. [ ] Record 5-second speech sample
4. [ ] Get transcription back
5. [ ] Copy and download work
6. [ ] No errors anywhere

### Performance Check
- [ ] Transcription takes 2-10 seconds (depends on model)
- [ ] UI remains responsive
- [ ] No lag or stuttering
- [ ] Memory usage reasonable

### Stress Test
- [ ] Record multiple times in succession
- [ ] System still responsive
- [ ] All features still work
- [ ] No memory leaks (check DevTools)

## Troubleshooting Checklist

If something doesn't work, check:

### Connection Issue
- [ ] Backend running: `python websocket_api.py`
- [ ] Port 5000 not blocked
- [ ] Frontend URL is http://localhost:5173
- [ ] Backend URL is http://localhost:5000
- [ ] No firewall blocking

### Microphone Issue
- [ ] Microphone works in system settings
- [ ] Browser has microphone permission
- [ ] Another app isn't using it
- [ ] Check console for specific error

### No Transcription
- [ ] Spoke for at least 1 second
- [ ] Good audio quality/clarity
- [ ] Backend didn't error (check logs)
- [ ] Try larger model (base instead of tiny)

### UI Not Updating
- [ ] Refresh browser page
- [ ] Clear browser cache
- [ ] Check console for errors
- [ ] Restart frontend dev server

## Success Criteria ✅

You'll know everything is working when:

- [x] Browser shows "Connected to Backend" ✓
- [x] Start Recording button is active
- [x] Microphone captures audio
- [x] Transcription appears after recording
- [x] Copy/Download buttons work
- [x] No errors in console
- [x] Multiple recordings work in sequence

## Getting Help

If you're stuck:

1. **Check the logs** - Both browser console and backend terminal
2. **Review SETUP.md** - Has troubleshooting section
3. **Check INTEGRATION.md** - Technical details
4. **Look at code** - Check websocketService.ts and App.tsx

## Performance Tips

- Start with `tiny` model for testing
- Use a wired USB microphone for best results
- Close other applications to reduce CPU load
- Upgrade to `base` or `small` model for better accuracy

---

**Once all items are checked ✓, your VoiceFlow is fully integrated and working!**
