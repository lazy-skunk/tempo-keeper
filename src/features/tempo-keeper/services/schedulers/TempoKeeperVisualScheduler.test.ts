import { TempoKeeperVisualScheduler } from "@/features/tempo-keeper/services/schedulers/TempoKeeperVisualScheduler";

describe("TempoKeeperVisualScheduler", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(performance, "now").mockReturnValue(100);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("activates a beat close to the target frame", () => {
    let now = 100;
    jest.spyOn(performance, "now").mockImplementation(() => now);
    let scheduledFrameCallback: FrameRequestCallback | null = null;
    const requestAnimationFrameMock = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        scheduledFrameCallback = callback;
        return 1;
      });
    const onBeatActivated = jest.fn();
    const scheduler = new TempoKeeperVisualScheduler({ onBeatActivated });

    scheduler.scheduleBeat(2, 110);

    now = 110;
    jest.advanceTimersByTime(10);
    expect(onBeatActivated).not.toHaveBeenCalled();
    expect(scheduledFrameCallback).not.toBeNull();

    if (!scheduledFrameCallback) {
      throw new Error(
        "Expected requestAnimationFrame callback to be scheduled",
      );
    }
    const frameCallback = scheduledFrameCallback as (
      time: DOMHighResTimeStamp,
    ) => void;
    frameCallback(now);

    expect(requestAnimationFrameMock).toHaveBeenCalled();
    expect(onBeatActivated).toHaveBeenCalledWith(2);
  });

  it("clears pending timeouts and animation frames", () => {
    const clearTimeoutMock = jest.spyOn(window, "clearTimeout");
    const cancelAnimationFrameMock = jest.spyOn(window, "cancelAnimationFrame");
    const requestAnimationFrameMock = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 7);
    const onBeatActivated = jest.fn();
    const scheduler = new TempoKeeperVisualScheduler({ onBeatActivated });

    scheduler.scheduleBeat(1, 120);
    scheduler.clear();

    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
    expect(clearTimeoutMock).toHaveBeenCalled();
    expect(cancelAnimationFrameMock).not.toHaveBeenCalled();
    expect(onBeatActivated).not.toHaveBeenCalled();
  });
});
