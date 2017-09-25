import { Splitter, ISplitterOptions } from 'VSS/Controls/Splitter';
import { Enhancement } from 'VSS/Controls';

export function createSplitter(container: JQuery, minWidth: number): Splitter {
    let splitterOptions: ISplitterOptions = {
        minWidth: minWidth
    };
    var splitter = <Splitter>Enhancement.enhance(Splitter, container, splitterOptions);
    splitter.resize(minWidth);

    return splitter;
}