import Editor from "@/app/calculator/Editor";
import {setMeta} from "@/lib/meta";

const ReadingCalculator = () => {
    setMeta();

    return (
        <div className="pt-2">
            <Editor />
        </div>
    );
};

export default ReadingCalculator;
