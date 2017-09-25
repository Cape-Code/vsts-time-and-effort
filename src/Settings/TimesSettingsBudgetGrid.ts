import { QueryHierarchyItem } from 'TFS/WorkItemTracking/Contracts';
import { TimeTrackingBudgetAssignmentDocumentFactory } from './../Data/TimeTrackingBudgetAssignmentDocument';
import { TimeTrackingBudgetDataDocument, TimeTrackingBudgetDataDocumentFactory } from './../Data/TimeTrackingBudgetDataDocument';
import { TimeTrackingCustomerFactory } from './../Data/TimeTrackingCustomer';
import { TimeTrackingBudgetsDocument, TimeTrackingCustomersDocument } from './../Data/Contract';
import { TimeTrackingBudget, TimeTrackingBudgetFactory } from './../Data/TimeTrackingBudget';
import { BasicDataGrid, IBaseDataGridOptions, BaseDataGridCreateDialogType } from '../Base/BasicDataGrid';
import { getCurrentProject, getDocument, deleteDocument, createCustomDocumentWithValue, getCustomDocument, updateCustomDocument } from '../Data/DataServiceHelper';
import { addTextbox, addTextArea, addComboBox, addDatePicker, addNumber } from '../UIHelper/ModalDialogHelper';
import { newGuid } from '../Data/Guid';
import { parseDate } from '../Data/Date';
import { createFolderIfNotExists, createQuery, deleteQuery } from '../WorkItemHelper/QueryHelper';

export class TimesSettingsBudgetGrid extends BasicDataGrid<TimeTrackingBudget, TimeTrackingBudgetsDocument, TimeTrackingBudgetFactory> {
    private customers: TimeTrackingCustomersDocument;
    private folder: QueryHierarchyItem;

    constructor() {
        let gridOptions = <IBaseDataGridOptions>{
            selector: '#timesBudgetsContainer',
            entityName: 'Budget',
            sortIndex: 'name',
            hasHiddenElements: true,
            height: '500px'
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

    validate(container: JQuery, type: BaseDataGridCreateDialogType, validateNew?: boolean, self?: TimesSettingsBudgetGrid): boolean {
        if (validateNew) {
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
        return self._getCustomers().then((customers) => {
            addTextbox(dialogUI, 'Name', 'name', true, hasEntry ? entry.name : undefined, hasEntry);
            addComboBox(dialogUI, 'Customer', 'customer', true, hasEntry ? entry.customer : undefined, false, Array.from(customers.map.values()).filter((v) => { return v.isActive; }), (v) => v.name);
            addDatePicker(dialogUI, 'Start', 'start', true, hasEntry ? entry.start : new Date(), false);
            addDatePicker(dialogUI, 'End', 'end', true, hasEntry ? entry.end : new Date(), false);
            addNumber(dialogUI, 'Hours', 'hours', 0.0, 100000000.0, 0.25, true, hasEntry ? entry.hours : undefined, false);
            addNumber(dialogUI, 'Cost', 'cost', 0.0, 10000000000.0, 10.0, true, hasEntry ? entry.cost : undefined, false);
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

    afterCreateEntry(entry: TimeTrackingBudget, type: BaseDataGridCreateDialogType, self: TimesSettingsBudgetGrid): void {
        entry.budgetDataDocumentId = TimeTrackingBudgetDataDocumentFactory.prototype.createDocumentId(newGuid());
        createQuery(getCurrentProject(), entry.toString(), [], this.folder).then((query) => {
            createCustomDocumentWithValue(new TimeTrackingBudgetDataDocument(entry.budgetDataDocumentId, entry, entry.hours, entry.cost, query.id, query._links.html.href), TimeTrackingBudgetDataDocumentFactory.prototype.deserializer, TimeTrackingBudgetDataDocumentFactory.prototype.serializer);
        });
    }

    determineEntityDialogType(entity: TimeTrackingBudget): BaseDataGridCreateDialogType {
        return 'create';
    }

    beforeEditEntry(entry: TimeTrackingBudget, type: BaseDataGridCreateDialogType, self: TimesSettingsBudgetGrid): void {
    }

    afterEditEntry(entry: TimeTrackingBudget, type: BaseDataGridCreateDialogType, self: TimesSettingsBudgetGrid): void {
        getCustomDocument(entry.budgetDataDocumentId, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer).then((data) => {
            data.budgetCost = entry.cost;
            data.budgetHours = entry.hours;

            updateCustomDocument(data, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer, TimeTrackingBudgetDataDocumentFactory.prototype.serializer);
        });
    }

    afterDeleteEntry(entry: TimeTrackingBudget, type: BaseDataGridCreateDialogType, self: TimesSettingsBudgetGrid): void {
        getCustomDocument(entry.budgetDataDocumentId, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer).then((data) => {
            data.workItems.forEach((value) => {
                getCustomDocument(TimeTrackingBudgetAssignmentDocumentFactory.prototype.createDocumentId(value.toString()), TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer).then((doc) => {
                    doc.budget = undefined;
                    updateCustomDocument(doc, TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer, TimeTrackingBudgetAssignmentDocumentFactory.prototype.serializer);
                });
            });

            deleteQuery(getCurrentProject(), data.queryId);

            deleteDocument(entry.budgetDataDocumentId);
        });
    }
}