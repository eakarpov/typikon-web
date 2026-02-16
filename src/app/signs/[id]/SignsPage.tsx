'use client';
import React, {useEffect} from "react";

const SignsPage = ({ item }: {item: any}) => {
    return (
        <>
            <div className="flex flex-col mb-2">
                <span className="text-xl">
                    Святой/память
                </span>
                <span className="text-bold">
                    Город: {item.name}
                </span>
                {item.synonyms && (
                    <span>
                        Синонимы: {item.synonyms.join(',')}
                    </span>
                )}
            </div>
        </>
    );
}

export default SignsPage;
