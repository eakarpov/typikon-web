'use client';
import React, {useCallback, useEffect, useRef} from "react";
import './index.css';
import NobleCard from "@/app/nobles/[id]/NobleCard";
import * as f3 from "family-chart";
import {useRouter} from "next/navigation";

import "treespider/dist/css/treeSpider.css";
import 'family-chart/styles/family-chart.css';
import NobleContemporaries from "@/app/nobles/[id]/NobleContemporaries";
import {csFont} from "@/utils/font";
import {Tree} from "family-chart/dist/types/layout/calculate-tree";

const Nobles = ({ value }: {value: any}) => {
    const treeRef = useRef(null);

    const router = useRouter();

    const create = (data: any) => {
        const cont = document.getElementById("familyTree")!;
        if (cont) {
            cont.innerHTML = "";
        }
        const store = f3.createStore({
            data,
            node_separation: 250,
            level_separation: 150,
            main_id: ""
        })
        const svg = f3.createSvg(cont);
        const Card = f3.elements.CardSvg({
            svg,
            card_dim: {w:220,h:70,text_x:75,text_y:15,img_w:60,img_h:60,img_x:5,img_y:5},
            // @ts-ignore
            card_display: [
                (d: any) => d.data.name || 'Неизвестно',
                (d: any) => `${d.data?.birthDate || ""} - ${d.data?.deathDate || ""}`,
            ],
            mini_tree: false,
            link_break: false,
            // onCardClick: (e, d) => {
            //     store.updateMainId(d.data.id)
            //     store.updateTree({})
            // }
            onCardClick: onClickNode,
        })
        store.setOnUpdate(props => f3.view(store.getTree() as Tree, svg, Card, props || {}))
        store.updateTree({initial: true})
    }

    const createRules = (index: number, d: any) => {
        const data = d.filter((el: any) => !!el);
        const cont = document.getElementById(`tree-rules-${index}`)!;
        if (cont) {
            cont.innerHTML = "";
        }
        const store = f3.createStore({
            data,
            node_separation: 250,
            level_separation: 150,
            is_horizontal: true,
            single_parent_empty_card: false,
            main_id: ""
        })
        const svg = f3.createSvg(cont);
        const Card = f3.elements.CardSvg({
            svg,
            card_dim: {w:220,h:70,text_x:75,text_y:15,img_w:60,img_h:60,img_x:5,img_y:5},
            // @ts-ignore
            card_display: [
                (d: any) => d.data.name || '',
                (d: any) => `${d.data?.startDate || ""} - ${d.data?.endDate || ""}`,
            ],
            mini_tree: false,
            link_break: false,
            // onCardClick: (e, d) => {
            //     store.updateMainId(d.data.id)
            //     store.updateTree({})
            // },
            onCardClick: onClickRuleNode,
        })
        store.setOnUpdate(props => f3.view(store.getTree() as Tree, svg, Card, props || {}))
        store.updateTree({initial: true})
    }

    useEffect(() => {
        const item = document.getElementById("tree2");
        if (item?.innerHTML) {
            return;
        }

        const d = [
            {
                id: value.data.id.toString(),
                data: value.data,
                rels: {
                    parents: [value.data.fatherId?.toString(), value.data.motherId?.toString()].filter(el => !!el),
                    spouses: value.spouses.map((item: any) => item.id.toString()),
                    children: value.children.map((item: any) => item.id.toString()),
                }
            },
            ...[
                value.data.fatherId && {
                    id: value.data.fatherId.toString(),
                    data: value.father,
                    rels: {
                        children: [value.data.id.toString()],
                    },
                }, value.data.motherId && {
                    id: value.data.motherId.toString(),
                    data: value.mother,
                    rels: {
                        children: [value.data.id.toString()],
                    }
                }
            ].filter(el => !!el),
            ...value.spouses.map((c: any) => {
                return {
                  id: c.id.toString(),
                  data: c.data,
                  rels: {
                      spouses: [value.data.gender ? c.husbandId.toString() : c.wifeId.toString()],
                     children: value.children
                             .filter((item: any) => value.data.gender
                                 ? item.motherId === value.data.id
                                 : item.fatherId === value.data.id)
                             .map((item: any) => item.id.toString()),
                  }
                };
            }),
            ...value.children.map((c: any) => {
                return {
                    id: c.id.toString(),
                    data: c,
                    rels: {
                      parents: [value.data.id.toString(), ...value.spouses.filter((item: any) =>
                          value.data.gender
                              ? item.wifeId === c.motherId
                              : item.husbandId === c.fatherId
                      ).map((item: any) => item.id.toString())],
                    },
                }
            }),
        ]

        create(d);

        value.rules.forEach((rule: any, index: number) => {
           createRules(index, [
               {
                   id: rule.id.toString(),
                   data: {
                       type: "state",
                       stateId: rule.state?.id,
                       name: rule.state?.name,
                       startDate: rule.startDate || value.data.birthDate,
                       endDate: rule.endDate || value.data.deathDate,
                   },
                   rels: {
                       parents: rule.predessorId ? [rule.predessorId.toString()] : [],
                       children: rule.successor?.id ? [rule.successor?.id?.toString()] : [],
                       spouses: rule.suzerainId ? [rule.suzerainId.toString()] : [],
                   }
               },
               rule.successor ? {
                   id: rule.successor.id.toString(),
                   data: {
                       type: "rule",
                       id: rule.successor.id,
                       personId: rule.successor.personId,
                       name: rule.successor.person?.name,
                       startDate: rule.successor.startDate,
                       endDate: rule.successor.endDate,
                   },
                   rels: { parents: [rule.id.toString()] },
               } : null,
               rule.predessorId ? {
                   id: rule.predessorId.toString(),
                   data: {
                       type: "rule",
                       id: rule.predessorId,
                       personId: rule.predessor?.personId,
                       name: rule.predessor?.person?.name,
                       startDate: rule.predessor?.startDate,
                       endDate: rule.predessor?.endDate,
                   },
                   rels: { children: [rule.id.toString()] },
               } : null,
               rule.suzerainId ? {
                   id: rule.suzerainId.toString(),
                   data: {
                       type: "state",
                       id: rule.suzerainId,
                       name: rule.suzerain?.state?.name,
                   },
                   rels: {
                       spouses: [rule.id.toString()],
                   },
               } : null,
           ]);
        });
    }, [value]);

    const onClickNode = useCallback((e: any, d: any) => {
        router.push(`/nobles/${d.data?.data?.id}`);
    }, []);

    const onClickRuleNode = useCallback((e: any, d: any) => {
        if (d.data?.data?.type === "rule") {
            router.push(`/nobles/${d.data?.data?.personId}`);
        }
        if (d.data?.data?.type === "state") {
            router.push(`/nobles/states/${d.data?.data?.stateId}`);
        }
    }, []);

    return (
        <div className={`flex ${csFont.variable}`} style={{ flexDirection: "column"}}>
            <div className="flex flex-row">
                <div className="w-1/2">
                    <NobleCard
                        value={value.data}
                        family={value.family}
                    />
                    <NobleContemporaries value={value.data} />
                </div>
                <div
                    className="w-1/2 flex"
                    style={{flexDirection: "column"}}
                >
                    <b>Ближайшие родственники</b>
                    <div
                        ref={treeRef}
                        className="tree-root f3"
                        id="familyTree"
                    />
                    <div id="rules">
                        <b>Правления</b>
                        {value.rules.map((r: any, i: number) => (
                            // eslint-disable-next-line react/jsx-key
                            <div
                                className="tree-root tree-root-2 f3"
                                id={`tree-rules-${i}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Nobles;