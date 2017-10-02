import { TimeTrackingRolesDocument } from './../Data/Contract';
import { TimeTrackingRole, TimeTrackingRoleFactory } from './../Data/TimeTrackingRole';
import { BasicDataGrid, IBaseDataGridOptions, BaseDataGridCreateDialogType } from '../Base/BasicDataGrid';
import { addTextbox, addNumber } from '../UIHelper/ModalDialogHelper';
import { getCurrentProject, getDocument } from '../Data/DataServiceHelper';
import * as Q from 'q';

export class TimesSettingsRoleGrid extends BasicDataGrid<TimeTrackingRole, TimeTrackingRolesDocument, TimeTrackingRoleFactory> {
    constructor() {
        let gridOptions = <IBaseDataGridOptions>{
            selector: '#timesSettingsContainer',
            entityName: 'Role',
            sortIndex: 'name'
        };

        super(gridOptions, new TimeTrackingRoleFactory());
    }

    getKey(value: TimeTrackingRole): string {
        return value.name;
    }

    filterValue(value: TimeTrackingRole, status: boolean): boolean {
        return true;
    }

    validate(container: JQuery, type: BaseDataGridCreateDialogType, validateNew?: boolean, self?: TimesSettingsRoleGrid): boolean {
        if (validateNew) {
            let name = container.find('#name').val();

            if (!name || self.document.map.has(<string>name))
                return false;
        }

        return container.find('#cost').val() !== null;
    }

    createDialogUIControls(dialogUI: JQuery<HTMLElement>, hasEntry: boolean, self: TimesSettingsRoleGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingRole): IPromise<void> {
        addTextbox(dialogUI, 'Name', 'name', true, hasEntry ? entry.name : undefined, hasEntry);
        addNumber(dialogUI, 'Cost per hour', 'cost', 0.0, 200.0, 5, true, hasEntry ? entry.cost : undefined, false);
        return Q();
    }

    createValue(container: JQuery, self: TimesSettingsRoleGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingRole): TimeTrackingRole {
        let cost = <number>container.find('#cost').val();

        if (entry) {
            entry.cost = cost;
            return entry;
        } else {
            return new TimeTrackingRole(<string>container.find('#name').val(), cost);
        }
    }

    afterCreateEntry(entry: TimeTrackingRole, type: BaseDataGridCreateDialogType, self: TimesSettingsRoleGrid): IPromise<void> {
        return Q(undefined);
    }

    determineEntityDialogType(entity: TimeTrackingRole): BaseDataGridCreateDialogType {
        return 'create';
    }

    beforeEditEntry(entry: TimeTrackingRole, type: BaseDataGridCreateDialogType, self: TimesSettingsRoleGrid): void {
    }

    afterEditEntry(entry: TimeTrackingRole, type: BaseDataGridCreateDialogType, self: TimesSettingsRoleGrid): IPromise<void> {
        return Q(undefined);
    }

    afterDeleteEntry(entry: TimeTrackingRole, type: BaseDataGridCreateDialogType, self: TimesSettingsRoleGrid): IPromise<void> {
        return Q(undefined);
    }
}