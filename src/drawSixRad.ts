// ============================================================
// Визуализация 6 радиаторов — полный порт из проекта «6 радиаторов» src/draw.ts
// С частицами для визуализации расхода
// ============================================================
import { tempToColor } from './constants';
import * as st from './state';

const PHYS_COUNT = 90;
const PX_PER_FRAME_PER_LPM = 2.8;

const r2 = (v: number) => Math.round(Number(v) * 2) / 2;

function getViewScale(): number {
  return st.sixRadViewScale;
}
const COLS = 2;
const ROWS = 3;
const RAD_COUNT = 6;

function supplyRiserX(): number { return Math.round(81 * getViewScale()); }
function rightSupplyRiserX(): number { return Math.round(978 * getViewScale()); }
const pw = 8;
const pwNarrow = 5;
function radW(): number { return Math.round(196 * getViewScale()); }
function radH(): number { return Math.round(115 * getViewScale()); }
function radRowH(): number { return Math.round(184 * getViewScale()); }
function radStartY(): number { return Math.round(150 * getViewScale()); }
function colCenters(): [number, number] {
  const sx = supplyRiserX(), rsx = rightSupplyRiserX(), dx = rsx - sx;
  return [Math.round(sx + dx * 0.28), Math.round(sx + dx * 0.72)];
}
function refW(): number { return Math.round(1200 * getViewScale()); }
function refH(): number { return Math.round(700 * getViewScale()); }
function topY(): number { return Math.round(50 * getViewScale()); }
function botY(): number { return refH() - Math.round(35 * getViewScale()); }

function rad1Y(): number { return radStartY() + 2 * radRowH(); }
function rad2Y(): number { return radStartY() + 1 * radRowH(); }
function rad3Y(): number { return radStartY() + 0 * radRowH(); }
function pipe1Y1(): number { return rad1Y() - 1; }
function pipe1Y2(): number { return rad1Y() + radH() + 7; }
function pipe2Y1(): number { return rad2Y() - 4 + 3; }
function pipe2Y2(): number { return rad2Y() + radH() + 4 + 3; }
function pipe3Y1(): number { return rad3Y() - 4 + 3; }
function pipe3Y2(): number { return rad3Y() + radH() + 4 + 3; }
const riserUpOffset = 10;
const riserDownOffset = 14;
function pipe3Y2Riser(): number { return pipe3Y2() - riserUpOffset; }
function pipe2Y2Riser(): number { return pipe2Y2() - riserUpOffset; }
function pipe1Y2Riser(): number { return pipe1Y2() - riserUpOffset; }
function pipe2Y1Riser(): number { return pipe2Y1() + riserDownOffset; }
function pipe1Y1Riser(): number { return pipe1Y1() + riserDownOffset; }
const overlap = 4;
function topHeaderBottomY(): number { return pipe3Y1() + 14; }
const valveOffset = 10;
function off(): number { return Math.round(22 * getViewScale()); }

/** Cylindrical-gradient pipe (pill-shaped) — как в 6 радиаторов */
function drawHP(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  if (w <= 0 || h <= 0) return;
  const xx = r2(x);
  const yy = r2(y);
  const ww = r2(w);
  const hh = r2(h);
  const capR = Math.min(ww, hh) / 2;
  const safe = Math.min(capR, ww / 2, hh / 2);
  const isHoriz = ww >= hh;

  ctx.beginPath();
  ctx.moveTo(xx + safe, yy);
  ctx.lineTo(xx + ww - safe, yy);
  ctx.arcTo(xx + ww, yy, xx + ww, yy + safe, safe);
  ctx.lineTo(xx + ww, yy + hh - safe);
  ctx.arcTo(xx + ww, yy + hh, xx + ww - safe, yy + hh, safe);
  ctx.lineTo(xx + safe, yy + hh);
  ctx.arcTo(xx, yy + hh, xx, yy + hh - safe, safe);
  ctx.lineTo(xx, yy + safe);
  ctx.arcTo(xx, yy, xx + safe, yy, safe);
  ctx.closePath();

  const g = isHoriz
    ? ctx.createLinearGradient(xx, yy, xx, yy + hh)
    : ctx.createLinearGradient(xx, yy, xx + ww, yy);
  g.addColorStop(0, 'rgba(65,  90,  115, 1)');
  g.addColorStop(0.18, 'rgba(155, 180, 205, 1)');
  g.addColorStop(0.40, 'rgba(235, 248, 255, 1)');
  g.addColorStop(0.57, 'rgba(195, 218, 235, 1)');
  g.addColorStop(0.80, 'rgba(140, 165, 190, 1)');
  g.addColorStop(1, 'rgba(65,  90,  115, 1)');
  ctx.fillStyle = g;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(xx + safe, yy);
  ctx.lineTo(xx + ww - safe, yy);
  ctx.arcTo(xx + ww, yy, xx + ww, yy + safe, safe);
  ctx.lineTo(xx + ww, yy + hh - safe);
  ctx.arcTo(xx + ww, yy + hh, xx + ww - safe, yy + hh, safe);
  ctx.lineTo(xx + safe, yy + hh);
  ctx.arcTo(xx, yy + hh, xx, yy + hh - safe, safe);
  ctx.lineTo(xx, yy + safe);
  ctx.arcTo(xx, yy, xx + safe, yy, safe);
  ctx.closePath();
  ctx.strokeStyle = 'rgba(50, 75, 100, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Верхняя ∩ труба с U-образными закруглениями */
function drawTopHeaderPipe(ctx: CanvasRenderingContext2D): void {
  const sx = supplyRiserX();
  const rsx = rightSupplyRiserX();
  const R = pw * 2;

  const tracePath = () => {
    ctx.beginPath();
    ctx.moveTo(sx, topHeaderBottomY());
    ctx.lineTo(sx, topY() + R);
    ctx.arcTo(sx, topY(), sx + R, topY(), R);
    ctx.lineTo(rsx - R, topY());
    ctx.arcTo(rsx, topY(), rsx, topY() + R, R);
    ctx.lineTo(rsx, topHeaderBottomY());
  };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  tracePath();
  ctx.strokeStyle = 'rgb(52, 74, 98)';
  ctx.lineWidth = pw;
  ctx.stroke();
  tracePath();
  ctx.strokeStyle = 'rgb(148, 175, 202)';
  ctx.lineWidth = pw * 0.72;
  ctx.stroke();
  tracePath();
  ctx.strokeStyle = 'rgba(232, 247, 255, 0.92)';
  ctx.lineWidth = pw * 0.30;
  ctx.stroke();
  ctx.restore();
}

/**
 * Шаровой кран на байпасе 1/2" — рисуется прямо на трубе (riserX, centerY).
 * Символ: «бантик» (два треугольника вершинами к центру, горизонтально) + ручка.
 * Ручка: закрыт = вдоль байпаса (вертикально), открыт = поперёк (горизонтально).
 */
function drawBypassValve(ctx: CanvasRenderingContext2D, riserX: number, centerY: number, openPct: number, side: 'left' | 'right'): void {
  const cx = r2(riserX);
  const cy = r2(centerY);
  const s = 8;   // полуразмер треугольников
  const isOpen = openPct >= 50;
  const fillColor = isOpen ? 'rgba(74, 222, 128, 0.95)' : 'rgba(248, 113, 113, 0.95)';

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((st.sixRadValveRotationDegrees * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // --- Тень ---
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.moveTo(cx - s + 1.5, cy - s + 1.5);
  ctx.lineTo(cx + 1.5,     cy + 1.5);
  ctx.lineTo(cx + s + 1.5, cy - s + 1.5);
  ctx.lineTo(cx + s + 1.5, cy + s + 1.5);
  ctx.lineTo(cx + 1.5,     cy + 1.5);
  ctx.lineTo(cx - s + 1.5, cy + s + 1.5);
  ctx.closePath();
  ctx.fill();

  // --- Левый треугольник (вершина → право) ---
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - s, cy - s);
  ctx.lineTo(cx,     cy);
  ctx.lineTo(cx - s, cy + s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // --- Правый треугольник (вершина → лево) ---
  ctx.beginPath();
  ctx.moveTo(cx + s, cy - s);
  ctx.lineTo(cx,     cy);
  ctx.lineTo(cx + s, cy + s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // --- Горизонтальная линия поверх (закрывает зазор между треугольниками) ---
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - s, cy);
  ctx.lineTo(cx + s, cy);
  ctx.stroke();

  // --- Ручка: закрыт = вдоль байпаса (вертикально), открыт = поперёк (горизонтально) ---
  const handDir = side === 'left' ? 1 : -1;
  const angleRad = (openPct / 100) * (Math.PI / 2);
  const stemLen = 14;
  const knobHalf = 6;
  const endX = cx + stemLen * Math.sin(angleRad) * handDir;
  const endY = cy - stemLen * Math.cos(angleRad);
  const perpX = Math.cos(angleRad);
  const perpY = Math.sin(angleRad) * handDir;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(endX - knobHalf * perpX, endY - knobHalf * perpY);
  ctx.lineTo(endX + knobHalf * perpX, endY + knobHalf * perpY);
  ctx.stroke();

  ctx.restore();
}

function drawRiserLabels(ctx: CanvasRenderingContext2D, riserX: number, side: 'left' | 'right'): void {
  const narrowPairs: [number, number][] = [
    [pipe3Y1(), pipe3Y2Riser() + overlap],
    [pipe2Y1Riser() - overlap, pipe2Y2Riser() + overlap],
    [pipe1Y1Riser() - overlap, pipe1Y2Riser() + overlap],
  ];
  const angle = side === 'left' ? -Math.PI / 2 : Math.PI / 2;
  const labelX = side === 'left' ? riserX - off() : riserX + off();
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [y1, y2] of narrowPairs) {
    ctx.save();
    ctx.translate(labelX, (y1 + y2) / 2);
    ctx.rotate(angle);
    ctx.fillText('1/2', 0, 0);
    ctx.restore();
  }
  ctx.save();
  const baseY = botY() + Math.round(6 * getViewScale());
  const triX = riserX + pw / 2 + Math.round(18 * getViewScale());
  const labelOffset = Math.round(25 * getViewScale());
  const triY = r2(baseY + (side === 'left' ? 4 / 3 : -4 / 3));
  ctx.font = 'bold 14px Inter';
  ctx.textAlign = side === 'left' ? 'left' : 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('стояк 3/4', side === 'left' ? triX + labelOffset : triX - labelOffset, triY);
  ctx.restore();
}

function drawVerticalRisers(ctx: CanvasRenderingContext2D): void {
  const sx = supplyRiserX();
  const rsx = rightSupplyRiserX();

  drawHP(ctx, sx - pwNarrow / 2, pipe3Y1(), pwNarrow, pipe3Y2Riser() - pipe3Y1() + overlap);
  drawHP(ctx, rsx - pwNarrow / 2, pipe3Y1(), pwNarrow, pipe3Y2Riser() - pipe3Y1() + overlap);
  drawTopHeaderPipe(ctx);

  drawHP(ctx, sx - pw / 2, pipe3Y2Riser() - overlap, pw, pipe2Y1Riser() - (pipe3Y2Riser() - overlap));
  drawHP(ctx, sx - pwNarrow / 2, pipe2Y1Riser() - overlap, pwNarrow, pipe2Y2Riser() - (pipe2Y1Riser() - overlap) + overlap);
  drawHP(ctx, sx - pw / 2, pipe2Y2Riser() - overlap, pw, pipe1Y1Riser() - (pipe2Y2Riser() - overlap));
  drawHP(ctx, sx - pwNarrow / 2, pipe1Y1Riser() - overlap, pwNarrow, pipe1Y2Riser() - (pipe1Y1Riser() - overlap) + overlap);
  drawHP(ctx, sx - pw / 2, pipe1Y2Riser() - overlap, pw, botY() - (pipe1Y2Riser() - overlap));

  drawRiserLabels(ctx, sx, 'left');
  const narrowPairs: [number, number][] = [
    [pipe3Y1(), pipe3Y2Riser() + overlap],
    [pipe2Y1Riser() - overlap, pipe2Y2Riser() + overlap],
    [pipe1Y1Riser() - overlap, pipe1Y2Riser() + overlap],
  ];
  for (let i = 0; i < 3; i++) {
    const centerY = (narrowPairs[i][0] + narrowPairs[i][1]) / 2;
    drawBypassValve(ctx, sx, centerY, st.sixRadBypassOpenPct[2 - i], 'left');
  }

  const ax = sx + pw / 2 + Math.round(18 * getViewScale());
  const ay = botY() + Math.round(6 * getViewScale());
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ax, ay - 12);
  ctx.lineTo(ax - 8, ay + 8);
  ctx.lineTo(ax + 8, ay + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  drawHP(ctx, rsx - pw / 2, pipe3Y2Riser() - overlap, pw, pipe2Y1Riser() - (pipe3Y2Riser() - overlap));
  drawHP(ctx, rsx - pwNarrow / 2, pipe2Y1Riser() - overlap, pwNarrow, pipe2Y2Riser() - (pipe2Y1Riser() - overlap) + overlap);
  drawHP(ctx, rsx - pw / 2, pipe2Y2Riser() - overlap, pw, pipe1Y1Riser() - (pipe2Y2Riser() - overlap));
  drawHP(ctx, rsx - pwNarrow / 2, pipe1Y1Riser() - overlap, pwNarrow, pipe1Y2Riser() - (pipe1Y1Riser() - overlap) + overlap);
  drawHP(ctx, rsx - pw / 2, pipe1Y2Riser() - overlap, pw, botY() - (pipe1Y2Riser() - overlap));

  drawRiserLabels(ctx, rsx, 'right');
  for (let i = 0; i < 3; i++) {
    const centerY = (narrowPairs[i][0] + narrowPairs[i][1]) / 2;
    drawBypassValve(ctx, rsx, centerY, st.sixRadBypassOpenPct[5 - i], 'right');
  }

  const rax = rsx + pw / 2 + Math.round(18 * getViewScale());
  const ray = botY() + Math.round(6 * getViewScale());
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(rax, ray + 12);
  ctx.lineTo(rax - 8, ray - 8);
  ctx.lineTo(rax + 8, ray - 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function roundR(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = typeof (ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect === 'function';
  if (rr) {
    (ctx as CanvasRenderingContext2D & { roundRect: (a: number, b: number, c: number, d: number, e: number) => void }).roundRect(x, y, w, h, r);
  } else {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
  }
}

function drawRadiatorUnit(ctx: CanvasRenderingContext2D, radX: number, radY: number, w: number, h: number, idx: number): void {
  const rx = r2(radX);
  const ry = r2(radY);
  const ww = r2(w);
  const hh = r2(h);
  const sT = st.thermal.supplyT || 70;
  const surfaceTemp = 70 - idx * 4;
  const sc = tempToColor(surfaceTemp, sT, 20);

  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillRect(rx + 3, ry + 3, ww, hh);
  const bodyGrad = ctx.createLinearGradient(rx, 0, rx + ww, 0);
  bodyGrad.addColorStop(0, `rgba(${Math.max(sc.r - 30, 0)},${Math.max(sc.g - 30, 0)},${Math.max(sc.b - 30, 0)},1)`);
  bodyGrad.addColorStop(0.5, `rgba(${Math.min(sc.r + 60, 255)},${Math.min(sc.g + 60, 255)},${Math.min(sc.b + 60, 255)},1)`);
  bodyGrad.addColorStop(1, `rgba(${Math.max(sc.r - 30, 0)},${Math.max(sc.g - 30, 0)},${Math.max(sc.b - 30, 0)},1)`);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  roundR(ctx, rx, ry, ww, hh, 4);
  ctx.fill();
  const secCount = 8;
  const secSpacing = ww / (secCount + 1);
  ctx.strokeStyle = `rgba(${Math.max(sc.r - 60, 0)},${Math.max(sc.g - 60, 0)},${Math.max(sc.b - 60, 0)},0.25)`;
  for (let s = 1; s <= secCount; s++) {
    const sx = rx + s * secSpacing;
    ctx.beginPath();
    ctx.moveTo(sx, ry + 2);
    ctx.lineTo(sx, ry + hh - 2);
    ctx.stroke();
  }

  const col = idx % COLS;
  const row = Math.floor(idx / COLS);
  const displayNum = col === 0 ? ROWS - row : ROWS + row + 1;
  const sw = pw;
  const topYr = ry - 2;
  const botYr = ry + hh;
  const collH = 6;
  const pr = 2;

  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  roundR(ctx, rx - 2, topYr - 2, ww + 4, collH + 4, pr);
  ctx.fill();
  ctx.fillStyle = 'rgba(50,50,220,0.35)';
  ctx.beginPath();
  roundR(ctx, rx, topYr, ww, collH, pr);
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundR(ctx, rx, topYr, ww, collH, pr);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  roundR(ctx, rx - 2, botYr - 2, ww + 4, collH + 4, pr);
  ctx.fill();
  ctx.fillStyle = 'rgba(220,50,50,0.35)';
  ctx.beginPath();
  roundR(ctx, rx, botYr, ww, collH, pr);
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundR(ctx, rx, botYr, ww, collH, pr);
  ctx.stroke();

  const isLeft = displayNum === 1 || displayNum === 2 || displayNum === 3;
  const riserX = isLeft ? supplyRiserX() : rightSupplyRiserX();
  const valveX = isLeft ? rx - valveOffset : rx + ww + valveOffset;
  const valveBody = 8;
  const pipeStartX = isLeft ? riserX : valveX + valveBody;
  const pipeEndX = isLeft ? valveX - valveBody : riserX;
  const pipeLen = pipeEndX - pipeStartX;
  const pipeY1 = topYr + collH / 2;
  const pipeY2 = botYr + collH / 2;

  drawHP(ctx, pipeStartX, pipeY1 - sw / 2, pipeLen, sw);
  drawHP(ctx, pipeStartX, pipeY2 - sw / 2, pipeLen, sw);

  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(valveX, pipeY1);
  ctx.lineTo(valveX - 8, pipeY1 - 6);
  ctx.lineTo(valveX - 8, pipeY1 + 6);
  ctx.closePath();
  ctx.moveTo(valveX, pipeY1);
  ctx.lineTo(valveX + 8, pipeY1 - 6);
  ctx.lineTo(valveX + 8, pipeY1 + 6);
  ctx.closePath();
  ctx.moveTo(valveX, pipeY1);
  ctx.lineTo(valveX, pipeY1 - 8);
  ctx.moveTo(valveX - 4, pipeY1 - 8);
  ctx.lineTo(valveX + 4, pipeY1 - 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(valveX, pipeY2);
  ctx.lineTo(valveX - 8, pipeY2 - 6);
  ctx.lineTo(valveX - 8, pipeY2 + 6);
  ctx.closePath();
  ctx.moveTo(valveX, pipeY2);
  ctx.lineTo(valveX + 8, pipeY2 - 6);
  ctx.lineTo(valveX + 8, pipeY2 + 6);
  ctx.closePath();
  ctx.moveTo(valveX, pipeY2);
  ctx.lineTo(valveX, pipeY2 - 8);
  ctx.moveTo(valveX - 4, pipeY2 - 8);
  ctx.lineTo(valveX + 4, pipeY2 - 8);
  ctx.stroke();

  const labelX = r2(pipeStartX + pipeLen / 2);
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 11px Inter';
  ctx.fillText('3/4', labelX, pipeY1 + sw / 2 + 12);
  ctx.fillText('3/4', labelX, pipeY2 - sw / 2 - 10);

  ctx.font = 'bold 18px Inter';
  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${displayNum}`, rx + ww / 2, ry - 8);
}

// ══════════════════════════════════════════════════════════════════════════
//  VERIFIED TOPOLOGY (scale 1.15, coordinates in canvas pixels):
//
//  LEFT riser  — flow UP (y decreases):
//    bot=765 → pipeY2_row2=732 → [rad/bypass] → pipeY1_row2=598
//            → pipeY2_row1=520 → [rad/bypass] → pipeY1_row1=386
//            → pipeY2_row0=308 → [rad/bypass] → pipeY1_row0=174
//            → arch peak (topY≈57) → across → arch peak right
//
//  RIGHT riser — flow DOWN (y increases):
//    arch peak → pipeY1_row0=174 → [rad/bypass] → pipeY2_row0=308
//              → pipeY1_row1=386 → [rad/bypass] → pipeY2_row1=520
//              → pipeY1_row2=598 → [rad/bypass] → pipeY2_row2=732
//              → bot=765
//
//  LEFT  rads: enter at pipeY2 (bottom), exit at pipeY1 (top)   – flow UP
//  RIGHT rads: enter at pipeY1 (top),   exit at pipeY2 (bottom) – flow DOWN
//
//  fi mapping → sixRadBypassOpenPct index:
//    fi=0 → [0] → bottom-left (row2, hottest)
//    fi=1 → [1] → middle-left (row1)
//    fi=2 → [2] → top-left    (row0)
//    fi=3 → [3] → top-right   (row0)
//    fi=4 → [4] → middle-right(row1)
//    fi=5 → [5] → bottom-right(row2, coolest)
// ══════════════════════════════════════════════════════════════════════════

interface TSeg {
  x1: number; y1: number; x2: number; y2: number;
  len: number; tS: number; tE: number; jit: number;
}

interface PhysPart6 {
  dist: number; goesRad: boolean[];
  speedMult: number; opacity: number; size: number;
  spawned: boolean;
}

const physParts6: PhysPart6[] = [];

// ── Helpers ───────────────────────────────────────────────────────────────
function floorD(fi: number) {
  const f = st.riserResults?.floors[fi];
  const sT = st.thermal.supplyT || 70;
  if (!f) return { Tin: sT - fi * 4, Trad: sT - fi * 4 - 8, Tout: sT - fi * 4 - 5, frac: 0.3 };
  return { Tin: f.Tin, Trad: f.Tout_rad, Tout: f.Tout, frac: f.radFlowFraction };
}

// Exact pipeY1 / pipeY2 for a given row (matches drawRadiatorUnit):
//   ry = radStartY() + row * radRowH()
//   pipeY1 = ry - 2 + collH/2 = ry + 1
//   pipeY2 = ry + radH() + collH/2 + 1 = ry + radH() + 3
function py(row: number): { y1: number; y2: number } {
  const ry = radStartY() + row * radRowH();
  return { y1: ry + 1, y2: ry + radH() + 3 };
}

// ── Build full circuit path for one particle ──────────────────────────────
function buildPath6(goesRad: boolean[]): TSeg[] {
  const segs: TSeg[] = [];
  const push = (
    x1: number, y1: number, x2: number, y2: number,
    tS: number, tE: number, jit = 0
  ) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len > 0.5) segs.push({ x1, y1, x2, y2, len, tS, tE, jit });
  };

  const sx   = supplyRiserX();
  const rsx  = rightSupplyRiserX();
  const arc  = topY(); // arch peak y ≈ 57
  const bot  = botY(); // ≈ 765
  const [lcx, rcx] = colCenters();
  const lEdge = lcx - radW() / 2;   // left edge of left radiator body
  const rEdge = rcx + radW() / 2;   // right edge of right radiator body

  let cx = sx, cy = bot;
  const sT = st.riserResults?.supplyTemp ?? (st.thermal.supplyT || 70);
  let ct = sT; // current temperature

  // ── LEFT RISER: flow UP (y decreases) ─────────────────────────────────
  // fi=0→row2(bottom-left), fi=1→row1(middle-left), fi=2→row0(top-left)
  for (let fi = 0; fi < 3; fi++) {
    const row = 2 - fi;                  // row2, row1, row0
    const { y1, y2 } = py(row);         // y2=bottom tee, y1=top tee
    const { Tin, Trad, Tout } = floorD(fi);

    // Up riser to bottom tee
    push(cx, cy, sx, y2, ct, Tin, 0);
    cx = sx; cy = y2; ct = Tin;

    if (goesRad[fi]) {
      // → right along bottom pipe to radiator body
      push(cx, cy, lEdge, y2, ct, ct, 0);
      // ↑ UP through radiator body (temperature drops Tin → Trad)
      push(lEdge, y2, lEdge, y1, ct, Trad, 0);
      // ← left along top pipe back to riser
      push(lEdge, y1, sx, y1, Trad, Trad, 0);
    } else {
      // Bypass: stay on riser with slight offset to distinguish
      push(cx, cy, sx, y1, Tin, Tout, 3);
    }
    cx = sx; cy = y1; ct = Tout;
  }

  // ↑ Left riser up to arch peak
  push(cx, cy, sx, arc, ct, ct, 0);
  // → Across arch top
  push(sx, arc, rsx, arc, ct, ct, 0);
  cx = rsx; cy = arc;

  // ── RIGHT RISER: flow DOWN (y increases) ──────────────────────────────
  // fi=3→row0(top-right), fi=4→row1(middle-right), fi=5→row2(bottom-right)
  for (let fi = 3; fi < 6; fi++) {
    const row = fi - 3;                  // row0, row1, row2
    const { y1, y2 } = py(row);         // y1=top tee (entry), y2=bottom tee (exit)
    const { Tin, Trad, Tout } = floorD(fi);

    // ↓ Down riser to top tee
    push(cx, cy, rsx, y1, ct, Tin, 0);
    cx = rsx; cy = y1; ct = Tin;

    if (goesRad[fi]) {
      // ← left along top pipe to radiator body
      push(cx, cy, rEdge, y1, ct, ct, 0);
      // ↓ DOWN through radiator body (temperature drops Tin → Trad)
      push(rEdge, y1, rEdge, y2, ct, Trad, 0);
      // → right along bottom pipe back to riser
      push(rEdge, y2, rsx, y2, Trad, Trad, 0);
    } else {
      // Bypass: straight down riser
      push(cx, cy, rsx, y2, Tin, Tout, -3);
    }
    cx = rsx; cy = y2; ct = Tout;
  }

  // ↓ Right riser down to exit
  push(cx, cy, rsx, bot, ct, ct, 0);
  return segs;
}

// ── Interpolate position and temperature at pixel distance `dist` ─────────
function pathAt6(segs: TSeg[], dist: number): { x: number; y: number; temp: number } {
  let rem = dist;
  for (const s of segs) {
    if (rem <= s.len) {
      const f = s.len > 0 ? rem / s.len : 0;
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1, L = s.len;
      const nx = L > 0 ? -dy / L : 0, ny = L > 0 ? dx / L : 0;
      return {
        x:    s.x1 + dx * f + nx * s.jit,
        y:    s.y1 + dy * f + ny * s.jit,
        temp: s.tS + (s.tE - s.tS) * f,
      };
    }
    rem -= s.len;
  }
  const last = segs[segs.length - 1];
  return { x: last.x2, y: last.y2, temp: last.tE };
}

function totalLen6(segs: TSeg[]): number {
  return segs.reduce((a, s) => a + s.len, 0);
}

function makeGoesRad(): boolean[] {
  return Array.from({ length: 6 }, (_, fi) => {
    const frac = st.riserResults?.floors[fi]?.radFlowFraction ?? 0.3;
    return Math.random() < frac;
  });
}

// ── Update ────────────────────────────────────────────────────────────────
function updatePhysParts6(): void {
  while (physParts6.length < PHYS_COUNT) {
    physParts6.push({
      dist: 0, goesRad: makeGoesRad(),
      speedMult: 0.7 + Math.random() * 0.6,
      opacity: 0.78 + Math.random() * 0.22,
      size: 2.8 + Math.random() * 1.4,
      spawned: false,
    });
  }

  // Stagger across circuit on first frame
  if (physParts6.some(p => !p.spawned)) {
    const refLen = totalLen6(buildPath6(Array(6).fill(true)));
    physParts6.forEach((p, i) => {
      if (!p.spawned) {
        p.dist = (i / PHYS_COUNT) * refLen;
        p.spawned = true;
      }
    });
  }

  const lpm = Math.max(st.riserResults?.actualFlowLPM ?? 2, 0.1);
  for (const p of physParts6) {
    const segs = buildPath6(p.goesRad);
    const len  = totalLen6(segs);
    if (len < 1) continue;
    p.dist += lpm * PX_PER_FRAME_PER_LPM * p.speedMult;
    if (p.dist >= len) {
      p.dist -= len;
      p.goesRad   = makeGoesRad();
      p.speedMult = 0.7 + Math.random() * 0.6;
    }
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────
function drawPhysParts6(ctx: CanvasRenderingContext2D): void {
  const lpm     = Math.max(st.riserResults?.actualFlowLPM ?? 2, 0.1);
  const supplyT = st.riserResults?.supplyTemp ?? (st.thermal.supplyT || 70);
  const retT    = st.riserResults?.returnTemp ?? (supplyT - 15);

  for (const p of physParts6) {
    const segs = buildPath6(p.goesRad);
    const len  = totalLen6(segs);
    if (len < 1) continue;

    const { x, y, temp } = pathAt6(segs, Math.min(p.dist, len - 0.5));
    const c   = tempToColor(temp, supplyT, retT - 5);
    const cx  = r2(x), cy = r2(y);
    const rad = p.size * (0.88 + Math.min(lpm / 8, 0.22));

    ctx.globalAlpha = p.opacity;

    // Outer glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 2.8);
    glow.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.38)`);
    glow.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 2.8, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Core sphere
    const b  = (v: number) => Math.min(v + 60, 255);
    const dk = (v: number) => Math.max(v - 30, 0);
    const core = ctx.createRadialGradient(cx - rad * 0.3, cy - rad * 0.3, 0, cx, cy, rad);
    core.addColorStop(0,    `rgba(${b(c.r)},${b(c.g)},${b(c.b)},1)`);
    core.addColorStop(0.55, `rgba(${c.r},${c.g},${c.b},1)`);
    core.addColorStop(1,    `rgba(${dk(c.r)},${dk(c.g)},${dk(c.b)},0.88)`);
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.88, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.36)';
    ctx.lineWidth   = 0.6;
    ctx.stroke();

    ctx.globalAlpha = 1;
  }
}

export function renderSixRadFull(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, stripH: number): void {
  const contentH = canvasH - stripH;
  const rW = refW(), rH = refH();
  const scale = Math.min(canvasW / rW, contentH / rH);
  const offsetX = (canvasW - rW * scale) / 2;
  const offsetY = stripH + (contentH - rH * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  drawVerticalRisers(ctx);
  const centers = colCenters();
  for (let i = 0; i < RAD_COUNT; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const radX = centers[col] - radW() / 2;
    const radY = radStartY() + row * radRowH();
    drawRadiatorUnit(ctx, radX, radY, radW(), radH(), i);
  }
  updatePhysParts6();
  drawPhysParts6(ctx);
  ctx.restore();
}
