import { IExcelColumnFormatOptions } from './../Export/ExcelHelper';
import { IGridColumn } from 'VSS/Controls/Grids';
import { TimeTrackingRolesDocument, IEntityFactory } from './Contract';
import { getNumberFormat } from 'VSS/Utils/Culture';
import { getCurrentProject, getDocumentById } from "./DataServiceHelper";

export class TimeTrackingRole {
    constructor(public name: string, public cost: number) {
    }

    toString = (): string => {
        return `${this.name} (${this.cost}${getNumberFormat().CurrencySymbol}/h)`;
    }
}

export class TimeTrackingRoleFactory implements IEntityFactory<TimeTrackingRole, TimeTrackingRolesDocument> {
    public static getRoles(): IPromise<TimeTrackingRolesDocument> {
        return getDocumentById(TimeTrackingRoleFactory.prototype.createDocumentId(), TimeTrackingRoleFactory.prototype.itemConstructor);
    }

    itemConstructor(x: any): TimeTrackingRole {
        return new TimeTrackingRole(x.name, x.cost);
    }

    itemSerializer(x: TimeTrackingRole) {
        return {
            name: x.name,
            cost: x.cost
        };
    }

    createGridColumns(): IGridColumn[] {
        return [
            { name: 'Role', width: 250, text: 'Role', tooltip: 'Role', index: 'name' },
            { name: 'Cost', width: 100, text: `Cost ${getNumberFormat().CurrencySymbol}/h`, tooltip: 'Cost per hour', index: 'cost' }
        ];
    }

    createHierarchyGridColumns(): IGridColumn[] {
        throw new Error('Method not implemented.');
    }

    createExportColumns(): [(t: TimeTrackingRole) => string | number | boolean | Date, IExcelColumnFormatOptions][] {
        throw new Error('Method not implemented.');
    }

    createDocumentId(workItemId?: number): string {
        return `tae.${getCurrentProject()}.r`;
    }
}