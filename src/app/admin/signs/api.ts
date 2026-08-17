import {getSignsList, SignsListParams, SignsListResult} from "@/lib/signs/list";

export const getItems = async (params: SignsListParams): Promise<[SignsListResult, null]> => {
    const result = await getSignsList(params);
    return [result, null];
};
