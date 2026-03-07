"use client";

import { useEffect, useState } from "react";
import {
  BEATS_PER_BAR_OPTIONS,
  DOWNBEAT_INDEX,
  MAX_BPM,
  MIN_BPM,
} from "../constants";
import { useMetronome } from "../hooks/useMetronome";

const TEMPO_COLOR_MIN_BPM = 60;
const TEMPO_COLOR_MAX_BPM = 210;
const HSL_RED_HUE = 0;
const HSL_GREEN_HUE = 120;

export default function Metronome() {
  const {
    tempoBpm,
    beatsPerBar,
    isPlaybackRunning,
    activeBeatIndex,
    setTempoBpm,
    setBeatsPerBar,
    togglePlayback,
  } = useMetronome();
  const [tempoInputValue, setTempoInputValue] = useState(String(tempoBpm));

  useEffect(() => {
    setTempoInputValue(String(tempoBpm));
  }, [tempoBpm]);

  const commitTempoInputValue = () => {
    if (tempoInputValue === "") {
      setTempoInputValue(String(tempoBpm));
      return;
    }

    const candidateTempoBpm = Number(tempoInputValue);
    if (Number.isNaN(candidateTempoBpm)) {
      setTempoInputValue(String(tempoBpm));
      return;
    }

    const clampedTempoBpm = Math.min(
      MAX_BPM,
      Math.max(MIN_BPM, candidateTempoBpm),
    );
    setTempoBpm(clampedTempoBpm);
    setTempoInputValue(String(clampedTempoBpm));
  };

  const tempoProgress = Math.min(
    Math.max(
      (tempoBpm - TEMPO_COLOR_MIN_BPM) /
        (TEMPO_COLOR_MAX_BPM - TEMPO_COLOR_MIN_BPM),
      0,
    ),
    1,
  );
  const tempoHue =
    HSL_GREEN_HUE - (HSL_GREEN_HUE - HSL_RED_HUE) * tempoProgress;
  const tempoSliderAccentColor = `hsl(${tempoHue} 75% 50%)`;

  const beatIndicators = Array.from({ length: beatsPerBar }, (_, index) => {
    const isActive = isPlaybackRunning && activeBeatIndex === index;
    const isDownbeat = index === DOWNBEAT_INDEX;

    return (
      <div
        key={index}
        className={`h-10 w-10 rounded-full ${
          isActive
            ? isDownbeat
              ? "bg-red-500"
              : "bg-green-500"
            : "bg-gray-500"
        }`}
      />
    );
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center mx-9">
      <h1 className="mb-3 text-center text-3xl font-bold">Metronome</h1>

      <div className="flex w-full flex-col rounded border p-6">
        <div className="flex flex-col items-center justify-center gap-3">
          <label className="flex items-center justify-center gap-3">
            <input
              type="number"
              min={MIN_BPM}
              max={MAX_BPM}
              value={tempoInputValue}
              onChange={(event) => {
                const nextValue = event.target.value;
                setTempoInputValue(nextValue);
                if (nextValue === "") {
                  return;
                }

                const candidateTempoBpm = Number(nextValue);
                if (Number.isNaN(candidateTempoBpm)) {
                  return;
                }

                if (
                  candidateTempoBpm < MIN_BPM ||
                  candidateTempoBpm > MAX_BPM
                ) {
                  return;
                }

                setTempoBpm(candidateTempoBpm);
              }}
              onBlur={commitTempoInputValue}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              className="rounded border text-center text-3xl font-bold"
            />
            <span>BPM</span>
          </label>

          <input
            type="range"
            min={MIN_BPM}
            max={MAX_BPM}
            value={tempoBpm}
            onChange={(event) => setTempoBpm(Number(event.target.value))}
            className="mb-3 w-full"
            style={{ accentColor: tempoSliderAccentColor }}
          />

          <label className="flex items-center justify-center gap-3">
            <select
              value={beatsPerBar}
              onChange={(event) => setBeatsPerBar(Number(event.target.value))}
              className="rounded border bg-background px-6 text-3xl font-bold text-foreground"
            >
              {BEATS_PER_BAR_OPTIONS.map((value) => (
                <option
                  key={value}
                  value={value}
                  className="bg-background text-foreground"
                >
                  {value}
                </option>
              ))}
            </select>
            <span>Beats / Bar</span>
          </label>

          <div className="mb-3 flex items-center justify-center gap-6">
            {beatIndicators}
          </div>

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={togglePlayback}
              className={`rounded-full border px-4.5 py-1 text-xl ${
                isPlaybackRunning
                  ? "border-red-500 text-red-500"
                  : "border-green-500 text-green-500"
              }`}
            >
              {isPlaybackRunning ? "Stop" : "Start"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
