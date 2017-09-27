import { IExcelColumnFormatOptions, ExcelExporter } from './../Export/ExcelHelper';
import { MenuBar, IMenuItemSpec } from 'VSS/Controls/Menus';
import { showModalDialog, createModalDialogUI, addDatePicker } from './ModalDialogHelper';
import { parseDate } from '../Data/Date';
import { create } from 'VSS/Controls';
import * as Q from 'q';

export interface IMenuBarConfiguration<T, U, V> {
    type: string;
    container: JQuery;
    self?: U;
    create?: IMenuBarCreateConfiguration<T, U, V>;
    assignBtn?: IMenuBarCreateConfiguration<T, U, V>;
    filter?: IMenuBarFilterConfiguration;
    toggleGroupBy?: IMenuBarToggleGroupByConfiguration;
    toggleHidden?: IMenuBarToggleHiddenConfiguration;
    export?: IMenuBarExportConfiguration<T, U>;
}

export interface IMenuBarCreateConfiguration<T, U, V> {
    dialogTitle: string;
    okText: string;
    okFn: (value: T) => void;
    createDialogUIFn: (container: JQuery, self: U, type: V) => IPromise<JQuery>;
    validateFn: (dialogElement: JQuery, type: V) => boolean;
    valueFn: (dialogElement: JQuery, self: U, type: V) => T;
    type: V;
}

export interface IMenuBarToggleGroupByConfiguration {
    toggleFn: () => void;
}

export interface IMenuBarFilterConfiguration {
    filterOkFn: (value: [Date, Date]) => void;
}

export interface IMenuBarToggleHiddenConfiguration {
    toggleHiddenFn: () => void;
}

export interface IMenuBarExportConfiguration<T, U> {
    exportFn: (self: U) => [T[], [{ (t: T): number | string | Date | boolean; }, IExcelColumnFormatOptions][]];
}

export function createMenuBar<T, U, V>(options: IMenuBarConfiguration<T, U, V>) {
    let header = $('<div class="fixed-header"></div>');
    options.container.append(header);

    let menuContainer = $('<div class="actions-control toolbar"></div>');
    options.container.append(menuContainer);

    let menuBarOptions = _createMenuBarOptions(options);
    let menubar = create<MenuBar, any>(MenuBar, menuContainer, menuBarOptions);
}

function _createMenuBarOptions<T, U, V>(options: IMenuBarConfiguration<T, U, V>): any {
    let menuBarOptions: any = {
        items: _createMenuBarItems(options),
        executeAction: (args) => {
            switch (args.get_commandName()) {
                case 'Add':
                    showModalDialog(options.container, options.create.dialogTitle, options.create.okText, options.create.okFn, options.create.createDialogUIFn, options.create.validateFn, options.create.valueFn, options.create.type, options.self);
                    break;
                case 'Assign':
                    showModalDialog(options.container, options.assignBtn.dialogTitle, options.assignBtn.okText, options.assignBtn.okFn, options.assignBtn.createDialogUIFn, options.assignBtn.validateFn, options.assignBtn.valueFn, options.assignBtn.type, options.self);
                    break;
                case 'Filter':
                    showModalDialog(options.container, 'Select Timeframe', 'Filter', options.filter.filterOkFn, _createFilterDialogUI, _validateFilter, _createFilterValue, options.self, getCurrentMonthFilterTimeFrame());
                    break;
                case 'Group':
                    options.toggleGroupBy.toggleFn();
                    break;
                case 'Hidden':
                    options.toggleHidden.toggleHiddenFn();
                    break;
                case 'Export':
                    let exportInfo = options.export.exportFn(options.self);
                    let exporter = new ExcelExporter('TimeExport.xlsx');
                    exporter.addSheet('Times', exportInfo[0], exportInfo[1]);
                    exporter.writeFile();
                    break;
            }
        }
    };

    return menuBarOptions;
}

function _validateFilter(container: JQuery): boolean {
    let start = container.find('#start').val() !== null;
    let end = container.find('#end').val() !== null;

    return start && end;
}

export function getCurrentMonthFilterTimeFrame(): [Date, Date] {
    let now = new Date(Date.now());
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let nextMonthIsInNewYear = (now.getMonth() + 1) % 12 == 0;
    let end = nextMonthIsInNewYear ? new Date(now.getFullYear() + 1, 0) : new Date(now.getFullYear(), now.getMonth() + 1);
    return [start, end];
}

function _createFilterDialogUI(container: JQuery): IPromise<JQuery> {
    let dialogUI = createModalDialogUI(container);
    let timeFrame = getCurrentMonthFilterTimeFrame();
    addDatePicker(dialogUI, 'Start', 'start', true, timeFrame[0], false);
    addDatePicker(dialogUI, 'End', 'end', true, timeFrame[1], false);
    return Q(dialogUI);
}

function _createFilterValue(container: JQuery): [Date, Date] {
    let start = parseDate(<string>container.find('#start').val());
    let end = parseDate(<string>container.find('#end').val());

    return [start, end];
}

function _createMenuBarItems<T, U, V>(options: IMenuBarConfiguration<T, U, V>): IMenuItemSpec[] {
    let items: IMenuItemSpec[] = [];

    if (options.create) {
        _createMenuBarItem(items, 'Add', 'math-plus', `Add ${options.type}`);
    }

    if (options.assignBtn) {
        _createMenuBarItem(items, 'Assign', 'arrow-import', `Assign ${options.type}`);
    }

    if (options.filter) {
        _createMenuBarItem(items, 'Filter', 'search-filter');
    }

    if (options.toggleGroupBy) {
        _createMenuBarItem(items, 'Group', 'group-rows');
    }

    if (options.toggleHidden) {
        _createMenuBarItem(items, 'Hidden', 'recycle-bin', 'Toggle Hidden');
    }

    if (options.export) {
        _createMenuBarItem(items, 'Export', 'arrow-export');
    }

    return items;
}

function _createMenuBarItem(items: IMenuItemSpec[], id: string, icon: string, text?: string, title?: string) {
    if (items.length > 0) {
        items.push({ separator: true });
    }
    items.push({ id: id, text: text ? text : id, title: title ? title : (text ? text : id), icon: `bowtie-icon bowtie-${icon}` });
}