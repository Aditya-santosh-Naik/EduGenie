import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ImageIcon } from 'lucide-react';
import { api } from '../../lib/api';

interface ImageItem {
  id: string;
  prompt: string;
}

interface ImageGalleryProps {
  images: ImageItem[];
}

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [generatedUrls, setGeneratedUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const generateImage = async (image: ImageItem) => {
    setLoading((prev) => ({ ...prev, [image.id]: true }));
    const url = await api.image.generate(image.prompt);
    setGeneratedUrls((prev) => ({ ...prev, [image.id]: url }));
    setLoading((prev) => ({ ...prev, [image.id]: false }));
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {images.map((image) => {
        const url = generatedUrls[image.id];
        const isLoading = loading[image.id];

        return (
          <motion.div
            key={image.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card-hover overflow-hidden"
          >
            {url ? (
              <img
                src={url}
                alt={image.prompt}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 bg-bg-800/50 p-4">
                {isLoading ? (
                  <>
                    <Loader2 size={24} className="animate-spin text-accent-400" />
                    <p className="text-xs text-text-muted">Generating image...</p>
                  </>
                ) : (
                  <>
                    <ImageIcon size={24} className="text-text-muted" />
                    <p className="text-xs text-center text-text-muted line-clamp-2">
                      {image.prompt}
                    </p>
                    <button
                      onClick={() => generateImage(image)}
                      className="btn-primary px-4 py-1.5 text-xs"
                    >
                      Generate
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="p-3">
              <p className="text-xs text-text-muted line-clamp-2">{image.prompt}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
