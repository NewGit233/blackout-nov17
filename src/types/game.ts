export type GameScreen =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'INVESTIGATING'
  | 'PAUSED'
  | 'SHIFT_SUMMARY'
  | 'VICTORY'
  | 'GAME_OVER';

export type DistrictId = 'town_hall' | 'general_store' | 'bank' | 'substation';

export interface Resources {
  power: number; // 0-100 Grid stability
  fuel: number; // 0-100 Diesel reserve (L)
  supplies: number; // 0-100 Food, water & batteries
  calm: number; // 0-100 Town morale & trust
}

export interface DistrictState {
  id: DistrictId;
  name: string;
  shortName: string;
  powered: boolean;
  breakerTripped: boolean;
  rumorAlert: boolean;
  rumorText: string | null;
  investigationUnlocked: boolean;
  investigationCompleted: boolean;
  powerDraw: number;
  cooldownSec: number;
  mapRect: { x: number; y: number; w: number; h: number }; // 320x180 canvas coordinates
}

export interface HiddenObjectDef {
  id: string;
  name: string;
  spriteType:
    | 'x_post'
    | 'telegram_phone'
    | 'fema_memo'
    | 'walkie'
    | 'sticky_note'
    | 'gen_key'
    | 'water_jug'
    | 'ration_tin'
    | 'crank_torch'
    | 'storm_map'
    | 'hoarder_list'
    | 'spare_fuse'
    | 'atm_slip'
    | 'bank_ledger'
    | 'fiber_cable'
    | 'pry_bar'
    | 'burner_phone'
    | 'cash_roll'
    | 'fcc_log'
    | 'tv_clip_note'
    | 'breaker_lever'
    | 'copper_strap'
    | 'dec3_memo'
    | 'radar_print';
  x: number; // 0..320 canvas space
  y: number; // 0..180 canvas space
  w: number;
  h: number;
  lockedByPuzzle?: boolean;
  clueTitle: string;
  clueDetail: string;
  rumorDebunked: string;
  reward: Partial<Resources>;
}

export interface InvestigationSceneDef {
  id: DistrictId;
  title: string;
  subtitle: string;
  ambientNote: string;
  roomTheme: 'dispatch' | 'pantry' | 'vestibule' | 'relay';
  puzzleTitle: string;
  puzzlePrompt: string;
  objects: HiddenObjectDef[];
}

export interface RadioBroadcast {
  id: string;
  stationName: string;
  freqMHz: number;
  title: string;
  transcript: string;
  rewardText: string;
  effects: Partial<Resources>;
}

export interface PhoneMessage {
  id: string;
  sender: string;
  time: string;
  text: string;
  isRumor: boolean;
}

export interface NarrativeChoice {
  label: string;
  outcomeText: string;
  effects: Partial<Resources>;
}

export interface NarrativeEvent {
  id: string;
  day: number;
  timestamp: string;
  title: string;
  source: string;
  body: string;
  isEasTest?: boolean;
  choices: NarrativeChoice[];
}

export interface LogEntry {
  id: string;
  time: string;
  text: string;
  kind: 'info' | 'warning' | 'clue' | 'success';
}
