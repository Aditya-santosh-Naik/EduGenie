import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useUserStore } from '../../store/userStore';

export default function PDFUploader() {
  const { userId } = useUserStore();
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{ chunkCount: number; message: string } | null>(null);
  const [error, setError] = useState('');

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are supported');
        setStatus('error');
        return;
      }

      setStatus('uploading');
      setError('');
      setResult(null);

      try {
        const data = await api.rag.upload(file, userId);
        if (data.success) {
          setResult({ chunkCount: data.chunkCount, message: data.message });
          setStatus('success');
        } else {
          setError(data.error || 'Upload failed');
          setStatus('error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setStatus('error');
      }
    },
    [userId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all ${
          isDragging
            ? 'border-accent-400 bg-accent-500/10'
            : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
        }`}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleFile(file);
          };
          input.click();
        }}
      >
        {status === 'uploading' ? (
          <>
            <Loader2 size={32} className="mb-3 animate-spin text-accent-400" />
            <p className="text-sm text-text-muted">Processing your PDF...</p>
            <p className="mt-1 text-xs text-text-muted">Parsing, chunking, and embedding</p>
          </>
        ) : (
          <>
            <Upload
              size={32}
              className={`mb-3 ${isDragging ? 'text-accent-400' : 'text-text-muted'}`}
            />
            <p className="text-sm font-medium">
              {isDragging ? 'Drop your PDF here' : 'Drag & drop a PDF, or click to browse'}
            </p>
            <p className="mt-1 text-xs text-text-muted">Supports textbooks, notes, and study material</p>
          </>
        )}
      </motion.div>

      {/* Success state */}
      {status === 'success' && result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 rounded-xl border border-success/20 bg-success/10 p-5"
        >
          <div className="flex items-start gap-3">
            <CheckCircle size={24} className="shrink-0 text-success" />
            <div>
              <p className="text-base font-bold text-success">Upload successful!</p>
              <p className="mt-1 text-sm text-text-muted">{result.message}</p>
              <p className="mt-2 text-sm font-medium text-text-main/90">
                💡 Your custom curriculum is ready.
              </p>
            </div>
          </div>
          
          <div className="mt-2 pt-4 border-t border-success/20 flex justify-end">
            <button
              onClick={() => {
                // Navigate to learn page
                window.location.href = '/learn';
              }}
              className="px-6 py-2.5 rounded-xl bg-success hover:bg-success/90 text-background font-bold shadow-lg transition-all hover:-translate-y-0.5"
            >
              Start Curriculum →
            </button>
          </div>
        </motion.div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/10 p-4"
        >
          <AlertCircle size={20} className="shrink-0 text-danger" />
          <div>
            <p className="text-sm font-medium text-danger">Upload failed</p>
            <p className="mt-1 text-xs text-text-muted">{error}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
