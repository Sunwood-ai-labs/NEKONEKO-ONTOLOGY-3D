import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CROSS_HUB_EDGES,
  KNOWLEDGE_HUBS,
  ONTOLOGY_CLASSES,
  SEMANTIC_FACT_EDGES,
  TROUBLE_RECORDS,
} from '../data/nekonekoOntology';
import {
  buildSpatialKnowledgeGraph,
  filterHubs,
  getConnectedHubIds,
  getReachableHubIds,
  getShortestPathEdgeIds,
  projectNode3D,
  serializeHubForAgent,
  serializeOntologyAsJsonLd,
} from './graphLayout';
import {
  buildGitHubSourceUrl,
  buildNodeMarkdownDocument,
  buildRawGitHubUrl,
} from './nodeMarkdown';
import {
  THEME_PALETTES,
  THEME_PALETTE_LIST,
  applyPaletteToClasses,
  getPaletteCssVariables,
  getRelativeLuminance,
} from './themePalettes';

test('buildSpatialKnowledgeGraph generates valid nodes and resolves all cross-hub edges', () => {
  const graph = buildSpatialKnowledgeGraph(KNOWLEDGE_HUBS, ONTOLOGY_CLASSES, CROSS_HUB_EDGES);

  const hubNodes = graph.nodes.filter((n) => n.kind === 'hub');
  assert.equal(hubNodes.length, KNOWLEDGE_HUBS.length);

  for (const node of graph.nodes) {
    assert.ok(Number.isFinite(node.x), `Node ${node.id} x must be finite`);
    assert.ok(Number.isFinite(node.y), `Node ${node.id} y must be finite`);
    assert.ok(Number.isFinite(node.z), `Node ${node.id} z must be finite`);
    assert.ok(node.radius > 0, `Node ${node.id} radius must be positive`);
  }

  const crossEdges = graph.edges.filter((e) => e.kind === 'cross');
  assert.equal(crossEdges.length, CROSS_HUB_EDGES.length);
  for (const edge of graph.edges) {
    assert.ok(graph.nodeMap.has(edge.sourceId), `Missing source ${edge.sourceId}`);
    assert.ok(graph.nodeMap.has(edge.targetId), `Missing target ${edge.targetId}`);
  }
});

test('SEMANTIC_FACT_EDGES resolve cleanly to cross-hub and cross-class fact nodes', () => {
  const graph = buildSpatialKnowledgeGraph(
    KNOWLEDGE_HUBS,
    ONTOLOGY_CLASSES,
    CROSS_HUB_EDGES,
    THEME_PALETTES['harbor-light'],
    'radial',
    SEMANTIC_FACT_EDGES
  );

  const semanticEdges = graph.edges.filter((e) => e.kind === 'semantic');
  assert.equal(semanticEdges.length, SEMANTIC_FACT_EDGES.length);
  assert.ok(semanticEdges.length >= 30);

  const connectedHubs = new Set<string>();
  let crossClassCount = 0;
  for (const edge of semanticEdges) {
    const src = graph.nodeMap.get(edge.sourceId);
    const tgt = graph.nodeMap.get(edge.targetId);
    assert.ok(src && src.kind === 'fact', `Invalid semantic source ${edge.sourceId}`);
    assert.ok(tgt && tgt.kind === 'fact', `Invalid semantic target ${edge.targetId}`);
    connectedHubs.add(src.hubId);
    connectedHubs.add(tgt.hubId);
    if (edge.classId && edge.targetClassId && edge.classId !== edge.targetClassId) {
      crossClassCount++;
    }
  }
  assert.ok(connectedHubs.size >= 10, 'Expected semantic fact edges to span >= 10 hubs');
  assert.ok(crossClassCount >= 20, 'Expected semantic fact edges to connect across ontology classes');
});

test('projectNode3D computes perspective scale, bounded fog, and orbits cleanly around pivot', () => {
  const graph = buildSpatialKnowledgeGraph(KNOWLEDGE_HUBS, ONTOLOGY_CLASSES, CROSS_HUB_EDGES);
  const core = graph.nodeMap.get('hub-core');
  const arch = graph.nodeMap.get('hub-arch');
  assert.ok(core && arch);

  // When camera pivot matches hub-core, core stays centered regardless of yaw
  const front = projectNode3D(
    core,
    { x: core.x, y: core.y, z: core.z, distance: 900, yaw: 0, pitch: 0 },
    1440,
    900
  );
  const rotated = projectNode3D(
    core,
    { x: core.x, y: core.y, z: core.z, distance: 900, yaw: Math.PI, pitch: 0.3 },
    1440,
    900
  );
  assert.ok(front && rotated);
  assert.equal(Math.round(front.screenX), 720);
  assert.equal(Math.round(rotated.screenX), 720);
  assert.equal(Math.round(rotated.screenY), 450);
  assert.ok(front.depthAlpha >= 0.16 && front.depthAlpha <= 1);

  // Rotating 180 degrees flips relative depth of off-center nodes
  const arch0 = projectNode3D(arch, { x: 0, y: 0, z: 0, distance: 1100, yaw: 0, pitch: 0 }, 1440, 900);
  const arch180 = projectNode3D(
    arch,
    { x: 0, y: 0, z: 0, distance: 1100, yaw: Math.PI, pitch: 0 },
    1440,
    900
  );
  assert.ok(arch0 && arch180);
  assert.ok(arch0.depth !== arch180.depth);
});

test('getConnectedHubIds and getReachableHubIds connect entire graph to root hub-core', () => {
  const connected = getConnectedHubIds('hub-lynx', CROSS_HUB_EDGES);
  assert.ok(connected.has('hub-lynx'));
  assert.ok(connected.has('hub-arch'));
  assert.ok(connected.has('hub-mint'));
  assert.ok(connected.has('hub-supportless-principles'));

  const reachableFromCore = getReachableHubIds('hub-core', CROSS_HUB_EDGES);
  assert.equal(reachableFromCore.size, KNOWLEDGE_HUBS.length);

  const solarisPath = getShortestPathEdgeIds('hub-core', 'hub-solaris', CROSS_HUB_EDGES);
  assert.equal(solarisPath.size, 2);
  assert.ok(solarisPath.has('e-core-bus'));
  assert.ok(solarisPath.has('e-bus-solaris'));
});

test('filterHubs supports ontology class and Japanese/technical keyword search', () => {
  const trHubs = filterHubs(KNOWLEDGE_HUBS, '', 'TroubleReport');
  assert.ok(trHubs.length >= 5);
  assert.ok(trHubs.some((h) => h.id === 'hub-lynx'));

  const layer214 = filterHubs(KNOWLEDGE_HUBS, '214', 'all');
  assert.ok(layer214.some((h) => h.id === 'hub-lynx'));
  assert.ok(layer214.some((h) => h.id === 'hub-mint'));
  assert.ok(layer214.some((h) => h.id === 'hub-arch'));
});

test('trouble records reference valid hubs and JSON-LD / agent serialization is valid', () => {
  const hubIds = new Set(KNOWLEDGE_HUBS.map((h) => h.id));
  for (const tr of TROUBLE_RECORDS) {
    assert.ok(hubIds.has(tr.hubId), `TroubleRecord ${tr.id} references unknown hub ${tr.hubId}`);
  }

  const arch = KNOWLEDGE_HUBS.find((h) => h.id === 'hub-arch');
  assert.ok(arch);
  const md = serializeHubForAgent(arch, CROSS_HUB_EDGES, KNOWLEDGE_HUBS);
  assert.ok(md.includes('NKM-C02'));
  assert.ok(md.includes('45°'));

  const jsonLd = JSON.parse(
    serializeOntologyAsJsonLd(KNOWLEDGE_HUBS, ONTOLOGY_CLASSES, CROSS_HUB_EDGES)
  );
  assert.equal(jsonLd.ontologyClasses.length, ONTOLOGY_CLASSES.length);
  assert.equal(jsonLd.knowledgeHubs.length, KNOWLEDGE_HUBS.length);
  assert.equal(jsonLd.semanticRelations.length, CROSS_HUB_EDGES.length);
});

test('buildNodeMarkdownDocument generates rich Markdown for fact, evidence, category, and aux nodes', () => {
  const graph = buildSpatialKnowledgeGraph(KNOWLEDGE_HUBS, ONTOLOGY_CLASSES, CROSS_HUB_EDGES);

  const factNode = graph.nodes.find((n) => n.kind === 'fact' && n.hubId === 'hub-lynx');
  const evidenceNode = graph.nodes.find((n) => n.kind === 'evidence' && n.hubId === 'hub-lynx');
  const categoryNode = graph.nodes.find((n) => n.kind === 'category' && n.hubId === 'hub-core');
  const auxNode = graph.nodes.find((n) => n.kind === 'aux');
  assert.ok(factNode && evidenceNode && categoryNode && auxNode);

  const lynxHub = KNOWLEDGE_HUBS.find((h) => h.id === 'hub-lynx');
  const coreHub = KNOWLEDGE_HUBS.find((h) => h.id === 'hub-core');
  const auxHub = KNOWLEDGE_HUBS.find((h) => h.id === auxNode.hubId);
  assert.ok(lynxHub && coreHub && auxHub);

  // TroubleReport fact node includes Markdown table, turtle block, and TR details
  const trFactNode =
    graph.nodes.find((n) => n.kind === 'fact' && n.hubId === 'hub-lynx' && n.classId === 'TroubleReport') ??
    factNode;
  const factDoc = buildNodeMarkdownDocument(
    trFactNode,
    lynxHub,
    ONTOLOGY_CLASSES,
    CROSS_HUB_EDGES,
    KNOWLEDGE_HUBS,
    TROUBLE_RECORDS
  );
  assert.equal(factDoc.nodeKindLabel, 'Fact Leaf');
  assert.ok(factDoc.markdown.includes('# '));
  assert.ok(factDoc.markdown.includes('| 項目 | 内容 |'));
  assert.ok(factDoc.markdown.includes('```turtle'));
  assert.ok(factDoc.markdown.includes('NNI-TR-006'));

  // Evidence leaf node
  const evDoc = buildNodeMarkdownDocument(
    evidenceNode,
    lynxHub,
    ONTOLOGY_CLASSES,
    CROSS_HUB_EDGES,
    KNOWLEDGE_HUBS,
    TROUBLE_RECORDS
  );
  assert.equal(evDoc.nodeKindLabel, 'Evidence Leaf');
  assert.ok(evDoc.markdown.includes('## 末端エビデンス / 計測ノード詳細'));

  // Category spoke node
  const catDoc = buildNodeMarkdownDocument(
    categoryNode,
    coreHub,
    ONTOLOGY_CLASSES,
    CROSS_HUB_EDGES,
    KNOWLEDGE_HUBS,
    TROUBLE_RECORDS
  );
  assert.equal(catDoc.nodeKindLabel, 'Category Node');
  assert.ok(catDoc.markdown.includes('## クラス定義・主要プロパティ'));

  // Aux satellite node
  const auxDoc = buildNodeMarkdownDocument(
    auxNode,
    auxHub,
    ONTOLOGY_CLASSES,
    CROSS_HUB_EDGES,
    KNOWLEDGE_HUBS,
    TROUBLE_RECORDS
  );
  assert.equal(auxDoc.nodeKindLabel, 'Ontology Satellite');
  assert.ok(auxDoc.markdown.includes('## このオントロジークラスの役割'));

  // GitHub URL helpers distinguish file blobs vs directory trees
  assert.ok(
    buildGitHubSourceUrl('designs/nkm-c02-arch/r00/README.md', coreHub.repoUrl).includes('/blob/main/')
  );
  assert.ok(
    buildGitHubSourceUrl('designs/nkm-c02-arch/r00', coreHub.repoUrl).includes('/tree/main/')
  );
  assert.ok(
    buildRawGitHubUrl('designs/nkm-c02-arch/r00/README.md')?.startsWith('https://raw.githubusercontent.com/')
  );
  assert.equal(buildRawGitHubUrl('designs/nkm-c02-arch/r00'), undefined);

  // Core logoUrl propagates into GraphNode3D and brand fact Markdown includes logo preview
  const coreGraphNode = graph.nodeMap.get('hub-core');
  const brandFactNode = graph.nodeMap.get('hub-core::fact::core-brand-1');
  assert.ok(coreGraphNode && brandFactNode);
  assert.equal(coreGraphNode.logoUrl, '/brand/cat-captain-mark.png');
  const brandDoc = buildNodeMarkdownDocument(
    brandFactNode,
    coreHub,
    ONTOLOGY_CLASSES,
    CROSS_HUB_EDGES,
    KNOWLEDGE_HUBS,
    TROUBLE_RECORDS
  );
  assert.ok(brandDoc.markdown.includes('![採用社名ロゴ「38 ねこ船長」](/brand/logo.png)'));
});

test('theme palettes provide 6 node colormaps and keep all dark-background nodes bright', () => {
  assert.equal(THEME_PALETTE_LIST.length, 6);
  const requestedSwatches = ['#1A1F4A', '#FF7069', '#FFF390', '#2BB0BF', '#B4E5F2'];

  const light = THEME_PALETTES['harbor-light'];
  const ocean = THEME_PALETTES['ocean-heatmap'];
  const vaporwave = THEME_PALETTES['vaporwave-palms'];
  const dark = THEME_PALETTES['harbor-dark'];
  const vaporNight = THEME_PALETTES['vaporwave-night'];
  const plum = THEME_PALETTES['alabaster-plum'];

  assert.deepEqual([...light.swatches], requestedSwatches);
  assert.deepEqual([...dark.swatches], requestedSwatches);
  assert.deepEqual([...vaporwave.swatches], ['#280D8C', '#3711BF', '#180E59', '#070C26', '#F24B4B']);
  assert.equal(light.bgHex, '#FAFAFB');
  assert.equal(ocean.bgHex, '#FAFAFB');
  assert.equal(vaporwave.bgHex, '#FAFAFB');
  assert.equal(dark.isDark, true);
  assert.equal(dark.bgHex, '#1A1F4A');
  assert.equal(vaporNight.isDark, true);
  assert.equal(vaporNight.bgHex, '#070C26');
  assert.equal(plum.bgHex, '#FAFAFB');

  const themedLightClasses = applyPaletteToClasses(ONTOLOGY_CLASSES, light);
  const lightClassHexes = new Set(themedLightClasses.map((c) => c.color));
  for (const hex of requestedSwatches) {
    assert.ok(lightClassHexes.has(hex), `Expected harbor-light classColors to include ${hex}`);
  }

  const harborGraph = buildSpatialKnowledgeGraph(
    KNOWLEDGE_HUBS,
    themedLightClasses,
    CROSS_HUB_EDGES,
    light
  );
  assert.equal(harborGraph.nodeMap.get('hub-school-bus')?.color, '#1A1F4A');
  assert.equal(harborGraph.nodeMap.get('hub-school-bus')?.monogramColor, '#FFFFFF');
  assert.equal(harborGraph.nodeMap.get('hub-arch')?.color, '#2BB0BF');
  assert.equal(harborGraph.nodeMap.get('hub-arch')?.monogramColor, '#1A1F4A');
  assert.equal(harborGraph.nodeMap.get('hub-lynx')?.color, '#FF7069');
  assert.equal(harborGraph.nodeMap.get('hub-solaris')?.color, '#B4E5F2');
  assert.equal(harborGraph.nodeMap.get('hub-solaris')?.strokeColor, '#1A1F4A');
  assert.equal(harborGraph.nodeMap.get('hub-supportless-principles')?.color, '#FFF390');
  assert.equal(harborGraph.nodeMap.get('hub-supportless-principles')?.strokeColor, '#1A1F4A');

  const vaporClasses = applyPaletteToClasses(ONTOLOGY_CLASSES, vaporwave);
  const vaporGraph = buildSpatialKnowledgeGraph(
    KNOWLEDGE_HUBS,
    vaporClasses,
    CROSS_HUB_EDGES,
    vaporwave
  );
  assert.equal(vaporGraph.nodeMap.get('hub-school-bus')?.color, '#070C26');
  assert.equal(vaporGraph.nodeMap.get('hub-solaris')?.color, '#180E59');
  assert.equal(vaporGraph.nodeMap.get('hub-arch')?.color, '#280D8C');
  assert.equal(vaporGraph.nodeMap.get('hub-porsche911')?.color, '#3711BF');
  assert.equal(vaporGraph.nodeMap.get('hub-lynx')?.color, '#F24B4B');

  // Every node in dark themes must have high luminance (>= 0.32) for clear visibility against dark backgrounds
  for (const darkPalette of [dark, vaporNight]) {
    const darkClasses = applyPaletteToClasses(ONTOLOGY_CLASSES, darkPalette);
    const darkGraph = buildSpatialKnowledgeGraph(
      KNOWLEDGE_HUBS,
      darkClasses,
      CROSS_HUB_EDGES,
      darkPalette
    );
    for (const node of darkGraph.nodes) {
      const lum = getRelativeLuminance(node.color);
      assert.ok(
        lum >= 0.32,
        `Node ${node.id} (${node.color}, lum=${lum.toFixed(3)}) in ${darkPalette.id} is too dark for dark background`
      );
    }
  }

  const cssVars = getPaletteCssVariables(dark);
  assert.equal(cssVars['--nni-bg'], '#1A1F4A');
  assert.equal(cssVars['--nni-coral'], '#FF7069');
  assert.equal(cssVars['--nni-sun'], '#FFF390');
  assert.equal(cssVars['--nni-accent'], '#2BB0BF');
  assert.equal(cssVars['--nni-sky'], '#B4E5F2');
});

test('ontology-x layout aligns only X by OntologyClassId and forms a wide 3D circular cone in free Y/Z from hub-core apex', () => {
  const palette = THEME_PALETTES['harbor-light'];
  const themedClasses = applyPaletteToClasses(ONTOLOGY_CLASSES, palette);
  const aligned = buildSpatialKnowledgeGraph(
    KNOWLEDGE_HUBS,
    themedClasses,
    CROSS_HUB_EDGES,
    palette,
    'ontology-x'
  );

  assert.equal(aligned.ontologyColumns.length, ONTOLOGY_CLASSES.length);
  for (let i = 1; i < aligned.ontologyColumns.length; i++) {
    assert.ok(aligned.ontologyColumns[i].x > aligned.ontologyColumns[i - 1].x);
  }

  const colXByClass = new Map(aligned.ontologyColumns.map((c) => [c.classId, c.x]));
  const coreNode = aligned.nodeMap.get('hub-core');
  assert.ok(coreNode);
  assert.equal(coreNode.y, 0);
  assert.equal(coreNode.z, 0);

  const nonCoreHubs = aligned.nodes.filter((n) => n.kind === 'hub' && n.id !== 'hub-core');
  assert.equal(nonCoreHubs.length, KNOWLEDGE_HUBS.length - 1);

  // Hub-core sits at apex (lowest X); other hubs sit at aligned hub plane with free non-flat 3D Y/Z
  const hubZs = new Set<number>();
  for (const h of nonCoreHubs) {
    assert.ok(h.x > coreNode.x);
    assert.ok(h.x < aligned.ontologyColumns[0].x);
    hubZs.add(Math.round(h.z));
  }
  assert.ok(hubZs.size >= 5, 'Expected non-core hubs to spread freely in 3D Z');

  // Every ontology-typed node aligns strictly on X while Y/Z spread freely inside the widening pyramid
  const radiiByClass = new Map<string, number[]>();
  const zValues: number[] = [];
  for (const node of aligned.nodes) {
    if (node.kind === 'hub' || !node.classId) continue;
    const expectedX = colXByClass.get(node.classId);
    assert.ok(expectedX !== undefined);
    assert.equal(node.x, expectedX, `Expected strict X alignment for ${node.id} (${node.classId})`);
    const list = radiiByClass.get(node.classId) ?? [];
    list.push(Math.hypot(node.y, node.z));
    radiiByClass.set(node.classId, list);
    zValues.push(node.z);
  }
  assert.ok(Math.max(...zValues) > 100 && Math.min(...zValues) < -100);

  // Average YZ cross-section radius widens from earliest column toward outermost column (triangular pyramid taper)
  const firstRadii = radiiByClass.get(aligned.ontologyColumns[0].classId) ?? [];
  const lastRadii = radiiByClass.get(aligned.ontologyColumns[aligned.ontologyColumns.length - 1].classId) ?? [];
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
  assert.ok(avg(lastRadii) > avg(firstRadii) * 1.4, 'Expected pyramid cross-section radius to expand with X');
});

