// ============================================================
// КЛАСС PARTICLE — анимация потока частиц
// ============================================================
import {
  L,
  SECTIONS,
  clamp,
  particleParams,
} from './constants';
import * as st from './state';
import type { ParticlePath, ParticleState } from './types';


export class Particle {
  temp = 70;
  size = 2.5;
  speed = 5;
  opacity = 0.9;
  sec = -1;
  x = -20;
  y = L.inletY;
  state: ParticleState = 'enter';
  path: ParticlePath = 'bypass';
  isCounterflow = false;
  isCascade = false;
  counterflowMaxX = 0;
  velocityY = 0;
  stallCounter = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.temp = st.thermal.supplyT ?? 70;
    this.size = 2.5 + Math.random() * 2;
    this.speed = 5 + Math.random() * 3;
    this.opacity = 0.8 + Math.random() * 0.2;
    this.sec = -1;
    const ext = st.leftPipeExt;
    if (ext > 0 && Math.random() < 0.4) {
      this.x = 8 + (Math.random() - 0.5) * 4;
      this.y = L.inletY + L.pipeH / 2 + ext - 2;
      this.state = 'pipe_in';
    } else {
      this.x = -80 - Math.random() * 80 - ext;
      this.y = L.inletY + (Math.random() - 0.5) * L.pipeH * 0.8;
      this.state = 'enter';
    }
    this.isCounterflow = false;
    this.isCascade = false;
    this.counterflowMaxX = 0;
    this.velocityY = 0;
    this.stallCounter = 0;
    if (st.flowData.radFrac < 0.01) this.path = 'bypass';
    else if (st.flowData.bypassFrac < 0.01) {
      this.path = 'rad';
      this.pickSec();
    } else if (Math.random() < st.flowData.bypassFrac) this.path = 'bypass';
    else {
      this.path = 'rad';
      this.pickSec();
    }
  }

  pickSec(): void {
    const r = Math.random() * st.flowData.radFrac;
    let c = 0;
    for (let i = 0; i < SECTIONS; i++) {
      c += st.flowData.secFracs[i];
      if (r <= c) {
        this.sec = i;
        return;
      }
    }
    this.sec = SECTIONS - 1;
  }

  secX(i: number): number {
    const w = (L.radEndX - L.radStartX) / SECTIONS;
    return L.radStartX + w * i + w / 2;
  }

  decideCollectorDirection(): number {
    if (st.mode === 'bad' && st.counterflowEnabled) {
      if (this.sec <= 2) {
        if (Math.random() < 0.4) {
          this.isCounterflow = true;
          return 1;
        }
      }
    }
    return -1;
  }

  update(): void {
    const sT = st.thermal.supplyT || 70;
    const T_room = st.balance.T_room_eq || 10;

    if (this.state === 'rise' && this.sec >= 0) {
      this.temp += ((st.thermal.secRetTemps[this.sec] || 40) - this.temp) * 0.05;
    }

    if (this.state === 'top_coll_right' || this.state === 'top_coll') {
      const secW = (L.radEndX - L.radStartX) / SECTIONS;
      const segIdx = clamp(Math.floor((this.x - L.radStartX) / secW), 0, SECTIONS - 1);
      const collT = st.collectorReturnTemps[segIdx] || st.thermal.avgRetTemp;
      this.temp += (collT - this.temp) * 0.03;
    }

    this.temp = Math.max(this.temp, T_room);
    const isCold = this.temp < (st.secSurfaceTemps[Math.max(0, this.sec)] || sT) + 2;

    switch (this.state) {
      case 'pipe_in': {
        this.y -= this.speed * 0.8;
        this.x = 8 + Math.sin(this.y * 0.05) * 2;
        if (this.y <= L.inletY + L.pipeH / 2) {
          this.state = 'enter';
          this.x = 12 + (Math.random() - 0.5) * 8;
          this.y = L.inletY + (Math.random() - 0.5) * L.pipeH * 0.8;
        }
      } break;
      case 'enter':
        this.x += this.speed;
        this.y = L.inletY + (Math.random() - 0.5) * L.pipeH * 0.6;
        if (this.x >= L.bypassX) {
          if (this.path === 'bypass') {
            this.state = 'byp_up';
            this.x = L.bypassX + (Math.random() - 0.5) * 8;
          } else this.state = 'to_rad';
        }
        break;
      case 'to_rad':
        this.x += this.speed;
        this.y = L.inletY + (Math.random() - 0.5) * L.pipeH * 0.6;
        if (this.x >= L.radStartX) {
          this.state = st.mode === 'good' ? 'fwd_coll' : 'to_sec_up';
          this.y = L.inletY + (Math.random() - 0.5) * 8;
        }
        break;
      case 'fwd_coll':
        this.x += this.speed * 1.2;
        this.y = L.inletY + (Math.random() - 0.5) * 6;
        if (this.x >= L.radEndX - 30) this.state = 'to_sec_up';
        break;
      case 'to_sec_up':
        this.state = 'rise';
        this.x = this.secX(this.sec) + (Math.random() - 0.5) * 10;
        this.y = L.secBotY;
        this.velocityY = 0;
        this.stallCounter = 0;
        break;
      case 'byp_up':
        if (isCold && particleParams.gravityForce > 0) {
          this.velocityY += particleParams.gravityForce;
          this.y += this.velocityY;
          this.stallCounter++;
          if (this.stallCounter > 60) this.state = 'stall';
        } else {
          this.velocityY = 0;
          this.y -= this.speed * 0.7;
        }
        this.x = L.bypassX + Math.sin(this.y * 0.08) * 3;
        if (this.y <= L.outletY) this.state = 'exit';
        break;
      case 'to_sec': {
        const tx = this.secX(this.sec);
        this.x += this.speed * 0.8;
        this.y = L.inletY + (Math.random() - 0.5) * 6;
        if (this.x >= tx - 5) {
          this.state = 'rise';
          this.x = tx + (Math.random() - 0.5) * 10;
          this.y = L.secBotY;
          this.velocityY = 0;
        }
      } break;
      case 'rise': {
        const secIdx = Math.max(0, this.sec);
        const secCenterX = this.secX(secIdx);
        const CHANNEL_HALF = 5;

        const secFlow = (st.thermal.secFlowLPM?.[secIdx] ?? 0) || 0;
        const maxFlow = Math.max(...(st.thermal.secFlowLPM || [0.1]), 0.001);
        const pumpForce = clamp(secFlow / maxFlow, 0, 1);

        const COLD_WATER_LIMIT = 30;
        const buoyancy = clamp((this.temp - COLD_WATER_LIMIT) / 20, 0, 1);

        const rProg = clamp((L.secBotY - this.y) / (L.secBotY - L.secTopY), 0, 1);

        const pumpSpeed = this.speed * 0.5 * pumpForce;
        const convSpeed = this.speed * 0.3 * (buoyancy - 0.3);
        const gravDrag = particleParams.gravityForce * (1 - buoyancy) * (0.2 + rProg * 1.5);

        const totalRiseSpeed = pumpSpeed + convSpeed;

        if (secFlow < 0.01 && buoyancy < 0.1 && particleParams.gravityForce > 0) {
          this.velocityY += particleParams.gravityForce * (0.5 + rProg * 3);
          this.velocityY *= 0.94;
          const thermalNoise = this.speed * 0.05 * buoyancy;
          this.y -= thermalNoise;
          this.y += this.velocityY;
          this.x += (Math.random() - 0.5) * 0.5;
          if (particleParams.heatLossCoeff > 0) this.temp -= particleParams.heatLossCoeff * 0.5;

          if (this.y >= L.secBotY) {
            this.y = L.secBotY;
            this.velocityY = -Math.abs(this.velocityY) * 0.15;
            this.stallCounter++;
            if (this.stallCounter > 4) this.state = 'stall';
          }
        } else if (totalRiseSpeed < this.speed * 0.15 && particleParams.gravityForce > 0) {
          this.velocityY += gravDrag;
          this.velocityY *= 0.9;
          this.y -= Math.max(totalRiseSpeed, this.speed * 0.03);
          this.y += this.velocityY * 0.3;
          this.x += (Math.random() - 0.5) * 0.4;
          if (particleParams.heatLossCoeff > 0) this.temp -= particleParams.heatLossCoeff * 0.15;

          if (this.y >= L.secBotY) {
            this.y = L.secBotY;
            this.velocityY = 0;
            this.stallCounter++;
            if (this.stallCounter > 6) this.state = 'stall';
          }
        } else {
          this.velocityY = 0;
          this.y -= totalRiseSpeed;
          this.x += (Math.random() - 0.5) * 0.3;
        }

        this.x = clamp(this.x, secCenterX - CHANNEL_HALF, secCenterX + CHANNEL_HALF);
        this.y = clamp(this.y, L.secTopY, L.secBotY);

        if (this.y <= L.secTopY + 1) {
          const dir = this.decideCollectorDirection();
          if (dir > 0) {
            this.state = 'top_coll_right';
            this.isCounterflow = true;
          } else {
            this.state = 'top_coll';
          }
          this.y = L.outletY + (Math.random() - 0.5) * L.pipeH * 0.6;
          this.stallCounter = 0;
        }
      } break;

      case 'top_coll_right': {
        const secW_cf = (L.radEndX - L.radStartX) / SECTIONS;
        const distFromStart = (this.x - this.secX(this.sec)) / secW_cf;
        const frictionSlowdown = Math.max(0.15, 1 - distFromStart * 0.15);
        this.x += this.speed * 0.6 * frictionSlowdown;
        this.y = L.outletY + (Math.random() - 0.5) * L.pipeH * 0.6;

        if (particleParams.heatLossCoeff > 0) {
          this.temp -= particleParams.heatLossCoeff * 0.015;
        }

        if (this.x > this.counterflowMaxX) {
          this.counterflowMaxX = this.x;
          const reachSec = Math.floor((this.x - L.radStartX) / secW_cf);
          if (reachSec < SECTIONS) {
            st.setCounterflowReachSection(Math.max(st.counterflowReachSection, reachSec));
          }
        }

        const maxReach = this.sec + 4;
        const maxRightX = this.secX(Math.min(maxReach, SECTIONS - 1));

        if (this.x >= maxRightX) {
          this.state = 'top_coll';
          this.isCounterflow = false;
        }
      } break;

      case 'top_coll':
        this.x -= this.speed;
        this.y = L.outletY + (Math.random() - 0.5) * L.pipeH * 0.6;
        if (this.x <= L.radStartX - 10) this.state = 'exit';
        break;
      case 'stall':
        if (this.isCascade && this.sec >= 0 && this.sec < SECTIONS - 1 && this.temp > 22) {
          if (Math.random() < 0.25) {
            this.sec = this.sec + 1;
            this.state = 'rise';
            this.y = L.secBotY;
            this.velocityY = 0;
            this.stallCounter = 0;
            this.opacity = 0.7 + Math.random() * 0.2;
            this.temp -= 1;
            break;
          }
        }
        this.opacity *= 0.97;
        if (this.opacity < 0.05) this.reset();
        break;
      case 'exit':
        this.x -= this.speed;
        this.y = L.outletY + (Math.random() - 0.5) * L.pipeH * 0.6;
        if (this.x <= 12 && st.leftPipeExt > 0) {
          this.state = 'pipe_out';
          this.x = 8 + (Math.random() - 0.5) * 4;
          this.y = L.outletY - L.pipeH / 2 + 2;
        } else if (this.x < -30) {
          this.reset();
        }
        break;
      case 'pipe_out': {
        this.y -= this.speed * 0.8;
        this.x = 8 + Math.sin(this.y * 0.05) * 2;
        if (this.y <= L.outletY - L.pipeH / 2 - st.leftPipeExt) this.reset();
      } break;
    }
  }

  draw(): void {
    st.ctx.globalAlpha = this.opacity;

    let particleColor: { r: number; g: number; b: number };
    if (this.isCounterflow) {
      particleColor = { r: 255, g: 180, b: 0 };
    } else if (this.state === 'pipe_out' || this.state === 'exit' || this.state === 'top_coll' || this.state === 'top_coll_right') {
      particleColor = { r: 255, g: 200, b: 80 };
    } else {
      particleColor = { r: 255, g: 220, b: 50 };
    }

    const g = st.ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
    g.addColorStop(0, `rgba(${particleColor.r},${particleColor.g},${particleColor.b},1)`);
    g.addColorStop(0.5, `rgba(${particleColor.r},${particleColor.g},${particleColor.b},0.8)`);
    g.addColorStop(1, `rgba(${particleColor.r},${particleColor.g},${particleColor.b},0.3)`);
    st.ctx.beginPath();
    st.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    st.ctx.fillStyle = g;
    st.ctx.fill();

    st.ctx.strokeStyle = 'rgba(200,150,0,0.5)';
    st.ctx.lineWidth = 0.5;
    st.ctx.stroke();

    if (this.state === 'top_coll_right') {
      st.ctx.globalAlpha = this.opacity * 0.8;
      st.ctx.fillStyle = 'rgb(255,140,0)';
      st.ctx.beginPath();
      st.ctx.moveTo(this.x + this.size + 3, this.y);
      st.ctx.lineTo(this.x + this.size - 1, this.y - 4);
      st.ctx.lineTo(this.x + this.size - 1, this.y + 4);
      st.ctx.closePath();
      st.ctx.fill();
    }

    st.ctx.globalAlpha = 1;
  }
}
