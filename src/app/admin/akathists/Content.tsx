import Editor from "./Editor";
import type { LinksData } from "./api";

const Content = async ({ dataPromise, status }: {
    dataPromise: Promise<LinksData>; status: string;
}) => {
    const data = await dataPromise;
    if (data.error) return <p>Ошибка при загрузке: {data.error}</p>;
    return <Editor data={data} status={status} />;
};

export default Content;
