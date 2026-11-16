export type OntologyClassId =
  | 'IdentitySpec'
  | 'RevisionLineage'
  | 'DesignReviewGate'
  | 'TroubleReport'
  | 'ManufacturingPrinciple'
  | 'PrintTelemetry'
  | 'QualityTooling'
  | 'HumanEvidence';

export type OntologyPredicate =
  | 'derivedFrom'
  | 'mitigatedBy'
  | 'experiencedFailure'
  | 'enforcesPrinciple'
  | 'evaluatedBy'
  | 'verifiedWith'
  | 'reviewedByHuman'
  | 'benchmarkedAgainst';

export interface OntologyClassDef {
  id: OntologyClassId;
  uri: string;
  labelJa: string;
  labelEn: string;
  color: string;
  softBg: string;
  description: string;
  keyProperties: string[];
}

export interface OntologyPredicateDef {
  id: OntologyPredicate;
  uri: string;
  labelJa: string;
  labelEn: string;
  domain: string;
  range: string;
  description: string;
}

export interface KnowledgeFact {
  id: string;
  classId: OntologyClassId;
  title: string;
  predicateLabel: string;
  objectValue: string;
  detail: string;
  metricBadge?: string;
  sourcePath?: string;
  status?: 'verified' | 'warning' | 'failure' | 'pending' | 'rejected';
}

export type HubDomain =
  | 'organization'
  | 'vehicle'
  | 'marine'
  | 'knowledge'
  | 'governance';

export interface KnowledgeHub {
  id: string;
  code: string;
  nameJa: string;
  nameEn: string;
  monogram: string;
  logoUrl?: string;
  domain: HubDomain;
  summary: string;
  statusLabel: string;
  statusTone: 'nominal' | 'warning' | 'critical' | 'pending';
  revisionCount: number;
  folderCount: number;
  position3D: { x: number; y: number; z: number };
  repoUrl: string;
  agentPromptHint: string;
  facts: KnowledgeFact[];
}

export interface CrossHubEdge {
  id: string;
  sourceHubId: string;
  targetHubId: string;
  predicate: OntologyPredicate;
  labelJa: string;
  rationale: string;
}

export interface SemanticFactEdge {
  id: string;
  sourceHubId: string;
  sourceFactId: string;
  targetHubId: string;
  targetFactId: string;
  predicate: OntologyPredicate;
  labelJa: string;
}

export interface TroubleRecord {
  id: string;
  date: string;
  targetModel: string;
  hubId: string;
  phenomenon: string;
  rootCause: string;
  countermeasure: string;
  outcome: string;
  severity: 'critical' | 'warning' | 'resolved';
}

export interface GraphNode3D {
  id: string;
  kind: 'hub' | 'category' | 'fact' | 'evidence' | 'aux';
  hubId: string;
  classId?: OntologyClassId;
  factId?: string;
  label: string;
  sublabel?: string;
  monogram?: string;
  logoUrl?: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
  strokeColor?: string;
  monogramColor?: string;
}

export interface GraphEdge3D {
  id: string;
  kind: 'intra' | 'cross' | 'semantic';
  sourceId: string;
  targetId: string;
  hubId: string;
  targetHubId?: string;
  classId?: OntologyClassId;
  targetClassId?: OntologyClassId;
  predicate?: OntologyPredicate;
  label?: string;
}

export interface ProjectedNode {
  node: GraphNode3D;
  screenX: number;
  screenY: number;
  scale: number;
  projectedRadius: number;
  depthAlpha: number;
  depth: number;
}

export interface CameraState {
  x: number;
  y: number;
  z: number;
  distance: number;
  yaw: number;
  pitch: number;
  panOffsetX?: number;
}

export type GraphLayoutMode = 'radial' | 'ontology-x';

export interface OntologyColumnGuide {
  classId: OntologyClassId;
  labelJa: string;
  color: string;
  x: number;
}

