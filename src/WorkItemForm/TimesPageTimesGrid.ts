import { TimeTrackingBudgetDataDocumentFactory } from './../Data/TimeTrackingBudgetDataDocument';
import { TimeTrackingBudgetAssignmentDocumentFactory, TimeTrackingBudgetAssignmentDocument } from './../Data/TimeTrackingBudgetAssignmentDocument';
import { TimeTrackingRoleFactory, TimeTrackingRole } from './../Data/TimeTrackingRole';
import { TimeTrackingEntryFactory, TimeTrackingEntry } from './../Data/TimeTrackingEntry';
import { IBaseDataGridOptions } from './../Base/BasicDataGrid';
import { TimeTrackingRolesDocument, TimeTrackingEntriesDocument, TimeTrackingEntriesTimeIndex } from './../Data/Contract';
import { BasicDataGrid, BaseDataGridCreateDialogType } from '../Base/BasicDataGrid';
import { addComboBox, addNumber, addTextArea, addTextbox, addDatePicker } from '../UIHelper/ModalDialogHelper';
import { newGuid } from '../Data/Guid';
import { parseDate } from '../Data/Date';
import { getTimeIndex, updateDocument, getCurrentProject, getCustomDocument } from '../Data/DataServiceHelper';
import { updateBudget } from "../WorkItemHelper/WorkItemHelper";
import * as Q from "q";

export class TimesPageTimesGrid extends BasicDataGrid<TimeTrackingEntry, TimeTrackingEntriesDocument, TimeTrackingEntryFactory> {
    private roles: TimeTrackingRolesDocument;

    constructor(workItemId: number) {
        let gridOptions = <IBaseDataGridOptions>{
            selector: '#timesContainer',
            entityName: 'Time',
            sortIndex: 'date',
            sortOrder: 'desc',
            workItemId: workItemId,
            indexType: 'time',
            enableExport: true
        };

        super(gridOptions, new TimeTrackingEntryFactory());
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

    getKey(value: TimeTrackingEntry): string {
        return value.id;
    }

    filterValue(value: TimeTrackingEntry, status: boolean) {
        return true;
    }

    validate(container: JQuery, type: BaseDataGridCreateDialogType, entry?: TimeTrackingEntry, self?: TimesPageTimesGrid): boolean {
        let role = <string>container.find('#role_txt').val();
        let hours = parseFloat(<string>container.find('#hours').val());
        let date = container.find('#date').val();
        let description = container.find('#description').val();

        return role !== '' && !isNaN(hours) && date !== null && description !== '';
    }

    createDialogUIControls(dialogUI: JQuery<HTMLElement>, hasEntry: boolean, self: TimesPageTimesGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingEntry): IPromise<void> {
        return self._getRoles().then((roles) => {
            addTextbox(dialogUI, 'Person', 'person', true, hasEntry ? entry.person : VSS.getWebContext().user.name, true);
            addComboBox(dialogUI, 'Role', 'role', true, hasEntry ? entry.role : undefined, false, Array.from(roles.map.values()), (v) => v.name);
            addNumber(dialogUI, 'Hours spent', 'hours', 0.0, 24.0, 0.25, true, hasEntry ? entry.hours : undefined, false);
            addDatePicker(dialogUI, 'Date', 'date', true, hasEntry ? entry.date : new Date(), false);
            addTextArea(dialogUI, 'Description', 'description', true, hasEntry ? entry.description : undefined, false);
            return undefined;
        });
    }

    createValue(container: JQuery, self: TimesPageTimesGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingEntry): TimeTrackingEntry {
        let role = <string>container.find('#role_txt').val();
        let roleElement = self.roles.map.has(role) ? self.roles.map.get(role) : undefined;
        let hours = parseFloat(<string>container.find('#hours').val());
        let date = parseDate(<string>container.find('#date').val());
        let description = <string>container.find('#description').val();

        let user = VSS.getWebContext().user;

        if (entry) {
            entry.role = roleElement;
            entry.hours = hours;
            entry.date = date;
            entry.description = description;
            return entry;
        } else {
            return new TimeTrackingEntry(newGuid(), user.id, user.name, roleElement, hours, date, description);
        }
    }

    afterCreateEntry(entry: TimeTrackingEntry, type: BaseDataGridCreateDialogType, self: TimesPageTimesGrid): IPromise<void> {
        return self._updateTimeIndex(entry, self, false).then(() => {
            return updateBudget(self.options.workItemId, (data) => {
                data.usedHours += entry.hours;
                data.usedCost += entry.hours * entry.role.cost;
            }).then(() => undefined);
        });
    }

    determineEntityDialogType(entity: TimeTrackingEntry): BaseDataGridCreateDialogType {
        return 'create';
    }

    private oldHours: number;
    private oldRole: TimeTrackingRole;

    beforeEditEntry(entry: TimeTrackingEntry, type: BaseDataGridCreateDialogType, self: TimesPageTimesGrid): void {
        self.oldHours = entry.hours;
        self.oldRole = entry.role;
    }

    afterEditEntry(entry: TimeTrackingEntry, type: BaseDataGridCreateDialogType, self: TimesPageTimesGrid): IPromise<void> {
        return self._updateTimeIndex(entry, self, false).then(() => {
            if (self.oldHours !== entry.hours || self.oldRole.name !== entry.role.name) {
                let diff = entry.hours - self.oldHours;
                let costDiff = entry.hours * entry.role.cost - self.oldHours * self.oldRole.cost;
                return updateBudget(self.options.workItemId, (data) => {
                    data.usedHours += diff;
                    data.usedCost += costDiff;
                }).then(() => undefined);;
            } else {
                return undefined;
            }
        });
    }

    afterDeleteEntry(entry: TimeTrackingEntry, type: BaseDataGridCreateDialogType, self: TimesPageTimesGrid): IPromise<void> {
        let remove = true;
        let year = entry.date.getFullYear();
        let month = entry.date.getMonth();

        self.document.map.forEach((value, key) => {
            if (value.date.getFullYear() === year && value.date.getMonth() === month) {
                remove = false;
            }
        });
        return self._updateTimeIndex(entry, self, remove).then(() => {
            return updateBudget(self.options.workItemId, (data) => {
                data.usedHours -= entry.hours;
                data.usedCost -= entry.hours * entry.role.cost;
            }).then(() => undefined);
        });
    }

    private _updateTimeIndex(entry: TimeTrackingEntry, self: TimesPageTimesGrid, remove: boolean): IPromise<TimeTrackingEntriesTimeIndex> {
        return getTimeIndex(entry.date.getFullYear(), entry.date.getMonth()).then((index) => {
            if (remove) {
                if (index.map.has(self.options.workItemId)) {
                    index.map.delete(self.options.workItemId);
                    return updateDocument(index);
                }
            } else if (!index.map.has(self.options.workItemId)) {
                index.map.set(self.options.workItemId, TimeTrackingEntryFactory.prototype.createDocumentId(self.options.workItemId));
                return updateDocument(index);
            }
        });
    }
}