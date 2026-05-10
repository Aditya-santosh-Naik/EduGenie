import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useVoice } from '../../hooks/useVoice';

interface ReadAloudProps {
  text: string;
}

export default function ReadAloud({ text }: ReadAloudProps) {
  const { speak, stopSpeaking, isPlaying, ttsLoading } = useVoice();

  const handleToggle = () => {
    if (isPlaying) {
      stopSpeaking();
    } else {
      // Clean text — remove markdown headings
      const cleanText = text
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .slice(0, 3000); // Limit length for TTS
      speak(cleanText);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={ttsLoading}
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
        isPlaying
          ? 'bg-accent-500/20 text-accent-400'
          : 'text-text-muted hover:bg-white/5 hover:text-text-main'
      }`}
    >
      {ttsLoading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : isPlaying ? (
        <VolumeX size={14} />
      ) : (
        <Volume2 size={14} />
      )}
      {isPlaying ? 'Stop' : 'Read Aloud'}
    </button>
  );
}
