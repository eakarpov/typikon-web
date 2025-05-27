export const getTodayDate = (date?: string) => {
    const currTime = date ? new Date(date) : new Date();
    let tomorrow = false;
    if (currTime.getHours() > 15) {
        tomorrow = true;
    }
    currTime.setHours(0);
    currTime.setMinutes(0);
    currTime.setSeconds(0);
    return new Date(+currTime + (tomorrow ? 1000 * 60 * 60 * 24 : 0) - 1000 * 60 * 60 * 24 * 13);
};

export const getZeroedNumber = (val: number) => {
    return val >= 10 ? val.toString() : `0${val}`;
}