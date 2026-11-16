import type {
  CameraState,
  CrossHubEdge,
  GraphEdge3D,
  GraphLayoutMode,
  GraphNode3D,
  KnowledgeHub,
  OntologyClassDef,
  OntologyClassId,
  OntologyColumnGuide,
  ProjectedNode,
  SemanticFactEdge,
} from '../types/knowledge';
import {
  getReadableInkHex,
  resolveHubNodeColor,
  resolveNodeStrokeColor,
  type ThemePalette,
} from './themePalettes';

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export interface BuiltGraph {
  nodes: GraphNode3D[];
  edges: GraphEdge3D[];
  nodeMap: Map<string, GraphNode3D>;
  ontologyColumns: OntologyColumnGuide[];
}

const CONE_APEX_X = -960;
const CONE_HUB_X = -240;
const ALIGNED_FIRST_COL_X = -60;
const ALIGNED_COL_STEP_X = 158;
const CONE_BASE_X = ALIGNED_FIRST_COL_X + 7 * ALIGNED_COL_STEP_X; // +1046
const CONE_SPAN_X = CONE_BASE_X - CONE_APEX_X; // 2006
const CONE_BASE_RADIUS = 780;

export function getConeSliceRadius(x: number): number {
  const t = Math.max(0, (x - CONE_APEX_X) / CONE_SPAN_X);
  return CONE_BASE_RADIUS * t;
}

export function getConeRingPoints(
  x: number,
  segments = 36
): Array<{ x: number; y: number; z: number }> {
  const r = getConeSliceRadius(x);
  const pts: Array<{ x: number; y: number; z: number }> = [];
  for (let i = 0; i < segments; i++) {
    const a = -Math.PI / 2 + (i / segments) * Math.PI * 2;
    pts.push({ x, y: Math.sin(a) * r, z: Math.cos(a) * r });
  }
  return pts;
}

function projectAngleToConeYZ(
  x: number,
  theta: number,
  radialFill: number
): { y: number; z: number } {
  const r = getConeSliceRadius(x) * Math.max(0.08, Math.min(1.0, radialFill));
  return {
    y: Math.sin(theta) * r,
    z: Math.cos(theta) * r,
  };
}

/**
 * Builds a deterministic 3D knowledge graph from hubs, ontology classes, and cross-hub edges.
 * Supports 'radial' (3D starburst galaxy) and 'ontology-x' (only X aligned by OntologyClassId; free Y/Z forming a wide 3D circular cone from hub-core apex).
 */
export function buildSpatialKnowledgeGraph(
  hubs: KnowledgeHub[],
  classes: OntologyClassDef[],
  crossEdges: CrossHubEdge[],
  hubFillOrPalette: string | ThemePalette = '#231024',
  layoutMode: GraphLayoutMode = 'radial',
  semanticEdges: SemanticFactEdge[] = []
): BuiltGraph {
  const palette = typeof hubFillOrPalette === 'string' ? null : hubFillOrPalette;
  const fallbackHubFill = typeof hubFillOrPalette === 'string' ? hubFillOrPalette : hubFillOrPalette.hubFillHex;
  const classColorMap = new Map<OntologyClassId, string>();
  const classLabelMap = new Map<OntologyClassId, string>();
  const columnXMap = new Map<OntologyClassId, number>();
  const ontologyColumns: OntologyColumnGuide[] = [];

  classes.forEach((c, idx) => {
    classColorMap.set(c.id, c.color);
    classLabelMap.set(c.id, c.labelJa);
    const colX = ALIGNED_FIRST_COL_X + idx * ALIGNED_COL_STEP_X;
    columnXMap.set(c.id, colX);
    ontologyColumns.push({
      classId: c.id,
      labelJa: c.labelJa,
      color: c.color,
      x: colX,
    });
  });

  const nodes: GraphNode3D[] = [];
  const edges: GraphEdge3D[] = [];
  const nodeMap = new Map<string, GraphNode3D>();

  const addNode = (n: GraphNode3D) => {
    nodes.push(n);
    nodeMap.set(n.id, n);
  };

  // Sort non-core hubs by their natural radial angle in YZ and distribute cleanly around the wide cone ring
  const nonCoreHubs = hubs
    .filter((h) => h.id !== 'hub-core')
    .sort(
      (a, b) =>
        Math.atan2(a.position3D.y, a.position3D.z) - Math.atan2(b.position3D.y, b.position3D.z)
    );
  const hubPolarMap = new Map<string, { theta: number; fill: number }>();
  nonCoreHubs.forEach((h, idx) => {
    const theta = -Math.PI / 2 + (idx / Math.max(1, nonCoreHubs.length)) * Math.PI * 2;
    const fill = idx % 2 === 0 ? 0.96 : 0.72;
    hubPolarMap.set(h.id, { theta, fill });
  });

  for (const hub of hubs) {
    const hubColor = palette ? resolveHubNodeColor(hub, palette) : fallbackHubFill;
    const isCore = hub.id === 'hub-core';
    const hubPolar = hubPolarMap.get(hub.id) ?? { theta: -Math.PI / 2, fill: 0.34 };

    let alignedHubX = CONE_APEX_X;
    let alignedHubY = 0;
    let alignedHubZ = 0;
    if (!isCore) {
      alignedHubX = CONE_HUB_X;
      const yz = projectAngleToConeYZ(CONE_HUB_X, hubPolar.theta, hubPolar.fill);
      alignedHubY = yz.y;
      alignedHubZ = yz.z;
    }

    const hubX = layoutMode === 'ontology-x' ? alignedHubX : hub.position3D.x;
    const hubY = layoutMode === 'ontology-x' ? alignedHubY : hub.position3D.y;
    const hubZ = layoutMode === 'ontology-x' ? alignedHubZ : hub.position3D.z;

    const hubNode: GraphNode3D = {
      id: hub.id,
      kind: 'hub',
      hubId: hub.id,
      label: hub.nameJa,
      sublabel: hub.code,
      monogram: hub.monogram,
      logoUrl: hub.logoUrl,
      x: hubX,
      y: hubY,
      z: hubZ,
      radius: isCore ? (layoutMode === 'ontology-x' ? 30 : 30) : 14.5,
      color: hubColor,
      strokeColor: palette ? resolveNodeStrokeColor(hubColor, palette, 'hub') : undefined,
      monogramColor: getReadableInkHex(hubColor),
    };
    addNode(hubNode);

    // Group facts by OntologyClassId
    const byClass = new Map<OntologyClassId, typeof hub.facts>();
    for (const fact of hub.facts) {
      const list = byClass.get(fact.classId) ?? [];
      list.push(fact);
      byClass.set(fact.classId, list);
    }

    const activeClasses = Array.from(byClass.keys());
    const classCount = activeClasses.length;
    const baseSeed = hashString(hub.id) * Math.PI * 2;

    activeClasses.forEach((classId, cIdx) => {
      const facts = byClass.get(classId) ?? [];
      const catColor = classColorMap.get(classId) ?? '#64748B';
      const catLabel = classLabelMap.get(classId) ?? classId;
      const colX = columnXMap.get(classId) ?? ALIGNED_FIRST_COL_X;

      // Radial mode: 3D tilted orbit around hub
      const angle = baseSeed + (cIdx / Math.max(1, classCount)) * Math.PI * 2;
      const tilt = (hashString(`${hub.id}-${classId}-tilt`) - 0.5) * 1.15;
      const coreOrbitOffset = isCore ? 24 : 0;
      const spokeDist = 72 + coreOrbitOffset + hashString(`${hub.id}-${classId}-dist`) * 22;

      // Ontology-X mode: ONLY X is aligned to colX; Y and Z expand freely inside the circular cone
      const catTheta = isCore
        ? -Math.PI / 2 + (cIdx / Math.max(1, classCount)) * Math.PI * 2
        : hubPolar.theta + (hashString(`${hub.id}-${classId}-a`) - 0.5) * 0.28;
      const catFill = isCore
        ? 0.32
        : Math.min(0.95, Math.max(0.28, hubPolar.fill * (0.86 + hashString(`${hub.id}-${classId}-r`) * 0.22)));
      const catYZ = projectAngleToConeYZ(colX, catTheta, catFill);

      const cx = layoutMode === 'ontology-x' ? colX : hub.position3D.x + Math.cos(angle) * spokeDist;
      const cy =
        layoutMode === 'ontology-x' ? catYZ.y : hub.position3D.y + Math.sin(angle) * spokeDist * 0.86;
      const cz =
        layoutMode === 'ontology-x' ? catYZ.z : hub.position3D.z + Math.sin(tilt) * 44;

      const catNodeId = `${hub.id}::cat::${classId}`;
      addNode({
        id: catNodeId,
        kind: 'category',
        hubId: hub.id,
        classId,
        label: catLabel,
        sublabel: `${facts.length}`,
        x: cx,
        y: cy,
        z: cz,
        radius: 7.2,
        color: catColor,
        strokeColor: palette ? resolveNodeStrokeColor(catColor, palette, 'category') : undefined,
      });

      edges.push({
        id: `edge-${hub.id}-${catNodeId}`,
        kind: 'intra',
        sourceId: hub.id,
        targetId: catNodeId,
        hubId: hub.id,
        classId,
      });

      // Fan out fact leaf nodes + evidence micro-nodes
      facts.forEach((fact, fIdx) => {
        const spreadAngle =
          angle + (fIdx - (facts.length - 1) / 2) * 0.55 + (hashString(fact.id) - 0.5) * 0.2;
        const leafDist = 36 + hashString(`${fact.id}-d`) * 22;

        const factThetaSpread =
          (fIdx - (facts.length - 1) / 2) * 0.22 + (hashString(fact.id) - 0.5) * 0.12;
        const factFill = Math.min(0.98, Math.max(0.2, catFill + (fIdx % 2 === 0 ? 0.09 : -0.08)));
        const factYZ = projectAngleToConeYZ(colX, catTheta + factThetaSpread, factFill);

        const fx = layoutMode === 'ontology-x' ? colX : cx + Math.cos(spreadAngle) * leafDist;
        const fy =
          layoutMode === 'ontology-x' ? factYZ.y : cy + Math.sin(spreadAngle) * leafDist * 0.9;
        const leafZ =
          layoutMode === 'ontology-x' ? factYZ.z : cz + (hashString(`${fact.id}-z`) - 0.5) * 34;

        const factNodeId = `${hub.id}::fact::${fact.id}`;
        addNode({
          id: factNodeId,
          kind: 'fact',
          hubId: hub.id,
          classId,
          factId: fact.id,
          label: fact.title,
          sublabel: fact.metricBadge ?? fact.predicateLabel,
          x: fx,
          y: fy,
          z: leafZ,
          radius: 4.9,
          color: catColor,
          strokeColor: palette ? resolveNodeStrokeColor(catColor, palette, 'fact') : undefined,
        });

        edges.push({
          id: `edge-${catNodeId}-${factNodeId}`,
          kind: 'intra',
          sourceId: catNodeId,
          targetId: factNodeId,
          hubId: hub.id,
          classId,
        });

        // 3rd-tier authentic evidence/metric micro-node branching from fact node
        if (fact.metricBadge || fact.sourcePath) {
          const microAngle = spreadAngle + (hashString(`${fact.id}-ma`) - 0.5) * 0.9;
          const microDist = 22 + hashString(`${fact.id}-md`) * 12;
          const evTheta = catTheta + factThetaSpread + 0.08 + (hashString(`${fact.id}-ev`) - 0.5) * 0.12;
          const evFill = Math.min(1.0, factFill + 0.06);
          const evYZ = projectAngleToConeYZ(colX, evTheta, evFill);
          const microId = `${factNodeId}::ev`;
          addNode({
            id: microId,
            kind: 'evidence',
            hubId: hub.id,
            classId,
            factId: fact.id,
            label: fact.metricBadge ?? fact.sourcePath ?? '',
            sublabel: fact.title,
            x: layoutMode === 'ontology-x' ? colX : fx + Math.cos(microAngle) * microDist,
            y: layoutMode === 'ontology-x' ? evYZ.y : fy + Math.sin(microAngle) * microDist * 0.9,
            z:
              layoutMode === 'ontology-x'
                ? evYZ.z
                : leafZ + (hashString(`${fact.id}-mz`) - 0.5) * 20,
            radius: 3.1,
            color: catColor,
            strokeColor: palette ? resolveNodeStrokeColor(catColor, palette, 'evidence') : undefined,
          });
          edges.push({
            id: `edge-${factNodeId}-${microId}`,
            kind: 'intra',
            sourceId: factNodeId,
            targetId: microId,
            hubId: hub.id,
            classId,
          });
        }
      });
    });

    // Add 1-2 ambient ontology ring spokes for unrepresented secondary ontology links so clusters feel full
    const extraAngles = 3;
    for (let i = 0; i < extraAngles; i++) {
      const fallbackClass = classes[(i + Math.floor(hashString(hub.id) * classes.length)) % classes.length];
      if (byClass.has(fallbackClass.id)) continue;
      const a = baseSeed + ((i + 0.5) / extraAngles) * Math.PI * 2;
      const dist = 54 + hashString(`${hub.id}-aux-${i}`) * 18;
      const fallbackColX = columnXMap.get(fallbackClass.id) ?? ALIGNED_FIRST_COL_X;
      const auxYZ = projectAngleToConeYZ(
        fallbackColX,
        hubPolar.theta + (i - 1) * 0.18,
        Math.min(0.92, hubPolar.fill * 0.78)
      );
      const ax = layoutMode === 'ontology-x' ? fallbackColX : hub.position3D.x + Math.cos(a) * dist;
      const ay =
        layoutMode === 'ontology-x' ? auxYZ.y : hub.position3D.y + Math.sin(a) * dist * 0.85;
      const az =
        layoutMode === 'ontology-x'
          ? auxYZ.z
          : hub.position3D.z + (hashString(`${hub.id}-auxz-${i}`) - 0.5) * 30;
      const auxId = `${hub.id}::aux::${i}`;
      addNode({
        id: auxId,
        kind: 'aux',
        hubId: hub.id,
        classId: fallbackClass.id,
        label: fallbackClass.labelJa,
        x: ax,
        y: ay,
        z: az,
        radius: 3.3,
        color: fallbackClass.color,
        strokeColor: palette
          ? resolveNodeStrokeColor(fallbackClass.color, palette, 'aux')
          : undefined,
      });
      edges.push({
        id: `edge-${hub.id}-${auxId}`,
        kind: 'intra',
        sourceId: hub.id,
        targetId: auxId,
        hubId: hub.id,
        classId: fallbackClass.id,
      });
    }
  }

  for (const ce of crossEdges) {
    if (nodeMap.has(ce.sourceHubId) && nodeMap.has(ce.targetHubId)) {
      edges.push({
        id: ce.id,
        kind: 'cross',
        sourceId: ce.sourceHubId,
        targetId: ce.targetHubId,
        hubId: ce.sourceHubId,
        predicate: ce.predicate,
        label: ce.labelJa,
      });
    }
  }

  for (const se of semanticEdges) {
    const sourceId = `${se.sourceHubId}::fact::${se.sourceFactId}`;
    const targetId = `${se.targetHubId}::fact::${se.targetFactId}`;
    const srcNode = nodeMap.get(sourceId);
    const tgtNode = nodeMap.get(targetId);
    if (srcNode && tgtNode) {
      edges.push({
        id: se.id,
        kind: 'semantic',
        sourceId,
        targetId,
        hubId: se.sourceHubId,
        targetHubId: se.targetHubId,
        classId: srcNode.classId,
        targetClassId: tgtNode.classId,
        predicate: se.predicate,
        label: se.labelJa,
      });
    }
  }

  return { nodes, edges, nodeMap, ontologyColumns };
}

/**
 * Projects a 3D world node into 2D screen coordinates with perspective scaling and gtmbrain.si-style depth-of-field fog.
 */
export function projectNode3D(
  node: GraphNode3D,
  camera: CameraState,
  viewportWidth: number,
  viewportHeight: number,
  focalLength = 780
): ProjectedNode | null {
  const dx = node.x - camera.x;
  const dy = node.y - camera.y;
  const dz = node.z - camera.z;

  // Yaw around Y axis
  const cosYaw = Math.cos(camera.yaw);
  const sinYaw = Math.sin(camera.yaw);
  const rx = dx * cosYaw - dz * sinYaw;
  const rz1 = dx * sinYaw + dz * cosYaw;

  // Pitch around X axis
  const cosPitch = Math.cos(camera.pitch);
  const sinPitch = Math.sin(camera.pitch);
  const ry = dy * cosPitch - rz1 * sinPitch;
  const rz = dy * sinPitch + rz1 * cosPitch;

  // Rotate around pivot (camera.x, camera.y, camera.z) then offset by camera.distance
  const depthFromCamera = rz + camera.distance;
  if (depthFromCamera <= 140) {
    return null;
  }

  const scale = focalLength / depthFromCamera;
  const screenX = viewportWidth * 0.5 - (camera.panOffsetX ?? 0) + rx * scale;
  const screenY = viewportHeight * 0.5 + ry * scale;

  // Atmospheric depth-of-field fog: scales gracefully with camera distance so wide views stay legible while preserving 3D depth
  const fogStart = Math.max(720, camera.distance * 0.72);
  const fogRange = Math.max(1300, camera.distance * 0.95);
  const rawFog = 1 - Math.max(0, (depthFromCamera - fogStart) / fogRange);
  const depthAlpha = Math.max(0.24, Math.min(1, rawFog));

  return {
    node,
    screenX,
    screenY,
    scale,
    projectedRadius: node.radius * scale,
    depthAlpha,
    depth: depthFromCamera,
  };
}

export function getConnectedHubIds(hubId: string, crossEdges: CrossHubEdge[]): Set<string> {
  const connected = new Set<string>([hubId]);
  for (const edge of crossEdges) {
    if (edge.sourceHubId === hubId) connected.add(edge.targetHubId);
    if (edge.targetHubId === hubId) connected.add(edge.sourceHubId);
  }
  return connected;
}

export function getReachableHubIds(rootHubId: string, crossEdges: CrossHubEdge[]): Set<string> {
  const visited = new Set<string>([rootHubId]);
  const queue: string[] = [rootHubId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of crossEdges) {
      if (edge.sourceHubId === current && !visited.has(edge.targetHubId)) {
        visited.add(edge.targetHubId);
        queue.push(edge.targetHubId);
      } else if (edge.targetHubId === current && !visited.has(edge.sourceHubId)) {
        visited.add(edge.sourceHubId);
        queue.push(edge.sourceHubId);
      }
    }
  }
  return visited;
}

export function getShortestPathEdgeIds(
  fromHubId: string,
  toHubId: string,
  crossEdges: CrossHubEdge[]
): Set<string> {
  const edgeIds = new Set<string>();
  if (fromHubId === toHubId) return edgeIds;

  const visited = new Set<string>([fromHubId]);
  const parent = new Map<string, { prevHub: string; edgeId: string }>();
  const queue: string[] = [fromHubId];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === toHubId) break;
    for (const edge of crossEdges) {
      const next =
        edge.sourceHubId === cur
          ? edge.targetHubId
          : edge.targetHubId === cur
          ? edge.sourceHubId
          : null;
      if (next && !visited.has(next)) {
        visited.add(next);
        parent.set(next, { prevHub: cur, edgeId: edge.id });
        queue.push(next);
      }
    }
  }

  let step = toHubId;
  while (parent.has(step)) {
    const p = parent.get(step)!;
    edgeIds.add(p.edgeId);
    step = p.prevHub;
  }
  return edgeIds;
}

export function filterHubs(
  hubs: KnowledgeHub[],
  query: string,
  activeClass: OntologyClassId | 'all'
): KnowledgeHub[] {
  const q = query.trim().toLowerCase();
  return hubs.filter((hub) => {
    const matchesClass =
      activeClass === 'all' || hub.facts.some((fact) => fact.classId === activeClass);
    if (!matchesClass) return false;
    if (!q) return true;
    const haystack = [
      hub.code,
      hub.nameJa,
      hub.nameEn,
      hub.summary,
      ...hub.facts.flatMap((f) => [f.title, f.objectValue, f.detail, f.metricBadge ?? '']),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function serializeHubForAgent(
  hub: KnowledgeHub,
  crossEdges: CrossHubEdge[],
  allHubs: KnowledgeHub[]
): string {
  const hubLookup = new Map(allHubs.map((h) => [h.id, h]));
  const related = crossEdges
    .filter((e) => e.sourceHubId === hub.id || e.targetHubId === hub.id)
    .map((e) => {
      const otherId = e.sourceHubId === hub.id ? e.targetHubId : e.sourceHubId;
      const other = hubLookup.get(otherId);
      const dir = e.sourceHubId === hub.id ? '→' : '←';
      return `- ${dir} [${e.predicate}] ${other?.nameJa ?? otherId} (${other?.code ?? ''}): ${e.rationale}`;
    });

  const factLines = hub.facts.map(
    (f) =>
      `- [${f.classId}] ${f.title}\n  - ${f.predicateLabel}: ${f.objectValue}\n  - 詳細: ${f.detail}${f.sourcePath ? ` (出典: ${f.sourcePath})` : ''}`
  );

  return [
    `# ${hub.nameJa} (${hub.nameEn} / ${hub.code})`,
    `ステータス: ${hub.statusLabel} | フォルダ数: ${hub.folderCount} | リビジョン数: ${hub.revisionCount}`,
    `概要: ${hub.summary}`,
    '',
    '## オントロジー・ナレッジ要素',
    ...factLines,
    '',
    '## ハブ間セマンティック関係',
    ...(related.length > 0 ? related : ['- なし']),
    '',
    `出典リポジトリ: ${hub.repoUrl}`,
  ].join('\n');
}

export function serializeOntologyAsJsonLd(
  hubs: KnowledgeHub[],
  classes: OntologyClassDef[],
  crossEdges: CrossHubEdge[]
): string {
  const doc = {
    '@context': {
      nni: 'https://github.com/Sunwood-ai-labs/NEKONEKO-INDUSTRIES/ontology#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      labelJa: { '@id': 'rdfs:label', '@language': 'ja' },
      labelEn: { '@id': 'rdfs:label', '@language': 'en' },
    },
    ontologyClasses: classes.map((c) => ({
      '@id': c.uri,
      '@type': 'rdfs:Class',
      labelJa: c.labelJa,
      labelEn: c.labelEn,
      description: c.description,
      properties: c.keyProperties,
    })),
    knowledgeHubs: hubs.map((h) => ({
      '@id': `nni:${h.id}`,
      '@type': `nni:Domain_${h.domain}`,
      code: h.code,
      labelJa: h.nameJa,
      labelEn: h.nameEn,
      status: h.statusLabel,
      revisions: h.revisionCount,
      facts: h.facts.map((f) => ({
        '@id': `nni:${f.id}`,
        '@type': `nni:${f.classId}`,
        title: f.title,
        predicate: f.predicateLabel,
        value: f.objectValue,
        sourcePath: f.sourcePath,
      })),
    })),
    semanticRelations: crossEdges.map((e) => ({
      '@id': `nni:${e.id}`,
      subject: `nni:${e.sourceHubId}`,
      predicate: `nni:${e.predicate}`,
      object: `nni:${e.targetHubId}`,
      labelJa: e.labelJa,
      rationale: e.rationale,
    })),
  };
  return JSON.stringify(doc, null, 2);
}
