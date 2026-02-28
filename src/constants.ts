// ============================================================
// КОНСТАНТЫ, НАЧАЛЬНОЕ СОСТОЯНИЕ, ЦВЕТА
// ============================================================

// ========== CANVAS & GEOMETRY ==========
export const SECTIONS = 10;
export const collH = 28;
export let secTopY = 260;
export let secBotY = 620;
export let topCollY = secTopY - collH - 4;
export let botCollY = secBotY + 4;
export let outletY = topCollY + collH / 2;
export let inletY = botCollY + collH / 2;
export const L = {
  bypassX: 120,
  bypassW: 12,
  valveX: 255,
  pipeH: 20,
  radStartX: 300,
  radEndX: 1540,
  get secTopY() { return secTopY; },
  get secBotY() { return secBotY; },
  collH,
  get topCollY() { return topCollY; },
  get botCollY() { return botCollY; },
  get outletY() { return outletY; },
  get inletY() { return inletY; },
};
const VALVE_TO_RAD_OFFSET = 45;
const BYPASS_TO_RAD_OFFSET = 180;
export function updateRadiatorLayout(width: number, height: number, posX: number, posY: number): void {
  L.radStartX = posX;
  L.radEndX = L.radStartX + width;
  L.valveX = posX - VALVE_TO_RAD_OFFSET;
  L.bypassX = posX - BYPASS_TO_RAD_OFFSET;
  secTopY = posY;
  secBotY = secTopY + height;
  topCollY = secTopY - collH - 4;
  botCollY = secBotY + 4;
  outletY = topCollY + collH / 2;
  inletY = botCollY + collH / 2;
}

// ========== PHYSICAL CONSTANTS ==========
export const C_WATER = 4186;
export const ALPHA_BAD = 0.35;
export const NOM = {
  T_supply: 75,
  T_return: 65,
  T_room: 20,
  dT_water: 10,
};
// Режим 95/85/20: ΔT_nom = (95+85)/2 - 20 = 70 K. Для 75/65/20: ΔT_nom = 50 K
export const DT_NOM_K = 50;
export const RADIATOR_EXPONENT_N = 1.3;  // для секционных радиаторов (EN 442)
export const COLD_THRESHOLD = 30;
export const T_INDOOR_DESIGN = 20;
export const RISER_RADIATORS = 10;

// ========== FREEZE / THAW ==========
export const FREEZE_THRESHOLD = 2.0;   // retT ≤ this → секция замерзает
export const THAW_THRESHOLD = 5.0;     // при retT > this → секция размораживается

// ========== NUMERICAL ==========
export const MIN_FLOW_EPS = 1e-7;      // минимальный расход для расчёта
export const MIN_OPEN_FACTOR = 0.01;   // минимальное открытие клапана
export const NEWTON_MAX_ITER = 100;    // макс. итераций Ньютона
export const NEWTON_TOL = 0.01;        // порог сходимости |f| < this
export const NEWTON_DT_STEP = 0.05;   // шаг для численной производной
export const NEWTON_DF_MIN = 1e-8;    // мин. |df| для избежания деления на ноль

// ========== PIPE & VALVE DATA (mutable) ==========
export const PIPE_DATA: {
  main_pipe: { dn: number; d_mm: number; name: string; L_m: number };
  bypass_pipe: { dn: number; d_mm: number; name: string; L_m: number };
  rad_pipe: { dn: number; d_mm: number; name: string; L_m: number };
} = {
  main_pipe: { dn: 20, d_mm: 20.4, name: 'Труба 3/4"', L_m: 2.0 },
  bypass_pipe: { dn: 15, d_mm: 15.6, name: 'Байпас 1/2"', L_m: 1.0 },
  rad_pipe: { dn: 20, d_mm: 20.4, name: 'Подводка 3/4"', L_m: 1.5 },
};

export const VALVE_DATA: {
  ball_valve_34: { zeta_open: number; zeta_mid: number; zeta_closed: number; name: string };
  ball_valve_12: { zeta_open: number; zeta_mid: number; zeta_closed: number; name: string };
  tee: { zeta: number; name: string };
  elbow_90: { zeta: number; name: string };
  radiator: { zeta: number; name: string };
} = {
  ball_valve_34: { zeta_open: 0.3, zeta_mid: 50, zeta_closed: 500, name: 'Шаровой кран 3/4"' },
  ball_valve_12: { zeta_open: 0.5, zeta_mid: 80, zeta_closed: 800, name: 'Шаровой кран 1/2"' },
  tee: { zeta: 1.5, name: 'Тройник' },
  elbow_90: { zeta: 1.2, name: 'Отвод 90°' },
  radiator: { zeta: 3.0, name: 'Радиатор' },
};

export const HYDRO = {
  rho: 985,
  nu: 0.415e-6,
  g: 9.81,
  lambda: 0.025,
};

// ========== RADIATOR COLLECTOR (for physics-based flow distribution) ==========
export const COLLECTOR_SEGMENT_LENGTH = 0.1;  // м — длина сегмента коллектора на одну секцию
export const COLLECTOR_D_MM = 20.4;            // мм — диаметр коллектора (как rad_pipe)
export const SECTION_HEIGHT_M = 0.5;           // м — высота столба воды в секции

// ========== РАСЧЁТ РАСХОДА — при открытом байпасе ==========
export const BYPASS_OPEN_FIRST2_PCT = 50;   // % — первые 2 секции
export const BYPASS_OPEN_THIRD_PCT = 10;    // % — 3-я секция
// остальные секции делят оставшиеся % поровну

// ========== ВИЗУАЛЬНОЕ УСИЛЕНИЕ ==========
export const FIRST2_VISUAL_BOOST = 0.2;      // первые 2 секции всегда горячее визуально (0..1)
export const SECTIONS_4_10_COLD_OFFSET = 4;     // секции 4–10 на 4°C холоднее визуально

// ========== PARTICLE INITIAL PARAMS ==========
export const particleParams = {
  heatLossCoeff: 0.03,
  particlesPerLiter: 50,
  gravityForce: 0.03,
};

export const particleStats = {
  activeCount: 0,
  avgTemp: 0,
  bySection: [] as number[],
  coldCount: 0,
  stallCount: 0,
};

// ========== UTILITY ==========
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const lpmToKgs = (l: number, rho = HYDRO.rho): number => (l / 60000) * rho;
export const kgsToLpm = (k: number, rho = HYDRO.rho): number => (k * 60000) / rho;

export const STORAGE_KEY = 'radiator_thermal_v1';

// ========== TEMP TO COLOR ==========
export function tempToColor(
  temp: number,
  maxT: number,
  minT: number = 20
): { r: number; g: number; b: number } {
  if (maxT <= minT) maxT = minT + 1;
  if (temp <= COLD_THRESHOLD) {
    const coldMin = Math.min(minT, COLD_THRESHOLD - 1);
    const ratio = clamp((temp - coldMin) / (COLD_THRESHOLD - coldMin), 0, 1);
    let r: number, g: number, b: number;
    if (ratio < 0.25) {
      const t = ratio / 0.25;
      r = lerp(15, 25, t);
      g = lerp(20, 40, t);
      b = lerp(100, 140, t);
    } else if (ratio < 0.5) {
      const t = (ratio - 0.25) / 0.25;
      r = lerp(25, 40, t);
      g = lerp(40, 70, t);
      b = lerp(140, 185, t);
    } else if (ratio < 0.75) {
      const t = (ratio - 0.5) / 0.25;
      r = lerp(40, 65, t);
      g = lerp(70, 115, t);
      b = lerp(185, 210, t);
    } else {
      const t = (ratio - 0.75) / 0.25;
      r = lerp(65, 100, t);
      g = lerp(115, 155, t);
      b = lerp(210, 225, t);
    }
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
  } else {
    const hotMax = Math.max(maxT, COLD_THRESHOLD + 1);
    const ratio = clamp((temp - COLD_THRESHOLD) / (hotMax - COLD_THRESHOLD), 0, 1);
    let r: number, g: number, b: number;
    if (ratio < 0.2) {
      const t = ratio / 0.2;
      r = lerp(180, 210, t);
      g = lerp(130, 105, t);
      b = lerp(140, 110, t);
    } else if (ratio < 0.4) {
      const t = (ratio - 0.2) / 0.2;
      r = lerp(210, 225, t);
      g = lerp(105, 80, t);
      b = lerp(110, 80, t);
    } else if (ratio < 0.6) {
      const t = (ratio - 0.4) / 0.2;
      r = lerp(225, 230, t);
      g = lerp(80, 55, t);
      b = lerp(80, 50, t);
    } else if (ratio < 0.8) {
      const t = (ratio - 0.6) / 0.2;
      r = lerp(230, 215, t);
      g = lerp(55, 35, t);
      b = lerp(50, 35, t);
    } else {
      const t = (ratio - 0.8) / 0.2;
      r = lerp(215, 170, t);
      g = lerp(35, 15, t);
      b = lerp(35, 20, t);
    }
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
  }
}

export function tCSS(t: number, mx: number, a: number = 1): string {
  const c = tempToColor(t, mx);
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}
