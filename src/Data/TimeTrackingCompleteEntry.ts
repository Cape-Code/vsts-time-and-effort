import { getDateTimeFormat } from 'VSS/Utils/Culture';
import { IExcelColumnFormatOptions } from './../Export/ExcelHelper';
import { IGridColumn } from 'VSS/Controls/Grids';
import { TimeTrackingEntry, TimeTrackingEntryFactory } from './TimeTrackingEntry';

export class TimeTrackingCompleteEntry extends TimeTrackingEntry {
    public workItemIdString: string;
    public workItemType: string;
    public title: string;
}

export class TimeTrackingCompleteEntryFactory extends TimeTrackingEntryFactory {
    createGridColumns(): IGridColumn[] {
        let columns: IGridColumn[] = [
            { name: 'Id', width: 50, text: 'Id', tooltip: 'Id', index: 'workItemIdString', canSortBy: false },
            { name: 'Type', width: 75, text: 'Type', tooltip: 'Type', index: 'workItemType', canSortBy: false },
            { name: 'Title', width: 300, text: 'Title', tooltip: 'Title', index: 'title', indent: true, canSortBy: false },
            { name: 'Person', width: 200, text: 'Person', tooltip: 'Person', index: 'person', canSortBy: false },
            { name: 'Role', width: 150, text: 'Role / Cost', tooltip: 'Role / Cost', index: 'role', canSortBy: false },
            { name: 'Hours', width: 100, text: 'Hours spent', tooltip: 'Hours spent', index: 'hours', canSortBy: false },
            { name: 'Date', width: 100, text: 'Date', tooltip: 'Date', format: getDateTimeFormat().ShortDatePattern, index: 'date', canSortBy: false },
            { name: 'Description', width: 450, text: 'Description', tooltip: 'Description', fixed: true, index: 'description', canSortBy: false }
        ];

        return columns;
    }

    createExportColumns(): [(t: TimeTrackingEntry) => string | number | boolean | Date, IExcelColumnFormatOptions][] {
        let columns: [{ (t: TimeTrackingCompleteEntry): number | string | Date | boolean; }, IExcelColumnFormatOptions][] = [
            [(t: TimeTrackingCompleteEntry) => t.workItemIdString, { title: 'Id' }],
            [(t: TimeTrackingCompleteEntry) => t.workItemType, { title: 'Type' }],
            [(t: TimeTrackingCompleteEntry) => t.title, { title: 'Title' }]
        ];

        return columns.concat(TimeTrackingEntryFactory.prototype.createExportColumns());
    }
}