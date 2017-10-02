import { IExcelColumnFormatOptions } from './../Export/ExcelHelper';
import { IDocument, IEntityFactory } from './../Data/Contract';
import { MessageAreaControl } from 'VSS/Controls/Notifications';
import { WaitControl } from 'VSS/Controls/StatusIndicator';
import { Grid, IGridOptions } from 'VSS/Controls/Grids';
import { createNotification } from '../UIHelper/NotificationHelper';
import { createWaitControl } from '../UIHelper/WaitHelper';
import { createMenuBar } from '../UIHelper/MenuBarHelper';
import { createModalDialogUI, showModalDialog } from '../UIHelper/ModalDialogHelper';
import { getDocument, updateDocument } from '../Data/DataServiceHelper';
import { createGridOptions } from '../UIHelper/GridHelper';
import { create } from 'VSS/Controls';

export abstract class BasicDataGrid<TEntity, TDocument extends IDocument<string, TEntity>, TEntityFactory extends IEntityFactory<TEntity, TDocument>> {
    protected document: TDocument;
    protected grid: Grid;
    protected wait: WaitControl;
    protected container: JQuery;
    protected notification: MessageAreaControl;
    protected options: IBaseDataGridOptions;
    private factory: TEntityFactory;
    private status: boolean;

    abstract getKey(value: TEntity): string;
    abstract createDialogUIControls(dialogUI: JQuery<HTMLElement>, hasEntry: boolean, self: BasicDataGrid<TEntity, TDocument, TEntityFactory>, type: BaseDataGridCreateDialogType, entry?: TEntity): IPromise<void>;
    abstract validate(container: JQuery, type: BaseDataGridCreateDialogType, validateNew?: boolean, self?: BasicDataGrid<TEntity, TDocument, TEntityFactory>): boolean;
    abstract createValue(container: JQuery, self: BasicDataGrid<TEntity, TDocument, TEntityFactory>, type: BaseDataGridCreateDialogType, entry?: TEntity): TEntity;
    abstract filterValue(value: TEntity, status: boolean): boolean;

    abstract afterCreateEntry(entry: TEntity, type: BaseDataGridCreateDialogType, self: BasicDataGrid<TEntity, TDocument, TEntityFactory>): IPromise<void>;
    abstract determineEntityDialogType(entity: TEntity): BaseDataGridCreateDialogType;
    abstract beforeEditEntry(entry: TEntity, type: BaseDataGridCreateDialogType, self: BasicDataGrid<TEntity, TDocument, TEntityFactory>): void;
    abstract afterEditEntry(entry: TEntity, type: BaseDataGridCreateDialogType, self: BasicDataGrid<TEntity, TDocument, TEntityFactory>): IPromise<void>;
    abstract afterDeleteEntry(entry: TEntity, type: BaseDataGridCreateDialogType, self: BasicDataGrid<TEntity, TDocument, TEntityFactory>): IPromise<void>;

    constructor(gridOptions: IBaseDataGridOptions, factory: TEntityFactory) {
        this.options = gridOptions;
        this.factory = factory;
        let container = $(this.options.selector);
        container.empty();
        this.container = container;
        this.notification = createNotification(container);
        this.wait = createWaitControl(container);
        this._createMenu(container);
        this._createGrid(container);
    }

    private _createMenu(container: JQuery): void {
        let okFn = (value: TEntity) => {
            this.wait.startWait();
            this.document.map.set(this.getKey(value), value);

            this.afterCreateEntry(value, this.determineEntityDialogType(value), this).then(() => {
                this._updateDocument(this);
            });
        };

        let toggleFn = () => {
            this.status = !this.status;
            this.grid.setDataSource(Array.from(this.document.map.values()).filter((value) => { return this.filterValue(value, this.status); }));
        };

        let exportFn: (self: BasicDataGrid<TEntity, TDocument, TEntityFactory>) => [TEntity[], [{ (t: TEntity): number | string | Date | boolean; }, IExcelColumnFormatOptions][]] = (self: BasicDataGrid<TEntity, TDocument, TEntityFactory>) => {
            return [self.grid._dataSource, self.factory.createExportColumns()];
        }

        createMenuBar({
            type: this.options.entityName,
            container: container,
            self: this,
            create: {
                dialogTitle: `Add New ${this.options.entityName}`,
                okText: 'Create',
                okFn: okFn,
                createDialogUIFn: this._createDialogUI,
                validateFn: this._validateNew(container, 'create'),
                valueFn: this.createValue,
                type: 'create'
            },
            assignBtn: this.options.enableAssign ? {
                dialogTitle: `Assign ${this.options.entityName}`,
                okText: 'Assign',
                okFn: okFn,
                createDialogUIFn: this._createDialogUI,
                validateFn: this._validateNew(container, 'assign'),
                valueFn: this.createValue,
                type: 'assign'
            } : undefined,
            toggleHidden: this.options.hasHiddenElements ? {
                toggleHiddenFn: toggleFn
            } : undefined,
            export: this.options.enableExport ? {
                exportFn: exportFn
            } : undefined
        });
    }

    private _validateNew(container: JQuery, type: BaseDataGridCreateDialogType): (container: JQuery) => boolean {
        return (container: JQuery) => { return this.validate(container, type, true, this); };
    }

    private _createDialogUI(container: JQuery, self: BasicDataGrid<TEntity, TDocument, TEntityFactory>, type: BaseDataGridCreateDialogType, entry?: TEntity): IPromise<JQuery> {
        let hasEntry = entry ? true : false;

        let dialogUI = createModalDialogUI(container);
        return self.createDialogUIControls(dialogUI, hasEntry, self, type, entry).then(() => {
            return dialogUI;
        });
    }

    private _createGrid(container: JQuery): void {
        this.wait.startWait();
        this._loadDocument().then((doc) => {
            this.document = doc;

            let dataFn = () => {
                return Array.from(doc.map.values()).filter((value) => { return this.filterValue(value, this.status); });
            };

            let gridOptions = createGridOptions<TEntity, BasicDataGrid<TEntity, TDocument, TEntityFactory>>(dataFn, this.options.height ? this.options.height : 'calc(100% - 38px)', '100%', this.options.sortIndex, this.options.sortOrder ? this.options.sortOrder : 'asc', this.options.lastCellFills, this.factory.createGridColumns, this._editEntry, this._deleteEntry, this);

            gridOptions.openRowDetail = (index: number) => {
                this._editEntry(this.grid.getRowData(index), this);
            };

            this.grid = create<Grid, IGridOptions>(Grid, container, gridOptions);
            this.wait.endWait();
        });
    }

    private _editEntry(entry: TEntity, self: BasicDataGrid<TEntity, TDocument, TEntityFactory>): void {
        self.beforeEditEntry(entry, self.determineEntityDialogType(entry), self);

        let okFn = (value: TEntity) => {
            self.wait.startWait();

            self.afterEditEntry(entry, self.determineEntityDialogType(entry), self).then(() => {
                self._updateDocument(self);
            });
        };

        showModalDialog(self.container, `Edit ${self.options.entityName}`, 'Apply', okFn, self._createDialogUI, self.validate, self.createValue, self.determineEntityDialogType(entry), self, entry);
    }

    private _deleteEntry(entry: TEntity, self: BasicDataGrid<TEntity, TDocument, TEntityFactory>): void {
        self.wait.startWait();
        self.document.map.delete(self.getKey(entry));

        self.afterDeleteEntry(entry, self.determineEntityDialogType(entry), self).then(() => {
            self._updateDocument(self);
        });
    }

    protected _loadDocument(): IPromise<TDocument> {
        return getDocument<TDocument, string, TEntity>(this.factory.createDocumentId(this.options.workItemId), { constructorFn: this.factory.itemConstructor, serializeFn: this.factory.itemSerializer, idForGlobalIndex: this.options.workItemId });
    }

    protected _updateDocument(self: BasicDataGrid<TEntity, TDocument, TEntityFactory>): void {
        updateDocument(self.document, self.factory.itemConstructor, self.factory.itemSerializer).then((doc) => {
            self.document = doc;
            self.grid.setDataSource(Array.from(doc.map.values()));
            self.wait.endWait();
        }, (reason) => {
            self.notification.setError($("<span />").html(reason));
            self.wait.endWait();
        });
    }
}

export interface IBaseDataGridOptions {
    selector: string;
    entityName: string;
    sortIndex: string;
    sortOrder?: string;
    lastCellFills?: boolean;
    hasHiddenElements?: boolean;
    enableExport?: boolean;
    enableAssign?: boolean;
    workItemId?: number;
    height?: string;
}

export type BaseDataGridCreateDialogType = 'create' | 'assign';