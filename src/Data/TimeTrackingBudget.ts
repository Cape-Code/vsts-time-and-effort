import { IExcelColumnFormatOptions } from './../Export/ExcelHelper';
import { getDateTimeFormat, getNumberFormat } from 'VSS/Utils/Culture';
import { parseDateString } from 'VSS/Utils/Date';
import { IGridColumn } from 'VSS/Controls/Grids';
import { TimeTrackingCustomer, TimeTrackingCustomerFactory } from './TimeTrackingCustomer';
import { TimeTrackingBudgetsDocument, IEntityFactory } from './Contract';
import { createCheckboxColumnFn } from '../UIHelper/GridHelper';
import { getCurrentProject, getDocumentById } from './DataServiceHelper';
import { format } from './Date';

export class TimeTrackingBudget {
    constructor(public id: string, public name: string, public description: string, public start: Date, public end: Date, public customer: TimeTrackingCustomer, public budgetDataDocumentId: string, public hours: number, public cost: number) {
    }

    toString = (): string => {
        return `${this.name} (${this.customer})`;
    }
}

export class TimeTrackingBudgetFactory implements IEntityFactory<TimeTrackingBudget, TimeTrackingBudgetsDocument> {
    public static getBudgets(): IPromise<TimeTrackingBudgetsDocument> {
        return getDocumentById(TimeTrackingBudgetFactory.prototype.createDocumentId(), TimeTrackingBudgetFactory.prototype.itemConstructor);
    }

    itemConstructor(x: any): TimeTrackingBudget {
        return new TimeTrackingBudget(x.id, x.name, x.description, x.start ? parseDateString(x.start) : undefined, x.start ? parseDateString(x.end) : undefined, TimeTrackingCustomerFactory.prototype.itemConstructor(x.customer), x.budgetDataDocumentId, x.hours, x.cost);
    }

    itemSerializer(x: TimeTrackingBudget) {
        return {
            id: x.id,
            name: x.name,
            description: x.description,
            start: x.start,
            end: x.end,
            customer: TimeTrackingCustomerFactory.prototype.itemSerializer(x.customer),
            budgetDataDocumentId: x.budgetDataDocumentId,
            hours: x.hours,
            cost: x.cost
        };
    }

    createGridColumns(): IGridColumn[] {
        return [
            { name: 'Title', width: 200, text: 'Title', tooltip: 'Title', index: 'name' },
            { name: 'Customer', width: 150, text: 'Customer', tooltip: 'Customer', index: 'customer' },
            { name: 'Start', width: 100, text: 'Start', tooltip: 'Start', format: getDateTimeFormat().ShortDatePattern, index: 'start' },
            { name: 'End', width: 100, text: 'End', tooltip: 'End', format: getDateTimeFormat().ShortDatePattern, index: 'end' },
            { name: 'Hours', width: 100, text: 'Hours', tooltip: 'Hours', index: 'hours' },
            { name: 'Cost', width: 100, text: `Cost ${getNumberFormat().CurrencySymbol}/h`, tooltip: 'Cost per hour', index: 'cost' },
            { name: 'Description', width: 400, text: 'Description', tooltip: 'Description', fixed: true, index: 'description', canSortBy: false }
        ];
    }

    createHierarchyGridColumns(): IGridColumn[] {
        throw new Error('Method not implemented.');
    }

    createExportColumns(): [(t: TimeTrackingBudget) => string | number | boolean | Date, IExcelColumnFormatOptions][] {
        throw new Error('Method not implemented.');
    }

    createDocumentId(workItemId?: number): string {
        return `tae.${getCurrentProject()}.b`;
    }
}