import { useEffect, useState } from "react";

export function useChartMetrics() {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));

  useEffect(() => {
    const updateWidth = () => setWidth(window.innerWidth);
    window.addEventListener("resize", updateWidth, { passive: true });
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const compact = width < 480;
  const tablet = width >= 480 && width < 1024;

  return {
    tickFontSize: compact ? 10 : tablet ? 11 : 12,
    xAxisAngle: compact ? -25 : 0,
    xAxisHeight: compact ? 48 : 30,
    margin: compact ? { top: 8, right: 4, left: -8, bottom: 4 } : { top: 10, right: 12, left: 0, bottom: 0 },
  };
}
