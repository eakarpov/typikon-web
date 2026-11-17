import FullBook, { fullBookMetadata } from "@/app/library/FullBook";
import type { BookSearch } from "@/lib/fullBooks";
export const dynamic = "force-dynamic";
type Props = { params: { id: string }; searchParams: BookSearch };
export function generateMetadata({ params, searchParams }: Props) {
    return fullBookMetadata(params.id, searchParams, "records");
}
export default function Page({ params, searchParams }: Props) {
    return <FullBook alias={params.id} searchParams={searchParams} view="records" />;
}
