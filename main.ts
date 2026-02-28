// ============================================================
// MAIN — gameLoop, init, обработчики слайдеров/кнопок
// ============================================================
import {
  SECTIONS,
  L,
  PIPE_DATA,
  VALVE_DATA,
  HYDRO,
  STORAGE_KEY,
  NOM,
  C_WATER,
  ALPHA_BAD,
  T_INDOOR_DESIGN,
  RISER_RADIATORS,
  clamp,
  tCSS,
  tempToColor,
  COLD_THRESHOLD,
  particleParams,
  particleStats,
  updateRadiatorLayout,
} from './constants';
import * as st from './state';
import { Particle } from './particle';
import { findEquilibriumTroom } from './physics';
import {
  calcFlows,
  calcRiser,
  riserOpenAll,
  riserCloseAll,
  riserCloseOne,
  toggleRiserBypass,
} from './hydraulics';
import { render, updateGradientBar } from './draw';

function gv(id: string, def: number): number {
  const el = document.getElementById(id) as HTMLInputElement | null;
  const v = Number(el?.value ?? '');
  return Number.isFinite(v) ? v : def;
}

const DEBOUNCE_MS = 150;

let recalcDebounceTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedRecalc(): void {
  if (recalcDebounceTimer) clearTimeout(recalcDebounceTimer);
  recalcDebounceTimer = setTimeout(() => {
    recalcDebounceTimer = null;
    recalcAll();
  }, DEBOUNCE_MS);
}

function syncCanvasBelowSize(): void {
  const canvasBelow = document.getElementById('simCanvasBelow') as HTMLCanvasElement | null;
  if (canvasBelow) {
    canvasBelow.width = st.sixRadCanvasWidth;
    canvasBelow.height = st.sixRadCanvasHeight;
  }
}

function saveSettings(): void {
  try {
    const s = {
      nominalPower: (document.getElementById('nominalPower') as HTMLInputElement)?.value,
      heatLossDesign: (document.getElementById('heatLossDesign') as HTMLInputElement)?.value,
      designOutTemp: (document.getElementById('designOutTemp') as HTMLInputElement)?.value,
      desiredRoomTemp: (document.getElementById('desiredRoomTemp') as HTMLInputElement)?.value,
      supplyTemp: (document.getElementById('supplyTemp') as HTMLInputElement)?.value,
      systemFlow: (document.getElementById('systemFlow') as HTMLInputElement)?.value,
      outsideTemp: (document.getElementById('outsideTemp') as HTMLInputElement)?.value,
      internalGains: (document.getElementById('internalGains') as HTMLInputElement)?.value,
      bypassValve: (document.getElementById('bypassValve') as HTMLInputElement)?.value,
      heatLossCoeff: (document.getElementById('heat-loss-coeff') as HTMLInputElement)?.value,
      particlesPerLiter: (document.getElementById('particles-per-liter') as HTMLInputElement)?.value,
      gravityForce: (document.getElementById('gravity-force') as HTMLInputElement)?.value,
      mainPipeD: (document.getElementById('main-pipe-d') as HTMLInputElement)?.value,
      mainPipeL: (document.getElementById('main-pipe-L') as HTMLInputElement)?.value,
      bypassPipeD: (document.getElementById('bypass-pipe-d') as HTMLInputElement)?.value,
      bypassPipeL: (document.getElementById('bypass-pipe-L') as HTMLInputElement)?.value,
      radPipeD: (document.getElementById('rad-pipe-d') as HTMLInputElement)?.value,
      radPipeL: (document.getElementById('rad-pipe-L') as HTMLInputElement)?.value,
      valve34Zeta: (document.getElementById('valve-34-zeta') as HTMLInputElement)?.value,
      valve12Zeta: (document.getElementById('valve-12-zeta') as HTMLInputElement)?.value,
      teeZeta: (document.getElementById('tee-zeta') as HTMLInputElement)?.value,
      radiatorZeta: (document.getElementById('radiator-zeta') as HTMLInputElement)?.value,
      waterRho: (document.getElementById('water-rho') as HTMLInputElement)?.value,
      waterNu: (document.getElementById('water-nu') as HTMLInputElement)?.value,
      waterG: (document.getElementById('water-g') as HTMLInputElement)?.value,
      riserSupplyTemp: (document.getElementById('riser-supply-temp') as HTMLInputElement)?.value,
      riserFlow: (document.getElementById('riser-flow') as HTMLInputElement)?.value,
      riserRadPower: (document.getElementById('riser-rad-power') as HTMLInputElement)?.value,
      riserRoomTemp: (document.getElementById('riser-room-temp') as HTMLInputElement)?.value,
      riserPipeD: (document.getElementById('riser-pipe-d') as HTMLInputElement)?.value,
      riserBypassD: (document.getElementById('riser-bypass-d') as HTMLInputElement)?.value,
      mode: st.mode,
      counterflowEnabled: st.counterflowEnabled,
      openFactors: [...st.openFactors],
      riserBypassOpen: [...st.riserBypassOpen],
      hydraulicsMenuVisible: st.hydraulicsMenuVisible,
      resistanceVisible: st.resistanceVisible,
      riserVisible: st.riserVisible,
      radiatorSimulationMenuVisible: st.radiatorSimulationMenuVisible,
      balanceVisible: st.balanceVisible,
      flowDynamicsVisible: st.flowDynamicsVisible,
      canvasVisible: st.canvasVisible,
      radWidth: st.radWidth,
      radHeight: st.radHeight,
      radPosX: st.radPosX,
      radPosY: st.radPosY,
      leftPipeExt: st.leftPipeExt,
      canvasHeight: st.canvasHeight,
      canvasWidth: st.canvasWidth,
      sixRadCanvasWidth: st.sixRadCanvasWidth,
      sixRadCanvasHeight: st.sixRadCanvasHeight,
      sixRadViewScale: st.sixRadViewScale,
      sixRadValveRotationDegrees: st.sixRadValveRotationDegrees,
      sixRadBypassOpenPct: [...st.sixRadBypassOpenPct],
      collectorVisible: st.collectorVisible,
      metricsVisible: st.metricsVisible,
      sectionsVisible: st.sectionsVisible,
      analysisVisible: st.analysisVisible,
      sectionControlsVisible: st.sectionControlsVisible,
      sizeControlsVisible: st.sizeControlsVisible,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (_e) {}
}

function loadSettings(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    const set = (id: string, v: string | null) => {
      const el = document.getElementById(id) as HTMLInputElement;
      if (el && v != null) el.value = v;
    };
    set('nominalPower', s.nominalPower);
    set('heatLossDesign', s.heatLossDesign);
    set('designOutTemp', s.designOutTemp);
    set('desiredRoomTemp', s.desiredRoomTemp ?? '20');
    set('supplyTemp', s.supplyTemp);
    set('systemFlow', s.systemFlow);
    set('outsideTemp', s.outsideTemp);
    set('internalGains', s.internalGains);
    set('bypassValve', s.bypassValve);
    set('heat-loss-coeff', s.heatLossCoeff);
    set('particles-per-liter', s.particlesPerLiter);
    set('gravity-force', s.gravityForce);
    set('main-pipe-d', s.mainPipeD);
    set('main-pipe-L', s.mainPipeL);
    set('bypass-pipe-d', s.bypassPipeD);
    set('bypass-pipe-L', s.bypassPipeL);
    set('rad-pipe-d', s.radPipeD);
    set('rad-pipe-L', s.radPipeL);
    set('valve-34-zeta', s.valve34Zeta);
    set('valve-12-zeta', s.valve12Zeta);
    set('tee-zeta', s.teeZeta);
    set('radiator-zeta', s.radiatorZeta);
    set('water-rho', s.waterRho);
    set('water-nu', s.waterNu);
    set('water-g', s.waterG);
    set('riser-supply-temp', s.riserSupplyTemp);
    set('riser-flow', s.riserFlow);
    set('riser-rad-power', s.riserRadPower);
    set('riser-room-temp', s.riserRoomTemp);
    set('riser-pipe-d', s.riserPipeD);
    set('riser-bypass-d', s.riserBypassD);
    if (s.mode) st.setMode(s.mode);
    if (typeof s.counterflowEnabled === 'boolean') st.setCounterflowEnabled(s.counterflowEnabled);
    if (Array.isArray(s.openFactors) && s.openFactors.length === SECTIONS) {
      for (let i = 0; i < SECTIONS; i++) st.openFactors[i] = s.openFactors[i];
      for (let i = 0; i < SECTIONS; i++) {
        const sl = document.getElementById(`slider-${i}`) as HTMLInputElement;
        const vd = document.getElementById(`value-${i}`);
        if (sl) sl.value = String(Math.round(st.openFactors[i] * 100));
        if (vd) vd.textContent = `${Math.round(st.openFactors[i] * 100)}%`;
      }
    }
    if (Array.isArray(s.riserBypassOpen) && s.riserBypassOpen.length === RISER_RADIATORS) {
      for (let i = 0; i < RISER_RADIATORS; i++) st.riserBypassOpen[i] = s.riserBypassOpen[i];
    }
    if (Array.isArray(s.sixRadBypassOpenPct) && s.sixRadBypassOpenPct.length === 6) {
      for (let i = 0; i < 6; i++) st.setSixRadBypassOpenPct(i, s.sixRadBypassOpenPct[i]);
      for (let i = 0; i < 6; i++) {
        const sl = document.getElementById(`six-rad-bypass-${i}`) as HTMLInputElement;
        const vd = document.getElementById(`six-rad-bypass-val-${i}`);
        if (sl) sl.value = String(Math.round(st.sixRadBypassOpenPct[i]));
        if (vd) vd.textContent = `${Math.round(st.sixRadBypassOpenPct[i])}%`;
      }
    }
    if (s.hydraulicsMenuVisible) {
      st.setHydraulicsMenuVisible(true);
      const menu = document.getElementById('hydraulics-submenu');
      const btn = document.getElementById('btn-hydraulics-menu');
      if (menu) menu.style.display = 'flex';
      if (btn) {
        btn.innerHTML = '🔽 Скрыть меню';
        btn.classList.add('ring-2', 'ring-slate-400');
      }
    }
    if (s.radiatorSimulationMenuVisible) {
      st.setRadiatorSimulationMenuVisible(true);
      const menu = document.getElementById('radiator-simulation-submenu');
      const btn = document.getElementById('btn-radiator-simulation-menu');
      if (menu) menu.style.display = 'flex';
      if (btn) {
        btn.innerHTML = '🔽 Скрыть меню';
        btn.classList.add('ring-2', 'ring-slate-400');
      }
    }
    if (s.balanceVisible) {
      st.setBalanceVisible(true);
      const section = document.getElementById('balance-result');
      const btn = document.getElementById('btn-balance');
      if (section) section.style.display = 'block';
      if (btn) {
        btn.classList.remove('bg-white', 'text-amber-700');
        btn.classList.add('bg-amber-500', 'text-white', 'border-amber-600');
      }
    }
    if (s.resistanceVisible) {
      st.setResistanceVisible(true);
      const section = document.getElementById('hydraulic-section');
      const btn = document.getElementById('btn-resistance');
      if (section) section.style.display = 'block';
      if (btn) {
        btn.classList.remove('bg-white', 'text-sky-700');
        btn.classList.add('bg-sky-500', 'text-white', 'border-sky-600');
      }
    }
    if (s.riserVisible) {
      st.setRiserVisible(true);
      const section = document.getElementById('riser-calc-section');
      const btn = document.getElementById('btn-riser');
      if (section) section.style.display = 'block';
      if (btn) {
        btn.classList.remove('bg-white', 'text-purple-700');
        btn.classList.add('bg-purple-500', 'text-white', 'border-purple-600');
      }
    }
    if (s.flowDynamicsVisible) {
      st.setFlowDynamicsVisible(true);
      const section = document.getElementById('flow-dynamics-section');
      const btn = document.getElementById('btn-flow-dynamics-menu');
      if (section) section.style.display = 'block';
      if (btn) { btn.classList.remove('bg-white', 'text-pink-700'); btn.classList.add('bg-pink-500', 'text-white', 'border-pink-600'); }
    }
    const restoreSection = (visible: boolean, sectionId: string, btnId: string, addCls: string, removeCls: string, display?: string) => {
      if (!visible) return;
      const sec = document.getElementById(sectionId), b = document.getElementById(btnId);
      if (sec) sec.style.display = display || 'block';
      if (b) { b.classList.remove(removeCls); b.classList.add(addCls); }
    };
    const vizVisible = s.canvasVisible || s.bypassVisible || s.radiatorParamsVisible;
    restoreSection(vizVisible, 'visualization-section', 'btn-canvas', 'bg-indigo-500 text-white border-indigo-600', 'bg-white text-indigo-700');
    restoreSection(s.collectorVisible, 'collector-section', 'btn-collector', 'bg-orange-500 text-white border-orange-600', 'bg-white text-orange-700');
    restoreSection(s.metricsVisible, 'metrics-section', 'btn-metrics', 'bg-teal-500 text-white border-teal-600', 'bg-white text-teal-700', 'flex');
    restoreSection(s.sectionsVisible, 'sections-section', 'btn-sections', 'bg-violet-500 text-white border-violet-600', 'bg-white text-violet-700');
    restoreSection(s.analysisVisible, 'analysis-section', 'btn-analysis', 'bg-slate-500 text-white border-slate-600', 'bg-white text-slate-700');
    restoreSection(s.sectionControlsVisible, 'section-controls-section', 'btn-section-controls', 'bg-sky-500 text-white border-sky-600', 'bg-white text-sky-700');
    if (typeof s.sizeControlsVisible === 'boolean') {
      st.setSizeControlsVisible(s.sizeControlsVisible);
      const sc = document.getElementById('size-controls-section'), scBtn = document.getElementById('btn-size-controls');
      if (sc) sc.style.display = st.sizeControlsVisible ? 'flex' : 'none';
      if (scBtn) {
        scBtn.innerHTML = st.sizeControlsVisible ? '🔽 Скрыть размеры' : '📐 Размеры и позиция';
        scBtn.classList.toggle('ring-2', st.sizeControlsVisible);
        scBtn.classList.toggle('ring-slate-400', st.sizeControlsVisible);
      }
    }
    if (vizVisible) st.setCanvasVisible(true);
    if (typeof s.radWidth === 'number' && s.radWidth >= 400 && s.radWidth <= 1400) {
      st.setRadWidth(s.radWidth);
      const wEl = document.getElementById('rad-width') as HTMLInputElement;
      if (wEl) wEl.value = String(st.radWidth);
    }
    if (typeof s.radHeight === 'number' && s.radHeight >= 200 && s.radHeight <= 600) {
      st.setRadHeight(s.radHeight);
      const hEl = document.getElementById('rad-height') as HTMLInputElement;
      if (hEl) hEl.value = String(st.radHeight);
    }
    if (typeof s.radPosX === 'number' && s.radPosX >= 285 && s.radPosX <= 600) {
      st.setRadPosX(s.radPosX);
      const xEl = document.getElementById('rad-pos-x') as HTMLInputElement;
      if (xEl) xEl.value = String(st.radPosX);
    }
    if (typeof s.radPosY === 'number' && s.radPosY >= 100 && s.radPosY <= 400) {
      st.setRadPosY(s.radPosY);
      const yEl = document.getElementById('rad-pos-y') as HTMLInputElement;
      if (yEl) yEl.value = String(st.radPosY);
    }
    if (typeof s.leftPipeExt === 'number' && s.leftPipeExt >= 0 && s.leftPipeExt <= 300) {
      st.setLeftPipeExt(s.leftPipeExt);
      const extEl = document.getElementById('left-pipe-ext') as HTMLInputElement;
      const extVal = document.getElementById('left-pipe-ext-val');
      if (extEl) extEl.value = String(st.leftPipeExt);
      if (extVal) extVal.textContent = String(st.leftPipeExt);
    }
    if (typeof s.canvasHeight === 'number' && s.canvasHeight >= 700 && s.canvasHeight <= 1050) {
      st.setCanvasHeight(s.canvasHeight);
      const chEl = document.getElementById('canvas-height') as HTMLInputElement;
      if (chEl) chEl.value = String(st.canvasHeight);
      const canvas = document.getElementById('simCanvas') as HTMLCanvasElement;
      if (canvas) canvas.height = st.canvasHeight;
    }
    if (typeof s.canvasWidth === 'number' && s.canvasWidth >= 1000 && s.canvasWidth <= 2000) {
      st.setCanvasWidth(s.canvasWidth);
      const cwEl = document.getElementById('canvas-width') as HTMLInputElement;
      if (cwEl) cwEl.value = String(st.canvasWidth);
      const canvas = document.getElementById('simCanvas') as HTMLCanvasElement;
      if (canvas) canvas.width = st.canvasWidth;
    }
    if (typeof s.sixRadCanvasWidth === 'number' && s.sixRadCanvasWidth >= 1000 && s.sixRadCanvasWidth <= 2000) {
      st.setSixRadCanvasWidth(s.sixRadCanvasWidth);
      const el = document.getElementById('six-rad-canvas-width') as HTMLInputElement;
      if (el) el.value = String(st.sixRadCanvasWidth);
      syncCanvasBelowSize();
    }
    if (typeof s.sixRadCanvasHeight === 'number' && s.sixRadCanvasHeight >= 600 && s.sixRadCanvasHeight <= 1200) {
      st.setSixRadCanvasHeight(s.sixRadCanvasHeight);
      const el = document.getElementById('six-rad-canvas-height') as HTMLInputElement;
      if (el) el.value = String(st.sixRadCanvasHeight);
      syncCanvasBelowSize();
    }
    if (typeof s.sixRadViewScale === 'number' && s.sixRadViewScale >= 0.8 && s.sixRadViewScale <= 1.5) {
      st.setSixRadViewScale(s.sixRadViewScale);
      const el = document.getElementById('six-rad-view-scale') as HTMLInputElement;
      if (el) el.value = String(st.sixRadViewScale);
    }
    if (typeof s.sixRadValveRotationDegrees === 'number' && s.sixRadValveRotationDegrees >= 0 && s.sixRadValveRotationDegrees <= 360) {
      st.setSixRadValveRotationDegrees(s.sixRadValveRotationDegrees);
      const sl = document.getElementById('six-rad-valve-rotation') as HTMLInputElement;
      const vd = document.getElementById('six-rad-valve-rotation-val');
      if (sl) sl.value = String(Math.round(st.sixRadValveRotationDegrees));
      if (vd) vd.textContent = `${Math.round(st.sixRadValveRotationDegrees)}°`;
    }
    updateRadiatorLayout(st.radWidth, st.radHeight, st.radPosX, st.radPosY);
    if (s.collectorVisible) st.setCollectorVisible(true);
    if (s.metricsVisible) st.setMetricsVisible(true);
    if (s.sectionsVisible) st.setSectionsVisible(true);
    if (s.analysisVisible) st.setAnalysisVisible(true);
    if (s.sectionControlsVisible) st.setSectionControlsVisible(true);
    if (s.sizeControlsVisible) st.setSizeControlsVisible(true);
    st.setBypassValveOpen(parseInt((document.getElementById('bypassValve') as HTMLInputElement)?.value || '') || 100);
    const cfBtn = document.getElementById('btn-counterflow');
    if (cfBtn) {
      if (st.counterflowEnabled) {
        cfBtn.innerHTML = '🔄 Противоток ВКЛ';
        cfBtn.classList.remove('inactive');
        cfBtn.classList.add('active');
      } else {
        cfBtn.innerHTML = '🔄 Противоток ВЫКЛ';
        cfBtn.classList.remove('active');
        cfBtn.classList.add('inactive');
      }
    }
    const btnBad = document.getElementById('btn-bad');
    const btnGood = document.getElementById('btn-good');
    if (btnBad)
      btnBad.className =
        st.mode === 'bad'
          ? 'mode-btn mode-active px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-900 border-2 border-slate-300 shadow-sm'
          : 'mode-btn px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-600 border-2 border-slate-200';
    if (btnGood)
      btnGood.className =
        st.mode === 'good'
          ? 'mode-btn mode-active px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-900 border-2 border-slate-300 shadow-sm'
          : 'mode-btn px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-600 border-2 border-slate-200';
    updateHydroParams();
  } catch (_e) {}
}

function updateBypassDisplay(): void {
  st.setBypassValveOpen(parseInt((document.getElementById('bypassValve') as HTMLInputElement).value));
  const vEl = document.getElementById('bypass-valve-value');
  if (vEl) vEl.textContent = `${st.bypassValveOpen}%`;
}

function toggleCounterflow(): void {
  st.setCounterflowEnabled(!st.counterflowEnabled);
  const btn = document.getElementById('btn-counterflow');
  if (btn) {
    if (st.counterflowEnabled) {
      btn.innerHTML = '🔄 Противоток ВКЛ';
      btn.classList.remove('inactive');
      btn.classList.add('active');
    } else {
      btn.innerHTML = '🔄 Противоток ВЫКЛ';
      btn.classList.remove('active');
      btn.classList.add('inactive');
      st.setCounterflowReachSection(-1);
    }
  }
  recalcAll();
  st.particles.forEach((p) => p.reset());
  saveSettings();
}

function updateHydroParams(): void {
  PIPE_DATA.main_pipe.d_mm = Math.max(0.1, parseFloat((document.getElementById('main-pipe-d') as HTMLInputElement)?.value?.trim() || '') || 20.4);
  PIPE_DATA.main_pipe.L_m = Math.max(0.1, parseFloat((document.getElementById('main-pipe-L') as HTMLInputElement)?.value?.trim() || '') || 2.0);
  PIPE_DATA.bypass_pipe.d_mm = Math.max(0.1, parseFloat((document.getElementById('bypass-pipe-d') as HTMLInputElement)?.value?.trim() || '') || 15.6);
  PIPE_DATA.bypass_pipe.L_m = Math.max(0.1, parseFloat((document.getElementById('bypass-pipe-L') as HTMLInputElement)?.value?.trim() || '') || 1.0);
  PIPE_DATA.rad_pipe.d_mm = Math.max(0.1, parseFloat((document.getElementById('rad-pipe-d') as HTMLInputElement)?.value?.trim() || '') || 20.4);
  PIPE_DATA.rad_pipe.L_m = Math.max(0.1, parseFloat((document.getElementById('rad-pipe-L') as HTMLInputElement)?.value?.trim() || '') || 1.5);
  VALVE_DATA.ball_valve_34.zeta_open = Math.max(0, parseFloat((document.getElementById('valve-34-zeta') as HTMLInputElement)?.value?.trim() || '') || 0.3);
  VALVE_DATA.ball_valve_12.zeta_open = Math.max(0, parseFloat((document.getElementById('valve-12-zeta') as HTMLInputElement)?.value?.trim() || '') || 0.5);
  VALVE_DATA.tee.zeta = Math.max(0, parseFloat((document.getElementById('tee-zeta') as HTMLInputElement)?.value?.trim() || '') || 1.5);
  VALVE_DATA.radiator.zeta = Math.max(0, parseFloat((document.getElementById('radiator-zeta') as HTMLInputElement)?.value?.trim() || '') || 3.0);
  HYDRO.rho = Math.max(900, parseFloat((document.getElementById('water-rho') as HTMLInputElement)?.value?.trim() || '') || 985);
  HYDRO.lambda = Math.max(0.001, parseFloat((document.getElementById('water-lambda') as HTMLInputElement)?.value?.trim() || '') || 0.025);
  HYDRO.nu = Math.max(0.001, parseFloat((document.getElementById('water-nu') as HTMLInputElement)?.value?.trim() || '') || 0.415) * 1e-6;
  HYDRO.g = Math.max(9.5, parseFloat((document.getElementById('water-g') as HTMLInputElement)?.value?.trim() || '') || 9.81);
  recalcAll();
}

function resetHydroParams(): void {
  (document.getElementById('main-pipe-d') as HTMLInputElement).value = '20.4';
  (document.getElementById('main-pipe-L') as HTMLInputElement).value = '2.0';
  (document.getElementById('bypass-pipe-d') as HTMLInputElement).value = '15.6';
  (document.getElementById('bypass-pipe-L') as HTMLInputElement).value = '1.0';
  (document.getElementById('rad-pipe-d') as HTMLInputElement).value = '20.4';
  (document.getElementById('rad-pipe-L') as HTMLInputElement).value = '1.5';
  (document.getElementById('valve-34-zeta') as HTMLInputElement).value = '0.3';
  (document.getElementById('valve-12-zeta') as HTMLInputElement).value = '0.5';
  (document.getElementById('tee-zeta') as HTMLInputElement).value = '1.5';
  (document.getElementById('radiator-zeta') as HTMLInputElement).value = '3.0';
  (document.getElementById('water-rho') as HTMLInputElement).value = '985';
  (document.getElementById('water-lambda') as HTMLInputElement).value = '0.025';
  (document.getElementById('water-nu') as HTMLInputElement).value = '0.415';
  (document.getElementById('water-g') as HTMLInputElement).value = '9.81';
  updateHydroParams();
}

function updateParticleParams(): void {
  particleParams.heatLossCoeff = parseFloat((document.getElementById('heat-loss-coeff') as HTMLInputElement)?.value || '') || 0.03;
  particleParams.particlesPerLiter = parseFloat((document.getElementById('particles-per-liter') as HTMLInputElement)?.value || '') || 50;
  particleParams.gravityForce = parseFloat((document.getElementById('gravity-force') as HTMLInputElement)?.value || '') || 0.03;
  const hd = document.getElementById('heat-loss-display');
  const pd = document.getElementById('particles-per-liter-display');
  const gd = document.getElementById('gravity-force-display');
  if (hd) hd.textContent = particleParams.heatLossCoeff.toFixed(3);
  if (pd) pd.textContent = String(particleParams.particlesPerLiter);
  if (gd) gd.textContent = particleParams.gravityForce.toFixed(3);
}

function updateParticleCount(): void {
  const targetFlow = st.thermal.sysFlowLPM || 4;
  const targetCount = Math.round(targetFlow * particleParams.particlesPerLiter);
  const td = document.getElementById('total-particles-display');
  if (td) td.textContent = `≈${targetCount} частиц`;
  while (st.particles.length < targetCount) st.particles.push(new Particle());
  if (st.particles.length > targetCount) st.particles.splice(targetCount);
}

function updateParticleStats(): void {
  let sumTemp = 0, count = 0, coldCount = 0, stallCount = 0;
  const bySec = Array(SECTIONS).fill(0) as number[];
  for (const p of st.particles) {
    const particle = p as Particle;
    if (particle.state !== 'exit') {
      sumTemp += particle.temp ?? 40;
      count++;
      if (particle.state === 'stall') stallCount++;
      if (particle.state !== 'enter' && particle.state !== 'to_rad') {
        const surfT = st.secSurfaceTemps[Math.max(0, particle.sec ?? 0)] || 40;
        if ((particle.temp ?? 40) < surfT + 2) coldCount++;
        if ((particle.sec ?? 0) >= 0 && (particle.sec ?? 0) < SECTIONS) bySec[particle.sec ?? 0]++;
      }
    }
  }
  particleStats.activeCount = count;
  particleStats.avgTemp = count > 0 ? sumTemp / count : 40;
  particleStats.bySection = bySec;
  particleStats.coldCount = coldCount;
  particleStats.stallCount = stallCount;
  const statEl = document.getElementById('particle-stats');
  if (statEl) statEl.textContent = `Активных: ${count} | Средн. T: ${particleStats.avgTemp.toFixed(1)}°C | Холодных: ${coldCount} | В застое: ${stallCount}`;
}

function update(): void {
  st.setAnimTime(st.animTime + 1);
  st.particleCountPerSegment.fill(0);
  st.counterflowParticleCount.fill(0);
  st.regularParticleCount.fill(0);
  updateParticleParams();
  updateParticleCount();
  st.particles.forEach((p) => {
    p.update();
    const particle = p as Particle;
    if (particle.state === 'top_coll' || particle.state === 'top_coll_right') {
      const secW = (L.radEndX - L.radStartX) / SECTIONS;
      const segIdx = clamp(Math.floor((particle.x - L.radStartX) / secW), 0, SECTIONS - 1);
      st.particleCountPerSegment[segIdx]++;
      if (particle.isCounterflow) st.counterflowParticleCount[segIdx]++;
      else st.regularParticleCount[segIdx]++;
    }
  });
  updateParticleStats();
  if (st.animTime % 30 === 0) updateCollectorInfoBlock();
}

function gameLoop(): void {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

function thawAll(): void {
  st.frozenSections.fill(false);
  st.setSystemFrozen(false);
  st.setFreezeWarningShown(false);
  recalcAll();
  st.particles.forEach((p) => p.reset());
}

function recalcAll(): void {
  st.setBypassValveOpen(parseInt((document.getElementById('bypassValve') as HTMLInputElement).value));
  st.frozenSections.fill(false);
  st.setSystemFrozen(false);
  st.setFreezeWarningShown(false);
  st.setCounterflowReachSection(st.mode === 'bad' && st.counterflowEnabled ? 4 : -1);
  calcFlows();
  findEquilibriumTroom();
  updateUI();
  updateGradientBar();
  calcRiser();
  saveSettings();
}

function updateUI(): void {
  const thawBtn = document.getElementById('btn-thaw');
  if (thawBtn) thawBtn.classList.toggle('hidden', !st.frozenSections.some((f) => f));
  const nomP = st.thermal.nomPower, sT = st.thermal.supplyT, pps = nomP / SECTIONS;
  const T_room = st.balance.T_room_eq, Tout = st.thermal.outsideT, Kroom = st.thermal.Kroom;
  const setById = (id: string, v: string) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setById('equilibrium-temp', `${T_room.toFixed(1)}°C`);
  setById('q-radiator', `${st.balance.Q_rad.toFixed(0)} Вт`);
  setById('q-losses', `${st.balance.Q_loss.toFixed(0)} Вт`);
  setById('kroom-display', `${Kroom.toFixed(2)}`);
  setById('kroom-card', `${Kroom.toFixed(1)}`);
  const bc = document.getElementById('balance-result'), se = document.getElementById('comfort-status');
  if (bc && se) {
    bc.className = T_room >= 20 ? 'metric-card comfort-good mb-6' : T_room >= 16 ? 'metric-card comfort-warn mb-6' : 'metric-card comfort-bad mb-6';
    se.textContent = T_room >= 20 ? '✅ Комфортно' : T_room >= 16 ? '⚠ Прохладно' : '❄️ Холодно!';
  }
  const be = document.getElementById('balance-equation');
  if (be) be.innerHTML = `<strong>Баланс:</strong> Q_рад=${st.balance.Q_rad.toFixed(0)} Вт = Q_пот = K×(T_комн−T_ул)−Q_инт = ${Kroom.toFixed(1)}×(${T_room.toFixed(1)}−${Tout})−${st.thermal.Qint} = ${st.balance.Q_loss.toFixed(0)} Вт (T_ул=${Tout}°C)`;
  const T_desired = Number((document.getElementById('desiredRoomTemp') as HTMLInputElement)?.value ?? 20);
  const Q_needed = Kroom * (T_desired - Tout) - st.thermal.Qint;
  const Q_rad = st.balance.Q_rad;
  const deltaQ = Q_needed - Q_rad;
  let desiredText = '';
  if (T_desired <= Tout) {
    desiredText = `при T_комн=${T_desired}°C ≤ T_ул=${Tout}°C отопление не требуется.`;
  } else if (Math.abs(deltaQ) < 10) {
    desiredText = `при T_комн=${T_desired}°C нужны Q=${Q_needed.toFixed(0)} Вт. Радиатор даёт ${Q_rad.toFixed(0)} Вт — достаточно.`;
  } else if (deltaQ > 0) {
    desiredText = `при T_комн=${T_desired}°C нужны Q=${Q_needed.toFixed(0)} Вт. Радиатор даёт ${Q_rad.toFixed(0)} Вт — недостаточно на ${deltaQ.toFixed(0)} Вт (повысить T_подачи или мощность радиатора).`;
  } else {
    desiredText = `при T_комн=${T_desired}°C нужны Q=${Q_needed.toFixed(0)} Вт. Радиатор даёт ${Q_rad.toFixed(0)} Вт — с запасом ${(-deltaQ).toFixed(0)} Вт.`;
  }
  const dtEl = document.getElementById('desired-temp-text');
  if (dtEl) dtEl.textContent = desiredText;
  setById('bypass-flow', `${(st.flowData.bypassFrac * 100).toFixed(0)}%`);
  setById('radiator-flow', `${(st.flowData.radFrac * 100).toFixed(0)}%`);
  setById('bypass-lpm', `${st.flowData.bypassLPM.toFixed(2)} л/мин`);
  setById('radiator-lpm', `${st.flowData.radLPM.toFixed(2)} л/мин`);
  setById('bypass-valve-value', `${st.bypassValveOpen}%`);
  setById('real-power', `${st.thermal.totalPower.toFixed(0)} Вт`);
  const eff = clamp(st.thermal.totalPower / nomP * 100, 0, 150).toFixed(0);
  setById('efficiency', `${eff}%`);
  setById('return-temp', `${st.thermal.avgRetTemp.toFixed(1)}°C`);
  setById('delta-t', `${(sT - st.thermal.avgRetTemp).toFixed(1)}°C`);
  setById('sections-troom', T_room.toFixed(1));
  const rd = st.resistanceData;
  const bp = rd.bypass_path as { flow?: number; velocity?: number; Re?: number; lambda?: number };
  const rp = rd.radiator_path as { flow?: number; velocity?: number; Re?: number; lambda?: number };
  setById('bypass-flow-hydro', (bp.flow ?? 0).toFixed(2));
  setById('bypass-velocity', (bp.velocity ?? 0).toFixed(3));
  setById('bypass-h-total', rd.bypass_path.h_total.toFixed(4));
  setById('bypass-h-friction', rd.bypass_path.h_friction.toFixed(4));
  setById('bypass-h-local', rd.bypass_path.h_local.toFixed(4));
  setById('bypass-Re', String(bp.Re ?? 0));
  setById('bypass-lambda', (bp.lambda ?? 0).toFixed(4));
  setById('rad-flow-hydro', (rp.flow ?? 0).toFixed(2));
  setById('rad-velocity', (rp.velocity ?? 0).toFixed(3));
  setById('rad-h-total', rd.radiator_path.h_total.toFixed(4));
  setById('rad-h-friction', rd.radiator_path.h_friction.toFixed(4));
  setById('rad-h-local', rd.radiator_path.h_local.toFixed(4));
  setById('rad-Re', String(rp.Re ?? 0));
  setById('rad-lambda', (rp.lambda ?? 0).toFixed(4));
  setById('system-flow-hydro', rd.flow.toFixed(2));
  setById('system-h-current', rd.system_total.h_current.toFixed(4) + ' м.в.ст');
  setById('system-h-initial', rd.system_total.h_initial.toFixed(4));
  setById('system-h-ratio', `${rd.system_total.ratio.toFixed(2)}×`);
  const rChange = ((rd.system_total.ratio - 1) * 100).toFixed(0);
  const rChangeText = rd.system_total.ratio >= 1 ? `+${rChange}%` : `${rChange}%`;
  const colorClass = rd.system_total.ratio > 2.0 ? '#dc2626' : rd.system_total.ratio > 1.5 ? '#f59e0b' : '#22c55e';
  const bpL = bp.lambda ?? 0, rpL = rp.lambda ?? 0;
  const reEl = document.getElementById('resistance-equation');
  if (reEl) reEl.innerHTML = `<strong>Формула Дарси-Вейсбаха:</strong> ΔP = λ(Re)×(L/d)×(ρv²/2) + Σζ×(ρv²/2) | <strong>Труба 3/4":</strong> d=${PIPE_DATA.main_pipe.d_mm}мм | <strong>Байпас 1/2":</strong> d=${PIPE_DATA.bypass_pipe.d_mm}мм, λ=${bpL.toFixed(4)} | <strong>Радиатор:</strong> λ=${rpL.toFixed(4)} | Изм. ΔP: <span style="color:${colorClass}"><strong>${rChangeText}</strong></span> при G=${rd.flow.toFixed(1)} л/мин`;
  let html = '';
  for (let i = 0; i < SECTIONS; i++) {
    const p = st.thermal.secPowers[i] || 0, fl = st.thermal.secFlowLPM[i] || 0, ep = st.thermal.secEps[i] || 0;
    const pR = clamp(p / pps, 0, 1), surfT = st.secSurfaceTemps[i];
    const cardC = tCSS(surfT, sT), cardBg = tCSS(surfT, sT, 0.15), cardTc = tCSS(surfT, sT, 0.95);
    const em = surfT > COLD_THRESHOLD ? '🔴' : '🔵';
    html += `<div class="section-card" style="border-color:${cardC};background:${cardBg};"><div class="tooltip"><b>Секция №${i+1}</b><br>Q=${p.toFixed(1)} Вт<br>Tпов=${surfT.toFixed(1)}°C<br>G=${fl.toFixed(3)} л/мин<br>ε=${(ep*100).toFixed(1)}%</div><div class="text-xs font-bold text-slate-600 mb-1">${em} №${i+1}</div><div class="text-lg font-bold" style="color:${cardTc}">${p.toFixed(0)}<span class="text-xs"> Вт</span></div><div class="text-xs font-mono" style="color:${tCSS(surfT,sT)}">пов: ${surfT.toFixed(0)}°C</div><div class="text-xs text-teal-600 font-mono">${fl.toFixed(3)} л/мин</div><div class="text-xs text-purple-500 font-mono">ε=${(ep*100).toFixed(0)}%</div><div class="w-full bg-gray-200 rounded-full h-2 mt-1"><div class="h-2 rounded-full" style="width:${(pR*100).toFixed(0)}%;background:${cardC};"></div></div></div>`;
  }
  const sd = document.getElementById('sections-detail');
  if (sd) sd.innerHTML = html;
  let logHtml = '<table class="w-full"><tr class="font-bold text-slate-500"><td>№</td><td>T</td><td>Q</td><td>Δ</td></tr>';
  for (const row of st.balance.log.slice(-8)) {
    const color = Math.abs(row.f) < 1 ? 'text-green-600' : Math.abs(row.f) < 50 ? 'text-amber-600' : 'text-red-500';
    logHtml += `<tr><td>${row.iter}</td><td>${row.T_room.toFixed(2)}</td><td>${row.Q_rad.toFixed(0)}</td><td class="${color}">${row.f.toFixed(1)}</td></tr>`;
  }
  logHtml += '</table>' + (st.balance.converged ? '<div class="text-green-600 font-bold mt-1">✅ Сошлось</div>' : '');
  const il = document.getElementById('iteration-log');
  if (il) il.innerHTML = logHtml;
  const act = st.thermal.secPowers.filter((px) => px > pps * 0.25).length;
  let expl = `<p class="font-semibold mb-2">При T<sub>ул</sub>=${Tout}°C:</p><p>T<sub>комн</sub> = <strong>${T_room.toFixed(1)}°C</strong></p><p>Q: <strong>${st.thermal.totalPower.toFixed(0)}</strong>/${nomP} Вт (${eff}%)</p><p>K<sub>room</sub> = ${Kroom.toFixed(2)} Вт/К (const)</p>`;
  if (st.mode === 'bad') expl += st.counterflowEnabled ? `<p class="text-orange-600 text-xs mt-1">🔥 Противоток до секции ${st.counterflowReachSection+1}</p>` : `<p class="text-slate-500 text-xs mt-1">Противоток выключен</p>`;
  expl += `<p class="text-orange-600 text-xs">Активны ${act}/10</p>`;
  if (st.bypassValveOpen === 0) expl += '<p class="text-green-600 mt-2">◆ Байпас закрыт</p>';
  if (T_room < 18) expl += '<p class="text-red-600 mt-2">⚠ Холодно!</p>';
  const pe = document.getElementById('physics-explanation');
  if (pe) pe.innerHTML = expl;
}

function updateCollectorInfoBlock(): void {
  const sT = st.thermal.supplyT || 70;
  const container = document.getElementById('collector-temps');
  const explanation = document.getElementById('collector-explanation');
  const particleInfo = document.getElementById('particle-count-info');
  if (!container) return;
  let html = '';
  for (let i = 0; i < SECTIONS; i++) {
    const collT = st.collectorReturnTemps[i] || 20, surfT = st.secSurfaceTemps[i] || 20;
    const delta = collT - surfT, c = tempToColor(collT, sT, st.balance.T_room_eq);
    const particleCount = st.particleCountPerSegment[i];
    const isHot = st.mode === 'bad' && st.counterflowEnabled && particleCount > 0 && delta > 2;
    const borderColor = isHot ? '#ef4444' : '#94a3b8';
    html += `<div class="collector-temp-badge" style="background:rgba(${c.r},${c.g},${c.b},0.2);border:2px solid ${borderColor};color:rgb(${c.r},${c.g},${c.b})">№${i+1}: ${collT.toFixed(1)}°C ${isHot?'🔥':''}</div>`;
  }
  container.innerHTML = html;
  if (explanation) {
    if (st.mode === 'bad') explanation.innerHTML = st.counterflowEnabled ? `<strong>Без удлинителя + противоток ВКЛ:</strong> Коллектор горячий от секции 1 до секции <strong>${st.counterflowReachSection+1}</strong>. Дальше — температура поверхности секций.` : `<strong>Без удлинителя + противоток ВЫКЛ:</strong> Коллектор обратки = температура поверхности каждой секции.`;
    else explanation.innerHTML = `<strong>С удлинителем:</strong> Температура коллектора обратки равномерная ≈ ${(st.collectorReturnTemps[0]||0).toFixed(1)}°C`;
  }
  if (particleInfo) {
    let pinfo = '<strong>Частицы в коллекторе обратки:</strong><br>';
    for (let i = 0; i < SECTIONS; i++) pinfo += `Сек.${i+1}: ${st.particleCountPerSegment[i]} (противоток: ${st.counterflowParticleCount[i]}, обратка: ${st.regularParticleCount[i]}) | `;
    particleInfo.innerHTML = pinfo;
  }
}

function setMode(nm: 'bad' | 'good'): void {
  st.setMode(nm);
  const btnBad = document.getElementById('btn-bad'), btnGood = document.getElementById('btn-good');
  if (btnBad) btnBad.className = st.mode === 'bad' ? 'mode-btn mode-active px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-900 border-2 border-slate-300 shadow-sm' : 'mode-btn px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-600 border-2 border-slate-200';
  if (btnGood) btnGood.className = st.mode === 'good' ? 'mode-btn mode-active px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-900 border-2 border-slate-300 shadow-sm' : 'mode-btn px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-600 border-2 border-slate-200';
  st.particles.forEach((p) => p.reset());
  recalcAll();
}

function toggleHydraulicsMenu(): void {
  st.setHydraulicsMenuVisible(!st.hydraulicsMenuVisible);
  const menu = document.getElementById('hydraulics-submenu'), btn = document.getElementById('btn-hydraulics-menu');
  if (st.hydraulicsMenuVisible) { if (menu) menu.style.display = 'flex'; if (btn) { btn.innerHTML = '🔽 Скрыть меню'; btn.classList.add('ring-2', 'ring-slate-400'); } }
  else { if (menu) menu.style.display = 'none'; if (btn) { btn.innerHTML = '⚙ Меню Гидравлики'; btn.classList.remove('ring-2', 'ring-slate-400'); } }
  saveSettings();
}

function toggleRadiatorSimulationMenu(): void {
  st.setRadiatorSimulationMenuVisible(!st.radiatorSimulationMenuVisible);
  const menu = document.getElementById('radiator-simulation-submenu'), btn = document.getElementById('btn-radiator-simulation-menu');
  if (st.radiatorSimulationMenuVisible) { if (menu) menu.style.display = 'flex'; if (btn) { btn.innerHTML = '🔽 Скрыть меню'; btn.classList.add('ring-2', 'ring-slate-400'); } }
  else { if (menu) menu.style.display = 'none'; if (btn) { btn.innerHTML = '🔥 Меню Симуляции Радиатора'; btn.classList.remove('ring-2', 'ring-slate-400'); } }
  saveSettings();
}

function toggleBalance(): void {
  st.setBalanceVisible(!st.balanceVisible);
  const section = document.getElementById('balance-result'), btn = document.getElementById('btn-balance');
  if (st.balanceVisible) { if (section) section.style.display = 'block'; if (btn) { btn.classList.remove('bg-white', 'text-amber-700'); btn.classList.add('bg-amber-500', 'text-white', 'border-amber-600'); } }
  else { if (section) section.style.display = 'none'; if (btn) { btn.classList.add('bg-white', 'text-amber-700'); btn.classList.remove('bg-amber-500', 'text-white', 'border-amber-600'); } }
  saveSettings();
}

function toggleResistance(): void {
  st.setResistanceVisible(!st.resistanceVisible);
  const section = document.getElementById('hydraulic-section'), btn = document.getElementById('btn-resistance');
  if (st.resistanceVisible) { if (section) section.style.display = 'block'; if (btn) { btn.classList.remove('bg-white', 'text-sky-700'); btn.classList.add('bg-sky-500', 'text-white', 'border-sky-600'); } }
  else { if (section) section.style.display = 'none'; if (btn) { btn.classList.add('bg-white', 'text-sky-700'); btn.classList.remove('bg-sky-500', 'text-white', 'border-sky-600'); } }
  saveSettings();
}

function toggleRiser(): void {
  st.setRiserVisible(!st.riserVisible);
  const section = document.getElementById('riser-calc-section'), btn = document.getElementById('btn-riser');
  if (st.riserVisible) { if (section) section.style.display = 'block'; if (btn) { btn.classList.remove('bg-white', 'text-purple-700'); btn.classList.add('bg-purple-500', 'text-white', 'border-purple-600'); } calcRiser(); }
  else { if (section) section.style.display = 'none'; if (btn) { btn.classList.add('bg-white', 'text-purple-700'); btn.classList.remove('bg-purple-500', 'text-white', 'border-purple-600'); } }
  saveSettings();
}

function toggleRiserInfo(): void {
  const section = document.getElementById('riser-info-section'), btn = document.getElementById('btn-riser-info');
  if (!section || !btn) return;
  const isVisible = section.style.display !== 'none';
  section.style.display = isVisible ? 'none' : 'block';
  btn.innerHTML = isVisible ? '📋 Информация' : '🔽 Скрыть информацию';
}

function toggleRiserFloors(): void {
  const section = document.getElementById('riser-floors-section'), btn = document.getElementById('btn-riser-floors');
  if (!section || !btn) return;
  const isVisible = section.style.display !== 'none';
  section.style.display = isVisible ? 'none' : 'block';
  btn.innerHTML = isVisible ? '🏢 Радиаторы по этажам (сверху вниз по стояку)' : '🔽 Скрыть таблицу';
  btn.classList.toggle('ring-2', !isVisible);
  btn.classList.toggle('ring-purple-400', !isVisible);
}

function toggleRiserFormulas(): void {
  const section = document.getElementById('riser-formulas-section'), btn = document.getElementById('btn-riser-formulas');
  if (!section || !btn) return;
  const isVisible = section.style.display !== 'none';
  section.style.display = isVisible ? 'none' : 'block';
  btn.innerHTML = isVisible ? '📋 Сводка и методика' : '🔽 Скрыть';
  btn.classList.toggle('ring-2', !isVisible);
  btn.classList.toggle('ring-purple-400', !isVisible);
}

function toggleFlowDynamics(): void {
  st.setFlowDynamicsVisible(!st.flowDynamicsVisible);
  const section = document.getElementById('flow-dynamics-section'), btn = document.getElementById('btn-flow-dynamics-menu');
  if (st.flowDynamicsVisible) {
    if (section) section.style.display = 'block';
    if (btn) { btn.classList.remove('bg-white', 'text-pink-700'); btn.classList.add('bg-pink-500', 'text-white', 'border-pink-600'); }
  } else {
    if (section) section.style.display = 'none';
    if (btn) { btn.classList.add('bg-white', 'text-pink-700'); btn.classList.remove('bg-pink-500', 'text-white', 'border-pink-600'); }
  }
  saveSettings();
}

function toggleCanvas(): void {
  st.setCanvasVisible(!st.canvasVisible);
  const section = document.getElementById('visualization-section'), btn = document.getElementById('btn-canvas');
  if (st.canvasVisible) {
    if (section) section.style.display = 'block';
    if (btn) { btn.classList.remove('bg-white', 'text-indigo-700'); btn.classList.add('bg-indigo-500', 'text-white', 'border-indigo-600'); }
  } else {
    if (section) section.style.display = 'none';
    if (btn) { btn.classList.add('bg-white', 'text-indigo-700'); btn.classList.remove('bg-indigo-500', 'text-white', 'border-indigo-600'); }
  }
  saveSettings();
}

function toggleCollector(): void {
  st.setCollectorVisible(!st.collectorVisible);
  const section = document.getElementById('collector-section'), btn = document.getElementById('btn-collector');
  if (st.collectorVisible) {
    if (section) section.style.display = 'block';
    if (btn) { btn.classList.remove('bg-white', 'text-orange-700'); btn.classList.add('bg-orange-500', 'text-white', 'border-orange-600'); }
  } else {
    if (section) section.style.display = 'none';
    if (btn) { btn.classList.add('bg-white', 'text-orange-700'); btn.classList.remove('bg-orange-500', 'text-white', 'border-orange-600'); }
  }
  saveSettings();
}

function toggleMetrics(): void {
  st.setMetricsVisible(!st.metricsVisible);
  const section = document.getElementById('metrics-section'), btn = document.getElementById('btn-metrics');
  if (st.metricsVisible) {
    if (section) section.style.display = 'flex';
    if (btn) { btn.classList.remove('bg-white', 'text-teal-700'); btn.classList.add('bg-teal-500', 'text-white', 'border-teal-600'); }
  } else {
    if (section) section.style.display = 'none';
    if (btn) { btn.classList.add('bg-white', 'text-teal-700'); btn.classList.remove('bg-teal-500', 'text-white', 'border-teal-600'); }
  }
  saveSettings();
}

function toggleSections(): void {
  st.setSectionsVisible(!st.sectionsVisible);
  const section = document.getElementById('sections-section'), btn = document.getElementById('btn-sections');
  if (st.sectionsVisible) {
    if (section) section.style.display = 'block';
    if (btn) { btn.classList.remove('bg-white', 'text-violet-700'); btn.classList.add('bg-violet-500', 'text-white', 'border-violet-600'); }
  } else {
    if (section) section.style.display = 'none';
    if (btn) { btn.classList.add('bg-white', 'text-violet-700'); btn.classList.remove('bg-violet-500', 'text-white', 'border-violet-600'); }
  }
  saveSettings();
}

function toggleAnalysis(): void {
  st.setAnalysisVisible(!st.analysisVisible);
  const section = document.getElementById('analysis-section'), btn = document.getElementById('btn-analysis');
  if (st.analysisVisible) {
    if (section) section.style.display = 'block';
    if (btn) { btn.classList.remove('bg-white', 'text-slate-700'); btn.classList.add('bg-slate-500', 'text-white', 'border-slate-600'); }
  } else {
    if (section) section.style.display = 'none';
    if (btn) { btn.classList.add('bg-white', 'text-slate-700'); btn.classList.remove('bg-slate-500', 'text-white', 'border-slate-600'); }
  }
  saveSettings();
}

function toggleSizeControls(): void {
  st.setSizeControlsVisible(!st.sizeControlsVisible);
  const section = document.getElementById('size-controls-section'), btn = document.getElementById('btn-size-controls');
  if (st.sizeControlsVisible) {
    if (section) section.style.display = 'flex';
    if (btn) { btn.innerHTML = '🔽 Скрыть размеры'; btn.classList.add('ring-2', 'ring-slate-400'); }
  } else {
    if (section) section.style.display = 'none';
    if (btn) { btn.innerHTML = '📐 Размеры и позиция'; btn.classList.remove('ring-2', 'ring-slate-400'); }
  }
  saveSettings();
}

function toggleSixRadBypassControls(): void {
  const section = document.getElementById('six-rad-bypass-controls-section'), btn = document.getElementById('btn-six-rad-bypass-controls');
  if (!section || !btn) return;
  const isVisible = section.style.display !== 'none';
  section.style.display = isVisible ? 'none' : 'block';
  btn.innerHTML = isVisible ? '◆ Краны на байпасах 1/2" (рад. 1–6)' : '🔽 Скрыть краны';
  btn.classList.toggle('ring-2', !isVisible);
  btn.classList.toggle('ring-purple-400', !isVisible);
}

function toggleSixRadSizeControls(): void {
  const section = document.getElementById('six-rad-size-controls-section'), btn = document.getElementById('btn-six-rad-size-controls');
  if (!section || !btn) return;
  const isVisible = section.style.display !== 'none';
  section.style.display = isVisible ? 'none' : 'flex';
  btn.innerHTML = isVisible ? '📐 Размеры и позиция' : '🔽 Скрыть размеры';
  btn.classList.toggle('ring-2', !isVisible);
  btn.classList.toggle('ring-purple-400', !isVisible);
}

function setSixRadBypassPct(idx: number, value: string | number): void {
  const pct = Math.max(0, Math.min(100, Number(value) || 100));
  st.setSixRadBypassOpenPct(idx, pct);
  const sl = document.getElementById(`six-rad-bypass-${idx}`) as HTMLInputElement;
  const vd = document.getElementById(`six-rad-bypass-val-${idx}`);
  if (sl) sl.value = String(Math.round(pct));
  if (vd) vd.textContent = `${Math.round(pct)}%`;
  saveSettings();
}

function sixRadBypassAllOpen(): void {
  for (let i = 0; i < 6; i++) {
    st.setSixRadBypassOpenPct(i, 100);
    const sl = document.getElementById(`six-rad-bypass-${i}`) as HTMLInputElement;
    const vd = document.getElementById(`six-rad-bypass-val-${i}`);
    if (sl) sl.value = '100';
    if (vd) vd.textContent = '100%';
  }
  calcRiser();
  saveSettings();
}

function sixRadBypassAllClosed(): void {
  for (let i = 0; i < 6; i++) {
    st.setSixRadBypassOpenPct(i, 0);
    const sl = document.getElementById(`six-rad-bypass-${i}`) as HTMLInputElement;
    const vd = document.getElementById(`six-rad-bypass-val-${i}`);
    if (sl) sl.value = '0';
    if (vd) vd.textContent = '0%';
  }
  calcRiser();
  saveSettings();
}

function adjustSixRadCanvasWidth(delta: number): void {
  st.setSixRadCanvasWidth(st.sixRadCanvasWidth + delta);
  const el = document.getElementById('six-rad-canvas-width') as HTMLInputElement;
  if (el) el.value = String(st.sixRadCanvasWidth);
  syncCanvasBelowSize();
  saveSettings();
}

function applySixRadCanvasWidth(): void {
  const el = document.getElementById('six-rad-canvas-width') as HTMLInputElement;
  const v = parseInt(el?.value || '1600') || 1600;
  st.setSixRadCanvasWidth(v);
  if (el) el.value = String(st.sixRadCanvasWidth);
  syncCanvasBelowSize();
  saveSettings();
}

function adjustSixRadCanvasHeight(delta: number): void {
  st.setSixRadCanvasHeight(st.sixRadCanvasHeight + delta);
  const el = document.getElementById('six-rad-canvas-height') as HTMLInputElement;
  if (el) el.value = String(st.sixRadCanvasHeight);
  syncCanvasBelowSize();
  saveSettings();
}

function applySixRadCanvasHeight(): void {
  const el = document.getElementById('six-rad-canvas-height') as HTMLInputElement;
  const v = parseInt(el?.value || '850') || 850;
  st.setSixRadCanvasHeight(v);
  if (el) el.value = String(st.sixRadCanvasHeight);
  syncCanvasBelowSize();
  saveSettings();
}

function adjustSixRadViewScale(delta: number): void {
  st.setSixRadViewScale(st.sixRadViewScale + delta);
  const el = document.getElementById('six-rad-view-scale') as HTMLInputElement;
  if (el) el.value = String(st.sixRadViewScale);
  saveSettings();
}

function applySixRadViewScale(): void {
  const el = document.getElementById('six-rad-view-scale') as HTMLInputElement;
  const v = parseFloat(el?.value || '1.15') || 1.15;
  st.setSixRadViewScale(v);
  if (el) el.value = String(st.sixRadViewScale);
  saveSettings();
}

function adjustSixRadValveRotation(delta: number): void {
  st.setSixRadValveRotationDegrees(st.sixRadValveRotationDegrees + delta);
  const sl = document.getElementById('six-rad-valve-rotation') as HTMLInputElement;
  const vd = document.getElementById('six-rad-valve-rotation-val');
  if (sl) sl.value = String(Math.round(st.sixRadValveRotationDegrees));
  if (vd) vd.textContent = `${Math.round(st.sixRadValveRotationDegrees)}°`;
  saveSettings();
}

function applySixRadValveRotation(): void {
  const sl = document.getElementById('six-rad-valve-rotation') as HTMLInputElement;
  const v = parseInt(sl?.value || '0') || 0;
  st.setSixRadValveRotationDegrees(v);
  const vd = document.getElementById('six-rad-valve-rotation-val');
  if (vd) vd.textContent = `${Math.round(st.sixRadValveRotationDegrees)}°`;
  saveSettings();
}

function toggleSectionControls(): void {
  st.setSectionControlsVisible(!st.sectionControlsVisible);
  const section = document.getElementById('section-controls-section'), btn = document.getElementById('btn-section-controls');
  if (st.sectionControlsVisible) {
    if (section) section.style.display = 'block';
    if (btn) { btn.classList.remove('bg-white', 'text-sky-700'); btn.classList.add('bg-sky-500', 'text-white', 'border-sky-600'); }
  } else {
    if (section) section.style.display = 'none';
    if (btn) { btn.classList.add('bg-white', 'text-sky-700'); btn.classList.remove('bg-sky-500', 'text-white', 'border-sky-600'); }
  }
  saveSettings();
}

function adjustRadSize(dim: 'width' | 'height', delta: number): void {
  if (dim === 'width') {
    st.setRadWidth(st.radWidth + delta);
    (document.getElementById('rad-width') as HTMLInputElement).value = String(st.radWidth);
  } else {
    st.setRadHeight(st.radHeight + delta);
    (document.getElementById('rad-height') as HTMLInputElement).value = String(st.radHeight);
  }
  applyRadSize();
}

function adjustRadPos(axis: 'x' | 'y', delta: number): void {
  if (axis === 'x') {
    st.setRadPosX(st.radPosX + delta);
    (document.getElementById('rad-pos-x') as HTMLInputElement).value = String(st.radPosX);
  } else {
    st.setRadPosY(st.radPosY + delta);
    (document.getElementById('rad-pos-y') as HTMLInputElement).value = String(st.radPosY);
  }
  applyRadPos();
}

function applyRadSize(): void {
  const wEl = document.getElementById('rad-width') as HTMLInputElement;
  const hEl = document.getElementById('rad-height') as HTMLInputElement;
  const w = Math.max(400, Math.min(1400, parseInt(wEl?.value || '1240') || 1240));
  const h = Math.max(200, Math.min(600, parseInt(hEl?.value || '360') || 360));
  st.setRadWidth(w);
  st.setRadHeight(h);
  if (wEl) wEl.value = String(st.radWidth);
  if (hEl) hEl.value = String(st.radHeight);
  updateRadiatorLayout(st.radWidth, st.radHeight, st.radPosX, st.radPosY);
  st.particles.forEach((p) => p.reset());
  saveSettings();
}

function adjustLeftPipeExt(delta: number): void {
  st.setLeftPipeExt(st.leftPipeExt + delta);
  const el = document.getElementById('left-pipe-ext') as HTMLInputElement;
  const val = document.getElementById('left-pipe-ext-val');
  if (el) el.value = String(st.leftPipeExt);
  if (val) val.textContent = String(st.leftPipeExt);
  saveSettings();
}

function applyLeftPipeExt(): void {
  const el = document.getElementById('left-pipe-ext') as HTMLInputElement;
  const v = parseInt(el?.value || '0') || 0;
  st.setLeftPipeExt(v);
  const val = document.getElementById('left-pipe-ext-val');
  if (val) val.textContent = String(st.leftPipeExt);
  saveSettings();
}

function adjustCanvasWidth(delta: number): void {
  st.setCanvasWidth(st.canvasWidth + delta);
  const el = document.getElementById('canvas-width') as HTMLInputElement;
  if (el) el.value = String(st.canvasWidth);
  const canvas = document.getElementById('simCanvas') as HTMLCanvasElement;
  if (canvas) canvas.width = st.canvasWidth;
  syncCanvasBelowSize();
  saveSettings();
}

function applyCanvasWidth(): void {
  const el = document.getElementById('canvas-width') as HTMLInputElement;
  const v = parseInt(el?.value || '1600') || 1600;
  st.setCanvasWidth(v);
  if (el) el.value = String(st.canvasWidth);
  const canvas = document.getElementById('simCanvas') as HTMLCanvasElement;
  if (canvas) canvas.width = st.canvasWidth;
  syncCanvasBelowSize();
  saveSettings();
}

function adjustCanvasHeight(delta: number): void {
  st.setCanvasHeight(st.canvasHeight + delta);
  const el = document.getElementById('canvas-height') as HTMLInputElement;
  if (el) el.value = String(st.canvasHeight);
  const canvas = document.getElementById('simCanvas') as HTMLCanvasElement;
  if (canvas) canvas.height = st.canvasHeight;
  syncCanvasBelowSize();
  saveSettings();
}

function applyCanvasHeight(): void {
  const el = document.getElementById('canvas-height') as HTMLInputElement;
  const v = parseInt(el?.value || '850') || 850;
  st.setCanvasHeight(v);
  if (el) el.value = String(st.canvasHeight);
  const canvas = document.getElementById('simCanvas') as HTMLCanvasElement;
  if (canvas) canvas.height = st.canvasHeight;
  syncCanvasBelowSize();
  saveSettings();
}

function applyRadPos(): void {
  const xEl = document.getElementById('rad-pos-x') as HTMLInputElement;
  const yEl = document.getElementById('rad-pos-y') as HTMLInputElement;
  const x = Math.max(285, Math.min(600, parseInt(xEl?.value || '300') || 300));
  const y = Math.max(100, Math.min(400, parseInt(yEl?.value || '260') || 260));
  st.setRadPosX(x);
  st.setRadPosY(y);
  if (xEl) xEl.value = String(st.radPosX);
  if (yEl) yEl.value = String(st.radPosY);
  updateRadiatorLayout(st.radWidth, st.radHeight, st.radPosX, st.radPosY);
  st.particles.forEach((p) => p.reset());
  saveSettings();
}

function createSliders(): void {
  const c = document.getElementById('section-controls');
  if (!c) return;
  c.innerHTML = '';
  for (let i = 0; i < SECTIONS; i++) {
    const d = document.createElement('div');
    d.className = 'text-center';
    d.innerHTML = `<div class="text-xs text-slate-500 mb-2">№${i+1}</div><input type="range" min="0" max="100" value="100" class="w-full" id="slider-${i}"><div class="text-sm font-mono mt-2 text-slate-700" id="value-${i}">100%</div>`;
    c.appendChild(d);
    (d.querySelector('input') as HTMLInputElement).addEventListener('input', function() { st.openFactors[i] = Number(this.value)/100; const v = document.getElementById(`value-${i}`); if (v) v.textContent = `${this.value}%`; debouncedRecalc(); st.particles.forEach(p=>p.reset()); });
  }
}

function initParticleControls(): void {
  const h = document.getElementById('heat-loss-coeff'), p = document.getElementById('particles-per-liter'), g = document.getElementById('gravity-force');
  if (h) h.addEventListener('input', updateParticleParams);
  if (p) p.addEventListener('input', () => { updateParticleParams(); updateParticleCount(); });
  if (g) g.addEventListener('input', updateParticleParams);
}

function generateFullReportText(): string {
  const sT = st.thermal.supplyT, nomP = st.thermal.nomPower, pps = nomP / SECTIONS, Tout = st.thermal.outsideT;
  const Kroom = st.thermal.Kroom, Qint = st.thermal.Qint, sysLPM = st.thermal.sysFlowLPM, sysKGS = st.thermal.sysFlowKGS;
  const hA = st.thermal.hA_section, T_room = st.balance.T_room_eq;
  const Qdesign = st.thermal.heatLossDesign, tDesign = st.thermal.designOutTemp;
  const eps_nom = NOM.dT_water / (NOM.T_supply - NOM.T_room), NTU_nom = -Math.log(1 - eps_nom);
  const G_nom = pps / (C_WATER * NOM.dT_water);
  const eff = st.thermal.totalPower / nomP * 100, dTw = sT - st.thermal.avgRetTemp;
  const Qloss_current = Kroom * (T_room - Tout) - Qint, Qloss_design = Kroom * (T_INDOOR_DESIGN - tDesign);
  let r = `╔════════════════════════════════════════════════════════════════════════╗\n║     ПОЛНЫЙ ТЕПЛОВОЙ РАСЧЁТ РАДИАТОРНОЙ СИСТЕМЫ ОТОПЛЕНИЯ            ║\n║  Метод: ε-NTU + итерационный поиск равновесной T_room (Ньютон-Рафсон) ║\n╚════════════════════════════════════════════════════════════════════════╝\n\n`;
  r += `Дата расчёта: ${new Date().toLocaleString('ru-RU')}\nРежим: ${st.mode === 'good' ? 'С удлинителем потока' : 'Без удлинителя (α=' + ALPHA_BAD + ')'}\nКран байпаса: ${st.bypassValveOpen}% открыт\n\n`;
  r += `РАДИАТОР: Q_ном=${nomP}Вт, N=${SECTIONS}, T_подачи=${sT}°C, T_ул=${Tout}°C, расход=${sysLPM.toFixed(2)} л/мин\n`;
  r += `T_room равновесная: ${T_room.toFixed(2)}°C, K_room=${Kroom.toFixed(2)} Вт/К\n`;
  r += `Баланс: Q_рад=${st.thermal.totalPower.toFixed(0)} Вт = Q_потерь=${st.balance.Q_loss.toFixed(0)} Вт (K×(T_комн−T_ул)−Q_инт, ${eff.toFixed(1)}% номинала)\n`;
  r += `Байпас: ${(st.flowData.bypassFrac*100).toFixed(1)}%, Радиатор: ${(st.flowData.radFrac*100).toFixed(1)}%\n`;
  return r;
}

function downloadFullReport(): void {
  const text = generateFullReportText();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thermal_report_${new Date().toISOString().slice(0, 16).replace(/:/g, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function init(): void {
  const canvas = document.getElementById('simCanvas') as HTMLCanvasElement | null;
  if (!canvas) {
    console.error('Canvas #simCanvas not found');
    return;
  }
  canvas.width = st.canvasWidth;
  canvas.height = st.canvasHeight;
  st.initCanvasContext(canvas);
  syncCanvasBelowSize();
  for (let i = 0; i < 1000; i++) st.particles.push(new Particle());
  createSliders();
  initParticleControls();
  (window as Window & { setMode?: typeof setMode; toggleCounterflow?: typeof toggleCounterflow; toggleHydraulicsMenu?: typeof toggleHydraulicsMenu; toggleResistance?: typeof toggleResistance; toggleRiser?: typeof toggleRiser; recalcAll?: typeof recalcAll; updateBypassDisplay?: typeof updateBypassDisplay; updateHydroParams?: typeof updateHydroParams; resetHydroParams?: typeof resetHydroParams; riserOpenAll?: typeof riserOpenAll; riserCloseAll?: typeof riserCloseAll; riserCloseOne?: typeof riserCloseOne; toggleRiserBypass?: typeof toggleRiserBypass; calcRiser?: typeof calcRiser; downloadFullReport?: typeof downloadFullReport }).setMode = setMode;
  (window as any).toggleCounterflow = toggleCounterflow;
  (window as any).toggleHydraulicsMenu = toggleHydraulicsMenu;
  (window as any).toggleRadiatorSimulationMenu = toggleRadiatorSimulationMenu;
  (window as any).toggleBalance = toggleBalance;
  (window as any).toggleFlowDynamics = toggleFlowDynamics;
  (window as any).toggleCanvas = toggleCanvas;
  (window as any).adjustRadSize = adjustRadSize;
  (window as any).applyRadSize = applyRadSize;
  (window as any).adjustRadPos = adjustRadPos;
  (window as any).applyRadPos = applyRadPos;
  (window as any).adjustLeftPipeExt = adjustLeftPipeExt;
  (window as any).applyLeftPipeExt = applyLeftPipeExt;
  (window as any).adjustCanvasWidth = adjustCanvasWidth;
  (window as any).applyCanvasWidth = applyCanvasWidth;
  (window as any).adjustCanvasHeight = adjustCanvasHeight;
  (window as any).applyCanvasHeight = applyCanvasHeight;
  (window as any).toggleCollector = toggleCollector;
  (window as any).toggleMetrics = toggleMetrics;
  (window as any).toggleSections = toggleSections;
  (window as any).toggleAnalysis = toggleAnalysis;
  (window as any).toggleSectionControls = toggleSectionControls;
  (window as any).toggleSizeControls = toggleSizeControls;
  (window as any).toggleSixRadBypassControls = toggleSixRadBypassControls;
  (window as any).toggleSixRadSizeControls = toggleSixRadSizeControls;
  (window as any).adjustSixRadCanvasWidth = adjustSixRadCanvasWidth;
  (window as any).adjustSixRadCanvasHeight = adjustSixRadCanvasHeight;
  (window as any).applySixRadCanvasWidth = applySixRadCanvasWidth;
  (window as any).applySixRadCanvasHeight = applySixRadCanvasHeight;
  (window as any).adjustSixRadViewScale = adjustSixRadViewScale;
  (window as any).applySixRadViewScale = applySixRadViewScale;
  (window as any).adjustSixRadValveRotation = adjustSixRadValveRotation;
  (window as any).applySixRadValveRotation = applySixRadValveRotation;
  (window as any).toggleResistance = toggleResistance;
  (window as any).toggleRiser = toggleRiser;
  (window as any).toggleRiserInfo = toggleRiserInfo;
  (window as any).toggleRiserFloors = toggleRiserFloors;
  (window as any).toggleRiserFormulas = toggleRiserFormulas;
  (window as any).recalcAll = recalcAll;
  (window as any).thawAll = thawAll;
  (window as any).debouncedRecalc = debouncedRecalc;
  (window as any).updateBypassDisplay = updateBypassDisplay;
  (window as any).updateHydroParams = updateHydroParams;
  (window as any).resetHydroParams = resetHydroParams;
  (window as any).riserOpenAll = riserOpenAll;
  (window as any).riserCloseAll = riserCloseAll;
  (window as any).riserCloseOne = riserCloseOne;
  (window as any).toggleRiserBypass = toggleRiserBypass;
  (window as any).setSixRadBypassPct = setSixRadBypassPct;
  (window as any).sixRadBypassAllOpen = sixRadBypassAllOpen;
  (window as any).sixRadBypassAllClosed = sixRadBypassAllClosed;
  (window as any).calcRiser = calcRiser;
  (window as any).downloadFullReport = downloadFullReport;
  (window as any).saveSettings = saveSettings;
  loadSettings();
  updateRadiatorLayout(st.radWidth, st.radHeight, st.radPosX, st.radPosY);
  setMode(st.mode);
  calcRiser();
  updateParticleParams();
  gameLoop();
}

init();