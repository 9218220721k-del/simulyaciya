// ============================================================
// ГИДРАВЛИКА — расчёты сопротивления, потоков, стояка
// ============================================================
import {
  PIPE_DATA,
  VALVE_DATA,
  HYDRO,
  SECTIONS,
  RISER_RADIATORS,
  C_WATER,
  clamp,
  lerp,
  lpmToKgs,
  kgsToLpm,
  tempToColor,
  COLLECTOR_SEGMENT_LENGTH,
  COLLECTOR_D_MM,
  BYPASS_OPEN_FIRST2_PCT,
  BYPASS_OPEN_THIRD_PCT,
} from './constants';
import * as st from './state';
import { calibrateHA } from './physics';

function gv(id: string, def: number): number {
  const el = document.getElementById(id) as HTMLInputElement | null;
  return parseFloat(el?.value || '') || def;
}

export function calcFrictionFactor(Re: number, d_m: number): number {
  if (Re < 1) return 0.1;
  const roughness = 0.00015;
  const relRough = roughness / d_m;

  function calcTurbLambda(re: number): number {
    const A = relRough / 3.7;
    const B = 5.74 / Math.pow(re, 0.9);
    const f_inv = -2 * Math.log10(A + B);
    return clamp(1 / (f_inv * f_inv), 0.008, 0.1);
  }

  if (Re <= 2320) return 64 / Re;
  if (Re >= 4000) return calcTurbLambda(Re);

  const lambda_lam = 64 / 2320;
  const lambda_turb = calcTurbLambda(4000);
  const t = (Re - 2320) / (4000 - 2320);
  return lerp(lambda_lam, lambda_turb, t);
}

export function calcPressureLoss(
  flowLPM: number,
  d_mm: number,
  length_m: number,
  zeta_local: number
): {
  h_friction: number;
  h_local: number;
  h_total: number;
  velocity: number;
  Re: number;
  lambda: number;
} {
  if (flowLPM <= 0.001) return { h_friction: 0, h_local: 0, h_total: 0, velocity: 0, Re: 0, lambda: 0 };
  d_mm = Math.max(d_mm, 0.1);
  const Q = flowLPM / 60000;
  const d = d_mm / 1000;
  const A = (Math.PI * d * d) / 4;
  const v = Q / A;
  const Re = (v * d) / HYDRO.nu;
  const lambda = calcFrictionFactor(Re, d);
  const p = (HYDRO.rho * v * v) / 2;
  const hf = lambda * (length_m / d) * p;
  const hl = zeta_local * p;
  const hfm = hf / (HYDRO.rho * HYDRO.g);
  const hlm = hl / (HYDRO.rho * HYDRO.g);
  return {
    h_friction: hfm,
    h_local: hlm,
    h_total: hfm + hlm,
    velocity: v,
    Re,
    lambda,
  };
}

export function calcSystemResistance(): void {
  const sysLPM = gv('systemFlow', 4);
  const bf = st.flowData.bypassLPM;
  const rf = st.flowData.radLPM;

  const valveOpen = st.bypassValveOpen / 100;
  const valveC = Math.log(VALVE_DATA.ball_valve_12.zeta_closed! / VALVE_DATA.ball_valve_12.zeta_open!);
  const zetaValve = VALVE_DATA.ball_valve_12.zeta_open! * Math.exp(valveC * (1 - valveOpen));
  const bz = VALVE_DATA.tee.zeta! + zetaValve + VALVE_DATA.tee.zeta!;

  const rz =
    VALVE_DATA.tee.zeta! +
    VALVE_DATA.ball_valve_34.zeta_open! +
    VALVE_DATA.radiator.zeta! +
    VALVE_DATA.ball_valve_34.zeta_open! +
    VALVE_DATA.tee.zeta!;

  const bl = calcPressureLoss(bf, PIPE_DATA.bypass_pipe.d_mm, PIPE_DATA.bypass_pipe.L_m, bz);
  const rl = calcPressureLoss(rf, PIPE_DATA.rad_pipe.d_mm, PIPE_DATA.rad_pipe.L_m, rz);
  const mainLoss = calcPressureLoss(sysLPM, PIPE_DATA.main_pipe.d_mm, PIPE_DATA.main_pipe.L_m, 0);

  const pl = (bl.h_total + rl.h_total) / 2;
  const hc = mainLoss.h_total + pl;

  const bzi = VALVE_DATA.tee.zeta! + VALVE_DATA.ball_valve_12.zeta_open! + VALVE_DATA.tee.zeta!;
  const d_bp = PIPE_DATA.bypass_pipe.d_mm / 1000;
  const d_rad = PIPE_DATA.rad_pipe.d_mm / 1000;
  const A_bp = (Math.PI * d_bp * d_bp) / 4;
  const A_rad = (Math.PI * d_rad * d_rad) / 4;
  const k_bp_i = A_bp / Math.sqrt(Math.max(bzi, 0.01));
  const k_rad_i = A_rad / Math.sqrt(Math.max(rz, 0.01));
  const k_tot_i = k_bp_i + k_rad_i;
  const bpFracI = k_tot_i > 1e-12 ? k_bp_i / k_tot_i : 0.5;
  const bli = calcPressureLoss(sysLPM * bpFracI, PIPE_DATA.bypass_pipe.d_mm, PIPE_DATA.bypass_pipe.L_m, bzi);
  const rli = calcPressureLoss(sysLPM * (1 - bpFracI), PIPE_DATA.rad_pipe.d_mm, PIPE_DATA.rad_pipe.L_m, rz);
  const pli = (bli.h_total + rli.h_total) / 2;
  const hi = mainLoss.h_total + pli;

  Object.assign(st.resistanceData, {
    bypass_path: {
      h_total: bl.h_total,
      h_friction: bl.h_friction,
      h_local: bl.h_local,
      velocity: bl.velocity,
      flow: bf,
      Re: bl.Re,
      lambda: bl.lambda,
    },
    radiator_path: {
      h_total: rl.h_total,
      h_friction: rl.h_friction,
      h_local: rl.h_local,
      velocity: rl.velocity,
      flow: rf,
      Re: rl.Re,
      lambda: rl.lambda,
    },
    system_total: {
      h_initial: hi,
      h_current: hc,
      ratio: hc / (hi > 0.001 ? hi : 1),
      main_before: mainLoss.h_total,
      main_after: 0,
    },
    flow: sysLPM,
  });
}

export function calcFlows(): void {
  const sysLPM = gv('systemFlow', 4);

  const valveOpen = st.bypassValveOpen / 100;
  const zetaValveOpen = VALVE_DATA.ball_valve_12.zeta_open!;
  const zetaValveClosed = VALVE_DATA.ball_valve_12.zeta_closed!;
  const valveC = Math.log(zetaValveClosed / zetaValveOpen);
  const zetaValve = zetaValveOpen * Math.exp(valveC * (1 - valveOpen));

  const zetaBypass = VALVE_DATA.tee.zeta! + zetaValve + VALVE_DATA.tee.zeta!;

  const avgO = st.openFactors.reduce((a, b) => a + b, 0) / SECTIONS;
  const zetaRadBase =
    VALVE_DATA.tee.zeta! +
    VALVE_DATA.ball_valve_34.zeta_open! +
    VALVE_DATA.radiator.zeta! +
    VALVE_DATA.ball_valve_34.zeta_open! +
    VALVE_DATA.tee.zeta!;
  const zetaRad = zetaRadBase / Math.max(Math.pow(clamp(avgO, 0.01, 1), 0.6), 0.01);

  const d_bp = PIPE_DATA.bypass_pipe.d_mm / 1000;
  const d_rad = PIPE_DATA.rad_pipe.d_mm / 1000;
  const A_bp = (Math.PI * d_bp * d_bp) / 4;
  const A_rad = (Math.PI * d_rad * d_rad) / 4;
  const k_bp = A_bp / Math.sqrt(Math.max(zetaBypass, 0.01));
  const k_rad = A_rad / Math.sqrt(Math.max(zetaRad, 0.01));
  const k_total = k_bp + k_rad;

  if (valveOpen < 0.01) {
    // Байпас полностью закрыт — весь расход через радиатор
    st.flowData.bypassFrac = 0;
    st.flowData.radFrac = 1;
  } else {
    st.flowData.bypassFrac = k_total > 1e-12 ? k_bp / k_total : 0;
    st.flowData.radFrac = k_total > 1e-12 ? k_rad / k_total : 0;
  }
  st.flowData.bypassLPM = sysLPM * st.flowData.bypassFrac;
  st.flowData.radLPM = sysLPM * st.flowData.radFrac;

  const radFrac = st.flowData.radFrac;
  let sf: number[];

  if (st.flowData.bypassFrac > 0.01) {
    // При открытом байпасе: первые 2 секции 50%, 3-я 10%, остальные поровну
    const first2Share = BYPASS_OPEN_FIRST2_PCT / 100;
    const thirdShare = BYPASS_OPEN_THIRD_PCT / 100;
    const restShare = 1 - first2Share - thirdShare;
    const restCount = Math.max(SECTIONS - 3, 1);
    sf = [];
    for (let i = 0; i < SECTIONS; i++) {
      let frac: number;
      if (i < 2) frac = (first2Share / 2) * radFrac;
      else if (i === 2) frac = thirdShare * radFrac;
      else frac = (restShare / restCount) * radFrac;
      sf.push(frac * clamp(st.openFactors[i], 0.01, 1));
    }
    const sumSf = sf.reduce((a, b) => a + b, 0);
    if (sumSf > 1e-12) {
      for (let i = 0; i < SECTIONS; i++) sf[i] = (sf[i] / sumSf) * radFrac;
    }
  } else {
    // Байпас закрыт — физически обоснованное распределение
    const d_coll = COLLECTOR_D_MM / 1000;
    const A_section = (Math.PI * d_coll * d_coll) / 4;
    const lambda_coll = 0.025;
    const k_arr: number[] = [];
    let sum_k = 0;
    for (let i = 0; i < SECTIONS; i++) {
      const of = clamp(st.openFactors[i], 0.01, 1);
      const zeta_valve = zetaRadBase / Math.pow(of, 0.6);
      const L_coll = COLLECTOR_SEGMENT_LENGTH * i;
      const zeta_coll = L_coll > 0 ? lambda_coll * (L_coll / d_coll) : 0;
      const zeta_i = zeta_valve + zeta_coll;
      const k_i = A_section / Math.sqrt(Math.max(zeta_i, 0.01));
      k_arr.push(k_i);
      sum_k += k_i;
    }
    sf = sum_k > 1e-12
      ? k_arr.map((k) => (k / sum_k) * radFrac)
      : Array(SECTIONS).fill(radFrac / SECTIONS);
  }
  st.flowData.secFracs = sf;
  calcSystemResistance();
}

export function calcRiser(): void {
  const Tsupply = parseFloat((document.getElementById('riser-supply-temp') as HTMLInputElement)?.value || '') || 80;
  const flowLPM = parseFloat((document.getElementById('riser-flow') as HTMLInputElement)?.value || '') || 6;
  const radPowerNom = parseFloat((document.getElementById('riser-rad-power') as HTMLInputElement)?.value || '') || 1500;
  const Troom = parseFloat((document.getElementById('riser-room-temp') as HTMLInputElement)?.value || '') || 20;
  const stoyakD = parseFloat((document.getElementById('riser-pipe-d') as HTMLInputElement)?.value || '') || 25.4;
  const bypassD = parseFloat((document.getElementById('riser-bypass-d') as HTMLInputElement)?.value || '') || 20.4;
  const radPipeD = PIPE_DATA.rad_pipe.d_mm;
  const N = RISER_RADIATORS;

  const zetaBypassOpen = VALVE_DATA.tee.zeta! + VALVE_DATA.ball_valve_12.zeta_open! + VALVE_DATA.tee.zeta!;
  const zetaRadNode =
    VALVE_DATA.tee.zeta! +
    VALVE_DATA.ball_valve_34.zeta_open! +
    VALVE_DATA.radiator.zeta! +
    VALVE_DATA.ball_valve_34.zeta_open! +
    VALVE_DATA.tee.zeta!;
  const floorHeight = 3.0;
  const valveC = Math.log(VALVE_DATA.ball_valve_12.zeta_closed! / VALVE_DATA.ball_valve_12.zeta_open!);

  function zetaBypassAtOpenPct(openPct: number): number {
    const pct = Math.max(0, Math.min(100, openPct));
    const zetaValve = VALVE_DATA.ball_valve_12.zeta_open! * Math.exp(valveC * (1 - pct / 100));
    return VALVE_DATA.tee.zeta! + zetaValve + VALVE_DATA.tee.zeta!;
  }

  const estQ = flowLPM / 60000;
  const estD = stoyakD / 1000;
  const estA = (Math.PI * estD * estD) / 4;
  const estV = estA > 0 ? estQ / estA : 0.5;
  const estRe = (estV * estD) / HYDRO.nu;
  const lambdaStoyak = calcFrictionFactor(estRe, estD);

  const A_stoyak = Math.PI * Math.pow(stoyakD / 2000, 2);
  const A_bp_riser = Math.PI * Math.pow(bypassD / 2000, 2);
  const A_rad_riser = Math.PI * Math.pow(radPipeD / 2000, 2);

  const K_bp_node_base = A_bp_riser / Math.sqrt(Math.max(zetaBypassOpen, 0.01));
  const K_rad_node = A_rad_riser / Math.sqrt(Math.max(zetaRadNode, 0.01));

  let totalZetaBase = 0;
  let totalZetaCurrent = 0;
  let closedCount = 0;

  for (let i = 0; i < N; i++) {
    const pipeLoss_zeta = lambdaStoyak * (floorHeight / estD);
    let K_bp_node: number;
    let bypassEffectiveOpen: boolean;
    if (i < 6) {
      const openPct = st.sixRadBypassOpenPct[i];
      bypassEffectiveOpen = openPct >= 5;
      const zetaBp = zetaBypassAtOpenPct(openPct);
      K_bp_node = A_bp_riser / Math.sqrt(Math.max(zetaBp, 0.01));
    } else {
      bypassEffectiveOpen = st.riserBypassOpen[i];
      K_bp_node = bypassEffectiveOpen ? K_bp_node_base : 0;
    }
    const zetaNodeOpen = (A_stoyak * A_stoyak) / Math.pow(K_bp_node + K_rad_node, 2);
    totalZetaBase += (A_stoyak * A_stoyak) / Math.pow(K_bp_node_base + K_rad_node, 2) + pipeLoss_zeta;

    if (bypassEffectiveOpen) {
      totalZetaCurrent += zetaNodeOpen + pipeLoss_zeta;
    } else {
      const zetaNodeClosed = zetaRadNode * Math.pow(A_stoyak / A_rad_riser, 2);
      totalZetaCurrent += zetaNodeClosed + pipeLoss_zeta;
      closedCount++;
    }
  }

  const flowRatio = Math.sqrt(totalZetaBase / totalZetaCurrent);
  const actualFlowLPM = flowLPM * flowRatio;
  const actualFlowKGS = lpmToKgs(actualFlowLPM);
  const flowDropPercent = (1 - flowRatio) * 100;
  const pps = radPowerNom;
  const hA_rad = calibrateHA(pps);
  const U_pipe = 10;
  const floors: {
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
  }[] = [];

  let Tin = Tsupply;

  for (let i = 0; i < N; i++) {
    let K_bp_i: number;
    let bypassOpen_i: boolean;
    if (i < 6) {
      const openPct = st.sixRadBypassOpenPct[i];
      bypassOpen_i = openPct >= 5;
      const zetaBp = zetaBypassAtOpenPct(openPct);
      K_bp_i = A_bp_riser / Math.sqrt(Math.max(zetaBp, 0.01));
    } else {
      bypassOpen_i = st.riserBypassOpen[i];
      K_bp_i = bypassOpen_i ? K_bp_node_base : 0;
    }

    const floor = Math.ceil((N - i) / 2);
    const isSecondOnFloor = (N - i) % 2 === 0;
    let radFlowFraction: number;

    if (!bypassOpen_i) {
      radFlowFraction = 1.0;
    } else {
      radFlowFraction = K_rad_node / (K_rad_node + K_bp_i);
      radFlowFraction = clamp(radFlowFraction, 0.05, 0.95);
    }

    const radFlowKGS = actualFlowKGS * radFlowFraction;
    const radFlowLPM = kgsToLpm(radFlowKGS);
    let Q = 0;
    let Tout_rad = Tin;
    let eps = 0;
    let ntu = 0;

    if (radFlowKGS > 1e-7 && Tin > Troom + 0.5) {
      ntu = hA_rad / (radFlowKGS * C_WATER);
      eps = 1 - Math.exp(-ntu);
      Q = eps * radFlowKGS * C_WATER * (Tin - Troom);
      Q = Math.min(Q, pps * 1.5);
      Tout_rad = Tin - Q / (radFlowKGS * C_WATER);
      Tout_rad = clamp(Tout_rad, Troom, Tin);
    }

    const bypassFlowKGS = actualFlowKGS * (1 - radFlowFraction);
    let Tmix: number;
    if (actualFlowKGS > 1e-7) {
      Tmix = (Tout_rad * radFlowKGS + Tin * bypassFlowKGS) / actualFlowKGS;
    } else {
      Tmix = Tin;
    }

    const Q_pipeLoss = U_pipe * Math.PI * estD * floorHeight * (Tmix - Troom);
    const pipeLoss = actualFlowKGS > 1e-7 ? Q_pipeLoss / (actualFlowKGS * C_WATER) : 0;
    const Tout_node = Tmix - clamp(pipeLoss, 0, Tmix - Troom);

    floors.push({
      index: i,
      floor,
      isSecondOnFloor,
      bypassOpen: bypassOpen_i,
      Tin,
      Tout: Tout_node,
      Tout_rad,
      Q,
      eps,
      ntu,
      radFlowLPM,
      radFlowFraction,
      totalFlowLPM: actualFlowLPM,
      deltaT: Tin - Tout_node,
      pipeLoss,
    });

    Tin = Tout_node;
  }

  const Treturn = floors[N - 1].Tout;
  const totalDeltaT = Tsupply - Treturn;

  st.setRiserResults({
    floors,
    supplyTemp: Tsupply,
    returnTemp: Treturn,
    totalDeltaT,
    baseFlowLPM: flowLPM,
    actualFlowLPM,
    flowDropPercent,
    closedCount,
    flowRatio,
  });

  updateRiserUI();
}

export function riserOpenAll(): void {
  st.riserBypassOpen.fill(true);
  calcRiser();
  (window as Window & { saveSettings?: () => void }).saveSettings?.();
}

export function riserCloseAll(): void {
  st.riserBypassOpen.fill(false);
  calcRiser();
  (window as Window & { saveSettings?: () => void }).saveSettings?.();
}

export function riserCloseOne(): void {
  st.riserBypassOpen.fill(true);
  st.riserBypassOpen[0] = false;
  calcRiser();
  (window as Window & { saveSettings?: () => void }).saveSettings?.();
}

export function toggleRiserBypass(idx: number): void {
  st.riserBypassOpen[idx] = !st.riserBypassOpen[idx];
  calcRiser();
  (window as Window & { saveSettings?: () => void }).saveSettings?.();
}

export function updateRiserUI(): void {
  if (!st.riserResults) return;
  const r = st.riserResults;

  const totalFlowEl = document.getElementById('riser-total-flow');
  const deltaTEl = document.getElementById('riser-delta-t');
  const flowDropEl = document.getElementById('riser-flow-drop');
  const returnTempEl = document.getElementById('riser-return-temp');

  if (totalFlowEl) totalFlowEl.textContent = r.actualFlowLPM.toFixed(2);
  if (deltaTEl) deltaTEl.textContent = r.totalDeltaT.toFixed(1);
  if (flowDropEl) flowDropEl.textContent = r.flowDropPercent.toFixed(1);
  if (returnTempEl) returnTempEl.textContent = r.returnTemp.toFixed(1);

  const container = document.getElementById('riser-floors-container');
  let html = '';
  const maxT = r.supplyTemp;

  for (let i = 0; i < r.floors.length; i++) {
    const f = r.floors[i];
    const floorLabel = f.isSecondOnFloor ? `${f.floor}э (б)` : `${f.floor}э (а)`;
    const tempPct = clamp(((f.Tin - 20) / (maxT - 20)) * 100, 5, 100);
    const cIn = tempToColor(f.Tin, maxT, 20);
    const cOut = tempToColor(f.Tout, maxT, 20);
    const bgColor = f.bypassOpen ? 'rgba(220,252,231,0.5)' : 'rgba(254,226,226,0.5)';
    const statusEmoji = f.Tin > 50 ? '🔥' : f.Tin > 35 ? '🌡' : '❄️';
    html += `<div class="riser-floor-row" style="background:${bgColor}">
   <div class="flex items-center gap-2">
    <div class="riser-floor-indicator" style="background:rgb(${cIn.r},${cIn.g},${cIn.b})">${i + 1}</div>
    <span class="text-xs font-bold">${floorLabel}</span>
   </div>
   <div>
    <div class="flex items-center gap-2">
     <span class="font-bold" style="color:rgb(${cIn.r},${cIn.g},${cIn.b})">${f.Tin.toFixed(1)}°</span>
     <span class="text-slate-400">→</span>
     <span class="font-bold" style="color:rgb(${cOut.r},${cOut.g},${cOut.b})">${f.Tout.toFixed(1)}°</span>
     <span class="text-xs text-slate-500">(ΔT=${f.deltaT.toFixed(1)}°)</span>
    </div>
    <div class="riser-temp-bar mt-1" style="background:#e5e7eb">
     <div class="riser-temp-bar-fill" style="width:${tempPct}%;background:linear-gradient(90deg,rgb(${cOut.r},${cOut.g},${cOut.b}),rgb(${cIn.r},${cIn.g},${cIn.b}))"></div>
    </div>
   </div>
   <div class="text-center">
    <div class="font-bold text-sky-700">${f.radFlowLPM.toFixed(2)}</div>
    <div class="text-xs text-slate-500">${(f.radFlowFraction * 100).toFixed(0)}% рад</div>
   </div>
   <div class="text-center">
    <div class="font-bold text-orange-700">${f.Q.toFixed(0)} Вт</div>
    <div class="text-xs text-slate-500">ε=${(f.eps * 100).toFixed(0)}%</div>
   </div>
   <div class="text-center">
    <button class="riser-bypass-toggle ${f.bypassOpen ? 'open' : 'closed'}" onclick="toggleRiserBypass(${i})" title="${f.bypassOpen ? 'Открыта — нажми закрыть' : 'Закрыта — нажми открыть'}"></button>
    <div class="text-xs mt-1 ${f.bypassOpen ? 'text-green-600' : 'text-red-600'}">${f.bypassOpen ? 'Откр.' : 'Закр.'}</div>
   </div>
   <div class="text-center text-lg">${statusEmoji}</div>
  </div>`;
  }

  if (container) container.innerHTML = html;

  const verdict = document.getElementById('riser-verdict');
  const lastFloor = r.floors[r.floors.length - 1];
  const tempDrop = r.supplyTemp - lastFloor.Tin;

  if (r.closedCount > 0) {
    let warnHtml = `<div class="riser-warning">
   <div class="text-sm font-bold text-red-800 mb-2">⚠ ВНИМАНИЕ: ${r.closedCount} перемычек закрыто!</div>
   <div class="text-xs text-red-700">
   <p>🔧 <strong>Расход упал на ${r.flowDropPercent.toFixed(1)}%</strong> (было ${r.baseFlowLPM.toFixed(1)} → стало ${r.actualFlowLPM.toFixed(2)} л/мин)</p>
   <p>🌡 <strong>Температура на входе последнего радиатора: ${lastFloor.Tin.toFixed(1)}°C</strong> (подача была ${r.supplyTemp}°C, потеряно ${tempDrop.toFixed(1)}°C)</p>
   <p>❄️ Последний радиатор получает воду на <strong>${tempDrop.toFixed(1)}°C холоднее</strong> чем первый</p>`;
    if (lastFloor.Tin < 40) {
      warnHtml += `<p class="mt-2 font-bold text-red-900">🚨 КРИТИЧНО: Температура ниже 40°C — последние радиаторы практически не греют!</p>`;
    }
    warnHtml += `</div></div>`;
    if (verdict) verdict.innerHTML = warnHtml;
  } else {
    if (verdict) {
      verdict.innerHTML = `<div class="riser-ok">
   <div class="text-sm font-bold text-green-800 mb-1">✅ Все перемычки открыты — нормальный режим</div>
   <div class="text-xs text-green-700">
   <p>Расход стояка: ${r.actualFlowLPM.toFixed(2)} л/мин</p>
   <p>Перепад температур по стояку: ${r.totalDeltaT.toFixed(1)}°C (${r.supplyTemp}° → ${r.returnTemp.toFixed(1)}°)</p>
   <p>Последний радиатор получает воду ${lastFloor.Tin.toFixed(1)}°C (на ${tempDrop.toFixed(1)}°C холоднее первого)</p>
   </div>
  </div>`;
    }
  }
}
