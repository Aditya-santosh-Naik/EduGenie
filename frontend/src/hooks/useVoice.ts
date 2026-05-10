import { useState, useCallback, useRef } from 'react';
import { Howl } from 'howler';
import { api } from '../lib/api';

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const howlRef = useRef<Howl | null>(null);

  // ── TTS: Text-to-Speech ──────────────────
  const speak = useCallback(async (text: string) => {
    // Stop any current playback
    howlRef.current?.stop();
    setTtsLoading(true);

    try {
      const audioBuffer = await api.voice.tts(text);

      if (audioBuffer) {
        // Play via Howler.js with the audio from our TTS service
        const blob = new Blob([audioBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        howlRef.current = new Howl({
          src: [url],
          format: ['wav'],
          onplay: () => setIsPlaying(true),
          onend: () => {
            setIsPlaying(false);
            URL.revokeObjectURL(url);
          },
          onstop: () => {
            setIsPlaying(false);
            URL.revokeObjectURL(url);
          },
          onloaderror: () => {
            // Fallback to browser TTS
            browserTTS(text);
            URL.revokeObjectURL(url);
          }
        });

        howlRef.current.play();
      } else {
        // TTS service unavailable — fallback to browser speechSynthesis
        browserTTS(text);
      }
    } catch {
      browserTTS(text);
    } finally {
      setTtsLoading(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    howlRef.current?.stop();
    window.speechSynthesis?.cancel();
    setIsPlaying(false);
  }, []);

  // ── STT: Speech-to-Text ──────────────────
  const startRecording = useCallback(async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      console.warn('[voice] Microphone permission denied');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        resolve(null);
        return;
      }

      recorder.onstop = async () => {
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });

        // Stop all tracks to release the microphone
        recorder.stream.getTracks().forEach((t) => t.stop());

        // Send to STT service
        const transcript = await api.voice.stt(blob);
        resolve(transcript);
      };

      recorder.stop();
    });
  }, []);

  return {
    speak,
    stopSpeaking,
    startRecording,
    stopRecording,
    isRecording,
    isPlaying,
    ttsLoading
  };
}

/** Browser-native TTS fallback */
function browserTTS(text: string) {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}
