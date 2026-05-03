# VoiceFlow - Setup Guide

This guide explains how to set up and run the VoiceFlow frontend with the Speech-to-Text backend.

## Prerequisites

- **Node.js** (v18+) and npm or pnpm
- **Python** (v3.8+) for the backend
- **Git** for cloning repositories

## Backend Setup

### 1. Clone the Backend Repository

```bash
git clone https://github.com/Abdalrahman-Amr-Dev/Sequential-LSTM-Architecture-for-Real-Time-Speech-to-Text-Synthesis.git
cd Sequential-LSTM-Architecture-for-Real-Time-Speech-to-Text-Synthesis
```

### 2. Install Python Dependencies

```bash
# Create a virtual environment (optional but recommended)
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 3. Configure Backend Environment Variables

Create a `.env` file in the backend directory:

```
WHISPER_MODEL=tiny
SECRET_KEY=your-secret-key-here
PORT=5000
MAX_BUFFER_SECONDS=5
```

**Available Whisper Models:**
- `tiny` (smallest, fastest)
- `base`
- `small`
- `medium`
- `large` (largest, slowest but most accurate)

Start with `tiny` for testing, then upgrade if needed.

### 4. Run the Backend

```bash
# With CORS enabled for development
python websocket_api.py
```

The backend will run on `http://localhost:5000`

## Frontend Setup

### 1. Install Frontend Dependencies

In the frontend directory (`d:\College\NLP`):

```bash
npm install
# or if using pnpm:
pnpm install
```

### 2. Configure Frontend Environment Variables

Create a `.env.local` file in the frontend root directory:

```
VITE_BACKEND_URL=http://localhost:5000
```

You can also modify this in the code at `src/services/websocketService.ts` line:
```typescript
private backendUrl: string = 'http://localhost:5000';
```

### 3. Run the Frontend

```bash
npm run dev
# or if using pnpm:
pnpm dev
```

The frontend will run on `http://localhost:5173` (or another port if 5173 is in use)

## Usage

1. Open your browser to `http://localhost:5173`
2. You should see the VoiceFlow interface with a connection status indicator
3. Wait for "✓ Connected to Backend" message
4. Click "Start Recording" button
5. Allow microphone access when prompted
6. Speak naturally - your speech will be captured and transcribed in real-time
7. Click "Stop" to finish recording
8. The transcription will be processed by the backend and displayed
9. Use the Copy or Download buttons to save your transcript

## Troubleshooting

### Connection Issues

**Error: "Not connected to backend"**
- Ensure the backend is running on `http://localhost:5000`
- Check that Python dependencies are installed
- Verify no firewall is blocking port 5000

**CORS Error in Browser Console**
- The backend needs to allow CORS requests from the frontend
- Add CORS support to `websocket_api.py` if not already present

### Audio Issues

**"Microphone access denied"**
- Check browser permissions for microphone access
- On Windows, ensure the app has microphone access in Settings > Privacy
- Try a different browser

**No Transcription Output**
- Ensure you spoke clearly for at least 1 second
- Check backend logs for errors
- Try the larger Whisper model (change `WHISPER_MODEL` in backend `.env`)

**Audio Quality Issues**
- Use a quality microphone
- Reduce background noise
- Speak clearly and at normal volume

## Architecture

The system works as follows:

1. **Frontend** captures audio from the microphone using Web Audio API
2. **Audio data** is sent to the backend via WebSocket (Socket.IO)
3. **Backend** maintains a 5-second rolling buffer of audio
4. **Whisper Model** processes the audio when transcription is requested
5. **Transcription results** are sent back to the frontend via WebSocket
6. **Frontend** displays the results in real-time

## File Structure

**Frontend:**
```
src/
├── app/
│   └── App.tsx          # Main React component
├── services/
│   ├── websocketService.ts     # Socket.IO client
│   └── audioCaptureService.ts  # Web Audio API wrapper
└── styles/
    └── globals.css      # Tailwind CSS
```

**Backend:**
```
├── main.py                 # Whisper model initialization
├── websocket_api.py        # Flask-SocketIO server
├── requirements.txt        # Python dependencies
└── .env                    # Environment configuration
```

## Performance Tips

1. **Start with `tiny` model** - fastest for real-time transcription
2. **Monitor memory** - larger models use more RAM
3. **Use a wired microphone** - better audio quality
4. **Close other applications** - reduces CPU load
5. **Run on a dedicated machine** - better performance for production

## Production Deployment

For production:

1. Use `base` or `small` Whisper model for better accuracy
2. Enable SSL/HTTPS
3. Implement proper authentication
4. Use environment variables for sensitive configuration
5. Consider using a CDN for the frontend
6. Deploy backend on a GPU-enabled server for faster transcription

## Support

For issues with the backend, visit:
https://github.com/Abdalrahman-Amr-Dev/Sequential-LSTM-Architecture-for-Real-Time-Speech-to-Text-Synthesis

## License

This project is built with:
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Flask, Flask-SocketIO, OpenAI Whisper
