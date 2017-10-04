import { TimeTrackingCustomersDocument } from './../Data/Contract';
import { TimeTrackingCustomer, TimeTrackingCustomerFactory } from './../Data/TimeTrackingCustomer';
import { BasicDataGrid, IBaseDataGridOptions, BaseDataGridCreateDialogType } from '../Base/BasicDataGrid';
import { getCurrentProject, getDocument } from '../Data/DataServiceHelper';
import { addTextbox, addToggle } from '../UIHelper/ModalDialogHelper';
import * as Q from 'q';

export class TimesSettingsCustomerGrid extends BasicDataGrid<TimeTrackingCustomer, TimeTrackingCustomersDocument, TimeTrackingCustomerFactory> {
    constructor() {
        let gridOptions = <IBaseDataGridOptions>{
            selector: '#timesCustomersContainer',
            entityName: 'Customer',
            sortIndex: 'name',
            hasHiddenElements: true
        };

        super(gridOptions, new TimeTrackingCustomerFactory());
    }

    getKey(value: TimeTrackingCustomer): string {
        return value.name;
    }

    filterValue(value: TimeTrackingCustomer, status: boolean): boolean {
        return value.isActive || status;
    }

    validate(container: JQuery, type: BaseDataGridCreateDialogType, entry?: TimeTrackingCustomer, self?: TimesSettingsCustomerGrid): boolean {
        if (!entry) {
            let name = container.find('#name').val();

            if (!name || self.document.map.has(<string>name))
                return false;
        }

        return true;
    }

    createDialogUIControls(dialogUI: JQuery<HTMLElement>, hasEntry: boolean, self: TimesSettingsCustomerGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingCustomer): IPromise<void> {
        addTextbox(dialogUI, 'Name', 'name', true, hasEntry ? entry.name : undefined, hasEntry);
        addToggle(dialogUI, 'Is Active?', 'isActive', hasEntry ? entry.isActive : true, false);
        return Q();
    }

    createValue(container: JQuery, self: TimesSettingsCustomerGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingCustomer): TimeTrackingCustomer {
        let isActive = $("#isActive").is(':checked');

        if (entry) {
            entry.isActive = isActive;
            return entry;
        } else {
            return new TimeTrackingCustomer(<string>container.find('#name').val(), isActive);
        }
    }

    afterCreateEntry(entry: TimeTrackingCustomer, type: BaseDataGridCreateDialogType, self: TimesSettingsCustomerGrid): IPromise<void> {
        return Q(undefined);
    }

    determineEntityDialogType(entity: TimeTrackingCustomer): BaseDataGridCreateDialogType {
        return 'create';
    }

    beforeEditEntry(entry: TimeTrackingCustomer, type: BaseDataGridCreateDialogType, self: TimesSettingsCustomerGrid): void {
    }

    afterEditEntry(entry: TimeTrackingCustomer, type: BaseDataGridCreateDialogType, self: TimesSettingsCustomerGrid): IPromise<void> {
        return Q(undefined);
    }

    afterDeleteEntry(entry: TimeTrackingCustomer, type: BaseDataGridCreateDialogType, self: TimesSettingsCustomerGrid): IPromise<void> {
        return Q(undefined);
    }
}