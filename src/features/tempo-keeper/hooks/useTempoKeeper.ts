import {
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_BPM,
  DOWNBEAT_INDEX,
  MAX_BPM,
  MIN_BEATS_PER_BAR,
  MIN_BPM,
} from "@/features/tempo-keeper/constants";
import { resolveTargetPerformanceTimeMilliseconds } from "@/features/tempo-keeper/services/audio/resolveTargetPerformanceTimeMilliseconds";
import { TempoKeeperAudioEngine } from "@/features/tempo-keeper/services/audio/TempoKeeperAudioEngine";
import { TempoKeeperBeatScheduler } from "@/features/tempo-keeper/services/schedulers/TempoKeeperBeatScheduler";
import { TempoKeeperVisualScheduler } from "@/features/tempo-keeper/services/schedulers/TempoKeeperVisualScheduler";
import { useCallback, useEffect, useRef, useState } from "react";

export type TempoKeeperPlaybackState = {
  tempoBpm: number;
  beatsPerBar: number;
  isPlaybackRunning: boolean;
  activeBeatIndex: number;
};

type PreparedClock = {
  currentTimeSeconds: number;
  getCurrentTimeSeconds: () => number | null;
  getTargetPerformanceTimeMilliseconds: (
    playbackTimeSeconds: number,
  ) => number | null;
};

export const useTempoKeeper = () => {
  const [playbackState, setPlaybackState] = useState<TempoKeeperPlaybackState>({
    tempoBpm: DEFAULT_BPM,
    beatsPerBar: DEFAULT_BEATS_PER_BAR,
    isPlaybackRunning: false,
    activeBeatIndex: DOWNBEAT_INDEX,
  });
  const [tempoInputValue, setTempoInputValue] = useState(String(DEFAULT_BPM));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioEngineRef = useRef<TempoKeeperAudioEngine | null>(null);
  const beatSchedulerRef = useRef<TempoKeeperBeatScheduler | null>(null);
  const visualSchedulerRef = useRef<TempoKeeperVisualScheduler | null>(null);
  const activeClockRef = useRef<PreparedClock | null>(null);

  const clearScheduledBeatUpdates = useCallback(() => {
    visualSchedulerRef.current?.clear();
  }, []);

  const prepareClock = useCallback(async () => {
    const audioContext = await audioEngineRef.current?.prepare();
    if (!audioContext) {
      return null;
    }

    const audioClock: PreparedClock = {
      currentTimeSeconds: audioContext.currentTime,
      getCurrentTimeSeconds: () => {
        const currentAudioContext = audioEngineRef.current?.getAudioContext();
        if (!currentAudioContext || currentAudioContext !== audioContext) {
          return null;
        }

        return currentAudioContext.currentTime;
      },
      getTargetPerformanceTimeMilliseconds: (playbackTimeSeconds: number) => {
        const currentAudioContext = audioEngineRef.current?.getAudioContext();
        if (!currentAudioContext || currentAudioContext !== audioContext) {
          return null;
        }

        return resolveTargetPerformanceTimeMilliseconds(
          currentAudioContext,
          playbackTimeSeconds,
        );
      },
    };
    activeClockRef.current = audioClock;
    return audioClock.currentTimeSeconds;
  }, []);

  const getCurrentTimeSeconds = useCallback(() => {
    return activeClockRef.current?.getCurrentTimeSeconds() ?? null;
  }, []);

  const getTargetPerformanceTimeMilliseconds = useCallback(
    (playbackTimeSeconds: number) => {
      return (
        activeClockRef.current?.getTargetPerformanceTimeMilliseconds(
          playbackTimeSeconds,
        ) ?? null
      );
    },
    [],
  );

  useEffect(() => {
    const audioEngine = new TempoKeeperAudioEngine();
    const visualScheduler = new TempoKeeperVisualScheduler({
      onBeatActivated: (beatIndex) => {
        setPlaybackState((previousState) => ({
          ...previousState,
          activeBeatIndex: beatIndex,
        }));
      },
    });
    const beatScheduler = new TempoKeeperBeatScheduler({
      clock: {
        prepare: prepareClock,
        getCurrentTimeSeconds,
        getTargetPerformanceTimeMilliseconds,
      },
      onClockUnavailable: () => {
        activeClockRef.current = null;
        audioEngine.stop();
        clearScheduledBeatUpdates();
        setPlaybackState((previousState) => ({
          ...previousState,
          activeBeatIndex: DOWNBEAT_INDEX,
          isPlaybackRunning: false,
        }));
        setErrorMessage("Playback stopped unexpectedly. Please start again.");
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "useTempoKeeper: active clock became unavailable, playback stopped.",
          );
        }
      },
      onBeatScheduled: (
        scheduledBeatIndex,
        playbackTimeSeconds,
        targetPerformanceTimeMilliseconds,
      ) => {
        audioEngine.scheduleClickSound(playbackTimeSeconds, scheduledBeatIndex);
        visualScheduler.scheduleBeat(
          scheduledBeatIndex,
          targetPerformanceTimeMilliseconds,
        );
      },
    });
    audioEngineRef.current = audioEngine;
    beatSchedulerRef.current = beatScheduler;
    visualSchedulerRef.current = visualScheduler;

    return () => {
      clearScheduledBeatUpdates();
      beatScheduler.dispose();
      beatSchedulerRef.current = null;
      visualSchedulerRef.current = null;
      activeClockRef.current = null;
      void audioEngine.dispose();
      audioEngineRef.current = null;
    };
  }, [
    clearScheduledBeatUpdates,
    getCurrentTimeSeconds,
    getTargetPerformanceTimeMilliseconds,
    prepareClock,
  ]);

  const setTempoBpm = useCallback(
    (candidateTempoBpm: number, options?: { syncInputValue?: boolean }) => {
      const clampedTempoBpm = Math.min(
        MAX_BPM,
        Math.max(MIN_BPM, candidateTempoBpm),
      );
      if (Number.isNaN(clampedTempoBpm)) {
        return;
      }
      setPlaybackState((previousState) => ({
        ...previousState,
        tempoBpm: clampedTempoBpm,
      }));
      if (options?.syncInputValue !== false) {
        setTempoInputValue(String(clampedTempoBpm));
      }
      beatSchedulerRef.current?.setTempoBpm(clampedTempoBpm);
    },
    [],
  );

  const setBeatsPerBarCount = useCallback(
    (candidateBeatsPerBar: number) => {
      if (
        !Number.isInteger(candidateBeatsPerBar) ||
        candidateBeatsPerBar < MIN_BEATS_PER_BAR
      ) {
        return;
      }
      clearScheduledBeatUpdates();
      setPlaybackState((previousState) => ({
        ...previousState,
        beatsPerBar: candidateBeatsPerBar,
        activeBeatIndex: DOWNBEAT_INDEX,
      }));
      beatSchedulerRef.current?.setBeatsPerBar(candidateBeatsPerBar);
    },
    [clearScheduledBeatUpdates],
  );

  const startPlayback = useCallback(async () => {
    setErrorMessage(null);
    const didStart = await beatSchedulerRef.current?.start();
    if (!didStart) {
      setErrorMessage("Audio output is unavailable. Please try again.");
      return false;
    }
    setPlaybackState((previousState) => ({
      ...previousState,
      isPlaybackRunning: true,
      activeBeatIndex: DOWNBEAT_INDEX,
    }));
    return true;
  }, []);

  const stopPlayback = useCallback(() => {
    audioEngineRef.current?.stop();
    beatSchedulerRef.current?.stop();
    clearScheduledBeatUpdates();
    activeClockRef.current = null;
    setErrorMessage(null);
    setPlaybackState((previousState) => ({
      ...previousState,
      activeBeatIndex: DOWNBEAT_INDEX,
      isPlaybackRunning: false,
    }));
  }, [clearScheduledBeatUpdates]);

  const updateTempoInputValue = useCallback(
    (nextTempoInputValue: string) => {
      setTempoInputValue(nextTempoInputValue);
      if (nextTempoInputValue === "") {
        return;
      }

      const candidateTempoBpm = Number(nextTempoInputValue);
      if (Number.isNaN(candidateTempoBpm)) {
        return;
      }

      if (candidateTempoBpm < MIN_BPM || candidateTempoBpm > MAX_BPM) {
        return;
      }

      setTempoBpm(candidateTempoBpm, { syncInputValue: false });
    },
    [setTempoBpm],
  );

  const commitTempoInput = useCallback(() => {
    if (tempoInputValue === "") {
      setTempoInputValue(String(playbackState.tempoBpm));
      return;
    }

    const candidateTempoBpm = Number(tempoInputValue);
    if (Number.isNaN(candidateTempoBpm)) {
      setTempoInputValue(String(playbackState.tempoBpm));
      return;
    }

    setTempoBpm(candidateTempoBpm);
  }, [playbackState.tempoBpm, setTempoBpm, tempoInputValue]);

  return {
    playbackState,
    tempoInputValue,
    errorMessage,
    canStart: !playbackState.isPlaybackRunning,
    canStop: playbackState.isPlaybackRunning,
    setTempoBpm,
    setTempoInputValue: updateTempoInputValue,
    setBeatsPerBar: setBeatsPerBarCount,
    commitTempoInput,
    startPlayback,
    stopPlayback,
  };
};
