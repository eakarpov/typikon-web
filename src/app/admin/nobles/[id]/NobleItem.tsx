import React, {useEffect, useState} from "react";

const NobleItem = ({
    value,
    setValue,
    placeholder,
}) => {

    const [father, setFather] = useState<any|null>(null);

    const [fatherSearch, setFatherSearch] = useState("");
    const [fatherData, setFatherData] = useState<any[]>([]);

    useEffect(() => {
        if (value) {
            fetch(`/api/admin/nobles/${value}`)
                .then((res) => res.json())
                .then((data) => {
                    setFather(data.data);
                    setFatherData([]);
                    setFatherSearch(data.data.name);
                });
        } else {
            setFatherData([]);
            setFatherSearch("");
            setFather(null);
        }
    }, [value]);

    useEffect(() => {
        if (fatherSearch) {
            fetch(`/api/admin/nobles?query=${fatherSearch}`)
                .then((res) => res.json())
                .then((data) => {
                    setFatherData(data.data);
                });
        } else {
            setFatherData([]);
        }
    }, [fatherSearch]);

    console.log(fatherData);

    return (
        <div className="flex flex-col pr-4">
            <label>
                {placeholder}
            </label>
            {father ? (
                <div>
                    {father.name} <span onClick={() => setValue(null)}>X</span>
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
                                {item.name}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
};

export default NobleItem;
