import { IExcelColumnFormatOptions } from './../Export/ExcelHelper';
import { TimeTrackingCustomersDocument, IEntityFactory } from './Contract';
import { IGridColumn } from 'VSS/Controls/Grids';
import { createCheckboxColumnFn } from '../UIHelper/GridHelper';
import { getCurrentProject, getDocumentById } from './DataServiceHelper';

export class TimeTrackingCustomer {
    constructor(public name: string, public isActive: boolean) {
    }

    toString = (): string => {
        return this.name;
    }
}

export class TimeTrackingCustomerFactory implements IEntityFactory<TimeTrackingCustomer, TimeTrackingCustomersDocument> {
    public static getCustomers(): IPromise<TimeTrackingCustomersDocument> {
        return getDocumentById(TimeTrackingCustomerFactory.prototype.createDocumentId(), TimeTrackingCustomerFactory.prototype.itemConstructor);
    }

    itemConstructor(x: any): TimeTrackingCustomer {
        return new TimeTrackingCustomer(x.name, x.isActive);
    }

    itemSerializer(x: TimeTrackingCustomer) {
        return {
            name: x.name,
            isActive: x.isActive
        };
    }

    createGridColumns(): IGridColumn[] {
        return [
            { name: 'Customer', width: 250, text: 'Customer', tooltip: 'Customer', index: 'name' },
            { name: 'IsActive', width: 75, text: 'Is Active?', tooltip: 'Is Active?', index: 'isActive', getCellContents: createCheckboxColumnFn }
        ];
    }

    createHierarchyGridColumns(): IGridColumn[] {
        throw new Error('Method not implemented.');
    }

    createExportColumns(): [(t: TimeTrackingCustomer) => string | number | boolean | Date, IExcelColumnFormatOptions][] {
        throw new Error('Method not implemented.');
    }

    createDocumentId(workItemId?: number): string {
        return `tae.${getCurrentProject()}.c`;
    }
}