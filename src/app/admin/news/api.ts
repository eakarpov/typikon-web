import { listAll } from "@/lib/news/posts";
import type { NewsPostDTO } from "@/types/dto/news";

export const getItems = async (): Promise<[NewsPostDTO[] | null, any]> => {
    try {
        return [await listAll(), null];
    } catch (e) {
        console.error(e);
        return [null, { error: e }];
    }
};
