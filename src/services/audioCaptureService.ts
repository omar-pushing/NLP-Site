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
  private bufferSize = 4096;
  private sampleRate = 16000;

  async startRecording(callbacks: AudioCapture): Promise<void> {
    this.callbacks = callbacks;

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: { ideal: this.sampleRate },
        },
      });

      // Create audio context with specific sample rate
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.sampleRate,
      });

      // Create source from microphone
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create script processor for audio processing
      this.processor = this.audioContext.createScriptProcessor(
        this.bufferSize,
        1, // input channels
        1  // output channels
      );

      // Process audio data
      this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.isRecording) return;

        const inputData = event.inputBuffer.getChannelData(0);
        // Send audio data to callback
        this.callbacks.onAudioData?.(new Float32Array(inputData));
      };

      // Connect the audio graph
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isRecording = true;
      console.log('Audio recording started');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error accessing microphone:', error);
      this.callbacks.onError?.(`Microphone access denied or unavailable: ${errorMessage}`);
      throw error;
    }
  }

  stopRecording(): void {
    this.isRecording = false;

    if (this.processor) {
      this.processor.disconnect();
    }

    if (this.source) {
      this.source.disconnect();
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
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
