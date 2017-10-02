import { TimeTrackingBudgetDataDocument, TimeTrackingBudgetDataDocumentFactory } from './../Data/TimeTrackingBudgetDataDocument';
import { TimeTrackingBudget } from './../Data/TimeTrackingBudget';
import { TimeTrackingRolesDocument } from './../Data/Contract';
import { TimeTrackingRole, TimeTrackingRoleFactory } from './../Data/TimeTrackingRole';
import { BasicDataGrid, IBaseDataGridOptions, BaseDataGridCreateDialogType } from '../Base/BasicDataGrid';
import { addTextbox, addNumber, addComboBox } from '../UIHelper/ModalDialogHelper';
import { getCurrentProject, getDocument, updateCustomDocument } from '../Data/DataServiceHelper';
import * as Q from 'q';
import { updateRoleRates, ITimeTrackingData } from "../WorkItemHelper/WorkItemHelper";

export class TimesSettingsBudgetRoleGrid extends BasicDataGrid<TimeTrackingRole, TimeTrackingRolesDocument, TimeTrackingRoleFactory> {
    private roles: TimeTrackingRolesDocument;

    constructor(container: JQuery, budgetData: TimeTrackingBudgetDataDocument) {
        let gridOptions = <TimesSettingsBudgetRoleGridOptions>{
            selector: '<div />',
            entityName: 'Role',
            sortIndex: 'name',
            height: '100px',
            budgetData: budgetData
        };

        super(gridOptions, new TimeTrackingRoleFactory());

        container.append(this.container);
    }

    protected _loadDocument(): IPromise<TimeTrackingRolesDocument> {
        return Q({ __etag: 1, id: '1', serialized: [], map: this._getOptions().budgetData.roles });
    }

    protected _updateDocument(self: TimesSettingsBudgetRoleGrid): void {
        updateCustomDocument(this._getOptions().budgetData, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer, TimeTrackingBudgetDataDocumentFactory.prototype.serializer).then((doc) => {
            this._getOptions().budgetData = doc;
            self.document.map = doc.roles;
            self.grid.setDataSource(Array.from(self.document.map.values()));
            self.wait.endWait();
        }, (reason) => {
            self.notification.setError($("<span />").html(reason));
            self.wait.endWait();
        });
    }

    private _getOptions(self?: TimesSettingsBudgetRoleGrid): TimesSettingsBudgetRoleGridOptions {
        if (self)
            return <TimesSettingsBudgetRoleGridOptions>self.options;

        return <TimesSettingsBudgetRoleGridOptions>this.options;
    }

    private _getRoles(): IPromise<TimeTrackingRolesDocument> {
        return TimeTrackingRoleFactory.getRoles().then((roles) => {
            this.roles = roles;
            return roles;
        });
    }

    getKey(value: TimeTrackingRole): string {
        return value.name;
    }

    filterValue(value: TimeTrackingRole, status: boolean): boolean {
        return true;
    }

    validate(container: JQuery, type: BaseDataGridCreateDialogType, validateNew?: boolean, self?: TimesSettingsBudgetRoleGrid): boolean {
        if (validateNew) {
            let name = container.find('#role_txt').val();

            if (!name || self.document.map.has(<string>name))
                return false;
        }

        return container.find('#cost').val() !== null;
    }

    createDialogUIControls(dialogUI: JQuery<HTMLElement>, hasEntry: boolean, self: TimesSettingsBudgetRoleGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingRole): IPromise<void> {
        return self._getRoles().then((roles) => {
            addComboBox(dialogUI, 'Role', 'role', true, hasEntry ? entry : undefined, hasEntry, Array.from(roles.map.values()).filter((r) => { return !self.document.map.has(r.name) || hasEntry && r.name === entry.name; }), (r) => r.name);
            addNumber(dialogUI, 'Cost per hour', 'cost', 0.0, 200.0, 5, true, hasEntry ? entry.cost : undefined, false);
            return Q();
        });
    }

    createValue(container: JQuery, self: TimesSettingsBudgetRoleGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingRole): TimeTrackingRole {
        let cost = <number>container.find('#cost').val();

        if (entry) {
            entry.cost = cost;
            return entry;
        } else {
            return new TimeTrackingRole(<string>container.find('#role_txt').val(), cost);
        }
    }

    afterCreateEntry(entry: TimeTrackingRole, type: BaseDataGridCreateDialogType, self: TimesSettingsBudgetRoleGrid): IPromise<void> {
        return self._updateAllImpactedBookings(self);
    }

    determineEntityDialogType(entity: TimeTrackingRole): BaseDataGridCreateDialogType {
        return 'create';
    }

    beforeEditEntry(entry: TimeTrackingRole, type: BaseDataGridCreateDialogType, self: TimesSettingsBudgetRoleGrid): void {
    }

    afterEditEntry(entry: TimeTrackingRole, type: BaseDataGridCreateDialogType, self: TimesSettingsBudgetRoleGrid): IPromise<void> {
        return self._updateAllImpactedBookings(self);
    }

    afterDeleteEntry(entry: TimeTrackingRole, type: BaseDataGridCreateDialogType, self: TimesSettingsBudgetRoleGrid): IPromise<void> {
        return self._updateAllImpactedBookings(self);
    }

    private _updateAllImpactedBookings(self: TimesSettingsBudgetRoleGrid): IPromise<void> {
        let promises: IPromise<ITimeTrackingData>[] = [];

        let data = self._getOptions().budgetData;
        data.assignedCost = 0;
        data.assignedHours = 0;
        data.usedCost = 0;
        data.usedHours = 0;

        return self._getRoles().then((roles) => {
            data.workItems.forEach((wi) => {
                promises.push(updateRoleRates(wi, roles, data.roles));
            });

            return Q.all(promises).then((ttData) => {
                ttData.forEach((e) => {
                    data.assignedHours += e.estimates.hours;
                    data.assignedCost += e.estimates.cost;
                    data.usedHours += e.bookings.hours;
                    data.usedCost += e.bookings.cost;
                });

                return undefined;
            });
        });
    }
}

export interface TimesSettingsBudgetRoleGridOptions extends IBaseDataGridOptions {
    budgetData: TimeTrackingBudgetDataDocument;
}