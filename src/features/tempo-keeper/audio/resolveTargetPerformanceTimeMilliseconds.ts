export const resolveTargetPerformanceTimeMilliseconds = (
  audioContext: AudioContext,
  playbackTimeSeconds: number,
) => {
  if ("getOutputTimestamp" in audioContext) {
    const outputTimestamp = audioContext.getOutputTimestamp();
    const { contextTime, performanceTime } = outputTimestamp;

    if (
      typeof contextTime === "number" &&
      typeof performanceTime === "number"
    ) {
      return performanceTime + (playbackTimeSeconds - contextTime) * 1000;
    }
  }

  return (
    performance.now() + (playbackTimeSeconds - audioContext.currentTime) * 1000
  );
};
