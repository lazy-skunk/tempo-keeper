import {
  CLICK_FREQUENCY_HZ,
  DOWNBEAT_CLICK_ATTACK_GAIN,
  CLICK_ATTACK_SECONDS,
  CLICK_DECAY_SECONDS,
  CLICK_DURATION_SECONDS,
  CLICK_SILENT_GAIN,
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_BPM,
  DOWNBEAT_INDEX,
  LOOKAHEAD_MILLISECONDS,
  REGULAR_CLICK_ATTACK_GAIN,
  SCHEDULE_AHEAD_SECONDS,
  SECONDS_PER_MINUTE,
} from "../constants";

type MetronomeAudioEngineOptions = {
  lookaheadMilliseconds?: number;
  scheduleAheadSeconds?: number;
  onBeatScheduled?: (beatIndex: number) => void;
};

const resolveAudioContextConstructor = () => {
  return (
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
};

export class MetronomeAudioEngine {
  private audioContext: AudioContext | null = null;
  private schedulerIntervalId: ReturnType<typeof setInterval> | null = null;
  private scheduledOscillators = new Set<OscillatorNode>();

  private readonly lookaheadMilliseconds: number;
  private readonly scheduleAheadSeconds: number;
  private readonly onBeatScheduled?: (beatIndex: number) => void;

  private tempoBpm = DEFAULT_BPM;
  private beatsPerBar = DEFAULT_BEATS_PER_BAR;
  private currentBeatIndex = DOWNBEAT_INDEX;
  private nextBeatTimeSeconds = 0;

  constructor(options: MetronomeAudioEngineOptions = {}) {
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

    const audioContext = await this.getOrCreateAudioContext();
    if (!audioContext) {
      return false;
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
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
    this.stopScheduledOscillators();
    this.currentBeatIndex = DOWNBEAT_INDEX;
  }

  public async dispose() {
    this.stop();
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  private async getOrCreateAudioContext() {
    if (this.audioContext) {
      return this.audioContext;
    }

    const AudioContextConstructor = resolveAudioContextConstructor();
    if (!AudioContextConstructor) {
      return null;
    }

    this.audioContext = new AudioContextConstructor();
    return this.audioContext;
  }

  private readonly schedulePendingBeats = () => {
    if (!this.audioContext) {
      return;
    }

    while (
      this.nextBeatTimeSeconds <
      this.audioContext.currentTime + this.scheduleAheadSeconds
    ) {
      const beatIndexToSchedule = this.currentBeatIndex;
      this.scheduleClickSound(this.nextBeatTimeSeconds, beatIndexToSchedule);
      this.onBeatScheduled?.(beatIndexToSchedule);

      const secondsPerBeat = SECONDS_PER_MINUTE / this.tempoBpm;
      this.nextBeatTimeSeconds += secondsPerBeat;
      this.currentBeatIndex = (beatIndexToSchedule + 1) % this.beatsPerBar;
    }
  };

  private scheduleClickSound(playbackTimeSeconds: number, beatIndex: number) {
    if (!this.audioContext) {
      return;
    }

    const isDownbeat = beatIndex === DOWNBEAT_INDEX;
    const attackGain = isDownbeat
      ? DOWNBEAT_CLICK_ATTACK_GAIN
      : REGULAR_CLICK_ATTACK_GAIN;
    const oscillatorNode = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillatorNode.type = "triangle";
    oscillatorNode.frequency.setValueAtTime(
      CLICK_FREQUENCY_HZ,
      playbackTimeSeconds,
    );

    gainNode.gain.setValueAtTime(CLICK_SILENT_GAIN, playbackTimeSeconds);
    gainNode.gain.exponentialRampToValueAtTime(
      attackGain,
      playbackTimeSeconds + CLICK_ATTACK_SECONDS,
    );
    gainNode.gain.exponentialRampToValueAtTime(
      CLICK_SILENT_GAIN,
      playbackTimeSeconds + CLICK_DECAY_SECONDS,
    );

    oscillatorNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    this.scheduledOscillators.add(oscillatorNode);
    oscillatorNode.onended = () => {
      this.scheduledOscillators.delete(oscillatorNode);
      oscillatorNode.disconnect();
      gainNode.disconnect();
    };
    oscillatorNode.start(playbackTimeSeconds);
    oscillatorNode.stop(playbackTimeSeconds + CLICK_DURATION_SECONDS);
  }

  private stopScheduledOscillators() {
    if (!this.audioContext || this.scheduledOscillators.size === 0) {
      return;
    }

    const stopTimeSeconds = this.audioContext.currentTime;
    for (const oscillatorNode of this.scheduledOscillators) {
      try {
        oscillatorNode.stop(stopTimeSeconds);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.debug(
            "MetronomeAudioEngine: oscillator stop skipped (already ended or not stoppable).",
            error,
          );
        }
      }
    }
  }
}
