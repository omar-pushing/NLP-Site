import { io, Socket } from 'socket.io-client';

interface WebSocketCallbacks {
  onTranscription?: (text: string, isSuccess: boolean) => void;
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
    if (backendUrl) {
      this.backendUrl = backendUrl;
    }

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.backendUrl, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 10,
          // polling first then upgrade — required for Railway proxy
          transports: ['polling', 'websocket'],
          timeout: 20000,
          forceNew: true,
          path: '/socket.io/',
        });

        this.socket.on('connect', () => {
          console.log('Connected to backend');
          this.callbacks.onConnect?.();
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Disconnected:', reason);
          this.callbacks.onDisconnect?.();
        });

        this.socket.on('transcription_result', (data: { text: string; success: boolean }) => {
          this.callbacks.onTranscription?.(data.text, data.success);
        });

        this.socket.on('buffer_update', (data: { buffer_size?: number; samples?: number }) => {
          const count = data.buffer_size ?? data.samples ?? 0;
          this.callbacks.onBufferUpdate?.(count);
        });

        this.socket.on('connect_error', (error: Error) => {
          console.error('Connection error:', error.message);
          this.callbacks.onError?.(error.message);
          reject(error);
        });

        this.socket.on('error', (error: any) => {
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
    const buffer = new ArrayBuffer(audioBuffer.length * 4);
    new Float32Array(buffer).set(audioBuffer);
    this.socket.emit('audio_stream', { audio: buffer });
  }

  requestTranscription(): void {
    if (!this.socket?.connected) return;
    this.socket.emit('transcribe_request', {});
  }

  clearBuffer(): void {
    if (!this.socket?.connected) return;
    this.socket.emit('clear_buffer', {});
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  disconnect(): void {
    this.socket?.disconnect();
  }
}

export const websocketService = new WebSocketService();
export type { WebSocketCallbacks };
