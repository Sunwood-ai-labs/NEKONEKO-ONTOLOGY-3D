import { Columns3, Maximize2, Minus, Move, Orbit, Pause, Play, Plus, RotateCw, Share2, Triangle } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CameraState,
  CrossHubEdge,
  GraphLayoutMode,
  KnowledgeHub,
  OntologyClassDef,
  OntologyClassId,
  ProjectedNode,
  SemanticFactEdge,
} from '../types/knowledge';
import {
  buildSpatialKnowledgeGraph,
  getConeRingPoints,
  getConnectedHubIds,
  getShortestPathEdgeIds,
  projectNode3D,
} from '../utils/graphLayout';
import type { ThemePalette } from '../utils/themePalettes';

interface SpatialGraphCanvasProps {
  hubs: KnowledgeHub[];
  classes: OntologyClassDef[];
  crossEdges: CrossHubEdge[];
  semanticEdges?: SemanticFactEdge[];
  palette: ThemePalette;
  selectedHubId: string | null;
  selectedFactId: string | null;
  selectedNodeId: string | null;
  activeClassFilter: OntologyClassId | 'all';
  onChangeClassFilter: (cls: OntologyClassId | 'all') => void;
  onSelectHub: (hubId: string | null, factId?: string | null, nodeId?: string | null) => void;
}

function blendWithBg(
  hex: string,
  alpha: number,
  bgRgb: readonly [number, number, number]
): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const nr = Math.round(bgRgb[0] + (r - bgRgb[0]) * alpha);
  const ng = Math.round(bgRgb[1] + (g - bgRgb[1]) * alpha);
  const nb = Math.round(bgRgb[2] + (b - bgRgb[2]) * alpha);
  return `rgb(${nr}, ${ng}, ${nb})`;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const SpatialGraphCanvas: React.FC<SpatialGraphCanvasProps> = ({
  hubs,
  classes,
  crossEdges,
  semanticEdges = [],
  palette,
  selectedHubId,
  selectedFactId,
  selectedNodeId,
  activeClassFilter,
  onChangeClassFilter,
  onSelectHub,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hubButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>('radial');
  const [showConeGuides, setShowConeGuides] = useState<boolean>(true);
  const [showAllCrossLinks, setShowAllCrossLinks] = useState<boolean>(true);
  const [dragMode, setDragMode] = useState<'rotate' | 'pan'>('rotate');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  const graph = useMemo(
    () => buildSpatialKnowledgeGraph(hubs, classes, crossEdges, palette, layoutMode, semanticEdges),
    [hubs, classes, crossEdges, palette, layoutMode, semanticEdges]
  );

  const semanticNeighborNodeIds = useMemo(() => {
    const neighbors = new Set<string>();
    const rawFocusIds = [selectedNodeId, hoveredNodeId].filter((v): v is string => Boolean(v));
    if (rawFocusIds.length === 0) return neighbors;
    const focusIds = rawFocusIds.flatMap((id) =>
      id.endsWith('::ev') ? [id, id.slice(0, -4)] : [id]
    );
    for (const edge of graph.edges) {
      if (edge.kind !== 'semantic') continue;
      for (const focusId of focusIds) {
        if (edge.sourceId === focusId) neighbors.add(edge.targetId);
        if (edge.targetId === focusId) neighbors.add(edge.sourceId);
      }
    }
    return neighbors;
  }, [graph.edges, hoveredNodeId, selectedNodeId]);

  const connectedHubIds = useMemo(
    () => (selectedHubId ? getConnectedHubIds(selectedHubId, crossEdges) : null),
    [selectedHubId, crossEdges]
  );

  const rootPathEdgeIds = useMemo(
    () =>
      selectedHubId && selectedHubId !== 'hub-core'
        ? getShortestPathEdgeIds('hub-core', selectedHubId, crossEdges)
        : null,
    [selectedHubId, crossEdges]
  );

  const getOverviewDistance = (mode: GraphLayoutMode = layoutMode) => {
    const narrow = typeof window !== 'undefined' && window.innerWidth < 768;
    if (mode === 'ontology-x') return narrow ? 2280 : 1960;
    return narrow ? 1620 : 1180;
  };

  const initialCamera: CameraState = {
    x: 0,
    y: 0,
    z: 20,
    distance: getOverviewDistance('radial'),
    yaw: 0.12,
    pitch: -0.05,
    panOffsetX: 0,
  };

  const currentCamRef = useRef<CameraState>({ ...initialCamera });
  const targetCamRef = useRef<CameraState>({ ...initialCamera });
  const animatedPosRef = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());
  const projectedRef = useRef<ProjectedNode[]>([]);
  const rafRef = useRef<number | null>(null);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const layoutModeRef = useRef<GraphLayoutMode>(layoutMode);
  const prevSelectedHubIdRef = useRef<string | null>(selectedHubId);
  const prevLayoutModeRef = useRef<GraphLayoutMode>(layoutMode);
  const logoCacheRef = useRef<
    Map<string, { img: HTMLImageElement; status: 'loading' | 'loaded' | 'error' }>
  >(new Map());
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    orbit: boolean;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    orbit: false,
  });

  autoRotateRef.current = autoRotate;
  layoutModeRef.current = layoutMode;

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = palette.bgHex;
    ctx.fillRect(0, 0, width, height);

    const cam = currentCamRef.current;
    const projectedMap = new Map<string, ProjectedNode>();
    const projectedList: ProjectedNode[] = [];
    const animMap = animatedPosRef.current;

    for (const node of graph.nodes) {
      let curPos = animMap.get(node.id);
      if (!curPos) {
        curPos = { x: node.x, y: node.y, z: node.z };
        animMap.set(node.id, curPos);
      }
      const p = projectNode3D(
        { ...node, x: curPos.x, y: curPos.y, z: curPos.z },
        cam,
        width,
        height
      );
      if (p) {
        projectedMap.set(node.id, p);
        projectedList.push(p);
      }
    }
    projectedRef.current = projectedList;

    // 0. Draw 3D Circular Cone Rays & X-Aligned Ontology Circular Cross-Sections
    if (layoutMode === 'ontology-x' && graph.ontologyColumns.length > 0) {
      const coreNode = graph.nodeMap.get('hub-core');
      const baseCol = graph.ontologyColumns[graph.ontologyColumns.length - 1];
      const apexWorld = coreNode ?? {
        id: 'apex-ref',
        kind: 'aux' as const,
        hubId: 'hub-core',
        label: '',
        x: -960,
        y: 0,
        z: 0,
        radius: 1,
        color: palette.accentHex,
      };
      const apexP = projectNode3D(apexWorld, cam, width, height);
      const baseRaysWorld = getConeRingPoints(baseCol.x, 12);

      // Draw 12 delicate radial generator rays from hub-core apex out to the cone base circle
      if (showConeGuides && apexP) {
        ctx.save();
        baseRaysWorld.forEach((bv, vIdx) => {
          const bp = projectNode3D(
            {
              id: `cone-ray-${vIdx}`,
              kind: 'aux',
              hubId: 'hub-core',
              label: '',
              x: bv.x,
              y: bv.y,
              z: bv.z,
              radius: 1,
              color: palette.accentHex,
            },
            cam,
            width,
            height
          );
          if (!bp) return;
          ctx.beginPath();
          ctx.moveTo(apexP.screenX, apexP.screenY);
          ctx.lineTo(bp.screenX, bp.screenY);
          ctx.strokeStyle = `rgba(${palette.intraEdgeRgb.join(', ')}, ${
            palette.isDark ? 0.24 : 0.13
          })`;
          ctx.lineWidth = vIdx % 3 === 0 ? 1.05 : 0.75;
          ctx.setLineDash([4, 5]);
          ctx.stroke();
        });
        ctx.restore();
      }

      // Draw each Ontology X-Plane Circular Cross-Section + 3-Tier Staggered Top Header Pill
      graph.ontologyColumns.forEach((col, colIdx) => {
        const ringWorld = getConeRingPoints(col.x, 40);
        const ringP: ProjectedNode[] = [];
        for (let i = 0; i < ringWorld.length; i++) {
          const v = ringWorld[i];
          const rp = projectNode3D(
            {
              id: `slice-${col.classId}-${i}`,
              kind: 'aux',
              hubId: 'hub-core',
              label: col.labelJa,
              x: v.x,
              y: v.y,
              z: v.z,
              radius: 1,
              color: col.color,
            },
            cam,
            width,
            height
          );
          if (rp) ringP.push(rp);
        }
        if (ringP.length < 12) return;

        const isActiveCol = activeClassFilter === 'all' || activeClassFilter === col.classId;
        const isHighlightedCol = activeClassFilter === col.classId;
        const ringAlpha = isHighlightedCol
          ? palette.isDark
            ? 0.65
            : 0.52
          : isActiveCol
          ? palette.isDark
            ? 0.26
            : 0.15
          : 0.06;

        ctx.save();
        if (showConeGuides) {
          ctx.beginPath();
          ringP.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.screenX, pt.screenY);
            else ctx.lineTo(pt.screenX, pt.screenY);
          });
          ctx.closePath();
          if (isHighlightedCol) {
            ctx.fillStyle = hexToRgba(col.color, palette.isDark ? 0.08 : 0.05);
            ctx.fill();
          }
          ctx.strokeStyle = isHighlightedCol
            ? hexToRgba(col.color, ringAlpha)
            : `rgba(${palette.intraEdgeRgb.join(', ')}, ${ringAlpha})`;
          ctx.lineWidth = isHighlightedCol ? 1.6 : 0.95;
          ctx.stroke();
        }

        // Anchor pill above the visually highest point of this circular slice (3-tier staggered to avoid collisions)
        let topPt = ringP[0];
        for (const pt of ringP) {
          if (pt.screenY < topPt.screenY) topPt = pt;
        }
        const tierOffsetScreenY = -12 - (colIdx % 3) * 30;
        const pillBottomY = Math.max(30, topPt.screenY + tierOffsetScreenY);
        ctx.font = '600 10.5px "Noto Sans JP", sans-serif';
        const textW = ctx.measureText(col.labelJa).width;
        const pillW = textW + 22;
        const pillH = 22;
        const px = topPt.screenX - pillW / 2;
        const py = pillBottomY - pillH;

        if (showConeGuides) {
          ctx.beginPath();
          ctx.moveTo(topPt.screenX, topPt.screenY);
          ctx.lineTo(topPt.screenX, py + pillH);
          ctx.strokeStyle = `rgba(${palette.intraEdgeRgb.join(', ')}, ${isActiveCol ? 0.38 : 0.12})`;
          ctx.lineWidth = 0.9;
          ctx.setLineDash([2, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.globalAlpha = isActiveCol ? 0.96 : 0.42;
        ctx.fillStyle = palette.tooltipBg;
        ctx.strokeStyle = isHighlightedCol ? col.color : palette.borderHex;
        ctx.lineWidth = isHighlightedCol ? 1.5 : 1;
        ctx.beginPath();
        ctx.roundRect(px, py, pillW, pillH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px + 10, py + pillH / 2, 3.6, 0, Math.PI * 2);
        ctx.fillStyle = col.color;
        ctx.fill();
        if (!palette.isDark) {
          ctx.strokeStyle = 'rgba(26, 31, 74, 0.25)';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        ctx.fillStyle = palette.textHex;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(col.labelJa, px + 17, py + pillH / 2 + 0.5);
        ctx.restore();
      });
    }

    const getFocusMultiplier = (hubId: string, classId?: OntologyClassId): number => {
      let mult = 1;
      if (selectedHubId) {
        if (hubId === selectedHubId) mult *= 1;
        else if (connectedHubIds?.has(hubId)) mult *= 0.62;
        else mult *= 0.16;
      }
      if (activeClassFilter !== 'all' && classId && classId !== activeClassFilter) {
        mult *= 0.16;
      }
      return mult;
    };

    // 1. Draw Cross-Hub Semantic Arcs
    for (const edge of graph.edges) {
      if (edge.kind !== 'cross') continue;
      const src = projectedMap.get(edge.sourceId);
      const tgt = projectedMap.get(edge.targetId);
      if (!src || !tgt) continue;

      const isRelevant =
        selectedHubId === edge.sourceId ||
        selectedHubId === edge.targetId ||
        hoveredNodeId === edge.sourceId ||
        hoveredNodeId === edge.targetId;
      const isRootPathEdge = rootPathEdgeIds?.has(edge.id) ?? false;
      const isRootBackbone = edge.sourceId === 'hub-core' || edge.targetId === 'hub-core';

      if (!showAllCrossLinks && !isRelevant && !isRootPathEdge) continue;

      const avgAlpha = Math.min(src.depthAlpha, tgt.depthAlpha);
      const darkEdgeBoost = palette.isDark ? 1.38 : 1;
      const strokeAlpha = isRelevant
        ? Math.min(0.92, 0.72 * avgAlpha * darkEdgeBoost)
        : isRootPathEdge
        ? Math.min(0.85, 0.56 * avgAlpha * darkEdgeBoost)
        : selectedHubId
        ? 0.14 * avgAlpha * darkEdgeBoost
        : isRootBackbone
        ? Math.min(0.5, 0.28 * avgAlpha * darkEdgeBoost)
        : Math.min(0.38, 0.18 * avgAlpha * darkEdgeBoost);

      const midX = (src.screenX + tgt.screenX) * 0.5;
      const midY = (src.screenY + tgt.screenY) * 0.5;
      const dx = tgt.screenX - src.screenX;
      const dy = tgt.screenY - src.screenY;
      // In ontology-x cone mode, draw crisp straight geometric beams from core & between hubs so edges never sag/bend below the cone
      const useStraightEdge = layoutMode === 'ontology-x';
      const ctrlX = useStraightEdge ? midX : midX - dy * 0.14;
      const ctrlY = useStraightEdge ? midY : midY + dx * 0.14;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(src.screenX, src.screenY);
      if (useStraightEdge) {
        ctx.lineTo(tgt.screenX, tgt.screenY);
      } else {
        ctx.quadraticCurveTo(ctrlX, ctrlY, tgt.screenX, tgt.screenY);
      }
      if (isRelevant) {
        ctx.strokeStyle = `rgba(${palette.relevantEdgeRgb.join(', ')}, ${strokeAlpha})`;
        ctx.lineWidth = 1.65;
        ctx.setLineDash([]);
      } else if (isRootPathEdge) {
        ctx.strokeStyle = `rgba(${palette.rootPathEdgeRgb.join(', ')}, ${strokeAlpha})`;
        ctx.lineWidth = 1.45;
        ctx.setLineDash([5, 3]);
      } else if (isRootBackbone && !selectedHubId) {
        ctx.strokeStyle = `rgba(${palette.crossEdgeRgb.join(', ')}, ${strokeAlpha})`;
        ctx.lineWidth = 1.1;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = `rgba(${palette.crossEdgeRgb.join(', ')}, ${strokeAlpha})`;
        ctx.lineWidth = 0.9;
        ctx.setLineDash([4, 4]);
      }
      ctx.stroke();

      if ((isRelevant || isRootPathEdge) && edge.label) {
        const labelX = 0.25 * src.screenX + 0.5 * ctrlX + 0.25 * tgt.screenX;
        const labelY = 0.25 * src.screenY + 0.5 * ctrlY + 0.25 * tgt.screenY;
        ctx.font = '500 10px "Noto Sans JP", sans-serif';
        const textW = ctx.measureText(edge.label).width;
        const boxW = textW + 8;
        const boxX = Math.max(8, Math.min(width - boxW - 8, labelX - boxW / 2));
        ctx.fillStyle = palette.isDark ? 'rgba(26, 31, 74, 0.9)' : 'rgba(255, 255, 255, 0.92)';
        ctx.fillRect(boxX, labelY - 7, boxW, 14);
        ctx.fillStyle = isRelevant ? palette.textHex : palette.rootPathLabelHex;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(edge.label, boxX + boxW / 2, labelY);
      }
      ctx.restore();
    }

    // 2. Draw Intra-Hub Starburst Edges
    for (const edge of graph.edges) {
      if (edge.kind !== 'intra') continue;
      const src = projectedMap.get(edge.sourceId);
      const tgt = projectedMap.get(edge.targetId);
      if (!src || !tgt) continue;

      const focusMult = getFocusMultiplier(edge.hubId, edge.classId);
      const avgAlpha = Math.min(src.depthAlpha, tgt.depthAlpha) * focusMult;
      if (avgAlpha < 0.03) continue;

      const touchesSelectedLeaf =
        selectedNodeId && (edge.sourceId === selectedNodeId || edge.targetId === selectedNodeId);
      const touchesHoveredLeaf =
        hoveredNodeId && (edge.sourceId === hoveredNodeId || edge.targetId === hoveredNodeId);

      ctx.beginPath();
      ctx.moveTo(src.screenX, src.screenY);
      ctx.lineTo(tgt.screenX, tgt.screenY);
      if (touchesSelectedLeaf || touchesHoveredLeaf) {
        ctx.strokeStyle = `rgba(${palette.relevantEdgeRgb.join(', ')}, 0.88)`;
        ctx.lineWidth = 1.65;
      } else {
        ctx.strokeStyle = `rgba(${palette.intraEdgeRgb.join(', ')}, ${
          palette.isDark ? Math.min(0.64, avgAlpha * 0.56) : Math.min(0.45, avgAlpha * 0.42)
        })`;
        ctx.lineWidth = Math.max(0.55, 0.95 * Math.min(src.scale, tgt.scale));
      }
      ctx.stroke();
    }

    // 2.5. Draw Node-to-Node Semantic Fact Links (Cross-Hub & Cross-Class)
    const matchesFocusNode = (edgeNodeId: string, focusId: string | null) =>
      Boolean(
        focusId &&
          (edgeNodeId === focusId ||
            (focusId.endsWith('::ev') && edgeNodeId === focusId.slice(0, -4)))
      );

    for (const edge of graph.edges) {
      if (edge.kind !== 'semantic') continue;
      const src = projectedMap.get(edge.sourceId);
      const tgt = projectedMap.get(edge.targetId);
      if (!src || !tgt) continue;

      const isNodeFocused =
        matchesFocusNode(edge.sourceId, selectedNodeId) ||
        matchesFocusNode(edge.targetId, selectedNodeId) ||
        matchesFocusNode(edge.sourceId, hoveredNodeId) ||
        matchesFocusNode(edge.targetId, hoveredNodeId);
      const isHubFocused = Boolean(
        selectedHubId && (edge.hubId === selectedHubId || edge.targetHubId === selectedHubId)
      );
      const matchesClass =
        activeClassFilter === 'all' ||
        edge.classId === activeClassFilter ||
        edge.targetClassId === activeClassFilter;

      if (!showAllCrossLinks && !isNodeFocused && !isHubFocused) continue;
      if (!matchesClass && !isNodeFocused) continue;

      const avgAlpha = Math.min(src.depthAlpha, tgt.depthAlpha);
      const darkBoost = palette.isDark ? 1.35 : 1;
      const strokeAlpha = isNodeFocused
        ? Math.min(0.96, 0.86 * Math.max(0.55, avgAlpha) * darkBoost)
        : isHubFocused
        ? Math.min(0.76, 0.44 * avgAlpha * darkBoost)
        : Math.min(0.32, (palette.isDark ? 0.24 : 0.13) * avgAlpha);

      const midX = (src.screenX + tgt.screenX) * 0.5;
      const midY = (src.screenY + tgt.screenY) * 0.5;
      const dx = tgt.screenX - src.screenX;
      const dy = tgt.screenY - src.screenY;
      const useStraightEdge = layoutMode === 'ontology-x';
      const ctrlX = useStraightEdge ? midX : midX - dy * 0.09;
      const ctrlY = useStraightEdge ? midY : midY + dx * 0.09;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(src.screenX, src.screenY);
      if (useStraightEdge) {
        ctx.lineTo(tgt.screenX, tgt.screenY);
      } else {
        ctx.quadraticCurveTo(ctrlX, ctrlY, tgt.screenX, tgt.screenY);
      }

      if (isNodeFocused) {
        ctx.strokeStyle = `rgba(${palette.relevantEdgeRgb.join(', ')}, ${strokeAlpha})`;
        ctx.lineWidth = 1.75;
        ctx.setLineDash([]);
      } else if (isHubFocused) {
        ctx.strokeStyle = `rgba(${palette.rootPathEdgeRgb.join(', ')}, ${strokeAlpha})`;
        ctx.lineWidth = 1.15;
        ctx.setLineDash([4, 3]);
      } else {
        ctx.strokeStyle = `rgba(${palette.crossEdgeRgb.join(', ')}, ${strokeAlpha})`;
        ctx.lineWidth = 0.85;
        ctx.setLineDash([2, 4]);
      }
      ctx.stroke();

      if (isNodeFocused && edge.label) {
        const labelX = 0.25 * src.screenX + 0.5 * ctrlX + 0.25 * tgt.screenX;
        const labelY = 0.25 * src.screenY + 0.5 * ctrlY + 0.25 * tgt.screenY;
        ctx.font = '600 10px "Noto Sans JP", sans-serif';
        const textW = ctx.measureText(edge.label).width;
        const boxW = textW + 10;
        const boxX = Math.max(8, Math.min(width - boxW - 8, labelX - boxW / 2));
        ctx.fillStyle = palette.tooltipBg;
        ctx.strokeStyle = palette.tooltipBorder;
        ctx.lineWidth = 0.9;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.roundRect(boxX, labelY - 8, boxW, 16, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = palette.textHex;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(edge.label, boxX + boxW / 2, labelY + 0.5);
      }
      ctx.restore();
    }

    // 3. Draw Depth-Sorted Nodes (Far to Near)
    const sorted = [...projectedList].sort((a, b) => b.depth - a.depth);
    for (const p of sorted) {
      const { node, screenX, screenY, projectedRadius, depthAlpha } = p;
      const isSemanticNeighbor = semanticNeighborNodeIds.has(node.id);
      const focusMult = getFocusMultiplier(node.hubId, node.classId);
      const baseAlpha = Math.max(0.08, depthAlpha * focusMult);
      const rawFinalAlpha = palette.isDark
        ? focusMult < 0.5
          ? Math.max(0.24, Math.pow(baseAlpha, 0.72))
          : Math.max(0.62, Math.pow(baseAlpha, 0.56))
        : baseAlpha;
      const finalAlpha = isSemanticNeighbor
        ? Math.max(rawFinalAlpha, palette.isDark ? 0.92 : 0.84)
        : rawFinalAlpha;
      const isHovered = hoveredNodeId === node.id;
      const isSelectedHub = node.kind === 'hub' && node.hubId === selectedHubId;
      const isSelectedNode = selectedNodeId === node.id;
      const isSelectedFact =
        isSelectedNode || (node.kind === 'fact' && node.factId && node.factId === selectedFactId);

      if (node.kind === 'hub') {
        const isSunCore = node.id === 'hub-core';
        const effectiveAlpha = isSunCore
          ? Math.max(finalAlpha, selectedHubId && selectedHubId !== 'hub-core' ? 0.36 : 0.88)
          : finalAlpha;
        const r = Math.max(
          isSunCore ? 12 : 5,
          projectedRadius * (isSelectedHub || isHovered ? 1.14 : 1)
        );

        let readyLogoImg: HTMLImageElement | null = null;
        if (node.logoUrl) {
          let cached = logoCacheRef.current.get(node.logoUrl);
          if (!cached && typeof Image !== 'undefined') {
            const img = new Image();
            const entry: { img: HTMLImageElement; status: 'loading' | 'loaded' | 'error' } = {
              img,
              status: 'loading',
            };
            logoCacheRef.current.set(node.logoUrl, entry);
            img.onload = () => {
              entry.status = 'loaded';
              drawSceneRef.current();
            };
            img.onerror = () => {
              entry.status = 'error';
            };
            img.src = node.logoUrl;
            cached = entry;
          }
          if (cached?.status === 'loaded' && cached.img.naturalWidth > 0) {
            readyLogoImg = cached.img;
          }
        }

        if (isSunCore) {
          // Soft solar corona atmosphere
          const coronaRadius = r * 2.55;
          const coronaGrad = ctx.createRadialGradient(
            screenX,
            screenY,
            r * 0.65,
            screenX,
            screenY,
            coronaRadius
          );
          coronaGrad.addColorStop(
            0,
            `rgba(${palette.sunCoronaRgb.join(', ')}, ${0.3 * effectiveAlpha})`
          );
          coronaGrad.addColorStop(
            0.42,
            `rgba(${palette.sunRayRgb.join(', ')}, ${0.15 * effectiveAlpha})`
          );
          coronaGrad.addColorStop(
            0.75,
            `rgba(${palette.crossEdgeRgb.join(', ')}, ${0.05 * effectiveAlpha})`
          );
          coronaGrad.addColorStop(1, `rgba(${palette.bgRgb.join(', ')}, 0)`);
          ctx.beginPath();
          ctx.arc(screenX, screenY, coronaRadius, 0, Math.PI * 2);
          ctx.fillStyle = coronaGrad;
          ctx.fill();

          // Concentric solar orbital & corona rings
          ctx.save();
          ctx.beginPath();
          ctx.arc(screenX, screenY, r * 1.44, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${palette.sunRayRgb.join(', ')}, ${0.48 * effectiveAlpha})`;
          ctx.lineWidth = 1.1;
          ctx.setLineDash([3, 3]);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(screenX, screenY, r * 1.88, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${palette.crossEdgeRgb.join(', ')}, ${0.18 * effectiveAlpha})`;
          ctx.lineWidth = 0.85;
          ctx.setLineDash([]);
          ctx.stroke();

          // 12 delicate radial solar rays around the core rim
          const rayCount = 12;
          for (let i = 0; i < rayCount; i++) {
            const rayAngle = (i / rayCount) * Math.PI * 2 + cam.yaw * 0.35;
            const innerR = r * 1.12;
            const outerR = r * (i % 2 === 0 ? 1.36 : 1.24);
            ctx.beginPath();
            ctx.moveTo(screenX + Math.cos(rayAngle) * innerR, screenY + Math.sin(rayAngle) * innerR);
            ctx.lineTo(screenX + Math.cos(rayAngle) * outerR, screenY + Math.sin(rayAngle) * outerR);
            ctx.strokeStyle =
              i % 2 === 0
                ? `rgba(${palette.sunCoronaRgb.join(', ')}, ${0.72 * effectiveAlpha})`
                : `rgba(${palette.sunRayRgb.join(', ')}, ${0.46 * effectiveAlpha})`;
            ctx.lineWidth = i % 2 === 0 ? 1.45 : 1.05;
            ctx.stroke();
          }
          ctx.restore();

          if (readyLogoImg) {
            // Luminous solar emblem medallion for high-contrast logo rendering
            const medalGrad = ctx.createRadialGradient(
              screenX - r * 0.2,
              screenY - r * 0.2,
              r * 0.08,
              screenX,
              screenY,
              r
            );
            medalGrad.addColorStop(0, blendWithBg(palette.sunCoreStops[0], effectiveAlpha, palette.bgRgb));
            medalGrad.addColorStop(0.68, blendWithBg(palette.sunCoreStops[1], effectiveAlpha, palette.bgRgb));
            medalGrad.addColorStop(1, blendWithBg(palette.sunCoreStops[2], effectiveAlpha, palette.bgRgb));
            ctx.beginPath();
            ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
            ctx.fillStyle = medalGrad;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
            ctx.strokeStyle = palette.sunRimColor;
            ctx.lineWidth = 1.9;
            ctx.stroke();

            const box = r * 1.38;
            const aspectScale = Math.min(box / readyLogoImg.naturalWidth, box / readyLogoImg.naturalHeight);
            const drawW = readyLogoImg.naturalWidth * aspectScale;
            const drawH = readyLogoImg.naturalHeight * aspectScale;

            ctx.save();
            ctx.beginPath();
            ctx.arc(screenX, screenY, r * 0.86, 0, Math.PI * 2);
            ctx.clip();
            ctx.globalAlpha = Math.min(1, effectiveAlpha * 1.05);
            ctx.drawImage(readyLogoImg, screenX - drawW / 2, screenY - drawH / 2, drawW, drawH);
            ctx.restore();
          } else {
            const sphereGrad = ctx.createRadialGradient(
              screenX - r * 0.25,
              screenY - r * 0.25,
              r * 0.1,
              screenX,
              screenY,
              r
            );
            sphereGrad.addColorStop(0, blendWithBg(palette.accentHex, effectiveAlpha, palette.bgRgb));
            sphereGrad.addColorStop(0.72, blendWithBg(palette.hubFillHex, effectiveAlpha, palette.bgRgb));
            sphereGrad.addColorStop(1, blendWithBg(palette.coralHex, effectiveAlpha, palette.bgRgb));
            ctx.beginPath();
            ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
            ctx.fillStyle = sphereGrad;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
            ctx.strokeStyle = palette.sunRimColor;
            ctx.lineWidth = 1.7;
            ctx.stroke();
          }
        } else if (readyLogoImg) {
          ctx.beginPath();
          ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
          ctx.fillStyle = blendWithBg('#FFFFFF', finalAlpha, palette.bgRgb);
          ctx.fill();
          ctx.strokeStyle = blendWithBg(node.color, finalAlpha, palette.bgRgb);
          ctx.lineWidth = 1.4;
          ctx.stroke();

          const box = r * 1.35;
          const aspectScale = Math.min(box / readyLogoImg.naturalWidth, box / readyLogoImg.naturalHeight);
          const drawW = readyLogoImg.naturalWidth * aspectScale;
          const drawH = readyLogoImg.naturalHeight * aspectScale;
          ctx.save();
          ctx.beginPath();
          ctx.arc(screenX, screenY, r * 0.85, 0, Math.PI * 2);
          ctx.clip();
          ctx.globalAlpha = finalAlpha;
          ctx.drawImage(readyLogoImg, screenX - drawW / 2, screenY - drawH / 2, drawW, drawH);
          ctx.restore();
        } else {
          if (palette.isDark && finalAlpha > 0.25) {
            const glowR = r * 1.95;
            const glowGrad = ctx.createRadialGradient(screenX, screenY, r * 0.5, screenX, screenY, glowR);
            glowGrad.addColorStop(0, hexToRgba(node.color, 0.34 * finalAlpha));
            glowGrad.addColorStop(1, hexToRgba(node.color, 0));
            ctx.beginPath();
            ctx.arc(screenX, screenY, glowR, 0, Math.PI * 2);
            ctx.fillStyle = glowGrad;
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
          ctx.fillStyle = blendWithBg(node.color, finalAlpha, palette.bgRgb);
          ctx.fill();
          if (node.strokeColor) {
            ctx.strokeStyle = blendWithBg(
              node.strokeColor,
              palette.isDark ? Math.min(1, finalAlpha * 0.82) : Math.min(1, finalAlpha * 0.68),
              palette.bgRgb
            );
            ctx.lineWidth = palette.isDark ? 1.45 : 1.25;
            ctx.stroke();
          }
        }

        if (isSelectedHub || isHovered) {
          ctx.beginPath();
          ctx.arc(screenX, screenY, r + (isSunCore ? 6 : 4), 0, Math.PI * 2);
          ctx.strokeStyle = isSunCore
            ? palette.sunRimColor
            : `rgba(${palette.relevantEdgeRgb.join(', ')}, 0.72)`;
          ctx.lineWidth = 1.75;
          ctx.stroke();
        }

        if (!readyLogoImg && r >= 9 && effectiveAlpha > 0.32) {
          ctx.fillStyle = node.monogramColor ?? palette.hubMonogramHex;
          ctx.globalAlpha = Math.min(1, effectiveAlpha * 1.1);
          ctx.font = `700 ${Math.round(Math.max(8, r * (isSunCore ? 0.56 : 0.62)))}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.monogram ?? node.sublabel?.slice(0, 3) ?? 'N', screenX, screenY + 0.5);
          ctx.globalAlpha = 1;
        }
      } else {
        const r = Math.max(
          palette.isDark ? 2.2 : 1.8,
          projectedRadius * (isHovered || isSelectedFact ? 1.55 : palette.isDark ? 1.1 : 1)
        );
        if (palette.isDark && (node.kind === 'category' || node.kind === 'fact') && finalAlpha > 0.35) {
          const leafGlowR = r * 2.1;
          const leafGlow = ctx.createRadialGradient(screenX, screenY, r * 0.3, screenX, screenY, leafGlowR);
          leafGlow.addColorStop(0, hexToRgba(node.color, (node.kind === 'category' ? 0.35 : 0.24) * finalAlpha));
          leafGlow.addColorStop(1, hexToRgba(node.color, 0));
          ctx.beginPath();
          ctx.arc(screenX, screenY, leafGlowR, 0, Math.PI * 2);
          ctx.fillStyle = leafGlow;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
        ctx.fillStyle = blendWithBg(node.color, finalAlpha, palette.bgRgb);
        ctx.fill();
        if (node.strokeColor && finalAlpha > 0.16) {
          ctx.strokeStyle = blendWithBg(
            node.strokeColor,
            palette.isDark ? Math.min(1, finalAlpha * 0.75) : Math.min(1, finalAlpha * 0.55),
            palette.bgRgb
          );
          ctx.lineWidth = node.kind === 'category' ? 1.25 : 0.9;
          ctx.stroke();
        }

        if ((isHovered || isSelectedFact || isSemanticNeighbor) && finalAlpha > 0.2) {
          ctx.beginPath();
          ctx.arc(screenX, screenY, r + (isSemanticNeighbor && !isHovered && !isSelectedFact ? 3 : 3.5), 0, Math.PI * 2);
          ctx.strokeStyle = isSelectedNode
            ? palette.isDark
              ? '#FFFFFF'
              : palette.primaryHex
            : isSemanticNeighbor && !isHovered && !isSelectedFact
            ? `rgba(${palette.rootPathEdgeRgb.join(', ')}, 0.88)`
            : node.color;
          ctx.lineWidth = isSelectedNode ? 2 : 1.5;
          ctx.stroke();
        }

        // Draw category label when focused on this hub or zoomed close (in ontology-x, top column headers already label each column)
        if (
          node.kind === 'category' &&
          (layoutMode === 'ontology-x'
            ? isHovered
            : selectedHubId === node.hubId || p.scale > 1.25 || isHovered) &&
          finalAlpha > 0.35
        ) {
          ctx.font = '500 10.5px "Noto Sans JP", sans-serif';
          ctx.fillStyle = blendWithBg(palette.textMutedHex, finalAlpha, palette.bgRgb);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.label, screenX + r + 5, screenY);
        }

        // Draw crisp tooltip pill for hovered or selected terminal leaf node
        if ((isHovered || isSelectedNode) && node.kind !== 'category') {
          const tip = node.label ? `${node.label}` : node.sublabel ?? '';
          if (tip) {
            ctx.save();
            ctx.font = '600 11px "Noto Sans JP", sans-serif';
            const subTip = isHovered && !isSelectedNode ? ' · MD' : '';
            const fullText = `${tip}${subTip}`;
            const metrics = ctx.measureText(fullText);
            const padX = 7;
            const pillW = metrics.width + padX * 2;
            const pillH = 22;
            const tx = screenX + r + 8;
            const ty = screenY - pillH / 2;
            ctx.fillStyle = isSelectedNode ? palette.primaryHex : palette.tooltipBg;
            ctx.strokeStyle = isSelectedNode ? palette.primaryHex : palette.tooltipBorder;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(tx, ty, pillW, pillH, 6);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = isSelectedNode ? palette.primaryFgHex : palette.tooltipText;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(fullText, tx + padX, screenY);
            ctx.restore();
          }
        }
      }
    }

    // 4. Sync accessible DOM Hub label buttons directly (zero React re-renders)
    const hubRingCenterP =
      layoutMode === 'ontology-x'
        ? projectNode3D(
            {
              id: 'hub-ring-center',
              kind: 'aux',
              hubId: 'hub-core',
              label: '',
              x: -240,
              y: 0,
              z: 0,
              radius: 1,
              color: palette.accentHex,
            },
            cam,
            width,
            height
          )
        : null;

    type HubDomPlacement = {
      btn: HTMLButtonElement;
      p: ProjectedNode;
      labelAlpha: number;
      offsetX: number;
      side: 'left' | 'right';
    };
    const leftSideLabels: HubDomPlacement[] = [];
    const rightSideLabels: HubDomPlacement[] = [];

    for (const hub of hubs) {
      const btn = hubButtonRefs.current.get(hub.id);
      const p = projectedMap.get(hub.id);
      if (!btn) continue;
      if (
        !p ||
        p.screenX < -120 ||
        p.screenX > width + 120 ||
        p.screenY < -60 ||
        p.screenY > height + 60
      ) {
        btn.style.opacity = '0';
        btn.style.pointerEvents = 'none';
        continue;
      }

      const focusMult = getFocusMultiplier(hub.id);
      const isSunCore = hub.id === 'hub-core';
      const labelAlpha = palette.isDark
        ? Math.max(
            isSunCore ? 0.82 : focusMult < 0.5 ? 0.28 : 0.62,
            Math.min(1, p.depthAlpha * focusMult)
          )
        : Math.max(isSunCore ? 0.5 : 0.18, Math.min(1, p.depthAlpha * focusMult));
      const offsetX = p.projectedRadius + (isSunCore ? 16 : 8);

      if (layoutMode === 'ontology-x') {
        if (isSunCore) {
          btn.style.transform = `translate3d(${Math.round(p.screenX)}px, ${Math.round(
            p.screenY + p.projectedRadius + 10
          )}px, 0) translateX(-50%)`;
          btn.style.opacity = String(labelAlpha);
          btn.style.pointerEvents = 'auto';
        } else {
          const isLeftHalf = hubRingCenterP ? p.screenX < hubRingCenterP.screenX - 4 : false;
          const entry: HubDomPlacement = {
            btn,
            p,
            labelAlpha,
            offsetX,
            side: isLeftHalf ? 'left' : 'right',
          };
          if (isLeftHalf) leftSideLabels.push(entry);
          else rightSideLabels.push(entry);
        }
      } else {
        btn.style.transform = `translate3d(${Math.round(p.screenX + offsetX)}px, ${Math.round(
          p.screenY - 12
        )}px, 0)`;
        btn.style.opacity = String(labelAlpha);
        btn.style.pointerEvents = 'auto';
      }
    }

    if (layoutMode === 'ontology-x') {
      const placeNonOverlappingColumn = (items: HubDomPlacement[], alignLeft: boolean) => {
        items.sort((a, b) => a.p.screenY - b.p.screenY);
        let lastTopY = -Infinity;
        for (const item of items) {
          const desiredTopY = item.p.screenY - 11;
          const topY = Math.max(desiredTopY, lastTopY + 26);
          lastTopY = topY;
          if (alignLeft) {
            item.btn.style.transform = `translate3d(${Math.round(
              item.p.screenX - item.offsetX
            )}px, ${Math.round(topY)}px, 0) translateX(-100%)`;
          } else {
            item.btn.style.transform = `translate3d(${Math.round(
              item.p.screenX + item.offsetX
            )}px, ${Math.round(topY)}px, 0)`;
          }
          item.btn.style.opacity = String(item.labelAlpha);
          item.btn.style.pointerEvents = 'auto';
        }
      };
      placeNonOverlappingColumn(leftSideLabels, true);
      placeNonOverlappingColumn(rightSideLabels, false);
    }

    const coreNode = graph.nodeMap.get('hub-core');
    canvas.dataset.yaw = cam.yaw.toFixed(3);
    canvas.dataset.pitch = cam.pitch.toFixed(3);
    canvas.dataset.distance = String(Math.round(cam.distance));
    canvas.dataset.pivotX = String(Math.round(cam.x));
    canvas.dataset.coreLogo = coreNode?.logoUrl ? 'logo' : 'monogram';

    ctx.restore();
  }, [
    activeClassFilter,
    connectedHubIds,
    graph.edges,
    graph.nodeMap,
    graph.nodes,
    graph.ontologyColumns,
    hoveredNodeId,
    hubs,
    layoutMode,
    palette,
    rootPathEdgeIds,
    selectedFactId,
    selectedHubId,
    selectedNodeId,
    semanticNeighborNodeIds,
    showAllCrossLinks,
    showConeGuides,
  ]);

  const drawSceneRef = useRef<() => void>(drawScene);
  drawSceneRef.current = drawScene;
  const graphNodeMapRef = useRef(graph.nodeMap);
  graphNodeMapRef.current = graph.nodeMap;

  const scheduleAnimation = useCallback(() => {
    if (rafRef.current !== null) return;
    const step = () => {
      const cur = currentCamRef.current;
      const tgt = targetCamRef.current;
      const ease = 0.18;
      const isAutoRotating = autoRotateRef.current;

      if (isAutoRotating && !dragRef.current.active) {
        tgt.yaw += 0.006;
      }

      cur.x += (tgt.x - cur.x) * ease;
      cur.y += (tgt.y - cur.y) * ease;
      cur.z += (tgt.z - cur.z) * ease;
      cur.distance += (tgt.distance - cur.distance) * ease;
      cur.yaw += (tgt.yaw - cur.yaw) * ease;
      cur.pitch += (tgt.pitch - cur.pitch) * ease;
      cur.panOffsetX =
        (cur.panOffsetX ?? 0) + ((tgt.panOffsetX ?? 0) - (cur.panOffsetX ?? 0)) * ease;

      // Smoothly interpolate node 3D coordinates when switching alignment modes
      let posDelta = 0;
      const animMap = animatedPosRef.current;
      for (const [id, targetNode] of graphNodeMapRef.current.entries()) {
        const curPos = animMap.get(id);
        if (!curPos) {
          animMap.set(id, { x: targetNode.x, y: targetNode.y, z: targetNode.z });
          continue;
        }
        const dx = targetNode.x - curPos.x;
        const dy = targetNode.y - curPos.y;
        const dz = targetNode.z - curPos.z;
        const dist = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
        if (dist > 0.15) {
          curPos.x += dx * 0.22;
          curPos.y += dy * 0.22;
          curPos.z += dz * 0.22;
          posDelta += dist;
        } else if (dist > 0) {
          curPos.x = targetNode.x;
          curPos.y = targetNode.y;
          curPos.z = targetNode.z;
        }
      }

      drawSceneRef.current();

      const camDelta =
        Math.abs(tgt.x - cur.x) +
        Math.abs(tgt.y - cur.y) +
        Math.abs(tgt.z - cur.z) +
        Math.abs(tgt.distance - cur.distance) +
        Math.abs((tgt.panOffsetX ?? 0) - (cur.panOffsetX ?? 0)) +
        Math.abs(tgt.yaw - cur.yaw) * 200 +
        Math.abs(tgt.pitch - cur.pitch) * 200;

      if (camDelta > 0.12 || posDelta > 0.5 || isAutoRotating) {
        rafRef.current = window.requestAnimationFrame(step);
      } else {
        currentCamRef.current = { ...tgt };
        drawSceneRef.current();
        rafRef.current = null;
      }
    };
    rafRef.current = window.requestAnimationFrame(step);
  }, []);

  // Kick animation when autoRotate toggles on
  useEffect(() => {
    if (autoRotate) {
      scheduleAnimation();
    }
  }, [autoRotate, scheduleAnimation]);

  // Update camera target on hub selection or layout alignment transitions
  useEffect(() => {
    const overviewDist = getOverviewDistance(layoutMode);
    const hadSelectedHub = prevSelectedHubIdRef.current !== null;
    const layoutChanged = prevLayoutModeRef.current !== layoutMode;
    prevSelectedHubIdRef.current = selectedHubId;
    prevLayoutModeRef.current = layoutMode;

    if (layoutChanged) {
      setAutoRotate(false);
      autoRotateRef.current = false;
    }

    if (selectedHubId) {
      const targetHubNode = graph.nodeMap.get(selectedHubId);
      const hub = hubs.find((h) => h.id === selectedHubId);
      if (hub && targetHubNode) {
        const drawerShift = typeof window !== 'undefined' && window.innerWidth < 768 ? 0 : 185;
        if (layoutMode === 'ontology-x') {
          const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768;
          targetCamRef.current = {
            x: isNarrow ? 20 : 10,
            y: targetHubNode.y * 0.22,
            z: targetHubNode.z * 0.22,
            distance: isNarrow ? 2280 : 2040,
            yaw: layoutChanged ? 0.44 : targetCamRef.current.yaw,
            pitch: layoutChanged ? -0.14 : targetCamRef.current.pitch,
            panOffsetX: isNarrow ? 0 : 195,
          };
        } else {
          targetCamRef.current = {
            x: targetHubNode.x,
            y: targetHubNode.y,
            z: targetHubNode.z,
            distance: 700,
            yaw: layoutChanged ? 0.12 : targetCamRef.current.yaw,
            pitch: layoutChanged ? -0.05 : targetCamRef.current.pitch,
            panOffsetX: drawerShift,
          };
        }
      }
    } else if (layoutMode === 'ontology-x') {
      targetCamRef.current = {
        x: 35,
        y: 10,
        z: 0,
        distance: overviewDist,
        yaw: layoutChanged ? 0.44 : targetCamRef.current.yaw,
        pitch: layoutChanged ? -0.14 : targetCamRef.current.pitch,
        panOffsetX: 0,
      };
    } else {
      const preserveAngle = hadSelectedHub && !layoutChanged;
      targetCamRef.current = {
        x: 0,
        y: 0,
        z: 20,
        distance: overviewDist,
        yaw: preserveAngle ? targetCamRef.current.yaw : 0.12,
        pitch: preserveAngle ? targetCamRef.current.pitch : -0.05,
        panOffsetX: 0,
      };
    }
    scheduleAnimation();
  }, [graph.nodeMap, hubs, layoutMode, scheduleAnimation, selectedHubId]);

  useEffect(() => {
    drawScene();
  }, [drawScene]);

  useEffect(() => {
    const onResize = () => drawSceneRef.current();
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        targetCamRef.current.yaw -= 0.14;
        scheduleAnimation();
      } else if (e.key === 'ArrowRight') {
        targetCamRef.current.yaw += 0.14;
        scheduleAnimation();
      } else if (e.key === 'ArrowUp') {
        targetCamRef.current.pitch = Math.max(-1.25, targetCamRef.current.pitch - 0.12);
        scheduleAnimation();
      } else if (e.key === 'ArrowDown') {
        targetCamRef.current.pitch = Math.min(1.25, targetCamRef.current.pitch + 0.12);
        scheduleAnimation();
      }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [scheduleAnimation]);

  // Cancel any active animation frame only when component unmounts
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const hitTestNode = (clientX: number, clientY: number): ProjectedNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Test nearest-to-camera nodes first
    const nearFirst = [...projectedRef.current].sort((a, b) => a.depth - b.depth);
    for (const p of nearFirst) {
      const hitRadius = Math.max(12, p.projectedRadius + 7);
      const dx = x - p.screenX;
      const dy = y - p.screenY;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return p;
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const altModifier = e.shiftKey || e.button === 2;
    const shouldOrbit = dragMode === 'rotate' ? !altModifier : altModifier;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      orbit: shouldOrbit,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      if (
        Math.abs(e.clientX - dragRef.current.startX) > 4 ||
        Math.abs(e.clientY - dragRef.current.startY) > 4
      ) {
        dragRef.current.moved = true;
      }
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;

      if (dragRef.current.orbit) {
        targetCamRef.current.yaw += dx * 0.0065;
        targetCamRef.current.pitch = Math.max(
          -1.25,
          Math.min(1.25, targetCamRef.current.pitch + dy * 0.0065)
        );
      } else {
        // Screen-aligned pan relative to current yaw
        const panScale = targetCamRef.current.distance / 780;
        const cosY = Math.cos(targetCamRef.current.yaw);
        const sinY = Math.sin(targetCamRef.current.yaw);
        targetCamRef.current.x -= dx * panScale * cosY;
        targetCamRef.current.z += dx * panScale * sinY;
        targetCamRef.current.y -= dy * panScale;
      }
      scheduleAnimation();
      return;
    }

    const hit = hitTestNode(e.clientX, e.clientY);
    setHoveredNodeId(hit ? hit.node.id : null);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const wasMoved = dragRef.current.moved;
    dragRef.current.active = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!wasMoved) {
      const hit = hitTestNode(e.clientX, e.clientY);
      if (hit) {
        if (hit.node.kind === 'hub') {
          onSelectHub(hit.node.hubId, null, null);
        } else {
          onSelectHub(hit.node.hubId, hit.node.factId ?? null, hit.node.id);
        }
      } else if (selectedHubId) {
        onSelectHub(null, null, null);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    targetCamRef.current.distance = Math.max(
      260,
      Math.min(2800, targetCamRef.current.distance + e.deltaY * 0.9)
    );
    scheduleAnimation();
  };

  const handleZoom = (deltaDist: number) => {
    targetCamRef.current.distance = Math.max(
      260,
      Math.min(2800, targetCamRef.current.distance + deltaDist)
    );
    scheduleAnimation();
  };

  const handleOverview = () => {
    const overviewDist = getOverviewDistance(layoutMode);
    autoRotateRef.current = false;
    setAutoRotate(false);
    onSelectHub(null, null, null);
    targetCamRef.current =
      layoutMode === 'ontology-x'
        ? {
            x: 35,
            y: 10,
            z: 0,
            distance: overviewDist,
            yaw: 0.44,
            pitch: -0.14,
            panOffsetX: 0,
          }
        : {
            x: 0,
            y: 0,
            z: 20,
            distance: overviewDist,
            yaw: 0.12,
            pitch: -0.05,
            panOffsetX: 0,
          };
    scheduleAnimation();
  };

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[var(--nni-bg)]">
      <canvas
        ref={canvasRef}
        data-testid="knowledge-graph-canvas"
        data-layout-mode={layoutMode}
        data-cone-guides={showConeGuides ? 'true' : 'false'}
        data-drag-mode={dragMode}
        data-auto-rotate={autoRotate ? 'true' : 'false'}
        data-selected-node={selectedNodeId ?? ''}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className={`block h-full w-full touch-none ${
          hoveredNodeId ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {/* Accessible floating hub label buttons synced to 3D projection */}
      <div aria-label="Knowledge hubs" className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {hubs.map((hub) => {
          const isSelected = selectedHubId === hub.id;
          return (
            <button
              key={hub.id}
              ref={(el) => {
                if (el) hubButtonRefs.current.set(hub.id, el);
                else hubButtonRefs.current.delete(hub.id);
              }}
              type="button"
              onClick={() => onSelectHub(hub.id, null)}
              aria-pressed={isSelected}
              className={`absolute left-0 top-0 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold transition-colors whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.08)] focus-visible:outline-2 focus-visible:outline-[var(--nni-primary)] ${
                isSelected
                  ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                  : 'border border-[var(--nni-border)]/70 bg-[var(--nni-surface)]/92 text-[var(--nni-text)] hover:bg-[var(--nni-surface)]'
              }`}
              style={{ willChange: 'transform, opacity' }}
            >
              <span>{hub.nameJa}</span>
              <span
                className={`font-mono text-[10px] ${
                  isSelected ? 'opacity-80' : 'text-[var(--nni-text-muted)]'
                }`}
              >
                {hub.code}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bottom-left Ontology Filter Bar & Navigation Hint */}
      <div
        className={`pointer-events-none absolute bottom-4 left-4 z-20 flex flex-col items-start gap-1.5 ${
          selectedHubId ? 'right-4 xl:right-[510px]' : 'right-16'
        }`}
      >
        <div
          role="toolbar"
          aria-label="オントロジー分類フィルタ"
          className="pointer-events-auto flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-xl border border-[var(--nni-border)] bg-[var(--nni-surface)]/95 p-1 shadow-sm backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => onChangeClassFilter('all')}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeClassFilter === 'all'
                ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                : 'text-[var(--nni-text-muted)] hover:bg-[var(--nni-surface-soft)] hover:text-[var(--nni-text)]'
            }`}
          >
            すべて
          </button>
          {classes.map((cls) => {
            const active = activeClassFilter === cls.id;
            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => onChangeClassFilter(active ? 'all' : cls.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                    : 'text-[var(--nni-text-muted)] hover:bg-[var(--nni-surface-soft)] hover:text-[var(--nni-text)]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-black/15"
                  style={{ backgroundColor: active ? palette.primaryFgHex : cls.color }}
                />
                <span>{cls.labelJa}</span>
              </button>
            );
          })}
        </div>

        <p className="hidden md:block px-1 text-[11px] font-medium tracking-wide text-[var(--nni-text-muted)]">
          {dragMode === 'rotate'
            ? 'Drag to rotate 3D · Shift+Drag to pan · Scroll to zoom · Arrow keys orbit · Click a hub'
            : 'Drag to pan · Shift+Drag to rotate 3D · Scroll to zoom · Arrow keys orbit · Click a hub'}
        </p>
      </div>

      {/* Top-right 3D Camera, Alignment & Relation Controls */}
      <div
        className={`absolute top-4 z-20 flex flex-wrap items-center justify-end gap-1.5 transition-all ${
          selectedHubId ? 'left-4 right-[456px] hidden xl:flex' : 'left-4 right-4'
        }`}
      >
        <div
          role="group"
          aria-label="ノード整列モード"
          className="flex items-center rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface)]/95 p-0.5 shadow-sm"
        >
          <button
            type="button"
            onClick={() => setLayoutMode('radial')}
            aria-pressed={layoutMode === 'radial'}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              layoutMode === 'radial'
                ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                : 'text-[var(--nni-text-muted)] hover:text-[var(--nni-text)]'
            }`}
          >
            <Orbit className="h-3.5 w-3.5" aria-hidden="true" />
            <span>放射</span>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('ontology-x')}
            aria-pressed={layoutMode === 'ontology-x'}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              layoutMode === 'ontology-x'
                ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                : 'text-[var(--nni-text-muted)] hover:text-[var(--nni-text)]'
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>X整列</span>
          </button>
        </div>

        {layoutMode === 'ontology-x' && (
          <button
            type="button"
            onClick={() => setShowConeGuides((v) => !v)}
            aria-pressed={showConeGuides}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0 ${
              showConeGuides
                ? 'border-[var(--nni-primary)] bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                : 'border-[var(--nni-border)] bg-[var(--nni-surface)]/95 text-[var(--nni-text)] hover:bg-[var(--nni-surface-soft)]'
            }`}
          >
            <Triangle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>円錐ガイド</span>
          </button>
        )}

        <div
          role="group"
          aria-label="ドラッグ操作モード"
          className="flex items-center rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface)]/95 p-0.5 shadow-sm"
        >
          <button
            type="button"
            onClick={() => setDragMode('rotate')}
            aria-pressed={dragMode === 'rotate'}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              dragMode === 'rotate'
                ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                : 'text-[var(--nni-text-muted)] hover:text-[var(--nni-text)]'
            }`}
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Rotate</span>
          </button>
          <button
            type="button"
            onClick={() => setDragMode('pan')}
            aria-pressed={dragMode === 'pan'}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              dragMode === 'pan'
                ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                : 'text-[var(--nni-text-muted)] hover:text-[var(--nni-text)]'
            }`}
          >
            <Move className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Pan</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setAutoRotate((v) => !v)}
          aria-pressed={autoRotate}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0 ${
            autoRotate
              ? 'border-[var(--nni-primary)] bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
              : 'border-[var(--nni-border)] bg-[var(--nni-surface)]/95 text-[var(--nni-text)] hover:bg-[var(--nni-surface-soft)]'
          }`}
        >
          {autoRotate ? (
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>Auto Rotate</span>
        </button>

        <button
          type="button"
          onClick={() => setShowAllCrossLinks((v) => !v)}
          aria-pressed={showAllCrossLinks}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0 ${
            showAllCrossLinks
              ? 'border-[var(--nni-primary)] bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
              : 'border-[var(--nni-border)] bg-[var(--nni-surface)]/95 text-[var(--nni-text)] hover:bg-[var(--nni-surface-soft)]'
          }`}
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>All Relations</span>
        </button>

        <button
          type="button"
          onClick={handleOverview}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface)]/95 px-3 py-2 text-xs font-semibold text-[var(--nni-text)] shadow-sm transition-colors hover:bg-[var(--nni-surface-soft)] whitespace-nowrap shrink-0"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Overview</span>
        </button>
      </div>

      {/* Bottom-right Zoom Stack */}
      <div
        className={`absolute bottom-4 z-20 flex flex-col overflow-hidden rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface)]/95 shadow-sm transition-all ${
          selectedHubId ? 'right-[456px] hidden xl:flex' : 'right-4'
        }`}
      >
        <button
          type="button"
          onClick={() => handleZoom(-140)}
          aria-label="Zoom in"
          className="flex h-9 w-9 items-center justify-center border-b border-[var(--nni-border)] text-[var(--nni-text)] transition-colors hover:bg-[var(--nni-surface-soft)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => handleZoom(140)}
          aria-label="Zoom out"
          className="flex h-9 w-9 items-center justify-center text-[var(--nni-text)] transition-colors hover:bg-[var(--nni-surface-soft)]"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
