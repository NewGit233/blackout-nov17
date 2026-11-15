import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BatteryCharging,
  FileText,
  Flame,
  Home,
  Package,
  Pause,
  Play,
  Power,
  Radio,
  RotateCcw,
  Search,
  ShieldAlert,
  Users,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { soundEngine } from './audio/soundEngine';
import { DossierModal } from './components/DossierModal';
import { InvestigationView } from './components/InvestigationView';
import { NarrativeEventModal } from './components/NarrativeEventModal';
import { RadioPhoneModal } from './components/RadioPhoneModal';
import { TownCanvas } from './components/TownCanvas';
import {
  DAY_SCHEDULE,
  INITIAL_RESOURCES,
  INVESTIGATION_SCENES,
  NARRATIVE_EVENTS,
  RADIO_BROADCASTS,
  SHIFT_DURATION_SEC,
  createInitialDistricts,
} from './data/gameContent';
import {
  DistrictId,
  DistrictState,
  GameScreen,
  HiddenObjectDef,
  LogEntry,
  NarrativeChoice,
  NarrativeEvent,
  RadioBroadcast,
  Resources,
} from './types/game';

const TITLE_ART_URL = '/src/assets/images/title_blackout_town_1794766612356.jpg';

const DISTRICT_ORDER: DistrictId[] = ['town_hall', 'general_store', 'bank', 'substation'];

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function formatShiftClock(dayIdx: number, progress: number): string {
  const sched = DAY_SCHEDULE[dayIdx];
  const totalHours = sched.startHour + progress * (sched.endHour - sched.startHour);
  const h = Math.floor(totalHours) % 24;
  const m = Math.floor((totalHours - Math.floor(totalHours)) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${sched.dateLabel.split(' · ')[1].replace(', 2026', '')} · ${hh}:${mm} ET`;
}

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('TITLE_MENU');
  const [dayIndex, setDayIndex] = useState(0); // 0 = Nov 15, 1 = Nov 16, 2 = Nov 17
  const [shiftElapsed, setShiftElapsed] = useState(0);
  const [resources, setResources] = useState<Resources>({ ...INITIAL_RESOURCES });
  const [districts, setDistricts] = useState<Record<DistrictId, DistrictState>>(
    createInitialDistricts
  );
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId | null>('town_hall');
  const [activeSceneId, setActiveSceneId] = useState<DistrictId | null>(null);
  const [foundClueIds, setFoundClueIds] = useState<Set<string>>(() => new Set());
  const [solvedPuzzles, setSolvedPuzzles] = useState<Set<DistrictId>>(() => new Set());
  const [dossierOpen, setDossierOpen] = useState(false);
  const [radioOpen, setRadioOpen] = useState(false);
  const [activeBroadcast, setActiveBroadcast] = useState<RadioBroadcast | null>(null);
  const [caughtBroadcastIds, setCaughtBroadcastIds] = useState<Set<string>>(() => new Set());
  const [activeEvent, setActiveEvent] = useState<NarrativeEvent | null>(null);
  const [triggeredEvents, setTriggeredEvents] = useState<Set<string>>(() => new Set());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [muted, setMuted] = useState(false);
  const [burstSignal, setBurstSignal] = useState<{
    id: DistrictId;
    color: string;
    seq: number;
  } | null>(null);
  const [titleImgError, setTitleImgError] = useState(false);
  const [gameOverReason, setGameOverReason] = useState('');

  const incidentTimerRef = useRef(12);
  const broadcastTimerRef = useRef(8);
  const seqRef = useRef(0);

  const pushLog = useCallback((text: string, kind: LogEntry['kind'] = 'info') => {
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        time: formatShiftClock(dayIndex, shiftElapsed / SHIFT_DURATION_SEC),
        text,
        kind,
      },
      ...prev.slice(0, 4),
    ]);
  }, [dayIndex, shiftElapsed]);

  const emitBurst = useCallback((id: DistrictId, color: string) => {
    seqRef.current += 1;
    setBurstSignal({ id, color, seq: seqRef.current });
  }, []);

  const startNewGame = useCallback(() => {
    soundEngine.stopMenuMusic();
    soundEngine.playClick();
    soundEngine.startAmbientRain();
    setDayIndex(0);
    setShiftElapsed(0);
    setResources({ ...INITIAL_RESOURCES });
    setDistricts(createInitialDistricts());
    setSelectedDistrict('town_hall');
    setActiveSceneId(null);
    setFoundClueIds(new Set());
    setSolvedPuzzles(new Set());
    setDossierOpen(false);
    setRadioOpen(false);
    setActiveBroadcast(null);
    setCaughtBroadcastIds(new Set());
    broadcastTimerRef.current = 8;
    incidentTimerRef.current = 12;
    setTriggeredEvents(new Set(['day1_start']));
    setActiveEvent(NARRATIVE_EVENTS.day1_start);
    setLogs([
      {
        id: 'init',
        time: 'NOV 15 · 19:00 ET',
        text: 'Night watch begins. Use WASD to patrol & R to tune your guard radio.',
        kind: 'info',
      },
    ]);
    setGameOverReason('');
    setScreen('PLAYING');
  }, []);

  const returnToMainMenu = useCallback(() => {
    soundEngine.playClick();
    soundEngine.stopInvestigationAmbience();
    soundEngine.stopAmbientRain();
    setDossierOpen(false);
    setRadioOpen(false);
    setActiveEvent(null);
    setActiveSceneId(null);
    setScreen('TITLE_MENU');
    if (!muted) {
      soundEngine.startMenuMusic();
    }
  }, [muted]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
    if (!next && screen === 'TITLE_MENU') {
      soundEngine.startMenuMusic();
    }
  }, [muted, screen]);

  // Title Screen Atmospheric Menu Theme (starts on first user gesture per browser policy, or immediately if unlocked)
  useEffect(() => {
    if (screen !== 'TITLE_MENU') {
      soundEngine.stopMenuMusic();
      return;
    }
    const unlockAndPlay = () => {
      if (!muted) {
        soundEngine.startMenuMusic();
      }
    };
    window.addEventListener('pointerdown', unlockAndPlay, { once: true });
    window.addEventListener('keydown', unlockAndPlay, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAndPlay);
      window.removeEventListener('keydown', unlockAndPlay);
    };
  }, [screen, muted]);

  // Keyboard shortcuts across screens
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (screen === 'TITLE_MENU') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startNewGame();
        }
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        toggleMute();
        return;
      }

      if (screen === 'PLAYING') {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (radioOpen) {
            setRadioOpen(false);
          } else if (dossierOpen) {
            setDossierOpen(false);
          } else if (!activeEvent) {
            setScreen('PAUSED');
          }
          return;
        }
        if (dossierOpen || radioOpen || activeEvent) return;

        if (e.key === 'f' || e.key === 'F' || e.key === 'Tab') {
          e.preventDefault();
          soundEngine.playClick();
          setDossierOpen(true);
        } else if (e.key === 'r' || e.key === 'R') {
          soundEngine.playClick();
          setRadioOpen(true);
        } else if (e.key === '1') {
          soundEngine.playSelectBuilding();
          setSelectedDistrict('town_hall');
        } else if (e.key === '2') {
          soundEngine.playSelectBuilding();
          setSelectedDistrict('general_store');
        } else if (e.key === '3') {
          soundEngine.playSelectBuilding();
          setSelectedDistrict('bank');
        } else if (e.key === '4') {
          soundEngine.playSelectBuilding();
          setSelectedDistrict('substation');
        } else if ((e.key === 'i' || e.key === 'I') && selectedDistrict) {
          const d = districts[selectedDistrict];
          if (d.investigationUnlocked) {
            soundEngine.playClick();
            setActiveSceneId(selectedDistrict);
            setScreen('INVESTIGATING');
          }
        }
      } else if (screen === 'PAUSED' && e.key === 'Escape') {
        e.preventDefault();
        setScreen('PLAYING');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    screen,
    startNewGame,
    toggleMute,
    dossierOpen,
    radioOpen,
    activeEvent,
    selectedDistrict,
    districts,
  ]);

  // Live town survival simulation tick while in PLAYING without modal overlays
  const simulationPaused =
    screen !== 'PLAYING' || dossierOpen || radioOpen || Boolean(activeEvent);

  useEffect(() => {
    if (simulationPaused) return;

    const interval = window.setInterval(() => {
      const dt = 0.2;

      setShiftElapsed((prev) => {
        const next = prev + dt;
        const progress = next / SHIFT_DURATION_SEC;

        // Day 3 (index 2) 14:20 ET EAS Broadcast Test trigger (~88% of shift 09:00->15:00)
        if (
          dayIndex === 2 &&
          progress >= 0.84 &&
          !triggeredEvents.has('day3_eas_test')
        ) {
          soundEngine.playEasAttentionTone();
          setTriggeredEvents((te) => new Set(te).add('day3_eas_test'));
          setActiveEvent(NARRATIVE_EVENTS.day3_eas_test);
          const easBc = RADIO_BROADCASTS.find((b) => b.id === 'bc_eas_relay');
          if (easBc && !caughtBroadcastIds.has(easBc.id)) {
            setActiveBroadcast(easBc);
          }
          setDistricts((prevD) => ({
            ...prevD,
            substation: {
              ...prevD.substation,
              investigationUnlocked: true,
              breakerTripped: true,
              rumorAlert: true,
              rumorText: 'Someone tried to pull the main disconnect at 14:20 ET!',
            },
          }));
        }

        if (next >= SHIFT_DURATION_SEC) {
          if (dayIndex < 2) {
            setScreen('SHIFT_SUMMARY');
          } else {
            soundEngine.playVictory();
            setScreen('VICTORY');
          }
          return SHIFT_DURATION_SEC;
        }
        return next;
      });

      // Cooldowns & resource simulation
      setDistricts((prevD) => {
        let changed = false;
        const updated = { ...prevD };
        for (const id of DISTRICT_ORDER) {
          if (updated[id].cooldownSec > 0) {
            updated[id] = {
              ...updated[id],
              cooldownSec: Math.max(0, updated[id].cooldownSec - dt),
            };
            changed = true;
          }
        }
        return changed ? updated : prevD;
      });

      // Random storm breaker trips & rumor flare-ups
      incidentTimerRef.current -= dt;
      if (incidentTimerRef.current <= 0) {
        incidentTimerRef.current = dayIndex === 2 ? 11 : dayIndex === 1 ? 14 : 17;
        setDistricts((prevD) => {
          const candidates = DISTRICT_ORDER.filter(
            (id) => !prevD[id].breakerTripped && !prevD[id].rumorAlert
          );
          if (candidates.length === 0) return prevD;
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          const isBreaker = Math.random() < 0.55 || pick === 'substation';
          if (isBreaker) {
            soundEngine.playAlert();
            emitBurst(pick, '#ef4444');
            pushLog(`Wind gust tripped ${prevD[pick].shortName} breaker.`, 'warning');
            return {
              ...prevD,
              [pick]: {
                ...prevD[pick],
                breakerTripped: true,
              },
            };
          } else {
            soundEngine.playRadioGlitch();
            emitBurst(pick, '#f59e0b');
            pushLog(`Rumor panic reported near ${prevD[pick].shortName}.`, 'warning');
            return {
              ...prevD,
              [pick]: {
                ...prevD[pick],
                rumorAlert: true,
                rumorText: 'Viral blackout posts stoking local panic',
              },
            };
          }
        });
      }

      // Incoming radio broadcasts for the guard's handheld tuner
      if (!activeBroadcast) {
        broadcastTimerRef.current -= dt;
        if (broadcastTimerRef.current <= 0) {
          broadcastTimerRef.current = 17;
          const pool =
            dayIndex === 0
              ? RADIO_BROADCASTS.slice(0, 2)
              : dayIndex === 1
              ? RADIO_BROADCASTS.slice(0, 3)
              : RADIO_BROADCASTS;
          const nextBc = pool.find((b) => !caughtBroadcastIds.has(b.id));
          if (nextBc) {
            soundEngine.playRadioGlitch();
            setActiveBroadcast(nextBc);
            pushLog(
              `Radio signal detected (~${Math.floor(nextBc.freqMHz)} MHz): open Radio (R).`,
              'clue'
            );
          }
        }
      }

      setResources((prevR) => {
        const subOnline = districts.substation.powered && !districts.substation.breakerTripped;
        const poweredCount = DISTRICT_ORDER.filter(
          (id) => id !== 'substation' && districts[id].powered && !districts[id].breakerTripped
        ).length;
        const blackoutCount = 3 - poweredCount;
        const rumorCount = DISTRICT_ORDER.filter((id) => districts[id].rumorAlert).length;
        const trippedCount = DISTRICT_ORDER.filter((id) => districts[id].breakerTripped).length;

        const fuelDelta = (subOnline ? -(0.35 + poweredCount * 0.28) : -0.1) * dt;
        const supplyDelta = -(0.52 + dayIndex * 0.1) * dt;
        const powerDelta = subOnline
          ? (0.55 - poweredCount * 0.35 - trippedCount * 0.65) * dt
          : -1.6 * dt;
        const calmDelta =
          (0.18 - blackoutCount * 0.45 - rumorCount * 0.55 - (prevR.supplies < 15 ? 0.8 : 0)) *
          dt;

        const nextPower = clamp(prevR.power + powerDelta);
        const nextFuel = clamp(prevR.fuel + fuelDelta);
        const nextSupplies = clamp(prevR.supplies + supplyDelta);
        const nextCalm = clamp(prevR.calm + calmDelta);

        if (nextCalm <= 0) {
          soundEngine.playGameOver();
          setGameOverReason(
            'Panic overwhelmed Oakhaven as blackouts and unchecked rumors fractured civic calm.'
          );
          setScreen('GAME_OVER');
        } else if (nextSupplies <= 0) {
          soundEngine.playGameOver();
          setGameOverReason(
            'Oakhaven’s emergency food and water reserves ran dry during the winter squall.'
          );
          setScreen('GAME_OVER');
        }

        return {
          power: nextPower,
          fuel: nextFuel,
          supplies: nextSupplies,
          calm: nextCalm,
        };
      });
    }, 200);

    return () => window.clearInterval(interval);
  }, [
    simulationPaused,
    dayIndex,
    districts,
    triggeredEvents,
    activeBroadcast,
    caughtBroadcastIds,
    emitBurst,
    pushLog,
  ]);

  // If fuel hits 0, force substation brownout
  useEffect(() => {
    if (resources.fuel <= 0.5 && districts.substation.powered) {
      setDistricts((prev) => ({
        ...prev,
        substation: { ...prev.substation, powered: false },
      }));
      pushLog('Diesel reserve empty! Substation generator stalled.', 'warning');
    }
  }, [resources.fuel, districts.substation.powered, pushLog]);

  const handleTogglePower = (id: DistrictId) => {
    const d = districts[id];
    if (d.breakerTripped) {
      soundEngine.playMiss();
      pushLog(`Repair ${d.shortName} breaker before restoring power.`, 'warning');
      return;
    }
    const nextPowered = !d.powered;
    if (nextPowered && resources.fuel <= 1 && id === 'substation') {
      soundEngine.playMiss();
      pushLog('Need diesel fuel before restarting Substation.', 'warning');
      return;
    }
    soundEngine.playBreaker(nextPowered);
    emitBurst(id, nextPowered ? '#fbbf24' : '#64748b');
    setDistricts((prev) => ({
      ...prev,
      [id]: { ...prev[id], powered: nextPowered },
    }));
  };

  const handleRepairBreaker = (id: DistrictId) => {
    soundEngine.playBreaker(true);
    emitBurst(id, '#38bdf8');
    setDistricts((prev) => ({
      ...prev,
      [id]: { ...prev[id], breakerTripped: false, powered: true },
    }));
    setResources((r) => ({ ...r, power: clamp(r.power + 6) }));
    pushLog(`${districts[id].shortName} breaker reset and online.`, 'success');
  };

  const handleDistrictAction = (id: DistrictId, action: 'primary' | 'secondary') => {
    const d = districts[id];
    if (d.cooldownSec > 0) return;

    if (id === 'town_hall') {
      if (!d.powered || d.breakerTripped) {
        soundEngine.playMiss();
        pushLog('Town Hall needs power to broadcast.', 'warning');
        return;
      }
      soundEngine.playRadioGlitch();
      emitBurst(id, '#38bdf8');
      setDistricts((prev) => ({
        ...prev,
        town_hall: { ...prev.town_hall, rumorAlert: false, rumorText: null, cooldownSec: 7 },
      }));
      setResources((r) => ({ ...r, calm: clamp(r.calm + 10), power: clamp(r.power - 4) }));
      pushLog('Broadcast calm fact-check over Oakhaven FM.', 'success');
    } else if (id === 'general_store') {
      if (action === 'primary') {
        if (!d.powered || d.breakerTripped) {
          soundEngine.playMiss();
          pushLog('Restore General Store power to organize stock.', 'warning');
          return;
        }
        soundEngine.playActionSuccess();
        emitBurst(id, '#10b981');
        setDistricts((prev) => ({
          ...prev,
          general_store: {
            ...prev.general_store,
            rumorAlert: false,
            rumorText: null,
            cooldownSec: 7,
          },
        }));
        setResources((r) => ({ ...r, supplies: clamp(r.supplies + 12) }));
        pushLog('Restocked emergency food & water crates at General Store.', 'success');
      } else {
        if (resources.supplies < 8) {
          soundEngine.playMiss();
          pushLog('Not enough supplies to distribute extra rations.', 'warning');
          return;
        }
        soundEngine.playActionSuccess();
        emitBurst(id, '#fbbf24');
        setDistricts((prev) => ({
          ...prev,
          general_store: { ...prev.general_store, cooldownSec: 6 },
        }));
        setResources((r) => ({
          ...r,
          supplies: clamp(r.supplies - 8),
          calm: clamp(r.calm + 11),
        }));
        pushLog('Distributed 3-day storm rations to Maple Lane households.', 'success');
      }
    } else if (id === 'bank') {
      if (!d.powered || d.breakerTripped) {
        soundEngine.playMiss();
        pushLog('Oakhaven Bank requires power to post verified balances.', 'warning');
        return;
      }
      soundEngine.playActionSuccess();
      emitBurst(id, '#34d399');
      setDistricts((prev) => ({
        ...prev,
        bank: { ...prev.bank, rumorAlert: false, rumorText: null, cooldownSec: 7 },
      }));
      setResources((r) => ({ ...r, calm: clamp(r.calm + 9), power: clamp(r.power - 3) }));
      pushLog('Posted verified account clearing notice outside Bank.', 'success');
    } else if (id === 'substation') {
      if (action === 'primary') {
        if (resources.supplies < 8) {
          soundEngine.playMiss();
          pushLog('Need 8 Supplies to trade for co-op diesel.', 'warning');
          return;
        }
        soundEngine.playActionSuccess();
        emitBurst(id, '#f59e0b');
        setDistricts((prev) => ({
          ...prev,
          substation: { ...prev.substation, powered: true, cooldownSec: 7 },
        }));
        setResources((r) => ({
          ...r,
          supplies: clamp(r.supplies - 8),
          fuel: clamp(r.fuel + 18),
        }));
        pushLog('Transferred diesel drums to Substation generator.', 'success');
      } else {
        soundEngine.playActionSuccess();
        emitBurst(id, '#38bdf8');
        setDistricts((prev) => ({
          ...prev,
          substation: { ...prev.substation, rumorAlert: false, rumorText: null, cooldownSec: 7 },
        }));
        setResources((r) => ({ ...r, power: clamp(r.power + 14), fuel: clamp(r.fuel - 5) }));
        pushLog('Balanced substation feeder load.', 'success');
      }
    }
  };

  const handleFoundObject = (obj: HiddenObjectDef) => {
    setFoundClueIds((prev) => {
      const next = new Set(prev);
      next.add(obj.id);

      // Check if this completes the scene
      if (activeSceneId) {
        const scene = INVESTIGATION_SCENES[activeSceneId];
        const allInScene = scene.objects.every((o) => next.has(o.id));
        if (allInScene) {
          setDistricts((prevD) => ({
            ...prevD,
            [activeSceneId]: {
              ...prevD[activeSceneId],
              investigationCompleted: true,
              rumorAlert: false,
              rumorText: null,
            },
          }));
          pushLog(`${scene.title} fully investigated!`, 'clue');
        } else {
          pushLog(`Clue found: ${obj.clueTitle}`, 'clue');
        }
      }
      return next;
    });

    setResources((r) => ({
      power: clamp(r.power + (obj.reward.power ?? 0)),
      fuel: clamp(r.fuel + (obj.reward.fuel ?? 0)),
      supplies: clamp(r.supplies + (obj.reward.supplies ?? 0)),
      calm: clamp(r.calm + (obj.reward.calm ?? 0)),
    }));
  };

  const handleNarrativeChoice = (choice: NarrativeChoice) => {
    soundEngine.playClick();
    setResources((r) => ({
      power: clamp(r.power + (choice.effects.power ?? 0)),
      fuel: clamp(r.fuel + (choice.effects.fuel ?? 0)),
      supplies: clamp(r.supplies + (choice.effects.supplies ?? 0)),
      calm: clamp(r.calm + (choice.effects.calm ?? 0)),
    }));
    pushLog(choice.outcomeText, 'info');
    setActiveEvent(null);
  };

  const handleCatchBroadcast = (bc: RadioBroadcast) => {
    setCaughtBroadcastIds((prev) => new Set(prev).add(bc.id));
    setActiveBroadcast(null);
    broadcastTimerRef.current = 18;
    emitBurst('town_hall', '#38bdf8');
    setResources((r) => ({
      power: clamp(r.power + (bc.effects.power ?? 0)),
      fuel: clamp(r.fuel + (bc.effects.fuel ?? 0)),
      supplies: clamp(r.supplies + (bc.effects.supplies ?? 0)),
      calm: clamp(r.calm + (bc.effects.calm ?? 0)),
    }));
    pushLog(`Caught ${bc.stationName}: ${bc.title} (${bc.rewardText})`, 'success');
  };

  const handleInteractDistrict = (id: DistrictId) => {
    setSelectedDistrict(id);
    const d = districts[id];
    if (d.breakerTripped) {
      handleRepairBreaker(id);
    } else if (d.investigationUnlocked) {
      soundEngine.playClick();
      setActiveSceneId(id);
      setScreen('INVESTIGATING');
    } else {
      handleDistrictAction(id, 'primary');
    }
  };

  const handleInvestigationPenalty = (calmLoss: number, msg: string) => {
    setResources((r) => {
      const nextCalm = clamp(r.calm - calmLoss);
      if (nextCalm <= 0) {
        soundEngine.playGameOver();
        setGameOverReason(
          'Panic overwhelmed Oakhaven as dark-room alarms and unchecked rumors fractured civic calm.'
        );
        setActiveSceneId(null);
        setScreen('GAME_OVER');
      }
      return { ...r, calm: nextCalm };
    });
    pushLog(msg, 'warning');
  };

  const handlePuzzleSolved = () => {
    if (!activeSceneId) return;
    setSolvedPuzzles((prev) => new Set(prev).add(activeSceneId));
    setResources((r) => ({ ...r, calm: clamp(r.calm + 5) }));
    pushLog(`Security lock bypassed in ${INVESTIGATION_SCENES[activeSceneId].title}.`, 'success');
  };

  const advanceToNextDay = () => {
    soundEngine.playClick();
    const nextDay = dayIndex + 1;
    setDayIndex(nextDay);
    setShiftElapsed(0);

    if (nextDay === 1) {
      setDistricts((prev) => ({
        ...prev,
        general_store: {
          ...prev.general_store,
          investigationUnlocked: true,
          rumorAlert: true,
          rumorText: 'Panic-buyers emptying shelves',
        },
        bank: {
          ...prev.bank,
          investigationUnlocked: true,
          rumorAlert: true,
          rumorText: 'ATM line outage sparks bank-wipe rumor',
        },
      }));
      setTriggeredEvents((te) => new Set(te).add('day2_start'));
      setActiveEvent(NARRATIVE_EVENTS.day2_start);
    } else if (nextDay === 2) {
      setDistricts((prev) => ({
        ...prev,
        substation: {
          ...prev.substation,
          investigationUnlocked: true,
        },
      }));
    }
    setScreen('PLAYING');
  };

  const currentSchedule = DAY_SCHEDULE[dayIndex];

  useEffect(() => {
    const level: 1 | 2 | 3 = dayIndex >= 2 ? 3 : dayIndex === 1 ? 2 : 1;
    soundEngine.setStormIntensity(level);
  }, [dayIndex]);

  const shiftProgress = clamp(shiftElapsed / SHIFT_DURATION_SEC, 0, 1);
  const liveClock = formatShiftClock(dayIndex, shiftProgress);
  const activeDistrict = selectedDistrict ? districts[selectedDistrict] : null;

  const totalCluesFound = foundClueIds.size;
  const totalCluesCount = useMemo(
    () =>
      DISTRICT_ORDER.reduce((acc, id) => acc + INVESTIGATION_SCENES[id].objects.length, 0),
    []
  );

  const clueProgress = useMemo(() => {
    const result = {} as Record<DistrictId, { found: number; total: number }>;
    for (const id of DISTRICT_ORDER) {
      const objs = INVESTIGATION_SCENES[id].objects;
      result[id] = {
        found: objs.filter((o) => foundClueIds.has(o.id)).length,
        total: objs.length,
      };
    }
    return result;
  }, [foundClueIds]);

  // ---------------------------------------------------------------------------
  // 1. TITLE SCREEN
  // ---------------------------------------------------------------------------
  if (screen === 'TITLE_MENU') {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-[#070b12] flex items-center">
        {/* Atmospheric Generated Pixel-Art Key Art Backdrop */}
        {!titleImgError ? (
          <img
            src={TITLE_ART_URL}
            alt="Oakhaven at night during a storm power blackout"
            referrerPolicy="no-referrer"
            onError={() => setTitleImgError(true)}
            className="absolute inset-0 w-full h-full object-cover pixelated opacity-90"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#09111e] via-[#111b2c] to-[#080c14]" />
        )}

        {/* Measured Contrast Scrim keeping upper-left sky legible while showcasing the town */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#070b12]/92 via-[#070b12]/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070b12]/80 via-transparent to-[#070b12]/40" />

        {/* Title Lockup placed in the calm negative-space upper/mid-left */}
        <div className="relative z-10 max-w-xl px-8 sm:px-14 py-10 flex flex-col items-start">
          <p className="font-mono-tabular text-xs tracking-wider text-amber-300/90 mb-3">
            OAKHAVEN WATCH · NOV 15 – NOV 17, 2026
          </p>

          {/* Bespoke Inline SVG Title Lockup */}
          <svg
            viewBox="0 0 460 118"
            className="w-full max-w-md h-auto mb-5"
            role="img"
            aria-label="Blackout: Nov 17"
          >
            <rect x="0" y="6" width="6" height="96" fill="#f59e0b" />
            <text
              x="22"
              y="54"
              fill="#f8fafc"
              fontFamily="Chakra Petch, sans-serif"
              fontWeight="700"
              fontSize="48"
              letterSpacing="2"
            >
              BLACKOUT
            </text>
            <text
              x="24"
              y="98"
              fill="#fbbf24"
              fontFamily="JetBrains Mono, monospace"
              fontWeight="600"
              fontSize="26"
              letterSpacing="3"
            >
              NOV 17 · 14:20 ET
            </text>
          </svg>

          <p className="text-sm sm:text-base leading-relaxed text-slate-200 max-w-md mb-8">
            Keep Oakhaven powered through autumn storm outages, ration vital supplies, and
            investigate dark rooms to uncover the truth behind the viral November 17th rumors.
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-7">
            <button
              onClick={startNewGame}
              className="inline-flex items-center gap-2.5 px-7 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base rounded transition-colors cursor-pointer shadow-lg"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Watch
            </button>
            <button
              onClick={toggleMute}
              className="inline-flex items-center gap-2 px-4 py-3 bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded text-sm font-medium transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {muted ? 'Audio Off' : 'Audio On'}
            </button>
          </div>

          <p className="font-mono-tabular text-xs text-slate-400">
            WASD / Arrows Move · E Interact · R Radio · F Dossier · Esc Pause
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. HIDDEN OBJECT INVESTIGATION VIEW
  // ---------------------------------------------------------------------------
  if (screen === 'INVESTIGATING' && activeSceneId) {
    return (
      <div className="w-screen h-screen overflow-hidden">
        <InvestigationView
          scene={INVESTIGATION_SCENES[activeSceneId]}
          foundIds={foundClueIds}
          puzzleSolved={solvedPuzzles.has(activeSceneId)}
          onPuzzleSolved={handlePuzzleSolved}
          onPenalty={handleInvestigationPenalty}
          onFoundObject={handleFoundObject}
          onExit={() => {
            setActiveSceneId(null);
            setScreen('PLAYING');
          }}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 3. MAIN TOWN SURVIVAL VIEW (+ Modals)
  // ---------------------------------------------------------------------------
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070b12]">
      {/* Full-Viewport 60fps Pixel Town Canvas */}
      <TownCanvas
        day={dayIndex + 1}
        weatherStatus={currentSchedule.weather}
        paused={simulationPaused}
        districts={districts}
        selectedId={selectedDistrict}
        broadcastPending={Boolean(activeBroadcast)}
        clueProgress={clueProgress}
        onSelectDistrict={(id) => {
          soundEngine.playSelectBuilding();
          setSelectedDistrict(id);
        }}
        onInteractDistrict={handleInteractDistrict}
        burstSignal={burstSignal}
      />

      {/* World-Matched Low-Occlusion Perimeter HUD */}
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-4">
        {/* Top Perimeter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Shift Time & Weather */}
          <div className="pointer-events-auto bg-[#0b1019]/92 border border-slate-700/80 rounded px-3.5 py-2 flex items-center gap-4">
            <div>
              <div className="font-mono-tabular text-xs font-semibold text-amber-300">
                {liveClock}
              </div>
              <div className="text-[11px] text-slate-400">
                Shift {dayIndex + 1}/3 · {currentSchedule.weather}
              </div>
            </div>
            <div className="hidden md:block w-24 h-1.5 bg-slate-800 rounded-sm overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-200"
                style={{ width: `${Math.round(shiftProgress * 100)}%` }}
              />
            </div>
          </div>

          {/* Center: Survival Resource Meters */}
          <div className="pointer-events-auto bg-[#0b1019]/92 border border-slate-700/80 rounded px-4 py-2 flex items-center gap-4 sm:gap-6">
            <ResourceMeter
              icon={<BatteryCharging className="w-4 h-4 text-sky-400" />}
              label="Grid"
              value={resources.power}
              unit="%"
              lowThreshold={25}
            />
            <ResourceMeter
              icon={<Flame className="w-4 h-4 text-amber-400" />}
              label="Fuel"
              value={resources.fuel}
              unit="L"
              lowThreshold={20}
            />
            <ResourceMeter
              icon={<Package className="w-4 h-4 text-emerald-400" />}
              label="Supplies"
              value={resources.supplies}
              unit=""
              lowThreshold={20}
            />
            <ResourceMeter
              icon={<Users className="w-4 h-4 text-indigo-300" />}
              label="Calm"
              value={resources.calm}
              unit="%"
              lowThreshold={25}
            />
          </div>

          {/* Right: Radio & Phone, Dossier, Mute, Pause */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={() => {
                soundEngine.playClick();
                setRadioOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded border transition-colors cursor-pointer whitespace-nowrap ${
                activeBroadcast
                  ? 'bg-sky-500/25 hover:bg-sky-500/35 text-sky-100 border-sky-400'
                  : 'bg-[#0b1019]/92 hover:bg-slate-800 text-sky-200 border-sky-500/40'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              {activeBroadcast ? 'Catch Signal (R)' : `Radio (${caughtBroadcastIds.size}/4)`}
            </button>
            <button
              onClick={() => {
                soundEngine.playClick();
                setDossierOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0b1019]/92 hover:bg-slate-800 text-amber-200 border border-amber-500/40 rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              Clues ({totalCluesFound}/{totalCluesCount})
            </button>
            <button
              onClick={toggleMute}
              className="p-2 bg-[#0b1019]/92 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded transition-colors cursor-pointer"
              aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                soundEngine.playClick();
                setScreen('PAUSED');
              }}
              className="p-2 bg-[#0b1019]/92 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded transition-colors cursor-pointer"
              aria-label="Pause Game"
            >
              <Pause className="w-4 h-4" />
            </button>
            <button
              onClick={returnToMainMenu}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium bg-[#0b1019]/92 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 rounded transition-colors cursor-pointer whitespace-nowrap"
              title="Back to Main Menu"
            >
              <Home className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Main Menu</span>
            </button>
          </div>
        </div>

        {/* Bottom Perimeter: Compact Dispatch Log (left) + Selected District Control Dock (right/center) */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-end justify-between gap-3">
          {/* Quiet Dispatch Feed */}
          <div className="pointer-events-auto max-w-sm bg-[#0b1019]/88 border border-slate-800 rounded px-3.5 py-2.5 hidden sm:block">
            <div className="space-y-1">
              {logs.slice(0, 3).map((entry) => (
                <div key={entry.id} className="text-xs flex items-baseline gap-2 leading-snug">
                  <span className="font-mono-tabular text-[10px] text-slate-500 shrink-0">
                    {entry.time.split(' · ')[1] ?? entry.time}
                  </span>
                  <span
                    className={
                      entry.kind === 'warning'
                        ? 'text-amber-300'
                        : entry.kind === 'clue'
                        ? 'text-sky-300'
                        : entry.kind === 'success'
                        ? 'text-emerald-300'
                        : 'text-slate-300'
                    }
                  >
                    {entry.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected District Action Dock */}
          {activeDistrict && (
            <div className="pointer-events-auto bg-[#0b1019]/95 border border-slate-700/90 rounded px-4 py-3 flex flex-wrap items-center justify-between gap-4 shadow-xl">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-display text-sm sm:text-base font-bold text-slate-100 whitespace-nowrap">
                    {activeDistrict.name}
                  </h3>
                  <span className="text-slate-500" aria-hidden="true">
                    ·
                  </span>
                  <span
                    className={`font-mono-tabular text-xs font-medium ${
                      activeDistrict.breakerTripped
                        ? 'text-red-400'
                        : activeDistrict.powered
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {activeDistrict.breakerTripped
                      ? 'BREAKER TRIPPED'
                      : activeDistrict.powered
                      ? 'POWER ONLINE'
                      : 'POWER CUT'}
                  </span>
                </div>
                {activeDistrict.rumorAlert && activeDistrict.rumorText && (
                  <p className="text-xs text-amber-300 mt-0.5 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>{activeDistrict.rumorText}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeDistrict.breakerTripped ? (
                  <button
                    onClick={() => handleRepairBreaker(activeDistrict.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Repair Breaker
                  </button>
                ) : (
                  <button
                    onClick={() => handleTogglePower(activeDistrict.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Power className="w-3.5 h-3.5" />
                    {activeDistrict.powered ? 'Cut Power' : 'Restore Power'}
                  </button>
                )}

                {activeDistrict.id === 'town_hall' && (
                  <button
                    disabled={activeDistrict.cooldownSec > 0}
                    onClick={() => handleDistrictAction('town_hall', 'primary')}
                    className="px-3 py-1.5 text-xs font-medium bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-45 text-sky-200 border border-sky-500/40 rounded transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {activeDistrict.cooldownSec > 0
                      ? `Wait ${Math.ceil(activeDistrict.cooldownSec)}s`
                      : 'Rumor Fix: Broadcast Fact-Check'}
                  </button>
                )}

                {activeDistrict.id === 'general_store' && (
                  <>
                    <button
                      disabled={activeDistrict.cooldownSec > 0}
                      onClick={() => handleDistrictAction('general_store', 'primary')}
                      className="px-3 py-1.5 text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-45 text-emerald-200 border border-emerald-500/40 rounded transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {activeDistrict.cooldownSec > 0
                        ? `Wait ${Math.ceil(activeDistrict.cooldownSec)}s`
                        : 'Rumor Fix: Restock & Calm'}
                    </button>
                    <button
                      disabled={activeDistrict.cooldownSec > 0}
                      onClick={() => handleDistrictAction('general_store', 'secondary')}
                      className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-45 text-amber-200 border border-amber-500/40 rounded transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Distribute Rations
                    </button>
                  </>
                )}

                {activeDistrict.id === 'bank' && (
                  <button
                    disabled={activeDistrict.cooldownSec > 0}
                    onClick={() => handleDistrictAction('bank', 'primary')}
                    className="px-3 py-1.5 text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-45 text-emerald-200 border border-emerald-500/40 rounded transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {activeDistrict.cooldownSec > 0
                      ? `Wait ${Math.ceil(activeDistrict.cooldownSec)}s`
                      : 'Rumor Fix: Verify Balances'}
                  </button>
                )}

                {activeDistrict.id === 'substation' && (
                  <>
                    <button
                      disabled={activeDistrict.cooldownSec > 0}
                      onClick={() => handleDistrictAction('substation', 'primary')}
                      className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-45 text-amber-200 border border-amber-500/40 rounded transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {activeDistrict.cooldownSec > 0
                        ? `Wait ${Math.ceil(activeDistrict.cooldownSec)}s`
                        : 'Refuel Diesel'}
                    </button>
                    <button
                      disabled={activeDistrict.cooldownSec > 0}
                      onClick={() => handleDistrictAction('substation', 'secondary')}
                      className="px-3 py-1.5 text-xs font-medium bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-45 text-sky-200 border border-sky-500/40 rounded transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Rumor Fix: Stabilize Grid
                    </button>
                  </>
                )}

                {activeDistrict.investigationUnlocked && (
                  <button
                    onClick={() => {
                      soundEngine.playClick();
                      setActiveSceneId(activeDistrict.id);
                      setScreen('INVESTIGATING');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Search className="w-3.5 h-3.5" />
                    {activeDistrict.investigationCompleted
                      ? `Review Clues (${clueProgress[activeDistrict.id].found}/${clueProgress[activeDistrict.id].total})`
                      : `Search Clues (${clueProgress[activeDistrict.id].found}/${clueProgress[activeDistrict.id].total})`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Narrative Event Modal */}
      {activeEvent && (
        <NarrativeEventModal event={activeEvent} onChoose={handleNarrativeChoice} />
      )}

      {/* Case Dossier Modal */}
      {dossierOpen && (
        <DossierModal
          foundIds={foundClueIds}
          districts={districts}
          onClose={() => setDossierOpen(false)}
          onJumpToScene={(id) => {
            setDossierOpen(false);
            setActiveSceneId(id);
            setScreen('INVESTIGATING');
          }}
        />
      )}

      {/* Guard Radio & Phone Modal */}
      {radioOpen && (
        <RadioPhoneModal
          dayIndex={dayIndex}
          activeBroadcast={activeBroadcast}
          caughtBroadcastIds={caughtBroadcastIds}
          onCatchBroadcast={handleCatchBroadcast}
          onClose={() => setRadioOpen(false)}
        />
      )}

      {/* Pause Modal */}
      {screen === 'PAUSED' && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0d1420] border border-slate-700 rounded-md p-6 text-center shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-slate-100 mb-2">Watch Paused</h2>
            <p className="text-xs text-slate-400 mb-6">{currentSchedule.briefing}</p>
            <div className="space-y-2.5">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  setScreen('PLAYING');
                }}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded transition-colors cursor-pointer"
              >
                Resume
              </button>
              <button
                onClick={startNewGame}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded border border-slate-700 transition-colors cursor-pointer"
              >
                Restart Watch
              </button>
              <button
                onClick={returnToMainMenu}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-sm font-medium rounded border border-slate-700 transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Back to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Summary Modal */}
      {screen === 'SHIFT_SUMMARY' && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d1420] border border-amber-500/40 rounded-md p-6 shadow-2xl">
            <p className="font-mono-tabular text-xs text-amber-300 mb-1">
              SHIFT {dayIndex + 1} COMPLETE · {currentSchedule.dateLabel}
            </p>
            <h2 className="font-display text-2xl font-bold text-slate-100 mb-3">
              Oakhaven Held Through the Night
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-5">
              {DAY_SCHEDULE[dayIndex + 1].briefing}
            </p>

            <div className="grid grid-cols-4 gap-3 mb-6 bg-[#111928] border border-slate-800 rounded p-3 text-center">
              <div>
                <div className="text-[11px] text-slate-400">Grid</div>
                <div className="font-mono-tabular text-base font-bold text-sky-300">
                  {Math.round(resources.power)}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Fuel</div>
                <div className="font-mono-tabular text-base font-bold text-amber-300">
                  {Math.round(resources.fuel)}L
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Supplies</div>
                <div className="font-mono-tabular text-base font-bold text-emerald-300">
                  {Math.round(resources.supplies)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Calm</div>
                <div className="font-mono-tabular text-base font-bold text-indigo-200">
                  {Math.round(resources.calm)}%
                </div>
              </div>
            </div>

            <button
              onClick={advanceToNextDay}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded transition-colors cursor-pointer"
            >
              Begin Next Shift ({DAY_SCHEDULE[dayIndex + 1].dateLabel})
            </button>
          </div>
        </div>
      )}

      {/* Victory Epilogue Modal */}
      {screen === 'VICTORY' && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0d1420] border border-emerald-500/50 rounded-md p-6 sm:p-8 shadow-2xl">
            <p className="font-mono-tabular text-xs text-emerald-300 mb-1">
              TUE NOV 17, 2026 · 15:00 ET · SQUALL CLEARING
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-100 mb-3">
              Oakhaven Survived November 17
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              At 2:20 PM ET, the routine one-minute FEMA &amp; FCC Emergency Alert System test
              aired across TV and radio exactly as scheduled since mid-September. Cell phones stayed
              quiet, bank balances remained untouched, and the storm front cleared the ridge.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              The viral "global blackout" rumors traced back to an unverified social post, Telegram
              clip chains, and a coincidental 2023 cartoon episode. Keeping a few days of food,
              water, and backup power is always smart storm readiness—never a reason for panic.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6 bg-[#111928] border border-slate-800 rounded p-3.5 text-center">
              <div>
                <div className="text-[11px] text-slate-400">Clues Uncovered</div>
                <div className="font-mono-tabular text-lg font-bold text-amber-300">
                  {totalCluesFound}/{totalCluesCount}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Town Calm</div>
                <div className="font-mono-tabular text-lg font-bold text-emerald-300">
                  {Math.round(resources.calm)}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Reserves Left</div>
                <div className="font-mono-tabular text-lg font-bold text-sky-300">
                  {Math.round(resources.supplies)} Crates
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={startNewGame}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Play Again
              </button>
              <button
                onClick={returnToMainMenu}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded border border-slate-700 transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Back to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {screen === 'GAME_OVER' && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d1420] border border-red-500/50 rounded-md p-6 text-center shadow-2xl">
            <p className="font-mono-tabular text-xs text-red-400 mb-1">{liveClock}</p>
            <h2 className="font-display text-2xl font-bold text-slate-100 mb-2">
              Town Watch Collapsed
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">{gameOverReason}</p>
            <div className="space-y-2.5">
              <button
                onClick={startNewGame}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Play Again
              </button>
              <button
                onClick={returnToMainMenu}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded border border-slate-700 transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Back to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ResourceMeterProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  lowThreshold: number;
}

const ResourceMeter: React.FC<ResourceMeterProps> = ({
  icon,
  label,
  value,
  unit,
  lowThreshold,
}) => {
  const rounded = Math.round(value);
  const isLow = rounded <= lowThreshold;
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="leading-tight">
        <div className="text-[10px] text-slate-400">{label}</div>
        <div
          className={`font-mono-tabular text-xs sm:text-sm font-semibold ${
            isLow ? 'text-red-400' : 'text-slate-100'
          }`}
        >
          {rounded}
          {unit}
        </div>
      </div>
    </div>
  );
};
