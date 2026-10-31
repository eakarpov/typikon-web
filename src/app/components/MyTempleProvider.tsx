'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppSelector } from '@/lib/hooks';
import { MY_TEMPLE_KEY, readLocalTemple, type AccountTemple, type MyTempleValue } from '@/lib/myTemple/core';

type State = AccountTemple & { owner: string; loading: boolean; error: string; legacy: MyTempleValue | null };
type TempleContext = State & { busy: boolean; choose: (value: MyTempleValue) => Promise<void>; clear: () => Promise<void>; migrate: () => Promise<void>; reload: () => void };
const empty = { temple: null, initialized: false, unavailable: false, loading: true, error: '', legacy: null };
const Context = createContext<TempleContext | null>(null);
export const useMyTemple = () => { const value = useContext(Context); if (!value) throw Error('MyTempleProvider is missing'); return value; };
export default function MyTempleProvider({ children }: { children: ReactNode }) {
    const auth = useAppSelector(s => s.auth);
    const owner = !auth.isResolved ? 'pending' : auth.isAuthorized && auth.userId ? auth.userId : 'guest';
    const activeOwner = useRef(owner); activeOwner.current = owner;
    const [state, setState] = useState<State>({ ...empty, owner });
    const [busyOwner, setBusyOwner] = useState<string | null>(null);
    const serial = useRef(0);
    const channel = useRef<BroadcastChannel | null>(null);
    const refresh = useCallback(async () => {
        const generation = ++serial.current;
        if (owner === 'pending') return;
        if (owner === 'guest') { setState({ ...empty, owner, temple: readLocalTemple(), loading: false }); return; }
        try {
            const response = await fetch('/api/my-temple', { cache: 'no-store' });
            const data = await response.json().catch(() => null);
            if (generation !== serial.current || activeOwner.current !== owner) return;
            if (response.status === 401 || response.ok && data?.userId !== owner) {
                setState({...empty, owner, loading:false, error:'Вход изменился. Обновите страницу или войдите заново.'});
                return;
            }
            if (!response.ok) throw Error(data?.error || 'Не удалось загрузить выбранный храм. Обновите данные или войдите заново.');
            if (generation !== serial.current || activeOwner.current !== owner) return;
            setState({ ...data, owner, loading: false, error: '', legacy: !data.initialized ? readLocalTemple() : null });
        } catch (e) {
            if (generation === serial.current && activeOwner.current === owner)
                setState(previous => ({ ...(previous.owner === owner ? previous : { ...empty, owner }), loading: false, error: e instanceof Error ? e.message : 'Не удалось загрузить храм.' }));
        }
    }, [owner]);
    useEffect(() => {
        const requests = serial;
        setState({ ...empty, owner }); void refresh();
        return () => { requests.current++; };
    }, [owner, refresh]);
    useEffect(() => {
        const onFocus = () => { if (document.visibilityState === 'visible') void refresh(); };
        const onStorage = (e: StorageEvent) => { if (e.key === MY_TEMPLE_KEY) void refresh(); };
        const onMessage = (e: MessageEvent) => { if (e.data?.owner === owner) void refresh(); };
        try { const bus = new BroadcastChannel('typikon:my-temple-updated'); channel.current = bus; bus.addEventListener('message', onMessage); } catch { /* focus refresh also works */ }
        window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus); window.addEventListener('storage', onStorage);
        return () => { channel.current?.close(); channel.current = null; window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); window.removeEventListener('storage', onStorage); };
    }, [owner, refresh]);
    const change = async (value: MyTempleValue | null, migrate = false) => {
        if (owner === 'pending' || busyOwner === owner) return;
        if (owner === 'guest') {
            try {
                if (value) localStorage.setItem(MY_TEMPLE_KEY, JSON.stringify(value)); else localStorage.removeItem(MY_TEMPLE_KEY);
                setState({ ...empty, owner, temple: value, loading: false });
            } catch { setState(s => ({ ...s, error: 'Браузер не разрешил сохранить выбор. Войдите, чтобы сохранить храм в учётной записи.' })); }
            return;
        }
        setBusyOwner(owner); ++serial.current;
        try {
            const response = await fetch('/api/my-temple', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUserId: owner, slug: value?.slug ?? null, ...(migrate ? { migrate: true } : {}) }) });
            const data = await response.json().catch(() => null);
            if (!response.ok) { if (response.status === 409) await refresh(); throw Error(data?.error || 'Не удалось сохранить храм. Попробуйте ещё раз.'); }
            if (activeOwner.current !== owner) return;
            if (migrate) { try { localStorage.removeItem(MY_TEMPLE_KEY); } catch { /* account choice already persisted */ } }
            ++serial.current;
            setState({ ...data, owner, loading: false, error: '', legacy: null });
            channel.current?.postMessage({ owner });
        } catch (e) { if (activeOwner.current === owner) setState(s => ({ ...s, error: e instanceof Error ? e.message : 'Не удалось сохранить храм.' })); }
        finally { setBusyOwner(current => current === owner ? null : current); }
    };
    const current = state.owner === owner ? state : { ...empty, owner };
    return <Context.Provider value={{ ...current, busy: busyOwner === owner, choose: value => change(value), clear: () => change(null), migrate: () => current.legacy ? change(current.legacy, true) : Promise.resolve(), reload: () => { void refresh(); } }}>{children}</Context.Provider>;
}
