import React from "react";
import Markdown from "react-markdown";
import Link from "next/link";
import FootnoteLink from "./FootnoteLinkNew";
import { splitLinkMark } from "@/lib/markup/patterns";

/** Inline corpus tags, shared by poems and reading previews. */
export function inlineMarkup(text: string, footnotes: string[] = []): React.ReactNode {
    return text.split(/(\{(?:k|st|pl|t|p|a)\|[^}]+\}|\{\d+\})/g).map((part, i) => {
        const note = part.match(/^\{(\d+)\}$/);
        if (note) return <FootnoteLink key={i} value={note[1]} footnotes={footnotes} />;
        const tag = part.match(/^\{(k|st|pl|t|p|a)\|([^}]+)\}$/);
        if (!tag) return part;
        const [, kind, body] = tag;
        if (kind === "k") return <span key={i} className="text-red-600">{body}</span>;
        if (kind === "p") return <span key={i} className="text-xs text-stone-400 align-super select-none px-1">{body}</span>;
        if (kind === "a") return <span key={i} id={`p-${body}`} />;
        const { id, label } = splitLinkMark(body);
        const section = { st: "saints", pl: "places", t: "reading" }[kind as "st" | "pl" | "t"];
        return <Link key={i} className="text-blue-800" href={`/${section}/${encodeURIComponent(id)}`}>{label}</Link>;
    });
}

export default function TextMarkup({ text, footnotes = [], markdown = false }: {
    text: string; footnotes?: string[]; markdown?: boolean;
}) {
    const children = (value: React.ReactNode): React.ReactNode => React.Children.map(value, child =>
        typeof child === "string" ? inlineMarkup(child, footnotes) : child);
    if (!markdown) return <>{inlineMarkup(text, footnotes)}</>;
    const tags = ["p", "strong", "em", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "a"] as const;
    const components = Object.fromEntries(tags.map(tag => [tag, ({ children: value, node, ...props }: any) =>
        React.createElement(tag, props, children(value))]));
    return <Markdown components={components}>{text}</Markdown>;
}
