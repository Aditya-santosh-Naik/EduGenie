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

// mermaid.render() manipulates shared document state and is not re-entrant.
// React StrictMode mounts every effect twice in development, so two renders
// overlap and one of them throws on a diagram that is perfectly valid. Queue
// them so only one runs at a time.
let renderQueue: Promise<unknown> = Promise.resolve();

function queueRender(id: string, code: string): Promise<{ svg: string }> {
  const run = renderQueue.then(
    () => mermaid.render(id, code),
    () => mermaid.render(id, code)
  );
  renderQueue = run.catch(() => {});
  return run;
}

/**
 * A 3B model writes *almost* valid Mermaid. Two failures show up constantly:
 *
 *   1. Orphan annotation lines it invents to attach a value to a node —
 *      "C: <3.2%" on its own line — which no Mermaid grammar accepts.
 *   2. Raw angle brackets inside labels. Mermaid's lexer reads "<" as the start
 *      of a tag and dies with a parse error on perfectly sensible text
 *      like "Salinity < 3.2%".
 *
 * Rather than show the student a broken diagram, keep the lines that are
 * genuinely structural and neutralise the rest. Returning an empty string tells
 * the caller there is nothing worth drawing.
 */
const DIAGRAM_HEADER =
  /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline)\b/i;

/** Edges, subgraphs and styling — the parts that actually define a diagram. */
const STRUCTURAL = /(--+>|--+|-\.-+>|==+>|\bsubgraph\b|^end$|\bstyle\b|\bclassDef\b|\bclass\b|\bclick\b)/;

/** A standalone node declaration such as A[Label] or C{Label}. */
const NODE_DECL = /^[A-Za-z0-9_]+\s*[[{(>]/;

function escapeLabelAngles(line: string): string {
  // Only inside label delimiters, so arrows like --> and <--> are left alone.
  return line.replace(/([[{(]+)([^\]})]*)([\]})]+)/g, (_m, open, body, close) =>
    open + body.replace(/</g, '&lt;').replace(/>/g, '&gt;') + close
  );
}

export function sanitizeMermaid(raw: string): string {
  const text = raw.replace(/\\n/g, '\n').trim();
  if (!text) return '';

  const kept: string[] = [];
  let sawEdge = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%')) continue;

    if (!kept.length) {
      // First meaningful line must be the diagram header.
      kept.push(DIAGRAM_HEADER.test(line) ? line : 'graph TD');
      if (DIAGRAM_HEADER.test(line)) continue;
    }

    if (STRUCTURAL.test(line) || NODE_DECL.test(line)) {
      if (/--+>|==+>|-\.-+>/.test(line)) sawEdge = true;
      kept.push('  ' + escapeLabelAngles(line));
    }
    // Anything else is the model improvising — drop it.
  }

  // A header with no edges is not a diagram worth showing.
  return sawEdge ? kept.join('\n') : '';
}

/** Sentinel for "there was never a diagram here", distinct from a render failure. */
const EMPTY = '__empty__';

export default function DiagramRenderer({ type: _type, code }: DiagramRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runIdRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!code) return;

    // StrictMode runs every effect twice in development. Tracking the newest
    // run by id — rather than cancelling on cleanup — means the second run
    // still paints; a cleanup-based flag left the container permanently empty
    // because the only run that finished had already been marked cancelled.
    const myRun = ++runIdRef.current;
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;

    const renderDiagram = async () => {
      try {
        const cleanCode = sanitizeMermaid(code);
        if (!cleanCode) {
          // Nothing structural survived — the model produced prose, not a
          // diagram. Showing that raw is worse than showing nothing.
          setError(EMPTY);
          return;
        }
        const { svg } = await queueRender(id, cleanCode);
        // A newer run has superseded this one — let it paint instead.
        if (runIdRef.current !== myRun || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        setError(null);
      } catch (err) {
        if (runIdRef.current !== myRun) return;
        console.error('[diagram] mermaid render failed:', err, '\ncode:', JSON.stringify(code));
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        // mermaid leaves a scratch node attached to <body> when a render is
        // aborted. The SVG it hands back carries this same id, so only sweep up
        // strays that are still sitting on <body> — removing by id alone would
        // delete the diagram we just painted into our own container.
        for (const stray of [document.getElementById(id), document.getElementById(`d${id}`)]) {
          if (stray?.parentElement === document.body) stray.remove();
        }
      }
    };

    renderDiagram();
  }, [code]);

  if (error === EMPTY) return null;

  return (
    <div className="space-y-2">
      {/* The raw-code fallback and the render target must BOTH stay mounted:
          if the container unmounts on error, the effect's containerRef guard
          returns early forever and the diagram can never recover. */}
      {error && (
        <div className="space-y-2">
          <p className="text-xs text-warning">Diagram render failed — showing raw code:</p>
          <pre className="overflow-x-auto rounded-lg bg-bg-800 p-4 text-xs text-text-muted">
            <code>{code.replace(/\\n/g, '\n')}</code>
          </pre>
        </div>
      )}

      {/* Zoom controls */}
      <div className={error ? 'hidden' : 'flex items-center gap-2'}>
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

      {/* Scrollable diagram container — hidden, never unmounted, on error */}
      <div
        className={`overflow-auto rounded-lg bg-bg-800/50 p-4 ${error ? 'hidden' : ''}`}
        style={{ maxHeight: '500px' }}
      >
        <div
          ref={containerRef}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          className="transition-transform duration-200 [&_svg]:max-w-full"
        />
      </div>
    </div>
  );
}
