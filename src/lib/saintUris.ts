import type { Collection } from "mongodb";

export const isSaintUri = (address: string): boolean =>
    /^saint:[a-z0-9-]+(?:\/[a-z0-9-]+){4}$/.test(address);

export const findSaintByUri = async (saints: Collection, address: string) => {
    const current = await saints.find({ uri: address }).limit(2).toArray();
    if (current.length) return current.length === 1 ? current[0] : null;
    const aliases = await saints.find({ previousUris: address }).limit(2).toArray();
    return aliases.length === 1 ? aliases[0] : null;
};
