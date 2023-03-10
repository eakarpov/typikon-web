import {TextType, valueTitle} from "@/utils/texts";

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
            <a href={`#${valueName}`}>
                {valueTitle(valueName)}
            </a>
        </li>
    );
};

export default DayTitle;
