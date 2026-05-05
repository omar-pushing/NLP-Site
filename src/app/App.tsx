import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Trash2, Radio, Download, Copy, Check, Loader2 } from 'lucide-react';
import { websocketService, TranscriptionResult } from '../services/websocketService';
import { audioCaptureService } from '../services/audioCaptureService';

export default function App() {
  const [isRecording, setIsRecording]       = useState(false);
  const [isProcessing, setIsProcessing]     = useState(false); // Whisper running on backend
  const [transcript, setTranscript]         = useState('');
  const [recordingTime, setRecordingTime]   = useState(0);
  const [copied, setCopied]                 = useState(false);
  const [isConnected, setIsConnected]       = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const transcriptRef  = useRef<HTMLDivElement>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);

  // ── Particle canvas ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{ x: number; y: number; vx: number; vy: number; size: number }> = [];
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.5,
      });
    }

    let animationFrame: number;
    const animate = () => {
      ctx.fillStyle = 'rgba(10, 10, 15, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        g.addColorStop(0, 'rgba(99,102,241,0.6)');
        g.addColorStop(1, 'rgba(99,102,241,0)');
        ctx.fillStyle = g;
        ctx.fill();
        particles.forEach((o, j) => {
          if (i === j) return;
          const dx = p.x - o.x, dy = p.y - o.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(o.x, o.y);
            ctx.strokeStyle = `rgba(139,92,246,${0.15 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', handleResize);
    return () => { cancelAnimationFrame(animationFrame); window.removeEventListener('resize', handleResize); };
  }, []);

  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── WebSocket connection ───────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        // Normalise: strip trailing slash so Socket.IO path is always correct
        const rawUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080');
        const backendUrl = rawUrl.replace(/\/+$/, '');

        websocketService.setCallbacks({
          onConnect: () => {
            setIsConnected(true);
            setConnectionError(null);
          },
          onDisconnect: () => {
            setIsConnected(false);
            // If the connection drops while processing, clear it so UI doesn't
            // get stuck on the spinner indefinitely.
            setIsProcessing(false);
          },

          onTranscription: (result: TranscriptionResult) => {
            console.log('[App] transcription_result', result);
            // Append any non-empty text
            if (result.success && result.text && result.text.trim()) {
              setTranscript((prev) => prev + result.text.trim() + ' ');
            }
            // Always clear processing state on final, regardless of whether text is empty
            if (result.final) {
              setIsProcessing(false);
              if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
                processingTimeoutRef.current = null;
              }
            }
          },

          onError: (error: string) => {
            setConnectionError(error);
            setIsConnected(false);
            setIsProcessing(false);
          },
        });

        await websocketService.connect(backendUrl);
      } catch (err) {
        setConnectionError(err instanceof Error ? err.message : 'Failed to connect');
        setIsConnected(false);
      }
    };

    init();
    return () => websocketService.disconnect();
  }, []);

  // ── Auto-scroll transcript ─────────────────────────────────────────────────
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  // ── Recording timer ────────────────────────────────────────────────────────
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!isConnected) {
      setConnectionError('Not connected to backend. Please wait for connection.');
      return;
    }
    try {
      // Cancel any in-flight processing from a previous session
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
      setIsProcessing(false);
      setIsRecording(true);
      setRecordingTime(0);
      audioBufferRef.current = [];

      await audioCaptureService.startRecording({
        onAudioData: (audioData: Float32Array) => {
          audioBufferRef.current.push(audioData);
          // Batch every 4 ScriptProcessor frames (~1 s of audio) before sending
          if (audioBufferRef.current.length >= 4) {
            const combined = audioBufferRef.current.reduce((acc, chunk) => {
              const merged = new Float32Array(acc.length + chunk.length);
              merged.set(acc); merged.set(chunk, acc.length);
              return merged;
            });
            websocketService.sendAudioStream(combined);
            audioBufferRef.current = [];
          }
        },
        onError: (error: string) => {
          setConnectionError(error);
          setIsRecording(false);
        },
      });
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const handleStop = () => {
    setIsRecording(false);
    setIsProcessing(true);

    audioCaptureService.stopRecording();

    // Flush any remaining audio frames not yet sent
    if (audioBufferRef.current.length > 0) {
      const combined = audioBufferRef.current.reduce((acc, chunk) => {
        const merged = new Float32Array(acc.length + chunk.length);
        merged.set(acc); merged.set(chunk, acc.length);
        return merged;
      });
      websocketService.sendAudioStream(combined);
      audioBufferRef.current = [];
    }

    // Tell the backend to flush its buffer and transcribe the remainder.
    // A small delay lets the last audio_stream packet arrive first.
    setTimeout(() => websocketService.stopRecording(), 300);

    // Safety net: if the backend never sends final:true (e.g. network drop),
    // clear the processing state after 15 s so the UI doesn't stay stuck.
    if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
    processingTimeoutRef.current = setTimeout(() => {
      setIsProcessing(false);
      setConnectionError('Transcription timed out. Please try again.');
      processingTimeoutRef.current = null;
    }, 15000);
  };

  const handleClear = () => {
    setTranscript('');
    websocketService.clearBuffer();
  };

  const handleCopy = async () => {
    if (transcript.trim()) {
      await navigator.clipboard.writeText(transcript.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (transcript.trim()) {
      const blob = new Blob([transcript.trim()], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `voiceflow-transcript-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const hasText   = transcript.trim().length > 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        style={{ background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #0a0a0f 50%, #000000 100%)' }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* ── Header ── */}
        <header className="pt-6 sm:pt-10 pb-6 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            {connectionError && (
              <div className="mb-4 px-4 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                {connectionError}
              </div>
            )}
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="relative">
                <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)] ${isConnected ? 'bg-primary' : 'bg-destructive'}`} />
                <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-primary animate-ping' : 'bg-destructive'}`} />
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extralight tracking-tight">
                <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  VoiceFlow
                </span>
              </h1>
            </div>
            <p className="text-muted-foreground/60 text-xs sm:text-sm tracking-[0.25em] uppercase font-light">
              Neural Voice Transcription System
            </p>
            <p className="text-xs mt-2 text-muted-foreground/50">
              {isConnected ? '✓ Connected to Backend' : '✗ Connecting to Backend...'}
            </p>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">

              {/* ── Left panel ── */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-card/20 backdrop-blur-2xl border border-primary/20 rounded-3xl p-6 sm:p-8 shadow-[0_8px_40px_rgba(99,102,241,0.12)] hover:shadow-[0_8px_60px_rgba(99,102,241,0.18)] transition-shadow duration-500">
                  <div className="flex flex-col items-center gap-10">

                    {/* Mic orb */}
                    <div className="relative group">
                      <div className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full flex items-center justify-center transition-all duration-700 ${
                        isRecording
                          ? 'bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 shadow-[0_0_80px_rgba(99,102,241,0.5)]'
                          : isProcessing
                            ? 'bg-gradient-to-br from-secondary/10 via-primary/10 to-secondary/10 shadow-[0_0_40px_rgba(99,102,241,0.3)]'
                            : 'bg-gradient-to-br from-muted/5 to-muted/10 border-2 border-border/20'
                      }`}>
                        {isRecording ? (
                          <div className="relative">
                            <Radio className="w-16 h-16 sm:w-20 sm:h-20 text-primary drop-shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-24 h-24 sm:w-28 sm:h-28 border-2 border-primary/30 rounded-full animate-ping" />
                            </div>
                          </div>
                        ) : isProcessing ? (
                          <Loader2 className="w-16 h-16 sm:w-20 sm:h-20 text-primary/70 animate-spin" />
                        ) : (
                          <Mic className="w-16 h-16 sm:w-20 sm:h-20 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors duration-300" />
                        )}
                      </div>
                      {isRecording && (
                        <>
                          <div className="absolute -inset-8 border-2 border-primary/15 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                          <div className="absolute -inset-16 border border-secondary/10 rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
                        </>
                      )}
                    </div>

                    {/* Timer + status */}
                    <div className="text-center space-y-5 w-full">
                      <div className="text-5xl sm:text-6xl font-extralight text-foreground tabular-nums tracking-tighter">
                        {formatTime(recordingTime)}
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                          isRecording  ? 'bg-primary shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse' :
                          isProcessing ? 'bg-secondary shadow-[0_0_8px_rgba(139,92,246,0.8)] animate-pulse' :
                                         'bg-muted-foreground/20'
                        }`} />
                        <div className="text-sm text-muted-foreground/80 uppercase tracking-[0.2em] font-light">
                          {isRecording ? 'Recording Live' : isProcessing ? 'Transcribing…' : 'Ready to Record'}
                        </div>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-4 w-full justify-center items-center">
                      {!isRecording ? (
                        <button
                          onClick={handleStart}
                          disabled={!isConnected}
                          className="group relative px-8 py-4 bg-gradient-to-r from-primary via-secondary to-primary bg-size-200 bg-pos-0 hover:bg-pos-100 rounded-2xl overflow-hidden transition-all duration-500 hover:scale-105 active:scale-95 hover:shadow-[0_0_50px_rgba(99,102,241,0.7)] shadow-[0_4px_20px_rgba(99,102,241,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                          <div className="relative flex items-center gap-3">
                            <Mic className="w-5 h-5" />
                            <span className="text-base font-light tracking-wide">Start Recording</span>
                          </div>
                        </button>
                      ) : (
                        <button
                          onClick={handleStop}
                          className="group relative px-8 py-4 bg-gradient-to-r from-destructive to-destructive/80 rounded-2xl overflow-hidden transition-all duration-500 hover:scale-105 active:scale-95 hover:shadow-[0_0_50px_rgba(239,68,68,0.7)] shadow-[0_4px_20px_rgba(239,68,68,0.3)]"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                          <div className="relative flex items-center gap-3">
                            <Square className="w-5 h-5" />
                            <span className="text-base font-light tracking-wide">Stop</span>
                          </div>
                        </button>
                      )}
                      <button
                        onClick={handleClear}
                        disabled={!hasText}
                        className="group relative p-6 bg-muted/10 border-2 border-border/20 rounded-2xl transition-all duration-300 hover:bg-muted/20 hover:border-border/40 hover:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100 hover:shadow-[0_4px_20px_rgba(99,102,241,0.15)]"
                        title="Clear transcript"
                      >
                        <Trash2 className="w-6 h-6 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="bg-card/20 backdrop-blur-2xl border border-primary/20 rounded-2xl p-6 shadow-[0_4px_30px_rgba(99,102,241,0.1)]">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-background/30 rounded-xl border border-border/10">
                      <div className="text-2xl sm:text-3xl font-light text-foreground tabular-nums">{wordCount}</div>
                      <div className="text-xs text-muted-foreground/60 uppercase tracking-widest mt-1">Words</div>
                    </div>
                    <div className="text-center p-4 bg-background/30 rounded-xl border border-border/10">
                      <div className="text-2xl sm:text-3xl font-light text-foreground tabular-nums">{transcript.length}</div>
                      <div className="text-xs text-muted-foreground/60 uppercase tracking-widest mt-1">Characters</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Transcript panel ── */}
              <div className="lg:col-span-3 bg-card/20 backdrop-blur-2xl border border-primary/20 rounded-3xl p-6 sm:p-8 shadow-[0_8px_40px_rgba(99,102,241,0.12)] hover:shadow-[0_8px_60px_rgba(99,102,241,0.18)] transition-shadow duration-500 flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] ${isRecording || isProcessing ? 'bg-primary animate-pulse' : 'bg-primary/40'}`} />
                    <h3 className="text-sm uppercase tracking-[0.2em] text-muted-foreground/80 font-light">
                      {isProcessing ? 'Processing…' : 'Live Transcript'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleCopy} disabled={!hasText}
                      className="p-2.5 bg-background/40 hover:bg-background/60 border border-border/20 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                      title="Copy to clipboard">
                      {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <button onClick={handleDownload} disabled={!hasText}
                      className="p-2.5 bg-background/40 hover:bg-background/60 border border-border/20 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                      title="Download transcript">
                      <Download className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                <div ref={transcriptRef}
                  className="flex-1 bg-background/40 border border-border/10 rounded-2xl p-5 sm:p-6 overflow-y-auto min-h-[350px] lg:min-h-[500px] scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/30">
                  <div className="space-y-6">
                    {hasText ? (
                      <p className="text-foreground/95 leading-relaxed text-base sm:text-lg font-light whitespace-pre-wrap">
                        {transcript}
                        {(isRecording || isProcessing) && (
                          <span className="inline-block w-0.5 h-6 bg-primary ml-1 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                        )}
                      </p>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-16 h-16 text-primary/40 mb-4 animate-spin" />
                            <p className="text-muted-foreground/40 italic text-lg font-light">Transcribing your audio…</p>
                            <p className="text-muted-foreground/30 text-sm mt-2 font-light">This may take a few seconds</p>
                          </>
                        ) : (
                          <>
                            <Mic className="w-16 h-16 text-muted-foreground/20 mb-4" />
                            <p className="text-muted-foreground/40 italic text-lg font-light">Start recording to begin transcription</p>
                            <p className="text-muted-foreground/30 text-sm mt-2 font-light">Your words will appear here in real-time</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </main>

        {/* ── Footer ── */}
        <footer className="py-6 px-4 sm:px-6 lg:px-8 border-t border-primary/10 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground/50">
              <div className="tracking-[0.15em] uppercase font-light">Powered by VoiceFlow AI Engine</div>
              <div className="text-center sm:text-right font-light">
                <div className="tracking-wide">Developed by</div>
                <div className="mt-1 text-muted-foreground/70">
                  Abdulrahman Amr Eissa · Mohamed Mahmoud Helmy · Omar Ahmed Rezk
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
