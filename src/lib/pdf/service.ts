import fontkit from "@pdf-lib/fontkit";
import {layoutMultilineText, PDFDocument, rgb} from "pdf-lib";
import fs from "fs";

const renderPart = (
    multiText,
    page,
    pdfDoc,
    startingPositon,
    font,
    fontSize = 20,
    color = rgb(0,0,0),
    lineHeight = 25,
) => {
    const { width, height } = page.getSize();

    for(let i = 0; i < multiText.lines.length; i++) {
        if((startingPositon) < 50) {
            page = pdfDoc.addPage();
            // reset starting position
            startingPositon = height - 100
        }
        page.drawText(`${multiText.lines[i].text}`, {
            x: 20,
            y: startingPositon,
            size: fontSize,
            maxWidth: width - 100,
            color: color,
            font: font
        })
        // move position down
        startingPositon = startingPositon - (lineHeight)
    }
    return { position: startingPositon, newPage: page };
}

const getFont = async (path: string, pdfDoc) => {
    let file;
    try {
        file = fs.readFileSync(process.cwd() + path);
    } catch (e) {
        console.log(e);
    }
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(file);
    return font;
};

const onSave = async (text: any) => {
    const pdfDoc = await PDFDocument.create();
    const oldStandardRegular = await getFont("/src/lib/pdf/OldStandard-Regular.otf", pdfDoc);
    const oldStandardItalic = await getFont("/src/lib/pdf/OldStandard-Italic.otf", pdfDoc);
    const oldStandardBold = await getFont("/src/lib/pdf/OldStandard-Bold.otf", pdfDoc);
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const multiText = layoutMultilineText(text.name, {
        // @ts-ignore
        alignment: 'left',
        font: oldStandardBold,
        fontSize: 20,
        lineHeight: 25,
        color: rgb(0, 0, 0),
        // @ts-ignore
        bounds: { width: width - 100, height: 10000  }
    });
    let { position, newPage } = renderPart(multiText, page, pdfDoc, height - 50, oldStandardRegular);
    if (text.poems) {
        position = position - 20;
        page.drawText("Стихи:", {
            x: 20,
            y: position,
            size: 16,
            lineHeight: 20,
            font: oldStandardBold,
            color: rgb(0, 0, 0),
        });
        text.poems.split("\n").forEach((e: string, i: number) => {
            position = position - 20;
            page.drawText(e, {
                x: 20,
                y: position,
                size: 16,
                lineHeight: 20,
                font: oldStandardItalic,
                color: rgb(0, 0, 0),
            });
        });
    }
    const multiText2 = layoutMultilineText(text.content, {
        // @ts-ignore
        alignment: 'left',
        font: oldStandardRegular,
        fontSize: 20,
        lineHeight: 25,
        color: rgb(0, 0, 0),
        // @ts-ignore
        bounds: { width: width - 100, height: 10000  }
    });
    renderPart(multiText2, newPage, pdfDoc, position - 50, oldStandardRegular);

    const pdfBytes = await pdfDoc.save()

    return pdfBytes;
};

export default onSave;
