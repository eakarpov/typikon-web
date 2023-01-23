export const wrapTags = (text: string, regex: RegExp, className?: string) => {
    const textArray = text.split(regex);
    const matches = text.matchAll(regex);
    const arrayOfAllMatches = [...matches];
    return textArray.map(str => {
        const elem = arrayOfAllMatches.find(el => el[1] === str);
        if (elem) {
            return <span key={elem[1]} className={className}>{elem[1]}</span>;
        }
        return str;
    });
};
