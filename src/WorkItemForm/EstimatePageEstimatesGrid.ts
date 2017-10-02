import { TimeTrackingBudgetDataDocumentFactory } from './../Data/TimeTrackingBudgetDataDocument';
import { TimeTrackingBudgetAssignmentDocument, TimeTrackingBudgetAssignmentDocumentFactory } from './../Data/TimeTrackingBudgetAssignmentDocument';
import { TimeTrackingRoleFactory } from './../Data/TimeTrackingRole';
import { IBaseDataGridOptions } from './../Base/BasicDataGrid';
import { TimeTrackingEstimateEntry, TimeTrackingEstimateEntryFactory } from './../Data/TimeTrackingEstimateEntry';
import { TimeTrackingRolesDocument, TimeTrackingEstimateEntriesDocument } from './../Data/Contract';
import { BasicDataGrid, BaseDataGridCreateDialogType } from '../Base/BasicDataGrid';
import { addComboBox, addNumber, addTextArea, addTreePicker } from '../UIHelper/ModalDialogHelper';
import { newGuid } from '../Data/Guid';
import { getWorkItemAncestorHierarchy, IWorkItemInfo, updateBudget } from '../WorkItemHelper/WorkItemHelper';
import { getDocument, getCustomDocument } from '../Data/DataServiceHelper';
import * as Q from 'q';

export class EstimatePageEstimatesGrid extends BasicDataGrid<TimeTrackingEstimateEntry, TimeTrackingEstimateEntriesDocument, TimeTrackingEstimateEntryFactory> {
    private roles: TimeTrackingRolesDocument;

    constructor(workItemId: number) {
        let gridOptions = <IBaseDataGridOptions>{
            selector: '#estimateContainer',
            entityName: 'Estimate',
            sortIndex: 'role',
            workItemId: workItemId,
            indexType: 'estimate',
            height: '750px'
        };

        super(gridOptions, new TimeTrackingEstimateEntryFactory());
    }

    private _getRoles(): IPromise<TimeTrackingRolesDocument> {
        return Q.all([
            TimeTrackingRoleFactory.getRoles(),
            getCustomDocument(TimeTrackingBudgetAssignmentDocumentFactory.prototype.createDocumentId(this.options.workItemId.toString()), TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer),
        ]).spread((roles: TimeTrackingRolesDocument, assignment: TimeTrackingBudgetAssignmentDocument) => {
            if (assignment.budgetDataId) {
                return getCustomDocument(assignment.budgetDataId, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer).then((data) => {
                    data.roles.forEach((value, key) => {
                        roles.map.set(key, value);
                    });

                    this.roles = roles;
                    return roles;
                });
            } else {
                this.roles = roles;
                return roles;
            }
        });
    }

    getKey(value: TimeTrackingEstimateEntry): string {
        return value.id;
    }

    filterValue(value: TimeTrackingEstimateEntry, status: boolean) {
        return true;
    }

    validate(container: JQuery, type: BaseDataGridCreateDialogType, validateNew?: boolean, self?: EstimatePageEstimatesGrid): boolean {
        let role = <string>container.find('#role_txt').val();
        let hours = parseFloat(<string>container.find('#hours').val());

        return role !== '' && !isNaN(hours);
    }

    createDialogUIControls(dialogUI: JQuery<HTMLElement>, hasEntry: boolean, self: EstimatePageEstimatesGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingEstimateEntry): IPromise<void> {
        if (type === 'create') {
            return self._getRoles().then((roles) => {
                addComboBox(dialogUI, 'Role', 'role', true, hasEntry ? entry.role : undefined, hasEntry, Array.from(roles.map.values()), (v) => v.name);
                addNumber(dialogUI, 'Hours', 'hours', 0.0, 24.0, 0.25, true, hasEntry ? entry.hours : undefined, false);
                addTextArea(dialogUI, 'Description', 'description', false, hasEntry ? entry.description : undefined, false);
                return undefined;
            });
        } else {
            return getWorkItemAncestorHierarchy(self.options.workItemId).then((parents) => {
                let idx = new Map<number, string>();
                parents.forEach((p) => {
                    idx.set(p.workItemId, TimeTrackingEstimateEntryFactory.prototype.createDocumentId(p.workItemId));
                });

                return Q.all(parents.map((p) => TimeTrackingEstimateEntryFactory.getEstimates(p.workItemId))).then((estimates) => {
                    let idx2 = new Map<string, TimeTrackingEstimateEntriesDocument>();
                    estimates.forEach((e) => {
                        idx2.set(e.id, e);
                    });

                    let dataSource = parents.filter((p) => idx2.get(idx.get(p.workItemId)).map.size > 0).map((p) => {
                        let children = [];

                        for (let v of idx2.get(idx.get(p.workItemId)).map.values()) {
                            children.push({ id: v.id, text: `${v.role.name}: ${v.hours}${v.description ? ' - ' + v.description : ''}` });
                        }

                        return {
                            root: true,
                            text: `${p.type}: ${p.workItemName}`,
                            children: children
                        }
                    });

                    addTreePicker(dialogUI, 'Parent', 'parent', true, hasEntry, dataSource);
                    addNumber(dialogUI, 'Hours', 'hours', 0.0, 24.0, 0.25, true, hasEntry ? entry.hours : undefined, false);
                    return undefined;
                });
            });
        }
    }

    createValue(container: JQuery, self: EstimatePageEstimatesGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingEstimateEntry): TimeTrackingEstimateEntry {
        let role = <string>container.find('#role_txt').val();
        let roleElement = self.roles.map.has(role) ? self.roles.map.get(role) : undefined;
        let hours = parseFloat(<string>container.find('#hours').val());
        let description = <string>container.find('#description').val();

        if (entry) {
            entry.hours = hours;
            entry.description = description;
            return entry;
        } else {
            return new TimeTrackingEstimateEntry(newGuid(), roleElement, hours, description, undefined, undefined);
        }
    }

    afterCreateEntry(entry: TimeTrackingEstimateEntry, type: BaseDataGridCreateDialogType, self: EstimatePageEstimatesGrid): IPromise<void> {
        return updateBudget(self.options.workItemId, (data) => {
            data.assignedHours += entry.hours;
            data.assignedCost += entry.hours * entry.role.cost;
        }).then(() => undefined);
    }

    determineEntityDialogType(entity: TimeTrackingEstimateEntry): BaseDataGridCreateDialogType {
        return entity.assignedFromParentWorkItemId ? 'assign' : 'create';
    }

    private oldHours: number;

    beforeEditEntry(entry: TimeTrackingEstimateEntry, type: BaseDataGridCreateDialogType, self: EstimatePageEstimatesGrid): void {
        self.oldHours = entry.hours;
    }

    afterEditEntry(entry: TimeTrackingEstimateEntry, type: BaseDataGridCreateDialogType, self: EstimatePageEstimatesGrid): IPromise<void> {
        if (self.oldHours !== entry.hours) {
            let diff = entry.hours - self.oldHours;
            return updateBudget(self.options.workItemId, (data) => {
                data.assignedHours += diff;
                data.assignedCost += diff * entry.role.cost;
            }).then(() => undefined);;
        } else {
            return Q(undefined);
        }
    }

    afterDeleteEntry(entry: TimeTrackingEstimateEntry, type: BaseDataGridCreateDialogType, self: EstimatePageEstimatesGrid): IPromise<void> {
        return updateBudget(self.options.workItemId, (data) => {
            data.assignedHours -= entry.hours;
            data.assignedCost -= entry.hours * entry.role.cost;
        }).then(() => undefined);
    }
}