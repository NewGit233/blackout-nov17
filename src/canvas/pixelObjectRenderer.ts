import { HiddenObjectDef, InvestigationSceneDef } from '../types/game';

export const SCENE_W = 320;
export const SCENE_H = 180;

interface BurstParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export class InvestigationRenderer {
  private particles: BurstParticle[] = [];
  private missRipples: { x: number; y: number; life: number }[] = [];
  private roomThunderAlpha = 0;
  private nextRoomThunder = 6;

  public spawnFoundBurst(x: number, y: number) {
    for (let i = 0; i < 18; i++) {
      const ang = (Math.PI * 2 * i) / 18 + Math.random() * 0.25;
      const spd = 22 + Math.random() * 38;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.5 + Math.random() * 0.3,
        color: i % 2 === 0 ? '#fbbf24' : '#38bdf8',
      });
    }
  }

  public spawnMissRipple(x: number, y: number) {
    this.missRipples.push({ x, y, life: 0.35 });
  }

  public update(dt: number) {
    this.nextRoomThunder -= dt;
    if (this.nextRoomThunder <= 0) {
      this.roomThunderAlpha = 0.45;
      this.nextRoomThunder = 6.5 + Math.random() * 8;
    }
    if (this.roomThunderAlpha > 0) {
      this.roomThunderAlpha = Math.max(0, this.roomThunderAlpha - dt * 1.8);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.missRipples.length - 1; i >= 0; i--) {
      const r = this.missRipples[i];
      r.life -= dt;
      if (r.life <= 0) this.missRipples.splice(i, 1);
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    scene: InvestigationSceneDef,
    foundIds: Set<string>,
    puzzleSolved: boolean,
    cursor: { x: number; y: number } | null,
    wideLantern: boolean,
    flashlightDead: boolean,
    flashlightFlicker: boolean,
    hintTarget: { obj: HiddenObjectDef; tier: 1 | 2 } | null,
    timeSec: number
  ) {
    ctx.imageSmoothingEnabled = false;

    if (scene.roomTheme === 'dispatch') {
      this.drawDispatchRoom(ctx, timeSec);
    } else if (scene.roomTheme === 'pantry') {
      this.drawPantryRoom(ctx, timeSec);
    } else if (scene.roomTheme === 'vestibule') {
      this.drawVestibuleRoom(ctx, timeSec);
    } else {
      this.drawRelayRoom(ctx, timeSec);
    }

    for (const obj of scene.objects) {
      if (!foundIds.has(obj.id)) {
        if (obj.lockedByPuzzle && !puzzleSolved) {
          this.drawLockedCase(ctx, obj, timeSec);
        } else {
          this.drawHiddenSprite(ctx, obj, timeSec);
        }
      }
    }

    // Exterior Thunder Light Wash entering dark rooms
    if (this.roomThunderAlpha > 0.03) {
      ctx.fillStyle = `rgba(186, 230, 253, ${(this.roomThunderAlpha * 0.34).toFixed(3)})`;
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    }

    // Atmospheric Darkness + Flashlight Cone (or Random Flashlight Failure)
    if (flashlightDead) {
      ctx.fillStyle = 'rgba(2, 4, 9, 0.96)';
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
      if (cursor) {
        ctx.fillStyle = 'rgba(251, 191, 36, 0.04)';
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 11, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (cursor) {
      const sputter = flashlightFlicker && Math.sin(timeSec * 42) > 0.15;
      const radius = sputter ? 22 : wideLantern ? 62 : 38;
      const grad = ctx.createRadialGradient(
        cursor.x,
        cursor.y,
        radius * 0.14,
        cursor.x,
        cursor.y,
        radius
      );
      grad.addColorStop(0, sputter ? 'rgba(255, 235, 190, 0.02)' : 'rgba(255, 244, 214, 0.06)');
      grad.addColorStop(0.5, sputter ? 'rgba(4, 7, 14, 0.72)' : 'rgba(5, 8, 16, 0.56)');
      grad.addColorStop(
        1,
        sputter
          ? 'rgba(2, 4, 9, 0.95)'
          : wideLantern
          ? 'rgba(4, 6, 12, 0.84)'
          : 'rgba(3, 5, 10, 0.92)'
      );
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    } else {
      ctx.fillStyle = 'rgba(4, 6, 12, 0.88)';
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    }

    // Multi-tier Hint Overlay (wider Tier 1 radius so clues stay challenging)
    if (hintTarget && !foundIds.has(hintTarget.obj.id)) {
      const { obj, tier } = hintTarget;
      const cx = obj.x + obj.w / 2;
      const cy = obj.y + obj.h / 2;
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 6);
      ctx.strokeStyle = `rgba(251, 191, 36, ${(0.5 + pulse * 0.45).toFixed(2)})`;
      ctx.lineWidth = 1;
      if (tier === 1) {
        ctx.beginPath();
        ctx.arc(cx, cy, 40 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(obj.x - 3, obj.y - 3, obj.w + 6, obj.h + 6);
      }
    }

    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2);
    }

    for (const r of this.missRipples) {
      ctx.strokeStyle = `rgba(148, 163, 184, ${(r.life * 2).toFixed(2)})`;
      ctx.lineWidth = 1;
      const rad = (0.35 - r.life) * 26;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawDispatchRoom(ctx: CanvasRenderingContext2D, timeSec: number) {
    // Wallpaper with subtle vertical stripes + chair rail + wood wainscot
    ctx.fillStyle = '#18202c';
    ctx.fillRect(0, 0, SCENE_W, 88);
    ctx.fillStyle = '#1c2533';
    for (let wx = 0; wx < SCENE_W; wx += 8) {
      ctx.fillRect(wx, 0, 2, 88);
    }
    ctx.fillStyle = '#3b2b20';
    ctx.fillRect(0, 86, SCENE_W, 3);
    ctx.fillStyle = '#291e17';
    ctx.fillRect(0, 89, SCENE_W, 29);
    ctx.fillStyle = '#201712';
    for (let px = 6; px < SCENE_W; px += 14) {
      ctx.fillRect(px, 92, 10, 22);
    }

    // Hardwood floor planks + baseboard + woven rug
    ctx.fillStyle = '#1c1510';
    ctx.fillRect(0, 118, SCENE_W, 62);
    ctx.fillStyle = '#281d16';
    for (let y = 122; y < SCENE_H; y += 8) {
      ctx.fillRect(0, y, SCENE_W, 1);
      for (let x = (y % 16) * 2; x < SCENE_W; x += 38) {
        ctx.fillRect(x, y, 1, 8);
      }
    }
    // Under-desk Persian runner rug
    ctx.fillStyle = '#3f1d20';
    ctx.fillRect(74, 134, 164, 34);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(78, 137, 156, 28);
    ctx.fillStyle = '#4c1d24';
    ctx.fillRect(82, 140, 148, 22);

    // Rainy Window with exterior pine silhouette, sill & thunder lights
    ctx.fillStyle = this.roomThunderAlpha > 0.15 ? '#385880' : '#09101a';
    ctx.fillRect(24, 16, 58, 50);
    ctx.fillStyle = '#0d1924';
    ctx.fillRect(26, 46, 54, 18);
    ctx.fillStyle = '#3b2c22';
    ctx.fillRect(22, 14, 62, 3);
    ctx.fillRect(22, 65, 62, 4);
    ctx.fillRect(22, 14, 3, 52);
    ctx.fillRect(81, 14, 3, 52);
    ctx.fillRect(52, 16, 2, 50);
    ctx.fillRect(24, 40, 58, 2);
    ctx.fillStyle = '#60a5fa';
    for (let i = 0; i < 10; i++) {
      const rx = 27 + ((i * 7 + Math.floor(timeSec * 20)) % 52);
      const ry = 18 + ((i * 11 + Math.floor(timeSec * 36)) % 44);
      ctx.fillRect(rx, ry, 1, 4);
    }
    // Stacked books & coat rack clutter near left wall
    ctx.fillStyle = '#451a03';
    ctx.fillRect(10, 62, 4, 62);
    ctx.fillRect(6, 122, 12, 3);
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(26, 114, 14, 4);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(28, 110, 11, 4);

    // Wall Clock above desk
    ctx.fillStyle = '#334155';
    ctx.fillRect(114, 22, 20, 20);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(117, 25, 14, 14);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(123, 27, 1, 5);
    ctx.fillRect(124, 31, 4, 1);

    // Cork Bulletin Board with pinned memos & red string
    ctx.fillStyle = '#3b2818';
    ctx.fillRect(164, 18, 96, 58);
    ctx.fillStyle = '#6b4b2e';
    ctx.fillRect(167, 21, 90, 52);
    ctx.fillStyle = '#7c5837';
    ctx.fillRect(169, 23, 86, 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(174, 27, 16, 20);
    ctx.fillRect(228, 29, 22, 16);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(181, 28, 2, 2);
    ctx.fillRect(238, 30, 2, 2);

    // Steel Filing Cabinet (right) with shadow & label slots
    ctx.fillStyle = '#1e2733';
    ctx.fillRect(268, 56, 38, 70);
    ctx.fillStyle = '#334155';
    ctx.fillRect(269, 57, 36, 2);
    for (let dy = 63; dy < 118; dy += 15) {
      ctx.fillStyle = '#283344';
      ctx.fillRect(272, dy, 30, 12);
      ctx.fillStyle = '#475569';
      ctx.fillRect(272, dy, 30, 1);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(282, dy + 5, 10, 2);
    }

    // Oak Dispatch Desk + Drawers + Knee Space + Chair
    ctx.fillStyle = '#3b261b';
    ctx.fillRect(88, 96, 134, 42);
    ctx.fillStyle = '#5c3c2b';
    ctx.fillRect(84, 91, 142, 7);
    ctx.fillStyle = '#714b36';
    ctx.fillRect(84, 91, 142, 2);
    // Desk drawers
    ctx.fillStyle = '#2d1c13';
    ctx.fillRect(92, 101, 34, 34);
    ctx.fillRect(184, 101, 34, 34);
    ctx.fillStyle = '#a16207';
    ctx.fillRect(106, 108, 6, 2);
    ctx.fillRect(106, 122, 6, 2);
    ctx.fillRect(198, 108, 6, 2);
    ctx.fillRect(198, 122, 6, 2);
    // Under-desk shadow
    ctx.fillStyle = '#140f0c';
    ctx.fillRect(129, 101, 52, 37);

    // Banker's Desk Lamp + Coffee Mug
    ctx.fillStyle = '#92400e';
    ctx.fillRect(112, 88, 8, 3);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(115, 78, 2, 10);
    ctx.fillStyle = '#047857';
    ctx.fillRect(109, 73, 14, 6);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(111, 74, 10, 2);
    if (Math.sin(timeSec * 12) > -0.85) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.16)';
      ctx.fillRect(96, 79, 44, 24);
    }
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(136, 86, 5, 5);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(137, 86, 3, 1);

    // CRT Radio Monitor with green waveform + desk folders & rotary dial
    ctx.fillStyle = '#475569';
    ctx.fillRect(173, 66, 30, 25);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(175, 68, 26, 20);
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(177, 70, 22, 15);
    ctx.fillStyle = '#34d399';
    const waveX = 179 + (Math.floor(timeSec * 18) % 16);
    ctx.fillRect(178, 77, 20, 1);
    ctx.fillRect(waveX, 74, 2, 6);
    // Cluttered desk folders & wastebasket
    ctx.fillStyle = '#92400e';
    ctx.fillRect(148, 86, 16, 5);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(150, 84, 11, 3);
    ctx.fillStyle = '#334155';
    ctx.fillRect(242, 126, 14, 16);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(244, 128, 10, 12);
  }

  private drawPantryRoom(ctx: CanvasRenderingContext2D, timeSec: number) {
    // Timber planks back wall
    ctx.fillStyle = '#1e1b22';
    ctx.fillRect(0, 0, SCENE_W, 122);
    ctx.fillStyle = '#27232c';
    for (let px = 0; px < SCENE_W; px += 18) {
      ctx.fillRect(px, 0, 1, 122);
    }
    ctx.fillStyle = '#161419';
    ctx.fillRect(0, 122, SCENE_W, 58);
    ctx.fillStyle = '#221f26';
    for (let y = 128; y < SCENE_H; y += 10) {
      ctx.fillRect(0, y, SCENE_W, 1);
    }

    // Hanging overhead bulb
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(159, 0, 2, 16);
    ctx.fillStyle = Math.sin(timeSec * 9) > -0.9 ? '#fef08a' : '#78350f';
    ctx.fillRect(157, 16, 6, 5);

    // Detailed Wooden Shelving Unit (left) with ambient jars/cans
    ctx.fillStyle = '#3d281a';
    ctx.fillRect(20, 22, 98, 100);
    for (let sy = 44; sy <= 104; sy += 20) {
      ctx.fillStyle = '#17110d';
      ctx.fillRect(24, sy - 17, 90, 17);
      ctx.fillStyle = '#63432d';
      ctx.fillRect(20, sy, 98, 3);
      ctx.fillStyle = '#7c5539';
      ctx.fillRect(20, sy, 98, 1);
      // Background jars & boxes
      ctx.fillStyle = '#475569';
      ctx.fillRect(28, sy - 10, 6, 10);
      ctx.fillRect(36, sy - 9, 5, 9);
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(62, sy - 11, 10, 11);
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(92, sy - 12, 14, 12);
    }

    // Hardware Pegboard Wall (right) with hanging wrench & coil
    ctx.fillStyle = '#2a1f17';
    ctx.fillRect(216, 20, 88, 72);
    ctx.fillStyle = '#4a3525';
    ctx.fillRect(218, 22, 84, 68);
    ctx.fillStyle = '#241a13';
    for (let px = 224; px < 298; px += 6) {
      for (let py = 28; py < 86; py += 6) {
        ctx.fillRect(px, py, 1, 1);
      }
    }
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(230, 30, 3, 18);
    ctx.fillRect(228, 30, 7, 3);

    // Store Counter + Cash Register Silhouette
    ctx.fillStyle = '#4b3323';
    ctx.fillRect(114, 88, 98, 42);
    ctx.fillStyle = '#6e4c36';
    ctx.fillRect(110, 84, 106, 6);
    ctx.fillStyle = '#855d42';
    ctx.fillRect(110, 84, 106, 2);
    ctx.fillStyle = '#334155';
    ctx.fillRect(142, 68, 22, 16);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(145, 71, 16, 6);

    // Detailed Wooden Crates with diagonal bracing + extra barrels/boxes to camouflage clues
    this.drawPixelCrate(ctx, 34, 130, 36, 28);
    this.drawPixelCrate(ctx, 236, 124, 42, 32);
    this.drawPixelCrate(ctx, 184, 132, 26, 22);
    ctx.fillStyle = '#3f2e21';
    ctx.fillRect(88, 128, 18, 22);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(88, 132, 18, 2);
    ctx.fillRect(88, 144, 18, 2);
  }

  private drawPixelCrate(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    ctx.fillStyle = '#4a311e';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#68462c';
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x, y + h - 3, w, 3);
    ctx.fillRect(x, y, 3, h);
    ctx.fillRect(x + w - 3, y, 3, h);
    ctx.fillStyle = '#362315';
    ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    ctx.fillStyle = '#5c3d25';
    for (let i = 4; i < w - 5; i++) {
      const py = y + Math.floor(((i - 3) / (w - 6)) * (h - 6));
      ctx.fillRect(x + i, py, 2, 2);
    }
  }

  private drawVestibuleRoom(ctx: CanvasRenderingContext2D, timeSec: number) {
    // Marble lobby walls with paneled molding
    ctx.fillStyle = '#161e2b';
    ctx.fillRect(0, 0, SCENE_W, 84);
    ctx.fillStyle = '#243044';
    ctx.fillRect(0, 84, SCENE_W, 40);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 82, SCENE_W, 3);
    ctx.fillRect(0, 121, SCENE_W, 3);

    // Checkered marble floor with subtle specular tiles
    for (let fy = 124; fy < SCENE_H; fy += 12) {
      for (let fx = 0; fx < SCENE_W; fx += 16) {
        const even = (fx / 16 + fy / 12) % 2 === 0;
        ctx.fillStyle = even ? '#131a25' : '#1d2738';
        ctx.fillRect(fx, fy, 16, 12);
        if (!even) {
          ctx.fillStyle = '#263348';
          ctx.fillRect(fx + 2, fy + 2, 4, 2);
        }
      }
    }

    // Recessed ATM Alcove (left)
    ctx.fillStyle = '#0c121c';
    ctx.fillRect(34, 28, 66, 78);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(34, 28, 66, 78);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(42, 34, 50, 62);
    ctx.fillStyle = Math.sin(timeSec * 3) > 0 ? '#1d4ed8' : '#1e3a8a';
    ctx.fillRect(49, 43, 36, 22);
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(53, 47, 18, 2);
    ctx.fillRect(53, 52, 24, 2);
    // Keypad & card slot
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(50, 70, 14, 10);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(72, 72, 10, 4);

    // Teller Counter + Brass Bars + Glass Partition
    ctx.fillStyle = '#2b3648';
    ctx.fillRect(130, 64, 154, 54);
    ctx.fillStyle = '#475569';
    ctx.fillRect(128, 62, 158, 5);
    ctx.fillStyle = '#141c28';
    ctx.fillRect(134, 28, 146, 34);
    ctx.fillStyle = '#a16207';
    ctx.fillRect(134, 28, 146, 2);
    for (let bx = 144; bx < 274; bx += 14) {
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(bx, 30, 2, 32);
    }

    // Potted Lobby Fern & Brass Trash Receptacle
    ctx.fillStyle = '#334155';
    ctx.fillRect(184, 120, 24, 28);
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(184, 120, 24, 3);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(292, 106, 16, 16);
    ctx.fillStyle = '#14532d';
    ctx.fillRect(288, 92, 24, 14);
    ctx.fillStyle = '#166534';
    ctx.fillRect(291, 88, 18, 8);
  }

  private drawRelayRoom(ctx: CanvasRenderingContext2D, timeSec: number) {
    // Concrete block walls & dark epoxy floor
    ctx.fillStyle = '#131922';
    ctx.fillRect(0, 0, SCENE_W, 122);
    ctx.fillStyle = '#18202c';
    for (let cy = 12; cy < 122; cy += 12) {
      ctx.fillRect(0, cy, SCENE_W, 1);
    }
    ctx.fillStyle = '#0e141c';
    ctx.fillRect(0, 122, SCENE_W, 58);
    // Yellow safety floor stripe
    ctx.fillStyle = '#854d0e';
    ctx.fillRect(20, 126, 280, 2);

    // Overhead conduit pipes & junction boxes
    ctx.fillStyle = '#2d3a4d';
    ctx.fillRect(0, 14, SCENE_W, 6);
    ctx.fillStyle = '#475569';
    ctx.fillRect(0, 14, SCENE_W, 2);
    ctx.fillStyle = '#253142';
    ctx.fillRect(0, 25, SCENE_W, 4);
    ctx.fillStyle = '#334155';
    ctx.fillRect(96, 11, 14, 12);
    ctx.fillRect(216, 11, 14, 12);

    // Server / EAS Broadcast Rack (left)
    ctx.fillStyle = '#1a222d';
    ctx.fillRect(26, 34, 66, 94);
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 34, 66, 94);
    for (let ry = 44; ry < 118; ry += 12) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(32, ry, 54, 9);
      ctx.fillStyle = '#334155';
      ctx.fillRect(58, ry + 3, 24, 3);
      ctx.fillStyle = Math.sin(timeSec * 5 + ry) > 0 ? '#10b981' : '#f59e0b';
      ctx.fillRect(35, ry + 3, 3, 3);
      ctx.fillStyle = Math.cos(timeSec * 7 + ry) > 0 ? '#38bdf8' : '#1e3a8a';
      ctx.fillRect(41, ry + 3, 3, 3);
    }

    // Steel Workbench & Oscilloscope
    ctx.fillStyle = '#293548';
    ctx.fillRect(114, 92, 102, 36);
    ctx.fillStyle = '#475569';
    ctx.fillRect(110, 88, 110, 5);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(110, 88, 110, 1);

    // High-Voltage Switchgear Cabinet (right) with gauges & louvers + floor cable clutter
    ctx.fillStyle = '#232e3d';
    ctx.fillRect(236, 32, 62, 96);
    ctx.fillStyle = '#334155';
    ctx.fillRect(238, 34, 58, 92);
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(246, 38, 42, 8);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(256, 40, 22, 4);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(246, 52, 16, 14);
    ctx.fillRect(272, 52, 16, 14);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(248, 54, 12, 10);
    ctx.fillRect(274, 54, 12, 10);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(253, 55, 2, 6);
    ctx.fillRect(280, 56, 2, 5);
    // Floor cable coils & toolbox clutter
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(114, 140, 22, 12);
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(184, 136, 24, 14);
    ctx.fillStyle = '#475569';
    ctx.fillRect(190, 133, 12, 3);
  }

  private drawHiddenSprite(ctx: CanvasRenderingContext2D, obj: HiddenObjectDef, timeSec: number) {
    const { x, y, w, h, spriteType } = obj;
    const cx = Math.floor(x + w / 2);
    const cy = Math.floor(y + h / 2);

    switch (spriteType) {
      case 'x_post':
      case 'fema_memo':
      case 'hoarder_list':
      case 'fcc_log':
      case 'dec3_memo': {
        const paperCol =
          spriteType === 'fema_memo'
            ? '#cbd5e1'
            : spriteType === 'fcc_log'
            ? '#fef3c7'
            : '#e2e8f0';
        // Dark 1px outline + folded corner + colored seal
        ctx.fillStyle = '#090d14';
        ctx.fillRect(x + 1, y, w - 2, h);
        ctx.fillStyle = paperCol;
        ctx.fillRect(x + 2, y + 1, w - 4, h - 2);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + w - 5, y + 1, 3, 3); // Dog-ear
        ctx.fillStyle = spriteType === 'x_post' ? '#b91c1c' : '#1d4ed8';
        ctx.fillRect(x + 4, y + 3, w - 10, 3);
        ctx.fillStyle = '#475569';
        ctx.fillRect(x + 4, y + 8, w - 9, 2);
        ctx.fillRect(x + 4, y + 12, w - 11, 2);
        break;
      }

      case 'sticky_note':
      case 'tv_clip_note': {
        ctx.fillStyle = '#090d14';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = spriteType === 'sticky_note' ? '#facc15' : '#fde047';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = '#eab308';
        ctx.fillRect(x + 2, y + h - 4, w - 4, 2);
        ctx.fillStyle = '#854d0e';
        ctx.fillRect(x + 4, y + 5, w - 8, 2);
        ctx.fillRect(x + 4, y + 9, w - 10, 2);
        break;
      }

      case 'telegram_phone':
      case 'burner_phone': {
        ctx.fillStyle = '#020617';
        ctx.fillRect(x + 2, y + 1, w - 4, h - 2);
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + 3, y + 2, w - 6, h - 4);
        ctx.fillStyle = spriteType === 'telegram_phone' ? '#0284c7' : '#b91c1c';
        ctx.fillRect(x + 4, y + 4, w - 8, h - 9);
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(x + 5, y + 6, w - 10, 2);
        ctx.fillRect(x + 5, y + 10, w - 12, 2);
        break;
      }

      case 'walkie': {
        ctx.fillStyle = '#020617';
        ctx.fillRect(x + 3, y + 5, w - 6, h - 6);
        ctx.fillRect(x + 5, y, 2, 6);
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + 4, y + 6, w - 8, h - 8);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(x + 6, y + 8, w - 12, 4);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x + 6, y + 13, w - 12, 3);
        ctx.fillStyle = Math.sin(timeSec * 4) > 0 ? '#10b981' : '#065f46';
        ctx.fillRect(x + 6, y + 17, 2, 2);
        break;
      }

      case 'gen_key': {
        ctx.fillStyle = '#090d14';
        ctx.fillRect(x + 1, y + 3, 16, 9);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x + 2, y + 4, 6, 6);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(x + 4, y + 6, 2, 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(x + 8, y + 6, 8, 2);
        ctx.fillRect(x + 12, y + 8, 2, 3);
        ctx.fillRect(x + 15, y + 8, 2, 2);
        break;
      }

      case 'water_jug': {
        ctx.fillStyle = '#082f49';
        ctx.fillRect(x + 2, y + 5, w - 4, h - 6);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(x + 3, y + 6, w - 6, h - 8);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(x + 5, y + 8, w - 11, h - 14);
        ctx.fillStyle = '#bae6fd';
        ctx.fillRect(x + 6, y + 9, 2, 6);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(x + 7, y + 2, 6, 4);
        break;
      }

      case 'ration_tin': {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(x + 1, y + 2, w - 2, h - 3);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(x + 2, y + 3, w - 4, h - 5);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(x + 4, y + 7, w - 8, 5);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(x + 6, y + 8, w - 12, 2);
        break;
      }

      case 'crank_torch': {
        ctx.fillStyle = '#450a0a';
        ctx.fillRect(x + 1, y + 4, 19, 9);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(x + 2, y + 5, 13, 7);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(x + 15, y + 4, 4, 9);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(x + 6, y + 2, 5, 3);
        break;
      }

      case 'storm_map':
      case 'radar_print': {
        ctx.fillStyle = '#020617';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(x + 5, y + 6, 7, 5);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x + 11, y + 7, 6, 5);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(x + 8, y + 10, 4, 3);
        break;
      }

      case 'spare_fuse': {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x + 3, y + 1, 10, h - 2);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x + 5, y + 4, 6, h - 8);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(x + 4, y + 2, 8, 3);
        ctx.fillRect(x + 4, y + h - 5, 8, 3);
        break;
      }

      case 'atm_slip': {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x + 3, y + 1, w - 6, h - 2);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x + 4, y + 2, w - 8, h - 4);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x + 6, y + 5, w - 12, 2);
        ctx.fillRect(x + 6, y + 9, w - 12, 2);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x + 6, y + 12, w - 14, 2);
        break;
      }

      case 'bank_ledger': {
        ctx.fillStyle = '#052e16';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = '#15803d';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x + 5, y + 4, w - 10, h - 8);
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + 7, y + 7, w - 14, 2);
        ctx.fillRect(x + 7, y + 11, w - 14, 2);
        break;
      }

      case 'fiber_cable':
      case 'copper_strap': {
        ctx.fillStyle = '#020617';
        ctx.fillRect(x, cy - 4, w, 9);
        ctx.fillStyle = spriteType === 'fiber_cable' ? '#38bdf8' : '#d97706';
        ctx.fillRect(x + 2, cy - 2, w - 4, 3);
        ctx.fillRect(x + 6, cy + 1, w - 12, 3);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(x + 1, cy - 3, 3, 5);
        ctx.fillRect(x + w - 4, cy - 3, 3, 5);
        break;
      }

      case 'pry_bar': {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x + 1, cy - 4, w - 2, 8);
        ctx.fillStyle = '#991b1b';
        ctx.fillRect(x + 2, cy - 1, w - 6, 3);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(x + w - 6, cy - 3, 4, 5);
        break;
      }

      case 'cash_roll': {
        ctx.fillStyle = '#052e16';
        ctx.fillRect(x + 2, y + 3, w - 4, h - 6);
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(x + 3, y + 4, w - 6, h - 8);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(cx - 2, y + 4, 4, h - 8);
        break;
      }

      case 'breaker_lever': {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x + 3, y + 1, w - 6, h - 2);
        ctx.fillStyle = '#475569';
        ctx.fillRect(x + 4, y + 2, w - 8, h - 4);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(x + 6, y + 12, w - 10, 5);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x + 11, y + 12, 4, 5);
        break;
      }
    }
  }

  private drawLockedCase(ctx: CanvasRenderingContext2D, obj: HiddenObjectDef, timeSec: number) {
    const { x, y, w, h } = obj;
    const cx = Math.floor(x + w / 2);
    const cy = Math.floor(y + h / 2);
    // Steel lockbox casing
    ctx.fillStyle = '#090d14';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = '#334155';
    ctx.fillRect(x + 2, y + 2, w - 4, 2);
    // Amber padlock icon
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(cx - 2, cy - 4, 5, 3);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx - 1, cy - 3, 3, 2);
    ctx.fillStyle = Math.sin(timeSec * 4) > 0 ? '#f59e0b' : '#b45309';
    ctx.fillRect(cx - 3, cy - 1, 7, 5);
  }
}
