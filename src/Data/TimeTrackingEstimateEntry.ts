import { getNumberFormat } from 'VSS/Utils/Culture';
import { IExcelColumnFormatOptions } from './../Export/ExcelHelper';
import { TimeTrackingEstimateEntriesDocument, IEntityFactory } from './Contract';
import { IGridColumn } from 'VSS/Controls/Grids';
import { TimeTrackingRole, TimeTrackingRoleFactory } from './TimeTrackingRole';
import { getCurrentProject, getDocumentById } from './DataServiceHelper';

export class TimeTrackingEstimateEntry {
    constructor(public id: string, public role: TimeTrackingRole, public hours: number, public description: string, public assignedFromParentWorkItemId: number, public assignedFromParentEstimateId: string) {
    }

    get cost(): string {
        return `${this.hours * this.role.cost}${getNumberFormat().CurrencySymbol}`;
    }
}

export class TimeTrackingEstimateEntryFactory implements IEntityFactory<TimeTrackingEstimateEntry, TimeTrackingEstimateEntriesDocument> {
    public static getEstimates(workItemId: number): IPromise<TimeTrackingEstimateEntriesDocument> {
        return getDocumentById(TimeTrackingEstimateEntryFactory.prototype.createDocumentId(workItemId), TimeTrackingEstimateEntryFactory.prototype.itemConstructor);
    }

    itemConstructor(x: any): TimeTrackingEstimateEntry {
        return new TimeTrackingEstimateEntry(x.id, TimeTrackingRoleFactory.prototype.itemConstructor(x.role), x.hours, x.description, x.assignedFromParentWorkItemId, x.assignedFromParentEstimateId);
    }

    itemSerializer(x: TimeTrackingEstimateEntry) {
        return {
            id: x.id,
            role: TimeTrackingRoleFactory.prototype.itemSerializer(x.role),
            hours: x.hours,
            description: x.description,
            assignedFromParentWorkItemId: x.assignedFromParentWorkItemId,
            assignedFromParentEstimateId: x.assignedFromParentEstimateId
        };
    }

    createGridColumns(): IGridColumn[] {
        return [
            { name: 'Role', width: 150, text: 'Role', tooltip: 'Role', index: 'role' },
            { name: 'Hours', width: 75, text: 'Hours', tooltip: 'Hours', index: 'hours', canSortBy: false },
            { name: 'Description', width: 450, text: 'Description', tooltip: 'Description', fixed: true, index: 'description', canSortBy: false }
        ];
    }

    createHierarchyGridColumns(): IGridColumn[] {
        return [
            { name: 'Id', width: 50, text: 'Id', tooltip: 'Id', index: 'workItemId' },
            { name: 'Type', width: 75, text: 'Type', tooltip: 'Type', index: 'type' },
            { name: 'Title', width: 300, text: 'Title / Role', tooltip: 'Title / Role', index: 'role', indent: true, canSortBy: false },
            { name: 'Cost', width: 100, text: 'Cost', tooltip: 'Cost', index: 'cost', canSortBy: false },
            { name: 'Hours', width: 75, text: 'Hours', tooltip: 'Hours', index: 'hours', canSortBy: false },
            { name: 'Description', width: 450, text: 'Description', tooltip: 'Description', fixed: true, index: 'description', canSortBy: false }
        ];
    }

    createExportColumns(): [(t: TimeTrackingEstimateEntry) => string | number | boolean | Date, IExcelColumnFormatOptions][] {
        throw new Error('Method not implemented.');
    }

    createDocumentId(workItemId?: number): string {
        return `tae.${getCurrentProject()}.e.${workItemId}`;
    }
}