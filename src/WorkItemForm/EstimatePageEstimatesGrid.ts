import { Combo } from 'VSS/Controls/Combos';
import { TimeTrackingBudgetDataDocumentFactory } from './../Data/TimeTrackingBudgetDataDocument';
import { TimeTrackingBudgetAssignmentDocument, TimeTrackingBudgetAssignmentDocumentFactory } from './../Data/TimeTrackingBudgetAssignmentDocument';
import { TimeTrackingRoleFactory, TimeTrackingRole } from './../Data/TimeTrackingRole';
import { IBaseDataGridOptions } from './../Base/BasicDataGrid';
import { TimeTrackingEstimateEntry, TimeTrackingEstimateEntryFactory } from './../Data/TimeTrackingEstimateEntry';
import { TimeTrackingRolesDocument, TimeTrackingEstimateEntriesDocument } from './../Data/Contract';
import { BasicDataGrid, BaseDataGridCreateDialogType } from '../Base/BasicDataGrid';
import { addComboBox, addNumber, addTextArea, addTextbox } from '../UIHelper/ModalDialogHelper';
import { newGuid } from '../Data/Guid';
import { getWorkItemAncestorHierarchy, IWorkItemInfo, updateBudget, getWorkItemInfo } from '../WorkItemHelper/WorkItemHelper';
import { getDocument, getCustomDocument, getDocumentById, updateDocument } from '../Data/DataServiceHelper';
import * as Q from 'q';

export class EstimatePageEstimatesGrid extends BasicDataGrid<TimeTrackingEstimateEntry, TimeTrackingEstimateEntriesDocument, TimeTrackingEstimateEntryFactory> {
    private roles: TimeTrackingRolesDocument;
    private parentCombo: Combo;
    private entryCombo: Combo;
    private parents: IWorkItemInfo[];
    private estimates: TimeTrackingEstimateEntry[];

    constructor(workItemId: number) {
        let gridOptions = <IBaseDataGridOptions>{
            selector: '#estimateContainer',
            entityName: 'Estimate',
            sortIndex: 'role',
            workItemId: workItemId,
            indexType: 'estimate',
            enableAssign: true
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

    validate(container: JQuery, type: BaseDataGridCreateDialogType, entry?: TimeTrackingEstimateEntry, self?: EstimatePageEstimatesGrid): boolean {
        let hours = parseFloat(<string>container.find('#hours').val());

        if (type === 'create') {
            let role = <string>container.find('#role_txt').val();

            return role !== '' && !isNaN(hours);
        } else {
            let max = parseFloat(container.find('#hours').attr('max'));

            if (!entry) {
                let parent = <string>container.find('#parent_txt').val();
                let estimate = <string>container.find('#entry_txt').val();

                return parent !== '' && estimate !== '' && !isNaN(hours) && hours <= max;
            } else
                return !isNaN(hours) && hours <= max;
        }
    }

    createDialogUIControls(dialogUI: JQuery<HTMLElement>, hasEntry: boolean, self: EstimatePageEstimatesGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingEstimateEntry): IPromise<void> {
        if (type === 'create') {
            return self._getRoles().then((roles) => {
                addComboBox(dialogUI, 'Role', 'role', true, hasEntry ? entry.role : undefined, false, Array.from(roles.map.values()), (v) => v.name);
                addNumber(dialogUI, 'Hours', 'hours', 0.0, 24.0, 0.25, true, hasEntry ? entry.hours : undefined, false);
                addTextArea(dialogUI, 'Description', 'description', false, hasEntry ? entry.description : undefined, false);
                return undefined;
            });
        } else {
            if (hasEntry) {
                return Q.all([
                    getWorkItemInfo(entry.assignedFromParentWorkItemId),
                    TimeTrackingEstimateEntryFactory.getEstimates(entry.assignedFromParentWorkItemId)
                ]).spread((workItem: IWorkItemInfo, estimates: TimeTrackingEstimateEntriesDocument) => {
                    addTextbox(dialogUI, 'Parent', 'parent', true, `${workItem.type}: ${workItem.workItemName}`, true);

                    let estimate = estimates.map.has(entry.assignedFromParentEstimateId) ? estimates.map.get(entry.assignedFromParentEstimateId) : undefined;

                    if (estimate) {
                        addTextbox(dialogUI, 'Entry', 'entry', true, `${estimate.role.name}: ${estimate.hours}${estimate.description ? ' - ' + estimate.description : ''}`, true);
                        addNumber(dialogUI, 'Hours', 'hours', 0.0, estimate.hours + entry.hours, 0.25, true, entry.hours, false);
                    }

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

                        self.parents = parents.filter((p) => {
                            let x = idx2.get(idx.get(p.workItemId));

                            if (x.map.size === 0)
                                return false;

                            return Array.from(x.map.values()).some((e) => e.hours > 0);
                        });
                        self.estimates = [];

                        let entrySelector = (e) => `${e.role.name}: ${e.hours}${e.description ? ' - ' + e.description : ''}`;

                        self.parentCombo = addComboBox(dialogUI, 'Parent', 'parent', true, undefined, false, self.parents, (p) => `${p.type}: ${p.workItemName}`, () => {
                            self.estimates = Array.from(idx2.get(idx.get(self.parents[self.parentCombo.getSelectedIndex()].workItemId)).map.values()).filter((e) => e.hours > 0);
                            self.entryCombo.setSource(self.estimates.map(entrySelector));
                            self.entryCombo.setEnabled(self.estimates.length > 0);
                            if (self.estimates.length === 1)
                                self.entryCombo.setSelectedIndex(0, true);
                        }, true);
                        self.entryCombo = addComboBox(dialogUI, 'Entry', 'entry', true, undefined, true, self.estimates, entrySelector, () => {
                            let hours = dialogUI.find('#hours');
                            if (self.estimates.length > 0) {
                                hours.attr('max', self.estimates[self.entryCombo.getSelectedIndex()].hours);
                                hours.prop('disabled', self.estimates.length === 0);
                            }
                        }, true);
                        addNumber(dialogUI, 'Hours', 'hours', 0.0, 24.0, 0.25, true, undefined, true);

                        if (self.parents.length === 1)
                            self.parentCombo.setSelectedIndex(0, true);

                        return undefined;
                    });
                });
            }
        }
    }

    createValue(container: JQuery, self: EstimatePageEstimatesGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingEstimateEntry): TimeTrackingEstimateEntry {
        let hours = parseFloat(<string>container.find('#hours').val());

        if (type === 'create') {
            let role = <string>container.find('#role_txt').val();
            let roleElement = self.roles.map.has(role) ? self.roles.map.get(role) : undefined;
            let description = <string>container.find('#description').val();

            if (entry) {
                entry.role = roleElement;
                entry.hours = hours;
                entry.description = description;
                return entry;
            } else {
                return new TimeTrackingEstimateEntry(newGuid(), roleElement, hours, description, undefined, undefined);
            }
        } else {
            if (entry) {
                entry.hours = hours;
                return entry;
            } else {
                let parent = self.parents[self.parentCombo.getSelectedIndex()];
                let estimate = self.estimates[self.entryCombo.getSelectedIndex()];
                return new TimeTrackingEstimateEntry(newGuid(), estimate.role, hours, estimate.description, parent.workItemId, estimate.id);
            }
        }
    }

    afterCreateEntry(entry: TimeTrackingEstimateEntry, type: BaseDataGridCreateDialogType, self: EstimatePageEstimatesGrid): IPromise<void> {
        return updateBudget(self.options.workItemId, (data) => {
            data.assignedHours += entry.hours;
            data.assignedCost += entry.hours * entry.role.cost;
        }).then(() => {
            if (type === 'assign') {
                return TimeTrackingEstimateEntryFactory.getEstimates(entry.assignedFromParentWorkItemId).then((doc) => {
                    let estimate = doc.map.get(entry.assignedFromParentEstimateId);
                    estimate.hours -= entry.hours;
                    return updateDocument(doc, TimeTrackingEstimateEntryFactory.prototype.itemConstructor, TimeTrackingEstimateEntryFactory.prototype.itemSerializer).then(() => {
                        return updateBudget(entry.assignedFromParentWorkItemId, (data) => {
                            data.assignedHours -= entry.hours;
                            data.assignedCost -= entry.hours * estimate.role.cost;
                        }).then(() => undefined);
                    });
                });
            } else
                return undefined;
        });
    }

    determineEntityDialogType(entity: TimeTrackingEstimateEntry): BaseDataGridCreateDialogType {
        return entity.assignedFromParentWorkItemId ? 'assign' : 'create';
    }

    private oldHours: number;
    private oldRole: TimeTrackingRole;

    beforeEditEntry(entry: TimeTrackingEstimateEntry, type: BaseDataGridCreateDialogType, self: EstimatePageEstimatesGrid): void {
        self.oldHours = entry.hours;
        self.oldRole = entry.role;
    }

    afterEditEntry(entry: TimeTrackingEstimateEntry, type: BaseDataGridCreateDialogType, self: EstimatePageEstimatesGrid): IPromise<void> {
        if (self.oldHours !== entry.hours || self.oldRole.name !== entry.role.name) {
            let diff = entry.hours - self.oldHours;
            let costDiff = entry.hours * entry.role.cost - self.oldHours * self.oldRole.cost;
            return updateBudget(self.options.workItemId, (data) => {
                data.assignedHours += diff;
                data.assignedCost += costDiff;
            }).then(() => {
                if (type === 'assign') {
                    return TimeTrackingEstimateEntryFactory.getEstimates(entry.assignedFromParentWorkItemId).then((doc) => {
                        if (doc.map.has(entry.assignedFromParentEstimateId)) {
                            let estimate = doc.map.get(entry.assignedFromParentEstimateId);
                            estimate.hours -= diff;
                            return updateDocument(doc, TimeTrackingEstimateEntryFactory.prototype.itemConstructor, TimeTrackingEstimateEntryFactory.prototype.itemSerializer).then(() => {
                                return updateBudget(entry.assignedFromParentWorkItemId, (data) => {
                                    data.assignedHours -= diff;
                                    data.assignedCost -= diff * estimate.role.cost;
                                }).then(() => undefined);
                            });
                        } else
                            return undefined;
                    });
                } else
                    return undefined;
            });;
        } else {
            return Q(undefined);
        }
    }

    afterDeleteEntry(entry: TimeTrackingEstimateEntry, type: BaseDataGridCreateDialogType, self: EstimatePageEstimatesGrid): IPromise<void> {
        return updateBudget(self.options.workItemId, (data) => {
            data.assignedHours -= entry.hours;
            data.assignedCost -= entry.hours * entry.role.cost;
        }).then(() => {
            if (type === 'assign') {
                return TimeTrackingEstimateEntryFactory.getEstimates(entry.assignedFromParentWorkItemId).then((doc) => {
                    if (doc.map.has(entry.assignedFromParentEstimateId)) {
                        let estimate = doc.map.get(entry.assignedFromParentEstimateId);
                        estimate.hours += entry.hours;
                        return updateDocument(doc, TimeTrackingEstimateEntryFactory.prototype.itemConstructor, TimeTrackingEstimateEntryFactory.prototype.itemSerializer).then(() => {
                            return updateBudget(entry.assignedFromParentWorkItemId, (data) => {
                                data.assignedHours += entry.hours;
                                data.assignedCost += entry.hours * estimate.role.cost;
                            }).then(() => undefined);
                        });
                    } else
                        return undefined;
                });
            } else
                return undefined;
        });
    }
}