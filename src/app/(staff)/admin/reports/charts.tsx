"use client";

import { useState } from "react";
import { formatINR } from "@/lib/menu";

// Colours checked with the colour-blind validator: three category hues in fixed order, then a neutral
// grey for "Others". Every value is also written out in text, so colour is never the only cue.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"];
const OTHERS = "#5f5e5a";
const BAR = "#2a78d6";

export type Point = { label: string; full: string; value: number };

// Sales over time: thin columns with a tooltip on hover (or tap).
export function ColumnChart({ points, caption }: { points: Point[]; caption: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...points.map((p) => p.value), 1);
  const height = 180;
  const ticks = [0, 0.5, 1].map((f) => f * max);
  // Show every label when few, otherwise every few so they don't collide.
  const labelEvery = points.length > 16 ? Math.ceil(points.length / 12) : 1;

  return (
    <figure>
      <div className="relative flex gap-2">
        {/* y axis */}
        <div
          className="flex w-16 shrink-0 flex-col justify-between pb-6 text-right text-xs text-slate-400"
          style={{ height }}
        >
          {[...ticks].reverse().map((t) => (
            <span key={t}>{formatINR(Math.round(t))}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* gridlines */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between"
            style={{ height: height - 24 }}
          >
            {ticks.map((t) => (
              <div key={t} className="border-t border-slate-100" />
            ))}
          </div>
          <div
            className="relative flex items-end gap-[2px]"
            style={{ height: height - 24 }}
            onMouseLeave={() => setActive(null)}
          >
            {points.map((p, i) => (
              <button
                key={p.full}
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                aria-label={`${p.full}: ${formatINR(p.value)}`}
                className="group relative flex h-full flex-1 items-end justify-center outline-none"
              >
                <span
                  className="w-full max-w-10 rounded-t-[4px] transition-opacity"
                  style={{
                    height: `${(p.value / max) * 100}%`,
                    minHeight: p.value > 0 ? 2 : 0,
                    background: BAR,
                    opacity: active === null || active === i ? 1 : 0.45,
                  }}
                />
              </button>
            ))}
          </div>
          {/* x labels */}
          <div className="flex gap-[2px] pt-1.5">
            {points.map((p, i) => (
              <span key={p.full} className="flex-1 truncate text-center text-[11px] text-slate-500">
                {i % labelEvery === 0 ? p.label : ""}
              </span>
            ))}
          </div>
          {active !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
              style={{ left: `${((active + 0.5) / points.length) * 100}%` }}
            >
              <span className="block text-slate-300">{points[active].full}</span>
              <span className="font-bold">{formatINR(points[active].value)}</span>
            </div>
          )}
        </div>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}

export type Share = { name: string; total: number };

// Category split: the top three categories and everything else as "Others", as one bar plus a labelled table.
export function CategoryShare({ categories }: { categories: Share[] }) {
  const [active, setActive] = useState<number | null>(null);
  const sorted = [...categories].sort((a, b) => b.total - a.total);
  const top = sorted.slice(0, 3);
  const rest = sorted.slice(3).reduce((sum, c) => sum + c.total, 0);
  const parts = [
    ...top.map((c, i) => ({ ...c, color: SERIES[i] })),
    ...(rest > 0 ? [{ name: `Others (${sorted.length - 3})`, total: rest, color: OTHERS }] : []),
  ];
  const total = parts.reduce((sum, p) => sum + p.total, 0);

  if (total === 0) return <p className="py-8 text-center text-sm text-slate-500">No sales in this period.</p>;

  return (
    <div>
      <div className="flex h-8 gap-[2px] overflow-hidden rounded-[4px]" onMouseLeave={() => setActive(null)}>
        {parts.map((p, i) => (
          <button
            key={p.name}
            type="button"
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            aria-label={`${p.name}: ${formatINR(p.total)}, ${Math.round((p.total / total) * 100)}%`}
            className="h-full outline-none transition-opacity"
            style={{
              width: `${(p.total / total) * 100}%`,
              background: p.color,
              opacity: active === null || active === i ? 1 : 0.45,
            }}
          />
        ))}
      </div>
      <table className="mt-4 w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {parts.map((p, i) => (
            <tr
              key={p.name}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={active === i ? "bg-slate-50" : ""}
            >
              <td className="py-2 pr-3">
                <span className="flex items-center gap-2 font-medium text-slate-800">
                  <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: p.color }} aria-hidden />
                  {p.name}
                </span>
              </td>
              <td className="py-2 pr-3 text-right font-semibold text-slate-900">{formatINR(p.total)}</td>
              <td className="w-14 py-2 text-right text-slate-500">{Math.round((p.total / total) * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length > 3 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-800">What&apos;s in Others</summary>
          <ul className="mt-2 space-y-1 text-slate-600">
            {sorted.slice(3).map((c) => (
              <li key={c.name} className="flex justify-between">
                <span>{c.name}</span>
                <span>{formatINR(c.total)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
