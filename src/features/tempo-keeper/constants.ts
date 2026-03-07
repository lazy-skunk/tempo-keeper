export const MIN_BPM = 30;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 120;

export const DEFAULT_BEATS_PER_BAR = 4;
export const MIN_BEATS_PER_BAR = 1;
export const BEATS_PER_BAR_OPTIONS = [
  2,
  3,
  DEFAULT_BEATS_PER_BAR,
  5,
  6,
] as const;

export const SECONDS_PER_MINUTE = 60;
export const DOWNBEAT_INDEX = 0;

export const LOOKAHEAD_MILLISECONDS = 25;
export const SCHEDULE_AHEAD_SECONDS = 0.1;

export const CLICK_FREQUENCY_HZ = 1000;

export const DOWNBEAT_CLICK_ATTACK_GAIN = 1.0;
export const REGULAR_CLICK_ATTACK_GAIN = 0.5;
export const CLICK_SILENT_GAIN = 0.0001;
export const CLICK_ATTACK_SECONDS = 0.005;
export const CLICK_DECAY_SECONDS = 0.05;
const CLICK_DURATION_BUFFER_SECONDS = 0.01;
export const CLICK_DURATION_SECONDS =
  CLICK_DECAY_SECONDS + CLICK_DURATION_BUFFER_SECONDS;
