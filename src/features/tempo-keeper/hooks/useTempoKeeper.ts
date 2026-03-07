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

export const useTempoKeeper = () => {
  const [tempoBpm, setTempoBpmState] = useState(DEFAULT_BPM);
  const [beatsPerBar, setBeatsPerBar] = useState(DEFAULT_BEATS_PER_BAR);
  const [isPlaybackRunning, setIsPlaybackRunning] = useState(false);
  const [activeBeatIndex, setActiveBeatIndex] = useState(DOWNBEAT_INDEX);

  const audioEngineRef = useRef<TempoKeeperAudioEngine | null>(null);

  useEffect(() => {
    const audioEngine = new TempoKeeperAudioEngine({
      onBeatScheduled: (scheduledBeatIndex) => {
        setActiveBeatIndex(scheduledBeatIndex);
      },
    });
    audioEngineRef.current = audioEngine;

    return () => {
      void audioEngine.dispose();
      audioEngineRef.current = null;
    };
  }, []);

  const setTempoBpm = useCallback((candidateTempoBpm: number) => {
    const clampedTempoBpm = Math.min(
      MAX_BPM,
      Math.max(MIN_BPM, candidateTempoBpm),
    );
    if (Number.isNaN(clampedTempoBpm)) {
      return;
    }
    setTempoBpmState(clampedTempoBpm);
    audioEngineRef.current?.setTempoBpm(clampedTempoBpm);
  }, []);

  const setBeatsPerBarCount = useCallback((candidateBeatsPerBar: number) => {
    if (
      !Number.isInteger(candidateBeatsPerBar) ||
      candidateBeatsPerBar < MIN_BEATS_PER_BAR
    ) {
      return;
    }
    setBeatsPerBar(candidateBeatsPerBar);
    setActiveBeatIndex(DOWNBEAT_INDEX);
    audioEngineRef.current?.setBeatsPerBar(candidateBeatsPerBar);
  }, []);

  const startPlayback = useCallback(async () => {
    if (isPlaybackRunning) {
      return;
    }
    const didStartPlayback = await audioEngineRef.current?.start();
    if (!didStartPlayback) {
      return;
    }
    setIsPlaybackRunning(true);
    setActiveBeatIndex(DOWNBEAT_INDEX);
  }, [isPlaybackRunning]);

  const stopPlayback = useCallback(() => {
    audioEngineRef.current?.stop();
    setIsPlaybackRunning(false);
    setActiveBeatIndex(DOWNBEAT_INDEX);
  }, []);

  const togglePlayback = useCallback(() => {
    if (isPlaybackRunning) {
      stopPlayback();
      return;
    }
    void startPlayback();
  }, [isPlaybackRunning, startPlayback, stopPlayback]);

  useEffect(() => {
    audioEngineRef.current?.setTempoBpm(tempoBpm);
  }, [tempoBpm]);

  useEffect(() => {
    audioEngineRef.current?.setBeatsPerBar(beatsPerBar);
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
