import {getItem} from "@/app/penticostarion/[id]/api";
import Content from "@/app/penticostarion/[id]/Content";
import {Suspense} from "react";
import {myFont} from "@/utils/font";

const PenticostarionItem = ({ params: { id }}: { params: {id: string}}) => {

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
