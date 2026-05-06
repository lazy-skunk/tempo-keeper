import TempoKeeper from "@/features/tempo-keeper/components/TempoKeeper";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const startPlayback = jest.fn(async () => true);
const stopPlayback = jest.fn();

const useTempoKeeperMock = jest.fn();

jest.mock("@/features/tempo-keeper/hooks/useTempoKeeper", () => ({
  useTempoKeeper: (...args: unknown[]) => useTempoKeeperMock(...args),
}));

describe("TempoKeeper", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    startPlayback.mockClear();
    stopPlayback.mockClear();
    useTempoKeeperMock.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the idle state with a start button", async () => {
    useTempoKeeperMock.mockReturnValue({
      playbackState: {
        tempoBpm: 120,
        beatsPerBar: 4,
        isPlaybackRunning: false,
        activeBeatIndex: 0,
      },
      tempoInputValue: "120",
      errorMessage: null,
      canStart: true,
      canStop: false,
      setTempoBpm: jest.fn(),
      setTempoInputValue: jest.fn(),
      setBeatsPerBar: jest.fn(),
      commitTempoInput: jest.fn(),
      startPlayback,
      stopPlayback,
    });

    await act(async () => {
      root.render(React.createElement(TempoKeeper));
    });

    expect(container.textContent).toContain("Tempo Keeper");
    expect(container.textContent).toContain("Start");
    expect(container.textContent).not.toContain("Stop");
  });

  it("renders the running state with an error and stop action", async () => {
    useTempoKeeperMock.mockReturnValue({
      playbackState: {
        tempoBpm: 144,
        beatsPerBar: 3,
        isPlaybackRunning: true,
        activeBeatIndex: 1,
      },
      tempoInputValue: "144",
      errorMessage: "Playback stopped unexpectedly. Please start again.",
      canStart: false,
      canStop: true,
      setTempoBpm: jest.fn(),
      setTempoInputValue: jest.fn(),
      setBeatsPerBar: jest.fn(),
      commitTempoInput: jest.fn(),
      startPlayback,
      stopPlayback,
    });

    await act(async () => {
      root.render(React.createElement(TempoKeeper));
    });

    expect(container.textContent).toContain("Playback stopped unexpectedly");
    expect(container.textContent).toContain("Stop");

    const stopButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Stop",
    );

    act(() => {
      stopButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(stopPlayback).toHaveBeenCalledTimes(1);
  });
});
