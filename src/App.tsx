import React, { useMemo, useState } from 'react';
import { CatalogListView } from './components/CatalogListView';
import { InspectorDrawer } from './components/InspectorDrawer';
import { OntologySchemaView } from './components/OntologySchemaView';
import { SpatialGraphCanvas } from './components/SpatialGraphCanvas';
import { type AppViewMode, TopBar } from './components/TopBar';
import {
  CROSS_HUB_EDGES,
  KNOWLEDGE_HUBS,
  ONTOLOGY_CLASSES,
  ONTOLOGY_PREDICATES,
  SEMANTIC_FACT_EDGES,
  TROUBLE_RECORDS,
} from './data/nekonekoOntology';
import type { OntologyClassId } from './types/knowledge';
import { serializeOntologyAsJsonLd } from './utils/graphLayout';
import {
  applyPaletteToClasses,
  getPaletteCssVariables,
  THEME_PALETTES,
  type ThemePaletteId,
} from './utils/themePalettes';

function readInitialHubId(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const hubParam = params.get('hub');
  if (!hubParam) return null;
  return KNOWLEDGE_HUBS.some((h) => h.id === hubParam) ? hubParam : null;
}

export default function App() {
  const [activeView, setActiveView] = useState<AppViewMode>('graph');
  const [selectedHubId, setSelectedHubId] = useState<string | null>(readInitialHubId);
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeClassFilter, setActiveClassFilter] = useState<OntologyClassId | 'all'>('all');
  const [exportCopied, setExportCopied] = useState<boolean>(false);
  const [coreLogoMode, setCoreLogoMode] = useState<'logo' | 'monogram'>('logo');
  const [customCoreLogoUrl, setCustomCoreLogoUrl] = useState<string | null>(null);
  const [paletteId, setPaletteId] = useState<ThemePaletteId>('harbor-light');

  const activePalette = THEME_PALETTES[paletteId];
  const paletteCssVars = useMemo(() => getPaletteCssVariables(activePalette), [activePalette]);
  const themedClasses = useMemo(
    () => applyPaletteToClasses(ONTOLOGY_CLASSES, activePalette),
    [activePalette]
  );

  const effectiveHubs = useMemo(
    () =>
      KNOWLEDGE_HUBS.map((hub) => {
        if (hub.id !== 'hub-core') return hub;
        return {
          ...hub,
          logoUrl: coreLogoMode === 'monogram' ? undefined : customCoreLogoUrl ?? hub.logoUrl,
        };
      }),
    [coreLogoMode, customCoreLogoUrl]
  );

  const coreBrandLogoUrl =
    coreLogoMode === 'monogram'
      ? undefined
      : customCoreLogoUrl ??
        KNOWLEDGE_HUBS.find((h) => h.id === 'hub-core')?.logoUrl ??
        '/brand/cat-captain-mark.png';

  const selectedHub = useMemo(
    () => effectiveHubs.find((h) => h.id === selectedHubId) ?? null,
    [effectiveHubs, selectedHubId]
  );

  const handleSelectHub = (
    hubId: string | null,
    factId: string | null = null,
    nodeId: string | null = null
  ) => {
    setSelectedHubId(hubId);
    setSelectedFactId(factId);
    setSelectedNodeId(nodeId);
  };

  const handleResetHome = () => {
    setActiveView('graph');
    setSelectedHubId(null);
    setSelectedFactId(null);
    setSelectedNodeId(null);
    setActiveClassFilter('all');
  };

  const handleExploreClassInGraph = (classId: OntologyClassId) => {
    setActiveClassFilter(classId);
    setSelectedHubId(null);
    setSelectedNodeId(null);
    setActiveView('graph');
  };

  const handleFocusHubInGraph = (hubId: string) => {
    setActiveClassFilter('all');
    setSelectedHubId(hubId);
    setSelectedFactId(null);
    setSelectedNodeId(null);
    setActiveView('graph');
  };

  const handleExportJsonLd = async () => {
    const jsonLd = serializeOntologyAsJsonLd(
      KNOWLEDGE_HUBS,
      ONTOLOGY_CLASSES,
      CROSS_HUB_EDGES
    );
    try {
      await navigator.clipboard.writeText(jsonLd);
    } catch {
      const blob = new Blob([jsonLd], { type: 'application/ld+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'nekoneko-industries-ontology.jsonld';
      a.click();
      URL.revokeObjectURL(url);
    }
    setExportCopied(true);
    window.setTimeout(() => setExportCopied(false), 2200);
  };

  return (
    <div
      style={paletteCssVars as React.CSSProperties}
      className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--nni-bg)] text-[var(--nni-text)]"
      data-app-view={activeView}
      data-selected-hub={selectedHubId ?? ''}
      data-selected-node={selectedNodeId ?? ''}
      data-theme={activePalette.id}
    >
      <TopBar
        activeView={activeView}
        brandLogoUrl={coreBrandLogoUrl}
        activePalette={activePalette}
        onSelectPalette={setPaletteId}
        onSelectView={setActiveView}
        onResetHome={handleResetHome}
        onExportJsonLd={handleExportJsonLd}
        exportCopied={exportCopied}
      />

      {/* Mobile compact secondary view bar */}
      <div className="flex md:hidden items-center justify-around border-b border-[var(--nni-border)] bg-[var(--nni-surface)] px-2 py-1.5 text-xs font-medium">
        {(
          [
            { id: 'graph', label: 'Spatial Graph' },
            { id: 'ontology', label: 'Ontology' },
            { id: 'catalog', label: 'Catalog & TRs' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveView(tab.id)}
            className={`rounded-md px-3 py-1.5 whitespace-nowrap ${
              activeView === tab.id
                ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                : 'text-[var(--nni-text-muted)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <main className="relative flex-1 overflow-hidden">
        {activeView === 'graph' && (
          <>
            <SpatialGraphCanvas
              hubs={effectiveHubs}
              classes={themedClasses}
              crossEdges={CROSS_HUB_EDGES}
              semanticEdges={SEMANTIC_FACT_EDGES}
              palette={activePalette}
              selectedHubId={selectedHubId}
              selectedFactId={selectedFactId}
              selectedNodeId={selectedNodeId}
              activeClassFilter={activeClassFilter}
              onChangeClassFilter={setActiveClassFilter}
              onSelectHub={handleSelectHub}
            />

            {selectedHub && (
              <InspectorDrawer
                hub={selectedHub}
                focusedFactId={selectedFactId}
                selectedNodeId={selectedNodeId}
                allHubs={effectiveHubs}
                classes={themedClasses}
                crossEdges={CROSS_HUB_EDGES}
                troubleRecords={TROUBLE_RECORDS}
                coreLogoMode={coreLogoMode}
                hasCustomCoreLogo={Boolean(customCoreLogoUrl)}
                onChangeCoreLogoMode={setCoreLogoMode}
                onUploadCoreLogo={(dataUrl) => {
                  setCustomCoreLogoUrl(dataUrl);
                  setCoreLogoMode('logo');
                }}
                onResetCoreLogo={() => {
                  setCustomCoreLogoUrl(null);
                  setCoreLogoMode('logo');
                }}
                onClose={() => handleSelectHub(null, null, null)}
                onJumpToHub={(id) => handleSelectHub(id, null, null)}
                onSelectNode={(nodeId, factId) =>
                  handleSelectHub(selectedHub.id, factId ?? null, nodeId)
                }
              />
            )}
          </>
        )}

        {activeView === 'ontology' && (
          <OntologySchemaView
            classes={themedClasses}
            predicates={ONTOLOGY_PREDICATES}
            hubs={effectiveHubs}
            onExploreClassInGraph={handleExploreClassInGraph}
          />
        )}

        {activeView === 'catalog' && (
          <CatalogListView
            hubs={effectiveHubs}
            classes={themedClasses}
            troubleRecords={TROUBLE_RECORDS}
            onFocusHubInGraph={handleFocusHubInGraph}
          />
        )}
      </main>
    </div>
  );
}
