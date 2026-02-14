'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

interface GraphNode {
  id: string;
  x: number;
  y: number;
  value?: string | number;
  owner?: string;
  color?: string;
  radius?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  directed?: boolean;
  weight?: number;
  color?: string;
}

interface GraphRendererProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (nodeId: string) => void;
  onEdgeClick?: (sourceId: string, targetId: string) => void;
  width?: number;
  height?: number;
  ownerColors?: Record<string, string>;
}

const DEFAULT_OWNER_COLORS: Record<string, string> = {
  player1: '#14b8a6',
  player2: '#ff6b6b',
  player3: '#ffb74d',
  player4: '#a78bfa',
  neutral: '#555555',
};

export default function GraphRenderer({
  nodes,
  edges,
  onNodeClick,
  onEdgeClick,
  width = 600,
  height = 400,
  ownerColors = {},
}: GraphRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{
    source: string;
    target: string;
  } | null>(null);

  const colors = { ...DEFAULT_OWNER_COLORS, ...ownerColors };
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const getNodeColor = useCallback(
    (node: GraphNode): string => {
      if (node.color) return node.color;
      if (node.owner && colors[node.owner]) return colors[node.owner];
      return '#666666';
    },
    [colors],
  );

  const nodeMap = useCallback(() => {
    const map = new Map<string, GraphNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const nMap = nodeMap();

    // Draw edges
    for (const edge of edges) {
      const src = nMap.get(edge.source);
      const tgt = nMap.get(edge.target);
      if (!src || !tgt) continue;

      const isHovered =
        hoveredEdge && hoveredEdge.source === edge.source && hoveredEdge.target === edge.target;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = isHovered ? '#00ffe5' : edge.color || 'rgba(255,255,255,0.15)';
      ctx.lineWidth = isHovered ? 3 : 1.5;
      ctx.stroke();

      // Arrow for directed edges
      if (edge.directed) {
        const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
        const tgtRadius = tgt.radius || 20;
        const arrowX = tgt.x - Math.cos(angle) * tgtRadius;
        const arrowY = tgt.y - Math.sin(angle) * tgtRadius;
        const arrowLen = 10;

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLen * Math.cos(angle - Math.PI / 6),
          arrowY - arrowLen * Math.sin(angle - Math.PI / 6),
        );
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLen * Math.cos(angle + Math.PI / 6),
          arrowY - arrowLen * Math.sin(angle + Math.PI / 6),
        );
        ctx.strokeStyle = isHovered ? '#00ffe5' : edge.color || 'rgba(255,255,255,0.15)';
        ctx.lineWidth = isHovered ? 3 : 1.5;
        ctx.stroke();
      }

      // Weight label
      if (edge.weight != null) {
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;
        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(edge.weight), mx, my - 8);
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const r = node.radius || 20;
      const isHovered2 = hoveredNode === node.id;
      const fill = getNodeColor(node);

      // Glow for hovered
      if (isHovered2) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = fill + '33';
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isHovered2 ? fill : fill + 'cc';
      ctx.fill();
      ctx.strokeStyle = isHovered2 ? '#00ffe5' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = isHovered2 ? 2 : 1;
      ctx.stroke();

      // Value label
      if (node.value != null) {
        ctx.font = `bold ${Math.max(10, r * 0.7)}px monospace`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(node.value), node.x, node.y);
      }
    }
  }, [nodes, edges, width, height, hoveredNode, hoveredEdge, dpr, getNodeColor, nodeMap]);

  // Mouse interaction
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Check nodes
      let foundNode: string | null = null;
      for (const node of nodes) {
        const r = node.radius || 20;
        const dx = mx - node.x;
        const dy = my - node.y;
        if (dx * dx + dy * dy <= r * r) {
          foundNode = node.id;
          break;
        }
      }
      setHoveredNode(foundNode);

      // Check edges (proximity to line)
      if (!foundNode) {
        const nMap = nodeMap();
        let foundEdge: { source: string; target: string } | null = null;
        for (const edge of edges) {
          const src = nMap.get(edge.source);
          const tgt = nMap.get(edge.target);
          if (!src || !tgt) continue;

          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq === 0) continue;
          const t = Math.max(0, Math.min(1, ((mx - src.x) * dx + (my - src.y) * dy) / lenSq));
          const px = src.x + t * dx;
          const py = src.y + t * dy;
          const dist = Math.sqrt((mx - px) * (mx - px) + (my - py) * (my - py));
          if (dist < 8) {
            foundEdge = { source: edge.source, target: edge.target };
            break;
          }
        }
        setHoveredEdge(foundEdge);
      } else {
        setHoveredEdge(null);
      }
    },
    [nodes, edges, nodeMap],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Check node click
      for (const node of nodes) {
        const r = node.radius || 20;
        const dx = mx - node.x;
        const dy = my - node.y;
        if (dx * dx + dy * dy <= r * r) {
          onNodeClick?.(node.id);
          return;
        }
      }

      // Check edge click
      if (onEdgeClick) {
        const nMap = nodeMap();
        for (const edge of edges) {
          const src = nMap.get(edge.source);
          const tgt = nMap.get(edge.target);
          if (!src || !tgt) continue;
          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq === 0) continue;
          const t = Math.max(0, Math.min(1, ((mx - src.x) * dx + (my - src.y) * dy) / lenSq));
          const px = src.x + t * dx;
          const py = src.y + t * dy;
          const dist = Math.sqrt((mx - px) * (mx - px) + (my - py) * (my - py));
          if (dist < 8) {
            onEdgeClick(edge.source, edge.target);
            return;
          }
        }
      }
    },
    [nodes, edges, onNodeClick, onEdgeClick, nodeMap],
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="glass-card p-2 overflow-hidden rounded-xl border border-white/10">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{ width, height }}
          className="bg-surface-dark rounded-lg cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            setHoveredNode(null);
            setHoveredEdge(null);
          }}
          onClick={handleClick}
        />
      </div>

      {/* Legend for owners */}
      {nodes.some((n) => n.owner) && (
        <div className="flex items-center gap-4 flex-wrap">
          {Object.entries(colors).map(([owner, color]) => {
            const hasOwner = nodes.some((n) => n.owner === owner);
            if (!hasOwner) return null;
            return (
              <div key={owner} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-white/50 font-mono">{owner}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
