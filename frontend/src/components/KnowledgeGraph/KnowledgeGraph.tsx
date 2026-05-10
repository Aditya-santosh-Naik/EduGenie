import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/db';
import { useSessionStore } from '../../store/sessionStore';

export default function KnowledgeGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const setTopic = useSessionStore((s) => s.setTopic);

  const nodes = useLiveQuery(() => db.graphNodes.toArray()) || [];
  const edges = useLiveQuery(() => db.graphEdges.toArray()) || [];

  useEffect(() => {
    if (!nodes.length || !svgRef.current || !wrapperRef.current) return;

    const width = wrapperRef.current.clientWidth;
    const height = 400;

    // Clear previous SVG contents
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .call(d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 4])
        .on('zoom', (e) => {
          g.attr('transform', e.transform);
        })
      );

    const g = svg.append('g');

    // Clone data for D3 mutation
    const simNodes = nodes.map(d => ({ ...d }));
    const simLinks = edges.map(d => ({ ...d }));

    const simulation = d3.forceSimulation(simNodes as any)
      .force('link', d3.forceLink(simLinks).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d: any) => Math.min(30, 10 + d.masteryScore / 10)));

    // Draw edges
    const link = g.append('g')
      .selectAll('line')
      .data(simLinks)
      .join('line')
      .attr('stroke', '#374151') // Tailwind gray-700
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2);

    // Draw nodes
    const node = g.append('g')
      .selectAll('circle')
      .data(simNodes)
      .join('circle')
      .attr('r', (d: any) => Math.min(25, 12 + d.masteryScore / 10))
      .attr('fill', (d: any) => {
        if (d.masteryScore === 0) return '#4B5563'; // Grey (not studied)
        if (d.masteryScore < 50) return '#F59E0B';  // Amber (learning)
        return '#10B981';                           // Green (mastered)
      })
      .attr('stroke', '#1F2937')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(drag(simulation) as any)
      .on('click', (_event, d: any) => {
        setTopic(d.topic);
        navigate('/learn');
      });

    // Add labels
    const label = g.append('g')
      .selectAll('text')
      .data(simNodes)
      .join('text')
      .text((d: any) => d.topic)
      .attr('font-size', '10px')
      .attr('fill', '#D1D5DB')
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => Math.min(25, 12 + d.masteryScore / 10) + 12)
      .style('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, navigate, setTopic]);

  // Drag utility function
  function drag(simulation: any) {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    
    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }

  if (!nodes.length) {
    return (
      <div className="glass-card p-12 text-center text-text-muted mt-6">
        <p>Your Knowledge Graph is empty.</p>
        <p className="text-sm mt-2">Start learning topics to build your brain!</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 mt-6 w-full overflow-hidden" ref={wrapperRef}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-accent-400">Knowledge Graph</h3>
        <div className="flex gap-4 text-xs font-medium">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-gray-500"></div> Upcoming</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Learning</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Mastered</div>
        </div>
      </div>
      <div className="bg-bg-900/50 rounded-xl border border-white/5 overflow-hidden">
        <svg ref={svgRef} className="w-full h-[400px]" />
      </div>
    </div>
  );
}
