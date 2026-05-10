import { useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoice } from '../../hooks/useVoice';
import { cn } from '../../lib/utils';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
}

export default function VoiceInput({ onTranscript }: VoiceInputProps) {
  const { startRecording, stopRecording, isRecording } = useVoice();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleToggle = async () => {
    if (isRecording) {
      setIsProcessing(true);
      const transcript = await stopRecording();
      setIsProcessing(false);
      if (transcript) {
        onTranscript(transcript);
      }
    } else {
      await startRecording();
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isProcessing}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl transition-all',
        isRecording
          ? 'recording-pulse bg-danger text-white'
          : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-main'
      )}
      title={isRecording ? 'Stop recording' : 'Voice input'}
    >
      {isProcessing ? (
        <Loader2 size={18} className="animate-spin" />
      ) : isRecording ? (
        <MicOff size={18} />
      ) : (
        <Mic size={18} />
      )}
    </button>
  );
}
