import { useOffline } from '../../hooks/useOffline';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineBanner() {
  const isOffline = useOffline();

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-warn/20 border-b border-warn/30 px-4 py-2 flex items-center justify-center gap-2 text-warn-light text-sm font-medium z-50 relative"
        >
          <WifiOff size={16} />
          <span>📵 Offline — showing cached content and limited features.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
