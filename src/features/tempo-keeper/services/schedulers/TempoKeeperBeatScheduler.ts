import {
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_BPM,
  DOWNBEAT_INDEX,
} from "@/features/tempo-keeper/constants";

export type TempoKeeperBeatSchedulerClock = {
  prepare: () => Promise<number | null>;
  getCurrentTimeSeconds: () => number | null;
  getTargetPerformanceTimeMilliseconds: (
    playbackTimeSeconds: number,
  ) => number | null;
};

type TempoKeeperBeatSchedulerOptions = {
  clock: TempoKeeperBeatSchedulerClock;
  lookaheadMilliseconds?: number;
  scheduleAheadSeconds?: number;
  onClockUnavailable?: () => void;
  onBeatScheduled?: (
    beatIndex: number,
    playbackTimeSeconds: number,
    targetPerformanceTimeMilliseconds: number,
  ) => void;
};

const LOOKAHEAD_MILLISECONDS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;

export class TempoKeeperBeatScheduler {
  private schedulerIntervalId: ReturnType<typeof setInterval> | null = null;
  private isPreparingClock = false;
  private prepareRequestId = 0;

  private readonly clock: TempoKeeperBeatSchedulerClock;
  private readonly lookaheadMilliseconds: number;
  private readonly scheduleAheadSeconds: number;
  private readonly onClockUnavailable?: () => void;
  private readonly onBeatScheduled?: (
    beatIndex: number,
    playbackTimeSeconds: number,
    targetPerformanceTimeMilliseconds: number,
  ) => void;

  private tempoBpm = DEFAULT_BPM;
  private beatsPerBar = DEFAULT_BEATS_PER_BAR;
  private currentBeatIndex = DOWNBEAT_INDEX;
  private nextBeatTimeSeconds = 0;

  constructor(options: TempoKeeperBeatSchedulerOptions) {
    this.clock = options.clock;
    this.lookaheadMilliseconds =
      options.lookaheadMilliseconds ?? LOOKAHEAD_MILLISECONDS;
    this.scheduleAheadSeconds =
      options.scheduleAheadSeconds ?? SCHEDULE_AHEAD_SECONDS;
    this.onClockUnavailable = options.onClockUnavailable;
    this.onBeatScheduled = options.onBeatScheduled;
  }

  public setTempoBpm(nextTempoBpm: number) {
    this.tempoBpm = nextTempoBpm;
  }

  public setBeatsPerBar(nextBeatsPerBar: number) {
    this.beatsPerBar = nextBeatsPerBar;
    this.currentBeatIndex = DOWNBEAT_INDEX;
  }

  public getIsRunning() {
    return this.schedulerIntervalId !== null;
  }

  public async start() {
    if (this.getIsRunning() || this.isPreparingClock) {
      return this.getIsRunning();
    }

    this.isPreparingClock = true;
    const requestId = ++this.prepareRequestId;

    try {
      const currentTimeSeconds = await this.clock.prepare();
      if (currentTimeSeconds === null) {
        return false;
      }

      if (requestId !== this.prepareRequestId || this.getIsRunning()) {
        return false;
      }

      this.currentBeatIndex = DOWNBEAT_INDEX;
      this.nextBeatTimeSeconds = currentTimeSeconds;
      this.schedulerIntervalId = setInterval(
        this.schedulePendingBeats,
        this.lookaheadMilliseconds,
      );
      this.schedulePendingBeats();

      return true;
    } finally {
      this.isPreparingClock = false;
    }
  }

  public stop() {
    this.prepareRequestId += 1;
    this.isPreparingClock = false;

    if (this.schedulerIntervalId) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }

    this.currentBeatIndex = DOWNBEAT_INDEX;
    this.nextBeatTimeSeconds = 0;
  }

  public dispose() {
    this.stop();
  }

  private readonly schedulePendingBeats = () => {
    const currentTimeSeconds = this.clock.getCurrentTimeSeconds();
    if (currentTimeSeconds === null) {
      this.stop();
      this.onClockUnavailable?.();
      return;
    }

    while (
      this.nextBeatTimeSeconds <
      currentTimeSeconds + this.scheduleAheadSeconds
    ) {
      const beatIndexToSchedule = this.currentBeatIndex;
      const targetPerformanceTimeMilliseconds =
        this.clock.getTargetPerformanceTimeMilliseconds(
          this.nextBeatTimeSeconds,
        );
      if (targetPerformanceTimeMilliseconds === null) {
        this.stop();
        this.onClockUnavailable?.();
        return;
      }

      this.onBeatScheduled?.(
        beatIndexToSchedule,
        this.nextBeatTimeSeconds,
        targetPerformanceTimeMilliseconds,
      );

      const secondsPerBeat = 60 / this.tempoBpm;
      this.nextBeatTimeSeconds += secondsPerBeat;
      this.currentBeatIndex = (beatIndexToSchedule + 1) % this.beatsPerBar;
    }
  };
}
