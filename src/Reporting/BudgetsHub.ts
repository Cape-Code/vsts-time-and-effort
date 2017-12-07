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

    public init(services: any): void {
        hasAccess().then((res) => {
            let c = $('#hubContainer');

            if (res) {
                this.notification = createNotification(c);
                this.wait = createWaitControl(c);
                let outerContainer = $('<div class="outerContainer" />');
                outerContainer.appendTo(c);
                let stats = $('<div class="stats" />');
                stats.appendTo(outerContainer);
                let container = $('<div class="container" />');
                container.appendTo(outerContainer);
                this.wait.startWait();

                TimeTrackingBudgetFactory.getBudgets().then((budgets) => {
                    let promises = [];

                    budgets.map.forEach((value, key) => {
                        if (value.end > new Date())
                            promises.push(getCustomDocument(value.budgetDataDocumentId, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer));
                    });

                    Q.all<TimeTrackingBudgetDataDocument>(promises).then((data) => {
                        let agg = new Map<string, BudgetReportingData>();

                        data.sort((a, b) => {
                            if (a.budget.end > b.budget.end)
                                return 1;
                            if (a.budget.end < b.budget.end)
                                return -1;
                            return 0;
                        }).forEach((value) => {
                            if (!agg.has(value.budget.customer.name))
                                agg.set(value.budget.customer.name, new BudgetReportingData());
                            agg.get(value.budget.customer.name).addBudget(value);

                            let element = $('<div class="budget" />');
                            container.append(element);
                            element.append($(`<div class="title"><a href="${value.queryLink}" target="_parent">${value.budget.name} (${value.budget.customer.name})</a></div>`));
                            element.append($(`<div class="dates">${format(value.budget.start)} - ${format(value.budget.end)}</div>`));
                            new BulletGraph(element, 'Effort', 'in hours', value.budget.hours, value.usedHours, value.assignedHours, element[0].getBoundingClientRect().width, false);
                            new BulletGraph(element, 'Cost', `in ${getNumberFormat().CurrencySymbol}`, value.budget.cost, value.usedCost, value.assignedCost, element[0].getBoundingClientRect().width, false);
                        });

                        let customers = Array.from(agg.keys());

                        if (customers.length > 0) {
                            services.ChartsService.getService().then((chartService) => {
                                this.makePieChart(customers, (c) => agg.get(c).budgetHours, stats, chartService);
                                this.makePieChart(customers, (c) => agg.get(c).usedHours, stats, chartService);
                                this.makePieChart(customers, (c) => agg.get(c).budgetCost, stats, chartService);
                                this.makePieChart(customers, (c) => agg.get(c).usedCost, stats, chartService);
                                this.wait.endWait();
                            });
                        } else
                            this.wait.endWait();
                    });
                });
            } else {
                createNotification(c).setError($("<span />").html('You are not authorized to view this page!'));
            }
        });
    }

    protected makePieChart(labels: string[], dataFn: (label: string) => number, container: JQuery, chartService: any): any {
        let options = {
            hostOptions: {
                height: 240,
                width: 240
            },
            chartType: 'pie',
            series: [{
                data: labels.map((l) => dataFn(l)),
            }],
            xAxis: {
                labelValues: labels
            },
            specializedOptions: {
                showLabels: true,
                size: 200
            }
        };

        chartService.createChart(container, options);
    }
}

export class BudgetReportingData {
    constructor(public budgetHours = 0, public assignedHours = 0, public usedHours = 0, public budgetCost = 0, public assignedCost = 0, public usedCost = 0) {
    }

    addBudget(budgetData: TimeTrackingBudgetDataDocument) {
        this.budgetHours += budgetData.budget.hours;
        this.assignedHours += budgetData.assignedHours;
        this.usedHours += budgetData.usedHours;
        this.budgetCost += budgetData.budget.cost;
        this.assignedCost += budgetData.assignedCost;
        this.usedCost += budgetData.usedCost;
    }
}