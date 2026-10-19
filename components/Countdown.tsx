"use client";

import { useEffect, useState } from "react";
import { fmtLeft } from "@/lib/client/format";

export default function Countdown({ to, className }: { to: string | number | Date; className?: string }) {
  const target = new Date(to).getTime();
  const [left, setLeft] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => setLeft(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const urgent = left > 0 && left < 3_600_000;
  return <span className={[className, urgent ? "urgent" : ""].filter(Boolean).join(" ")}>{fmtLeft(left)}</span>;
}
