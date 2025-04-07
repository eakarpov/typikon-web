
export const getMonth = (month: number) => {
    switch (month) {
        case 1:
            return "january";
        case 2:
            return "february";
        case 3:
            return "march";
        case 4:
            return "april";
        case 5:
            return "may";
        case 6:
            return "june";
        case 7:
            return "july";
        case 8:
            return "august";
        case 9:
            return "september";
        case 10:
            return "october";
        case 11:
            return "november";
        case 12:
            return "december";
        default:
            return "";
    }
};


export const getMonthLabel = (value: number) => {
    switch (value) {
        case 0:
            return "Январь";
        case 1:
            return "Февраль";
        case 2:
            return "Март";
        case 3:
            return "Апрель";
        case 4:
            return "Май";
        case 5:
            return "Июнь";
        case 6:
            return "Июль";
        case 7:
            return "Август";
        case 8:
            return "Сентябрь";
        case 9:
            return "Октябрь";
        case 10:
            return "Ноябрь";
        case 11:
            return "Декабрь";
        default:
            return "";
    }
};