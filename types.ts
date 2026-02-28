// ============================================================
// ТИПЫ И ИНТЕРФЕЙСЫ
// ============================================================

export interface PipeDataItem {
  dn: number;
  d_mm: number;
  name: string;
  L_m: number;
}

export interface ValveDataItem {
  zeta_open?: number;
  zeta_mid?: number;
  zeta_closed?: number;
  zeta?: number;
  name: string;
}

export interface HydroParams {
  rho: number;
  nu: number;
  g: number;
  lambda: number;
}

export interface Thermal {
  hA_section: number;
  secPowers: number[];
  secRetTemps: number[];
  secFlowLPM: number[];
  secFlowKGS: number[];
  secEps: number[];
  secNTU: number[];
  totalPower: number;
  avgRetTemp: number;
  supplyT: number;
  nomPower: number;
  outsideT: number;
  Kroom: number;
  Qint: number;
  sysFlowLPM: number;
  sysFlowKGS: number;
  heatLossDesign: number;
  designOutTemp: number;
}

export interface Balance {
  T_room_eq: number;
  Q_rad: number;
  Q_loss: number;
  iterations: number;
  converged: boolean;
  log: { iter: number; T_room: number; Q_rad: number; Q_loss: number; f: number }[];
  fullLog: { iter: number; T_room: number; Q_rad: number; Q_loss: number; f: number }[];
}

export interface PathData {
  h_total: number;
  h_friction: number;
  h_local: number;
  velocity?: number;
  flow?: number;
  Re?: number;
  lambda?: number;
}

export interface SystemTotalData {
  h_initial: number;
  h_current: number;
  ratio: number;
  main_before?: number;
  main_after?: number;
}

export interface ResistanceData {
  bypass_path: PathData;
  radiator_path: PathData;
  system_total: SystemTotalData;
  flow: number;
}

export interface FlowData {
  bypassFrac: number;
  radFrac: number;
  secFracs: number[];
  bypassLPM: number;
  radLPM: number;
}

export interface RiserFloor {
  index: number;
  floor: number;
  isSecondOnFloor: boolean;
  bypassOpen: boolean;
  Tin: number;
  Tout: number;
  Tout_rad: number;
  Q: number;
  eps: number;
  ntu: number;
  radFlowLPM: number;
  radFlowFraction: number;
  totalFlowLPM: number;
  deltaT: number;
  pipeLoss: number;
}

export interface RiserResults {
  floors: RiserFloor[];
  supplyTemp: number;
  returnTemp: number;
  totalDeltaT: number;
  baseFlowLPM: number;
  actualFlowLPM: number;
  flowDropPercent: number;
  closedCount: number;
  flowRatio: number;
}

export type ParticlePath = 'bypass' | 'rad';
export type ParticleState =
  | 'pipe_in'
  | 'enter'
  | 'byp_up'
  | 'to_rad'
  | 'fwd_coll'
  | 'to_sec_up'
  | 'to_sec'
  | 'rise'
  | 'top_coll'
  | 'top_coll_right'
  | 'exit'
  | 'pipe_out'
  | 'stall';
