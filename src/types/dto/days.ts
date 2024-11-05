import {WithParts} from "@/types/dto/common";

export interface DayDTO extends WithParts {
    id: string;
    alias: string;
    subnames: string[];
    updatedAt: string;

    weekIndex: number|null;
    weekId: string|null;
    monthId: string|null;
    monthIndex: number|null;

    fileId: null; // ?
}