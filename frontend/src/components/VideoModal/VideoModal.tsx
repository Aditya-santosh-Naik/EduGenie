import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, AlertCircle } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { api } from '../../lib/api';

interface VideoModalProps {
  jobId: string | null;
  onClose: () => void;
}

export default function VideoModal({ jobId, onClose }: VideoModalProps) {
  const [status, setStatus] = useState<string>('queued');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll for video status
  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const data = await api.media.videoStatus(jobId);
        setStatus(data.status);

        if (data.status === 'done' && data.url) {
          setVideoUrl(data.url);
          clearInterval(interval);
        } else if (data.status === 'failed') {
          setError(data.reason || 'Video generation failed');
          clearInterval(interval);
        }
      } catch {
        /* polling error — retry */
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [jobId]);

  return (
    <Dialog.Root open={!!jobId} onOpenChange={() => onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <h3 className="font-semibold">AI-Generated Video</h3>
              <Dialog.Close className="rounded-lg p-1.5 text-text-muted hover:bg-white/10 hover:text-text-main">
                <X size={18} />
              </Dialog.Close>
            </div>

            {/* Content */}
            <div className="flex min-h-[300px] items-center justify-center p-6">
              {videoUrl ? (
                <div className="w-full">
                  <img
                    src={videoUrl}
                    alt="Generated educational animation"
                    className="w-full rounded-lg"
                  />
                </div>
              ) : error ? (
                <div className="text-center">
                  <AlertCircle size={32} className="mx-auto mb-3 text-danger" />
                  <p className="text-sm text-danger">{error}</p>
                  <p className="mt-1 text-xs text-text-muted">
                    Make sure ComfyUI is running with the Wan2.1 model loaded
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <Loader2 size={32} className="mx-auto mb-3 animate-spin text-accent-400" />
                  <p className="text-sm text-text-main">
                    {status === 'queued' ? 'Queued for generation...' : 'Generating video...'}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    This may take several minutes on 6GB VRAM
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
