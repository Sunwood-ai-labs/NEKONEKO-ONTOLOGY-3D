import { ArrowRight } from 'lucide-react';
import React from 'react';
import type {
  KnowledgeHub,
  OntologyClassDef,
  OntologyClassId,
  OntologyPredicateDef,
} from '../types/knowledge';

interface OntologySchemaViewProps {
  classes: OntologyClassDef[];
  predicates: OntologyPredicateDef[];
  hubs: KnowledgeHub[];
  onExploreClassInGraph: (classId: OntologyClassId) => void;
}

export const OntologySchemaView: React.FC<OntologySchemaViewProps> = ({
  classes,
  predicates,
  hubs,
  onExploreClassInGraph,
}) => {
  const countByClass = (classId: OntologyClassId) =>
    hubs.reduce((sum, h) => sum + h.facts.filter((f) => f.classId === classId).length, 0);

  return (
    <div className="h-full overflow-y-auto bg-[var(--nni-bg)] px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-12">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-[var(--nni-border)] pb-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-xs text-[var(--nni-text-muted)]">
              nni:OntologySchema · Formal Knowledge Representation
            </p>
            <h1 className="font-display mt-2 text-3xl font-extrabold tracking-tight text-[var(--nni-text)] [text-wrap:balance]">
              ネコインダストリー知識オントロジー体系
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--nni-text-muted)]">
              FreeCAD設計リビジョン、DR0〜DR4審査ゲート、実機造形トラブル (NNI-TR)、ベンチマークから抽出したサポートレス幾何原理を、8つのクラスと8つのセマンティック述語で構造化しています。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6 border-t border-[var(--nni-border)] pt-4 md:border-t-0 md:pt-0">
            <div>
              <div className="text-xs text-[var(--nni-text-muted)]">Classes</div>
              <div className="font-mono text-2xl font-bold text-[var(--nni-text)] tabular-nums">
                {classes.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--nni-text-muted)]">Predicates</div>
              <div className="font-mono text-2xl font-bold text-[var(--nni-text)] tabular-nums">
                {predicates.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--nni-text-muted)]">Knowledge Hubs</div>
              <div className="font-mono text-2xl font-bold text-[var(--nni-text)] tabular-nums">
                {hubs.length}
              </div>
            </div>
          </div>
        </div>

        {/* Classes Grid */}
        <section aria-labelledby="ontology-classes-heading">
          <div className="mb-5 flex items-baseline justify-between">
            <h2
              id="ontology-classes-heading"
              className="font-display text-xl font-bold text-[var(--nni-text)]"
            >
              01. オントロジークラス定義 (Node Types)
            </h2>
            <span className="text-xs text-[var(--nni-text-muted)]">
              クリックすると3Dグラフ上で該当クラスをハイライト表示します
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {classes.map((cls) => {
              const count = countByClass(cls.id);
              return (
                <div
                  key={cls.id}
                  className="flex flex-col justify-between rounded-xl border border-[var(--nni-border)] bg-[var(--nni-surface)] p-5 transition-colors hover:border-[var(--nni-accent)]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-[var(--nni-text-muted)]">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/15"
                          style={{ backgroundColor: cls.color }}
                        />
                        <span className="truncate">{cls.uri}</span>
                      </span>
                      <span className="font-mono font-semibold text-[var(--nni-text)] tabular-nums whitespace-nowrap shrink-0">
                        {count} facts
                      </span>
                    </div>

                    <h3 className="font-display mt-2.5 text-base font-bold text-[var(--nni-text)]">
                      {cls.labelJa}
                    </h3>
                    <p className="text-xs text-[var(--nni-text-muted)]">{cls.labelEn}</p>
                    <p className="mt-2.5 text-xs leading-relaxed text-[var(--nni-text-muted)]">
                      {cls.description}
                    </p>

                    <div className="mt-3 pt-3 border-t border-[var(--nni-border)]/70">
                      <div className="text-[11px] font-medium text-[var(--nni-text-muted)] mb-1">
                        主要プロパティ
                      </div>
                      <ul className="space-y-0.5 font-mono text-[11px] text-[var(--nni-text)]">
                        {cls.keyProperties.map((prop) => (
                          <li key={prop}>{prop}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onExploreClassInGraph(cls.id)}
                    className="mt-4 inline-flex items-center justify-between rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--nni-text)] transition-colors hover:bg-[var(--nni-primary)] hover:text-[var(--nni-primary-fg)]"
                  >
                    <span>グラフでハイライト</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Predicates Table */}
        <section aria-labelledby="ontology-predicates-heading">
          <h2
            id="ontology-predicates-heading"
            className="font-display mb-4 text-xl font-bold text-[var(--nni-text)]"
          >
            02. セマンティック述語・関係 (Object Properties)
          </h2>

          <div className="overflow-x-auto rounded-xl border border-[var(--nni-border)] bg-[var(--nni-surface)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--nni-border)] bg-[var(--nni-surface-soft)] text-xs font-semibold text-[var(--nni-text-muted)]">
                  <th className="px-4 py-3">述語 URI</th>
                  <th className="px-4 py-3">日本語関係名</th>
                  <th className="px-4 py-3">Domain → Range</th>
                  <th className="px-4 py-3">意味と品質ガバナンス上の役割</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--nni-border)]/60">
                {predicates.map((pred) => (
                  <tr key={pred.id} className="hover:bg-[var(--nni-surface-soft)]/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--nni-accent)] whitespace-nowrap">
                      {pred.uri}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-[var(--nni-text)] whitespace-nowrap">
                      {pred.labelJa}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--nni-text-muted)] whitespace-nowrap">
                      {pred.domain} → {pred.range}
                    </td>
                    <td className="px-4 py-3 text-xs leading-relaxed text-[var(--nni-text-muted)]">
                      {pred.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
