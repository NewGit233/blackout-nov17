import React from 'react';
import { Check, FileText, Lock, X } from 'lucide-react';
import { INVESTIGATION_SCENES } from '../data/gameContent';
import { DistrictId, DistrictState } from '../types/game';

interface DossierModalProps {
  foundIds: Set<string>;
  districts: Record<DistrictId, DistrictState>;
  onClose: () => void;
  onJumpToScene: (id: DistrictId) => void;
}

export const DossierModal: React.FC<DossierModalProps> = ({
  foundIds,
  districts,
  onClose,
  onJumpToScene,
}) => {
  const sceneOrder: DistrictId[] = ['town_hall', 'general_store', 'bank', 'substation'];
  const totalClues = sceneOrder.reduce(
    (acc, id) => acc + INVESTIGATION_SCENES[id].objects.length,
    0
  );
  const totalFound = foundIds.size;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/85 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl max-h-[88vh] bg-[#0d131f] border border-slate-700/80 rounded-md flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="font-display text-lg font-bold text-slate-100">
                Nov 17 Clues &amp; Rumor Fixes Dossier
              </h2>
              <p className="text-xs text-slate-400 font-mono-tabular">
                {totalFound} / {totalClues} Evidence Clues Found · Oakhaven Watch Log
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            aria-label="Close Dossier"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {sceneOrder.map((id) => {
              const scene = INVESTIGATION_SCENES[id];
              const district = districts[id];
              const sceneFound = scene.objects.filter((o) => foundIds.has(o.id));
              return (
                <div
                  key={id}
                  className="bg-[#111928] border border-slate-800 rounded p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-display text-sm font-bold text-amber-100">
                          {scene.title}
                        </h3>
                        <p className="text-xs text-slate-400">{scene.subtitle}</p>
                      </div>
                      <span className="font-mono-tabular text-xs text-sky-300 shrink-0">
                        Clues {sceneFound.length}/{scene.objects.length}
                      </span>
                    </div>

                    <div className="space-y-2 mt-3">
                      {scene.objects.map((obj) => {
                        const found = foundIds.has(obj.id);
                        return (
                          <div key={obj.id} className="text-xs flex items-start gap-2">
                            {found ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <span className="w-3.5 h-3.5 text-slate-600 shrink-0 text-center">
                                ·
                              </span>
                            )}
                            <div>
                              <span className={found ? 'text-slate-100 font-medium' : 'text-slate-500'}>
                                {found ? `Clue: ${obj.clueTitle}` : 'Unrecovered clue'}
                              </span>
                              {found && (
                                <p className="text-emerald-300/85 leading-snug mt-0.5">
                                  Rumor Fixed: {obj.rumorDebunked}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    {district.investigationUnlocked ? (
                      <button
                        onClick={() => onJumpToScene(id)}
                        className="px-3 py-1.5 text-xs font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/40 rounded transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {sceneFound.length === scene.objects.length
                          ? 'Review Room Clues'
                          : 'Search for Clues'}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <Lock className="w-3.5 h-3.5" />
                        Unlocks in upcoming shift
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
