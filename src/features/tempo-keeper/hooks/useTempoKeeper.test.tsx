// @vitest-environment jsdom

import {
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_BPM,
  DOWNBEAT_INDEX,
  MAX_BPM,
} from "@/features/tempo-keeper/constants";
import type { TempoKeeperBeatSchedulerClock } from "@/features/tempo-keeper/services/schedulers/TempoKeeperBeatScheduler";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

type SchedulerOptions = {
  clock: TempoKeeperBeatSchedulerClock;
  onClockUnavailable?: () => void;
  onBeatScheduled?: (
    beatIndex: number,
    playbackTimeSeconds: number,
    targetPerformanceTimeMilliseconds: number,
  ) => void;
};

const testDoubles = vi.hoisted(() => {
  const schedulerInstances: MockScheduler[] = [];
  const audioEngineInstances: MockAudioEngine[] = [];
  const visualSchedulerInstances: MockVisualScheduler[] = [];
  const sharedAudioContext = {
    currentTime: 100,
    getOutputTimestamp: () => ({
      contextTime: 100,
      performanceTime: 100_000,
    }),
  };

  class MockScheduler {
    public readonly start = vi.fn(async () => true);
    public readonly stop = vi.fn();
    public readonly dispose = vi.fn();
    public readonly setTempoBpm = vi.fn();
    public readonly setBeatsPerBar = vi.fn();

    public constructor(public readonly options: SchedulerOptions) {
      schedulerInstances.push(this);
    }
  }

  class MockAudioEngine {
    public readonly prepare = vi.fn(async () => sharedAudioContext);
    public readonly getAudioContext = vi.fn(() => sharedAudioContext);
    public readonly stop = vi.fn();
    public readonly dispose = vi.fn(async () => {});
    public readonly scheduleClickSound = vi.fn();

    public constructor() {
      audioEngineInstances.push(this);
    }
  }

  class MockVisualScheduler {
    public readonly scheduleBeat = vi.fn();
    public readonly clear = vi.fn();

    public constructor() {
      visualSchedulerInstances.push(this);
    }
  }

  return {
    schedulerInstances,
    audioEngineInstances,
    visualSchedulerInstances,
    sharedAudioContext,
    MockScheduler,
    MockAudioEngine,
    MockVisualScheduler,
  };
});

vi.mock(
  "@/features/tempo-keeper/services/schedulers/TempoKeeperBeatScheduler",
  async () => {
    const actual = await vi.importActual<
      typeof import("@/features/tempo-keeper/services/schedulers/TempoKeeperBeatScheduler")
    >("@/features/tempo-keeper/services/schedulers/TempoKeeperBeatScheduler");

    return {
      ...actual,
      TempoKeeperBeatScheduler: testDoubles.MockScheduler,
    };
  },
);

vi.mock(
  "@/features/tempo-keeper/services/audio/TempoKeeperAudioEngine",
  () => ({
    TempoKeeperAudioEngine: testDoubles.MockAudioEngine,
  }),
);

vi.mock(
  "@/features/tempo-keeper/services/schedulers/TempoKeeperVisualScheduler",
  () => ({
    TempoKeeperVisualScheduler: testDoubles.MockVisualScheduler,
  }),
);

import { useTempoKeeper } from "@/features/tempo-keeper/hooks/useTempoKeeper";

type HookResult = ReturnType<typeof useTempoKeeper>;

describe("useTempoKeeper", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hookResult!: HookResult;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    testDoubles.schedulerInstances.length = 0;
    testDoubles.audioEngineInstances.length = 0;
    testDoubles.visualSchedulerInstances.length = 0;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  const renderHookHarness = async () => {
    function Harness({ onValue }: { onValue: (value: HookResult) => void }) {
      const value = useTempoKeeper();

      React.useEffect(() => {
        onValue(value);
      }, [onValue, value]);

      return null;
    }

    await act(async () => {
      root.render(
        React.createElement(Harness, {
          onValue: (value) => {
            hookResult = value;
          },
        }),
      );
    });
  };

  it("exposes the idle state by default", async () => {
    await renderHookHarness();

    expect(hookResult.playbackState).toEqual({
      tempoBpm: DEFAULT_BPM,
      beatsPerBar: DEFAULT_BEATS_PER_BAR,
      isPlaybackRunning: false,
      activeBeatIndex: DOWNBEAT_INDEX,
    });
    expect(hookResult.tempoInputValue).toBe(String(DEFAULT_BPM));
    expect(hookResult.canStart).toBe(true);
    expect(hookResult.canStop).toBe(false);
  });

  it("delegates start, stop, and parameter updates", async () => {
    await renderHookHarness();
    const scheduler = testDoubles.schedulerInstances[0];
    const audioEngine = testDoubles.audioEngineInstances[0];

    scheduler.setTempoBpm.mockClear();
    scheduler.setBeatsPerBar.mockClear();

    await act(async () => {
      await expect(hookResult.startPlayback()).resolves.toBe(true);
    });
    act(() => {
      hookResult.setTempoBpm(144);
      hookResult.setBeatsPerBar(3);
      hookResult.stopPlayback();
    });

    expect(scheduler.start).toHaveBeenCalledTimes(1);
    expect(scheduler.setTempoBpm).toHaveBeenCalledWith(144);
    expect(scheduler.setBeatsPerBar).toHaveBeenCalledWith(3);
    expect(scheduler.stop).toHaveBeenCalledTimes(1);
    expect(audioEngine.stop).toHaveBeenCalledTimes(1);
    expect(hookResult.playbackState).toEqual({
      tempoBpm: 144,
      beatsPerBar: 3,
      isPlaybackRunning: false,
      activeBeatIndex: DOWNBEAT_INDEX,
    });
  });

  it("updates playback running state from hook-controlled start and stop", async () => {
    await renderHookHarness();

    await act(async () => {
      await expect(hookResult.startPlayback()).resolves.toBe(true);
    });

    expect(hookResult.playbackState.isPlaybackRunning).toBe(true);
    expect(hookResult.canStart).toBe(false);
    expect(hookResult.canStop).toBe(true);

    act(() => {
      hookResult.stopPlayback();
    });

    expect(hookResult.playbackState.isPlaybackRunning).toBe(false);
    expect(hookResult.canStart).toBe(true);
    expect(hookResult.canStop).toBe(false);
  });

  it("clamps tempo updates to the supported range", async () => {
    await renderHookHarness();

    act(() => {
      hookResult.setTempoBpm(240);
    });

    expect(hookResult.playbackState.tempoBpm).toBe(240);

    act(() => {
      hookResult.setTempoBpm(999);
    });

    expect(hookResult.playbackState.tempoBpm).toBe(MAX_BPM);
  });

  it("preserves under-min input until the user commits it", async () => {
    await renderHookHarness();

    act(() => {
      hookResult.setTempoInputValue("2");
    });

    expect(hookResult.tempoInputValue).toBe("2");
    expect(hookResult.playbackState.tempoBpm).toBe(DEFAULT_BPM);

    act(() => {
      hookResult.commitTempoInput();
    });

    expect(hookResult.tempoInputValue).toBe("30");
    expect(hookResult.playbackState.tempoBpm).toBe(30);
  });

  it("schedules audio and visual updates for scheduled beats", async () => {
    await renderHookHarness();
    const scheduler = testDoubles.schedulerInstances[0];
    const audioEngine = testDoubles.audioEngineInstances[0];
    const visualScheduler = testDoubles.visualSchedulerInstances[0];

    act(() => {
      scheduler.options.onBeatScheduled?.(2, 101.5, 101_500);
    });

    expect(audioEngine.scheduleClickSound).toHaveBeenCalledWith(101.5, 2);
    expect(visualScheduler.scheduleBeat).toHaveBeenCalledWith(2, 101_500);
  });

  it("shows an error when the active clock becomes unavailable", async () => {
    await renderHookHarness();
    const scheduler = testDoubles.schedulerInstances[0];
    const audioEngine = testDoubles.audioEngineInstances[0];
    const visualScheduler = testDoubles.visualSchedulerInstances[0];

    act(() => {
      scheduler.options.onClockUnavailable?.();
    });

    expect(audioEngine.stop).toHaveBeenCalledTimes(1);
    expect(visualScheduler.clear).toHaveBeenCalledTimes(1);
    expect(hookResult.errorMessage).toBe(
      "Playback stopped unexpectedly. Please start again.",
    );
  });

  it("clears the error when playback is stopped manually", async () => {
    await renderHookHarness();
    const scheduler = testDoubles.schedulerInstances[0];

    act(() => {
      scheduler.options.onClockUnavailable?.();
    });

    expect(hookResult.errorMessage).toBe(
      "Playback stopped unexpectedly. Please start again.",
    );

    act(() => {
      hookResult.stopPlayback();
    });

    expect(hookResult.errorMessage).toBeNull();
  });
});
