import { getNumberFormat } from 'VSS/Utils/Culture';
import { BulletGraph } from './../Graph/BulletGraph';
import { TimeTrackingBudgetDataDocument, TimeTrackingBudgetDataDocumentFactory } from './../Data/TimeTrackingBudgetDataDocument';
import { TimeTrackingBudgetFactory } from './../Data/TimeTrackingBudget';
import { WaitControl } from 'VSS/Controls/StatusIndicator';
import { MessageAreaControl } from 'VSS/Controls/Notifications';
import { createNotification } from '../UIHelper/NotificationHelper';
import { createWaitControl } from '../UIHelper/WaitHelper';
import { hasAccess } from '../Auth/AuthHelper';
import { getCustomDocument } from '../Data/DataServiceHelper';
import * as Q from 'q';
import { format } from '../Data/Date';

export class BudgetsHub {
    private wait: WaitControl;
    private notification: MessageAreaControl;

    public init(): void {
        hasAccess().then((res) => {
            let c = $('#hubContainer');

            if (res) {
                this.notification = createNotification(c);
                this.wait = createWaitControl(c);
                let container = $('<div class="container" />');
                container.appendTo(c);
                this.wait.startWait();

                TimeTrackingBudgetFactory.getBudgets().then((budgets) => {
                    let promises = [];

                    budgets.map.forEach((value, key) => {
                        if (value.end > new Date())
                            promises.push(getCustomDocument(value.budgetDataDocumentId, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer));
                    });

                    Q.all<TimeTrackingBudgetDataDocument>(promises).then((data) => {
                        data.sort((a, b) => {
                            if (a.budget.end > b.budget.end)
                                return 1;
                            if (a.budget.end < b.budget.end)
                                return -1;
                            return 0;
                        }).forEach((value) => {
                            let element = $('<div class="budget" />');
                            container.append(element);
                            element.append($(`<div class="title"><a href="${value.queryLink}" target="_parent">${value.budget.name} (${value.budget.customer.name})</a></div>`));
                            element.append($(`<div class="dates">${format(value.budget.start)} - ${format(value.budget.end)}</div>`));
                            new BulletGraph(element, 'Effort', 'in hours', value.budget.hours, value.usedHours, value.assignedHours, element[0].getBoundingClientRect().width, false);
                            new BulletGraph(element, 'Cost', `in ${getNumberFormat().CurrencySymbol}`, value.budget.cost, value.usedCost, value.assignedCost, element[0].getBoundingClientRect().width, false);
                        });

                        this.wait.endWait();
                    });
                });
            } else {
                createNotification(c).setError($("<span />").html('You are not authorized to view this page!'));
            }
        });
    }
}