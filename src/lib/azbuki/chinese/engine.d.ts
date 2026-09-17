import type { Engine } from "./types";

export function createEngine(data: Record<string, unknown>): Engine;
export function addData(engine: Engine, data: Record<string, unknown>): Engine;
