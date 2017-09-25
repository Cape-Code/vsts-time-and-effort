import { IExcelColumnFormatOptions } from './../Export/ExcelHelper';
import { IGridColumn } from 'VSS/Controls/Grids';
import { TimeTrackingBudget } from './TimeTrackingBudget';
import { TimeTrackingCustomer } from './TimeTrackingCustomer';
import { TimeTrackingRole } from './TimeTrackingRole';
import { TimeTrackingEntry } from './TimeTrackingEntry';
import { TimeTrackingEstimateEntry } from './TimeTrackingEstimateEntry';

export interface IDocument<T, U> extends ICustomDocument {
    serialized: any[];
    map: Map<T, U>;
}

export interface ICustomDocument {
    id: string;
    __etag?: number;
}

export interface TimeTrackingEntriesDocument extends IDocument<string, TimeTrackingEntry> { }
export interface TimeTrackingRolesDocument extends IDocument<string, TimeTrackingRole> { }
export interface TimeTrackingEntriesTimeIndex extends IDocument<number, string> { }
export interface TimeTrackingEntriesGlobalTimeIndex extends IDocument<string, string> { }
export interface TimeTrackingCustomersDocument extends IDocument<string, TimeTrackingCustomer> { }
export interface TimeTrackingBudgetsDocument extends IDocument<string, TimeTrackingBudget> { }
export interface TimeTrackingEstimateEntriesDocument extends IDocument<string, TimeTrackingEstimateEntry> { }

export interface IEntityFactory<TEntity, TDocument extends IDocument<string, TEntity>> {
    itemConstructor(x: any): TEntity;
    itemSerializer(x: TEntity): any;
    createGridColumns(): IGridColumn[];
    createHierarchyGridColumns(): IGridColumn[];
    createDocumentId(workItemId?: number): string;
    createExportColumns(): [{ (t: TEntity): number | string | Date | boolean; }, IExcelColumnFormatOptions][];
}

export interface ICustomDocumentFactory<TDocument extends ICustomDocument> {
    deserializer(x: any): TDocument;
    serializer(x: any): void;
    createDocumentId(id: string): string;
}