import { ArrowUpRight, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type { KnowledgeHub, OntologyClassDef, OntologyClassId, TroubleRecord } from '../types/knowledge';
import { filterHubs } from '../utils/graphLayout';

interface CatalogListViewProps {
  hubs: KnowledgeHub[];
  classes: OntologyClassDef[];
  troubleRecords: TroubleRecord[];
  onFocusHubInGraph: (hubId: string) => void;
}

export const CatalogListView: React.FC<CatalogListViewProps> = ({
  hubs,
  classes,
  troubleRecords,
  onFocusHubInGraph,
}) => {
  const [activeTab, setActiveTab] = useState<'hubs' | 'troubles'>('hubs');
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState<OntologyClassId | 'all'>('all');

  const filteredHubs = useMemo(
    () => filterHubs(hubs, query, classFilter),
    [hubs, query, classFilter]
  );

  const filteredTroubles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return troubleRecords;
    return troubleRecords.filter((tr) =>
      [tr.id, tr.targetModel, tr.phenomenon, tr.rootCause, tr.countermeasure, tr.outcome]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [query, troubleRecords]);

  return (
    <div className="h-full overflow-y-auto bg-[var(--nni-bg)] px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Title & Controls */}
        <div className="flex flex-col gap-4 border-b border-[var(--nni-border)] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs text-[var(--nni-text-muted)]">
              Repository Catalog &amp; Root-Cause Matrix
            </p>
            <h1 className="font-display mt-1.5 text-3xl font-extrabold tracking-tight text-[var(--nni-text)]">
              ナレッジハブ &amp; 不具合対策台帳
            </h1>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface)] p-1 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('hubs')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'hubs'
                  ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                  : 'text-[var(--nni-text-muted)] hover:text-[var(--nni-text)]'
              }`}
            >
              ナレッジハブ一覧 · {hubs.length}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('troubles')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'troubles'
                  ? 'bg-[var(--nni-primary)] text-[var(--nni-primary-fg)]'
                  : 'text-[var(--nni-text-muted)] hover:text-[var(--nni-text)]'
              }`}
            >
              NNI-TR 不具合一覧 · {troubleRecords.length}
            </button>
          </div>
        </div>

        {/* Search & Ontology Filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <label htmlFor="catalog-search" className="sr-only">
              モデル名・TR番号・キーワードで検索
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--nni-text-muted)]"
              aria-hidden="true"
            />
            <input
              id="catalog-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="モデル名、214層、TR番号、ブリッジ等で検索..."
              className="w-full rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface)] py-2 pl-9 pr-3 text-sm text-[var(--nni-text)] placeholder:text-[var(--nni-text-muted)]/70 focus:border-[var(--nni-accent)] focus:outline-none"
            />
          </div>

          {activeTab === 'hubs' && (
            <div className="flex items-center gap-2">
              <label htmlFor="ontology-class-select" className="text-xs font-medium text-[var(--nni-text-muted)]">
                オントロジー分類:
              </label>
              <select
                id="ontology-class-select"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value as OntologyClassId | 'all')}
                className="rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface)] px-3 py-2 text-xs font-medium text-[var(--nni-text)] focus:border-[var(--nni-accent)] focus:outline-none"
              >
                <option value="all">すべての分類</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.labelJa} ({c.labelEn})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Hubs Table */}
        {activeTab === 'hubs' ? (
          filteredHubs.length === 0 ? (
            <div className="rounded-xl border border-[var(--nni-border)] bg-[var(--nni-surface)] p-10 text-center">
              <p className="text-sm font-medium text-[var(--nni-text)]">
                一致するナレッジハブが見つかりませんでした。
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setClassFilter('all');
                }}
                className="mt-3 rounded-lg bg-[var(--nni-primary)] px-4 py-2 text-xs font-semibold text-[var(--nni-primary-fg)]"
              >
                検索条件をリセット
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--nni-border)] bg-[var(--nni-surface)]">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--nni-border)] bg-[var(--nni-surface-soft)] text-xs font-semibold text-[var(--nni-text-muted)]">
                    <th className="px-4 py-3">型式 / コード</th>
                    <th className="px-4 py-3">ナレッジハブ</th>
                    <th className="px-4 py-3">概要</th>
                    <th className="px-4 py-3 text-right">Revs</th>
                    <th className="px-4 py-3">状態</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--nni-border)]/60">
                  {filteredHubs.map((hub) => {
                    const glyph =
                      hub.statusTone === 'nominal'
                        ? '●'
                        : hub.statusTone === 'warning'
                        ? '▲'
                        : hub.statusTone === 'critical'
                        ? '✖'
                        : '○';
                    const toneColor =
                      hub.statusTone === 'nominal'
                        ? 'text-[var(--nni-accent)]'
                        : hub.statusTone === 'warning'
                        ? 'text-amber-500'
                        : hub.statusTone === 'critical'
                        ? 'text-[var(--nni-coral)]'
                        : 'text-[var(--nni-text-muted)]';
                    return (
                      <tr key={hub.id} className="hover:bg-[var(--nni-surface-soft)]/50">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--nni-accent)] whitespace-nowrap">
                          {hub.code}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-xs font-bold text-[var(--nni-text)]">{hub.nameJa}</div>
                          <div className="text-[11px] text-[var(--nni-text-muted)]">{hub.nameEn}</div>
                        </td>
                        <td className="px-4 py-3 text-xs leading-relaxed text-[var(--nni-text-muted)] max-w-md">
                          {hub.summary}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[var(--nni-text)] tabular-nums whitespace-nowrap">
                          {hub.revisionCount}
                        </td>
                        <td className={`px-4 py-3 text-xs font-medium whitespace-nowrap ${toneColor}`}>
                          {glyph} {hub.statusLabel}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onFocusHubInGraph(hub.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-[var(--nni-border)] bg-[var(--nni-surface-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--nni-text)] transition-colors hover:bg-[var(--nni-primary)] hover:text-[var(--nni-primary-fg)]"
                          >
                            <span>3Dで開く</span>
                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--nni-border)] bg-[var(--nni-surface)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--nni-border)] bg-[var(--nni-surface-soft)] text-xs font-semibold text-[var(--nni-text-muted)]">
                  <th className="px-4 py-3">TR番号</th>
                  <th className="px-4 py-3">発生日</th>
                  <th className="px-4 py-3">対象モデル</th>
                  <th className="px-4 py-3">根本原因 (Root Cause)</th>
                  <th className="px-4 py-3">対策・結果</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--nni-border)]/60">
                {filteredTroubles.map((tr) => {
                  const sevText =
                    tr.severity === 'critical'
                      ? '✖ 要実物確認'
                      : tr.severity === 'warning'
                      ? '▲ 再校正済/保留'
                      : '● 対策確立';
                  const sevColor =
                    tr.severity === 'critical'
                      ? 'text-[var(--nni-coral)]'
                      : tr.severity === 'warning'
                      ? 'text-amber-500'
                      : 'text-[var(--nni-accent)]';
                  return (
                    <tr key={tr.id} className="hover:bg-[var(--nni-surface-soft)]/50">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-[var(--nni-text)] whitespace-nowrap">
                        {tr.id}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--nni-text-muted)] tabular-nums whitespace-nowrap">
                        {tr.date}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-[var(--nni-text)]">
                        <div>{tr.targetModel}</div>
                        <div className="mt-1 text-[11px] text-[var(--nni-text-muted)]">{tr.phenomenon}</div>
                      </td>
                      <td className="px-4 py-3 text-xs leading-relaxed text-[var(--nni-text-muted)] max-w-xs">
                        {tr.rootCause}
                      </td>
                      <td className="px-4 py-3 text-xs leading-relaxed text-[var(--nni-text)] max-w-xs">
                        <div>{tr.countermeasure}</div>
                        <div className={`mt-1 text-[11px] font-semibold ${sevColor}`}>
                          {sevText} · {tr.outcome}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onFocusHubInGraph(tr.hubId)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--nni-border)] bg-[var(--nni-surface-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--nni-text)] transition-colors hover:bg-[var(--nni-primary)] hover:text-[var(--nni-primary-fg)]"
                        >
                          <span>ハブへ</span>
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
