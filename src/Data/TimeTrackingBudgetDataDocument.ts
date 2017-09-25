import { TimeTrackingBudget, TimeTrackingBudgetFactory } from './TimeTrackingBudget';
import { ICustomDocument, ICustomDocumentFactory } from './Contract';

export class TimeTrackingBudgetDataDocument implements ICustomDocument {
    constructor(public id: string, public budget: TimeTrackingBudget, public budgetHours: number, public budgetCost: number, public queryId: string, public queryLink: string, public assignedHours = 0, public assignedCost = 0, public usedHours = 0, public usedCost = 0, public workItems = new Set<number>()) {
    }
}

export class TimeTrackingBudgetDataDocumentFactory implements ICustomDocumentFactory<TimeTrackingBudgetDataDocument> {
    deserializer(x: any): TimeTrackingBudgetDataDocument {
        x.budget = TimeTrackingBudgetFactory.prototype.itemConstructor(x.budget);
        x.workItems = new Set<number>(x.workItems);
        return <TimeTrackingBudgetDataDocument>x;
    }

    serializer(x: any): any {
        x.budget = TimeTrackingBudgetFactory.prototype.itemSerializer(x.budget);
        x.workItems = x.workItems ? Array.from(x.workItems.keys()) : [];
        return x;
    }

    createDocumentId(id: string): string {
        return `tae.bd.${id}`;
    }
}