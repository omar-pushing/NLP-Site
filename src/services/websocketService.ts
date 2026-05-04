import { io, Socket } from 'socket.io-client';

interface TranscriptionResult {
  text: string;
  success: boolean;
  final: boolean;  // true = recording stopped, this is the last chunk
}

interface WebSocketCallbacks {
  onTranscription?: (result: TranscriptionResult) => void;
  onBufferUpdate?: (samples: number) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: string) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private callbacks: WebSocketCallbacks = {};
  private backendUrl: string = 'http://localhost:8080';

  connect(backendUrl?: string): Promise<void> {
    if (backendUrl) this.backendUrl = backendUrl;

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.backendUrl, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 10,
          transports: ['polling', 'websocket'],
          timeout: 20000,
          forceNew: true,
          path: '/socket.io/',
        });

        this.socket.on('connect', () => {
          console.log('[WS] Connected');
          this.callbacks.onConnect?.();
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('[WS] Disconnected:', reason);
          this.callbacks.onDisconnect?.();
        });

        this.socket.on('transcription_result', (data: TranscriptionResult) => {
          console.log('[WS] transcription_result', data);
          this.callbacks.onTranscription?.(data);
        });

        this.socket.on('buffer_update', (data: { buffer_size?: number; samples?: number }) => {
          const count = data.buffer_size ?? data.samples ?? 0;
          this.callbacks.onBufferUpdate?.(count);
        });

        this.socket.on('connect_error', (error: Error) => {
          console.error('[WS] connect_error:', error.message);
          this.callbacks.onError?.(error.message);
          reject(error);
        });

        this.socket.on('error', (error: unknown) => {
          this.callbacks.onError?.(String(error));
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  setCallbacks(callbacks: WebSocketCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  sendAudioStream(audioBuffer: Float32Array): void {
    if (!this.socket?.connected) return;
    // Send as Uint8Array — Socket.IO transmits this as clean binary.
    // Passing a raw ArrayBuffer gets serialised as a JS object on the wire,
    // which makes bytes(data['audio']) fail silently on the Python side.
    const uint8 = new Uint8Array(
      audioBuffer.buffer,
      audioBuffer.byteOffset,
      audioBuffer.byteLength,
    );
    this.socket.emit('audio_stream', { audio: uint8 });
  }

  /** Tell the backend the user has stopped — triggers a final flush + transcription. */
  stopRecording(): void {
    if (!this.socket?.connected) return;
    this.socket.emit('stop_recording', {});
  }

  /** Legacy manual trigger (kept for compatibility). */
  requestTranscription(): void {
    if (!this.socket?.connected) return;
    this.socket.emit('transcribe_request', {});
  }

  clearBuffer(): void {
    if (!this.socket?.connected) return;
    this.socket.emit('clear_buffer', {});
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  disconnect(): void {
    this.socket?.disconnect();
  }
}

export const websocketService = new WebSocketService();
export type { WebSocketCallbacks, TranscriptionResult };
