'use client';
import React, {useCallback, useEffect, useRef} from "react";
import './index.css';
import go from "gojs";
import FamilyTree from "@balkangraph/familytree.js";
import * as d3 from 'd3';  // npm install d3 or yarn add d3
import * as f3 from 'family-chart';  // npm install family-chart@0.9.0 or yarn add family-chart@0.9.0
import 'family-chart/styles/family-chart.css';
import Link from "next/link";
import TreeSpider from "treespider";
import {FamilyTreeViewer} from "family-tree-viewer";
import OrganizationChart from "@dabeng/react-orgchart";

import "treespider/dist/css/treeSpider.css";

const gedcomString = `0 HEAD 
1 SOUR Reunion
2 VERS V8.0
2 CORP Leister Productions
1 DEST Reunion
1 DATE 11 FEB 2006
1 FILE test
1 GEDC 
2 VERS 5.5
1 CHAR MACINTOSH
0 @I1@ INDI
1 NAME Bob /Cox/
1 SEX M
1 FAMS @F1@
1 CHAN 
2 DATE 11 FEB 2006
0 @I2@ INDI
1 NAME Joann /Para/
1 SEX F
1 FAMS @F1@
1 CHAN 
2 DATE 11 FEB 2006
0 @I3@ INDI
1 NAME Bobby Jo /Cox/
1 SEX M
1 FAMC @F1@
1 CHAN 
2 DATE 11 FEB 2006
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 MARR 
1 CHIL @I3@
0 TRLR
`;

const familyData = [
    {
        name: 'King George V',
        gender: 'M', status: 'king', born: '1865', death: '1936'
        // no parent value, this is the root
    },
];

const Nobles = () => {
    const treeRef = useRef(null);

    const result = {
        id: "1",
        name: "Игорь",
        surnames: [],

    }

    const nameProperty = 'name';
    const genderProperty = 'gender';
    const statusProperty = 'status';
    const countProperty = 'count';

    const theme = {
        colors: {
            femaleBadgeBackground: '#FFCBEA',
            maleBadgeBackground: '#A2DAFF',
            femaleBadgeText: '#7A005E',
            maleBadgeText: '#001C76',
            kingQueenBorder: '#FEBA00',
            princePrincessBorder: '#679DDA',
            civilianBorder: '#58ADA7',
            personText: '#383838',
            personNodeBackground: '#FFFFFF',
            selectionStroke: '#485670',
            counterBackground: '#485670',
            counterBorder: '#FFFFFF',
            counterText: '#FFFFFF',
            link: '#686E76'
        },
        fonts: {
            badgeFont: 'bold 12px Poppins',
            birthDeathFont: '14px Poppins',
            nameFont: '500 18px Poppins',
            counterFont: '14px Poppins'
        }
    };

    // toggle highlight on mouse enter/leave
    // this sample also uses highlight for selection, so only unhighlight if unselected
    const onMouseEnterPart = (e, part) => part.isHighlighted = true;
    const onMouseLeavePart = (e, part) => { if (!part.isSelected) part.isHighlighted = false; }
    const onSelectionChange = part => { part.isHighlighted = part.isSelected; }

    const STROKE_WIDTH = 3;
    const ADORNMENT_STROKE_WIDTH = STROKE_WIDTH + 1;
    const CORNER_ROUNDNESS = 12;
    const IMAGE_TOP_MARGIN = 20;
    const MAIN_SHAPE_NAME = 'mainShape';
    const IMAGE_DIAMETER = 40;

    const getStrokeForStatus = status => {
        switch (status) {
            case 'king':
            case 'queen':
                return theme.colors.kingQueenBorder;
            case 'prince':
            case 'princess':
                return theme.colors.princePrincessBorder;
            case 'civilian':
            default:
                return theme.colors.civilianBorder;
        }
    };

    function strokeStyle(shape) {
        shape.fill = theme.colors.personNodeBackground;
        shape.strokeWidth = STROKE_WIDTH;
        shape.bind('stroke', statusProperty, status => getStrokeForStatus(status));
        shape.bindObject('stroke', 'isHighlighted',
            (isHighlighted, obj) =>
                isHighlighted
                    ? theme.colors.selectionStroke
                    : getStrokeForStatus(obj.part.data.status));
    }

    const genderToText = gender => gender === 'M' ? 'MALE' : 'FEMALE';

    const genderToTextColor =
        gender => gender === 'M' ? theme.colors.maleBadgeText : theme.colors.femaleBadgeText;

    const genderToFillColor =
        gender => gender === 'M' ? theme.colors.maleBadgeBackground : theme.colors.femaleBadgeBackground;

    const personBadge = () =>
        new go.Panel('Auto', {
            alignmentFocus: go.Spot.TopRight,
            alignment: new go.Spot(1, 0, -25, STROKE_WIDTH - 0.5)
        })
            .add(
                new go.Shape({
                    figure: 'RoundedRectangle',
                    parameter1: CORNER_ROUNDNESS,
                    parameter2: 4 | 8, // round only the bottom
                    desiredSize: new go.Size(NaN, 22.5),
                    stroke: null
                })
                    .bind('fill', genderProperty, genderToFillColor),
                new go.TextBlock({
                    font: theme.fonts.badgeFont
                })
                    .bind('stroke', genderProperty, genderToTextColor)
                    .bind('text', genderProperty, genderToText)
            )

    const personBirthDeathTextBlock = () =>
        new go.TextBlock({
            stroke: theme.colors.personText,
            font: theme.fonts.birthDeathFont,
            alignmentFocus: go.Spot.Top,
            alignment: new go.Spot(0.5, 1, 0, -35)
        })
            .bind('text', '', ({ born, death }) => {
                if (!born) return '';
                return `${born} - ${death ?? ''}`;
            })

    // Panel to display the number of children a node has
    const personCounter = () =>
        new go.Panel('Auto', {
            visible: false,
            alignmentFocus: go.Spot.Center,
            alignment: go.Spot.Bottom
        })
            .bindObject('visible', '', obj => obj.findLinksOutOf().count > 0)
            .add(
                new go.Shape('Circle', {
                    desiredSize: new go.Size(29, 29),
                    strokeWidth: STROKE_WIDTH,
                    stroke: theme.colors.counterBorder,
                    fill: theme.colors.counterBackground
                }),
                new go.TextBlock({
                    alignment: new go.Spot(0.5, 0.5, 0, 1),
                    stroke: theme.colors.counterText,
                    font: theme.fonts.counterFont,
                    textAlign: 'center'
                })
                    .bindObject('text', '', obj => obj.findNodesOutOf().count)
            )

    function pictureStyle(pic) {
        pic
            .bind('source', '', ({ status, gender }) => {
                switch (status) {
                    case 'king':
                    case 'queen':
                        return './images/king.svg';
                    case 'prince':
                    case 'princess':
                        return './images/prince.svg';
                    case 'civilian':
                        return gender === 'M'
                            ? './images/male-civilian.svg'
                            : './images/female-civilian.svg';
                    default:
                        return './images/male-civilian.svg';
                }
            })
            // The SVG files are different sizes, so this keeps their aspect ratio reasonable
            .bind('desiredSize', 'status', status => {
                switch (status) {
                    case 'king':
                    case 'queen':
                        return new go.Size(30, 20)
                    case 'prince':
                    case 'princess':
                        return new go.Size(28, 20)
                    case 'civilian':
                    default:
                        return new go.Size(24, 24)
                }
            });
    }

    const personImage = () =>
        new go.Panel('Spot', {
            alignmentFocus: go.Spot.Top,
            alignment: new go.Spot(0, 0, STROKE_WIDTH / 2, IMAGE_TOP_MARGIN)
        })
            .add(
                new go.Shape({
                    figure: 'Circle',
                    desiredSize: new go.Size(IMAGE_DIAMETER, IMAGE_DIAMETER)
                })
                    .apply(strokeStyle),
                new go.Picture({ scale: 0.9 })
                    .apply(pictureStyle)
            );

    const personMainShape = () =>
        new go.Shape({
            figure: 'RoundedRectangle',
            desiredSize: new go.Size(215, 110),
            portId: '',
            parameter1: CORNER_ROUNDNESS
        })
            .apply(strokeStyle);

    const personNameTextBlock = () =>
        new go.TextBlock({
            stroke: theme.colors.personText,
            font: theme.fonts.nameFont,
            desiredSize: new go.Size(160, 50),
            overflow: go.TextOverflow.Ellipsis,
            textAlign: 'center',
            verticalAlignment: go.Spot.Center,
            toolTip:
                go.GraphObject.build('ToolTip')
                    .add(
                        new go.TextBlock({ margin: 4 })
                            .bind('text', nameProperty)
                    ),
            alignmentFocus: go.Spot.Top,
            alignment: new go.Spot(0.5, 0, 0, 25)
        })
            .bind('text', nameProperty)


    const createNodeTemplate = () =>
        new go.Node('Spot', {
            selectionAdorned: false,
            mouseEnter: onMouseEnterPart,
            mouseLeave: onMouseLeavePart,
            selectionChanged: onSelectionChange
        })
            .add(
                new go.Panel('Spot')
                    .add(
                        personMainShape(),
                        personNameTextBlock(),
                        personBirthDeathTextBlock()
                    ),
                personImage(),
                personBadge(),
                personCounter()
            )

    const createLinkTemplate = () =>
        new go.Link({
            selectionAdorned: false,
            routing: go.Routing.Orthogonal,
            layerName: 'Background',
            mouseEnter: onMouseEnterPart,
            mouseLeave: onMouseLeavePart
        })
            .add(
                new go.Shape({
                    stroke: theme.colors.link,
                    strokeWidth: 1
                })
                    .bindObject('stroke', 'isHighlighted',
                        isHighlighted => isHighlighted ? theme.colors.selectionStroke : theme.colors.link)
                    .bindObject('stroke', 'isSelected',
                        selected => selected ? theme.colors.selectionStroke : theme.colors.link)
                    .bindObject('strokeWidth', 'isSelected', selected => selected ? 2 : 1)
            );

    const initDiagram = divId => {
        const item = document.getElementById(divId);
        console.log(item);
        if (item?.innerHTML) {
            return;
        }
        const diagram = new go.Diagram(divId, {
            layout: new go.TreeLayout({
                angle: 90,
                nodeSpacing: 20,
                layerSpacing: 50,
                layerStyle: go.TreeLayout.LayerUniform,

                // For compaction, make the last parents place their children in a bus
                treeStyle: go.TreeStyle.LastParents,
                alternateAngle: 90,
                alternateLayerSpacing: 35,
                alternateAlignment: go.TreeAlignment.BottomRightBus,
                alternateNodeSpacing: 20
            }),
            'toolManager.hoverDelay': 100,
            linkTemplate: createLinkTemplate(),
            model: new go.TreeModel({ nodeKeyProperty: 'name' })
        });

        diagram.nodeTemplate = createNodeTemplate();
        const nodes = familyData;
        diagram.model.addNodeDataCollection(nodes);

        // Initially center on root:
        diagram.addDiagramListener('InitialLayoutCompleted', () => {
            const root = diagram.findNodeForKey('King George V');
            if (!root) return;
            diagram.scale = 0.6;
            diagram.scrollToRect(root.actualBounds);
        });

        // Setup zoom to fit button
        // document.getElementById('zoomToFit').addEventListener('click', () => diagram.commandHandler.zoomToFit());
        //
        // document.getElementById('centerRoot').addEventListener('click', () => {
        //     diagram.scale = 1;
        //     diagram.commandHandler.scrollToPart(diagram.findNodeForKey('King George V'));
        // });
    };

    useEffect(() => {
        // initDiagram('tree');
        new FamilyTree(treeRef.current, {
            nodeBinding: {
                field_0: "name",
                field_1: "years",
            },
            nodes: [
                { id: 7, pids: [8], name: "Отец маэстро" },
                { id: 8, pids: [7], name: "Мать маэстро", years: "950-999" },
                { id: 1, pids: [4, 2], fid: 7, mid: 8, name: "Маэстро", years: "990-1030", test: "testse" },
                { id: 2, pids: [1] },
                { id: 3, mid: 1, fid: 2 },
                { id: 6, mid: 1, fid: 2 },
                { id: 4, pids: [1] },
                { id: 5, mid: 3, fid: 1 },
            ]
        });

        fetch('https://donatso.github.io/family-chart-doc/data/data-aristotle.json')
            .then(res => res.json())
            .then(data => create(data))
            .catch(err => console.error(err))

        function create(data) {
            const cont = document.querySelector("#FamilyChart")
            const store = f3.createStore({
                data,
                node_separation: 250,
                level_separation: 150
            })
            const svg = f3.createSvg(cont);
            const Card = f3.elements.CardSvg({
                svg,
                card_dim: {w:220,h:70,text_x:75,text_y:15,img_w:60,img_h:60,img_x:5,img_y:5},
                card_display: [d => d.data.label || '', d => '1892',],
                mini_tree: false,
                link_break: false,
                onCardClick: (e, d) => {
                    store.updateMainId(d.data.id)
                    store.updateTree({})
                }
            })
            // const f3Chart = f3.createChart('#FamilyChart', data)
            // const f3Card = f3Chart.setCardHtml()  // returns a CardHtml instance
            //     .setCardDisplay([["first name","last name"],["birthday"]]);

            store.setOnUpdate(props => f3.view(store.getTree(), svg, Card, props || {}))
            store.updateTree({initial: true})
        }

        // function create(data) {
        //     let tree, main_id;
        //
        //     const cont = document.querySelector("#FamilyChart")
        //     const {svg} = f3.handlers.htmlContSetup(cont)
        //     updateTree({initial: true})
        //
        //     function updateTree(props) {
        //         tree = f3.calculateTree(data, { main_id })
        //         props = Object.assign({}, props || {}, {cardHtml: true})
        //         f3.view(tree, svg, Card(), props || {})
        //     }
        //
        //     function updateMainId(_main_id) {
        //         main_id = _main_id
        //     }
        //
        //     function Card() {
        //         const card_dim = {w:220,h:70,text_x:75,text_y:15,img_w:60,img_h:60,img_x:5,img_y:5}
        //         return function (d) {
        //             this.innerHTML = ''
        //             const div = d3.select(this).append('div').classed('card', true).style('transform', `translate(${-card_dim.w / 2}px, ${-card_dim.h / 2}px)`)
        //             const div_inner = div.append('div')
        //                 .attr('style', `width: ${card_dim.w}px; height: ${card_dim.h}px; background-color: gray; color: #fff; border-radius: 3px; cursor: pointer; pointer-events: auto`)
        //                 .on('click', e => onCardClick(e, d))
        //             div_inner.append('div').attr('style', 'padding: 10px 20px;').html(`${d.data.data["first name"]} ${d.data.data["last name"]}`)
        //         }
        //
        //         function onCardClick(e, d) {
        //             console.log(d);
        //             updateMainId(d.data.id)
        //             updateTree()
        //         }
        //
        //     }
        // }

        const tree_data = [
            {id: "1", name: "Abayomi Amusa", role: "Manager", location: "Lagos, Nigeria"},
            {id: "2", parentId: "1", name: "Trey Anderson", role: "Product Manager", location: "California, United States"},
            {id: "3", parentId: "1", name: "Troy Manuel", role: "Software Developer", location: "Alberta, Canada"},
            {id: "4", parentId: "1", name: "Rebecca Oslon", role: "Software Developer", location: "London, United Kingdom"},
            {id: "5", parentId: "1", name: "David Scheg", role: "Product Designer", location: "Jiaozian, China"},
            {id: "6", parentId: "2", name: "James Zucks", role: "DevOps", location: "Accra, Ghana"},
            {id: "7", parentId: "2", name: "Zu Po Xe", role: "Backend Developer", location: "Johanesburg, South Africa"},
            {id: "8", parentId: "2", name: "Scott Ziagler", role: "FrontEnd Developer Intern"},
            {id: "9", parentId: "7", name: "Xervia Allero", role: "FrontEnd Developer Intern"},
            {id: "10", parentId: "3", name: "Adebowale Ajanlekoko", role: "Fullstack Developer"},
        ]

        const instance1 = new TreeSpider({
            targetContainer: '#tree2',
            tree_data: tree_data,
            chart_head_type: "landscape",
        })

        instance1.on("chart_head.create", (e) => {
            console.log(e.detail);
        })
        const item = document.getElementById("tree2");
        if (item?.innerHTML) {
            return;
        }

        const viewer = new FamilyTreeViewer('#tree2', {
            gedcom: gedcomString,
            theme: 'light',
            onSave: (gedcom) => console.log('updated GEDCOM:', gedcom),
        });
    }, []);

    const ds = {
        id: "n1",
        name: "Lao Lao",
        title: "general manager",
        children: [
            { id: "n2", name: "Bo Miao", title: "department manager" },
            {
                id: "n3",
                name: "Su Miao",
                title: "department manager",
                children: [
                    { id: "n4", name: "Tie Hua", title: "senior engineer" },
                    {
                        id: "n5",
                        name: "Hei Hei",
                        title: "senior engineer",
                        children: [
                            { id: "n6", name: "Dan Dan", title: "engineer" },
                            { id: "n7", name: "Xiang Xiang", title: "engineer" }
                        ]
                    },
                    { id: "n8", name: "Pang Pang", title: "senior engineer" }
                ]
            },
            { id: "n9", name: "Hong Miao", title: "department manager" },
            {
                id: "n10",
                name: "Chun Miao",
                title: "department manager",
                children: [{ id: "n11", name: "Yue Yue", title: "senior engineer" }]
            }
        ]
    };

    const onClickNode = useCallback((e) => {
        console.log(e);
    }, []);

    return (
        <div className="flex" style={{ flexDirection: "column"}}>
            <div className="flex flex-row">
                <div className="w-1/2">

                </div>
                <div
                    className="w-1/2 flex"
                    style={{ flexDirection: "column"}}
                >
                    <div
                        className="tree-root f3"
                        id="FamilyChart"
                    >

                    </div>
                    <div
                        ref={treeRef}
                        // className="tree-root"
                        id="tree2"
                    >

                    </div>
                    <OrganizationChart
                        datasource={ds}
                        onClickNode={onClickNode}
                    />

                    <div id="rules">

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Nobles;