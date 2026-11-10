"use client";
import { useEffect, useState } from "react";
import { dictionaryHref } from "@/lib/dictionaryWord";

// Safari/WebViews may expose neither caret API. Word ranges still provide rectangles.
function wordAtPoint(element: Element, x: number, y: number): string | null {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let node: Node | null;
    while ((node = walker.nextNode())) {
        for (const match of (node.textContent ?? "").matchAll(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*/gu)) {
            range.setStart(node, match.index!);
            range.setEnd(node, match.index! + match[0].length);
            if (Array.from(range.getClientRects()).some(rect => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)) return match[0];
        }
    }
    return null;
}

/** Works on day readings, Bible chapters and other text without wrapping every word. */
export default function DictionaryLookup() {
    const [lookup, setLookup] = useState<{ href: string; x: number; y: number } | null>(null);
    useEffect(() => {
        const allowed = (element: Element | null) => element && !element.closest("input, textarea, select, [contenteditable=true], [data-site-nav], [data-dictionary-lookup]");
        const select = () => {
            const selection = window.getSelection();
            if (!selection?.rangeCount || !allowed(selection.anchorNode?.parentElement ?? null)) { setLookup(null); return; }
            const href = dictionaryHref(selection.toString());
            if (!href) { setLookup(null); return; }
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            setLookup({ href, x: Math.max(8, Math.min(rect.left, window.innerWidth - 200)), y: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 60)) });
        };
        const context = (event: MouseEvent) => {
            if (event.defaultPrevented) { setLookup(null); return; }
            if (!allowed(event.target instanceof Element ? event.target : null)) return;
            const selection = window.getSelection();
            if (selection?.toString().trim()) { select(); if (dictionaryHref(selection.toString())) event.preventDefault(); return; }
            const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null;
                caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
            const range = doc.caretRangeFromPoint?.(event.clientX, event.clientY);
            const caret = range ? { offsetNode: range.startContainer, offset: range.startOffset } : doc.caretPositionFromPoint?.(event.clientX, event.clientY);
            const text = caret?.offsetNode.nodeType === Node.TEXT_NODE ? caret.offsetNode.textContent ?? "" : "";
            const words = [...text.matchAll(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*/gu)];
            const word = (caret && words.find(match => match.index! <= caret.offset && match.index! + match[0].length > caret.offset)?.[0])
                || wordAtPoint(event.target as Element, event.clientX, event.clientY);
            const href = word && dictionaryHref(word);
            if (!href) return;
            event.preventDefault();
            setLookup({ href, x: Math.max(8, Math.min(event.clientX, window.innerWidth - 200)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 60)) });
        };
        const close = () => setLookup(null);
        const outside = (event: PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest("[data-dictionary-lookup]")) close(); };
        const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
        document.addEventListener("selectionchange", select);
        document.addEventListener("contextmenu", context);
        document.addEventListener("keydown", key);
        document.addEventListener("pointerdown", outside);
        window.addEventListener("scroll", close, true);
        return () => { document.removeEventListener("selectionchange", select); document.removeEventListener("contextmenu", context);
            document.removeEventListener("keydown", key); document.removeEventListener("pointerdown", outside); window.removeEventListener("scroll", close, true); };
    }, []);
    return lookup && <a data-dictionary-lookup href={lookup.href} onPointerDown={event => event.preventDefault()} onClick={() => setLookup(null)}
        className="fixed z-50 bg-white text-stone-900 border border-stone-400 rounded shadow p-3 underline font-serif"
        style={{ left: lookup.x, top: lookup.y }}>Найти в словаре</a>;
}
