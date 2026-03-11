import {
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_BPM,
  DOWNBEAT_INDEX,
} from "../constants";
import { TempoKeeperAudioEngine } from "../audio/TempoKeeperAudioEngine";
import { resolveTargetPerformanceTimeMilliseconds } from "../audio/resolveTargetPerformanceTimeMilliseconds";

type TempoKeeperBeatSchedulerOptions = {
  audioEngine: TempoKeeperAudioEngine;
  lookaheadMilliseconds?: number;
  scheduleAheadSeconds?: number;
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

  private readonly audioEngine: TempoKeeperAudioEngine;
  private readonly lookaheadMilliseconds: number;
  private readonly scheduleAheadSeconds: number;
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
    this.audioEngine = options.audioEngine;
    this.lookaheadMilliseconds =
      options.lookaheadMilliseconds ?? LOOKAHEAD_MILLISECONDS;
    this.scheduleAheadSeconds =
      options.scheduleAheadSeconds ?? SCHEDULE_AHEAD_SECONDS;
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
    if (this.getIsRunning()) {
      return true;
    }

    const audioContext = await this.audioEngine.prepare();
    if (!audioContext) {
      return false;
    }

    this.currentBeatIndex = DOWNBEAT_INDEX;
    this.nextBeatTimeSeconds = audioContext.currentTime;
    this.schedulerIntervalId = setInterval(
      this.schedulePendingBeats,
      this.lookaheadMilliseconds,
    );

    return true;
  }

  public stop() {
    if (this.schedulerIntervalId) {
      clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }

    this.audioEngine.stop();
    this.currentBeatIndex = DOWNBEAT_INDEX;
  }

  public dispose() {
    this.stop();
  }

  private readonly schedulePendingBeats = () => {
    const audioContext = this.audioEngine.getAudioContext();
    if (!audioContext) {
      return;
    }

    while (
      this.nextBeatTimeSeconds <
      audioContext.currentTime + this.scheduleAheadSeconds
    ) {
      const beatIndexToSchedule = this.currentBeatIndex;

      this.audioEngine.scheduleClickSound(
        this.nextBeatTimeSeconds,
        beatIndexToSchedule,
      );
      this.onBeatScheduled?.(
        beatIndexToSchedule,
        this.nextBeatTimeSeconds,
        resolveTargetPerformanceTimeMilliseconds(
          audioContext,
          this.nextBeatTimeSeconds,
        ),
      );

      const secondsPerBeat = 60 / this.tempoBpm;
      this.nextBeatTimeSeconds += secondsPerBeat;
      this.currentBeatIndex = (beatIndexToSchedule + 1) % this.beatsPerBar;
    }
  };
}
