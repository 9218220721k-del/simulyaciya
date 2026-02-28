// ============================================================
// ФИЗИКА — тепловая модель (ε-NTU, баланс, равновесная температура)
// ============================================================
import {
  C_WATER,
  NOM,
  SECTIONS,
  clamp,
  lerp,
  lpmToKgs,
  kgsToLpm,
  T_INDOOR_DESIGN,
  FREEZE_THRESHOLD,
  THAW_THRESHOLD,
  MIN_FLOW_EPS,
  MIN_OPEN_FACTOR,
  NEWTON_MAX_ITER,
  NEWTON_TOL,
  NEWTON_DT_STEP,
  NEWTON_DF_MIN,
  FIRST2_VISUAL_BOOST,
  SECTIONS_4_10_COLD_OFFSET,
  DT_NOM_K,
  RADIATOR_EXPONENT_N,
} from './constants';
import * as st from './state';

function gv(id: string, def: number): number {
  const el = document.getElementById(id) as HTMLInputElement | null;
  const v = Number(el?.value ?? '');
  return Number.isFinite(v) ? v : def;
}

export function calcKroom(): number {
  const Q = gv('heatLossDesign', 1000);
  const t = gv('designOutTemp', -30);
  const d = T_INDOOR_DESIGN - t;
  return d <= 0 ? 20 : Q / d;
}

export function calibrateHA(p: number): number {
  const e = NOM.dT_water / (NOM.T_supply - NOM.T_room);
  const n = -Math.log(1 - e);
  const g = p / (C_WATER * NOM.dT_water);
  return n * g * C_WATER;
}

export function calcQradAtTroom(
  T_room: number,
  sT: number,
  sysKGS: number,
  hA: number,
  pps: number
): {
  totalPower: number;
  secPowers: number[];
  secRetTemps: number[];
  secFlowLPM: number[];
  secFlowKGS: number[];
  secEps: number[];
  secNTU: number[];
  avgRetTemp: number;
  frozenCount: number;
} {
  const powers: number[] = [];
  const retTemps: number[] = [];
  const flowsLPM: number[] = [];
  const flowsKGS: number[] = [];
  const epsArr: number[] = [];
  const ntuArr: number[] = [];
  let totP = 0;
  let wSum = 0;
  let wFlow = 0;
  let frozenCount = 0;

  for (let i = 0; i < SECTIONS; i++) {
    let secKGS = sysKGS * st.flowData.secFracs[i];
    let secLPM = kgsToLpm(secKGS);
    let Q = 0;
    let retT = sT;
    let eps = 0;
    let ntu = 0;

    if (st.frozenSections[i]) {
      // Проверка разморозки: если при текущих условиях retT был бы > THAW_THRESHOLD — размораживаем
      const secKGS_hyp = sysKGS * st.flowData.secFracs[i];
      if (secKGS_hyp > MIN_FLOW_EPS && st.openFactors[i] > MIN_OPEN_FACTOR && sT > T_room + 0.5) {
        const hAe = hA * st.openFactors[i];
        const ntu_hyp = hAe / (secKGS_hyp * C_WATER);
        const eps_hyp = 1 - Math.exp(-ntu_hyp);
        const Q_hyp = eps_hyp * secKGS_hyp * C_WATER * (sT - T_room);
        const retT_hyp = sT - Q_hyp / (secKGS_hyp * C_WATER);
        if (retT_hyp > THAW_THRESHOLD) {
          st.frozenSections[i] = false;
          // fall through — пересчитаем как обычную секцию ниже
        } else {
          secKGS = 0;
          secLPM = 0;
          Q = 0;
          retT = Math.min(T_room, 0);
          frozenCount++;
        }
      } else {
        secKGS = 0;
        secLPM = 0;
        Q = 0;
        retT = Math.min(T_room, 0);
        frozenCount++;
      }
    }
    if (!st.frozenSections[i] && secKGS > MIN_FLOW_EPS && st.openFactors[i] > MIN_OPEN_FACTOR && sT > T_room + 0.5) {
      const hAe = hA * st.openFactors[i];
      ntu = hAe / (secKGS * C_WATER);
      eps = 1 - Math.exp(-ntu);
      Q = eps * secKGS * C_WATER * (sT - T_room);
      retT = sT - Q / (secKGS * C_WATER);
      retT = clamp(retT, T_room, sT);
      const dT_mean = (sT + retT) / 2 - T_room;
      const tempCorr = dT_mean > 1 ? Math.pow(dT_mean / DT_NOM_K, RADIATOR_EXPONENT_N - 1) : 0;
      Q *= clamp(tempCorr, 0.3, 1.5);
      Q = Math.min(Q, pps * 1.5);
      retT = sT - Q / (secKGS * C_WATER);
      retT = clamp(retT, T_room, sT);

      if (retT <= FREEZE_THRESHOLD) {
        st.frozenSections[i] = true;
        secKGS = 0;
        secLPM = 0;
        Q = 0;
        retT = 0;
        frozenCount++;

        if (!st.freezeWarningShown) {
          console.error(`🚨 АВАРИЯ! Секция №${i + 1} ЗАМЕРЗЛА!`);
          st.setFreezeWarningShown(true);

          setTimeout(() => {
            if (confirm(`🚨 КРИТИЧЕСКАЯ АВАРИЯ!\n\nСекция №${i + 1} ЗАМЕРЗЛА при T=${retT.toFixed(1)}°C\nОбразовалась ледяная пробка!\n\nЦиркуляция остановлена. Давление льда разорвёт радиатор!\n\nНажмите OK для аварийного отключения системы.`)) {
              const flowEl = document.getElementById('systemFlow') as HTMLInputElement;
              if (flowEl) flowEl.value = '0';
              (window as Window & { recalcAll?: () => void }).recalcAll?.();
            }
          }, 100);
        }
      }
    }

    powers.push(Q);
    retTemps.push(retT);
    flowsLPM.push(secLPM);
    flowsKGS.push(secKGS);
    epsArr.push(eps);
    ntuArr.push(ntu);
    totP += Q;
    if (secKGS > MIN_FLOW_EPS) {
      wSum += retT * secKGS;
      wFlow += secKGS;
    }
  }

  if (frozenCount >= SECTIONS * 0.3) {
    st.setSystemFrozen(true);
  }

  const avgRetRad = wFlow > 0 ? wSum / wFlow : sT;
  const byKGS = sysKGS * st.flowData.bypassFrac;
  const mixRet = wFlow + byKGS > 0 ? (avgRetRad * wFlow + sT * byKGS) / (wFlow + byKGS) : sT;

  return {
    totalPower: totP,
    secPowers: powers,
    secRetTemps: retTemps,
    secFlowLPM: flowsLPM,
    secFlowKGS: flowsKGS,
    secEps: epsArr,
    secNTU: ntuArr,
    avgRetTemp: mixRet,
    frozenCount,
  };
}

export function calcSurfaceTemp(idx: number): number {
  const sT = st.thermal.supplyT || 70;
  const T_room = st.balance.T_room_eq || 20;
  const T_out = st.thermal.outsideT || -10;
  const pps = (st.thermal.nomPower || 2000) / SECTIONS;
  const power = st.thermal.secPowers[idx] || 0;
  const retT = st.thermal.secRetTemps[idx] || sT;
  const flowLPM = st.thermal.secFlowLPM[idx] || 0;
  const Q_loss_current = st.balance.Q_loss || 0;
  const Q_rad_total = st.thermal.totalPower || 0;

  if (st.frozenSections[idx]) {
    return Math.min(T_room, 0);
  }

  if (flowLPM < 0.001) {
    return T_room;
  }

  if (power < pps * 0.05) {
    return T_room;
  }

  const avg = (sT + retT) / 2;
  const pr = clamp(power / pps, 0, 1);
  let surfaceTemp = clamp(lerp(T_room, avg, Math.pow(pr, 0.6)), T_room, sT);

  const heatBalance = Q_loss_current / Math.max(Q_rad_total, 1);

  if (T_room < 18) {
    const tempFactor = clamp((18 - T_room) / 20, 0, 0.6);
    surfaceTemp = lerp(surfaceTemp, T_room, tempFactor);
  }

  if (heatBalance > 0.95) {
    const balanceFactor = clamp((heatBalance - 0.95) / 0.05, 0, 0.3);
    surfaceTemp = lerp(surfaceTemp, T_room, balanceFactor);
  }

  // Первые 2 секции всегда горячее визуально
  if (idx < 2 && !st.frozenSections[idx]) {
    surfaceTemp = lerp(surfaceTemp, sT, FIRST2_VISUAL_BOOST);
  }
  // Секции 4–10 на 4°C холоднее — меньше расхода
  if (idx >= 3 && !st.frozenSections[idx]) {
    surfaceTemp = Math.max(T_room, surfaceTemp - SECTIONS_4_10_COLD_OFFSET);
  }

  return clamp(surfaceTemp, T_room, sT);
}

export function updateSurfaceTemps(): void {
  for (let i = 0; i < SECTIONS; i++) {
    st.secSurfaceTemps[i] = calcSurfaceTemp(i);
  }
}

export function calcCollectorReturnTemps(): void {
  const sT = st.thermal.supplyT || 70;
  const T_room = st.balance.T_room_eq || 20;
  const secFlows = st.thermal.secFlowKGS.slice();
  const secRetT = st.thermal.secRetTemps.slice();
  const temps: number[] = [];

  if (st.mode === 'bad' && st.counterflowEnabled) {
    const maxReach = st.counterflowReachSection >= 0 ? st.counterflowReachSection : 4;

    let hotFlow = 0;
    let hotEnergy = 0;
    for (let i = 0; i < Math.min(3, SECTIONS); i++) {
      const f = secFlows[i] || 0;
      const t = secRetT[i] || T_room;
      if (f > 1e-8) {
        hotFlow += f;
        hotEnergy += f * t;
      }
    }
    const hotReturnT = hotFlow > 1e-8 ? hotEnergy / hotFlow : T_room;

    const counterflowFrac = 0.3;
    const G_cf = hotFlow * counterflowFrac;
    const UA_coll_seg = 0.055;

    for (let i = 0; i < SECTIONS; i++) {
      if (i <= maxReach && hotFlow > 1e-8) {
        const segmentsFromSource = Math.max(0, i);
        const coolPerSeg = G_cf > 1e-8 ? (UA_coll_seg * (hotReturnT - T_room)) / (G_cf * C_WATER) : 0;
        const collT = hotReturnT - segmentsFromSource * coolPerSeg;
        temps.push(Math.max(collT, T_room));
      } else {
        temps.push(st.secSurfaceTemps[i] || T_room);
      }
    }
  } else if (st.mode === 'bad' && !st.counterflowEnabled) {
    for (let i = 0; i < SECTIONS; i++) {
      temps.push(st.secSurfaceTemps[i] || T_room);
    }
  } else {
    let cumFlow = 0;
    let cumEnergy = 0;
    for (let i = SECTIONS - 1; i >= 0; i--) {
      const flow_i = secFlows[i] || 0;
      const retT_i = secRetT[i] || T_room;
      cumFlow += flow_i;
      cumEnergy += flow_i * retT_i;
    }
    const avgT = cumFlow > 1e-8 ? cumEnergy / cumFlow : T_room;
    for (let i = 0; i < SECTIONS; i++) {
      temps.push(avgT);
    }
  }
  for (let i = 0; i < SECTIONS; i++) st.collectorReturnTemps[i] = temps[i];
}

export function findEquilibriumTroom(): void {
  const nomP = gv('nominalPower', 2000);
  const Tout = gv('outsideTemp', -10);
  const Kroom = calcKroom();
  const Qint = gv('internalGains', 0);
  const sysLPM = gv('systemFlow', 4);
  const sysKGS = lpmToKgs(sysLPM);
  const sT = gv('supplyTemp', 70);
  const pps = nomP / SECTIONS;
  const hA = calibrateHA(pps);
  const heatLossDesign = gv('heatLossDesign', 1000);
  const designOutTemp = gv('designOutTemp', -30);

  st.balance.log = [];
  st.balance.fullLog = [];

  let T_room = 20;
  let converged = false;
  let iter = 0;

  for (iter = 0; iter < NEWTON_MAX_ITER; iter++) {
    const result = calcQradAtTroom(T_room, sT, sysKGS, hA, pps);
    const Q_rad = result.totalPower;
    const Q_loss = Kroom * (T_room - Tout) - Qint;
    const f = Q_rad - Q_loss;
    st.balance.log.push({ iter: iter + 1, T_room, Q_rad, Q_loss, f });
    st.balance.fullLog.push({ iter: iter + 1, T_room, Q_rad, Q_loss, f });
    if (Math.abs(f) < NEWTON_TOL) {
      converged = true;
      break;
    }
    const dT = NEWTON_DT_STEP;
    const r2 = calcQradAtTroom(T_room + dT, sT, sysKGS, hA, pps);
    const ql2 = Kroom * (T_room + dT - Tout) - Qint;
    const df = (r2.totalPower - ql2 - f) / dT;
    if (Math.abs(df) < NEWTON_DF_MIN) break;
    const delta = clamp(-f / df, -3, 3);
    T_room = clamp(T_room + delta, Tout + 1, sT - 0.5);
  }

  T_room = clamp(T_room, Tout + 1, 50);
  const fin = calcQradAtTroom(T_room, sT, sysKGS, hA, pps);

  st.balance.T_room_eq = T_room;
  st.balance.Q_rad = fin.totalPower;
  st.balance.Q_loss = Kroom * (T_room - Tout) - Qint;
  st.balance.iterations = iter + 1;
  st.balance.converged = converged;

  Object.assign(st.thermal, {
    hA_section: hA,
    secPowers: fin.secPowers,
    secRetTemps: fin.secRetTemps,
    secFlowLPM: fin.secFlowLPM,
    secFlowKGS: fin.secFlowKGS,
    secEps: fin.secEps,
    secNTU: fin.secNTU,
    totalPower: fin.totalPower,
    avgRetTemp: fin.avgRetTemp,
    supplyT: sT,
    nomPower: nomP,
    outsideT: Tout,
    Kroom,
    Qint,
    sysFlowLPM: sysLPM,
    sysFlowKGS: sysKGS,
    heatLossDesign,
    designOutTemp,
  });

  updateSurfaceTemps();
  calcCollectorReturnTemps();
}
