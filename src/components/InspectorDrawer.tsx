import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CrossHubEdge,
  KnowledgeHub,
  OntologyClassDef,
  OntologyClassId,
  TroubleRecord,
} from '../types/knowledge';
import { buildSpatialKnowledgeGraph, serializeHubForAgent } from '../utils/graphLayout';
import { buildNodeMarkdownDocument } from '../utils/nodeMarkdown';
import { MarkdownPreview } from './MarkdownPreview';

interface InspectorDrawerProps {
  hub: KnowledgeHub;
  focusedFactId: string | null;
  selectedNodeId: string | null;
  allHubs: KnowledgeHub[];
  classes: OntologyClassDef[];
  crossEdges: CrossHubEdge[];
  troubleRecords: TroubleRecord[];
  coreLogoMode?: 'logo' | 'monogram';
  hasCustomCoreLogo?: boolean;
  onChangeCoreLogoMode?: (mode: 'logo' | 'monogram') => void;
  onUploadCoreLogo?: (dataUrl: string) => void;
  onResetCoreLogo?: () => void;
  onClose: () => void;
  onJumpToHub: (hubId: string) => void;
  onSelectNode: (nodeId: string | null, factId?: string | null) => void;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  hub,
  focusedFactId,
  selectedNodeId,
  allHubs,
  classes,
  crossEdges,
  troubleRecords,
  coreLogoMode = 'logo',
  hasCustomCoreLogo = false,
  onChangeCoreLogoMode,
  onUploadCoreLogo,
  onResetCoreLogo,
  onClose,
  onJumpToHub,
  onSelectNode,
}) => {
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedClassTab, setSelectedClassTab] = useState<OntologyClassId | 'all'>('all');
  const [copiedAgent, setCopiedAgent] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);
  const [mdViewMode, setMdViewMode] = useState<'preview' | 'raw'>('preview');
  const [remoteState, setRemoteState] = useState<{
    loading: boolean;
    content: string | null;
    error: string | null;
    useRemote: boolean;
  }>({
    loading: false,
    content: null,
    error: null,
    useRemote: false,
  });

  useEffect(() => {
    setSelectedClassTab('all');
  }, [hub.id]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const hubMap = useMemo(() => new Map(allHubs.map((h) => [h.id, h])), [allHubs]);

  const graph = useMemo(
    () => buildSpatialKnowledgeGraph(allHubs, classes, crossEdges),
    [allHubs, classes, crossEdges]
  );

  const activeLeafNode = useMemo(() => {
    const candidateId =
      selectedNodeId ?? (focusedFactId ? `${hub.id}::fact::${focusedFactId}` : null);
    if (!candidateId) return null;
    const node = graph.nodeMap.get(candidateId);
    if (!node || node.kind === 'hub') return null;
    return node;
  }, [focusedFactId, graph.nodeMap, hub.id, selectedNodeId]);

  const nodeDoc = useMemo(() => {
    if (!activeLeafNode) return null;
    return buildNodeMarkdownDocument(
      activeLeafNode,
      hub,
      classes,
      crossEdges,
      allHubs,
      troubleRecords
    );
  }, [activeLeafNode, allHubs, classes, crossEdges, hub, troubleRecords]);

  useEffect(() => {
    setMdViewMode('preview');
    setCopiedMd(false);
    setRemoteState({
      loading: false,
      content: null,
      error: null,
      useRemote: false,
    });
  }, [activeLeafNode?.id]);

  const classCounts = useMemo(() => {
    const counts = new Map<OntologyClassId, number>();
    for (const f of hub.facts) {
      counts.set(f.classId, (counts.get(f.classId) ?? 0) + 1);
    }
    return counts;
  }, [hub]);

  const visibleFacts = useMemo(() => {
    if (selectedClassTab === 'all') return hub.facts;
    return hub.facts.filter((f) => f.classId === selectedClassTab);
  }, [hub.facts, selectedClassTab]);

  const relatedEdges = useMemo(
    () => crossEdges.filter((e) => e.sourceHubId === hub.id || e.targetHubId === hub.id),
    [crossEdges, hub.id]
  );

  const statusGlyph =
    hub.statusTone === 'nominal'
      ? '●'
      : hub.statusTone === 'warning'
      ? '▲'
      : hub.statusTone === 'critical'
      ? '✖'
      : '○';

  const statusTextClass =
    hub.statusTone === 'nominal'
      ? 'text-[var(--nni-accent)]'
      : hub.statusTone === 'warning'
      ? 'text-amber-500'
      : hub.statusTone === 'critical'
      ? 'text-[var(--nni-coral)]'
      : 'text-[var(--nni-text-muted)]';

  const displayedMarkdown =
    remoteState.useRemote && remoteState.content
      ? remoteState.content
      : nodeDoc?.markdown ?? '';

  const handleCopyForAgent = async () => {
    const text = serializeHubForAgent(hub, crossEdges, allHubs);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback ignored in restricted frames; still confirm UI state
    }
    setCopiedAgent(true);
    window.setTimeout(() => setCopiedAgent(false), 2000);
  };

  const handleCopyNodeMarkdown = async () => {
    if (!displayedMarkdown) return;
    try {
      await navigator.clipboard.writeText(displayedMarkdown);
    } catch {
      // Fallback ignored in restricted frames; still confirm UI state
    }
    setCopiedMd(true);
    window.setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleToggleGitHubRaw = async () => {
    if (!nodeDoc?.rawFetchableUrl) return;
    if (remoteState.content) {
      setRemoteState((prev) => ({ ...prev, useRemote: !prev.useRemote, error: null }));
      return;
    }

    setRemoteState({ loading: true, content: null, error: null, useRemote: false });
    try {
      const res = await fetch(nodeDoc.rawFetchableUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      setRemoteState({
        loading: false,
        content: text,
        error: null,
        useRemote: true,
      });
    } catch {
      setRemoteState({
        loading: false,
        content: null,
        error: 'GitHub原本の取得に失敗しました（下の「GitHubを見る」リンクから直接開けます）。',
        useRemote: false,
      });
    }
  };

  return (
    <aside
      aria-label={`${hub.nameJa} ナレッジインスペクター`}
      className="absolute right-4 top-4 bottom-4 z-30 flex w-[430px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-[var(--nni-border)] bg-[var(--nni-surface)]/95 shadow-lg backdrop-blur-md"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-[var(--nni-border)] px-5 py-4">
        <div className="flex items-start gap-3.5 min-w-0">
          {hub.logoUrl ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--nni-border)] bg-[#FFFDF7] p-1.5">
              <img
                src={hub.logoUrl}
                alt={`${hub.nameJa} ロゴ`}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--nni-primary)] font-mono text-xs font-semibold text-[var(--nni-primary-fg)]"
            >
              {hub.monogram}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[var(--nni-text-muted)] font-mono tabular-nums">
              <span>{hub.code}</span>
              <span aria-hidden="true">·</span>
              <span className={`font-sans font-medium ${statusTextClass}`}>
                {statusGlyph} {hub.statusLabel}
              </span>
            </div>
            <h2 className="font-display mt-0.5 text-lg font-bold tracking-tight text-[var(--nni-text)] truncate">
              {nodeDoc ? nodeDoc.title : hub.nameJa}
            </h2>
            <p className="text-xs text-[var(--nni-text-muted)] truncate">
              {nodeDoc ? nodeDoc.subtitle : hub.nameEn}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="インスペクターを閉じる"
          className="rounded-lg p-2 text-[var(--nni-text-muted)] transition-colors hover:bg-[var(--nni-surface-soft)] hover:text-[var(--nni-text)] shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--nni-primary)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Scrollable Body */}
      {nodeDoc ? (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Navigation & Node Kind Strip */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onSelectNode(null, null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--nni-text)] transition-colors hover:bg-[var(--nni-surface-soft)] focus-visible:outline-2 focus-visible:outline-[var(--nni-primary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>ハブ概要へ戻る</span>
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--nni-border)] bg-[var(--nni-surface-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--nni-text)]">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: nodeDoc.badgeColor }}
              />
              <span>{nodeDoc.nodeKindLabel}</span>
            </span>
          </div>

          {/* Markdown Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface-soft)] p-1.5">
            <div
              role="group"
              aria-label="マークダウン表示切替"
              className="inline-flex items-center rounded-md bg-[var(--nni-surface)] p-0.5 border border-[var(--nni-border)]"
            >
              <button
                type="button"
                onClick={() => setMdViewMode('preview')}
                aria-pressed={mdViewMode === 'preview'}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  mdViewMode === 'preview'
                    ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                    : 'text-[var(--nni-text-muted)] hover:text-[var(--nni-text)]'
                }`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setMdViewMode('raw')}
                aria-pressed={mdViewMode === 'raw'}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  mdViewMode === 'raw'
                    ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                    : 'text-[var(--nni-text-muted)] hover:text-[var(--nni-text)]'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Markdown (.md)</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {nodeDoc.rawFetchableUrl && (
                <button
                  type="button"
                  onClick={handleToggleGitHubRaw}
                  disabled={remoteState.loading}
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    remoteState.useRemote
                      ? 'border-[var(--nni-primary)] bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                      : 'border-[var(--nni-border)] bg-[var(--nni-surface)] text-[var(--nni-text)] hover:bg-[var(--nni-surface-soft)]'
                  }`}
                >
                  {remoteState.loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  <span>{remoteState.useRemote ? '構造化MDへ' : 'GitHub原本を取得'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyNodeMarkdown}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--nni-border)] bg-[var(--nni-surface)] px-2.5 py-1 text-xs font-medium text-[var(--nni-text)] transition-colors hover:bg-[var(--nni-surface-soft)]"
              >
                {copiedMd ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[var(--nni-accent)]" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy MD</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {remoteState.error && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {remoteState.error}
            </div>
          )}

          {/* Markdown Body */}
          {mdViewMode === 'preview' ? (
            <div className="rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface)] p-4">
              <MarkdownPreview markdown={displayedMarkdown} />
            </div>
          ) : (
            <pre className="overflow-x-auto rounded-lg border border-[var(--nni-border)] bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-100 whitespace-pre-wrap break-words">
              <code>{displayedMarkdown}</code>
            </pre>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <p className="text-sm leading-relaxed text-[var(--nni-text)]">{hub.summary}</p>

          {/* Compact Telemetry Strip */}
          <div className="grid grid-cols-3 divide-x divide-[var(--nni-border)] rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface-soft)] py-2.5 text-center">
            <div>
              <div className="text-[11px] text-[var(--nni-text-muted)]">Folders</div>
              <div className="font-mono text-sm font-semibold text-[var(--nni-text)] tabular-nums">
                {hub.folderCount}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--nni-text-muted)]">Revisions</div>
              <div className="font-mono text-sm font-semibold text-[var(--nni-text)] tabular-nums">
                {hub.revisionCount}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-[var(--nni-text-muted)]">Ontology Facts</div>
              <div className="font-mono text-sm font-semibold text-[var(--nni-text)] tabular-nums">
                {hub.facts.length}
              </div>
            </div>
          </div>

          {hub.id === 'hub-core' && onChangeCoreLogoMode && (
            <div className="rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface-soft)] p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--nni-text-muted)]">コアシンボル表示</span>
                {hasCustomCoreLogo && onResetCoreLogo && (
                  <button
                    type="button"
                    onClick={onResetCoreLogo}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--nni-text-muted)] hover:text-[var(--nni-text)]"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    <span>公式ロゴへ戻す</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onChangeCoreLogoMode('logo')}
                  aria-pressed={coreLogoMode === 'logo'}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    coreLogoMode === 'logo'
                      ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                      : 'border border-[var(--nni-border)] bg-[var(--nni-surface)] text-[var(--nni-text)] hover:bg-[var(--nni-surface-soft)]'
                  }`}
                >
                  <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{hasCustomCoreLogo ? 'カスタムロゴ' : '公式ロゴ (38 ねこ船長)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeCoreLogoMode('monogram')}
                  aria-pressed={coreLogoMode === 'monogram'}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    coreLogoMode === 'monogram'
                      ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                      : 'border border-[var(--nni-border)] bg-[var(--nni-surface)] text-[var(--nni-text)] hover:bg-[var(--nni-surface-soft)]'
                  }`}
                >
                  モノグラム ({hub.monogram})
                </button>

                {onUploadCoreLogo && (
                  <>
                    <input
                      ref={logoFileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      aria-label="コアロゴ画像をアップロード"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            onUploadCoreLogo(reader.result);
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--nni-border)] bg-[var(--nni-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--nni-text)] transition-colors hover:bg-[var(--nni-surface-soft)]"
                    >
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>画像変更</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Ontology Category Filter Tabs */}
          <div>
            <h3 className="text-xs font-semibold text-[var(--nni-text-muted)] mb-2">
              オントロジー分類フィルタ
            </h3>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedClassTab('all')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  selectedClassTab === 'all'
                    ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                    : 'bg-[var(--nni-surface-soft)] text-[var(--nni-text)] hover:opacity-85'
                }`}
              >
                すべて · {hub.facts.length}
              </button>
              {classes.map((cls) => {
                const count = classCounts.get(cls.id) ?? 0;
                if (count === 0) return null;
                const active = selectedClassTab === cls.id;
                return (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => setSelectedClassTab(cls.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                        : 'bg-[var(--nni-surface-soft)] text-[var(--nni-text)] hover:opacity-85'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: active ? 'var(--nni-primary-fg)' : cls.color }}
                    />
                    <span>
                      {cls.labelJa} · {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fact Triples List (Clickable for Markdown Preview) */}
          <div className="space-y-3">
            {visibleFacts.map((fact) => {
              const cls = classMap.get(fact.classId);
              const isHighlighted = focusedFactId === fact.id;
              return (
                <button
                  key={fact.id}
                  type="button"
                  onClick={() => onSelectNode(`${hub.id}::fact::${fact.id}`, fact.id)}
                  className={`group w-full rounded-lg border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[var(--nni-primary)] ${
                    isHighlighted
                      ? 'border-[var(--nni-accent)] bg-[var(--nni-surface-soft)]'
                      : 'border-[var(--nni-border)] bg-[var(--nni-surface)] hover:border-[var(--nni-accent)] hover:bg-[var(--nni-surface-soft)]/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--nni-text-muted)]">
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: cls?.color ?? '#64748B' }}
                      />
                      <span className="font-medium text-[var(--nni-text)]">{cls?.labelJa}</span>
                      <span aria-hidden="true">/</span>
                      <span className="font-mono">{fact.predicateLabel}</span>
                    </div>
                    {fact.metricBadge && (
                      <span className="font-mono font-semibold text-[var(--nni-text)] tabular-nums shrink-0">
                        {fact.metricBadge}
                      </span>
                    )}
                  </div>

                  <h4 className="mt-1.5 text-sm font-semibold text-[var(--nni-text)] leading-snug">
                    {fact.title}
                  </h4>

                  <p className="mt-1 text-xs font-medium text-[var(--nni-text)] opacity-90">
                    {fact.objectValue}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--nni-text-muted)]">
                    {fact.detail}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-mono text-[var(--nni-text-muted)] opacity-80 truncate">
                      {fact.sourcePath ? `src: ${fact.sourcePath}` : `id: ${fact.id}`}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-[var(--nni-accent)] opacity-85 transition-opacity group-hover:opacity-100 shrink-0">
                      <FileText className="h-3 w-3" aria-hidden="true" />
                      <span>MDプレビュー</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Cross-Hub Semantic Relations */}
          {relatedEdges.length > 0 && (
            <div className="pt-2 border-t border-[var(--nni-border)]">
              <h3 className="text-xs font-semibold text-[var(--nni-text-muted)] mb-2.5">
                ハブ間オントロジー関係 ({relatedEdges.length})
              </h3>
              <div className="space-y-2">
                {relatedEdges.map((edge) => {
                  const isOutgoing = edge.sourceHubId === hub.id;
                  const otherHubId = isOutgoing ? edge.targetHubId : edge.sourceHubId;
                  const otherHub = hubMap.get(otherHubId);
                  if (!otherHub) return null;
                  return (
                    <button
                      key={edge.id}
                      type="button"
                      onClick={() => onJumpToHub(otherHub.id)}
                      className="w-full rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface-soft)]/70 p-3 text-left transition-colors hover:border-[var(--nni-accent)] hover:bg-[var(--nni-surface)] focus-visible:outline-2 focus-visible:outline-[var(--nni-primary)]"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono text-[var(--nni-text-muted)]">
                          {isOutgoing ? '→' : '←'} nni:{edge.predicate}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-[var(--nni-accent)] whitespace-nowrap">
                          <span>{otherHub.nameJa}</span>
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--nni-text-muted)] leading-relaxed">
                        {edge.rationale}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Agent Prompt Hint */}
          <div className="rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface-soft)] p-3.5">
            <div className="text-[11px] font-semibold text-[var(--nni-text-muted)]">
              AIエージェント向けクエリ例
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--nni-text)]">
              「{hub.agentPromptHint}」
            </p>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="border-t border-[var(--nni-border)] bg-[var(--nni-surface-soft)] px-5 py-3.5 space-y-2">
        <button
          type="button"
          onClick={handleCopyForAgent}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--nni-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--nni-primary-fg)] transition-colors hover:bg-[var(--nni-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nni-primary)]"
        >
          {copiedAgent ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>サブグラフ知識をコピーしました</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              <span>Copy Knowledge Subgraph for AI Agent</span>
            </>
          )}
        </button>

        <div className="flex items-center justify-between text-[11px] text-[var(--nni-text-muted)] pt-0.5">
          <span>出典: Sunwood-ai-labs/NEKONEKO-INDUSTRIES</span>
          <a
            href={nodeDoc ? nodeDoc.githubUrl : hub.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-[var(--nni-text)] hover:underline"
          >
            <span>GitHubを見る</span>
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </div>
    </aside>
  );
};
