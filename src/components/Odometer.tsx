import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const DIGITS = 6;

export function Odometer({
  miles,
  onSave,
}: {
  miles: number;
  onSave: (miles: number) => void;
}) {
  const [draft, setDraft] = useState(digitsOf(miles));
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => setDraft(digitsOf(miles)), [miles]);

  function setDigit(index: number, digit: string) {
    const next = [...draft];
    next[index] = digit;
    setDraft(next);
  }

  const typed = Number(draft.join(""));
  const dirty = typed !== miles;

  function commit() {
    if (dirty) onSave(typed);
    setDraft(digitsOf(typed));
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="display text-[10px] text-cyan/80">ODOMETER</p>
        <p className="display text-[10px] text-white/45">{typed.toLocaleString()} MI</p>
      </div>
      <div
        className="mt-2 flex flex-wrap items-center gap-1"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) commit();
        }}
      >
        {draft.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              boxes.current[index] = element;
            }}
            aria-label={`Odometer digit ${index + 1}`}
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            value={digit}
            className="digit display h-12 w-8 border border-magenta/50 bg-black/50 text-center text-2xl text-cyan outline-none focus:border-cyan"
            onFocus={(event) => event.target.select()}
            onChange={(event) => {
              const entry = event.target.value.replace(/\D/g, "").slice(-1);
              if (!entry) return;
              setDigit(index, entry);
              boxes.current[index + 1]?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace") {
                event.preventDefault();
                setDigit(index, "0");
                boxes.current[index - 1]?.focus();
              } else if (event.key === "ArrowLeft") {
                boxes.current[index - 1]?.focus();
              } else if (event.key === "ArrowRight") {
                boxes.current[index + 1]?.focus();
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setDigit(index, String((Number(digit) + 1) % 10));
              } else if (event.key === "ArrowDown") {
                event.preventDefault();
                setDigit(index, String((Number(digit) + 9) % 10));
              } else if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function digitsOf(miles: number) {
  return String(Math.max(0, Math.round(miles))).padStart(DIGITS, "0").slice(-DIGITS).split("");
}
