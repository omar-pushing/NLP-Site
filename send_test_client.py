import time
import wave
import numpy as np
import socketio

BACKEND = 'http://localhost:8080'
WAV_PATH = r'D:\College\NLP Backend\harvard.wav'

def stream_wav_chunks(path, chunk_sec=1):
    wf = wave.open(path, 'rb')
    sr = wf.getframerate()
    nch = wf.getnchannels()
    sampwidth = wf.getsampwidth()
    dtype = np.int16 if sampwidth == 2 else np.int16
    chunk_frames = int(sr * chunk_sec)
    while True:
        raw = wf.readframes(chunk_frames)
        if not raw:
            break
        data = np.frombuffer(raw, dtype=dtype)
        if nch > 1:
            data = data.reshape(-1, nch)[:,0]
        data = data.astype(np.float32) / 32768.0
        yield data, sr
    wf.close()

def chunk_and_send(sio, samples, chunk_samples=16000):
    i = 0
    n = len(samples)
    while i < n:
        chunk = samples[i:i+chunk_samples]
        # send as raw float32 bytes
        sio.emit('audio_stream', {'audio': bytearray(chunk.tobytes())})
        i += chunk_samples
        time.sleep(0.05)

def main():
    sio = socketio.Client()

    @sio.event
    def connect():
        print('connected')

    @sio.on('transcription_result')
    def on_transcription(data):
        print('transcription_result:', data)

    sio.connect(BACKEND)
    # stream the wav in 2s chunks
    for chunk, sr in stream_wav_chunks(WAV_PATH, chunk_sec=2):
        chunk_and_send(sio, chunk, chunk_samples=sr*2)

    sio.emit('stop_recording', {})
    time.sleep(10)
    sio.disconnect()

if __name__ == '__main__':
    main()
