type TempoKeeperVisualSchedulerOptions = {
  onBeatActivated: (beatIndex: number) => void;
};

const FRAME_ALIGNMENT_OFFSET_MILLISECONDS = 8;

export class TempoKeeperVisualScheduler {
  private scheduledBeatTimeoutIds = new Set<number>();
  private scheduledBeatAnimationFrameIds = new Set<number>();

  private readonly onBeatActivated: (beatIndex: number) => void;

  constructor(options: TempoKeeperVisualSchedulerOptions) {
    this.onBeatActivated = options.onBeatActivated;
  }

  public scheduleBeat(
    beatIndex: number,
    targetPerformanceTimeMilliseconds: number,
  ) {
    let animationFrameId = 0;
    let timeoutId = 0;

    const activateBeatIndicator = () => {
      this.scheduledBeatTimeoutIds.delete(timeoutId);
      this.scheduledBeatAnimationFrameIds.delete(animationFrameId);
      this.onBeatActivated(beatIndex);
    };

    const runAtTargetFrame = () => {
      const frameCheck = () => {
        if (performance.now() >= targetPerformanceTimeMilliseconds) {
          activateBeatIndicator();
          return;
        }

        this.scheduledBeatAnimationFrameIds.delete(animationFrameId);
        animationFrameId = window.requestAnimationFrame(frameCheck);
        this.scheduledBeatAnimationFrameIds.add(animationFrameId);
      };

      animationFrameId = window.requestAnimationFrame(frameCheck);
      this.scheduledBeatAnimationFrameIds.add(animationFrameId);
    };

    const delayMilliseconds = Math.max(
      0,
      targetPerformanceTimeMilliseconds -
        performance.now() -
        FRAME_ALIGNMENT_OFFSET_MILLISECONDS,
    );
    timeoutId = window.setTimeout(() => {
      this.scheduledBeatTimeoutIds.delete(timeoutId);
      runAtTargetFrame();
    }, delayMilliseconds);
    this.scheduledBeatTimeoutIds.add(timeoutId);
  }

  public clear() {
    for (const timeoutId of this.scheduledBeatTimeoutIds) {
      window.clearTimeout(timeoutId);
    }
    this.scheduledBeatTimeoutIds.clear();

    for (const animationFrameId of this.scheduledBeatAnimationFrameIds) {
      window.cancelAnimationFrame(animationFrameId);
    }
    this.scheduledBeatAnimationFrameIds.clear();
  }
}
