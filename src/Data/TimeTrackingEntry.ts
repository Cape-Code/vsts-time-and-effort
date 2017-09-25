import { TimeTrackingEntriesDocument, IEntityFactory } from './Contract';
import { parseDateString, shiftToLocal } from 'VSS/Utils/Date';
import { IExcelColumnFormatOptions } from './../Export/ExcelHelper';
import { getDateTimeFormat } from 'VSS/Utils/Culture';
import { IGridColumn } from 'VSS/Controls/Grids';
import { TimeTrackingRole, TimeTrackingRoleFactory } from './TimeTrackingRole';
import { format } from './Date';
import { getCurrentProject } from './DataServiceHelper';

export class TimeTrackingEntry {
    constructor(public id: string, public personId: string, public person: string, public role: TimeTrackingRole, public hours: number, public date: Date, public description: string) {
    }
}

export class TimeTrackingEntryFactory implements IEntityFactory<TimeTrackingEntry, TimeTrackingEntriesDocument> {
    itemConstructor(x: any): TimeTrackingEntry {
        return new TimeTrackingEntry(x.id, x.personId, x.person, TimeTrackingRoleFactory.prototype.itemConstructor(x.role), x.hours, x.date ? parseDateString(x.date) : undefined, x.description);
    }

    itemSerializer(x: TimeTrackingEntry) {
        return {
            id: x.id,
            personId: x.personId,
            person: x.person,
            role: TimeTrackingRoleFactory.prototype.itemSerializer(x.role),
            hours: x.hours,
            date: x.date,
            description: x.description
        };
    }

    createGridColumns(): IGridColumn[] {
        return [
            { name: 'Person', width: 200, text: 'Person', tooltip: 'Person', index: 'person' },
            { name: 'Role', width: 150, text: 'Role', tooltip: 'Role', index: 'role' },
            { name: 'Hours', width: 100, text: 'Hours spent', tooltip: 'Hours spent', index: 'hours', canSortBy: false },
            { name: 'Date', width: 100, text: 'Date', tooltip: 'Date', format: getDateTimeFormat().ShortDatePattern, index: 'date' },
            { name: 'Description', width: 450, text: 'Description', tooltip: 'Description', fixed: true, index: 'description', canSortBy: false }
        ];
    }

    createHierarchyGridColumns(): IGridColumn[] {
        return [
            { name: 'Id', width: 50, text: 'Id', tooltip: 'Id', index: 'workItemId' },
            { name: 'Type', width: 75, text: 'Type', tooltip: 'Type', index: 'type' },
            { name: 'Title', width: 300, text: 'Title / Person', tooltip: 'Title / Person', index: 'person', indent: true, canSortBy: false },
            { name: 'Role', width: 150, text: 'Role / Cost', tooltip: 'Role / Cost', index: 'role', canSortBy: false },
            { name: 'Hours', width: 100, text: 'Hours spent', tooltip: 'Hours spent', index: 'hours', canSortBy: false },
            { name: 'Date', width: 100, text: 'Date', tooltip: 'Date', format: getDateTimeFormat().ShortDatePattern, index: 'date', canSortBy: false },
            { name: 'Description', width: 450, text: 'Description', tooltip: 'Description', fixed: true, index: 'description', canSortBy: false }
        ];
    }

    createExportColumns(): [(t: TimeTrackingEntry) => string | number | boolean | Date, IExcelColumnFormatOptions][] {
        return [
            [(t: TimeTrackingEntry) => t.person, { title: 'Person' }],
            [(t: TimeTrackingEntry) => t.role.name, { title: 'Role' }],
            [(t: TimeTrackingEntry) => t.role.cost, { title: 'Cost /h' }],
            [(t: TimeTrackingEntry) => t.hours, { title: 'Hours spent' }],
            [(t: TimeTrackingEntry) => shiftToLocal(t.date), { title: 'Date' }],
            [(t: TimeTrackingEntry) => t.description, { title: 'Description' }]
        ];
    }

    createDocumentId(workItemId?: number): string {
        return `tae.${getCurrentProject()}.t.${workItemId}`;
    }
}