import { REPO_BASE_URL } from '../data/nekonekoOntology';
import type {
  CrossHubEdge,
  GraphNode3D,
  KnowledgeFact,
  KnowledgeHub,
  OntologyClassDef,
  TroubleRecord,
} from '../types/knowledge';

export interface NodeMarkdownDocument {
  title: string;
  subtitle: string;
  nodeKindLabel: string;
  badgeColor: string;
  markdown: string;
  sourcePath?: string;
  githubUrl: string;
  rawFetchableUrl?: string;
}

const FILE_EXT_REGEX = /\.(md|py|json|ya?ml|txt|toml)$/i;

export function buildGitHubSourceUrl(sourcePath: string | undefined, fallbackRepoUrl: string): string {
  if (!sourcePath) return fallbackRepoUrl;
  const encoded = sourcePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const kind = FILE_EXT_REGEX.test(sourcePath) ? 'blob' : 'tree';
  return `${REPO_BASE_URL}/${kind}/main/${encoded}`;
}

export function buildRawGitHubUrl(sourcePath: string | undefined): string | undefined {
  if (!sourcePath || !FILE_EXT_REGEX.test(sourcePath)) return undefined;
  const encoded = sourcePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `https://raw.githubusercontent.com/Sunwood-ai-labs/NEKONEKO-INDUSTRIES/main/${encoded}`;
}

function findRelatedTroubleRecords(
  hub: KnowledgeHub,
  fact: KnowledgeFact,
  troubleRecords: TroubleRecord[]
): TroubleRecord[] {
  const haystack = `${fact.id} ${fact.title} ${fact.metricBadge ?? ''} ${fact.objectValue}`.toUpperCase();
  return troubleRecords.filter((tr) => {
    if (tr.hubId === hub.id && fact.classId === 'TroubleReport') {
      if (haystack.includes(tr.id.toUpperCase())) return true;
      if (tr.id === 'UNNUMBERED-V10' && haystack.includes('V10')) return true;
      if (tr.id === 'UNNUMBERED-ROVER' && haystack.includes('R11')) return true;
    }
    return haystack.includes(tr.id.toUpperCase());
  });
}

function statusToLabel(status: KnowledgeFact['status']): string {
  switch (status) {
    case 'verified':
      return '検証済み (Verified)';
    case 'warning':
      return '要注意 / 再構成対象 (Warning)';
    case 'failure':
      return '不具合発生記録 (Failure / TR)';
    case 'pending':
      return '確認待ち / 印刷保留 (Pending)';
    case 'rejected':
      return '不採用 / 却下 (Rejected)';
    default:
      return '記録済み';
  }
}

export function buildNodeMarkdownDocument(
  node: GraphNode3D,
  hub: KnowledgeHub,
  classes: OntologyClassDef[],
  crossEdges: CrossHubEdge[],
  allHubs: KnowledgeHub[],
  troubleRecords: TroubleRecord[]
): NodeMarkdownDocument {
  const classMap = new Map(classes.map((c) => [c.id, c]));
  const hubMap = new Map(allHubs.map((h) => [h.id, h]));
  const relatedEdges = crossEdges.filter(
    (e) => e.sourceHubId === hub.id || e.targetHubId === hub.id
  );

  // 1. Fact or Evidence leaf node
  if ((node.kind === 'fact' || node.kind === 'evidence') && node.factId) {
    const fact = hub.facts.find((f) => f.id === node.factId);
    if (fact) {
      const cls = classMap.get(fact.classId);
      const trMatches = findRelatedTroubleRecords(hub, fact, troubleRecords);
      const githubUrl = buildGitHubSourceUrl(fact.sourcePath, hub.repoUrl);
      const rawFetchableUrl = buildRawGitHubUrl(fact.sourcePath);
      const isEvidence = node.kind === 'evidence';

      const lines: string[] = [
        `# ${fact.title}`,
        '',
        `> **${cls?.labelJa ?? fact.classId}** (\`${cls?.uri ?? fact.classId}\`) · 所属ハブ: **${hub.nameJa}** (\`${hub.code}\`)`,
        '',
        ...(fact.id === 'core-brand-1'
          ? ['![採用社名ロゴ「38 ねこ船長」](/brand/logo.png)', '']
          : []),
        '## 要点・測定値',
        '',
        '| 項目 | 内容 |',
        '| --- | --- |',
        `| ハブ | ${hub.nameJa} (${hub.code}) |`,
        `| オントロジー分類 | ${cls?.labelJa ?? fact.classId} (\`${cls?.uri ?? fact.classId}\`) |`,
        `| 述語 (Predicate) | \`nni:${fact.predicateLabel}\` |`,
        `| 主値 / 結論 | ${fact.objectValue} |`,
        ...(fact.metricBadge ? [`| 主要メトリクス | \`${fact.metricBadge}\` |`] : []),
        `| ステータス | ${statusToLabel(fact.status)} |`,
        ...(fact.sourcePath ? [`| 出典パス | [${fact.sourcePath}](${githubUrl}) |`] : []),
        '',
        ...(isEvidence
          ? [
              '## 末端エビデンス / 計測ノード詳細',
              '',
              `この末端ノードは **${fact.title}** を裏付ける一次指標・参照証跡（\`${node.label}\`）です。`,
              '',
            ]
          : []),
        '## 詳細ナレッジ・設計文脈',
        '',
        fact.detail,
        '',
        '## オントロジー・トリプル表現',
        '',
        '```turtle',
        `nni:${hub.id}`,
        `  a nni:Domain_${hub.domain} ;`,
        `  nni:${fact.predicateLabel} "${fact.objectValue}" .`,
        '',
        `nni:${fact.id}`,
        `  a ${cls?.uri ?? `nni:${fact.classId}`} ;`,
        `  rdfs:label "${fact.title}"${fact.sourcePath ? ` ;\n  nni:sourcePath "${fact.sourcePath}"` : ''} .`,
        '```',
      ];

      if (trMatches.length > 0) {
        lines.push('', '## 関連不具合レポート (Trouble Report)');
        for (const tr of trMatches) {
          lines.push(
            '',
            `### ${tr.id} — ${tr.targetModel} (${tr.date})`,
            '',
            `- **現象**: ${tr.phenomenon}`,
            `- **根本原因**: ${tr.rootCause}`,
            `- **恒久対策**: ${tr.countermeasure}`,
            `- **結果**: ${tr.outcome}`
          );
        }
      }

      if (relatedEdges.length > 0) {
        lines.push('', '## ハブ間オントロジー連鎖');
        for (const edge of relatedEdges.slice(0, 5)) {
          const isOut = edge.sourceHubId === hub.id;
          const other = hubMap.get(isOut ? edge.targetHubId : edge.sourceHubId);
          lines.push(
            `- ${isOut ? '→' : '←'} \`nni:${edge.predicate}\` **${other?.nameJa ?? ''}**: ${edge.rationale}`
          );
        }
      }

      return {
        title: isEvidence ? `${node.label} — 末端証跡` : fact.title,
        subtitle: `${hub.nameJa} (${hub.code}) · ${cls?.labelJa ?? fact.classId}`,
        nodeKindLabel: isEvidence ? 'Evidence Leaf' : 'Fact Leaf',
        badgeColor: cls?.color ?? '#231024',
        markdown: lines.join('\n'),
        sourcePath: fact.sourcePath,
        githubUrl,
        rawFetchableUrl,
      };
    }
  }

  // 2. Category spoke node
  if (node.kind === 'category' && node.classId) {
    const cls = classMap.get(node.classId);
    const catFacts = hub.facts.filter((f) => f.classId === node.classId);
    const firstFileFact = catFacts.find((f) => f.sourcePath && FILE_EXT_REGEX.test(f.sourcePath));

    const lines: string[] = [
      `# ${hub.nameJa} × ${cls?.labelJa ?? node.classId}`,
      '',
      `> \`${cls?.uri ?? node.classId}\` — ${cls?.description ?? ''}`,
      '',
      '## クラス定義・主要プロパティ',
      '',
      `- **クラスラベル**: ${cls?.labelJa ?? ''} (${cls?.labelEn ?? ''})`,
      `- **収録ファクト数**: ${catFacts.length} 件`,
      `- **代表プロパティ**: ${(cls?.keyProperties ?? []).map((p) => `\`${p}\``).join(' / ')}`,
      '',
      `## ${hub.nameJa} 内の該当ナレッジ`,
    ];

    catFacts.forEach((f, idx) => {
      const fUrl = buildGitHubSourceUrl(f.sourcePath, hub.repoUrl);
      lines.push(
        '',
        `### ${idx + 1}. ${f.title}`,
        '',
        `- **値**: ${f.objectValue}`,
        ...(f.metricBadge ? [`- **指標**: \`${f.metricBadge}\``] : []),
        `- **詳細**: ${f.detail}`,
        ...(f.sourcePath ? [`- **出典**: [${f.sourcePath}](${fUrl})`] : [])
      );
    });

    return {
      title: `${cls?.labelJa ?? node.label} (${catFacts.length})`,
      subtitle: `${hub.nameJa} (${hub.code}) · Category Spoke`,
      nodeKindLabel: 'Category Node',
      badgeColor: cls?.color ?? '#231024',
      markdown: lines.join('\n'),
      sourcePath: firstFileFact?.sourcePath,
      githubUrl: buildGitHubSourceUrl(firstFileFact?.sourcePath, hub.repoUrl),
      rawFetchableUrl: buildRawGitHubUrl(firstFileFact?.sourcePath),
    };
  }

  // 3. Ambient ontology satellite node ('aux')
  const cls = node.classId ? classMap.get(node.classId) : undefined;
  const siblingHubsWithClass = allHubs.filter((h) =>
    h.facts.some((f) => f.classId === node.classId)
  );
  const lines: string[] = [
    `# ${cls?.labelJa ?? node.label} × ${hub.nameJa}`,
    '',
    `> オントロジー補助ノード (\`${cls?.uri ?? node.classId ?? 'nni:Node'}\`)`,
    '',
    '## このオントロジークラスの役割',
    '',
    cls?.description ?? 'ネコネコインダストリーの設計知識を構造化するオントロジークラスです。',
    '',
    `- **スキーマプロパティ**: ${(cls?.keyProperties ?? []).map((p) => `\`${p}\``).join(' / ')}`,
    `- **接続先ハブ (${hub.nameJa}) の概要**: ${hub.summary}`,
    '',
    '## このクラスの実データを保有する関連ハブ',
    '',
    ...siblingHubsWithClass.slice(0, 6).map((h) => {
      const count = h.facts.filter((f) => f.classId === node.classId).length;
      return `- **${h.nameJa}** (\`${h.code}\`) — ${count}件の${cls?.labelJa ?? ''}レコード`;
    }),
  ];

  return {
    title: `${cls?.labelJa ?? node.label} — オントロジー参照`,
    subtitle: `${hub.nameJa} (${hub.code}) · Auxiliary Satellite`,
    nodeKindLabel: 'Ontology Satellite',
    badgeColor: cls?.color ?? '#64748B',
    markdown: lines.join('\n'),
    githubUrl: hub.repoUrl,
  };
}
