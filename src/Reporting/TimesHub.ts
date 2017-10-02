import { IExcelColumnFormatOptions } from './../Export/ExcelHelper';
import { TimeTrackingCompleteEntry, TimeTrackingCompleteEntryFactory } from './../Data/TimeTrackingCompleteEntry';
import { WaitControl } from 'VSS/Controls/StatusIndicator';
import { MessageAreaControl } from 'VSS/Controls/Notifications';
import { Grid, IGridOptions, GridHierarchySource } from 'VSS/Controls/Grids';
import { createNotification } from '../UIHelper/NotificationHelper';
import { createWaitControl } from '../UIHelper/WaitHelper';
import { groupTimesByBudget, groupTimesByPerson } from '../WorkItemHelper/WorkItemHelper';
import { IMenuBarConfiguration, createMenuBar, getCurrentMonthFilterTimeFrame } from '../UIHelper/MenuBarHelper';
import { createHierarchyGridOptions } from '../UIHelper/GridHelper';
import { create } from 'VSS/Controls';
import { hasAccess } from "../Auth/AuthHelper";

export class TimesHub {
    private wait: WaitControl;
    private notification: MessageAreaControl;
    private grid: Grid;
    private groupByState: 'budget' | 'person';
    private currentFilterBegin: Date;
    private currentFilterEnd: Date;

    public init(): void {
        hasAccess().then((res) => {
            let c = $('#hubContainer');

            if (res) {
                this.notification = createNotification(c);
                this.wait = createWaitControl(c);
                this._createMenu(c);
                this._createGrid(c);
            } else {
                createNotification(c).setError($("<span />").html('You are not authorized to view this page!'));
            }
        });
    }

    private _createMenu(container: JQuery): void {
        let filterOkFn = (value: [Date, Date]) => {
            this.currentFilterBegin = value[0];
            this.currentFilterEnd = value[1];
            this.wait.startWait();

            groupTimesByBudget(this.currentFilterBegin, this.currentFilterEnd).then((values) => {
                this.grid.setDataSource(new GridHierarchySource(values));
                this.wait.endWait();
            });
        }

        let toggleGroupFn = () => {
            this.wait.startWait();

            if (this.groupByState === 'budget') {
                groupTimesByPerson(this.currentFilterBegin, this.currentFilterEnd).then((values) => {
                    this.grid.setDataSource(new GridHierarchySource(values));
                    this.grid.collapseAll();
                    this.grid.expandByLevel(1);
                    this.groupByState = 'person';
                    this.wait.endWait();
                });
            } else {
                groupTimesByBudget(this.currentFilterBegin, this.currentFilterEnd).then((values) => {
                    this.grid.setDataSource(new GridHierarchySource(values));
                    this.groupByState = 'budget';
                    this.wait.endWait();
                });
            }
        };

        let exportFn: (self: TimesHub) => [TimeTrackingCompleteEntry[], [{ (t: TimeTrackingCompleteEntry): number | string | Date | boolean; }, IExcelColumnFormatOptions][]] = (self: TimesHub) => {
            return [self.grid._dataSource, TimeTrackingCompleteEntryFactory.prototype.createExportColumns()];
        }

        createMenuBar({
            type: 'Time',
            container: container,
            self: this,
            filter: {
                filterOkFn
            },
            export: {
                exportFn: exportFn
            },
            toggleGroupBy: {
                toggleFn: toggleGroupFn
            }
        });
    }

    private _createGrid(container: JQuery): void {
        this.groupByState = 'budget';
        this.wait.startWait();
        let timeFrame = getCurrentMonthFilterTimeFrame();
        this.currentFilterBegin = timeFrame[0];
        this.currentFilterEnd = timeFrame[1];
        groupTimesByBudget(this.currentFilterBegin, this.currentFilterEnd).then((values) => {
            let dataFn = () => {
                return values;
            };

            let gridOptions = createHierarchyGridOptions(() => values, 'calc(100% - 38px)', '100%', 'date', 'desc', false, TimeTrackingCompleteEntryFactory.prototype.createGridColumns);

            this.grid = create<Grid, IGridOptions>(Grid, container, gridOptions);
            this.wait.endWait();
        });
    }
}