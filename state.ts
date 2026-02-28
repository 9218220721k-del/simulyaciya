// ============================================================
// МУТАБЕЛЬНОЕ СОСТОЯНИЕ (общее для всех модулей)
// ============================================================
import { SECTIONS, RISER_RADIATORS } from './constants';
import type { Thermal, Balance, ResistanceData, FlowData, RiserResults } from './types';

export let canvas: HTMLCanvasElement;
export let ctx: CanvasRenderingContext2D;

export function initCanvasContext(c: HTMLCanvasElement): void {
  canvas = c;
  const c2d = c.getContext('2d');
  if (!c2d) throw new Error('2d context not available');
  ctx = c2d;
}

export let mode: 'bad' | 'good' = 'bad';
export let animTime = 0;
export function setAnimTime(v: number): void { animTime = v; }
export const particles: { reset: () => void; update: () => void; draw: () => void }[] = [];

export let openFactors = Array(SECTIONS).fill(1.0) as number[];
export let bypassValveOpen = 100;
export let radWidth = 1240;
export let radHeight = 360;
export let radPosX = 300;
export let radPosY = 260;
export function setRadWidth(v: number): void { radWidth = Math.max(400, Math.min(1400, v)); }
export function setRadHeight(v: number): void { radHeight = Math.max(200, Math.min(600, v)); }
export function setRadPosX(v: number): void { radPosX = Math.max(285, Math.min(600, v)); }
export function setRadPosY(v: number): void { radPosY = Math.max(100, Math.min(400, v)); }
export let leftPipeExt = 0;
export function setLeftPipeExt(v: number): void { leftPipeExt = Math.max(0, Math.min(300, v)); }
export let canvasHeight = 850;
export function setCanvasHeight(v: number): void { canvasHeight = Math.max(700, Math.min(1050, v)); }
export let canvasWidth = 1600;
export function setCanvasWidth(v: number): void { canvasWidth = Math.max(1000, Math.min(2000, v)); }
export let sixRadCanvasWidth = 1600;
export let sixRadCanvasHeight = 850;
export let sixRadViewScale = 1.15;
export let sixRadValveRotationDegrees = 0;
export function setSixRadCanvasWidth(v: number): void { sixRadCanvasWidth = Math.max(1000, Math.min(2000, v)); }
export function setSixRadCanvasHeight(v: number): void { sixRadCanvasHeight = Math.max(600, Math.min(1200, v)); }
export function setSixRadViewScale(v: number): void { sixRadViewScale = Math.max(0.8, Math.min(1.5, v)); }
export function setSixRadValveRotationDegrees(v: number): void { sixRadValveRotationDegrees = ((v % 360) + 360) % 360; }

export const flowData: FlowData = {
  bypassFrac: 0.5,
  radFrac: 0.5,
  secFracs: Array(SECTIONS).fill(0.05),
  bypassLPM: 0,
  radLPM: 0,
};

export let secSurfaceTemps = Array(SECTIONS).fill(20) as number[];

export let counterflowEnabled = true;

export let collectorReturnTemps = Array(SECTIONS).fill(20) as number[];
export let counterflowReachSection = -1;

export let particleCountPerSegment = Array(SECTIONS).fill(0) as number[];
export let counterflowParticleCount = Array(SECTIONS).fill(0) as number[];
export let regularParticleCount = Array(SECTIONS).fill(0) as number[];

export const thermal: Thermal = {
  hA_section: 0,
  secPowers: Array(SECTIONS).fill(0),
  secRetTemps: Array(SECTIONS).fill(40),
  secFlowLPM: Array(SECTIONS).fill(0),
  secFlowKGS: Array(SECTIONS).fill(0),
  secEps: Array(SECTIONS).fill(0),
  secNTU: Array(SECTIONS).fill(0),
  totalPower: 0,
  avgRetTemp: 40,
  supplyT: 70,
  nomPower: 2000,
  outsideT: -10,
  Kroom: 20,
  Qint: 0,
  sysFlowLPM: 4,
  sysFlowKGS: 0.0667,
  heatLossDesign: 1000,
  designOutTemp: -30,
};

export const balance: Balance = {
  T_room_eq: 20,
  Q_rad: 0,
  Q_loss: 0,
  iterations: 0,
  converged: false,
  log: [],
  fullLog: [],
};

export const resistanceData: ResistanceData = {
  bypass_path: { h_total: 0, h_friction: 0, h_local: 0 },
  radiator_path: { h_total: 0, h_friction: 0, h_local: 0 },
  system_total: { h_initial: 0, h_current: 0, ratio: 1.0 },
  flow: 10,
};

export let frozenSections = Array(SECTIONS).fill(false) as boolean[];
export let systemFrozen = false;
export let freezeWarningShown = false;

export function setSystemFrozen(v: boolean): void { systemFrozen = v; }
export function setFreezeWarningShown(v: boolean): void { freezeWarningShown = v; }

export let riserBypassOpen = Array(RISER_RADIATORS).fill(true) as boolean[];
export let sixRadBypassOpenPct = [100, 100, 100, 100, 100, 100] as number[];
export let riserResults: RiserResults | null = null;

export interface SixRadParticle {
  pathT: number;
  speed: number;
}

export const sixRadParticles: SixRadParticle[] = [];

export function setSixRadBypassOpenPct(idx: number, pct: number): void {
  if (idx >= 0 && idx < 6) {
    sixRadBypassOpenPct[idx] = Math.max(0, Math.min(100, pct));
  }
}

export function setRiserResults(r: RiserResults | null): void {
  riserResults = r;
}

export let hydraulicsMenuVisible = false;
export let resistanceVisible = false;
export let riserVisible = false;
export let radiatorSimulationMenuVisible = false;
export let balanceVisible = false;
export let flowDynamicsVisible = false;
export let canvasVisible = false;
export let collectorVisible = false;
export let metricsVisible = false;
export let sectionsVisible = false;
export let analysisVisible = false;
export let sectionControlsVisible = false;
export let sizeControlsVisible = true;
export function setMode(v: 'bad' | 'good'): void { mode = v; }
export function setCounterflowEnabled(v: boolean): void { counterflowEnabled = v; }
export function setCounterflowReachSection(v: number): void { counterflowReachSection = v; }
export function setBypassValveOpen(v: number): void { bypassValveOpen = v; }
export function setHydraulicsMenuVisible(v: boolean): void { hydraulicsMenuVisible = v; }
export function setResistanceVisible(v: boolean): void { resistanceVisible = v; }
export function setRiserVisible(v: boolean): void { riserVisible = v; }
export function setRadiatorSimulationMenuVisible(v: boolean): void { radiatorSimulationMenuVisible = v; }
export function setBalanceVisible(v: boolean): void { balanceVisible = v; }
export function setFlowDynamicsVisible(v: boolean): void { flowDynamicsVisible = v; }
export function setCanvasVisible(v: boolean): void { canvasVisible = v; }
export function setCollectorVisible(v: boolean): void { collectorVisible = v; }
export function setMetricsVisible(v: boolean): void { metricsVisible = v; }
export function setSectionsVisible(v: boolean): void { sectionsVisible = v; }
export function setAnalysisVisible(v: boolean): void { analysisVisible = v; }
export function setSectionControlsVisible(v: boolean): void { sectionControlsVisible = v; }
export function setSizeControlsVisible(v: boolean): void { sizeControlsVisible = v; }