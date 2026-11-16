import type {
  HubDomain,
  KnowledgeHub,
  OntologyClassDef,
  OntologyClassId,
} from '../types/knowledge';

export type ThemePaletteId =
  | 'harbor-light'
  | 'ocean-heatmap'
  | 'vaporwave-palms'
  | 'harbor-dark'
  | 'vaporwave-night'
  | 'alabaster-plum';

export interface ThemePalette {
  id: ThemePaletteId;
  nameJa: string;
  nameEn: string;
  description: string;
  isDark: boolean;
  swatches: readonly [string, string, string, string, string];
  bgHex: string;
  bgRgb: readonly [number, number, number];
  surfaceHex: string;
  surfaceElevatedHex: string;
  surfaceSoftHex: string;
  borderHex: string;
  textHex: string;
  textMutedHex: string;
  primaryHex: string;
  primaryHoverHex: string;
  primaryFgHex: string;
  accentHex: string;
  coralHex: string;
  sunHex: string;
  skyHex: string;
  hubFillHex: string;
  hubMonogramHex: string;
  hubDomainColors: Record<HubDomain, string>;
  hubColorsById?: Record<string, string>;
  hubLabelBgHex: string;
  hubLabelTextHex: string;
  sunCoreStops: readonly [string, string, string];
  sunRimColor: string;
  sunCoronaRgb: readonly [number, number, number];
  sunRayRgb: readonly [number, number, number];
  relevantEdgeRgb: readonly [number, number, number];
  rootPathEdgeRgb: readonly [number, number, number];
  rootPathLabelHex: string;
  crossEdgeRgb: readonly [number, number, number];
  intraEdgeRgb: readonly [number, number, number];
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  classColors: Record<OntologyClassId, string>;
}

export function getRelativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 0.5;
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(parseInt(clean.slice(0, 2), 16));
  const g = toLinear(parseInt(clean.slice(2, 4), 16));
  const b = toLinear(parseInt(clean.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLightColor(hex: string): boolean {
  return getRelativeLuminance(hex) > 0.55;
}

export function getReadableInkHex(bgHex: string, darkInk = '#1A1F4A', lightInk = '#FFFFFF'): string {
  // Choose the ink with higher contrast ratio against bgHex
  const bgLum = getRelativeLuminance(bgHex);
  const darkLum = getRelativeLuminance(darkInk);
  const lightLum = getRelativeLuminance(lightInk);
  const contrastDark = (Math.max(bgLum, darkLum) + 0.05) / (Math.min(bgLum, darkLum) + 0.05);
  const contrastLight = (Math.max(bgLum, lightLum) + 0.05) / (Math.min(bgLum, lightLum) + 0.05);
  return contrastDark >= contrastLight ? darkInk : lightInk;
}

export function resolveHubNodeColor(hub: KnowledgeHub, palette: ThemePalette): string {
  if (palette.hubColorsById && palette.hubColorsById[hub.id]) {
    return palette.hubColorsById[hub.id];
  }
  return palette.hubDomainColors[hub.domain] ?? palette.hubFillHex;
}

export function resolveNodeStrokeColor(
  fillHex: string,
  palette: ThemePalette,
  kind: 'hub' | 'category' | 'fact' | 'evidence' | 'aux'
): string | undefined {
  const lum = getRelativeLuminance(fillHex);
  if (palette.isDark) {
    if (kind === 'hub') return '#FFFFFF';
    if (kind === 'category') return '#E2F6FF';
    if (lum < 0.25) return '#B4E5F2';
    return undefined;
  }
  // Light canvas: ensure bright stops (#FFF390, #B4E5F2, #FFA59F) have crisp harbor navy rim
  if (lum > 0.52) return '#1A1F4A';
  if (kind === 'hub') return '#1A1F4A';
  return undefined;
}

const HARBOR_HUB_COLORS_BY_ID: Record<string, string> = {
  'hub-core': '#FFF390',
  'hub-school-bus': '#1A1F4A',
  'hub-dr-system': '#1A1F4A',
  'hub-codename-gov': '#1A1F4A',
  'hub-arch': '#2BB0BF',
  'hub-mint': '#2BB0BF',
  'hub-porsche911': '#2BB0BF',
  'hub-ben-marine': '#2BB0BF',
  'hub-pickup-bench': '#2BB0BF',
  'hub-lynx': '#FF7069',
  'hub-rover': '#FF7069',
  'hub-quality-tools': '#FF7069',
  'hub-solaris': '#B4E5F2',
  'hub-supportless-principles': '#FFF390',
};

const HARBOR_DARK_HUB_COLORS_BY_ID: Record<string, string> = {
  'hub-core': '#FFF390',
  // High-luminance bright stops on #1A1F4A dark canvas
  'hub-school-bus': '#B4E5F2',
  'hub-dr-system': '#B4E5F2',
  'hub-codename-gov': '#D4F3FC',
  'hub-arch': '#56E4F2',
  'hub-mint': '#56E4F2',
  'hub-porsche911': '#56E4F2',
  'hub-ben-marine': '#56E4F2',
  'hub-pickup-bench': '#7CE8F5',
  'hub-lynx': '#FF8C85',
  'hub-rover': '#FF8C85',
  'hub-quality-tools': '#FFA39E',
  'hub-solaris': '#FFF390',
  'hub-supportless-principles': '#FFF390',
};

const OCEAN_HEATMAP_HUB_COLORS_BY_ID: Record<string, string> = {
  'hub-core': '#FFF390',
  'hub-dr-system': '#1A1F4A',
  'hub-codename-gov': '#1A1F4A',
  'hub-school-bus': '#1E4E79',
  'hub-ben-marine': '#2BB0BF',
  'hub-porsche911': '#2BB0BF',
  'hub-arch': '#4EC6D4',
  'hub-pickup-bench': '#7BD9E6',
  'hub-solaris': '#B4E5F2',
  'hub-supportless-principles': '#FFF390',
  'hub-mint': '#FFB085',
  'hub-rover': '#FF8C7A',
  'hub-lynx': '#FF7069',
  'hub-quality-tools': '#FF7069',
};

const VAPORWAVE_HUB_COLORS_BY_ID: Record<string, string> = {
  'hub-core': '#F24B4B',
  'hub-school-bus': '#070C26',
  'hub-dr-system': '#070C26',
  'hub-codename-gov': '#180E59',
  'hub-solaris': '#180E59',
  'hub-supportless-principles': '#280D8C',
  'hub-arch': '#280D8C',
  'hub-ben-marine': '#280D8C',
  'hub-porsche911': '#3711BF',
  'hub-pickup-bench': '#3711BF',
  'hub-mint': '#3711BF',
  'hub-lynx': '#F24B4B',
  'hub-rover': '#F24B4B',
  'hub-quality-tools': '#F24B4B',
};

const VAPORWAVE_DARK_HUB_COLORS_BY_ID: Record<string, string> = {
  'hub-core': '#FFE885',
  // Luminous neon stops on #070C26 abyssal night canvas
  'hub-school-bus': '#C8BAFF',
  'hub-dr-system': '#C8BAFF',
  'hub-codename-gov': '#DFD4FF',
  'hub-solaris': '#7CE8FF',
  'hub-supportless-principles': '#FFE885',
  'hub-arch': '#A594FF',
  'hub-ben-marine': '#7CE8FF',
  'hub-porsche911': '#9B89FF',
  'hub-pickup-bench': '#B6A8FF',
  'hub-mint': '#8CF0E4',
  'hub-lynx': '#FF7878',
  'hub-rover': '#FF7878',
  'hub-quality-tools': '#FF9AA8',
};

export const THEME_PALETTES: Record<ThemePaletteId, ThemePalette> = {
  'harbor-light': {
    id: 'harbor-light',
    nameJa: 'ハーバー 5色マップ',
    nameEn: 'Harbor 5-Color Node Map',
    description: '1A1F4A · FF7069 · FFF390 · 2BB0BF · B4E5F2',
    isDark: false,
    swatches: ['#1A1F4A', '#FF7069', '#FFF390', '#2BB0BF', '#B4E5F2'],
    bgHex: '#FAFAFB',
    bgRgb: [250, 250, 251],
    surfaceHex: '#FFFFFF',
    surfaceElevatedHex: '#FFFFFF',
    surfaceSoftHex: '#EFF7FB',
    borderHex: '#D5E6F0',
    textHex: '#1A1F4A',
    textMutedHex: '#4B5A7A',
    primaryHex: '#1A1F4A',
    primaryHoverHex: '#28316E',
    primaryFgHex: '#FFFFFF',
    accentHex: '#2BB0BF',
    coralHex: '#FF7069',
    sunHex: '#FFF390',
    skyHex: '#B4E5F2',
    hubFillHex: '#1A1F4A',
    hubMonogramHex: '#FFFFFF',
    hubDomainColors: {
      organization: '#FFF390',
      vehicle: '#2BB0BF',
      marine: '#2BB0BF',
      knowledge: '#B4E5F2',
      governance: '#1A1F4A',
    },
    hubColorsById: HARBOR_HUB_COLORS_BY_ID,
    hubLabelBgHex: 'rgba(255, 255, 255, 0.94)',
    hubLabelTextHex: '#1A1F4A',
    sunCoreStops: ['#FFFFFF', '#FFF8BD', '#FFF390'],
    sunRimColor: 'rgba(255, 112, 105, 0.92)',
    sunCoronaRgb: [255, 112, 105],
    sunRayRgb: [43, 176, 191],
    relevantEdgeRgb: [255, 112, 105],
    rootPathEdgeRgb: [43, 176, 191],
    rootPathLabelHex: '#0E7490',
    crossEdgeRgb: [26, 31, 74],
    intraEdgeRgb: [108, 134, 158],
    tooltipBg: 'rgba(255, 255, 255, 0.96)',
    tooltipBorder: '#B4E5F2',
    tooltipText: '#1A1F4A',
    classColors: {
      IdentitySpec: '#1A1F4A',
      RevisionLineage: '#2BB0BF',
      DesignReviewGate: '#5AC8D6',
      TroubleReport: '#FF7069',
      ManufacturingPrinciple: '#FFF390',
      PrintTelemetry: '#B4E5F2',
      QualityTooling: '#344382',
      HumanEvidence: '#FFA59F',
    },
  },
  'harbor-dark': {
    id: 'harbor-dark',
    nameJa: 'ミッドナイト航海 (紺地)',
    nameEn: 'Midnight Voyage Dark',
    description: '1A1F4A Navy Canvas · 5-Color Node Map',
    isDark: true,
    swatches: ['#1A1F4A', '#FF7069', '#FFF390', '#2BB0BF', '#B4E5F2'],
    bgHex: '#1A1F4A',
    bgRgb: [26, 31, 74],
    surfaceHex: '#21285E',
    surfaceElevatedHex: '#262E6B',
    surfaceSoftHex: '#293275',
    borderHex: '#3B4691',
    textHex: '#F4FAFC',
    textMutedHex: '#B4E5F2',
    primaryHex: '#2BB0BF',
    primaryHoverHex: '#43C3D1',
    primaryFgHex: '#0E1233',
    accentHex: '#2BB0BF',
    coralHex: '#FF7069',
    sunHex: '#FFF390',
    skyHex: '#B4E5F2',
    hubFillHex: '#2BB0BF',
    hubMonogramHex: '#1A1F4A',
    hubDomainColors: {
      organization: '#FFF390',
      vehicle: '#56E4F2',
      marine: '#56E4F2',
      knowledge: '#FFF390',
      governance: '#B4E5F2',
    },
    hubColorsById: HARBOR_DARK_HUB_COLORS_BY_ID,
    hubLabelBgHex: 'rgba(33, 40, 94, 0.94)',
    hubLabelTextHex: '#F4FAFC',
    sunCoreStops: ['#FFFFFF', '#FFF8BD', '#FFF390'],
    sunRimColor: 'rgba(255, 243, 144, 0.96)',
    sunCoronaRgb: [255, 243, 144],
    sunRayRgb: [86, 228, 242],
    relevantEdgeRgb: [255, 140, 133],
    rootPathEdgeRgb: [255, 243, 144],
    rootPathLabelHex: '#FFF390',
    crossEdgeRgb: [180, 229, 242],
    intraEdgeRgb: [180, 229, 242],
    tooltipBg: 'rgba(33, 40, 94, 0.96)',
    tooltipBorder: '#56E4F2',
    tooltipText: '#F4FAFC',
    classColors: {
      IdentitySpec: '#D4F3FC',
      RevisionLineage: '#56E4F2',
      DesignReviewGate: '#94F0FC',
      TroubleReport: '#FF8C85',
      ManufacturingPrinciple: '#FFF390',
      PrintTelemetry: '#B4E5F2',
      QualityTooling: '#B2C0FF',
      HumanEvidence: '#FFC2BE',
    },
  },
  'ocean-heatmap': {
    id: 'ocean-heatmap',
    nameJa: 'オーシャン寒暖マップ',
    nameEn: 'Ocean-to-Coral Gradient Map',
    description: '1A1F4A → 2BB0BF → B4E5F2 → FFF390 → FF7069',
    isDark: false,
    swatches: ['#1A1F4A', '#2BB0BF', '#B4E5F2', '#FFF390', '#FF7069'],
    bgHex: '#FAFAFB',
    bgRgb: [250, 250, 251],
    surfaceHex: '#FFFFFF',
    surfaceElevatedHex: '#FFFFFF',
    surfaceSoftHex: '#F1F6F9',
    borderHex: '#DCE5EE',
    textHex: '#1A1F4A',
    textMutedHex: '#52607E',
    primaryHex: '#1A1F4A',
    primaryHoverHex: '#28316E',
    primaryFgHex: '#FFFFFF',
    accentHex: '#2BB0BF',
    coralHex: '#FF7069',
    sunHex: '#FFF390',
    skyHex: '#B4E5F2',
    hubFillHex: '#2BB0BF',
    hubMonogramHex: '#1A1F4A',
    hubDomainColors: {
      organization: '#FFF390',
      vehicle: '#2BB0BF',
      marine: '#B4E5F2',
      knowledge: '#FFF390',
      governance: '#1A1F4A',
    },
    hubColorsById: OCEAN_HEATMAP_HUB_COLORS_BY_ID,
    hubLabelBgHex: 'rgba(255, 255, 255, 0.94)',
    hubLabelTextHex: '#1A1F4A',
    sunCoreStops: ['#FFFFFF', '#FFF8BD', '#FFF390'],
    sunRimColor: 'rgba(255, 112, 105, 0.9)',
    sunCoronaRgb: [255, 112, 105],
    sunRayRgb: [43, 176, 191],
    relevantEdgeRgb: [255, 112, 105],
    rootPathEdgeRgb: [43, 176, 191],
    rootPathLabelHex: '#0E7490',
    crossEdgeRgb: [26, 31, 74],
    intraEdgeRgb: [115, 140, 165],
    tooltipBg: 'rgba(255, 255, 255, 0.96)',
    tooltipBorder: '#B4E5F2',
    tooltipText: '#1A1F4A',
    classColors: {
      IdentitySpec: '#1A1F4A',
      QualityTooling: '#1E5A8A',
      RevisionLineage: '#2BB0BF',
      PrintTelemetry: '#74D3E0',
      DesignReviewGate: '#B4E5F2',
      ManufacturingPrinciple: '#FFF390',
      HumanEvidence: '#FFA678',
      TroubleReport: '#FF7069',
    },
  },
  'vaporwave-palms': {
    id: 'vaporwave-palms',
    nameJa: 'ヴェイパーウェーブ・パームズ',
    nameEn: 'Vaporwave Palms',
    description: '280D8C · 3711BF · 180E59 · 070C26 · F24B4B',
    isDark: false,
    swatches: ['#280D8C', '#3711BF', '#180E59', '#070C26', '#F24B4B'],
    bgHex: '#FAFAFB',
    bgRgb: [250, 250, 251],
    surfaceHex: '#FFFFFF',
    surfaceElevatedHex: '#FFFFFF',
    surfaceSoftHex: '#F3F0FC',
    borderHex: '#DED8F2',
    textHex: '#070C26',
    textMutedHex: '#433F6B',
    primaryHex: '#280D8C',
    primaryHoverHex: '#3711BF',
    primaryFgHex: '#FFFFFF',
    accentHex: '#3711BF',
    coralHex: '#F24B4B',
    sunHex: '#FFE2E2',
    skyHex: '#E0D9FA',
    hubFillHex: '#280D8C',
    hubMonogramHex: '#FFFFFF',
    hubDomainColors: {
      organization: '#F24B4B',
      vehicle: '#3711BF',
      marine: '#280D8C',
      knowledge: '#180E59',
      governance: '#070C26',
    },
    hubColorsById: VAPORWAVE_HUB_COLORS_BY_ID,
    hubLabelBgHex: 'rgba(255, 255, 255, 0.94)',
    hubLabelTextHex: '#070C26',
    sunCoreStops: ['#FFFFFF', '#FFE8EA', '#FFC9CE'],
    sunRimColor: 'rgba(242, 75, 75, 0.92)',
    sunCoronaRgb: [242, 75, 75],
    sunRayRgb: [55, 17, 191],
    relevantEdgeRgb: [242, 75, 75],
    rootPathEdgeRgb: [55, 17, 191],
    rootPathLabelHex: '#280D8C',
    crossEdgeRgb: [24, 14, 89],
    intraEdgeRgb: [108, 102, 152],
    tooltipBg: 'rgba(255, 255, 255, 0.96)',
    tooltipBorder: '#D3C9F5',
    tooltipText: '#070C26',
    classColors: {
      IdentitySpec: '#070C26',
      QualityTooling: '#180E59',
      DesignReviewGate: '#280D8C',
      RevisionLineage: '#3711BF',
      PrintTelemetry: '#6546D9',
      ManufacturingPrinciple: '#9B5DE5',
      HumanEvidence: '#F78888',
      TroubleReport: '#F24B4B',
    },
  },
  'vaporwave-night': {
    id: 'vaporwave-night',
    nameJa: 'ヴェイパーウェーブ・ナイト (黒地)',
    nameEn: 'Vaporwave Night (Luminous)',
    description: '070C26 Night Canvas · Luminous Neon Nodes',
    isDark: true,
    swatches: ['#280D8C', '#3711BF', '#180E59', '#070C26', '#F24B4B'],
    bgHex: '#070C26',
    bgRgb: [7, 12, 38],
    surfaceHex: '#121647',
    surfaceElevatedHex: '#180E59',
    surfaceSoftHex: '#1F1469',
    borderHex: '#3B2B9E',
    textHex: '#F5F3FF',
    textMutedHex: '#C8BAFF',
    primaryHex: '#F24B4B',
    primaryHoverHex: '#FF6B6B',
    primaryFgHex: '#070C26',
    accentHex: '#9D8CFF',
    coralHex: '#FF7878',
    sunHex: '#FFE885',
    skyHex: '#C8BAFF',
    hubFillHex: '#A594FF',
    hubMonogramHex: '#070C26',
    hubDomainColors: {
      organization: '#FFE885',
      vehicle: '#A594FF',
      marine: '#7CE8FF',
      knowledge: '#FFE885',
      governance: '#C8BAFF',
    },
    hubColorsById: VAPORWAVE_DARK_HUB_COLORS_BY_ID,
    hubLabelBgHex: 'rgba(18, 22, 71, 0.94)',
    hubLabelTextHex: '#F5F3FF',
    sunCoreStops: ['#FFFFFF', '#FFF5C0', '#FFE885'],
    sunRimColor: 'rgba(255, 120, 120, 0.96)',
    sunCoronaRgb: [242, 75, 75],
    sunRayRgb: [157, 140, 255],
    relevantEdgeRgb: [255, 120, 120],
    rootPathEdgeRgb: [255, 232, 133],
    rootPathLabelHex: '#FFE885',
    crossEdgeRgb: [200, 186, 255],
    intraEdgeRgb: [182, 168, 255],
    tooltipBg: 'rgba(18, 22, 71, 0.97)',
    tooltipBorder: '#9D8CFF',
    tooltipText: '#F5F3FF',
    classColors: {
      IdentitySpec: '#DFD4FF',
      QualityTooling: '#C8BAFF',
      DesignReviewGate: '#A594FF',
      RevisionLineage: '#7CE8FF',
      PrintTelemetry: '#90F5E8',
      ManufacturingPrinciple: '#FFE885',
      HumanEvidence: '#FFA8CE',
      TroubleReport: '#FF7878',
    },
  },
  'alabaster-plum': {
    id: 'alabaster-plum',
    nameJa: 'クラシック (従来配色)',
    nameEn: 'Alabaster Plum',
    description: 'Classic gtmbrain.si · 231024 / 4F46E5',
    isDark: false,
    swatches: ['#231024', '#D97706', '#4F46E5', '#0D9488', '#E11D48'],
    bgHex: '#FAFAFB',
    bgRgb: [250, 250, 251],
    surfaceHex: '#FFFFFF',
    surfaceElevatedHex: '#FFFFFF',
    surfaceSoftHex: '#F4F4F5',
    borderHex: '#E4E4E7',
    textHex: '#18181B',
    textMutedHex: '#52525B',
    primaryHex: '#231024',
    primaryHoverHex: '#3A1B3C',
    primaryFgHex: '#FFFFFF',
    accentHex: '#4F46E5',
    coralHex: '#E11D48',
    sunHex: '#FDE68A',
    skyHex: '#E4E4E7',
    hubFillHex: '#231024',
    hubMonogramHex: '#FFFFFF',
    hubDomainColors: {
      organization: '#231024',
      vehicle: '#231024',
      marine: '#231024',
      knowledge: '#231024',
      governance: '#231024',
    },
    hubLabelBgHex: 'rgba(255, 255, 255, 0.9)',
    hubLabelTextHex: '#18181B',
    sunCoreStops: ['#FFFFFF', '#FFFBEB', '#FDE68A'],
    sunRimColor: 'rgba(217, 119, 6, 0.82)',
    sunCoronaRgb: [217, 119, 6],
    sunRayRgb: [217, 119, 6],
    relevantEdgeRgb: [35, 16, 36],
    rootPathEdgeRgb: [79, 70, 229],
    rootPathLabelHex: '#4338CA',
    crossEdgeRgb: [113, 113, 122],
    intraEdgeRgb: [161, 161, 170],
    tooltipBg: 'rgba(255, 255, 255, 0.96)',
    tooltipBorder: '#D4D4D8',
    tooltipText: '#18181B',
    classColors: {
      IdentitySpec: '#4F46E5',
      RevisionLineage: '#0D9488',
      DesignReviewGate: '#2563EB',
      TroubleReport: '#E11D48',
      ManufacturingPrinciple: '#D97706',
      PrintTelemetry: '#059669',
      QualityTooling: '#7C3AED',
      HumanEvidence: '#475569',
    },
  },
};

export const THEME_PALETTE_LIST: ThemePalette[] = [
  THEME_PALETTES['harbor-light'],
  THEME_PALETTES['ocean-heatmap'],
  THEME_PALETTES['vaporwave-palms'],
  THEME_PALETTES['harbor-dark'],
  THEME_PALETTES['vaporwave-night'],
  THEME_PALETTES['alabaster-plum'],
];

export function applyPaletteToClasses(
  classes: OntologyClassDef[],
  palette: ThemePalette
): OntologyClassDef[] {
  return classes.map((cls) => ({
    ...cls,
    color: palette.classColors[cls.id] ?? cls.color,
  }));
}

export function getPaletteCssVariables(palette: ThemePalette): Record<string, string> {
  return {
    '--nni-bg': palette.bgHex,
    '--nni-surface': palette.surfaceHex,
    '--nni-surface-elevated': palette.surfaceElevatedHex,
    '--nni-surface-soft': palette.surfaceSoftHex,
    '--nni-border': palette.borderHex,
    '--nni-text': palette.textHex,
    '--nni-text-muted': palette.textMutedHex,
    '--nni-primary': palette.primaryHex,
    '--nni-primary-hover': palette.primaryHoverHex,
    '--nni-primary-fg': palette.primaryFgHex,
    '--nni-accent': palette.accentHex,
    '--nni-coral': palette.coralHex,
    '--nni-sun': palette.sunHex,
    '--nni-sky': palette.skyHex,
  };
}
