import React from 'react';
import { Radio } from 'lucide-react';
import { NarrativeChoice, NarrativeEvent } from '../types/game';

interface NarrativeEventModalProps {
  event: NarrativeEvent;
  onChoose: (choice: NarrativeChoice) => void;
}

export const NarrativeEventModal: React.FC<NarrativeEventModalProps> = ({ event, onChoose }) => {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/85 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#0e1522] border border-amber-500/40 rounded-md p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 text-xs font-mono-tabular text-amber-300/90 mb-2">
          <span className="inline-flex items-center gap-2">
            <Radio className="w-4 h-4" />
            {event.source}
          </span>
          <span>{event.timestamp}</span>
        </div>

        <h2 className="font-display text-2xl font-bold text-slate-100 mb-3 text-balance">
          {event.title}
        </h2>

        {event.isEasTest && (
          <div className="mb-4 px-3.5 py-2.5 bg-amber-950/50 border border-amber-500/40 rounded text-xs font-mono-tabular text-amber-200">
            FEMA / FCC NATIONWIDE EAS TEST · 14:20 ET · TV, RADIO &amp; CABLE ONLY · PHONES UNAFFECTED
          </div>
        )}

        <p className="text-sm leading-relaxed text-slate-300 mb-6">{event.body}</p>

        <div className="space-y-2.5">
          {event.choices.map((choice, idx) => {
            const effectList = Object.entries(choice.effects)
              .map(([k, v]) => `${v && v > 0 ? `+${v}` : v} ${k}`)
              .join(' · ');
            return (
              <button
                key={idx}
                onClick={() => onChoose(choice)}
                className="w-full text-left px-4 py-3 bg-[#151f31] hover:bg-[#1b2840] border border-slate-700 hover:border-amber-500/50 rounded transition-colors cursor-pointer flex items-center justify-between gap-4"
              >
                <span className="text-sm font-medium text-slate-100">{choice.label}</span>
                <span className="font-mono-tabular text-xs text-slate-400 shrink-0">
                  {effectList}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
