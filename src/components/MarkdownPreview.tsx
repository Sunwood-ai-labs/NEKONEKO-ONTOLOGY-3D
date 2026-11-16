import React from 'react';

interface MarkdownPreviewProps {
  markdown: string;
}

function renderInline(text: string): React.ReactNode[] {
  // Tokenize **bold**, `code`, and [label](https://...) safely without HTML injection
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  const parts = text.split(pattern);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[var(--nni-text)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-[var(--nni-surface-soft)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--nni-text)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(part);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--nni-accent)] underline decoration-[var(--nni-border)] underline-offset-2 hover:decoration-[var(--nni-accent)]"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function isTableDivider(line: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ markdown }) => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <div key={`code-${i}`} className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950">
          {lang && (
            <div className="border-b border-zinc-800 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              {lang}
            </div>
          )}
          <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-zinc-100">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${i}`} className="border-[var(--nni-border)]" />);
      i += 1;
      continue;
    }

    // Image block ![alt](src)
    const imageMatch = /^!\[([^\]]*)\]\((\/[^)\s]+|https?:\/\/[^)\s]+)\)$/.exec(trimmed);
    if (imageMatch) {
      const [, alt, src] = imageMatch;
      blocks.push(
        <figure
          key={`img-${i}`}
          className="overflow-hidden rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface-soft)] p-3"
        >
          <div className="rounded-md bg-white p-2">
            <img
              src={src}
              alt={alt || 'NEKONEKO INDUSTRIES image'}
              className="mx-auto max-h-48 w-auto rounded object-contain"
            />
          </div>
          {alt && (
            <figcaption className="mt-2 text-center text-[11px] text-[var(--nni-text-muted)]">
              {alt}
            </figcaption>
          )}
        </figure>
      );
      i += 1;
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      if (level === 1) {
        blocks.push(
          <h1
            key={`h1-${i}`}
            className="font-display text-base font-bold tracking-tight text-[var(--nni-text)] leading-snug"
          >
            {renderInline(content)}
          </h1>
        );
      } else if (level === 2) {
        blocks.push(
          <h2
            key={`h2-${i}`}
            className="pt-1 text-xs font-bold tracking-wide text-[var(--nni-text)] border-b border-[var(--nni-border)] pb-1"
          >
            {renderInline(content)}
          </h2>
        );
      } else {
        blocks.push(
          <h3 key={`h3-${i}`} className="text-xs font-semibold text-[var(--nni-accent)] pt-0.5">
            {renderInline(content)}
          </h3>
        );
      }
      i += 1;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote
          key={`bq-${i}`}
          className="rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface-soft)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--nni-text)]"
        >
          {renderInline(quoteLines.join(' '))}
        </blockquote>
      );
      continue;
    }

    // Markdown Table
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      isTableDivider(lines[i + 1])
    ) {
      const headers = parseTableRow(lines[i]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        rows.push(parseTableRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div key={`tbl-${i}`} className="overflow-x-auto rounded-lg border border-[var(--nni-border)]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-[var(--nni-surface-soft)] text-[11px] font-semibold text-[var(--nni-text-muted)]">
              <tr>
                {headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="border-b border-[var(--nni-border)] px-3 py-2 whitespace-nowrap"
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nni-border)]/60 bg-[var(--nni-surface)]">
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 align-top text-[var(--nni-text)] leading-relaxed">
                      {renderInline(row[cIdx] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Unordered or ordered list
    if (/^([-*]|\d+\.)\s+/.test(trimmed)) {
      const isOrdered = /^\d+\.\s+/.test(trimmed);
      const items: string[] = [];
      while (i < lines.length && /^([-*]|\d+\.)\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^([-*]|\d+\.)\s+/, ''));
        i += 1;
      }
      const ListTag = isOrdered ? 'ol' : 'ul';
      blocks.push(
        <ListTag
          key={`list-${i}`}
          className={`space-y-1.5 pl-4 text-xs leading-relaxed text-[var(--nni-text)] ${
            isOrdered ? 'list-decimal' : 'list-disc'
          }`}
        >
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ListTag>
      );
      continue;
    }

    // Paragraph (collect consecutive plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !lines[i].trim().startsWith('```') &&
      !/^!\[[^\]]*\]\((\/[^)\s]+|https?:\/\/[^)\s]+)\)$/.test(lines[i].trim()) &&
      !/^([-*]|\d+\.)\s+/.test(lines[i].trim()) &&
      !(lines[i].trim().includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1]))
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={`p-${i}`} className="text-xs leading-relaxed text-[var(--nni-text)]">
        {renderInline(paraLines.join(' '))}
      </p>
    );
  }

  return (
    <article
      aria-label="Markdown Preview"
      className="space-y-3.5 text-[var(--nni-text)]"
    >
      {blocks}
    </article>
  );
};
