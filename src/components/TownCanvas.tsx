import React, { useEffect, useRef } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { TOWN_H, TOWN_W, TownRenderer } from '../canvas/pixelTownRenderer';
import { DistrictId, DistrictState } from '../types/game';

interface TownCanvasProps {
  day: number;
  weatherStatus: string;
  paused: boolean;
  districts: Record<DistrictId, DistrictState>;
  selectedId: DistrictId | null;
  broadcastPending: boolean;
  clueProgress?: Record<DistrictId, { found: number; total: number }>;
  onSelectDistrict: (id: DistrictId) => void;
  onInteractDistrict: (id: DistrictId) => void;
  burstSignal: { id: DistrictId; color: string; seq: number } | null;
}

export const TownCanvas: React.FC<TownCanvasProps> = ({
  day,
  weatherStatus,
  paused,
  districts,
  selectedId,
  broadcastPending,
  clueProgress,
  onSelectDistrict,
  onInteractDistrict,
  burstSignal,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<TownRenderer | null>(null);
  const hoveredRef = useRef<DistrictId | null>(null);
  const heldRef = useRef({ up: false, down: false, left: false, right: false });
  const lastNearbyRef = useRef<DistrictId | null>(null);

  const stateRef = useRef({
    day,
    weatherStatus,
    paused,
    districts,
    selectedId,
    broadcastPending,
    clueProgress,
    onSelectDistrict,
    onInteractDistrict,
  });
  stateRef.current = {
    day,
    weatherStatus,
    paused,
    districts,
    selectedId,
    broadcastPending,
    clueProgress,
    onSelectDistrict,
    onInteractDistrict,
  };

  useEffect(() => {
    if (!rendererRef.current) {
      rendererRef.current = new TownRenderer();
    }
    if (burstSignal && rendererRef.current) {
      const rect = districts[burstSignal.id].mapRect;
      rendererRef.current.spawnBurst(
        rect.x + rect.w / 2,
        rect.y + rect.h / 2,
        burstSignal.color,
        16
      );
    }
  }, [burstSignal, districts]);

  useEffect(() => {
    if (paused) {
      heldRef.current = { up: false, down: false, left: false, right: false };
    }
  }, [paused]);

  useEffect(() => {
    const clearKeys = () => {
      heldRef.current = { up: false, down: false, left: false, right: false };
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.paused) return;
      if (e.code === 'KeyW' || e.key === 'ArrowUp') heldRef.current.up = true;
      if (e.code === 'KeyS' || e.key === 'ArrowDown') heldRef.current.down = true;
      if (e.code === 'KeyA' || e.key === 'ArrowLeft') heldRef.current.left = true;
      if (e.code === 'KeyD' || e.key === 'ArrowRight') heldRef.current.right = true;

      if (e.code === 'KeyE' && !e.repeat) {
        const near = rendererRef.current?.getNearestDistrict(stateRef.current.districts);
        if (near) {
          stateRef.current.onInteractDistrict(near);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.key === 'ArrowUp') heldRef.current.up = false;
      if (e.code === 'KeyS' || e.key === 'ArrowDown') heldRef.current.down = false;
      if (e.code === 'KeyA' || e.key === 'ArrowLeft') heldRef.current.left = false;
      if (e.code === 'KeyD' || e.key === 'ArrowRight') heldRef.current.right = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearKeys);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!rendererRef.current) {
      rendererRef.current = new TownRenderer();
    }

    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      const {
        day: curDay,
        weatherStatus: curWeather,
        paused: isPaused,
        districts: curDistricts,
        selectedId: curSel,
        broadcastPending: curBc,
        clueProgress: curClues,
      } = stateRef.current;

      if (!isPaused) {
        elapsed += dt;
        rendererRef.current!.update(
          dt,
          curDay,
          curWeather,
          curDistricts,
          heldRef.current,
          (intensity) => {
            soundEngine.playThunder(intensity);
          }
        );

        const near = rendererRef.current!.getNearestDistrict(curDistricts);
        if (near && near !== lastNearbyRef.current && near !== curSel) {
          lastNearbyRef.current = near;
          stateRef.current.onSelectDistrict(near);
        } else if (!near) {
          lastNearbyRef.current = null;
        }
      }

      rendererRef.current!.render(
        ctx,
        elapsed,
        curDay,
        curWeather,
        curDistricts,
        curSel,
        hoveredRef.current,
        curBc,
        curClues
      );

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const toCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * TOWN_W;
    const y = ((e.clientY - rect.top) / rect.height) * TOWN_H;
    return { x, y };
  };

  const hitTestDistrict = (x: number, y: number): DistrictId | null => {
    const list = Object.values(stateRef.current.districts) as DistrictState[];
    for (const d of list) {
      const r = d.mapRect;
      if (x >= r.x - 4 && x <= r.x + r.w + 4 && y >= r.y - 10 && y <= r.y + r.h + 4) {
        return d.id;
      }
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = toCanvasCoords(e);
    if (!pt) return;
    const hit = hitTestDistrict(pt.x, pt.y);
    hoveredRef.current = hit;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hit ? 'pointer' : 'crosshair';
    }
  };

  const handleMouseLeave = () => {
    hoveredRef.current = null;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = toCanvasCoords(e);
    if (!pt) return;
    const hit = hitTestDistrict(pt.x, pt.y);
    if (hit) {
      const r = districts[hit].mapRect;
      if (rendererRef.current) {
        rendererRef.current.guard.targetX = r.x + r.w / 2;
        rendererRef.current.guard.targetY = Math.max(68, Math.min(TOWN_H - 14, r.y + r.h - 2));
      }
      onSelectDistrict(hit);
    } else if (rendererRef.current) {
      rendererRef.current.guard.targetX = Math.max(12, Math.min(TOWN_W - 14, pt.x));
      rendererRef.current.guard.targetY = Math.max(68, Math.min(TOWN_H - 14, pt.y));
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#070b12] select-none">
      <canvas
        ref={canvasRef}
        width={TOWN_W}
        height={TOWN_H}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="w-full h-full object-contain pixelated"
      />
    </div>
  );
};
