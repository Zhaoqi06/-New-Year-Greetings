export const SHOW_DURATION = 60;

export type ActId = 1 | 2 | 3 | 4;

export type CameraMode = 'cinematic' | 'free';

export interface ActDefinition {
  id: ActId;
  shortLabel: string;
  chapterLabel: string;
  title: string;
  startTime: number;
  endTime: number;
  poeticPrimary: string;
  poeticSecondary: string;
}

export interface GreetingConfig {
  recipient: string;
  headline: string;
  subline: string;
  signature: string;
}

export interface EngineTelemetry {
  currentTime: number;
  activeAct: ActId;
  isPlaying: boolean;
  cameraMode: CameraMode;
  contextLost: boolean;
}

export const ACTS: ActDefinition[] = [
  {
    id: 1,
    shortLabel: '一 · 岁启',
    chapterLabel: '第一幕 · 岁启微光',
    title: '岁启微光',
    startTime: 0,
    endTime: 14,
    poeticPrimary: '旧岁将尽，万象待春',
    poeticSecondary: '愿微光自阶前升起，照亮新岁山海',
  },
  {
    id: 2,
    shortLabel: '二 · 流金',
    chapterLabel: '第二幕 · 流金映雪',
    title: '流金映雪',
    startTime: 14,
    endTime: 28,
    poeticPrimary: '灯火可亲，岁华如锦',
    poeticSecondary: '所行之处皆坦途，所遇之人皆温柔',
  },
  {
    id: 3,
    shortLabel: '三 · 烟火',
    chapterLabel: '第三幕 · 烟火盛放',
    title: '烟火盛放',
    startTime: 28,
    endTime: 48,
    poeticPrimary: '烟火向星辰，所愿皆成真',
    poeticSecondary: '愿新年胜旧年，欢愉且胜意，万事尽可期',
  },
  {
    id: 4,
    shortLabel: '四 · 定格',
    chapterLabel: '第四幕 · 锦绣定格',
    title: '锦绣定格',
    startTime: 48,
    endTime: 60,
    poeticPrimary: '岁岁常欢愉，年年皆胜意',
    poeticSecondary: '愿新岁灯火长明，喜乐安宁常伴左右',
  },
];

export const DEFAULT_GREETING: GreetingConfig = {
  recipient: '挚友与家人',
  headline: '岁岁常欢愉，年年皆胜意',
  subline: '愿这一夜流光与烟火，伴你奔赴明朗新岁',
  signature: '新春贺启',
};

export const GREETING_PRESETS: Array<{ label: string; config: GreetingConfig }> = [
  {
    label: '温暖诗意',
    config: DEFAULT_GREETING,
  },
  {
    label: '浪漫跨年',
    config: {
      recipient: '我最挂念的人',
      headline: '星河长明，愿与你共赴新岁',
      subline: '山高水长，往后每一个冬夜都有暖灯相候',
      signature: '永远祝福你的我',
    },
  },
  {
    label: '阖家喜庆',
    config: {
      recipient: '各位亲朋好友',
      headline: '恭贺新禧，万事顺遂安康',
      subline: '春风入怀，岁岁平安，阖家欢聚喜乐绵长',
      signature: '敬祝新春',
    },
  },
];

const STORAGE_KEY = 'suihua_festival_greeting_v1';

export function getActForTime(t: number): ActDefinition {
  const clamped = Math.max(0, Math.min(SHOW_DURATION - 0.001, t));
  for (let i = ACTS.length - 1; i >= 0; i--) {
    if (clamped >= ACTS[i].startTime) {
      return ACTS[i];
    }
  }
  return ACTS[0];
}

export function loadInitialGreeting(): GreetingConfig {
  try {
    const params = new URLSearchParams(window.location.search);
    const to = params.get('to')?.trim();
    const headline = params.get('h')?.trim();
    const subline = params.get('s')?.trim();
    const from = params.get('from')?.trim();

    if (to || headline || subline || from) {
      return {
        recipient: (to || DEFAULT_GREETING.recipient).slice(0, 24),
        headline: (headline || DEFAULT_GREETING.headline).slice(0, 32),
        subline: (subline || DEFAULT_GREETING.subline).slice(0, 56),
        signature: (from || DEFAULT_GREETING.signature).slice(0, 24),
      };
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GreetingConfig>;
      return {
        recipient: (parsed.recipient ?? DEFAULT_GREETING.recipient).slice(0, 24),
        headline: (parsed.headline ?? DEFAULT_GREETING.headline).slice(0, 32),
        subline: (parsed.subline ?? DEFAULT_GREETING.subline).slice(0, 56),
        signature: (parsed.signature ?? DEFAULT_GREETING.signature).slice(0, 24),
      };
    }
  } catch {
    // Ignore storage/URL parsing errors in restricted iframes
  }
  return { ...DEFAULT_GREETING };
}

export function saveGreeting(config: GreetingConfig): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage errors
  }
}

export function buildShareUrl(config: GreetingConfig): string {
  const url = new URL(window.location.href);
  url.searchParams.set('to', config.recipient.trim() || DEFAULT_GREETING.recipient);
  url.searchParams.set('h', config.headline.trim() || DEFAULT_GREETING.headline);
  url.searchParams.set('s', config.subline.trim() || DEFAULT_GREETING.subline);
  url.searchParams.set('from', config.signature.trim() || DEFAULT_GREETING.signature);
  return url.toString();
}

export function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.min(SHOW_DURATION, Math.floor(seconds)));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
