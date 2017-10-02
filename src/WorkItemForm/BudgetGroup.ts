import { MessageAreaControl } from 'VSS/Controls/Notifications';
import { TimeTrackingBudgetsDocument } from './../Data/Contract';
import { IComboOptions, Combo } from 'VSS/Controls/Combos';
import { TimeTrackingBudgetAssignmentDocument, TimeTrackingBudgetAssignmentDocumentFactory } from './../Data/TimeTrackingBudgetAssignmentDocument';
import { TimeTrackingBudgetDataDocument, TimeTrackingBudgetDataDocumentFactory } from './../Data/TimeTrackingBudgetDataDocument';
import { TimeTrackingBudget, TimeTrackingBudgetFactory } from './../Data/TimeTrackingBudget';
import { getNumberFormat } from 'VSS/Utils/Culture';
import { BulletGraph } from '../Graph/BulletGraph';
import { WaitControl } from 'VSS/Controls/StatusIndicator';
import { EstimatePageEstimateHierarchyGrid, IWorkItemEstimateHierarchy } from './EstimatePageEstimateHierarchyGrid';
import { TimesPageTimeHierarchyGrid, IWorkItemTimeHierarchy } from './TimesPageTimeHierarchyGrid';
import { getWorkItemHierarchy, loadBudgetAssignment, reassignBudget } from '../WorkItemHelper/WorkItemHelper';
import { WorkItemFormService, IWorkItemFormService } from 'TFS/WorkItemTracking/Services';
import * as Q from 'q';
import { createWaitControl } from '../UIHelper/WaitHelper';
import { getCustomDocument, updateCustomDocument } from '../Data/DataServiceHelper';
import { create } from 'VSS/Controls';
import { createNotification } from '../UIHelper/NotificationHelper';
import { hasAccess } from "../Auth/AuthHelper";

export class BudgetGroup {
    private wait: WaitControl;
    private budgetData: TimeTrackingBudgetDataDocument;
    private budgets: TimeTrackingBudgetsDocument;
    private notification: MessageAreaControl;
    private service: IWorkItemFormService;

    private _getBudgets(): IPromise<TimeTrackingBudgetsDocument> {
        return TimeTrackingBudgetFactory.getBudgets().then((budgets) => {
            this.budgets = budgets;
            return budgets;
        });
    }

    public init(): void {
        let extensionContext = VSS.getExtensionContext();
        VSS.register(`${extensionContext.publisherId}.${extensionContext.extensionId}.tae-budget-group`, () => {
            return {
                onLoaded: (args) => { this._render(args.id) },
                onSaved: (args) => { this._render(args.id) },
                onReset: (args) => { this._render(args.id) },
                onRefreshed: (args) => { this._render(args.id) }
            }
        });
    }

    private _render(id: number): void {
        if (id !== 0) {
            hasAccess().then((res) => {
                if (res) {
                    WorkItemFormService.getService().then(service => {
                        this.service = service;
                        let container = $('.budget-container');
                        this.notification = createNotification(container);
                        let containerEffort = $('.effort-chart-container');
                        let containerCost = $('.cost-chart-container');

                        this.wait = createWaitControl(container);
                        this.wait.startWait();

                        loadBudgetAssignment(id).then((budget) => {
                            this._createBudgetSelect(id, budget ? budget.budget : undefined);

                            if (budget) {
                                containerEffort.show();
                                containerCost.show();
                                new BulletGraph(containerEffort, 'Effort', 'in hours', budget.budget.hours, budget.usedHours, budget.assignedHours, containerEffort[0].getBoundingClientRect().width);
                                new BulletGraph(containerCost, 'Cost', `in ${getNumberFormat().CurrencySymbol}`, budget.budget.cost, budget.usedCost, budget.assignedCost, containerCost[0].getBoundingClientRect().width);
                            } else {
                                containerEffort.hide();
                                containerCost.hide();
                            }

                            this.wait.endWait();
                        }, (reason) => {
                            this.notification.setError($("<span />").html(reason));
                            this.wait.endWait();
                        });
                    });
                }
            });
        }
    }

    private _createBudgetSelect(workItemId: number, initialValue?: TimeTrackingBudget) {
        let container = $('#budgetSelect');
        container.empty();

        this._getBudgets().then((budgets) => {
            let data = Array.from(budgets.map.values());

            let options: IComboOptions = {
                id: 'budget',
                allowEdit: false,
                enabled: true,
                mode: 'drop',
                source: data.map((v) => v.toString()),
                value: initialValue ? initialValue.toString() : undefined,
                disableTextSelectOnFocus: true,
                indexChanged: (idx) => {
                    this.wait.startWait();

                    reassignBudget(workItemId, undefined, initialValue ? initialValue.budgetDataDocumentId : undefined, data[idx].budgetDataDocumentId).then((res) => {
                        this.service.isDirty().then((isDirty) => {
                            if (isDirty) {
                                this.service.save().then(() => {
                                    this.wait.endWait();
                                });
                            } else {
                                this.service.refresh().then(() => {
                                    this.wait.endWait();
                                });
                            }
                        });
                    }, (reason) => {
                        this.notification.setError($("<span />").html(reason));
                        this.wait.endWait();
                    });
                }
            };

            create(Combo, container, options);
        });
    }
}