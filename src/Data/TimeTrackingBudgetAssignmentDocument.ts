import { TimeTrackingBudget, TimeTrackingBudgetFactory } from './TimeTrackingBudget';
import { ICustomDocument, ICustomDocumentFactory } from './Contract';

export class TimeTrackingBudgetAssignmentDocument implements ICustomDocument {
    constructor(public id: string, public budgetDataId?: string) {
    }
}

export class TimeTrackingBudgetAssignmentDocumentFactory implements ICustomDocumentFactory<TimeTrackingBudgetAssignmentDocument> {
    deserializer(x: any): TimeTrackingBudgetAssignmentDocument {
        if (x.budget) {
            x.budget = TimeTrackingBudgetFactory.prototype.itemConstructor(x.budget);
            x.budgetDataId = x.budget.budgetDataDocumentId;
        }
        return <TimeTrackingBudgetAssignmentDocument>x;
    }

    serializer(x: any): any {
        if (x.budget)
            x.budget = undefined;
        return x;
    }

    createDocumentId(id: string): string {
        return `tae.${id}.ba`;
    }
}