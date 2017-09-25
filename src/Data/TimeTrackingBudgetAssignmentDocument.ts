import { TimeTrackingBudget, TimeTrackingBudgetFactory } from './TimeTrackingBudget';
import { ICustomDocument, ICustomDocumentFactory } from './Contract';

export class TimeTrackingBudgetAssignmentDocument implements ICustomDocument {
    constructor(public id: string, public budget?: TimeTrackingBudget) {
    }
}

export class TimeTrackingBudgetAssignmentDocumentFactory implements ICustomDocumentFactory<TimeTrackingBudgetAssignmentDocument> {
    deserializer(x: any): TimeTrackingBudgetAssignmentDocument {
        if (x.budget)
            x.budget = TimeTrackingBudgetFactory.prototype.itemConstructor(x.budget);
        return <TimeTrackingBudgetAssignmentDocument>x;
    }

    serializer(x: any): any {
        if (x.budget)
            x.budget = TimeTrackingBudgetFactory.prototype.itemSerializer(x.budget);
        return x;
    }

    createDocumentId(id: string): string {
        return `tae.${id}.ba`;
    }
}