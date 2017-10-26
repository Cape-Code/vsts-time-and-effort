import { IGridOptions, IGridHierarchyItem, GridHierarchySource, IGridSortOrder, IGridGutterOptions, IGridContextMenu, IGridColumn } from 'VSS/Controls/Grids';

export function createGridOptions<T, U>(dataFn: () => T[], height: string, width: string, sortIndex: string, sortOrder: string, lastCellFills: boolean, columnFn: () => IGridColumn[], editFn?: (entry: T, self: U) => void, deleteFn?: (entry: T, self: U) => void, self?: U, repairFn?: (entry: T, self: U) => void): IGridOptions {
    let gridOptions: IGridOptions = {
        source: dataFn(),
        height: height,
        width: width,
        lastCellFillsRemainingContent: lastCellFills,
        columns: columnFn(),
        sortOrder: _createGridSortOptions(sortIndex, sortOrder),
        gutter: _createGridGutterOptions(editFn ? true : false),
        contextMenu: editFn ? _createGridContextMenu<T, U>(editFn, deleteFn, self, repairFn) : undefined
    };

    return gridOptions;
}

export function createHierarchyGridOptions(dataFn: () => IGridHierarchyItem[], height: string, width: string, sortIndex: string, sortOrder: string, lastCellFills: boolean, columnFn: () => IGridColumn[]): IGridOptions {
    let gridOptions: IGridOptions = {
        source: new GridHierarchySource(dataFn()),
        height: height,
        width: width,
        lastCellFillsRemainingContent: lastCellFills,
        columns: columnFn(),
        sortOrder: _createGridSortOptions(sortIndex, sortOrder),
        gutter: _createGridGutterOptions(false)
    }

    return gridOptions;
}

export function createCheckboxColumnFn(rowInfo: any, dataIndex: number, expandedState: number, level: number, column: any, indentIndex: number, columnOrder: number) {
    let value = this.getColumnValue(dataIndex, column.index);
    let cell = $('<div class="grid-cell"/>').width(column.width);
    let cb = $(`<input type="checkbox" disabled="disabled" ${value ? 'checked="checked" ' : ''}/>`);

    cell.append(cb);
    return cell;
}

function _createGridSortOptions(index: string, order: string): IGridSortOrder[] {
    let sortOptions: IGridSortOrder[] = [
        { index: index, order: order }
    ];

    return sortOptions;
}

function _createGridGutterOptions(enableMenu: boolean): IGridGutterOptions {
    let gutterOptions: IGridGutterOptions = {
        contextMenu: enableMenu
    };

    return gutterOptions;
}

function _createGridContextMenu<T, U>(editFn: (entry: T, self: U) => void, deleteFn: (entry: T, self: U) => void, self: U, repairFn?: (entry: T, self: U) => void): IGridContextMenu {
    let items = [
        { rank: 5, id: 'Edit', text: 'Edit', title: 'Edit', icon: 'bowtie-icon bowtie-edit' },
        { rank: 10, id: 'Delete', text: 'Delete', title: 'Delete', icon: 'bowtie-icon bowtie-edit-delete' }
    ];

    if (repairFn)
        items.push({ rank: 15, id: 'Repair', text: 'Repair Cached', title: 'Repair Cached', icon: 'bowtie-icon bowtie-synchronize' });

    let contextMenu: IGridContextMenu = {
        useBowtieStyle: true,
        items: items,
        executeAction: (e) => {
            switch (e.get_commandName()) {
                case 'Edit':
                    editFn(e.get_commandSource().getOwner().getContextInfo().item, self);
                    break;
                case 'Delete':
                    deleteFn(e.get_commandSource().getOwner().getContextInfo().item, self);
                    break;
                case 'Repair':
                    repairFn(e.get_commandSource().getOwner().getContextInfo().item, self);
                    break;
            }
        }
    };

    return contextMenu;
}