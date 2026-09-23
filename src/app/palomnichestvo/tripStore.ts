// Поездки в браузере: чтение и запись localStorage с оглядкой — в приватном
// окне и при запрете хранилища оно бросает, и страница от этого падать не должна.
import { TRIPS_KEY, type Trip } from "@/lib/pilgrimage/trip";
import type { Plan } from "@/lib/pilgrimage/plan";

/** Поездка вместе с последним составом: без сети страница показывает его. */
export interface StoredTrip extends Trip {
    plan?: Plan;
    planAt?: string;
    /** Когда сохранена для чтения без сети и сколько страниц не далось. */
    savedAt?: string;
    failed?: string[];
}

export const loadTrips = (): StoredTrip[] => {
    try {
        const list = JSON.parse(localStorage.getItem(TRIPS_KEY) ?? "[]");
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
};

export const storeTrips = (trips: StoredTrip[]): boolean => {
    try {
        localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
        return true;
    } catch {
        return false;
    }
};

export const updateTrip = (id: string, patch: Partial<StoredTrip>): StoredTrip | null => {
    const trips = loadTrips();
    const i = trips.findIndex((t) => t.id === id);
    if (i < 0) return null;
    trips[i] = { ...trips[i], ...patch };
    storeTrips(trips);
    return trips[i];
};
