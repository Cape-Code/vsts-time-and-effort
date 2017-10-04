import { TimesSettingsBudgetRoleGrid } from './TimesSettingsBudgetRoleGrid';
import { TimeTrackingRoleFactory } from './../Data/TimeTrackingRole';
import { QueryHierarchyItem } from 'TFS/WorkItemTracking/Contracts';
import { TimeTrackingBudgetAssignmentDocumentFactory } from './../Data/TimeTrackingBudgetAssignmentDocument';
import { TimeTrackingBudgetDataDocument, TimeTrackingBudgetDataDocumentFactory } from './../Data/TimeTrackingBudgetDataDocument';
import { TimeTrackingCustomerFactory } from './../Data/TimeTrackingCustomer';
import { TimeTrackingBudgetsDocument, TimeTrackingCustomersDocument } from './../Data/Contract';
import { TimeTrackingBudget, TimeTrackingBudgetFactory } from './../Data/TimeTrackingBudget';
import { BasicDataGrid, IBaseDataGridOptions, BaseDataGridCreateDialogType } from '../Base/BasicDataGrid';
import { getCurrentProject, getDocument, deleteDocument, createCustomDocumentWithValue, getCustomDocument, updateCustomDocument } from '../Data/DataServiceHelper';
import { addTextbox, addTextArea, addComboBox, addDatePicker, addNumber, addTitle } from '../UIHelper/ModalDialogHelper';
import { newGuid } from '../Data/Guid';
import { parseDate } from '../Data/Date';
import { createFolderIfNotExists, createQuery, deleteQuery } from '../WorkItemHelper/QueryHelper';
import * as Q from "q";

export class TimesSettingsBudgetGrid extends BasicDataGrid<TimeTrackingBudget, TimeTrackingBudgetsDocument, TimeTrackingBudgetFactory> {
    private customers: TimeTrackingCustomersDocument;
    private folder: QueryHierarchyItem;

    constructor() {
        let gridOptions = <IBaseDataGridOptions>{
            selector: '#timesBudgetsContainer',
            entityName: 'Budget',
            sortIndex: 'name',
            hasHiddenElements: true
        };

        createFolderIfNotExists(getCurrentProject(), 'Tracked Budgets').then((folder) => {
            this.folder = folder;
        });

        super(gridOptions, new TimeTrackingBudgetFactory());
    }

    private _getCustomers(): IPromise<TimeTrackingCustomersDocument> {
        return TimeTrackingCustomerFactory.getCustomers().then((customers) => {
            this.customers = customers;
            return customers;
        });
    }

    getKey(value: TimeTrackingBudget): string {
        return value.id;
    }

    filterValue(value: TimeTrackingBudget, status: boolean): boolean {
        return (value.end > new Date()) || status;
    }

    validate(container: JQuery, type: BaseDataGridCreateDialogType, entry?: TimeTrackingBudget, self?: TimesSettingsBudgetGrid): boolean {
        if (!entry) {
            let name = container.find('#name').val();

            if (!name || self.document.map.has(<string>name))
                return false;
        }

        let customer = <string>container.find('#customer_txt').val();
        let start = parseDate(<string>container.find('#start').val());
        let end = parseDate(<string>container.find('#end').val());

        return customer !== '' && start !== null && end !== null;
    }

    createDialogUIControls(dialogUI: JQuery<HTMLElement>, hasEntry: boolean, self: TimesSettingsBudgetGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingBudget): IPromise<void> {
        return Q.all([
            self._getCustomers(),
            hasEntry ? getCustomDocument(entry.budgetDataDocumentId, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer) : Q(undefined)
        ]).spread((customers: TimeTrackingCustomersDocument, data: TimeTrackingBudgetDataDocument) => {
            addTextbox(dialogUI, 'Name', 'name', true, hasEntry ? entry.name : undefined, hasEntry);
            addComboBox(dialogUI, 'Customer', 'customer', true, hasEntry ? entry.customer : undefined, false, Array.from(customers.map.values()).filter((v) => { return v.isActive; }), (v) => v.name);
            addDatePicker(dialogUI, 'Start', 'start', true, hasEntry ? entry.start : new Date(), false);
            addDatePicker(dialogUI, 'End', 'end', true, hasEntry ? entry.end : new Date(), false);
            addNumber(dialogUI, 'Hours', 'hours', 0.0, 100000000.0, 0.25, true, hasEntry ? entry.hours : undefined, false);
            addNumber(dialogUI, 'Cost', 'cost', 0.0, 10000000000.0, 10.0, true, hasEntry ? entry.cost : undefined, false);

            if (hasEntry)
                new TimesSettingsBudgetRoleGrid(addTitle(dialogUI, 'Roles'), data);

            addTextArea(dialogUI, 'Description', 'description', false, hasEntry ? entry.description : undefined, false);
            return undefined;
        });
    }

    createValue(container: JQuery, self: TimesSettingsBudgetGrid, type: BaseDataGridCreateDialogType, entry?: TimeTrackingBudget): TimeTrackingBudget {
        let customer = <string>container.find('#customer_txt').val();
        let customerElement = self.customers.map.has(customer) ? self.customers.map.get(customer) : undefined;
        let start = parseDate(<string>container.find('#start').val());
        let end = parseDate(<string>container.find('#end').val());
        let hours = parseFloat(<string>container.find('#hours').val());
        let cost = parseFloat(<string>container.find('#cost').val());
        let description = <string>container.find('#description').val();

        if (entry) {
            entry.customer = customerElement;
            entry.start = start;
            entry.end = end;
            entry.hours = hours;
            entry.cost = cost;
            entry.description = description;
            return entry;
        } else {
            return new TimeTrackingBudget(newGuid(), <string>container.find('#name').val(), description, start, end, customerElement, newGuid(), hours, cost);
        }
    }

    afterCreateEntry(entry: TimeTrackingBudget, type: BaseDataGridCreateDialogType, self: TimesSettingsBudgetGrid): IPromise<void> {
        entry.budgetDataDocumentId = TimeTrackingBudgetDataDocumentFactory.prototype.createDocumentId(newGuid());
        return createQuery(getCurrentProject(), entry.toString(), [], this.folder).then((query) => {
            return TimeTrackingRoleFactory.getRoles().then((roles) => {
                return createCustomDocumentWithValue(new TimeTrackingBudgetDataDocument(entry.budgetDataDocumentId, entry, query.id, query._links.html.href), TimeTrackingBudgetDataDocumentFactory.prototype.deserializer, TimeTrackingBudgetDataDocumentFactory.prototype.serializer);
            });
        });
    }

    determineEntityDialogType(entity: TimeTrackingBudget): BaseDataGridCreateDialogType {
        return 'create';
    }

    beforeEditEntry(entry: TimeTrackingBudget, type: BaseDataGridCreateDialogType, self: TimesSettingsBudgetGrid): void {
    }

    afterEditEntry(entry: TimeTrackingBudget, type: BaseDataGridCreateDialogType, self: TimesSettingsBudgetGrid): IPromise<void> {
        return getCustomDocument(entry.budgetDataDocumentId, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer).then((data) => {
            data.budget = entry;

            return updateCustomDocument(data, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer, TimeTrackingBudgetDataDocumentFactory.prototype.serializer);
        });
    }

    afterDeleteEntry(entry: TimeTrackingBudget, type: BaseDataGridCreateDialogType, self: TimesSettingsBudgetGrid): IPromise<void> {
        return getCustomDocument(entry.budgetDataDocumentId, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer).then((data) => {
            let promises = [];

            data.workItems.forEach((value) => {
                promises.push(getCustomDocument(TimeTrackingBudgetAssignmentDocumentFactory.prototype.createDocumentId(value.toString()), TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer).then((doc) => {
                    doc.budgetDataId = undefined;
                    return updateCustomDocument(doc, TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer, TimeTrackingBudgetAssignmentDocumentFactory.prototype.serializer);
                }));
            });

            return Q.all(promises).then(() => {
                return deleteQuery(getCurrentProject(), data.queryId).then(() => {
                    return deleteDocument(entry.budgetDataDocumentId);
                });
            });
        });
    }
}