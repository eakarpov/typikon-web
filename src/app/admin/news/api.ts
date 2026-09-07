import { listAll } from "@/lib/news/posts";
import type { NewsPostDTO } from "@/types/dto/news";
import {reportError} from "@/lib/reportError";

export const getItems = async (): Promise<[NewsPostDTO[] | null, any]> => {
    try {
        return [await listAll(), null];
    } catch (e) {
        reportError(e, { where: "app/admin/news/api#getItems" });
        return [null, { error: e }];
    }
};
