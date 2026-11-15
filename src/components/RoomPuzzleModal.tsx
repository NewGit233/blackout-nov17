import React, { useState } from 'react';
import { Lock, RotateCcw, Unlock, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { DistrictId } from '../types/game';

interface RoomPuzzleModalProps {
  districtId: DistrictId;
  title: string;
  prompt: string;
  onSolved: () => void;
  onMistake: () => void;
  onClose: () => void;
}

export const RoomPuzzleModal: React.FC<RoomPuzzleModalProps> = ({
  districtId,
  title,
  prompt,
  onSolved,
  onMistake,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/88 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0c121d] border border-amber-500/50 rounded-md p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-amber-300">
            <Lock className="w-4 h-4 shrink-0" />
            <h3 className="font-display text-base font-bold">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded cursor-pointer"
            aria-label="Close Puzzle"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-4">{prompt}</p>

        {districtId === 'town_hall' && (
          <PinCodePuzzle
            target="1420"
            clueHint="2:20 PM in 24-hour clock format (HHMM)."
            onSolved={onSolved}
            onMistake={onMistake}
          />
        )}

        {districtId === 'general_store' && (
          <BreakerMatrixPuzzle onSolved={onSolved} />
        )}

        {districtId === 'bank' && (
          <PinCodePuzzle
            target="1117"
            clueHint="Month & Day of Tuesday’s rumored blackout (MMDD)."
            onSolved={onSolved}
            onMistake={onMistake}
          />
        )}

        {districtId === 'substation' && (
          <PhaseSequencePuzzle onSolved={onSolved} onMistake={onMistake} />
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 1 & 3: 4-Digit Codebreaker with Mastermind-style digit feedback
// ---------------------------------------------------------------------------
const PinCodePuzzle: React.FC<{
  target: string;
  clueHint: string;
  onSolved: () => void;
  onMistake: () => void;
}> = ({ target, clueHint, onSolved, onMistake }) => {
  const [digits, setDigits] = useState<[number, number, number, number]>([0, 0, 0, 0]);
  const [history, setHistory] = useState<{ guess: string; marks: ('exact' | 'near' | 'miss')[] }[]>(
    []
  );

  const cycle = (idx: number, delta: number) => {
    soundEngine.playClick();
    setDigits((prev) => {
      const copy = [...prev] as [number, number, number, number];
      copy[idx] = (copy[idx] + delta + 10) % 10;
      return copy;
    });
  };

  const submit = () => {
    const guess = digits.join('');
    if (guess === target) {
      soundEngine.playPuzzleSolved();
      onSolved();
      return;
    }

    soundEngine.playLockedBuzz();
    soundEngine.playScaryCreak();
    onMistake();

    const marks = digits.map((d, i) => {
      const ch = String(d);
      if (target[i] === ch) return 'exact';
      if (target.includes(ch)) return 'near';
      return 'miss';
    });
    setHistory((prev) => [{ guess, marks }, ...prev.slice(0, 4)]);
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-mono-tabular text-sky-300 bg-sky-950/30 border border-sky-500/30 rounded px-3 py-2">
        Note: {clueHint}
      </p>

      <div className="grid grid-cols-4 gap-2.5">
        {digits.map((val, i) => (
          <div key={i} className="flex flex-col items-center bg-[#070b12] border border-slate-700 rounded p-2">
            <button
              onClick={() => cycle(i, 1)}
              className="w-full py-1 text-xs text-slate-300 hover:bg-slate-800 rounded cursor-pointer"
            >
              ▲
            </button>
            <span className="font-mono-tabular text-2xl font-bold text-amber-200 my-1">
              {val}
            </span>
            <button
              onClick={() => cycle(i, -1)}
              className="w-full py-1 text-xs text-slate-300 hover:bg-slate-800 rounded cursor-pointer"
            >
              ▼
            </button>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div className="space-y-1.5 bg-[#070b12] border border-slate-800 rounded p-2.5">
          {history.map((h, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs font-mono-tabular">
              <span className="text-slate-300">{h.guess}</span>
              <div className="flex items-center gap-1.5">
                {h.marks.map((m, mi) => (
                  <span
                    key={mi}
                    className={`px-1.5 py-0.5 text-[10px] rounded ${
                      m === 'exact'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : m === 'near'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {m === 'exact' ? '✓' : m === 'near' ? '~' : '×'}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={submit}
        className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded transition-colors cursor-pointer"
      >
        <Unlock className="w-4 h-4" />
        Test Combination
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2: 3x3 Breaker Matrix (Lights-Out Circuit Puzzle)
// ---------------------------------------------------------------------------
const INITIAL_MATRIX = [
  false, true, false,
  true, false, true,
  false, true, false,
]; // Toggling center (4) + corners solves cleanly! Wait: toggling center (4) makes all 9 true in 1 move? Let's test:
// Actually toggling (0), (4), (8) from all-true gives a fun 3-move puzzle!
function buildScrambledMatrix(): boolean[] {
  const g = Array(9).fill(true) as boolean[];
  const toggleAt = (arr: boolean[], idx: number) => {
    const r = Math.floor(idx / 3);
    const c = idx % 3;
    const coords = [
      [r, c],
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ];
    coords.forEach(([nr, nc]) => {
      if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
        arr[nr * 3 + nc] = !arr[nr * 3 + nc];
      }
    });
  };
  [0, 5, 6].forEach((m) => toggleAt(g, m));
  return g;
}

const BreakerMatrixPuzzle: React.FC<{ onSolved: () => void }> = ({ onSolved }) => {
  const [grid, setGrid] = useState<boolean[]>(() => buildScrambledMatrix());

  const handleToggle = (idx: number) => {
    soundEngine.playBreaker(true);
    setGrid((prev) => {
      const next = [...prev];
      const r = Math.floor(idx / 3);
      const c = idx % 3;
      [
        [r, c],
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ].forEach(([nr, nc]) => {
        if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
          next[nr * 3 + nc] = !next[nr * 3 + nc];
        }
      });

      if (next.every(Boolean)) {
        setTimeout(() => {
          soundEngine.playPuzzleSolved();
          onSolved();
        }, 180);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5 max-w-[220px] mx-auto">
        {grid.map((on, idx) => (
          <button
            key={idx}
            onClick={() => handleToggle(idx)}
            className={`h-14 rounded border font-mono-tabular text-xs font-bold transition-colors cursor-pointer ${
              on
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
            }`}
          >
            {on ? 'ON' : 'OFF'}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Each switch flips itself and adjacent breakers.</span>
        <button
          onClick={() => {
            soundEngine.playClick();
            setGrid(buildScrambledMatrix());
          }}
          className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4: Substation Phase Sequence Puzzle
// ---------------------------------------------------------------------------
const RELAY_NODES = [
  { id: 'ground', label: 'A · Copper Ground' },
  { id: 'repeater', label: 'B · EAS Repeater' },
  { id: 'filter', label: 'C · Surge Filter' },
  { id: 'main', label: 'D · Main Transformer' },
];
const TARGET_ORDER = ['ground', 'filter', 'repeater', 'main'];

const PhaseSequencePuzzle: React.FC<{
  onSolved: () => void;
  onMistake: () => void;
}> = ({ onSolved, onMistake }) => {
  const [picked, setPicked] = useState<string[]>([]);

  const handlePick = (id: string) => {
    if (picked.includes(id)) return;
    const next = [...picked, id];
    const stepIdx = next.length - 1;

    if (TARGET_ORDER[stepIdx] !== id) {
      soundEngine.playLockedBuzz();
      soundEngine.playScaryCreak();
      onMistake();
      setPicked([]);
      return;
    }

    soundEngine.playBreaker(true);
    setPicked(next);

    if (next.length === TARGET_ORDER.length) {
      setTimeout(() => {
        soundEngine.playPuzzleSolved();
        onSolved();
      }, 180);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-sky-200 bg-sky-950/30 border border-sky-500/30 rounded p-3 space-y-1">
        <p>1. Bond Copper Ground first to prevent lightning arc.</p>
        <p>2. Engage Surge Filter before powering the EAS Repeater.</p>
        <p>3. Throw Main Transformer last.</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {RELAY_NODES.map((node) => {
          const orderNum = picked.indexOf(node.id);
          const active = orderNum !== -1;
          return (
            <button
              key={node.id}
              onClick={() => handlePick(node.id)}
              className={`px-3 py-3 rounded border text-xs font-medium text-left transition-colors cursor-pointer flex items-center justify-between ${
                active
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <span>{node.label}</span>
              {active && <span className="font-mono-tabular font-bold">#{orderNum + 1}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Keep INITIAL_MATRIX referenced only if needed; clean export above
void INITIAL_MATRIX;
