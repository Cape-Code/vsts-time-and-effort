import { TimeTrackingRole, TimeTrackingRoleFactory } from './TimeTrackingRole';
import { TimeTrackingBudget, TimeTrackingBudgetFactory } from './TimeTrackingBudget';
import { ICustomDocument, ICustomDocumentFactory } from './Contract';

export class TimeTrackingBudgetDataDocument implements ICustomDocument {
    constructor(public id: string, public budget: TimeTrackingBudget, public queryId: string, public queryLink: string, public roles: Map<string, TimeTrackingRole> = new Map<string, TimeTrackingRole>(), public assignedHours = 0, public assignedCost = 0, public usedHours = 0, public usedCost = 0, public workItems = new Set<number>(), public version = 0) {
    }
}

export class TimeTrackingBudgetDataDocumentFactory implements ICustomDocumentFactory<TimeTrackingBudgetDataDocument> {
    deserializer(x: any): TimeTrackingBudgetDataDocument {
        x.budget = TimeTrackingBudgetFactory.prototype.itemConstructor(x.budget);
        x.workItems = new Set<number>(x.workItems);

        let map = new Map<string, TimeTrackingRole>();
        if (x.roles) {
            x.roles.forEach((r) => {
                map.set(r[0], TimeTrackingRoleFactory.prototype.itemConstructor(r[1]));
            });
        }
        x.roles = map;

        return <TimeTrackingBudgetDataDocument>x;
    }

    serializer(x: any): any {
        x.budget = TimeTrackingBudgetFactory.prototype.itemSerializer(x.budget);
        x.workItems = x.workItems ? Array.from(x.workItems.keys()) : [];

        let ar = [];
        if (x.roles) {
            for (let kvp of x.roles.entries()) {
                ar.push([kvp[0], TimeTrackingRoleFactory.prototype.itemSerializer(kvp[1])]);
            }
        }
        x.roles = ar;

        return x;
    }

    createDocumentId(id: string): string {
        return `tae.bd.${id}`;
    }
}