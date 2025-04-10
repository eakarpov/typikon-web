import {TextType, valueTitle} from "@/utils/texts";
import {DayDTO} from "@/types/dto/days";

export interface IDayTitle {
    value: any;
    valueName: TextType;
}

const DayTitle = ({
    value,
    valueName,
}: IDayTitle) => {
    return value?.items && (
        <li>
            <a href={`#${valueName}`} className="font-serif">
                {valueTitle(valueName)}
            </a>
        </li>
    );
};

export default DayTitle;
