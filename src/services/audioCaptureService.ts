interface AudioCapture {
  onAudioData?: (audioData: Float32Array) => void;
  onError?: (error: string) => void;
}

class AudioCaptureService {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isRecording = false;
  private callbacks: AudioCapture = {};
  private sampleRate = 16000;

  async startRecording(callbacks: AudioCapture): Promise<void> {
    this.callbacks = callbacks;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      // Use the native sample rate first, then resample to 16kHz
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // ScriptProcessorNode buffer size 4096 — still widely supported
      const bufferSize = 4096;
      this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.isRecording) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const nativeSampleRate = this.audioContext!.sampleRate;

        // Resample to 16kHz if needed
        if (nativeSampleRate !== this.sampleRate) {
          const resampled = this.resample(inputData, nativeSampleRate, this.sampleRate);
          this.callbacks.onAudioData?.(resampled);
        } else {
          this.callbacks.onAudioData?.(new Float32Array(inputData));
        }
      };

      this.source.connect(this.processor);
      // Must connect to destination for onaudioprocess to fire
      this.processor.connect(this.audioContext.destination);

      this.isRecording = true;
      console.log('Audio recording started, native rate:', this.audioContext.sampleRate);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.callbacks.onError?.(`Microphone error: ${msg}`);
      throw error;
    }
  }

  private resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
    const ratio = fromRate / toRate;
    const outputLength = Math.round(input.length / ratio);
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
      const t = srcIndex - srcIndexFloor;
      output[i] = input[srcIndexFloor] * (1 - t) + input[srcIndexCeil] * t;
    }
    return output;
  }

  stopRecording(): void {
    this.isRecording = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    console.log('Audio recording stopped');
  }

  isRecordingActive(): boolean {
    return this.isRecording;
  }

  getSampleRate(): number {
    return this.sampleRate;
  }
}

export const audioCaptureService = new AudioCaptureService();
export type { AudioCapture };
