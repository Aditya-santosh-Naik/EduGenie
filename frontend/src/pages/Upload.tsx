import { motion } from 'framer-motion';
import PDFUploader from '../components/PDFUpload/PDFUploader';

export default function Upload() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="mb-2 text-3xl font-bold">Upload Study Material</h1>
        <p className="text-text-muted">
          Upload your PDFs and ask questions directly from your notes
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <PDFUploader />
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h3 className="mb-4 text-sm font-semibold text-text-muted">How it works</h3>
        <div className="space-y-3">
          {[
            { step: '1', title: 'Upload a PDF', desc: 'Textbooks, notes, or any study material' },
            { step: '2', title: 'AI parses & indexes', desc: 'Chunks the text and creates searchable embeddings' },
            { step: '3', title: 'Ask questions', desc: 'Go to Learn and ask — the AI will use your uploaded material as context' }
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-500/20 text-xs font-bold text-accent-400">
                {step}
              </span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-text-muted">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
