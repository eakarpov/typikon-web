import {getItem} from "@/app/penticostarion/[id]/api";
import Content from "@/app/penticostarion/[id]/Content";
import {Suspense} from "react";

const PenticostarionItem = ({ params: { id }}: { params: {id: string}}) => {

    const itemPromise = getItem(id);

    return (
      <div>
          <p>
              Это страница элемента
          </p>
          <Suspense fallback={<div>Loading...</div>}>
              {/* @ts-expect-error Async Server Component */}
              <Content itemPromise={itemPromise} />
          </Suspense>
      </div>
    );
};

export default PenticostarionItem;
