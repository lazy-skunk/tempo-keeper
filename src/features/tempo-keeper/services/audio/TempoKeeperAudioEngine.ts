import { DOWNBEAT_INDEX } from "@/features/tempo-keeper/constants";

const CLICK_FREQUENCY_HZ = 1000;
const DOWNBEAT_CLICK_ATTACK_GAIN = 1.0;
const REGULAR_CLICK_ATTACK_GAIN = 0.5;
const CLICK_SILENT_GAIN = 0.0001;
const CLICK_ATTACK_SECONDS = 0.001;
const CLICK_DECAY_SECONDS = 0.05;
const CLICK_STOP_BUFFER_SECONDS = 0.01;
const CLICK_DURATION_SECONDS =
  CLICK_ATTACK_SECONDS + CLICK_DECAY_SECONDS + CLICK_STOP_BUFFER_SECONDS;

const resolveAudioContextConstructor = () => {
  return (
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
};

export class TempoKeeperAudioEngine {
  private audioContext: AudioContext | null = null;
  private scheduledOscillators = new Set<OscillatorNode>();

  public stop() {
    this.stopScheduledOscillators();
  }

  public async dispose() {
    this.stop();
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }

  public getAudioContext() {
    return this.audioContext;
  }

  public async prepare() {
    if (this.audioContext) {
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
      return this.audioContext;
    }

    const AudioContextConstructor = resolveAudioContextConstructor();
    if (!AudioContextConstructor) {
      return null;
    }

    this.audioContext = new AudioContextConstructor();
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  public scheduleClickSound(playbackTimeSeconds: number, beatIndex: number) {
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
      playbackTimeSeconds + CLICK_ATTACK_SECONDS + CLICK_DECAY_SECONDS,
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
            "TempoKeeperAudioEngine: oscillator stop skipped (already ended or not stoppable).",
            error,
          );
        }
      }
    }
  }
}
