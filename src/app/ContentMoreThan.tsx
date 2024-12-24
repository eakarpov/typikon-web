interface IError {
    error: string;
}

interface IContentMeta {
    itemsPromise: Promise<[any, IError?]>
}


const ContentMeta = async ({ itemsPromise }: IContentMeta) => {

    const [textCount, error] = await itemsPromise;

    if (error) return null;

    return (
        <div
            className="flex flex-col"
        >
            <span className="font-serif">
                Портал содержит более <b>{Math.floor(textCount / 10) * 10}</b> текстов и постоянно пополняется.
            </span>
        </div>
    );
};

export default ContentMeta;
