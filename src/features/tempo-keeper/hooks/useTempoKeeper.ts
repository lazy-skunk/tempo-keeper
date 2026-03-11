import { useCallback, useEffect, useRef, useState } from "react";
import { TempoKeeperAudioEngine } from "../audio/TempoKeeperAudioEngine";
import {
  DEFAULT_BEATS_PER_BAR,
  DEFAULT_BPM,
  DOWNBEAT_INDEX,
  MAX_BPM,
  MIN_BEATS_PER_BAR,
  MIN_BPM,
} from "../constants";
import { TempoKeeperBeatScheduler } from "../schedulers/TempoKeeperBeatScheduler";
import { TempoKeeperVisualScheduler } from "../schedulers/TempoKeeperVisualScheduler";

export const useTempoKeeper = () => {
  const [tempoBpm, setTempoBpmState] = useState(DEFAULT_BPM);
  const [beatsPerBar, setBeatsPerBar] = useState(DEFAULT_BEATS_PER_BAR);
  const [isPlaybackRunning, setIsPlaybackRunning] = useState(false);
  const [activeBeatIndex, setActiveBeatIndex] = useState(DOWNBEAT_INDEX);

  const audioEngineRef = useRef<TempoKeeperAudioEngine | null>(null);
  const beatSchedulerRef = useRef<TempoKeeperBeatScheduler | null>(null);
  const visualSchedulerRef = useRef<TempoKeeperVisualScheduler | null>(null);

  const clearScheduledBeatUpdates = useCallback(() => {
    visualSchedulerRef.current?.clear();
  }, []);

  useEffect(() => {
    const audioEngine = new TempoKeeperAudioEngine();
    const visualScheduler = new TempoKeeperVisualScheduler({
      onBeatActivated: (beatIndex) => {
        setActiveBeatIndex(beatIndex);
      },
    });
    const beatScheduler = new TempoKeeperBeatScheduler({
      audioEngine,
      onBeatScheduled: (
        scheduledBeatIndex,
        _playbackTimeSeconds,
        targetPerformanceTimeMilliseconds,
      ) => {
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
      void audioEngine.dispose();
      audioEngineRef.current = null;
    };
  }, [clearScheduledBeatUpdates]);

  const setTempoBpm = useCallback((candidateTempoBpm: number) => {
    const clampedTempoBpm = Math.min(
      MAX_BPM,
      Math.max(MIN_BPM, candidateTempoBpm),
    );
    if (Number.isNaN(clampedTempoBpm)) {
      return;
    }
    setTempoBpmState(clampedTempoBpm);
    beatSchedulerRef.current?.setTempoBpm(clampedTempoBpm);
  }, []);

  const setBeatsPerBarCount = useCallback(
    (candidateBeatsPerBar: number) => {
      if (
        !Number.isInteger(candidateBeatsPerBar) ||
        candidateBeatsPerBar < MIN_BEATS_PER_BAR
      ) {
        return;
      }
      setBeatsPerBar(candidateBeatsPerBar);
      clearScheduledBeatUpdates();
      setActiveBeatIndex(DOWNBEAT_INDEX);
      beatSchedulerRef.current?.setBeatsPerBar(candidateBeatsPerBar);
    },
    [clearScheduledBeatUpdates],
  );

  const startPlayback = useCallback(async () => {
    if (isPlaybackRunning) {
      return;
    }
    const didStartPlayback = await beatSchedulerRef.current?.start();
    if (!didStartPlayback) {
      return;
    }
    setIsPlaybackRunning(true);
  }, [isPlaybackRunning]);

  const stopPlayback = useCallback(() => {
    beatSchedulerRef.current?.stop();
    clearScheduledBeatUpdates();
    setIsPlaybackRunning(false);
    setActiveBeatIndex(DOWNBEAT_INDEX);
  }, [clearScheduledBeatUpdates]);

  const togglePlayback = useCallback(() => {
    if (isPlaybackRunning) {
      stopPlayback();
      return;
    }
    void startPlayback();
  }, [isPlaybackRunning, startPlayback, stopPlayback]);

  useEffect(() => {
    beatSchedulerRef.current?.setTempoBpm(tempoBpm);
  }, [tempoBpm]);

  useEffect(() => {
    beatSchedulerRef.current?.setBeatsPerBar(beatsPerBar);
  }, [beatsPerBar]);

  return {
    tempoBpm,
    beatsPerBar,
    isPlaybackRunning,
    activeBeatIndex,
    setTempoBpm,
    setBeatsPerBar: setBeatsPerBarCount,
    togglePlayback,
    stopPlayback,
  };
};
