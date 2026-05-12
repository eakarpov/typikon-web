import React, {useEffect} from "react";

const NobleContemporaries = ({ value }: { value: any }) => {
    const [items, setItems] = React.useState<any[]>([]);

    useEffect(() => {
        fetch(`/api/v1/nobles/${value.id}/contemporaries`).then(res => res.json())
            .then(data => setItems(data.data));
    }, [value]);

    return (
        <div>
            <div className="flex flex-row p-4">
                Также жили в его годы ({value.birthDate} - {value.deathDate}):
            </div>
            <div className="flex flex-row flex-wrap p-4 gap-4">
                {items.map(item => (
                    <div className="property-card" key={item.id}>
                        <a href={`/nobles/${item.id}`}>
                            <div className="property-image">
                                <div className="property-image-title">
                                </div>
                            </div>
                        </a>
                        <div className="property-description">
                            <h5>{item.name}</h5>
                            <p>{"<"}{item.birthDate || item.birthDateMarker} - {">"}{item.deathDate || item.deathDateMarker}</p>
                        </div>
                        {/*<a href="#">*/}
                        {/*    <div className="property-social-icons">*/}
                        {/*    </div>*/}
                        {/*</a>*/}
                    </div>
                ))}
            </div>
        </div>
    )
};

export default NobleContemporaries;