import React, { Suspense } from "react";
import Link from "next/link";
import Form from "@/app/components/search/Form";

interface IError {
    error: string;
}

interface IContent {
    itemsPromise: Promise<[any[], IError?]>
}

const Content = async ({ itemsPromise }: IContent) => {

    const [items, error] = await itemsPromise;

    if (error) return null;

    return (
        <div>
            <span className="font-serif">
                Поиск заметок в текстах.<br/>
                Для поиска используйте только кириллические буквы А-Я/а-я<br/>
            </span>
            <Suspense>
                <Form />
                {items.map(item => (
                    <div key={item.id}>
                        <Link href={`/reading/${item.textId}#note_${item.value}`} className="font-serif">
                            {item.title}
                        </Link>
                    </div>
                ))}
            </Suspense>
        </div>
    );
};

export default Content;
