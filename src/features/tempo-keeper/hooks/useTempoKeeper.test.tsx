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
  public readonly start = jest.fn(async () => true);
  public readonly stop = jest.fn();
  public readonly dispose = jest.fn();
  public readonly setTempoBpm = jest.fn();
  public readonly setBeatsPerBar = jest.fn();

  public constructor(public readonly options: SchedulerOptions) {
    schedulerInstances.push(this);
  }
}

class MockAudioEngine {
  public readonly prepare = jest.fn(async () => sharedAudioContext);
  public readonly getAudioContext = jest.fn(() => sharedAudioContext);
  public readonly stop = jest.fn();
  public readonly dispose = jest.fn(async () => {});
  public readonly scheduleClickSound = jest.fn();

  public constructor() {
    audioEngineInstances.push(this);
  }
}

class MockVisualScheduler {
  public readonly scheduleBeat = jest.fn();
  public readonly clear = jest.fn();

  public constructor() {
    visualSchedulerInstances.push(this);
  }
}

jest.mock(
  "@/features/tempo-keeper/services/schedulers/TempoKeeperBeatScheduler",
  () => {
    const actual = jest.requireActual(
      "@/features/tempo-keeper/services/schedulers/TempoKeeperBeatScheduler",
    ) as typeof import("@/features/tempo-keeper/services/schedulers/TempoKeeperBeatScheduler");

    return {
      ...actual,
      TempoKeeperBeatScheduler: MockScheduler,
    };
  },
);

jest.mock(
  "@/features/tempo-keeper/services/audio/TempoKeeperAudioEngine",
  () => ({
    TempoKeeperAudioEngine: MockAudioEngine,
  }),
);

jest.mock(
  "@/features/tempo-keeper/services/schedulers/TempoKeeperVisualScheduler",
  () => ({
    TempoKeeperVisualScheduler: MockVisualScheduler,
  }),
);

let useTempoKeeper: typeof import("@/features/tempo-keeper/hooks/useTempoKeeper").useTempoKeeper;

type HookResult = ReturnType<
  typeof import("@/features/tempo-keeper/hooks/useTempoKeeper").useTempoKeeper
>;

describe("useTempoKeeper", () => {
  let container: HTMLDivElement;
  let root: Root;
  let hookResult!: HookResult;

  beforeAll(async () => {
    ({ useTempoKeeper } =
      await import("@/features/tempo-keeper/hooks/useTempoKeeper"));
  });

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    schedulerInstances.length = 0;
    audioEngineInstances.length = 0;
    visualSchedulerInstances.length = 0;
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    jest.clearAllMocks();
    jest.restoreAllMocks();
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
    const scheduler = schedulerInstances[0];
    const audioEngine = audioEngineInstances[0];

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
    const scheduler = schedulerInstances[0];
    const audioEngine = audioEngineInstances[0];
    const visualScheduler = visualSchedulerInstances[0];

    act(() => {
      scheduler.options.onBeatScheduled?.(2, 101.5, 101_500);
    });

    expect(audioEngine.scheduleClickSound).toHaveBeenCalledWith(101.5, 2);
    expect(visualScheduler.scheduleBeat).toHaveBeenCalledWith(2, 101_500);
  });

  it("shows an error when the active clock becomes unavailable", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await renderHookHarness();
    const scheduler = schedulerInstances[0];
    const audioEngine = audioEngineInstances[0];
    const visualScheduler = visualSchedulerInstances[0];

    act(() => {
      scheduler.options.onClockUnavailable?.();
    });

    expect(audioEngine.stop).toHaveBeenCalledTimes(1);
    expect(visualScheduler.clear).toHaveBeenCalledTimes(1);
    expect(hookResult.errorMessage).toBe(
      "Playback stopped unexpectedly. Please start again.",
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "useTempoKeeper: active clock became unavailable, playback stopped.",
    );
  });

  it("clears the error when playback is stopped manually", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await renderHookHarness();
    const scheduler = schedulerInstances[0];

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
    expect(warnSpy).toHaveBeenCalledWith(
      "useTempoKeeper: active clock became unavailable, playback stopped.",
    );
  });
});
