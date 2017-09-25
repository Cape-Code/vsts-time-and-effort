import { IExcelColumnFormatOptions } from './../Export/ExcelHelper';
import { TimeTrackingCompleteEntry, TimeTrackingCompleteEntryFactory } from './../Data/TimeTrackingCompleteEntry';
import { WaitControl } from 'VSS/Controls/StatusIndicator';
import { MessageAreaControl } from 'VSS/Controls/Notifications';
import { Grid, IGridOptions, GridHierarchySource } from 'VSS/Controls/Grids';
import { createNotification } from '../UIHelper/NotificationHelper';
import { createWaitControl } from '../UIHelper/WaitHelper';
import { groupTimesByBudget } from '../WorkItemHelper/WorkItemHelper';
import { IMenuBarConfiguration, createMenuBar, getCurrentMonthFilterTimeFrame } from '../UIHelper/MenuBarHelper';
import { createHierarchyGridOptions } from '../UIHelper/GridHelper';
import { create } from 'VSS/Controls';
import { hasAccess } from "../Auth/AuthHelper";

export class TimesHub {
    private wait: WaitControl;
    private notification: MessageAreaControl;
    private grid: Grid;

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
            this.wait.startWait();

            groupTimesByBudget(value[0], value[1]).then((values) => {
                this.grid.setDataSource(new GridHierarchySource(values));
                this.wait.endWait();
            });
        }

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
            }
        });
    }

    private _createGrid(container: JQuery): void {
        this.wait.startWait();
        let timeFrame = getCurrentMonthFilterTimeFrame();
        groupTimesByBudget(timeFrame[0], timeFrame[1]).then((values) => {
            let dataFn = () => {
                return values;
            };

            let gridOptions = createHierarchyGridOptions(() => values, '1000px', '100%', 'date', 'desc', false, TimeTrackingCompleteEntryFactory.prototype.createGridColumns);

            this.grid = create<Grid, IGridOptions>(Grid, container, gridOptions);
            this.wait.endWait();
        });
    }
}