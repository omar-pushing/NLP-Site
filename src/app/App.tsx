import { useState, useEffect, useRef } from 'react';
import { Mic, Square, Trash2, Radio, Download, Copy, Check } from 'lucide-react';
import { websocketService } from '../services/websocketService';
import { audioCaptureService } from '../services/audioCaptureService';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [buffer, setBuffer] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
    }> = [];

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

      particles.forEach((particle, i) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size * 2);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.6)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();

        particles.forEach((otherParticle, j) => {
          if (i === j) return;
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            const opacity = 0.15 * (1 - distance / 120);
            ctx.strokeStyle = `rgba(139, 92, 246, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Initialize WebSocket connection on mount
  useEffect(() => {
    const initializeConnection = async () => {
      try {
        // Try to connect to backend
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
        
        websocketService.setCallbacks({
          onConnect: () => {
            console.log('Connected to backend');
            setIsConnected(true);
            setConnectionError(null);
          },
          onDisconnect: () => {
            console.log('Disconnected from backend');
            setIsConnected(false);
          },
          onTranscription: (text: string, isSuccess: boolean) => {
            console.log('Received transcription:', text, isSuccess);
            if (isSuccess && text && text !== 'No audio to transcribe') {
              setBuffer((prev) => prev + text.trim() + ' ');
            }
          },
          onError: (error: string) => {
            console.error('WebSocket error:', error);
            setConnectionError(error);
            setIsConnected(false);
          },
        });

        await websocketService.connect(backendUrl);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to connect to backend';
        console.error('Connection error:', errorMessage);
        setConnectionError(errorMessage);
        setIsConnected(false);
      }
    };

    initializeConnection();

    return () => {
      websocketService.disconnect();
    };
  }, []);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [buffer, transcript]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleStart = async () => {
    if (!isConnected) {
      setConnectionError('Not connected to backend. Please wait for connection.');
      return;
    }

    try {
      setIsRecording(true);
      setBuffer('');
      setRecordingTime(0);
      audioBufferRef.current = [];

      // Auto-transcribe every 3 seconds while recording
      transcriptionIntervalRef.current = setInterval(() => {
        if (websocketService.isConnected()) {
          websocketService.requestTranscription();
        }
      }, 3000);

      await audioCaptureService.startRecording({
        onAudioData: (audioData: Float32Array) => {
          audioBufferRef.current.push(audioData);
          
          // Send every 10 chunks (~0.5 seconds of audio) to avoid flooding
          if (audioBufferRef.current.length >= 10) {
            const combined = audioBufferRef.current.reduce((acc, chunk) => {
              const result = new Float32Array(acc.length + chunk.length);
              result.set(acc);
              result.set(chunk, acc.length);
              return result;
            });
            websocketService.sendAudioStream(combined);
            audioBufferRef.current = [];
          }
        },
        onError: (error: string) => {
          console.error('Audio capture error:', error);
          setConnectionError(error);
          setIsRecording(false);
          if (transcriptionIntervalRef.current) {
            clearInterval(transcriptionIntervalRef.current);
          }
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      console.error('Start recording error:', errorMessage);
      setConnectionError(errorMessage);
      setIsRecording(false);
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current);
      }
    }
  };

  const handleStop = async () => {
    setIsRecording(false);
    
    // Stop periodic transcription
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }

    audioCaptureService.stopRecording();
    
    // Send any remaining audio
    if (audioBufferRef.current.length > 0) {
      const combined = audioBufferRef.current.reduce((acc, chunk) => {
        const result = new Float32Array(acc.length + chunk.length);
        result.set(acc);
        result.set(chunk, acc.length);
        return result;
      });
      websocketService.sendAudioStream(combined);
      audioBufferRef.current = [];
    }
    
    // Wait longer to ensure all audio is received and buffered on backend before transcribing
    setTimeout(() => {
      websocketService.requestTranscription();
    }, 1500);
  };

  const handleClear = () => {
    setBuffer('');
    setTranscript('');
    websocketService.clearBuffer();
  };

  const handleCopy = async () => {
    const fullText = transcript + buffer;
    if (fullText.trim()) {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const fullText = transcript + buffer;
    if (fullText.trim()) {
      const blob = new Blob([fullText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voiceflow-transcript-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const wordCount = (transcript + buffer).trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        style={{ background: 'radial-gradient(ellipse at top, #1a1a2e 0%, #0a0a0f 50%, #000000 100%)' }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
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
              <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extralight tracking-tight">
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

        <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-card/20 backdrop-blur-2xl border border-primary/20 rounded-3xl p-8 sm:p-10 shadow-[0_8px_40px_rgba(99,102,241,0.12)] hover:shadow-[0_8px_60px_rgba(99,102,241,0.18)] transition-shadow duration-500">
                  <div className="flex flex-col items-center gap-10">
                    <div className="relative group">
                      <div
                        className={`w-48 h-48 sm:w-56 sm:h-56 rounded-full flex items-center justify-center transition-all duration-700 ${
                          isRecording
                            ? 'bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 shadow-[0_0_80px_rgba(99,102,241,0.5)]'
                            : 'bg-gradient-to-br from-muted/5 to-muted/10 border-2 border-border/20'
                        }`}
                      >
                        {isRecording ? (
                          <div className="relative">
                            <Radio className="w-24 h-24 sm:w-28 sm:h-28 text-primary drop-shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-32 h-32 sm:w-36 sm:h-36 border-2 border-primary/30 rounded-full animate-ping" />
                            </div>
                          </div>
                        ) : (
                          <Mic className="w-24 h-24 sm:w-28 sm:h-28 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors duration-300" />
                        )}
                      </div>
                      {isRecording && (
                        <>
                          <div className="absolute -inset-8 border-2 border-primary/15 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                          <div className="absolute -inset-16 border border-secondary/10 rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
                        </>
                      )}
                    </div>

                    <div className="text-center space-y-5 w-full">
                      <div className="text-6xl sm:text-7xl font-extralight text-foreground tabular-nums tracking-tighter">
                        {formatTime(recordingTime)}
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${isRecording ? 'bg-primary shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse' : 'bg-muted-foreground/20'}`} />
                        <div className="text-sm text-muted-foreground/80 uppercase tracking-[0.2em] font-light">
                          {isRecording ? 'Recording Live' : 'Ready to Record'}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 w-full justify-center items-center">
                      {!isRecording ? (
                        <button
                          onClick={handleStart}
                          disabled={!isConnected}
                          className="group relative px-12 py-6 bg-gradient-to-r from-primary via-secondary to-primary bg-size-200 bg-pos-0 hover:bg-pos-100 rounded-2xl overflow-hidden transition-all duration-500 hover:scale-105 active:scale-95 hover:shadow-[0_0_50px_rgba(99,102,241,0.7)] shadow-[0_4px_20px_rgba(99,102,241,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                          <div className="relative flex items-center gap-3">
                            <Mic className="w-7 h-7" />
                            <span className="text-lg font-light tracking-wide">Start Recording</span>
                          </div>
                        </button>
                      ) : (
                        <button
                          onClick={handleStop}
                          className="group relative px-12 py-6 bg-gradient-to-r from-destructive to-destructive/80 rounded-2xl overflow-hidden transition-all duration-500 hover:scale-105 active:scale-95 hover:shadow-[0_0_50px_rgba(239,68,68,0.7)] shadow-[0_4px_20px_rgba(239,68,68,0.3)]"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                          <div className="relative flex items-center gap-3">
                            <Square className="w-7 h-7" />
                            <span className="text-lg font-light tracking-wide">Stop</span>
                          </div>
                        </button>
                      )}
                      <button
                        onClick={handleClear}
                        disabled={!buffer}
                        className="group relative p-6 bg-muted/10 border-2 border-border/20 rounded-2xl transition-all duration-300 hover:bg-muted/20 hover:border-border/40 hover:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:scale-100 hover:shadow-[0_4px_20px_rgba(99,102,241,0.15)]"
                        title="Clear current buffer"
                      >
                        <Trash2 className="w-6 h-6 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-card/20 backdrop-blur-2xl border border-primary/20 rounded-2xl p-6 shadow-[0_4px_30px_rgba(99,102,241,0.1)]">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-background/30 rounded-xl border border-border/10">
                      <div className="text-2xl sm:text-3xl font-light text-foreground tabular-nums">{wordCount}</div>
                      <div className="text-xs text-muted-foreground/60 uppercase tracking-widest mt-1">Words</div>
                    </div>
                    <div className="text-center p-4 bg-background/30 rounded-xl border border-border/10">
                      <div className="text-2xl sm:text-3xl font-light text-foreground tabular-nums">{(transcript + buffer).length}</div>
                      <div className="text-xs text-muted-foreground/60 uppercase tracking-widest mt-1">Characters</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-3 bg-card/20 backdrop-blur-2xl border border-primary/20 rounded-3xl p-6 sm:p-8 shadow-[0_8px_40px_rgba(99,102,241,0.12)] hover:shadow-[0_8px_60px_rgba(99,102,241,0.18)] transition-shadow duration-500 flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                    <h3 className="text-sm uppercase tracking-[0.2em] text-muted-foreground/80 font-light">
                      Live Transcript
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      disabled={!(transcript + buffer).trim()}
                      className="p-2.5 bg-background/40 hover:bg-background/60 border border-border/20 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Copy className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={handleDownload}
                      disabled={!(transcript + buffer).trim()}
                      className="p-2.5 bg-background/40 hover:bg-background/60 border border-border/20 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
                      title="Download transcript"
                    >
                      <Download className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div
                  ref={transcriptRef}
                  className="flex-1 bg-background/40 border border-border/10 rounded-2xl p-6 sm:p-8 overflow-y-auto min-h-[450px] lg:min-h-[600px] scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/30"
                >
                  <div className="space-y-6">
                    {transcript && (
                      <p className="text-foreground/95 leading-relaxed text-base sm:text-lg font-light whitespace-pre-wrap">
                        {transcript}
                      </p>
                    )}
                    {buffer && (
                      <p className="text-foreground leading-relaxed text-base sm:text-lg font-light whitespace-pre-wrap">
                        {buffer}
                        <span className="inline-block w-0.5 h-6 bg-primary ml-1 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                      </p>
                    )}
                    {!transcript && !buffer && (
                      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                        <Mic className="w-16 h-16 text-muted-foreground/20 mb-4" />
                        <p className="text-muted-foreground/40 italic text-lg font-light">
                          Start recording to begin transcription
                        </p>
                        <p className="text-muted-foreground/30 text-sm mt-2 font-light">
                          Your words will appear here in real-time
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="py-6 px-4 sm:px-6 lg:px-8 border-t border-primary/10 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground/50">
              <div className="tracking-[0.15em] uppercase font-light">
                Powered by VoiceFlow AI Engine
              </div>
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
