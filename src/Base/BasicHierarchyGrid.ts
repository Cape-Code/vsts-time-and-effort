import { IDocument, IEntityFactory } from './../Data/Contract';
import { WaitControl } from 'VSS/Controls/StatusIndicator';
import { Grid, IGridOptions } from 'VSS/Controls/Grids';
import { create } from 'VSS/Controls';
import { openWorkItem } from '../WorkItemHelper/NavigationHelper';
import { createWaitControl } from '../UIHelper/WaitHelper';
import { createHierarchyGridOptions } from '../UIHelper/GridHelper';
import { getWorkItemHierarchy, IWorkItemHierarchy } from '../WorkItemHelper/WorkItemHelper';
import { createMenuBar } from '../UIHelper/MenuBarHelper';

export abstract class BasicHierarchyGrid<TEntity, TDocument extends IDocument<string, TEntity>, TEntityFactory extends IEntityFactory<TEntity, TDocument>, TWorkItemHierarchy extends IWorkItemHierarchy<TEntity>, TAggregateValues> {
    private grid: Grid;
    private wait: WaitControl;
    private container: JQuery;
    protected options: IBaseHierarchyGridOptions<TEntity,TDocument,TEntityFactory,TWorkItemHierarchy,TAggregateValues>;
    
    constructor(gridOptions: IBaseHierarchyGridOptions<TEntity,TDocument,TEntityFactory,TWorkItemHierarchy,TAggregateValues>) {
        this.options = gridOptions;
        let container = $(this.options.selector);
        container.empty();
        this.container = container;
        this.wait = createWaitControl(container);
        this._createMenu(container);
        this._createGrid(container);
    }

    private _createMenu(container: JQuery): void {
        createMenuBar({
            type: this.options.entityName,
            container: container
        });
    }

    private _createGrid(container: JQuery): void {
        this.wait.startWait();
        getWorkItemHierarchy<TEntity,TDocument,TEntityFactory,TWorkItemHierarchy,TAggregateValues>(this.options).then((res) => {
            let dataFn = () => {
                return [res];
            };

            let gridOptions = createHierarchyGridOptions(dataFn, 'calc(100% - 38px)', '100%', 'workItemId', this.options.sortOrder ? this.options.sortOrder : 'asc', false, this.options.factory.createHierarchyGridColumns);

            gridOptions.openRowDetail = (index: number) => {
                let data = this.grid.getRowData(this.grid.getSelectedDataIndex());
                if (data.workItemId) {
                    openWorkItem(data.workItemId);
                }
            };

            this.grid = create<Grid, IGridOptions>(Grid, container, gridOptions);
            this.wait.endWait();
        });
    }
}

export interface IBaseHierarchyGridOptions<TEntity, TDocument extends IDocument<string, TEntity>, TEntityFactory extends IEntityFactory<TEntity, TDocument>, TWorkItemHierarchy extends IWorkItemHierarchy<TEntity>, TAggregateValues> {
    selector: string;
    entityName: string;
    sortOrder?: string;
    lastCellFills?: boolean;
    workItemId: number;
    factory: TEntityFactory;
    fnGetDocumentId: (workItemId: number) => string;
    fnApplyValues: (element: TWorkItemHierarchy) => void;
    fnInitAgg: () => TAggregateValues;
    fnAggValue: (value: TEntity, agg: TAggregateValues) => void;
    fnCheckAgg: (element: TWorkItemHierarchy, agg: TAggregateValues) => boolean;
    fnRollUp: (parent: TWorkItemHierarchy, agg: TAggregateValues) => void;
}