import {setMeta} from "@/lib/meta";
import Content from "@/app/places/common/Content";
import {Suspense} from "react";

const PlacesPage = () => {
    setMeta();
    return (
        <Suspense fallback={<div>Loading...</div>}>
            {/* @ts-expect-error Async Server Component */}
            <Content />
        </Suspense>
    )
};

export default PlacesPage;
