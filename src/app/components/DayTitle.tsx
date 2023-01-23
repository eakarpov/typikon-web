import {TextType, valueTitle} from "@/utils/texts";

export interface IDayTitle {
    value: any;
    valueName: TextType;
}

const DayTitle = ({
    value,
    valueName,
}: IDayTitle) => {
    return value && (
        <li>
            {valueTitle(valueName)}
        </li>
    );
};

export default DayTitle;
