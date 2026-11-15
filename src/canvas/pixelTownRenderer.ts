import { DistrictId, DistrictState } from '../types/game';

export const TOWN_W = 320;
export const TOWN_H = 180;

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
}

interface SnowFlake {
  x: number;
  y: number;
  size: number;
  speedY: number;
  phase: number;
}

interface RainSplash {
  x: number;
  y: number;
  life: number;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface PoliceCruiser {
  x: number;
  y: number;
  dir: 1 | -1;
  baseSpeed: number;
  phaseOffset: number;
}

export interface GuardState {
  x: number;
  y: number;
  facing: 'left' | 'right' | 'up' | 'down';
  moving: boolean;
  walkPhase: number;
  targetX: number | null;
  targetY: number | null;
}

interface NpcCharacter {
  id: string;
  role: 'chief' | 'shopkeeper' | 'clerk' | 'tech' | 'resident';
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  patrolSpan: number;
  speed: number;
  dir: 1 | -1;
  linkedDistrict?: DistrictId;
}

export interface WeatherProfile {
  rainCount: number;
  snowCount: number;
  windX: number;
  fogAlpha: number;
  lightningMinSec: number;
  lightningMaxSec: number;
  intensity: 1 | 2 | 3;
}

export function parseWeatherProfile(weatherStatus: string, day: number): WeatherProfile {
  const lower = weatherStatus.toLowerCase();
  if (
    lower.includes('peak') ||
    lower.includes('squall') ||
    lower.includes('snow') ||
    lower.includes('sleet') ||
    day >= 3
  ) {
    return {
      rainCount: 165,
      snowCount: 85,
      windX: -46,
      fogAlpha: 0.15,
      lightningMinSec: 3.5,
      lightningMaxSec: 7.5,
      intensity: 3,
    };
  }
  if (lower.includes('heavy') || lower.includes('storm') || day === 2) {
    return {
      rainCount: 140,
      snowCount: 18,
      windX: -30,
      fogAlpha: 0.09,
      lightningMinSec: 5,
      lightningMaxSec: 10,
      intensity: 2,
    };
  }
  return {
    rainCount: 68,
    snowCount: 0,
    windX: -14,
    fogAlpha: 0.04,
    lightningMinSec: 9,
    lightningMaxSec: 16,
    intensity: 1,
  };
}

export class TownRenderer {
  private rain: RainDrop[] = [];
  private snow: SnowFlake[] = [];
  private splashes: RainSplash[] = [];
  private sparks: SparkParticle[] = [];
  private cruisers: PoliceCruiser[] = [
    { x: 24, y: 92, dir: 1, baseSpeed: 24, phaseOffset: 0 },
    { x: 260, y: 85, dir: -1, baseSpeed: 19, phaseOffset: 1.7 },
  ];
  public guard: GuardState = {
    x: 68,
    y: 84,
    facing: 'right',
    moving: false,
    walkPhase: 0,
    targetX: null,
    targetY: null,
  };
  private npcs: NpcCharacter[] = [
    { id: 'chief', role: 'chief', homeX: 84, homeY: 81, x: 84, y: 81, patrolSpan: 12, speed: 8, dir: 1, linkedDistrict: 'town_hall' },
    { id: 'ruth', role: 'shopkeeper', homeX: 138, homeY: 80, x: 138, y: 80, patrolSpan: 10, speed: 7, dir: -1, linkedDistrict: 'general_store' },
    { id: 'arthur', role: 'clerk', homeX: 224, homeY: 81, x: 224, y: 81, patrolSpan: 10, speed: 7, dir: 1, linkedDistrict: 'bank' },
    { id: 'lin', role: 'tech', homeX: 142, homeY: 146, x: 142, y: 146, patrolSpan: 18, speed: 9, dir: 1, linkedDistrict: 'substation' },
    { id: 'res1', role: 'resident', homeX: 112, homeY: 103, x: 112, y: 103, patrolSpan: 24, speed: 12, dir: 1 },
    { id: 'res2', role: 'resident', homeX: 210, homeY: 103, x: 210, y: 103, patrolSpan: 22, speed: 11, dir: -1 },
  ];
  private lightningAlpha = 0;
  private boltX = 80;
  private boltVariant = 0;
  private nextLightning = 5;

  constructor() {
    for (let i = 0; i < 180; i++) {
      this.rain.push({
        x: Math.random() * (TOWN_W + 40),
        y: Math.random() * TOWN_H,
        len: 4 + Math.floor(Math.random() * 5),
        speed: 115 + Math.random() * 85,
      });
    }
    for (let i = 0; i < 95; i++) {
      this.snow.push({
        x: Math.random() * (TOWN_W + 40),
        y: Math.random() * TOWN_H,
        size: Math.random() < 0.35 ? 2 : 1,
        speedY: 24 + Math.random() * 24,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  public spawnBurst(x: number, y: number, color = '#f59e0b', count = 14) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 18 + Math.random() * 42;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 10,
        life: 0.45 + Math.random() * 0.35,
        color,
      });
    }
  }

  public getNearestDistrict(districts: Record<DistrictId, DistrictState>): DistrictId | null {
    const gx = this.guard.x;
    const gy = this.guard.y;
    let best: DistrictId | null = null;
    let bestDist = 36;
    for (const d of Object.values(districts) as DistrictState[]) {
      const cx = d.mapRect.x + d.mapRect.w / 2;
      const cy = d.mapRect.y + d.mapRect.h - 4;
      const dist = Math.hypot(gx - cx, gy - cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = d.id;
      }
    }
    return best;
  }

  public update(
    dt: number,
    day: number,
    weatherStatus: string,
    districts: Record<DistrictId, DistrictState>,
    heldInput: { up: boolean; down: boolean; left: boolean; right: boolean },
    onLightningStrike?: (intensity: number) => void
  ) {
    const profile = parseWeatherProfile(weatherStatus, day);

    // Update Main Guard movement (WASD/Arrows or click-to-walk target)
    let vx = (heldInput.right ? 1 : 0) - (heldInput.left ? 1 : 0);
    let vy = (heldInput.down ? 1 : 0) - (heldInput.up ? 1 : 0);
    if (vx !== 0 || vy !== 0) {
      this.guard.targetX = null;
      this.guard.targetY = null;
      const mag = Math.hypot(vx, vy);
      vx /= mag;
      vy /= mag;
    } else if (this.guard.targetX !== null && this.guard.targetY !== null) {
      const dx = this.guard.targetX - this.guard.x;
      const dy = this.guard.targetY - this.guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 3) {
        vx = dx / dist;
        vy = dy / dist;
      } else {
        this.guard.targetX = null;
        this.guard.targetY = null;
      }
    }

    if (vx !== 0 || vy !== 0) {
      const speed = 46;
      this.guard.x = Math.max(12, Math.min(TOWN_W - 14, this.guard.x + vx * speed * dt));
      this.guard.y = Math.max(66, Math.min(TOWN_H - 12, this.guard.y + vy * speed * dt));
      this.guard.moving = true;
      this.guard.walkPhase += dt * 11;
      if (Math.abs(vx) >= Math.abs(vy)) {
        this.guard.facing = vx >= 0 ? 'right' : 'left';
      } else {
        this.guard.facing = vy >= 0 ? 'down' : 'up';
      }
    } else {
      this.guard.moving = false;
    }

    // Update NPC townspeople
    for (const npc of this.npcs) {
      const panicked = npc.linkedDistrict ? districts[npc.linkedDistrict].rumorAlert : false;
      const spd = panicked ? npc.speed * 1.65 : npc.speed;
      npc.x += npc.dir * spd * dt;
      if (npc.x > npc.homeX + npc.patrolSpan) {
        npc.x = npc.homeX + npc.patrolSpan;
        npc.dir = -1;
      } else if (npc.x < npc.homeX - npc.patrolSpan) {
        npc.x = npc.homeX - npc.patrolSpan;
        npc.dir = 1;
      }
    }

    for (let i = 0; i < profile.rainCount; i++) {
      const drop = this.rain[i];
      drop.x += profile.windX * dt;
      drop.y += drop.speed * dt;
      if (drop.y > TOWN_H) {
        if (profile.intensity >= 2 && Math.random() < 0.24) {
          this.splashes.push({
            x: Math.max(2, Math.min(TOWN_W - 4, drop.x)),
            y: 86 + Math.random() * 22,
            life: 0.18,
          });
        }
        drop.y = -drop.len;
        drop.x = Math.random() * (TOWN_W + 60);
      }
      if (drop.x < -12) drop.x += TOWN_W + 40;
    }

    for (let i = 0; i < profile.snowCount; i++) {
      const flake = this.snow[i];
      flake.phase += dt * 3.2;
      flake.x += (profile.windX * 0.55 + Math.sin(flake.phase) * 9) * dt;
      flake.y += flake.speedY * dt;
      if (flake.y > TOWN_H) {
        flake.y = -3;
        flake.x = Math.random() * (TOWN_W + 50);
      }
      if (flake.x < -8) flake.x += TOWN_W + 30;
    }

    for (let i = this.splashes.length - 1; i >= 0; i--) {
      this.splashes[i].life -= dt;
      if (this.splashes[i].life <= 0) this.splashes.splice(i, 1);
    }

    const alertDistricts = (Object.values(districts) as DistrictState[]).filter(
      (d) => d.rumorAlert && d.id !== 'substation'
    );
    for (const car of this.cruisers) {
      const nearAlert = alertDistricts.some((d) => {
        const cx = d.mapRect.x + d.mapRect.w / 2;
        return Math.abs(car.x + 8 - cx) < 18;
      });
      const speed = nearAlert ? car.baseSpeed * 0.45 : car.baseSpeed;
      car.x += car.dir * speed * dt;
      if (car.dir === 1 && car.x > TOWN_W + 28) car.x = -28;
      if (car.dir === -1 && car.x < -28) car.x = TOWN_W + 28;
    }

    this.nextLightning -= dt;
    if (this.nextLightning <= 0) {
      this.lightningAlpha = profile.intensity === 3 ? 0.55 : profile.intensity === 2 ? 0.42 : 0.28;
      this.boltX = 36 + Math.floor(Math.random() * (TOWN_W - 72));
      this.boltVariant = Math.floor(Math.random() * 3);
      this.nextLightning =
        profile.lightningMinSec +
        Math.random() * (profile.lightningMaxSec - profile.lightningMinSec);
      onLightningStrike?.(profile.intensity * 0.5);
    }
    if (this.lightningAlpha > 0) {
      this.lightningAlpha = Math.max(0, this.lightningAlpha - dt * 1.45);
    }

    if (districts.substation.breakerTripped && Math.random() < dt * 7) {
      this.sparks.push({
        x: 158 + (Math.random() - 0.5) * 26,
        y: 122 + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 40,
        vy: -10 - Math.random() * 30,
        life: 0.35,
        color: '#60a5fa',
      });
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 65 * dt;
      s.life -= dt;
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    timeSec: number,
    day: number,
    weatherStatus: string,
    districts: Record<DistrictId, DistrictState>,
    selectedId: DistrictId | null,
    hoveredId: DistrictId | null,
    broadcastPending: boolean,
    clueProgress?: Record<DistrictId, { found: number; total: number }>
  ) {
    ctx.imageSmoothingEnabled = false;
    const profile = parseWeatherProfile(weatherStatus, day);
    const thunder = this.lightningAlpha;

    // 1. Layered Storm Sky & Drifting Pixel Clouds
    const skyBands = ['#060910', '#090e18', '#0d1523', '#121d2f'];
    skyBands.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(0, i * 13, TOWN_W, 14);
    });

    // Subtle moon glow behind storm bank
    ctx.fillStyle = 'rgba(186, 210, 240, 0.08)';
    ctx.fillRect(216, 4, 24, 18);
    ctx.fillStyle = 'rgba(226, 240, 255, 0.14)';
    ctx.fillRect(223, 8, 10, 10);

    // Drifting pixel cloud silhouettes (underlit during thunder flashes)
    const cloudOffset = Math.floor(timeSec * (4 + profile.intensity * 2));
    for (let c = 0; c < 5; c++) {
      const cx = ((c * 78 - cloudOffset) % (TOWN_W + 70) + (TOWN_W + 70)) % (TOWN_W + 70) - 50;
      const cy = 6 + (c % 3) * 7;
      ctx.fillStyle = thunder > 0.2 ? '#1e304a' : '#0b121e';
      ctx.fillRect(cx, cy + 4, 48, 8);
      ctx.fillRect(cx + 8, cy, 30, 6);
      ctx.fillStyle = thunder > 0.2 ? '#60a5fa' : '#182436';
      ctx.fillRect(cx + 10, cy + 1, 22, 2);
      if (thunder > 0.22) {
        ctx.fillStyle = `rgba(186, 230, 253, ${(thunder * 0.7).toFixed(2)})`;
        ctx.fillRect(cx + 6, cy + 10, 34, 2);
      }
    }

    // Thunder Lights: Sky illumination & Multi-Branch Lightning Bolt
    if (thunder > 0.01) {
      ctx.fillStyle = `rgba(195, 228, 255, ${(thunder * 0.85).toFixed(3)})`;
      ctx.fillRect(0, 0, TOWN_W, 56);
      if (thunder > 0.14) {
        this.drawForkedLightning(ctx, this.boltX, this.boltVariant, thunder);
      }
    }

    // Far & Near Mountain Ridges with treelines
    ctx.fillStyle = thunder > 0.22 ? '#142033' : '#090f19';
    this.fillPixelRidge(ctx, [
      [0, 38],
      [35, 25],
      [85, 32],
      [148, 18],
      [212, 30],
      [272, 21],
      [320, 34],
    ], 54);
    ctx.fillStyle = thunder > 0.22 ? '#1b2b42' : '#0c1522';
    this.fillPixelRidge(ctx, [
      [0, 44],
      [55, 34],
      [115, 39],
      [175, 29],
      [235, 37],
      [295, 28],
      [320, 36],
    ], 54);

    // Distant Radio Broadcast Tower on Oakhaven Ridge
    const towerX = 286;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(towerX, 7, 2, 23);
    ctx.fillRect(towerX - 3, 14, 8, 1);
    ctx.fillRect(towerX - 4, 21, 10, 1);
    ctx.fillStyle = '#334155';
    ctx.fillRect(towerX - 1, 10, 1, 1);
    ctx.fillRect(towerX + 2, 17, 1, 1);
    const beaconOn = Math.sin(timeSec * 3.5) > 0 && districts.town_hall.powered;
    ctx.fillStyle = beaconOn ? '#ef4444' : '#450a0a';
    ctx.fillRect(towerX, 5, 2, 2);
    if (beaconOn) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(towerX - 2, 3, 6, 6);
    }

    // 2. Town Terrain, Lawns, Stone Curbs & Wet Main Street
    ctx.fillStyle = '#0e171f';
    ctx.fillRect(0, 42, TOWN_W, 40);
    ctx.fillStyle = '#101a21';
    ctx.fillRect(0, 102, TOWN_W, 78);

    // Subtle textured turf patches & autumn leaves
    const turfCoords = [
      [18, 56], [88, 62], [186, 52], [296, 68], [22, 118], [84, 152], [234, 118], [282, 160],
    ];
    turfCoords.forEach(([tx, ty]) => {
      ctx.fillStyle = '#142329';
      ctx.fillRect(tx, ty, 12, 4);
      ctx.fillStyle = '#78350f'; // fallen autumn leaf pixel
      ctx.fillRect(tx + 3, ty + 1, 2, 1);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(tx + 8, ty + 2, 1, 1);
    });

    // Concrete Sidewalks with slab joints & curb shadow
    ctx.fillStyle = '#2c3749';
    ctx.fillRect(0, 81, TOWN_W, 5);
    ctx.fillStyle = '#1e2736';
    ctx.fillRect(0, 85, TOWN_W, 1);
    ctx.fillStyle = '#2c3749';
    ctx.fillRect(0, 101, TOWN_W, 5);
    ctx.fillStyle = '#3b485e';
    for (let sx = 0; sx < TOWN_W; sx += 16) {
      ctx.fillRect(sx, 81, 1, 4);
      ctx.fillRect(sx + 8, 101, 1, 4);
    }

    // Wet Asphalt Main Street
    ctx.fillStyle = '#141a24';
    ctx.fillRect(0, 86, TOWN_W, 15);
    ctx.fillStyle = '#19212e';
    ctx.fillRect(0, 91, TOWN_W, 5);
    // Crosswalk stripes near Town Hall & General Store
    ctx.fillStyle = '#475569';
    for (let cy = 87; cy <= 99; cy += 3) {
      ctx.fillRect(98, cy, 5, 1);
      ctx.fillRect(190, cy, 5, 1);
    }
    // Center dashed yellow line
    ctx.fillStyle = '#785828';
    for (let x = 8; x < TOWN_W; x += 18) {
      if (Math.abs(x - 98) > 8 && Math.abs(x - 190) > 8) {
        ctx.fillRect(x, 93, 8, 1);
      }
    }

    // Substation gravel driveway
    ctx.fillStyle = '#1d2636';
    ctx.fillRect(148, 101, 24, 14);
    ctx.fillStyle = '#293548';
    ctx.fillRect(150, 104, 20, 8);

    // Rain puddles with crisp light shimmer + thunder light reflections
    this.drawPuddle(ctx, 40, 95, 18, 3, thunder > 0.2 ? '#7dd3fc' : districts.town_hall.powered ? '#92400e' : null);
    this.drawPuddle(ctx, 130, 89, 20, 3, thunder > 0.2 ? '#7dd3fc' : districts.general_store.powered ? '#92400e' : null);
    this.drawPuddle(ctx, 234, 95, 20, 3, thunder > 0.2 ? '#7dd3fc' : districts.bank.powered ? '#065f46' : null);

    // Street Props: Storm drains, fire hydrants, park benches & mailbox
    [90, 182, 266].forEach((dx) => {
      ctx.fillStyle = '#090d14';
      ctx.fillRect(dx, 86, 5, 2);
      ctx.fillStyle = '#334155';
      ctx.fillRect(dx + 1, 86, 1, 2);
      ctx.fillRect(dx + 3, 86, 1, 2);
    });
    this.drawHydrant(ctx, 97, 81);
    this.drawHydrant(ctx, 202, 81);
    this.drawMailbox(ctx, 22, 81);
    this.drawParkBench(ctx, 64, 102);
    this.drawParkBench(ctx, 240, 102);

    // Parked civilian cars outside General Store & Bank
    this.drawParkedCar(ctx, 180, 82, '#334155');
    this.drawParkedCar(ctx, 274, 82, '#3f2e26');

    // 3. Detailed Multi-Shade Pine Trees & Utility Poles
    const sway = profile.intensity >= 2 && Math.sin(timeSec * 4.5) > 0.4 ? -1 : 0;
    this.drawDetailedPine(ctx, 8 + sway, 32, thunder);
    this.drawDetailedPine(ctx, 98 + sway, 28, thunder);
    this.drawDetailedPine(ctx, 190 + sway, 30, thunder);
    this.drawDetailedPine(ctx, 294 + sway, 38, thunder);
    this.drawDetailedPine(ctx, 24, 122, thunder);
    this.drawDetailedPine(ctx, 64, 138, thunder);
    this.drawDetailedPine(ctx, 246, 124, thunder);
    this.drawDetailedPine(ctx, 286, 140, thunder);

    // Wooden Utility Poles & Sagging Catenary Power Lines
    const poles = [
      [16, 76],
      [104, 74],
      [196, 74],
      [288, 76],
    ];
    const lineCol =
      districts.substation.powered && !districts.substation.breakerTripped
        ? '#475569'
        : '#1e293b';
    for (let i = 0; i < poles.length - 1; i++) {
      this.drawSaggingWire(ctx, poles[i][0] + 1, poles[i][1] - 10, poles[i + 1][0] + 1, poles[i + 1][1] - 10, lineCol);
    }
    this.drawSaggingWire(ctx, 160, 114, 60, 72, lineCol);
    this.drawSaggingWire(ctx, 160, 114, 150, 64, lineCol);
    this.drawSaggingWire(ctx, 160, 114, 244, 70, lineCol);
    poles.forEach(([px, py]) => {
      ctx.fillStyle = '#3f2a1d';
      ctx.fillRect(px, py - 12, 2, 18);
      ctx.fillStyle = '#573b29';
      ctx.fillRect(px - 3, py - 10, 8, 1);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(px - 3, py - 11, 1, 1);
      ctx.fillRect(px + 4, py - 11, 1, 1);
    });

    // 4. Detailed 16-Bit Pixel Buildings (with thunder rim lighting)
    this.drawTownHall(ctx, districts.town_hall, timeSec, thunder);
    this.drawGeneralStore(ctx, districts.general_store, timeSec, thunder);
    this.drawBank(ctx, districts.bank, timeSec, thunder);
    this.drawSubstation(ctx, districts.substation, timeSec, thunder);

    // 5. Ornate Streetlamps & Wet Ground Halos
    const lamps = [22, 108, 200, 284];
    lamps.forEach((lx, idx) => {
      const nearestPowered =
        idx === 0
          ? districts.town_hall.powered
          : idx === 1
          ? districts.general_store.powered
          : idx === 2
          ? districts.bank.powered
          : districts.substation.powered;
      const flicker = nearestPowered && Math.sin(timeSec * 14 + idx * 3.1) > -0.92;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(lx, 72, 2, 13);
      ctx.fillStyle = '#475569';
      ctx.fillRect(lx, 71, 5, 1);
      ctx.fillRect(lx - 1, 83, 4, 2);
      if (flicker) {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(lx + 3, 72, 2, 2);
        ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
        ctx.fillRect(lx - 5, 83, 18, 7);
        ctx.fillStyle = 'rgba(251, 191, 36, 0.08)';
        ctx.fillRect(lx - 8, 74, 24, 18);
      } else {
        ctx.fillStyle = '#334155';
        ctx.fillRect(lx + 3, 72, 2, 2);
      }
    });

    // 6. Patrolling Oakhaven Police Cruisers & Characters
    for (const car of this.cruisers) {
      this.drawPoliceCruiser(ctx, car, timeSec);
    }

    for (const npc of this.npcs) {
      this.drawNpcCharacter(ctx, npc, districts, timeSec);
    }
    this.drawMainGuard(ctx, this.guard, districts, broadcastPending, timeSec);

    // 7. Selection / Hover Pixel Brackets & Building Clues/Rumor Tags
    (Object.values(districts) as DistrictState[]).forEach((d) => {
      const isSelected = d.id === selectedId;
      const isHovered = d.id === hoveredId;
      if (isSelected || isHovered) {
        const { x, y, w, h } = d.mapRect;
        const col = isSelected ? '#f59e0b' : '#94a3b8';
        this.drawCornerBrackets(ctx, x - 3, y - 3, w + 6, h + 6, col);
      }
      this.drawDistrictStatusTag(ctx, d, timeSec, clueProgress?.[d.id]);
    });

    // 8. Animated Weather Overlays & Full-Scene Thunder Light Wash
    if (profile.fogAlpha > 0) {
      const mistShift = Math.floor((timeSec * 14) % TOWN_W);
      ctx.fillStyle = `rgba(148, 163, 184, ${profile.fogAlpha.toFixed(2)})`;
      ctx.fillRect(0, 36, TOWN_W, 18);
      ctx.fillRect((TOWN_W - mistShift) % TOWN_W, 108, 120, 12);
    }

    ctx.fillStyle =
      thunder > 0.2
        ? 'rgba(224, 242, 254, 0.65)'
        : profile.intensity === 3
        ? 'rgba(165, 208, 255, 0.42)'
        : profile.intensity === 2
        ? 'rgba(148, 197, 255, 0.34)'
        : 'rgba(148, 197, 255, 0.22)';
    for (let i = 0; i < profile.rainCount; i++) {
      const drop = this.rain[i];
      ctx.fillRect(Math.floor(drop.x), Math.floor(drop.y), 1, drop.len);
    }

    for (const sp of this.splashes) {
      ctx.fillStyle = 'rgba(186, 230, 253, 0.55)';
      ctx.fillRect(Math.floor(sp.x), Math.floor(sp.y), 2, 1);
    }

    if (profile.snowCount > 0) {
      ctx.fillStyle = 'rgba(226, 238, 252, 0.78)';
      for (let i = 0; i < profile.snowCount; i++) {
        const flake = this.snow[i];
        ctx.fillRect(Math.floor(flake.x), Math.floor(flake.y), flake.size, flake.size);
      }
    }

    for (const s of this.sparks) {
      ctx.fillStyle = s.color;
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 2, 2);
    }

    if (thunder > 0.08) {
      ctx.fillStyle = `rgba(219, 234, 254, ${(thunder * 0.36).toFixed(3)})`;
      ctx.fillRect(0, 0, TOWN_W, TOWN_H);
    }
  }

  private drawMainGuard(
    ctx: CanvasRenderingContext2D,
    guard: GuardState,
    districts: Record<DistrictId, DistrictState>,
    broadcastPending: boolean,
    timeSec: number
  ) {
    const gx = Math.floor(guard.x);
    const gy = Math.floor(guard.y);
    const stride = guard.moving ? Math.floor(guard.walkPhase) % 2 : 0;

    // Directional flashlight beam on ground
    ctx.fillStyle = 'rgba(254, 243, 199, 0.16)';
    if (guard.facing === 'right') {
      ctx.fillRect(gx + 5, gy - 4, 18, 6);
    } else if (guard.facing === 'left') {
      ctx.fillRect(gx - 22, gy - 4, 18, 6);
    } else if (guard.facing === 'up') {
      ctx.fillRect(gx - 3, gy - 18, 7, 12);
    } else {
      ctx.fillRect(gx - 3, gy + 1, 7, 12);
    }

    // Contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(gx - 3, gy, 7, 2);

    // Walking legs
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(gx - 2, gy - 3 + (stride === 0 ? 0 : -1), 2, 3);
    ctx.fillRect(gx + 1, gy - 3 + (stride === 1 ? 0 : -1), 2, 3);

    // Watch Officer Coat & High-Vis Safety Sash
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(gx - 3, gy - 8, 7, 5);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(gx - 2, gy - 7, 5, 2);

    // Head & Peaked Guard Cap
    ctx.fillStyle = '#f1c29b';
    ctx.fillRect(gx - 2, gy - 11, 5, 3);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(gx - 2, gy - 13, 5, 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(gx, gy - 12, 1, 1);

    // Handheld Radio / Phone in hand (glows cyan; pulses if broadcast incoming)
    const handX = guard.facing === 'left' ? gx - 4 : gx + 4;
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(handX, gy - 7, 1, 3);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(handX, gy - 9, 1, 2);
    if (broadcastPending && Math.floor(timeSec * 6) % 2 === 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(handX - 2, gy - 12, 5, 1);
      ctx.fillRect(handX - 1, gy - 14, 3, 1);
    }

    // Nearby interact badge [E]
    const near = this.getNearestDistrict(districts);
    if (near) {
      const d = districts[near];
      if (d.breakerTripped || d.investigationUnlocked) {
        ctx.fillStyle = '#090d14';
        ctx.fillRect(gx - 6, gy - 21, 13, 7);
        ctx.fillStyle = d.breakerTripped ? '#f87171' : '#fbbf24';
        ctx.font = 'bold 5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[E]', gx, gy - 16);
      }
    }
  }

  private drawNpcCharacter(
    ctx: CanvasRenderingContext2D,
    npc: NpcCharacter,
    districts: Record<DistrictId, DistrictState>,
    timeSec: number
  ) {
    const nx = Math.floor(npc.x);
    const ny = Math.floor(npc.y);
    const step = Math.floor(timeSec * 5 + npc.homeX) % 2;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(nx - 2, ny, 5, 2);

    // Trousers / boots
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(nx - 2, ny - 3 + (step === 0 ? 0 : -1), 2, 3);
    ctx.fillRect(nx + 1, ny - 3 + (step === 1 ? 0 : -1), 2, 3);

    // Role outfit
    const coatCol =
      npc.role === 'chief'
        ? '#1d4ed8'
        : npc.role === 'shopkeeper'
        ? '#991b1b'
        : npc.role === 'clerk'
        ? '#334155'
        : npc.role === 'tech'
        ? '#d97706'
        : '#475569';
    ctx.fillStyle = coatCol;
    ctx.fillRect(nx - 2, ny - 7, 5, 4);
    if (npc.role === 'shopkeeper') {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(nx - 1, ny - 6, 3, 3);
    } else if (npc.role === 'chief') {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(nx + 1, ny - 6, 1, 1);
    }

    // Face & hat/hair
    ctx.fillStyle = '#e8be9e';
    ctx.fillRect(nx - 1, ny - 10, 3, 3);
    ctx.fillStyle =
      npc.role === 'tech'
        ? '#facc15'
        : npc.role === 'chief'
        ? '#0f172a'
        : '#451a03';
    ctx.fillRect(nx - 2, ny - 11, 5, 2);

    // Subtle panic indicator if linked district has active rumor
    const panicked = npc.linkedDistrict && districts[npc.linkedDistrict].rumorAlert;
    if (panicked && Math.floor(timeSec * 3) % 2 === 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(nx, ny - 15, 1, 2);
      ctx.fillRect(nx, ny - 12, 1, 1);
    }
  }

  private fillPixelRidge(
    ctx: CanvasRenderingContext2D,
    pts: [number, number][],
    bottomY: number
  ) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], bottomY);
    pts.forEach(([px, py]) => ctx.lineTo(px, py));
    ctx.lineTo(pts[pts.length - 1][0], bottomY);
    ctx.closePath();
    ctx.fill();
  }

  private drawPuddle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    reflectionCol: string | null
  ) {
    ctx.fillStyle = '#1b283b';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#253952';
    ctx.fillRect(x + 2, y + 1, w - 4, 1);
    if (reflectionCol) {
      ctx.fillStyle = reflectionCol;
      ctx.fillRect(x + 4, y + 1, Math.max(3, w - 10), 1);
    }
  }

  private drawParkedCar(ctx: CanvasRenderingContext2D, x: number, y: number, bodyCol: string) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, y + 5, 13, 2);
    ctx.fillStyle = bodyCol;
    ctx.fillRect(x, y + 2, 13, 3);
    ctx.fillRect(x + 3, y, 7, 2);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 4, y + 1, 5, 1);
    ctx.fillStyle = '#090d14';
    ctx.fillRect(x + 2, y + 5, 2, 1);
    ctx.fillRect(x + 9, y + 5, 2, 1);
  }

  private drawSaggingWire(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string
  ) {
    ctx.fillStyle = color;
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = Math.floor(x1 + (x2 - x1) * t);
      const sag = Math.sin(t * Math.PI) * 4;
      const py = Math.floor(y1 + (y2 - y1) * t + sag);
      ctx.fillRect(px, py, 1, 1);
    }
  }

  private drawForkedLightning(
    ctx: CanvasRenderingContext2D,
    bx: number,
    variant: number,
    alpha: number
  ) {
    // Wide outer cyan thunder aura
    ctx.fillStyle = `rgba(56, 189, 248, ${(alpha * 0.55).toFixed(2)})`;
    ctx.fillRect(bx - 2, 0, 5, 14);
    ctx.fillRect(bx - 4, 14, 5, 12);
    ctx.fillRect(bx - 2, 26, 5, 12);

    // Core crisp electric bolt
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx, 0, 1, 8);
    ctx.fillRect(bx - 1, 8, 2, 6);
    ctx.fillRect(bx - 2, 14, 1, 7);
    ctx.fillRect(bx - 1, 21, 2, 7);
    ctx.fillRect(bx + 1, 28, 1, 8);

    // Side branches
    ctx.fillStyle = '#bae6fd';
    if (variant === 0) {
      ctx.fillRect(bx + 1, 11, 3, 1);
      ctx.fillRect(bx + 3, 12, 1, 6);
      ctx.fillRect(bx - 4, 22, 3, 1);
      ctx.fillRect(bx - 5, 23, 1, 5);
    } else if (variant === 1) {
      ctx.fillRect(bx - 4, 15, 3, 1);
      ctx.fillRect(bx - 5, 16, 1, 7);
      ctx.fillRect(bx + 2, 24, 3, 1);
      ctx.fillRect(bx + 4, 25, 1, 6);
    } else {
      ctx.fillRect(bx + 2, 9, 4, 1);
      ctx.fillRect(bx + 5, 10, 1, 8);
    }
  }

  private drawHydrant(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(x, y, 3, 4);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(x + 1, y - 1, 1, 4);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(x - 1, y + 1, 5, 1);
  }

  private drawMailbox(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 1, y + 2, 2, 3);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(x, y - 1, 4, 3);
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(x + 1, y - 1, 2, 1);
  }

  private drawParkBench(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#451a03';
    ctx.fillRect(x, y, 10, 2);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x, y + 2, 10, 1);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 1, y + 3, 1, 2);
    ctx.fillRect(x + 8, y + 3, 1, 2);
  }

  private drawDetailedPine(ctx: CanvasRenderingContext2D, x: number, y: number, thunder = 0) {
    ctx.fillStyle = '#2c1c12';
    ctx.fillRect(x + 5, y + 17, 2, 4);
    ctx.fillStyle = '#0b1c17';
    ctx.fillRect(x + 5, y, 2, 3);
    ctx.fillRect(x + 3, y + 3, 6, 4);
    ctx.fillRect(x + 2, y + 7, 8, 5);
    ctx.fillRect(x + 1, y + 12, 10, 5);
    ctx.fillStyle = thunder > 0.22 ? '#2b6150' : '#14332a';
    ctx.fillRect(x + 5, y + 1, 1, 2);
    ctx.fillRect(x + 3, y + 4, 3, 2);
    ctx.fillRect(x + 2, y + 8, 4, 3);
    ctx.fillRect(x + 1, y + 13, 5, 3);
    ctx.fillStyle = thunder > 0.22 ? '#93c5fd' : '#1d473a';
    ctx.fillRect(x + 3, y + 4, 2, 1);
    ctx.fillRect(x + 2, y + 8, 2, 1);
  }

  private drawPoliceCruiser(ctx: CanvasRenderingContext2D, car: PoliceCruiser, timeSec: number) {
    const cx = Math.floor(car.x);
    const cy = Math.floor(car.y);
    const strobe = Math.floor((timeSec + car.phaseOffset) * 8) % 2 === 0;
    const redBlueCol = strobe ? '#ef4444' : '#3b82f6';
    const altCol = strobe ? '#3b82f6' : '#ef4444';

    ctx.fillStyle = strobe ? 'rgba(239, 68, 68, 0.22)' : 'rgba(59, 130, 246, 0.22)';
    ctx.fillRect(cx - 2, cy + 5, 20, 4);

    ctx.fillStyle = '#0b1120';
    ctx.fillRect(cx, cy + 2, 16, 4);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx + 1, cy + 2, 14, 1);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(cx + 4, cy + 2, 8, 3);
    ctx.fillRect(cx + 3, cy, 9, 2);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(cx + 7, cy + 3, 2, 1);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(cx + 4, cy + 1, 2, 1);
    ctx.fillRect(cx + 9, cy + 1, 2, 1);
    // Whip antenna & steel push bumper
    ctx.fillStyle = '#64748b';
    ctx.fillRect(cx + 2, cy - 3, 1, 5);
    ctx.fillRect(car.dir === 1 ? cx + 16 : cx - 1, cy + 3, 1, 3);
    ctx.fillStyle = '#020617';
    ctx.fillRect(cx + 2, cy + 6, 3, 2);
    ctx.fillRect(cx + 11, cy + 6, 3, 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(cx + 3, cy + 6, 1, 1);
    ctx.fillRect(cx + 12, cy + 6, 1, 1);

    ctx.fillStyle = redBlueCol;
    ctx.fillRect(cx + 5, cy - 1, 2, 1);
    ctx.fillStyle = altCol;
    ctx.fillRect(cx + 8, cy - 1, 2, 1);

    if (car.dir === 1) {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.28)';
      ctx.fillRect(cx + 16, cy + 2, 18, 4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(cx + 15, cy + 3, 1, 1);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx - 1, cy + 3, 1, 2);
    } else {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.28)';
      ctx.fillRect(cx - 18, cy + 2, 18, 4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(cx, cy + 3, 1, 1);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(cx + 16, cy + 3, 1, 2);
    }
  }

  private drawTownHall(
    ctx: CanvasRenderingContext2D,
    d: DistrictState,
    timeSec: number,
    thunder = 0
  ) {
    const { x, y, w, h } = d.mapRect; // 26,34,68,52
    const lit = d.powered && !d.breakerTripped;

    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.fillRect(x + 2, y + h - 3, w, 4);

    // Brick main structure + masonry texture + stone corner quoins
    ctx.fillStyle = lit ? '#522c2a' : '#2a1c20';
    ctx.fillRect(x + 4, y + 18, w - 8, h - 20);
    ctx.fillStyle = lit ? '#653734' : '#332327';
    for (let by = y + 20; by < y + h - 4; by += 4) {
      for (let bx = x + 6; bx < x + w - 8; bx += 6) {
        ctx.fillRect(bx + ((by / 4) % 2) * 2, by, 3, 1);
      }
    }
    ctx.fillStyle = '#475569';
    for (let qy = y + 19; qy < y + h - 5; qy += 4) {
      ctx.fillRect(x + 4, qy, 2, 2);
      ctx.fillRect(x + w - 6, qy, 2, 2);
    }

    // Brick chimney + wisps of furnace smoke
    ctx.fillStyle = '#3f2222';
    ctx.fillRect(x + 8, y + 6, 6, 9);
    const smk = Math.floor(timeSec * 3) % 4;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.fillRect(x + 9 - smk, y + 2 - smk, 3, 2);

    // Stone cornice & pitched slate roof with thunder highlight
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 1, y + 14, w - 2, 4);
    ctx.fillStyle = thunder > 0.2 ? '#7dd3fc' : '#334155';
    ctx.fillRect(x + 2, y + 13, w - 4, 2);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x + 3, y + 18, w - 6, 1);

    // Central Clock Tower, Belfry & Spire
    ctx.fillStyle = lit ? '#5e3533' : '#302124';
    ctx.fillRect(x + 24, y + 4, 20, 12);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 22, y + 1, 24, 4);
    ctx.fillStyle = thunder > 0.2 ? '#bae6fd' : '#0f172a';
    ctx.fillRect(x + 28, y - 2, 12, 3);
    // Radio mast + guy wires
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x + 33, y - 10, 2, 8);
    ctx.fillRect(x + 31, y - 6, 6, 1);
    if (lit && Math.sin(timeSec * 5) > 0) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x + 33, y - 11, 2, 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.fillRect(x + 31, y - 13, 6, 6);
    }
    // Side flagpole + blowing town pennant
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x + 56, y + 3, 1, 11);
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(x + 57, y + 4 + (Math.floor(timeSec * 5) % 2), 5, 2);

    // Illuminated Clock Face
    ctx.fillStyle = lit ? '#fef3c7' : '#334155';
    ctx.fillRect(x + 30, y + 6, 8, 7);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 34, y + 7, 1, 3);
    ctx.fillRect(x + 34, y + 9, 2, 1);

    // Framed Mullion Windows + exterior notice case
    for (let wx = x + 9; wx <= x + 51; wx += 14) {
      this.drawPixelWindow(ctx, wx, y + 22, 7, 8, lit);
      if (wx !== x + 37 && wx !== x + 23) {
        this.drawPixelWindow(ctx, wx, y + 34, 7, 8, lit);
      }
    }
    // Porch bulletin glass case
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x + 17, y + 36, 7, 7);
    ctx.fillStyle = lit ? '#e2e8f0' : '#334155';
    ctx.fillRect(x + 18, y + 37, 5, 5);

    // Classical Entry Pediment, Steps, Brass Lantern & Double Doors
    ctx.fillStyle = '#475569';
    ctx.fillRect(x + 26, y + 32, 16, 2);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x + 25, y + 48, 18, 2);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 28, y + 34, 12, 14);
    ctx.fillStyle = lit ? '#f59e0b' : '#0f172a';
    ctx.fillRect(x + 30, y + 36, 3, 11);
    ctx.fillRect(x + 35, y + 36, 3, 11);
    if (lit) {
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x + 41, y + 37, 2, 2);
    }
  }

  private drawGeneralStore(
    ctx: CanvasRenderingContext2D,
    d: DistrictState,
    timeSec: number,
    thunder = 0
  ) {
    const { x, y, w, h } = d.mapRect; // 118,28,64,46
    const lit = d.powered && !d.breakerTripped;

    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.fillRect(x + 2, y + h - 2, w, 4);

    // Clapboard siding with horizontal plank seams
    ctx.fillStyle = lit ? '#4b3827' : '#251e18';
    ctx.fillRect(x + 4, y + 12, w - 8, h - 14);
    ctx.fillStyle = lit ? '#3d2c1e' : '#1c1712';
    for (let py = y + 15; py < y + h - 3; py += 3) {
      ctx.fillRect(x + 4, py, w - 8, 1);
    }

    // False-front timber cornice & Store Signboard
    ctx.fillStyle = lit ? '#5f4732' : '#2f261e';
    ctx.fillRect(x + 5, y + 3, w - 10, 10);
    ctx.fillStyle = thunder > 0.2 ? '#7dd3fc' : '#1e293b';
    ctx.fillRect(x + 4, y + 2, w - 8, 2);
    ctx.fillStyle = lit ? '#fef3c7' : '#334155';
    ctx.fillRect(x + 12, y + 5, w - 24, 6);
    ctx.fillStyle = lit ? '#991b1b' : '#475569';
    ctx.fillRect(x + 14, y + 7, w - 28, 2);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x + 13, y + 6, 1, 1);
    ctx.fillRect(x + w - 14, y + 6, 1, 1);

    // Upper loft windows + flower boxes
    this.drawPixelWindow(ctx, x + 12, y + 15, 7, 6, lit);
    this.drawPixelWindow(ctx, x + 45, y + 15, 7, 6, lit);

    // Scalloped red/cream striped awning + underside shadow
    for (let ax = x + 4; ax < x + w - 4; ax += 6) {
      const red = ((ax - x) / 6) % 2 === 0;
      ctx.fillStyle = red ? '#b91c1c' : '#e2e8f0';
      ctx.fillRect(ax, y + 23, 6, 5);
      ctx.fillStyle = red ? '#7f1d1d' : '#94a3b8';
      ctx.fillRect(ax, y + 28, 6, 1);
    }

    // Display shopfront windows with interior shelf silhouettes
    ctx.fillStyle = lit ? '#fbbf24' : '#161e2b';
    ctx.fillRect(x + 9, y + 31, 16, 10);
    ctx.fillRect(x + 39, y + 31, 16, 10);
    if (lit) {
      ctx.fillStyle = '#b45309';
      ctx.fillRect(x + 11, y + 36, 12, 1);
      ctx.fillRect(x + 41, y + 36, 12, 1);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x + 12, y + 33, 3, 3);
      ctx.fillStyle = '#15803d';
      ctx.fillRect(x + 43, y + 33, 3, 3);
    }
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 28, y + 30, 8, 14);
    ctx.fillStyle = lit ? '#f59e0b' : '#0f172a';
    ctx.fillRect(x + 30, y + 32, 4, 8);
    if (lit && Math.sin(timeSec * 8) > -0.8) {
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x + 31, y + 29, 2, 1);
    }

    // Rain barrel, firewood rack, wooden supply crates & porch barrel
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(x + 1, y + 34, 4, 9);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x + 6, y + 39, 6, 5);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x + 7, y + 40, 4, 1);
    ctx.fillStyle = '#57534e';
    ctx.fillRect(x + 52, y + 38, 6, 6);
    ctx.fillStyle = '#a8a29e';
    ctx.fillRect(x + 52, y + 40, 6, 1);
  }

  private drawBank(
    ctx: CanvasRenderingContext2D,
    d: DistrictState,
    timeSec: number,
    thunder = 0
  ) {
    const { x, y, w, h } = d.mapRect; // 208,32,72,50
    const lit = d.powered && !d.breakerTripped;

    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.fillRect(x + 2, y + h - 3, w, 4);

    // Carved limestone ashlar facade
    ctx.fillStyle = lit ? '#374457' : '#1e2430';
    ctx.fillRect(x + 4, y + 12, w - 8, h - 14);
    ctx.fillStyle = lit ? '#475569' : '#262f3e';
    for (let sy = y + 16; sy < y + h - 4; sy += 6) {
      ctx.fillRect(x + 4, sy, w - 8, 1);
    }

    // Classical Pediment & Cornice + Clock Medallion
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 2, y + 8, w - 4, 5);
    ctx.fillStyle = thunder > 0.2 ? '#93c5fd' : lit ? '#64748b' : '#334155';
    ctx.fillRect(x + 10, y + 5, w - 20, 4);
    ctx.fillStyle = thunder > 0.2 ? '#e0f2fe' : lit ? '#94a3b8' : '#475569';
    ctx.fillRect(x + 20, y + 3, w - 40, 2);
    ctx.fillStyle = lit ? '#fbbf24' : '#475569';
    ctx.fillRect(x + 34, y + 6, 4, 3);

    // Side barred teller windows
    this.drawPixelWindow(ctx, x + 6, y + 23, 5, 10, lit);
    this.drawPixelWindow(ctx, x + 61, y + 23, 5, 10, lit);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 8, y + 23, 1, 10);
    ctx.fillRect(x + 63, y + 23, 1, 10);

    // Four Fluted Pillars with capitals & bases
    [12, 23, 45, 56].forEach((px) => {
      ctx.fillStyle = lit ? '#cbd5e1' : '#64748b';
      ctx.fillRect(x + px - 1, y + 13, 6, 2);
      ctx.fillRect(x + px - 1, y + 46, 6, 2);
      ctx.fillStyle = lit ? '#94a3b8' : '#475569';
      ctx.fillRect(x + px, y + 15, 4, 31);
      ctx.fillStyle = lit ? '#64748b' : '#334155';
      ctx.fillRect(x + px + 2, y + 15, 1, 31);
    });

    // Illuminated Bank Sign & ATM Vestibule Glow + Brass Handrails
    ctx.fillStyle = lit ? '#34d399' : '#0f172a';
    ctx.fillRect(x + 28, y + 16, 16, 4);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 30, y + 25, 12, 21);
    ctx.fillStyle = lit ? '#34d399' : '#1e293b';
    ctx.fillRect(x + 32, y + 27, 8, 17);
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(x + 28, y + 44, 2, 4);
    ctx.fillRect(x + 42, y + 44, 2, 4);
    if (lit && Math.sin(timeSec * 2) > -0.4) {
      ctx.fillStyle = 'rgba(52, 211, 153, 0.22)';
      ctx.fillRect(x + 27, y + 45, 18, 6);
    }
  }

  private drawSubstation(
    ctx: CanvasRenderingContext2D,
    d: DistrictState,
    timeSec: number,
    thunder = 0
  ) {
    const { x, y, w, h } = d.mapRect; // 112,108,96,50
    const active = d.powered && !d.breakerTripped;

    ctx.fillStyle = '#1b222c';
    ctx.fillRect(x + 4, y + 6, w - 8, h - 8);
    ctx.fillStyle = '#252e3c';
    for (let gx = x + 8; gx < x + w - 10; gx += 7) {
      for (let gy = y + 10; gy < y + h - 6; gy += 6) {
        ctx.fillRect(gx + (gy % 3), gy, 2, 1);
      }
    }

    // Chain-link fence + barbed top strand + corner posts
    ctx.strokeStyle = thunder > 0.2 ? '#93c5fd' : '#475569';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4.5, y + 6.5, w - 9, h - 9);
    ctx.fillStyle = '#64748b';
    [x + 4, x + 36, x + 68, x + w - 6].forEach((fx) => {
      ctx.fillRect(fx, y + 5, 2, 3);
      ctx.fillRect(fx, y + h - 4, 2, 3);
    });

    // Main High-Voltage Transformer Bank (left)
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 11, y + 15, 24, 24);
    ctx.fillStyle = thunder > 0.2 ? '#7dd3fc' : '#475569';
    ctx.fillRect(x + 11, y + 15, 24, 2);
    [15, 22, 29].forEach((bx) => {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x + bx, y + 10, 3, 5);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x + bx, y + 12, 3, 1);
      if (active && Math.sin(timeSec * 15 + bx) > 0.7) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x + bx + 1, y + 9, 1, 1);
      }
    });
    ctx.fillStyle = '#1e293b';
    for (let fy = y + 19; fy <= y + 33; fy += 4) {
      ctx.fillRect(x + 14, fy, 18, 2);
    }

    // Corrugated Control Shed (center)
    ctx.fillStyle = '#283446';
    ctx.fillRect(x + 39, y + 16, 18, 23);
    ctx.fillStyle = thunder > 0.2 ? '#93c5fd' : '#1e293b';
    ctx.fillRect(x + 38, y + 14, 20, 3);
    ctx.fillStyle = active ? '#fbbf24' : '#0f172a';
    ctx.fillRect(x + 42, y + 20, 12, 6);
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(x + 44, y + 30, 8, 8);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + 44, y + 30, 8, 2);

    // Cylindrical Diesel Generator Tank & Piping (right) + Valve Wheel
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x + 62, y + 20, 24, 16);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(x + 63, y + 21, 22, 4);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(x + 65, y + 22, 18, 1);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(x + 84, y + 26, 3, 3);
    ctx.fillStyle = '#475569';
    ctx.fillRect(x + 60, y + 14, 2, 12);

    // Yard floodlight stanchion
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x + 88, y + 10, 2, 28);
    if (active) {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.12)';
      ctx.fillRect(x + 70, y + 12, 20, 24);
    }

    const pulse = Math.floor(timeSec * 4) % 2 === 0;
    ctx.fillStyle = d.breakerTripped
      ? pulse
        ? '#ef4444'
        : '#7f1d1d'
      : active
      ? '#10b981'
      : '#64748b';
    ctx.fillRect(x + 47, y + 11, 3, 3);
  }

  private drawPixelWindow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    lit: boolean
  ) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = lit ? '#fbbf24' : '#161f2c';
    ctx.fillRect(x, y, w, h);
    if (lit) {
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(x + 1, y + 1, Math.max(1, w - 3), 2);
    }
    ctx.fillStyle = '#334155';
    ctx.fillRect(x - 1, y + h, w + 2, 1);
    ctx.fillRect(x + Math.floor(w / 2), y, 1, h);
  }

  private drawCornerBrackets(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string
  ) {
    ctx.fillStyle = color;
    const len = 6;
    ctx.fillRect(x, y, len, 1);
    ctx.fillRect(x, y, 1, len);
    ctx.fillRect(x + w - len, y, len, 1);
    ctx.fillRect(x + w - 1, y, 1, len);
    ctx.fillRect(x, y + h - 1, len, 1);
    ctx.fillRect(x, y + h - len, 1, len);
    ctx.fillRect(x + w - len, y + h - 1, len, 1);
    ctx.fillRect(x + w - 1, y + h - len, 1, len);
  }

  private drawDistrictStatusTag(
    ctx: CanvasRenderingContext2D,
    d: DistrictState,
    timeSec: number,
    clueCount?: { found: number; total: number }
  ) {
    const cx = Math.floor(d.mapRect.x + d.mapRect.w / 2);
    const ty = Math.floor(d.mapRect.y - 11);
    const bob = Math.sin(timeSec * 4) > 0 ? 0 : -1;

    if (d.breakerTripped) {
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(cx - 25, ty + bob, 50, 9);
      ctx.fillStyle = '#fecaca';
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BREAKER OUT', cx, ty + bob + 6);
    } else if (d.rumorAlert) {
      ctx.fillStyle = '#92400e';
      ctx.fillRect(cx - 25, ty + bob, 50, 9);
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('RUMOR ALERT', cx, ty + bob + 6);
    } else if (d.investigationUnlocked && !d.investigationCompleted) {
      const label = clueCount ? `CLUES ${clueCount.found}/${clueCount.total}` : 'FIND CLUES';
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(cx - 24, ty + bob, 48, 9);
      ctx.fillStyle = '#bae6fd';
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, ty + bob + 6);
    } else if (d.investigationCompleted) {
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(cx - 24, ty + bob, 48, 9);
      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CLUES DONE', cx, ty + bob + 6);
    }
  }
}
