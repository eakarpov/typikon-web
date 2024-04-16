import ContentMetaClient from "@/app/triodion/ContentMetaClient";

interface IError {
    error: string;
}

interface IContentMeta {
    itemsPromise: Promise<[any, IError?]>
}

const serverCount = process.env.SERVER_COUNT || false; // after rebuild;

const ContentMeta = async ({ itemsPromise }: IContentMeta) => {

    const [meta, error] = await itemsPromise;

    if (error) return null;

    return serverCount ? (
        <div
            className="flex flex-col"
        >
            <span>
              Счетчик посещений (beta):
            </span>
            <span>
              Количество посещений: {meta.totalCount}
            </span>
            <span>
              Количество посетителей: {meta.totalUsers}
            </span>
        </div>
    ) : (
        <ContentMetaClient />
    );
};

export default ContentMeta;
