"use client";
import { useState } from "react";
import type { Material, Target } from "@/lib/study/core";
import { locate } from "@/lib/study/core";
export interface ComparisonData {
  materials: [Material, Material];
  targets: [Target, Target];
  title: string;
  locator: string;
}
export default function Comparison({
  value,
  onClose,
}: {
  value: ComparisonData;
  onClose: () => void;
}) {
  const [side, setSide] = useState(0);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Сопоставление фрагментов"
      className="fixed inset-0 z-50 bg-white text-stone-900 p-4 flex flex-col"
    >
      <div className="flex gap-4 items-center">
        <h2>{value.title}</h2>
        <button className="border rounded p-3" onClick={onClose}>
          Назад к чтению
        </button>
      </div>
      <p>{value.locator}</p>
      <div className="flex gap-2 py-2 md:hidden">
        {value.materials.map((m, i) => (
          <button
            key={i}
            className="border p-2"
            aria-pressed={side === i}
            onClick={() => setSide(i)}
          >
            {m.edition ?? m.title}
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4 flex-1 min-h-0">
        {value.materials.map((m, i) => {
          const found = locate(m, value.targets[i]);
          const from = found?.block.index ?? 0,
            to = found?.endBlock?.index ?? from;
          return (
            <section
              key={i}
              className={
                (side === i ? "block" : "hidden") +
                " md:block overflow-auto border p-4"
              }
            >
              <h3>{m.title}</h3>
              <p>
                {m.edition} · {m.language}
              </p>
              {m.blocks.slice(Math.max(0, from - 1), to + 2).map((b) => (
                <p className="whitespace-pre-wrap py-3" key={b.id}>
                  <span
                    className={
                      b.index >= from && b.index <= to ? "bg-amber-100" : ""
                    }
                  >
                    {b.text
                      .replace(/\{(?:st|pl)\|[^}|]+\|([^}]+)}/g, "$1")
                      .replace(/\{k\||}/g, "")}
                  </span>
                </p>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
