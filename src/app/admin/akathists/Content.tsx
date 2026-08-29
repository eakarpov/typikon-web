import Editor from "./Editor";
import type { LinksData, LinkTarget } from "./api";

const Content = async ({ dataPromise, status, target }: {
    dataPromise: Promise<LinksData>; status: string; target: LinkTarget;
}) => {
    const data = await dataPromise;
    if (data.error) return <p>Ошибка при загрузке: {data.error}</p>;
    return <Editor data={data} status={status} target={target} />;
};

export default Content;
