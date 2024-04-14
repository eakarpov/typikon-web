interface IError {
    error: string;
}

interface IContentMeta {
    itemsPromise: Promise<[any, IError?]>
}


const ContentMeta = async ({ itemsPromise }: IContentMeta) => {

    const [meta, error] = await itemsPromise;

    if (error) return null;

    return (
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
    );
};

export default ContentMeta;
