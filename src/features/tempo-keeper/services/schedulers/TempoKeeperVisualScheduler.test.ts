// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TempoKeeperVisualScheduler } from "@/features/tempo-keeper/services/schedulers/TempoKeeperVisualScheduler";

describe("TempoKeeperVisualScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(100);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("activates a beat close to the target frame", () => {
    let now = 100;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    let scheduledFrameCallback: FrameRequestCallback | null = null;
    const requestAnimationFrameMock = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        scheduledFrameCallback = callback;
        return 1;
      });
    const onBeatActivated = vi.fn();
    const scheduler = new TempoKeeperVisualScheduler({ onBeatActivated });

    scheduler.scheduleBeat(2, 110);

    now = 110;
    vi.advanceTimersByTime(10);
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
    const clearTimeoutMock = vi.spyOn(window, "clearTimeout");
    const cancelAnimationFrameMock = vi.spyOn(window, "cancelAnimationFrame");
    const requestAnimationFrameMock = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation(() => 7);
    const onBeatActivated = vi.fn();
    const scheduler = new TempoKeeperVisualScheduler({ onBeatActivated });

    scheduler.scheduleBeat(1, 120);
    scheduler.clear();

    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
    expect(clearTimeoutMock).toHaveBeenCalled();
    expect(cancelAnimationFrameMock).not.toHaveBeenCalled();
    expect(onBeatActivated).not.toHaveBeenCalled();
  });
});
