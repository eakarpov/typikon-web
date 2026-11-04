import Link from "next/link";
import { shared } from "@/lib/study/personal";
import { href } from "@/lib/study/core";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: { token: string } }) {
  const data = await shared(params.token);
  if (!data)
    return (
      <main>
        <h1>Опубликованная копия недоступна</h1>
      </main>
    );
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl">{data.title}</h1>
      <p>{data.description}</p>
      <p>Опубликованная копия подборки. Личные записи включены автором явно.</p>
      {data.items.map((i: any) => (
        <section key={i.id} className="border p-3">
          <h2>{i.title}</h2>
          <p>{i.comment}</p>
          {i.target && (
            <Link className="underline" href={href(i.target)}>
              Читать источник
            </Link>
          )}
          {i.record && (
            <>
              <blockquote>
                {i.record.originalQuote ?? i.record.target.quote}
              </blockquote>
              <p>{i.record.note}</p>
              <Link className="underline" href={href(i.record.originalTarget??i.record.target)}>
                К исходному месту выписки
              </Link>
            </>
          )}
        </section>
      ))}
      <Link className="underline" href="/study?tab=mine">
        Моё чтение
      </Link>
    </main>
  );
}
