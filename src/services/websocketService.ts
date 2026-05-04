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
  private backendUrl: string = 'http://localhost:5000';

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
          reconnectionAttempts: 5,
          transports: ['websocket'],
        });

        this.socket.on('connect', () => {
          console.log('Connected to backend');
          this.callbacks.onConnect?.();
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Disconnected from backend:', reason);
          this.callbacks.onDisconnect?.();
        });

        this.socket.on('transcription_result', (data: { text: string; success: boolean }) => {
          console.log('Transcription result:', data);
          this.callbacks.onTranscription?.(data.text, data.success);
        });

        this.socket.on('buffer_update', (data: { buffer_size?: number; samples?: number }) => {
          console.log('Buffer update:', data);
          // Backend sends buffer_size; support both field names
          const count = data.buffer_size ?? data.samples ?? 0;
          this.callbacks.onBufferUpdate?.(count);
        });

        this.socket.on('connect_error', (error: Error) => {
          console.error('Connection error:', error);
          this.callbacks.onError?.(error.message);
          reject(error);
        });

        this.socket.on('error', (error: any) => {
          console.error('Socket error:', error);
          this.callbacks.onError?.(error);
        });
      } catch (error) {
        console.error('Failed to create socket connection:', error);
        reject(error);
      }
    });
  }

  setCallbacks(callbacks: WebSocketCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  sendAudioStream(audioBuffer: Float32Array): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected');
      return;
    }

    // Convert Float32Array to Buffer-like data for transmission
    const audioBytes = this.float32ToBytes(audioBuffer);
    this.socket.emit('audio_stream', { audio: audioBytes });
  }

  requestTranscription(): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected');
      return;
    }
    this.socket.emit('transcribe_request', {});
  }

  clearBuffer(): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected');
      return;
    }
    this.socket.emit('clear_buffer', {});
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  private float32ToBytes(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 4);
    const view = new Float32Array(buffer);
    view.set(float32Array);
    return buffer;
  }
}

export const websocketService = new WebSocketService();
export type { WebSocketCallbacks };
