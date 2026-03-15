import { TempoKeeperBeatScheduler } from "@/features/tempo-keeper/services/schedulers/TempoKeeperBeatScheduler";

describe("TempoKeeperBeatScheduler", () => {
  let currentTimeSeconds: number;

  beforeEach(() => {
    vi.useFakeTimers();
    currentTimeSeconds = 100;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts playback and schedules beats against the provided clock", async () => {
    const onBeatScheduled = vi.fn();
    const scheduler = new TempoKeeperBeatScheduler({
      clock: {
        prepare: async () => currentTimeSeconds,
        getCurrentTimeSeconds: () => currentTimeSeconds,
        getTargetPerformanceTimeMilliseconds: (playbackTimeSeconds) =>
          playbackTimeSeconds * 1000,
      },
      onBeatScheduled,
    });

    await expect(scheduler.start()).resolves.toBe(true);

    expect(scheduler.getIsRunning()).toBe(true);
    expect(onBeatScheduled).toHaveBeenCalledWith(0, 100, 100000);

    vi.advanceTimersByTime(25);
    expect(onBeatScheduled).toHaveBeenCalledTimes(1);

    currentTimeSeconds = 100.6;
    vi.advanceTimersByTime(25);

    expect(onBeatScheduled).toHaveBeenCalledWith(1, 100.5, 100500);
  });

  it("stops playback when the active clock becomes unavailable", async () => {
    const onClockUnavailable = vi.fn();
    const scheduler = new TempoKeeperBeatScheduler({
      clock: {
        prepare: async () => currentTimeSeconds,
        getCurrentTimeSeconds: () => null,
        getTargetPerformanceTimeMilliseconds: () => 0,
      },
      onClockUnavailable,
    });

    await expect(scheduler.start()).resolves.toBe(true);

    vi.advanceTimersByTime(25);

    expect(onClockUnavailable).toHaveBeenCalledTimes(1);
    expect(scheduler.getIsRunning()).toBe(false);
  });
});
