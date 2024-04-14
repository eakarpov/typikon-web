import {getItem} from "@/app/reading/[id]/api";
import Content from "@/app/reading/[id]/Content";
import {Suspense} from "react";
import {myFont} from "@/utils/font";
import {setMeta} from "@/lib/meta";

const PenticostarionItem = ({ params: { id }}: { params: { id: string }}) => {
    setMeta();
    const itemPromise = getItem(id);

    return (
      <div className={myFont.variable}>
          <Suspense fallback={<div>Loading...</div>}>
              {/* @ts-expect-error Async Server Component */}
              <Content itemPromise={itemPromise} />
          </Suspense>
      </div>
    );
};

export default PenticostarionItem;
