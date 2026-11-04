import { locate, type Material, type RecordDoc } from "@/lib/study/core";
/** Display-only marks. A mismatch never changes or relocates a saved source anchor. */
export function showHighlights(
  material: Material | null,
  records: RecordDoc[],
) {
  const css = (globalThis as any).CSS?.highlights,
    Highlight = (globalThis as any).Highlight;
  if (!css || !Highlight) return () => {};
  const ranges: Range[] = [];
  if (material)
    for (const record of records) {
      const t = record.target,
        found = locate(material, t);
      if (!found || !t.quote || found.endBlock) continue;
      const body = document.querySelector(
        "#study-" + found.block.id + " [data-source-body]",
      );
      if (!body) continue;
      const content = body.textContent ?? "",
        q = t.quote;
      let at = -1;
      const hits: number[] = [];
      while ((at = content.indexOf(q, at + 1)) !== -1) hits.push(at);
      const rawHits: number[] = [];
      at = -1;
      while ((at = found.block.text.indexOf(q, at + 1)) !== -1)
        rawHits.push(at);
      if (hits.length !== rawHits.length) continue;
      const ordinal = rawHits.indexOf(found.offset ?? -1),
        start = hits[ordinal];
      if (start == null) continue;
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      let node: Node | null,
        offset = 0,
        startNode: Node | null = null,
        startOffset = 0;
      while ((node = walker.nextNode())) {
        const n = node.textContent?.length ?? 0;
        if (!startNode && start >= offset && start < offset + n) {
          startNode = node;
          startOffset = start - offset;
        }
        if (startNode && start + q.length <= offset + n) {
          const range = document.createRange();
          range.setStart(startNode, startOffset);
          range.setEnd(node, start + q.length - offset);
          ranges.push(range);
          break;
        }
        offset += n;
      }
    }
  css.set("study-notes", new Highlight(...ranges));
  return () => css.delete("study-notes");
}
