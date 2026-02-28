// ============================================================
// ФУНКЦИИ РИСОВАНИЯ (drawRadiator, drawCollectors, drawPipes и т.д.)
// ============================================================
import {
  L,
  SECTIONS,
  tempToColor,
  tCSS,
  clamp,
  COLD_THRESHOLD,
} from './constants';
import * as st from './state';
import { renderSixRadFull } from './drawSixRad';

const CANVAS_BELOW_STRIP_H = 50;

/** Рисует скруглённый прямоугольник (roundRect с fallback на path для старых браузеров) */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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

function drawBG(): void {
  const g = st.ctx.createLinearGradient(0, 0, 0, st.canvas.height);
  g.addColorStop(0, '#fef3c7');
  g.addColorStop(0.5, '#fefce8');
  g.addColorStop(1, '#ecfdf5');
  st.ctx.fillStyle = g;
  st.ctx.fillRect(0, 0, st.canvas.width, st.canvas.height);
  st.ctx.fillStyle = '#78716c';
  st.ctx.fillRect(0, st.canvas.height - 30, st.canvas.width, 30);
}

/**
 * Вертикальный участок трубы — идентичный стиль с drawHP.
 * Градиент идёт горизонтально (слева направо) — создаёт 3D-цилиндрический эффект.
 * Используется вместо drawPipeElbow для единообразия отображения труб.
 */
function drawVP(x: number, y: number, w: number, h: number, type: string): void {
  if (h <= 0 || w <= 0) return;
  // Тень
  st.ctx.fillStyle = 'rgba(0,0,0,0.08)';
  st.ctx.fillRect(x + 2, y + 2, w, h);
  // Градиент слева направо (3D-эффект вертикальной трубы)
  const g = st.ctx.createLinearGradient(x, 0, x + w, 0);
  if (type === 'hot') {
    g.addColorStop(0, '#fca5a5');
    g.addColorStop(0.5, '#fef2f2');
    g.addColorStop(1, '#fca5a5');
  } else {
    g.addColorStop(0, '#93c5fd');
    g.addColorStop(0.5, '#eff6ff');
    g.addColorStop(1, '#93c5fd');
  }
  st.ctx.fillStyle = g;
  st.ctx.fillRect(x, y, w, h);
  st.ctx.strokeStyle = type === 'hot' ? '#f87171' : '#60a5fa';
  st.ctx.lineWidth = 1.5;
  st.ctx.strokeRect(x, y, w, h);
}

function drawHP(x: number, y: number, w: number, h: number, type: string, cornerRadius = 0): void {
  if (w <= 0) return;
  const r = cornerRadius > 0 ? Math.min(cornerRadius, w / 2, h / 2) : 0;
  st.ctx.fillStyle = 'rgba(0,0,0,0.08)';
  if (r > 0) {
    st.ctx.beginPath();
    roundRect(st.ctx, x + 2, y + 2, w, h, r);
    st.ctx.fill();
  } else {
    st.ctx.fillRect(x + 2, y + 2, w, h);
  }
  const g = st.ctx.createLinearGradient(0, y, 0, y + h);
  if (type === 'hot') {
    g.addColorStop(0, '#fca5a5');
    g.addColorStop(0.5, '#fef2f2');
    g.addColorStop(1, '#fca5a5');
  } else {
    g.addColorStop(0, '#93c5fd');
    g.addColorStop(0.5, '#eff6ff');
    g.addColorStop(1, '#93c5fd');
  }
  st.ctx.fillStyle = g;
  if (r > 0) {
    st.ctx.beginPath();
    roundRect(st.ctx, x, y, w, h, r);
    st.ctx.fill();
  } else {
    st.ctx.fillRect(x, y, w, h);
  }
  st.ctx.strokeStyle = type === 'hot' ? '#f87171' : '#60a5fa';
  st.ctx.lineWidth = 1.5;
  if (r > 0) {
    st.ctx.beginPath();
    roundRect(st.ctx, x, y, w, h, r);
    st.ctx.stroke();
  } else {
    st.ctx.strokeRect(x, y, w, h);
  }
}

function drawBallValve(ctx: CanvasRenderingContext2D, cx: number, cy: number, leverColor: string, leverLight: string, leverDark: string, stemUp: boolean, showRightHex = true): void {
  // Chrome body
  const bW = 36, bH = 20;
  const bodyG = ctx.createLinearGradient(cx - bW, cy - bH / 2, cx - bW, cy + bH / 2);
  bodyG.addColorStop(0, '#b0b0b0');
  bodyG.addColorStop(0.25, '#f0f0f0');
  bodyG.addColorStop(0.5, '#ffffff');
  bodyG.addColorStop(0.75, '#c8c8c8');
  bodyG.addColorStop(1, '#888');
  ctx.fillStyle = bodyG;
  ctx.beginPath();
  roundRect(ctx, cx - bW, cy - bH / 2, bW * 2, bH, bH / 2);
  ctx.fill();
  ctx.strokeStyle = '#686868';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Right hex nut (optional — hidden for bypass)
  if (showRightHex) {
    const hxW = 24, hxH = 24;
    const hx0 = cx + bW;
    const hexG = ctx.createLinearGradient(hx0, cy - hxH / 2, hx0, cy + hxH / 2);
    hexG.addColorStop(0, '#a0a0a0');
    hexG.addColorStop(0.4, '#e8e8e8');
    hexG.addColorStop(1, '#707070');
    ctx.fillStyle = hexG;
    ctx.beginPath();
    ctx.moveTo(hx0 + 4, cy - hxH / 2);
    ctx.lineTo(hx0 + hxW, cy - hxH / 2 + 5);
    ctx.lineTo(hx0 + hxW, cy + hxH / 2 - 5);
    ctx.lineTo(hx0 + 4, cy + hxH / 2);
    ctx.lineTo(hx0, cy + hxH / 2 - 2);
    ctx.lineTo(hx0, cy - hxH / 2 + 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#606060';
    ctx.lineWidth = 1;
    ctx.stroke();
    const boreG = ctx.createRadialGradient(hx0 + hxW / 2 + 2, cy, 1, hx0 + hxW / 2 + 2, cy, 7);
    boreG.addColorStop(0, '#b8860b');
    boreG.addColorStop(1, '#6b4e0b');
    ctx.fillStyle = boreG;
    ctx.beginPath();
    ctx.arc(hx0 + hxW / 2 + 3, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stem
  const stemDir = stemUp ? -1 : 1;
  const stemH = 24;
  const stemX0 = cx - 4, stemY0 = stemDir < 0 ? cy - stemH : cy;
  const stemG = ctx.createLinearGradient(cx - 4, stemY0, cx + 4, stemY0);
  stemG.addColorStop(0, '#c0c0c0');
  stemG.addColorStop(0.5, '#fff');
  stemG.addColorStop(1, '#a0a0a0');
  ctx.fillStyle = stemG;
  ctx.beginPath();
  roundRect(ctx, stemX0, stemY0, 8, stemH, 2);
  ctx.fill();
  ctx.strokeStyle = '#909090';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Chrome ball at stem tip
  const bx = cx, by = cy + stemDir * stemH;
  const ballG = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, 8);
  ballG.addColorStop(0, '#ffffff');
  ballG.addColorStop(0.4, '#d8d8d8');
  ballG.addColorStop(1, '#707070');
  ctx.fillStyle = ballG;
  ctx.beginPath();
  ctx.arc(bx, by, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#606060';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Butterfly lever wings
  const lw = 28, lh = 10;
  const ly = by + stemDir * 4;
  const lgL = ctx.createLinearGradient(cx - lw, ly - lh, cx, ly + lh);
  lgL.addColorStop(0, leverLight);
  lgL.addColorStop(1, leverDark);
  ctx.fillStyle = lgL;
  ctx.beginPath();
  ctx.moveTo(cx, ly - 2);
  ctx.bezierCurveTo(cx - 8, ly - lh - 2, cx - lw, ly - lh + 2, cx - lw, ly + 2);
  ctx.bezierCurveTo(cx - lw, ly + lh, cx - 8, ly + lh - 2, cx, ly + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = leverDark;
  ctx.lineWidth = 1;
  ctx.stroke();

  const lgR = ctx.createLinearGradient(cx, ly - lh, cx + lw, ly + lh);
  lgR.addColorStop(0, leverLight);
  lgR.addColorStop(1, leverDark);
  ctx.fillStyle = lgR;
  ctx.beginPath();
  ctx.moveTo(cx, ly - 2);
  ctx.bezierCurveTo(cx + 8, ly - lh - 2, cx + lw, ly - lh + 2, cx + lw, ly + 2);
  ctx.bezierCurveTo(cx + lw, ly + lh, cx + 8, ly + lh - 2, cx, ly + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = leverDark;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawValve(x: number, y: number, hot: boolean): void {
  st.ctx.save();
  const lc = hot ? '#e53935' : '#1e88e5';
  const ll = hot ? '#ff7043' : '#64b5f6';
  const ld = hot ? '#b71c1c' : '#0d47a1';
  drawBallValve(st.ctx, x, y, lc, ll, ld, true);
  st.ctx.restore();
}

function drawBypassValveVisual(): void {
  const bx = L.bypassX;
  const by = (L.outletY + L.inletY) / 2;
  const vo = st.bypassValveOpen / 100;
  const sc = vo > 0.5 ? '#e53935' : vo > 0 ? '#f59e0b' : '#546e7a';
  const sl = vo > 0.5 ? '#ff7043' : vo > 0 ? '#ffca28' : '#90a4ae';
  const sd = vo > 0.5 ? '#b71c1c' : vo > 0 ? '#e65100' : '#263238';

  st.ctx.save();
  // Draw valve body rotated 90° (vertical flow), scaled down for 1/2" bypass
  st.ctx.translate(bx, by);
  st.ctx.scale(0.65, 0.65);
  st.ctx.rotate(Math.PI / 2);
  drawBallValve(st.ctx, 0, 0, sc, sl, sd, true, false);
  st.ctx.restore();

  // Percent label
  st.ctx.fillStyle = '#475569';
  st.ctx.font = 'bold 13px Inter';
  st.ctx.textAlign = 'center';
  st.ctx.textBaseline = 'alphabetic';
  st.ctx.fillText(`${st.bypassValveOpen}%`, bx + 28, by + 6);
}

function drawBypass(): void {
  const bw = L.bypassW;
  const x = L.bypassX - bw / 2;
  const tY = L.outletY - L.pipeH / 2;
  const bY = L.inletY + L.pipeH / 2;
  const h = bY - tY;
  const op = 0.3 + 0.7 * (st.bypassValveOpen / 100);
  st.ctx.save();
  st.ctx.globalAlpha = op;
  st.ctx.fillStyle = 'rgba(0,0,0,0.08)';
  st.ctx.fillRect(x + 3, tY + 3, bw, h);
  const g = st.ctx.createLinearGradient(x, 0, x + bw, 0);
  g.addColorStop(0, '#71717a');
  g.addColorStop(0.5, '#d4d4d8');
  g.addColorStop(1, '#71717a');
  st.ctx.fillStyle = g;
  st.ctx.fillRect(x, tY, bw, h);
  st.ctx.strokeStyle = '#52525b';
  st.ctx.lineWidth = 1;
  st.ctx.strokeRect(x, tY, bw, h);
  st.ctx.fillStyle = '#b0b0b0';
  const flangeW = Math.max(bw + 6, 14);
  st.ctx.beginPath();
  roundRect(st.ctx, x - (flangeW - bw) / 2, tY - 3, flangeW, 8, 3);
  st.ctx.fill();
  st.ctx.beginPath();
  roundRect(st.ctx, x - (flangeW - bw) / 2, bY - 5, flangeW, 8, 3);
  st.ctx.fill();
  st.ctx.restore();
  st.ctx.fillStyle = '#475569';
  st.ctx.font = 'bold 14px Inter';
  st.ctx.textAlign = 'right';
  st.ctx.textBaseline = 'middle';
  st.ctx.fillText('1/2"', L.bypassX - 12, (L.outletY + L.inletY) / 2);
  st.ctx.save();
  st.ctx.translate(L.bypassX + 32, (L.outletY + L.inletY) / 2);
  st.ctx.rotate(-Math.PI / 2);
  st.ctx.fillStyle = '#64748b';
  st.ctx.font = 'bold 16px Inter';
  st.ctx.textAlign = 'center';
  st.ctx.fillText('БАЙПАС', 0, 0);
  st.ctx.restore();
  drawBypassValveVisual();
}

function drawPipes(): void {
  const ph = L.pipeH;
  const ext = st.leftPipeExt;
  if (ext > 0) {
    const gap = 8;
    // Трубы слева: вертикальный участок (drawVP) + горизонтальный (drawHP).
    // Оба рисуются одинаковыми прямоугольниками — никаких треугольных скосов.
    //
    // Холодная (обратка, сверху): вертикаль вниз на ext px, затем вправо до байпаса.
    // Угол закрывается квадратом ph×ph (vertH+ph = ext+ph включает угол).
    drawVP(0, L.outletY - ph / 2 - ext, ph, ext + ph, 'cold');
    drawHP(ph, L.outletY - ph / 2, L.bypassX - gap - ph, ph, 'cold');

    // Горячая (подача, снизу): горизонталь вправо до байпаса, угол + вертикаль вниз на ext px.
    drawVP(0, L.inletY - ph / 2, ph, ext + ph, 'hot');
    drawHP(ph, L.inletY - ph / 2, L.bypassX - gap - ph, ph, 'hot');

    drawHP(L.bypassX + gap, L.inletY - ph / 2, L.valveX - L.bypassX - gap - 22, ph, 'hot');
    drawHP(L.bypassX + gap, L.outletY - ph / 2, L.valveX - L.bypassX - gap - 22, ph, 'cold');
  } else {
    drawHP(0, L.inletY - ph / 2, L.bypassX - 8, ph, 'hot');
    drawHP(0, L.outletY - ph / 2, L.bypassX - 8, ph, 'cold');
    
    drawHP(L.bypassX + 8, L.inletY - ph / 2, L.valveX - L.bypassX - 30, ph, 'hot');
    drawHP(L.bypassX + 8, L.outletY - ph / 2, L.valveX - L.bypassX - 30, ph, 'cold');
  }

  drawHP(L.valveX + 28, L.inletY - ph / 2, L.radStartX - L.valveX - 28, ph, 'hot');
  drawHP(L.valveX + 28, L.outletY - ph / 2, L.radStartX - L.valveX - 28, ph, 'cold');
  st.ctx.fillStyle = '#475569';
  st.ctx.font = 'bold 14px Inter';
  st.ctx.textAlign = 'center';
  st.ctx.textBaseline = 'bottom';
  st.ctx.fillText('3/4"', 80, L.outletY - ph / 2 - 6);
  st.ctx.fillText('3/4"', 80, L.inletY - ph / 2 - 6);
  drawBypass();
  drawValve(L.valveX, L.inletY, true);
  drawValve(L.valveX, L.outletY, false);
}

function drawCollector(x: number, y: number, width: number, height: number, label: string, labelY: number, isTopCollector: boolean): void {
  const sT = st.thermal.supplyT || 70;
  const secW = (L.radEndX - L.radStartX) / SECTIONS;
  const T_room = st.balance.T_room_eq || 20;
  const segTemps: number[] = [];

  if (isTopCollector) {
    if (st.mode === 'bad' && st.counterflowEnabled && st.collectorReturnTemps.length >= SECTIONS) {
      for (let j = 0; j < SECTIONS; j++) {
        segTemps.push(st.collectorReturnTemps[j] || st.secSurfaceTemps[j] || T_room);
      }
    } else {
      for (let j = 0; j < SECTIONS; j++) {
        segTemps.push(st.secSurfaceTemps[j] || T_room);
      }
    }
  } else {
    for (let j = 0; j < SECTIONS; j++) {
      segTemps.push(st.secSurfaceTemps[j] || T_room);
    }
  }

  st.ctx.fillStyle = 'rgba(0,0,0,0.12)';
  st.ctx.beginPath();
  roundRect(st.ctx, x + 3, y + 3, width, height, 6);
  st.ctx.fill();
  st.ctx.save();
  st.ctx.beginPath();
  roundRect(st.ctx, x, y, width, height, 6);
  st.ctx.clip();

  for (let i = 0; i < SECTIONS; i++) {
    const segX = L.radStartX - 10 + i * secW;
    const temp = segTemps[i] || T_room;
    const c = tempToColor(temp, sT, T_room);
    const cg = st.ctx.createLinearGradient(0, y, 0, y + height);
    cg.addColorStop(0, `rgba(${Math.min(c.r + 50, 255)},${Math.min(c.g + 50, 255)},${Math.min(c.b + 50, 255)},1)`);
    cg.addColorStop(0.4, `rgb(${c.r},${c.g},${c.b})`);
    cg.addColorStop(0.8, `rgb(${Math.max(c.r - 40, 0)},${Math.max(c.g - 40, 0)},${Math.max(c.b - 40, 0)})`);
    cg.addColorStop(1, `rgb(${c.r},${c.g},${c.b})`);
    st.ctx.fillStyle = cg;
    st.ctx.fillRect(segX, y, secW + 1, height);
    if (i > 0) {
      st.ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      st.ctx.lineWidth = 0.5;
      st.ctx.beginPath();
      st.ctx.moveTo(segX, y + 2);
      st.ctx.lineTo(segX, y + height - 2);
      st.ctx.stroke();
    }
  }
  st.ctx.fillStyle = 'rgba(255,255,255,0.15)';
  st.ctx.fillRect(x + 4, y + 2, width - 8, height * 0.25);
  st.ctx.restore();

  st.ctx.strokeStyle = 'rgba(80,80,80,0.4)';
  st.ctx.lineWidth = 2;
  st.ctx.beginPath();
  roundRect(st.ctx, x, y, width, height, 6);
  st.ctx.stroke();
  st.ctx.fillStyle = '#606060';
  st.ctx.beginPath();
  roundRect(st.ctx, x - 5, y + 3, 10, height - 6, 3);
  st.ctx.fill();
  st.ctx.beginPath();
  roundRect(st.ctx, x + width - 5, y + 3, 10, height - 6, 3);
  st.ctx.fill();
  st.ctx.fillStyle = '#475569';
  st.ctx.font = 'bold 16px Inter';
  st.ctx.textAlign = 'center';
  st.ctx.fillText(label, x + width / 2, labelY);

  if (isTopCollector && st.mode === 'bad' && st.counterflowEnabled) {
    st.ctx.save();
    st.ctx.globalAlpha = 0.6;
    st.ctx.fillStyle = '#3b82f6';
    st.ctx.font = 'bold 16px Arial';
    st.ctx.fillText('← обратка', x + 70, y + height / 2 + 5);
    if (st.counterflowReachSection >= 0) {
      const reachX = L.radStartX + (st.counterflowReachSection + 1) * secW;
      st.ctx.fillStyle = '#f59e0b';
      st.ctx.font = 'bold 14px Arial';
      st.ctx.fillText('→ противоток →', x + width / 2 - 30, y + height / 2 + 5);
      st.ctx.strokeStyle = '#f59e0b';
      st.ctx.lineWidth = 2;
      st.ctx.setLineDash([4, 4]);
      st.ctx.beginPath();
      st.ctx.moveTo(reachX, y);
      st.ctx.lineTo(reachX, y + height);
      st.ctx.stroke();
      st.ctx.setLineDash([]);
    }
    st.ctx.restore();
  }
}

function drawSection(x: number, w: number, idx: number): void {
  const sT = st.thermal.supplyT || 70;
  const pps = (st.thermal.nomPower || 2000) / SECTIONS;
  if (pps <= 0) return;
  const power = st.thermal.secPowers[idx] || 0;
  const retT = st.thermal.secRetTemps[idx] || sT;
  const flowLPM = st.thermal.secFlowLPM[idx] || 0;
  const eps = st.thermal.secEps[idx] || 0;
  const y = L.secTopY;
  const h = L.secBotY - L.secTopY;
  const surfaceTemp = st.secSurfaceTemps[idx];

  if (st.frozenSections[idx]) {
    st.ctx.fillStyle = 'rgba(0,0,0,0.2)';
    st.ctx.fillRect(x + 3, y + 3, w, h);
    const iceGrad = st.ctx.createLinearGradient(x, 0, x + w, 0);
    iceGrad.addColorStop(0, 'rgba(200,230,255,1)');
    iceGrad.addColorStop(0.3, 'rgba(230,245,255,1)');
    iceGrad.addColorStop(0.5, 'rgba(240,250,255,1)');
    iceGrad.addColorStop(0.7, 'rgba(230,245,255,1)');
    iceGrad.addColorStop(1, 'rgba(200,230,255,1)');
    st.ctx.fillStyle = iceGrad;
    st.ctx.beginPath();
    roundRect(st.ctx, x, y, w, h, 4);
    st.ctx.fill();
    const ribCount = 11;
    const ribSpacing = h / (ribCount + 1);
    st.ctx.strokeStyle = 'rgba(150,190,220,0.4)';
    st.ctx.lineWidth = 2;
    for (let r = 1; r <= ribCount; r++) {
      const ry = y + r * ribSpacing;
      st.ctx.beginPath();
      st.ctx.moveTo(x + 2, ry);
      st.ctx.lineTo(x + w - 2, ry);
      st.ctx.stroke();
    }
    st.ctx.fillStyle = 'rgba(180,220,255,0.8)';
    for (let r = 1; r <= ribCount; r++) {
      const ry = y + r * ribSpacing;
      st.ctx.beginPath();
      st.ctx.moveTo(x, ry - 4);
      st.ctx.lineTo(x - 5, ry);
      st.ctx.lineTo(x, ry + 4);
      st.ctx.closePath();
      st.ctx.fill();
      st.ctx.beginPath();
      st.ctx.moveTo(x + w, ry - 4);
      st.ctx.lineTo(x + w + 5, ry);
      st.ctx.lineTo(x + w, ry + 4);
      st.ctx.closePath();
      st.ctx.fill();
    }
    const chW = 12;
    const chX = x + w / 2 - chW / 2;
    const chMargin = 6;
    const chY = y + chMargin;
    const chH = h - chMargin * 2;
    st.ctx.fillStyle = '#2c3e50';
    st.ctx.beginPath();
    roundRect(st.ctx, chX - 2, chY - 2, chW + 4, chH + 4, 3);
    st.ctx.fill();
    st.ctx.fillStyle = 'rgba(200,230,255,0.9)';
    st.ctx.beginPath();
    roundRect(st.ctx, chX, chY, chW, chH, 2);
    st.ctx.fill();
    st.ctx.fillStyle = 'rgba(255,255,255,0.4)';
    st.ctx.fillRect(chX + 2, chY, 3, chH);
    st.ctx.strokeStyle = 'rgba(59,130,246,0.8)';
    st.ctx.lineWidth = 3;
    st.ctx.beginPath();
    roundRect(st.ctx, x, y, w, h, 4);
    st.ctx.stroke();
    const pulse = 0.3 + 0.2 * Math.sin(st.animTime * 0.08 + idx * 0.3);
    st.ctx.save();
    st.ctx.globalAlpha = pulse;
    const iceGlow = st.ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, h / 1.5 + 15);
    iceGlow.addColorStop(0, 'rgba(180,220,255,0.4)');
    iceGlow.addColorStop(1, 'rgba(180,220,255,0)');
    st.ctx.fillStyle = iceGlow;
    st.ctx.fillRect(x - 15, y - 15, w + 30, h + 30);
    st.ctx.restore();
    const cx = x + w / 2;
    const baseY = L.secBotY + L.collH + 50;
    st.ctx.textAlign = 'center';
    st.ctx.fillStyle = '#475569';
    st.ctx.font = 'bold 20px Inter';
    st.ctx.fillText(`${idx + 1}`, cx, y - 14);
    st.ctx.font = 'bold 18px JetBrains Mono';
    st.ctx.fillStyle = '#3b82f6';
    st.ctx.fillText('❄️ ЛЁД', cx, baseY);
    st.ctx.font = 'bold 16px JetBrains Mono';
    st.ctx.fillText(`${surfaceTemp.toFixed(0)}°C`, cx, baseY + 22);
    st.ctx.fillStyle = '#64748b';
    st.ctx.font = '14px JetBrains Mono';
    st.ctx.fillText('0.00', cx, baseY + 42);
    st.ctx.fillStyle = '#ef4444';
    st.ctx.font = 'bold 14px JetBrains Mono';
    st.ctx.fillText('ЗАМЕРЗЛА', cx, baseY + 60);
    st.ctx.beginPath();
    st.ctx.arc(cx, baseY + 76, 5, 0, Math.PI * 2);
    st.ctx.fillStyle = '#3b82f6';
    st.ctx.fill();
    return;
  }

  const sc = tempToColor(surfaceTemp, sT, st.balance.T_room_eq);
  st.ctx.fillStyle = 'rgba(0,0,0,0.1)';
  st.ctx.fillRect(x + 3, y + 3, w, h);
  const bodyGrad = st.ctx.createLinearGradient(x, 0, x + w, 0);
  bodyGrad.addColorStop(0, `rgba(${Math.max(sc.r - 30, 0)},${Math.max(sc.g - 30, 0)},${Math.max(sc.b - 30, 0)},1)`);
  bodyGrad.addColorStop(0.3, `rgba(${Math.min(sc.r + 40, 255)},${Math.min(sc.g + 40, 255)},${Math.min(sc.b + 40, 255)},1)`);
  bodyGrad.addColorStop(0.5, `rgba(${Math.min(sc.r + 60, 255)},${Math.min(sc.g + 60, 255)},${Math.min(sc.b + 60, 255)},1)`);
  bodyGrad.addColorStop(0.7, `rgba(${Math.min(sc.r + 40, 255)},${Math.min(sc.g + 40, 255)},${Math.min(sc.b + 40, 255)},1)`);
  bodyGrad.addColorStop(1, `rgba(${Math.max(sc.r - 30, 0)},${Math.max(sc.g - 30, 0)},${Math.max(sc.b - 30, 0)},1)`);
  st.ctx.fillStyle = bodyGrad;
  st.ctx.beginPath();
  roundRect(st.ctx, x, y, w, h, 4);
  st.ctx.fill();
  const ribCount = 11;
  const ribSpacing = h / (ribCount + 1);
  st.ctx.strokeStyle = `rgba(${Math.max(sc.r - 60, 0)},${Math.max(sc.g - 60, 0)},${Math.max(sc.b - 60, 0)},0.15)`;
  st.ctx.lineWidth = 1;
  for (let r = 1; r <= ribCount; r++) {
    const ry = y + r * ribSpacing;
    st.ctx.beginPath();
    st.ctx.moveTo(x + 2, ry);
    st.ctx.lineTo(x + w - 2, ry);
    st.ctx.stroke();
  }
  st.ctx.fillStyle = `rgba(${sc.r},${sc.g},${sc.b},0.7)`;
  for (let r = 1; r <= ribCount; r++) {
    const ry = y + r * ribSpacing;
    st.ctx.beginPath();
    st.ctx.moveTo(x, ry - 3);
    st.ctx.lineTo(x - 4, ry);
    st.ctx.lineTo(x, ry + 3);
    st.ctx.closePath();
    st.ctx.fill();
    st.ctx.beginPath();
    st.ctx.moveTo(x + w, ry - 3);
    st.ctx.lineTo(x + w + 4, ry);
    st.ctx.lineTo(x + w, ry + 3);
    st.ctx.closePath();
    st.ctx.fill();
  }
  const chW = 12;
  const chX = x + w / 2 - chW / 2;
  const chMargin = 6;
  const chY = y + chMargin;
  const chH = h - chMargin * 2;
  st.ctx.fillStyle = '#484848';
  st.ctx.beginPath();
  roundRect(st.ctx, chX - 2, chY - 2, chW + 4, chH + 4, 3);
  st.ctx.fill();
  if (flowLPM > 0.001) {
    const wgBot = tempToColor(sT, sT);
    const wgTop = tempToColor(retT, sT);
    const wg = st.ctx.createLinearGradient(0, chY + chH, 0, chY);
    wg.addColorStop(0, `rgb(${wgBot.r},${wgBot.g},${wgBot.b})`);
    wg.addColorStop(1, `rgb(${wgTop.r},${wgTop.g},${wgTop.b})`);
    st.ctx.fillStyle = wg;
  } else {
    const stg = tempToColor(st.balance.T_room_eq || 20, sT);
    st.ctx.fillStyle = `rgba(${stg.r},${stg.g},${stg.b},0.6)`;
  }
  st.ctx.beginPath();
  roundRect(st.ctx, chX, chY, chW, chH, 2);
  st.ctx.fill();
  st.ctx.fillStyle = 'rgba(255,255,255,0.15)';
  st.ctx.fillRect(chX + 2, chY, 3, chH);
  st.ctx.strokeStyle = `rgba(${Math.max(sc.r - 80, 0)},${Math.max(sc.g - 80, 0)},${Math.max(sc.b - 80, 0)},0.6)`;
  st.ctx.lineWidth = 1.5;
  st.ctx.beginPath();
  roundRect(st.ctx, x, y, w, h, 4);
  st.ctx.stroke();
  const pR = clamp(power / pps, 0, 1);
  if (power > 10) {
    const pulse = 0.7 + 0.3 * Math.sin(st.animTime * 0.03 + idx * 0.5);
    st.ctx.save();
    st.ctx.globalAlpha = pR * 0.2 * pulse;
    const gs = 12;
    const gg = st.ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, h / 1.5 + gs);
    gg.addColorStop(0, `rgba(${sc.r},${sc.g},${sc.b},0.3)`);
    gg.addColorStop(1, `rgba(${sc.r},${sc.g},${sc.b},0)`);
    st.ctx.fillStyle = gg;
    st.ctx.fillRect(x - gs, y - gs, w + gs * 2, h + gs * 2);
    st.ctx.restore();
  }
  const cx = x + w / 2;
  const baseY = L.secBotY + L.collH + 50;
  st.ctx.textAlign = 'center';
  st.ctx.fillStyle = '#475569';
  st.ctx.font = 'bold 20px Inter';
  st.ctx.fillText(`${idx + 1}`, cx, y - 14);
  st.ctx.font = 'bold 18px JetBrains Mono';
  st.ctx.fillStyle = tCSS(surfaceTemp, sT);
  st.ctx.fillText(`${power.toFixed(0)}Вт`, cx, baseY);
  st.ctx.font = 'bold 16px JetBrains Mono';
  st.ctx.fillText(`${surfaceTemp.toFixed(0)}°C`, cx, baseY + 22);
  st.ctx.fillStyle = '#64748b';
  st.ctx.font = '14px JetBrains Mono';
  st.ctx.fillText(`${flowLPM.toFixed(2)}`, cx, baseY + 42);
  st.ctx.fillStyle = '#8b5cf6';
  st.ctx.font = 'bold 14px JetBrains Mono';
  st.ctx.fillText(`ε${(eps * 100).toFixed(0)}%`, cx, baseY + 60);
  st.ctx.beginPath();
  st.ctx.arc(cx, baseY + 76, 5, 0, Math.PI * 2);
  st.ctx.fillStyle = surfaceTemp > COLD_THRESHOLD ? '#dc2626' : '#2563eb';
  st.ctx.fill();
}

function drawCollectorTempLabels(): void {
  if (st.mode !== 'bad') return;
  const sT = st.thermal.supplyT || 70;
  const secW = (L.radEndX - L.radStartX) / SECTIONS;
  st.ctx.font = 'bold 11px JetBrains Mono';
  st.ctx.textAlign = 'center';
  for (let i = 0; i < SECTIONS; i++) {
    const cx = L.radStartX + i * secW + secW / 2;
    const collT = st.collectorReturnTemps[i] || 20;
    const surfT = st.secSurfaceTemps[i] || 20;
    const c = tempToColor(collT, sT, st.balance.T_room_eq);
    const particleCount = st.particleCountPerSegment[i];
    if (particleCount > 0 && collT > surfT + 1) {
      st.ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
      st.ctx.fillText(`${collT.toFixed(0)}° (${particleCount})`, cx, L.topCollY - 6);
    }
  }
}

function drawRad(): void {
  const radW = L.radEndX - L.radStartX;
  const sw = radW / SECTIONS;
  drawCollector(L.radStartX - 10, L.topCollY, radW + 20, L.collH, '▲ ВЕРХНИЙ КОЛЛЕКТОР (обратка)', L.topCollY - 18, true);
  drawCollector(L.radStartX - 10, L.botCollY, radW + 20, L.collH, '▼ НИЖНИЙ КОЛЛЕКТОР (подача)', L.botCollY + L.collH + 20, false);
  for (let i = 0; i < SECTIONS; i++) drawSection(L.radStartX + i * sw, sw - 4, i);
  drawCollectorTempLabels();
  if (st.mode === 'good') drawExt();
}

function drawExt(): void {
  const eg = st.ctx.createLinearGradient(L.radStartX, 0, L.radEndX, 0);
  eg.addColorStop(0, '#dc2626');
  eg.addColorStop(1, '#f97316');
  st.ctx.strokeStyle = eg;
  st.ctx.lineWidth = 8;
  st.ctx.lineCap = 'round';
  st.ctx.beginPath();
  st.ctx.moveTo(L.radStartX, L.inletY);
  st.ctx.lineTo(L.radEndX - 20, L.inletY);
  st.ctx.stroke();
  st.ctx.fillStyle = 'white';
  st.ctx.font = 'bold 16px Arial';
  st.ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) st.ctx.fillText('→', L.radStartX + 100 + i * 200, L.inletY + 5);
  st.ctx.fillStyle = '#dc2626';
  st.ctx.font = 'bold 16px Inter';
  st.ctx.fillText('УДЛИНИТЕЛЬ ПОТОКА', (L.radStartX + L.radEndX) / 2, L.botCollY + L.collH + 40);
}

function drawTitle(): void {
  st.ctx.textAlign = 'center';
  if (st.balanceVisible) {
    st.ctx.fillStyle = '#1e293b';
    st.ctx.font = 'bold 28px Inter';
    st.ctx.fillText('ТЕПЛОВОЙ БАЛАНС ПОМЕЩЕНИЯ', (L.radStartX + L.radEndX) / 2, 48);
  }

  const frozenCount = st.frozenSections.filter((f) => f).length;
  if (frozenCount > 0) {
    st.ctx.save();
    const cx = st.canvas.width / 2;
    const cy = 150;
    const pulse = 0.5 + 0.5 * Math.sin(st.animTime * 0.1);
    st.ctx.globalAlpha = 0.9;
    st.ctx.fillStyle = st.systemFrozen ? '#dc2626' : '#f59e0b';
    st.ctx.beginPath();
    roundRect(st.ctx, cx - 350, cy - 30, 700, 60, 15);
    st.ctx.fill();
    st.ctx.strokeStyle = '#fff';
    st.ctx.lineWidth = 3;
    st.ctx.stroke();
    st.ctx.globalAlpha = 1;
    st.ctx.fillStyle = '#fff';
    st.ctx.font = 'bold 24px Inter';
    st.ctx.textAlign = 'center';
    if (st.systemFrozen) {
      st.ctx.fillText('🚨 КРИТИЧЕСКАЯ АВАРИЯ! СИСТЕМА ЗАМЕРЗЛА! 🚨', cx, cy - 5);
      st.ctx.font = '18px Inter';
      st.ctx.fillText(`Замерзло ${frozenCount} из ${SECTIONS} секций • Циркуляция остановлена`, cx, cy + 20);
    } else {
      st.ctx.fillText('❄️ ВНИМАНИЕ! ОБНАРУЖЕНО ЗАМЕРЗАНИЕ! ❄️', cx, cy - 5);
      st.ctx.font = '18px Inter';
      st.ctx.fillText(`Замерзло ${frozenCount} секций • Требуется срочная разморозка`, cx, cy + 20);
    }
    st.ctx.restore();
  }
}

export function updateGradientBar(): void {
  const sT = st.thermal.supplyT || 70;
  const T_room = st.balance.T_room_eq || 20;
  const minT = Math.min(T_room, COLD_THRESHOLD - 1);
  const bar = document.getElementById('temp-gradient-bar');
  if (!bar) return;
  const stops: string[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = minT + (sT - minT) * (i / 20);
    const c = tempToColor(t, sT, minT);
    stops.push(`rgb(${c.r},${c.g},${c.b}) ${(i / 20 * 100).toFixed(1)}%`);
  }
  (bar as HTMLElement).style.background = `linear-gradient(90deg, ${stops.join(', ')})`;
}

function renderCanvasBelow(): void {
  const canvasBelow = document.getElementById('simCanvasBelow') as HTMLCanvasElement | null;
  if (!canvasBelow) return;
  const ctx = canvasBelow.getContext('2d');
  if (!ctx) return;
  const w = canvasBelow.width;
  const h = canvasBelow.height;
  ctx.fillStyle = '#fefce8';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#78716c';
  ctx.fillRect(0, 0, w, CANVAS_BELOW_STRIP_H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Распределение расхода по стояку', w / 2, CANVAS_BELOW_STRIP_H / 2);
  renderSixRadFull(ctx, w, h, CANVAS_BELOW_STRIP_H);
}

export function render(): void {
  drawBG();
  drawPipes();
  drawRad();
  drawTitle();
  st.particles.forEach((p) => p.draw());
  renderCanvasBelow();
}
