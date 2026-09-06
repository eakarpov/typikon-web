import { Suspense } from "react";
import type { Metadata } from "next";
import { csFont, myFont } from "@/utils/font";
import { getPodoben } from "@/lib/podobny/store";
import Content from "./Content";
import { podobenData } from "./api";

// Страница одного подобна: имена по языкам, образец, напев и всё, что им поётся.
//
// Адрес выводится из имени, а не хранится (см. @/lib/podobny/core), поэтому
// канонический адрес объявляется явно: подобен, у которого сменилось
// преобладающее написание, останется доступен по старой ссылке, но
// поисковикам будет назван один.

export const dynamic = "force-dynamic";

type Props = {
    params: { slug: string };
    searchParams: Record<string, string | undefined>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const unit = getPodoben(params.slug);
    if (!unit) return { title: "Подобен не найден — Уставные чтения" };

    const names = unit.names.map((name) => name.printed).join(" · ");
    return {
        title: `${unit.names[0]?.printed ?? params.slug} — подобен — Уставные чтения`,
        description: `${names}${unit.tone ? `, глас ${unit.tone}` : ""}: ${unit.items} стихир корпуса поётся этим подобном.`,
        alternates: { canonical: `/podobny/${unit.slug}` },
    };
}

const PodobenPage = ({ params, searchParams }: Props) => (
    <div className={`${myFont.variable} ${csFont.variable} pt-2`}>
        <Suspense>
            <Content data={podobenData(params.slug, searchParams)} slug={params.slug} params={searchParams} />
        </Suspense>
    </div>
);

export default PodobenPage;
