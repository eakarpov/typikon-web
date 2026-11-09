import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { textLinks } from "@/lib/textLinks";

export default function TextLinkList({ value, label }: { value: unknown; label: string }) {
    const links = textLinks(value).filter(url => /^https?:\/\//i.test(url));
    if (!links.length) return null;
    return <span role="list" aria-label={label} className="flex flex-col gap-1 pr-4 text-amber-800 text-sm font-serif">
        {links.map((url, index) => {
            let host = "";
            try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
            return <span role="listitem" key={url}><a className="inline-flex items-center gap-1 underline" href={url} target="_blank" rel="noreferrer">
                {label}{links.length > 1 ? ` ${index + 1}` : ""}{host ? ` · ${host}` : ""}<ArrowTopRightOnSquareIcon className="w-4 h-4" />
            </a></span>;
        })}
    </span>;
}
