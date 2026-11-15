import React, { useState } from 'react';
import { Radio, Smartphone, Volume2, X } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { PHONE_MESSAGES } from '../data/gameContent';
import { RadioBroadcast } from '../types/game';

interface RadioPhoneModalProps {
  dayIndex: number;
  activeBroadcast: RadioBroadcast | null;
  caughtBroadcastIds: Set<string>;
  onCatchBroadcast: (bc: RadioBroadcast) => void;
  onClose: () => void;
}

const PRESET_FREQS = [
  { label: '94.5 Weather', freq: 94.5 },
  { label: '98.7 Oakhaven', freq: 98.7 },
  { label: '101.3 VHF', freq: 101.3 },
  { label: '104.1 EAS', freq: 104.1 },
];

export const RadioPhoneModal: React.FC<RadioPhoneModalProps> = ({
  dayIndex,
  activeBroadcast,
  caughtBroadcastIds,
  onCatchBroadcast,
  onClose,
}) => {
  const [tab, setTab] = useState<'radio' | 'phone'>('radio');
  const [phoneFilter, setPhoneFilter] = useState<'all' | 'rumors' | 'official'>('all');
  const [freq, setFreq] = useState<number>(98.7);
  const [justCaught, setJustCaught] = useState<RadioBroadcast | null>(null);

  const tuneTo = (nextFreq: number) => {
    const clamped = Math.round(Math.max(88.0, Math.min(108.0, nextFreq)) * 10) / 10;
    setFreq(clamped);
    soundEngine.playRadioGlitch();
  };

  const diff = activeBroadcast ? Math.abs(freq - activeBroadcast.freqMHz) : 99;
  const signalStrength = activeBroadcast
    ? Math.max(8, Math.round(Math.max(0, 1 - diff / 3.5) * 100))
    : 22;
  const isLocked = Boolean(activeBroadcast && diff <= 0.35);

  const unlockedCount = dayIndex === 0 ? 4 : dayIndex === 1 ? 8 : PHONE_MESSAGES.length;
  const shiftMessages = PHONE_MESSAGES.slice(0, unlockedCount);
  const visibleMessages =
    phoneFilter === 'rumors'
      ? shiftMessages.filter((m) => m.isRumor)
      : phoneFilter === 'official'
      ? shiftMessages.filter((m) => !m.isRumor)
      : shiftMessages;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/85 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0d1420] border border-sky-500/40 rounded-md overflow-hidden shadow-2xl">
        {/* Device Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#090e17] border-b border-slate-800">
          <div className="flex items-center gap-2 p-1 bg-slate-900 rounded">
            <button
              onClick={() => {
                soundEngine.playClick();
                setTab('radio');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'radio'
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              FM / VHF Tuner
            </button>
            <button
              onClick={() => {
                soundEngine.playClick();
                setTab('phone');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'phone'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Watch Phone ({shiftMessages.length})
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            aria-label="Close Radio and Phone"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {tab === 'radio' ? (
          <div className="p-5 space-y-4">
            {/* Frequency Readout & Signal Bar */}
            <div className="bg-[#070b12] border border-slate-800 rounded p-4">
              <div className="flex items-baseline justify-between mb-2">
                <span className="font-mono-tabular text-2xl font-bold text-sky-300">
                  {freq.toFixed(1)} MHz
                </span>
                <span
                  className={`font-mono-tabular text-xs font-semibold ${
                    isLocked
                      ? 'text-emerald-400'
                      : activeBroadcast
                      ? 'text-amber-300'
                      : 'text-slate-400'
                  }`}
                >
                  {isLocked
                    ? 'SIGNAL LOCKED'
                    : activeBroadcast
                    ? `CARRIER DETECTED · ${signalStrength}%`
                    : 'MONITORING STATIC'}
                </span>
              </div>

              <input
                type="range"
                min={88.0}
                max={108.0}
                step={0.1}
                value={freq}
                onChange={(e) => tuneTo(parseFloat(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
                aria-label="Radio Frequency Dial"
              />

              <div className="flex items-center justify-between gap-2 mt-3">
                <button
                  onClick={() => tuneTo(freq - 0.2)}
                  className="px-2.5 py-1 text-xs font-mono-tabular bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer"
                >
                  -0.2 MHz
                </button>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {PRESET_FREQS.map((p) => (
                    <button
                      key={p.freq}
                      onClick={() => tuneTo(p.freq)}
                      className={`px-2 py-1 text-[11px] font-mono-tabular rounded border transition-colors cursor-pointer whitespace-nowrap ${
                        Math.abs(freq - p.freq) < 0.15
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => tuneTo(freq + 0.2)}
                  className="px-2.5 py-1 text-xs font-mono-tabular bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer"
                >
                  +0.2 MHz
                </button>
              </div>
            </div>

            {/* Active Incoming Broadcast Status */}
            {activeBroadcast ? (
              <div
                className={`border rounded p-4 ${
                  isLocked
                    ? 'bg-emerald-950/35 border-emerald-500/50'
                    : 'bg-amber-950/25 border-amber-500/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-display text-sm font-bold text-amber-200">
                    Incoming Transmission: {activeBroadcast.stationName}
                  </span>
                  <span className="font-mono-tabular text-xs text-sky-300">
                    Band ~{Math.floor(activeBroadcast.freqMHz)} MHz
                  </span>
                </div>
                {isLocked ? (
                  <div className="space-y-3 mt-2">
                    <p className="text-xs leading-relaxed text-slate-200">
                      "{activeBroadcast.transcript}"
                    </p>
                    <button
                      onClick={() => {
                        soundEngine.playActionSuccess();
                        setJustCaught(activeBroadcast);
                        onCatchBroadcast(activeBroadcast);
                      }}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded transition-colors cursor-pointer"
                    >
                      Catch Broadcast ({activeBroadcast.rewardText})
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-300 mt-1">
                    Sweep the frequency dial near{' '}
                    <span className="font-mono-tabular text-amber-200">
                      {activeBroadcast.freqMHz.toFixed(1)} MHz
                    </span>{' '}
                    to clear storm static and receive the dispatch.
                  </p>
                )}
              </div>
            ) : justCaught ? (
              <div className="bg-emerald-950/30 border border-emerald-500/40 rounded p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 mb-1">
                  <Volume2 className="w-4 h-4" />
                  Broadcast Logged: {justCaught.title}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{justCaught.transcript}</p>
              </div>
            ) : (
              <div className="bg-[#111928] border border-slate-800 rounded p-4 text-xs text-slate-400">
                No urgent transmission on the air right now. Broadcasts caught this watch:{' '}
                <span className="font-mono-tabular text-slate-200">
                  {caughtBroadcastIds.size}/4
                </span>
                . Keep monitoring as the storm develops.
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 space-y-3 max-h-[64vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
              <p className="text-xs text-slate-400">
                Watch Phone Feed · EAS tests air on TV/radio only, never cell phones.
              </p>
              <div className="flex items-center gap-1">
                {(['all', 'rumors', 'official'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      soundEngine.playClick();
                      setPhoneFilter(f);
                    }}
                    className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors cursor-pointer ${
                      phoneFilter === f
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'rumors' ? 'Rumors' : 'Official'}
                  </button>
                ))}
              </div>
            </div>
            {visibleMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded border ${
                  msg.isRumor
                    ? 'bg-amber-950/20 border-amber-500/35'
                    : 'bg-[#111928] border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold ${
                        msg.isRumor ? 'text-amber-300' : 'text-sky-300'
                      }`}
                    >
                      {msg.sender}
                    </span>
                    <span className="font-mono-tabular text-[10px] text-slate-400">
                      {msg.isRumor ? '· RUMOR' : '· OFFICIAL'}
                    </span>
                  </div>
                  <span className="font-mono-tabular text-slate-500 shrink-0">{msg.time}</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">{msg.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
