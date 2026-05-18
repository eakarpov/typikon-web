import React, {useEffect, useState} from "react";

const getData = (item: any) => {
    console.log(123, item);
    return `${item.person?.name} (${item.startDate} - ${item.endDate})`;
}

const RuleItem = ({
    value,
    setValue,
    placeholder,
}) => {

    const [father, setFather] = useState<any|null>(null);

    const [fatherSearch, setFatherSearch] = useState("");
    const [fatherData, setFatherData] = useState<any[]>([]);

    useEffect(() => {
        if (value) {
            fetch(`/api/admin/nobles/rules/${value}`)
                .then((res) => res.json())
                .then((data) => {
                    setFather(data.data);
                    setFatherData([]);
                    setFatherSearch(getData(data.data));
                });
        } else {
            setFatherData([]);
            setFatherSearch("");
            setFather(null);
        }
    }, [value]);

    useEffect(() => {
        if (fatherSearch) {
            fetch(`/api/admin/nobles/rules?query=${fatherSearch}`)
                .then((res) => res.json())
                .then((data) => {
                    setFatherData(data.data);
                });
        } else {
            setFatherData([]);
        }
    }, [fatherSearch]);

    return (
        <div className="flex flex-col pr-4">
            <label>
                {placeholder}
            </label>
            {father ? (
                <div>
                    {getData(father)} <span onClick={() => setValue(null)}>X</span>
                </div>
            ) : (
                <>
                    <input
                        className="border-2"
                        value={fatherSearch}
                        onChange={e => setFatherSearch(e.target.value)}
                    />
                    <div className="flex flex-col pr-4">
                        {fatherData.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => setValue(item.id)}
                            >
                                {getData(item)}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
};

export default RuleItem;
