import { Check, ChevronDown, Copy, Palette } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import {
  THEME_PALETTE_LIST,
  type ThemePalette,
  type ThemePaletteId,
} from '../utils/themePalettes';

export type AppViewMode = 'graph' | 'ontology' | 'catalog';

interface TopBarProps {
  activeView: AppViewMode;
  brandLogoUrl?: string;
  activePalette: ThemePalette;
  onSelectPalette: (paletteId: ThemePaletteId) => void;
  onSelectView: (view: AppViewMode) => void;
  onResetHome: () => void;
  onExportJsonLd: () => void;
  exportCopied: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  brandLogoUrl,
  activePalette,
  onSelectPalette,
  onSelectView,
  onResetHome,
  onExportJsonLd,
  exportCopied,
}) => {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!paletteOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEsc);
    };
  }, [paletteOpen]);

  const navItems: { id: AppViewMode; label: string }[] = [
    { id: 'graph', label: 'Spatial Graph' },
    { id: 'ontology', label: 'Ontology Schema' },
    { id: 'catalog', label: 'Catalog & TRs' },
  ];

  return (
    <header className="relative z-40 flex h-14 items-center justify-between gap-4 border-b border-[var(--nni-border)] bg-[var(--nni-surface)]/92 px-4 sm:px-6 backdrop-blur-md">
      <button
        type="button"
        onClick={onResetHome}
        className="inline-flex items-center gap-2 font-display text-sm font-extrabold tracking-tight text-[var(--nni-text)] transition-opacity hover:opacity-80 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--nni-primary)]"
      >
        {brandLogoUrl && (
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md p-0.5 ${
              activePalette.isDark
                ? 'bg-[#FFF390] ring-1 ring-[#FF7069]/60'
                : 'bg-[var(--nni-surface-soft)] ring-1 ring-[var(--nni-border)]'
            }`}
          >
            <img
              src={brandLogoUrl}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-contain"
            />
          </span>
        )}
        <span>NEKONEKO INDUSTRIES</span>
      </button>

      <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--nni-primary)] ${
                isActive
                  ? 'text-[var(--nni-text)] font-semibold'
                  : 'text-[var(--nni-text-muted)] hover:text-[var(--nni-text)]'
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[17px] h-[2px] bg-[var(--nni-primary)]"
                />
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Color Palette Switcher */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setPaletteOpen((v) => !v)}
            aria-expanded={paletteOpen}
            aria-haspopup="menu"
            aria-label="ノードカラーマップを切り替え"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--nni-border)] bg-[var(--nni-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--nni-text)] transition-colors hover:bg-[var(--nni-surface-soft)] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nni-primary)]"
          >
            <Palette className="h-3.5 w-3.5 text-[var(--nni-accent)]" aria-hidden="true" />
            <span className="hidden lg:inline">{activePalette.nameJa}</span>
            <span aria-hidden="true" className="flex items-center -space-x-1">
              {activePalette.swatches.map((hex) => (
                <span
                  key={hex}
                  className="h-3 w-3 rounded-full border border-black/15 shadow-xs"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--nni-text-muted)]" aria-hidden="true" />
          </button>

          {paletteOpen && (
            <div
              role="menu"
              aria-label="ノードカラーマップ選択"
              className="absolute right-0 mt-2 w-80 rounded-xl border border-[var(--nni-border)] bg-[var(--nni-surface)] p-2 shadow-xl"
            >
              <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[var(--nni-text-muted)]">
                ノードカラーマップ (Node Colormap)
              </div>
              <div className="space-y-1">
                {THEME_PALETTE_LIST.map((preset) => {
                  const selected = preset.id === activePalette.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => {
                        onSelectPalette(preset.id);
                        setPaletteOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        selected
                          ? 'bg-[var(--nni-surface-soft)] ring-1 ring-[var(--nni-accent)]'
                          : 'hover:bg-[var(--nni-surface-soft)]/70'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[var(--nni-text)] truncate">
                          {preset.nameJa}
                        </div>
                        <div className="font-mono text-[10px] text-[var(--nni-text-muted)] truncate">
                          {preset.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span aria-hidden="true" className="flex items-center gap-0.5">
                          {preset.swatches.map((hex) => (
                            <span
                              key={hex}
                              className="h-3.5 w-3.5 rounded-sm border border-black/15"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </span>
                        {selected && (
                          <Check className="h-3.5 w-3.5 text-[var(--nni-accent)] ml-1" aria-hidden="true" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onExportJsonLd}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--nni-primary)] px-3.5 py-2 text-xs font-semibold text-[var(--nni-primary-fg)] transition-colors hover:bg-[var(--nni-primary-hover)] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nni-primary)]"
        >
          {exportCopied ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>JSON-LD Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export JSON-LD</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
