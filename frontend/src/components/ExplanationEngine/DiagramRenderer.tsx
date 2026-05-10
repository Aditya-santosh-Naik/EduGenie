import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface DiagramRendererProps {
  type?: string;
  code: string;
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#6c5ce7',
    primaryTextColor: '#e6eef6',
    primaryBorderColor: '#5548c8',
    lineColor: '#9aa3b2',
    secondaryColor: '#16181d',
    tertiaryColor: '#0f1115',
    background: '#0b0d10',
    mainBkg: '#16181d',
    nodeBorder: '#5548c8',
    clusterBkg: '#16181d',
    titleColor: '#e6eef6',
    edgeLabelBackground: '#16181d'
  },
  fontFamily: 'Inter, sans-serif'
});

export default function DiagramRenderer({ type: _type, code }: DiagramRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!containerRef.current || !code) return;

    const renderDiagram = async () => {
      try {
        // Clean the code — remove potential issues
        const cleanCode = code.replace(/\\n/g, '\n').trim();
        const id = `mermaid-${Date.now()}`;

        containerRef.current!.innerHTML = '';
        const { svg } = await mermaid.render(id, cleanCode);
        containerRef.current!.innerHTML = svg;
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      }
    };

    renderDiagram();
  }, [code]);

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-warning">Diagram render failed — showing raw code:</p>
        <pre className="overflow-x-auto rounded-lg bg-bg-800 p-4 text-xs text-text-muted">
          <code>{code.replace(/\\n/g, '\n')}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Zoom controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          className="btn-ghost px-2 py-1 text-xs"
        >
          −
        </button>
        <span className="text-xs text-text-muted">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
          className="btn-ghost px-2 py-1 text-xs"
        >
          +
        </button>
      </div>

      {/* Scrollable diagram container */}
      <div className="overflow-auto rounded-lg bg-bg-800/50 p-4" style={{ maxHeight: '500px' }}>
        <div
          ref={containerRef}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          className="transition-transform duration-200 [&_svg]:max-w-full"
        />
      </div>
    </div>
  );
}
