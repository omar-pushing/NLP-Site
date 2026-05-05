/**
 * TranscriptionService — HTTP REST version
 *
 * Records audio via MediaRecorder (produces WebM/OGG natively in the browser),
 * then POSTs the blob to POST /transcribe as multipart/form-data.
 * No WebSocket, no Socket.IO, no persistent connection required.
 */

export interface TranscriptionCallbacks {
  onTranscript: (text: string) => void;
  onError: (msg: string) => void;
  onStateChange: (state: 'idle' | 'recording' | 'processing') => void;
}

class TranscriptionService {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private backendUrl = '';
  private callbacks: TranscriptionCallbacks | null = null;
  private state: 'idle' | 'recording' | 'processing' = 'idle';

  init(backendUrl: string) {
    this.backendUrl = backendUrl.replace(/\/+$/, '');
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.backendUrl}/health`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async startRecording(callbacks: TranscriptionCallbacks): Promise<void> {
    if (this.state !== 'idle') return;
    this.callbacks = callbacks;
    this.chunks = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      callbacks.onError(`Microphone error: ${msg}`);
      throw err;
    }

    // Pick the best supported MIME type
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
      .find(t => MediaRecorder.isTypeSupported(t)) ?? '';

    this.mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onerror = (e: Event) => {
      const msg = (e as any)?.error?.message ?? 'MediaRecorder error';
      this.callbacks?.onError(msg);
      this._setState('idle');
    };

    this.mediaRecorder.start(250); // collect chunks every 250 ms
    this._setState('recording');
  }

  async stopRecording(): Promise<void> {
    if (this.state !== 'recording' || !this.mediaRecorder) return;
    this._setState('processing');

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        // Stop all mic tracks
        this.mediaRecorder!.stream.getTracks().forEach(t => t.stop());

        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder!.mimeType || 'audio/webm',
        });

        await this._sendToBackend(blob);
        this._setState('idle');
        resolve();
      };

      this.mediaRecorder!.stop();
    });
  }

  private async _sendToBackend(blob: Blob): Promise<void> {
    try {
      const form = new FormData();
      form.append('audio', blob, 'recording.webm');

      const res = await fetch(`${this.backendUrl}/transcribe`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        this.callbacks?.onError(`Server error ${res.status}: ${text}`);
        return;
      }

      const data = await res.json();
      if (data.success && data.text?.trim()) {
        this.callbacks?.onTranscript(data.text.trim());
      } else if (!data.success) {
        this.callbacks?.onError(data.error ?? 'Transcription failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      this.callbacks?.onError(`Failed to reach backend: ${msg}`);
    }
  }

  private _setState(s: 'idle' | 'recording' | 'processing') {
    this.state = s;
    this.callbacks?.onStateChange(s);
  }

  getState() { return this.state; }
}

export const transcriptionService = new TranscriptionService();
