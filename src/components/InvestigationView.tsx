import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Eye, Flashlight, Lock, Search } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { InvestigationRenderer, SCENE_H, SCENE_W } from '../canvas/pixelObjectRenderer';
import { HiddenObjectDef, InvestigationSceneDef } from '../types/game';
import { RoomPuzzleModal } from './RoomPuzzleModal';

interface InvestigationViewProps {
  scene: InvestigationSceneDef;
  foundIds: Set<string>;
  puzzleSolved: boolean;
  onPuzzleSolved: () => void;
  onPenalty: (calmLoss: number, msg: string) => void;
  onFoundObject: (obj: HiddenObjectDef) => void;
  onExit: () => void;
}

export const InvestigationView: React.FC<InvestigationViewProps> = ({
  scene,
  foundIds,
  puzzleSolved,
  onPuzzleSolved,
  onPenalty,
  onFoundObject,
  onExit,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<InvestigationRenderer | null>(null);
  const cursorRef = useRef<{ x: number; y: number } | null>({ x: SCENE_W / 2, y: SCENE_H / 2 });
  const missStreakRef = useRef(0);
  const scareTimerRef = useRef(7 + Math.random() * 6);
  const flashlightOutRef = useRef(0);
  const flashlightFlickerRef = useRef(0);

  const [wideLantern, setWideLantern] = useState(false);
  const [flashlightDead, setFlashlightDead] = useState(false);
  const [scarePulse, setScarePulse] = useState(false);
  const [hintCooldown, setHintCooldown] = useState(0);
  const [hintTarget, setHintTarget] = useState<{ obj: HiddenObjectDef; tier: 1 | 2 } | null>(null);
  const [lastClue, setLastClue] = useState<HiddenObjectDef | null>(null);
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const foundCount = scene.objects.filter((o) => foundIds.has(o.id)).length;
  const allFound = foundCount === scene.objects.length;

  const stateRef = useRef({
    scene,
    foundIds,
    puzzleSolved,
    wideLantern,
    hintTarget,
    puzzleOpen,
    allFound,
  });
  stateRef.current = {
    scene,
    foundIds,
    puzzleSolved,
    wideLantern,
    hintTarget,
    puzzleOpen,
    allFound,
  };

  // Start eerie scary investigation ambience on enter, restore outdoors on exit
  useEffect(() => {
    soundEngine.startInvestigationAmbience();
    return () => {
      soundEngine.stopInvestigationAmbience();
    };
  }, []);

  // Hint cooldown timer
  useEffect(() => {
    if (hintCooldown <= 0) return;
    const t = window.setInterval(() => {
      setHintCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [hintCooldown]);

  const smackOrToggleFlashlight = () => {
    if (flashlightOutRef.current > 0) {
      flashlightOutRef.current = Math.max(0, flashlightOutRef.current - 1.4);
      soundEngine.playFlashlightFlicker();
      if (flashlightOutRef.current <= 0) {
        setFlashlightDead(false);
        setStatusBanner(null);
      }
    } else {
      setWideLantern((v) => !v);
      soundEngine.playClick();
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (puzzleOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setPuzzleOpen(false);
        }
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        smackOrToggleFlashlight();
      } else if (e.key === 'h' || e.key === 'H') {
        triggerHint();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!rendererRef.current) {
      rendererRef.current = new InvestigationRenderer();
    }

    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      elapsed += dt;

      const s = stateRef.current;

      // Update flashlight failure & flicker timers
      if (flashlightFlickerRef.current > 0) {
        flashlightFlickerRef.current = Math.max(0, flashlightFlickerRef.current - dt);
        if (flashlightFlickerRef.current <= 0 && flashlightOutRef.current <= 0) {
          flashlightOutRef.current = 2.6;
          setFlashlightDead(true);
          setStatusBanner('Flashlight failed! Press [Space] or tap Beam to smack battery!');
        }
      } else if (flashlightOutRef.current > 0) {
        flashlightOutRef.current = Math.max(0, flashlightOutRef.current - dt);
        if (flashlightOutRef.current <= 0) {
          setFlashlightDead(false);
          setStatusBanner(null);
        }
      }

      // Random horror scares: distant screams + random flashlight failures
      if (!s.puzzleOpen && !s.allFound) {
        scareTimerRef.current -= dt;
        if (scareTimerRef.current <= 0) {
          scareTimerRef.current = 9 + Math.random() * 8;
          if (Math.random() < 0.52) {
            soundEngine.playScaryScream();
            setScarePulse(true);
            window.setTimeout(() => setScarePulse(false), 650);
            setStatusBanner('A chilling scream echoes from the dark hallway...');
          } else if (flashlightOutRef.current <= 0 && flashlightFlickerRef.current <= 0) {
            soundEngine.playFlashlightFlicker();
            flashlightFlickerRef.current = 0.75;
            setStatusBanner('Your flashlight sputters dangerously...');
          }
        }
      }

      rendererRef.current!.update(dt);
      rendererRef.current!.render(
        ctx,
        s.scene,
        s.foundIds,
        s.puzzleSolved,
        cursorRef.current,
        s.wideLantern,
        flashlightOutRef.current > 0,
        flashlightFlickerRef.current > 0,
        s.hintTarget,
        elapsed
      );

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const toSceneCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * SCENE_W,
      y: ((clientY - rect.top) / rect.height) * SCENE_H,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pt = toSceneCoords(e.clientX, e.clientY);
    if (pt) cursorRef.current = pt;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (puzzleOpen) return;
    if (flashlightOutRef.current > 0) {
      soundEngine.playFlashlightFlicker();
      setStatusBanner('Too dark to see clues! Press [Space] or tap Beam to fix flashlight.');
      return;
    }

    const pt = toSceneCoords(e.clientX, e.clientY);
    if (!pt) return;

    // Tighter hitbox (pad = 1) so clues are genuinely harder to find
    const pad = 1;
    const hit = scene.objects.find(
      (obj) =>
        !foundIds.has(obj.id) &&
        pt.x >= obj.x - pad &&
        pt.x <= obj.x + obj.w + pad &&
        pt.y >= obj.y - pad &&
        pt.y <= obj.y + obj.h + pad
    );

    if (hit) {
      missStreakRef.current = 0;
      if (hit.lockedByPuzzle && !puzzleSolved) {
        soundEngine.playLockedBuzz();
        setStatusBanner(`Locked container! Solve "${scene.puzzleTitle}" to access clue.`);
        setPuzzleOpen(true);
        return;
      }

      soundEngine.playClueFound();
      rendererRef.current?.spawnFoundBurst(hit.x + hit.w / 2, hit.y + hit.h / 2);
      setStatusBanner(null);
      setLastClue(hit);
      if (hintTarget?.obj.id === hit.id) {
        setHintTarget(null);
      }
      onFoundObject(hit);
    } else {
      missStreakRef.current += 1;
      soundEngine.playMiss();
      rendererRef.current?.spawnMissRipple(pt.x, pt.y);
      if (missStreakRef.current >= 3) {
        missStreakRef.current = 0;
        soundEngine.playScaryCreak();
        onPenalty(2, 'Blind searching in the dark rattled nerves (-2 Calm).');
        setStatusBanner('Careful — blind clicking in the dark rattled nerves (-2 Calm).');
      }
    }
  };

  const triggerHint = () => {
    if (hintCooldown > 0) return;
    const remaining = scene.objects.filter(
      (o) => !foundIds.has(o.id) && (!o.lockedByPuzzle || puzzleSolved)
    );
    if (remaining.length === 0) {
      if (!puzzleSolved) {
        soundEngine.playLockedBuzz();
        setPuzzleOpen(true);
      }
      return;
    }
    soundEngine.playHint();
    setHintCooldown(8);
    if (hintTarget && !foundIds.has(hintTarget.obj.id) && hintTarget.tier === 1) {
      setHintTarget({ obj: hintTarget.obj, tier: 2 });
    } else {
      setHintTarget({ obj: remaining[0], tier: 1 });
    }
  };

  return (
    <div className="relative w-full h-full bg-[#06090f] flex flex-col overflow-hidden select-none">
      {/* Top Investigation Bar */}
      <div className="z-10 flex items-center justify-between gap-4 px-5 py-3 bg-[#0b1019]/95 border-b border-slate-800/80">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={() => {
              soundEngine.playClick();
              onExit();
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Town
          </button>
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-bold text-amber-100 truncate">
              {scene.title}
            </h2>
            <p className="text-xs text-slate-400 truncate">{scene.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-mono-tabular text-xs font-semibold text-sky-200 mr-1 hidden sm:inline">
            Clues Found: {foundCount}/{scene.objects.length}
          </span>
          {!puzzleSolved && (
            <button
              onClick={() => {
                soundEngine.playClick();
                setPuzzleOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              Crack Security Lock
            </button>
          )}
          <button
            onClick={smackOrToggleFlashlight}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              flashlightDead
                ? 'bg-red-600 hover:bg-red-500 border-red-400 text-white font-semibold'
                : wideLantern
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Flashlight className="w-3.5 h-3.5" />
            {flashlightDead ? 'Fix Flashlight (Space)' : wideLantern ? 'Wide Beam' : 'Tight Beam'}
          </button>
          <button
            onClick={triggerHint}
            disabled={allFound || hintCooldown > 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-40 text-sky-200 border border-sky-500/40 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Eye className="w-3.5 h-3.5" />
            {hintCooldown > 0 ? `Hint (${hintCooldown}s)` : 'Clue Hint'}
          </button>
        </div>
      </div>

      {/* Main Investigation Canvas Area */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center bg-[#05080e]">
        <canvas
          ref={canvasRef}
          width={SCENE_W}
          height={SCENE_H}
          onMouseMove={handleMouseMove}
          onClick={handleCanvasClick}
          className="w-full h-full object-contain pixelated cursor-crosshair"
        />

        {/* Scream Jump-Shadow Vignette Flash */}
        {scarePulse && (
          <div className="pointer-events-none absolute inset-0 bg-red-950/30 border-4 border-red-600/40" />
        )}

        {statusBanner && (
          <div className="pointer-events-none absolute top-4 left-4 bg-red-950/92 border border-red-500/60 rounded px-3.5 py-2 text-xs text-red-100 shadow-lg">
            {statusBanner}
          </div>
        )}

        {/* Atmospheric Clue Discovery Note */}
        {lastClue && (
          <div className="pointer-events-none absolute top-4 right-4 max-w-sm bg-[#0b111b]/95 border border-amber-500/40 rounded px-4 py-3 shadow-lg">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="font-display text-sm font-bold text-amber-300">
                Clue Found: {lastClue.clueTitle}
              </span>
              <span className="font-mono-tabular text-[11px] text-emerald-300">
                {Object.entries(lastClue.reward)
                  .map(([k, v]) => `+${v} ${k}`)
                  .join(' · ')}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-200">{lastClue.clueDetail}</p>
          </div>
        )}

        {allFound && (
          <div className="absolute top-4 left-4 bg-emerald-950/95 border border-emerald-500/50 rounded px-4 py-3 flex items-center gap-4 shadow-lg">
            <div>
              <p className="font-display text-sm font-bold text-emerald-200">
                All Room Clues Found
              </p>
              <p className="text-xs text-emerald-100/80">
                All 6 clues logged in your Case Dossier.
              </p>
            </div>
            <button
              onClick={() => {
                soundEngine.playClick();
                onExit();
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Back to Town
            </button>
          </div>
        )}
      </div>

      {/* Bottom Hidden Object Target List */}
      <div className="z-10 px-5 py-3 bg-[#0b1019]/95 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-sky-200 font-medium shrink-0">
          <Search className="w-3.5 h-3.5 text-amber-400" />
          <span>Clues to Find:</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 flex-1">
          {scene.objects.map((obj) => {
            const isFound = foundIds.has(obj.id);
            const isLocked = Boolean(obj.lockedByPuzzle && !puzzleSolved);
            return (
              <div
                key={obj.id}
                className={`inline-flex items-center gap-1.5 text-xs transition-opacity ${
                  isFound
                    ? 'text-emerald-400/75 line-through'
                    : isLocked
                    ? 'text-amber-300/85'
                    : 'text-slate-100 font-medium'
                }`}
              >
                {isFound ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : isLocked ? (
                  <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                ) : (
                  <span className="w-1.5 h-1.5 bg-amber-400/80 inline-block shrink-0" />
                )}
                <span>{obj.name}</span>
              </div>
            );
          })}
        </div>
        <span className="text-[11px] text-slate-500 hidden lg:inline whitespace-nowrap">
          Space Beam / Fix · H Hint · Esc Return
        </span>
      </div>

      {puzzleOpen && (
        <RoomPuzzleModal
          districtId={scene.id}
          title={scene.puzzleTitle}
          prompt={scene.puzzlePrompt}
          onSolved={() => {
            setPuzzleOpen(false);
            setStatusBanner(null);
            onPuzzleSolved();
          }}
          onMistake={() => {
            onPenalty(3, `Lock tamper alarm in ${scene.title} (-3 Calm).`);
          }}
          onClose={() => setPuzzleOpen(false)}
        />
      )}
    </div>
  );
};
