"use client";
import {TextType, valueTitle} from "@/utils/texts";
import {TrashIcon, PlusIcon, InformationCircleIcon, LinkIcon} from "@heroicons/react/24/outline";
import {memo, useCallback, useEffect, useState} from "react";

export interface IDayTextPart {
    item: { textId: string; cite?: string; description?: string; paschal: boolean; };
    index: number;
    paschal: boolean;
    value: any;
    valueName: TextType;
    setter: any;
    setTextField: (itemName: TextType, index: number, field: "textId"|"cite"|"paschal"|"description", value: string|boolean) => void;
}

export interface IDayPart {
    value: any;
    valueName: TextType;
    setter: any;
    paschal: boolean;
    setTextField: (itemName: TextType, index: number, field: "textId"|"cite"|"paschal"|"description", value: string|boolean) => void;
}

const DayTextPart = ({ item, index, paschal, setTextField, value, valueName, setter }: IDayTextPart) => {
    const [isOpenDescription, setIsOpenDescription] = useState(false);
    const [isOpenCite, setIsOpenCite] = useState(false);
    const [val, setVal] = useState<string>(item.textId);
    const [text, setText] = useState<any>(null);

    const onSaveText = useCallback(() => {
        setTextField(valueName, index, "textId", val);
    }, [val, valueName, index, setTextField]);

    const onAdd = useCallback((index: number) => () => {
        const newItems = [...value.items];
        newItems.splice(index, 0, { cite: "", textId: "", paschal });
        setter({
            items: newItems,
        });
    }, [setter, value]);

    useEffect(() => {
        setVal(item.textId);
    }, [item.textId]);

    useEffect(() => {
        fetch(`/api/v1/texts/${item.textId}`).then((res) => res.json()).then((res) => {
            setText(res);
        });
    }, []);

  return (
      <div className="flex flex-col mt-4">
          <div className="flex flex-row items-end gap-2">
              {item.paschal === paschal && (
                  <div className="flex flex-col">
                      <label>
                          Идентификатор текста
                      </label>
                      <input
                          style={{ width: '250px'}}
                          className="border-2"
                          onBlur={onSaveText}
                          value={val}
                          onChange={e => setVal(e.target.value)}
                      />
                  </div>
              )}
              <div
                  className="border"
                  onClick={() => setTextField(valueName, index, "paschal", !item.paschal)}
              >
                  {item.paschal ? "Триодный цикл" : "Календарный цикл"}
              </div>
              <div
                  className="cursor-pointer h-6"
                  onClick={() => setIsOpenDescription(old => !old)}
              >
                  <InformationCircleIcon className={`w-4 h-4 ${item.description && `text-green-600`}`} />
              </div>
              <div
                  className="cursor-pointer h-6"
                  onClick={() => setIsOpenCite(old => !old)}
              >
                  <LinkIcon className={`w-4 h-4 ${item.cite && `text-green-600`}`} />
              </div>
              <div
                  className="cursor-pointer h-6"
                  onClick={onAdd(index)}
              >
                  <PlusIcon className="w-4 h-4" />
              </div>
              <div
                  className="cursor-pointer h-6"
                  onClick={() => setter(
                      value.items?.length > 1
                          ? { items: [ ...value.items.filter((e: any, i: number) => i !== index)]}
                          : null
                  )}
              >
                  <TrashIcon className="w-4 h-4" />
              </div>
              {text && (
                  <div
                      className="border ml-4"
                  >
                      {text.name}
                  </div>
              )}
          </div>
          {isOpenDescription && (
              <>
                  <label>
                      Описание
                  </label>
                  <input
                      className="border-2"
                      value={item.description}
                      onChange={e => setTextField(valueName, index, "description", e.target.value)}
                  />
              </>
          )}
          {isOpenCite && (
              <>
                  <label>
                      Цитата из Типикона
                  </label>
                  <input
                      className="border-2"
                      value={item.cite}
                      onChange={e => setTextField(valueName, index, "cite", e.target.value)}
                  />
              </>
          )}
      </div>
  )
};

export const DayPart = ({
    value,
    valueName,
    setter,
    paschal,
    setTextField,
}: IDayPart) => (
    <>
        <label>
            <span className="font-bold">{valueTitle(valueName)}</span>
            <span
                className="cursor-pointer text-slate-300"
                onClick={() => {
                    setter({ items: [ ...(value?.items || []), { cite: "", textId: "", paschal } ]});
                }}
            >
                Добавить в конец
            </span>
        </label>
        {value && (
            <div>
                {value.items?.map((item: any, index: number) => (
                    <DayTextPart
                        key={item.textId}
                        item={item}
                        index={index}
                        paschal={paschal}
                        setTextField={setTextField}
                        setter={setter}
                        value={value}
                        valueName={valueName}
                    />
                ))}
            </div>
        )}
    </>
);

export default memo(DayPart);
