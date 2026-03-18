import { useState, useEffect } from "react";

interface LiveClockProps {
  color?: string;
  size?: "sm" | "md";
}

export function LiveClock({ color = "#fff", size = "sm" }: LiveClockProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = now.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const timeStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const fontSize = size === "md" ? "0.95rem" : "0.78rem";

  return (
    <div style={{ textAlign: "right", lineHeight: 1.4, color }}>
      <div style={{ fontSize, fontWeight: 600, letterSpacing: "0.03em", fontVariantNumeric: "tabular-nums" }}>
        {timeStr}
      </div>
      <div style={{ fontSize: "0.7rem", opacity: 0.7 }}>
        {dateStr}
      </div>
    </div>
  );
}
