import { getNumberFormat } from 'VSS/Utils/Culture';
import { BulletGraph } from '../Graph/BulletGraph';
import { WaitControl } from 'VSS/Controls/StatusIndicator';
import { EstimatePageEstimateHierarchyGrid, IWorkItemEstimateHierarchy } from './EstimatePageEstimateHierarchyGrid';
import { TimesPageTimeHierarchyGrid, IWorkItemTimeHierarchy } from './TimesPageTimeHierarchyGrid';
import { getWorkItemHierarchy } from '../WorkItemHelper/WorkItemHelper';
import { WorkItemFormService } from 'TFS/WorkItemTracking/Services';
import * as Q from 'q';
import { createWaitControl } from '../UIHelper/WaitHelper';
import { hasAccess } from '../Auth/AuthHelper';

export class TimesGroup {
    private wait: WaitControl;

    public init(): void {
        let extensionContext = VSS.getExtensionContext();
        VSS.register(`${extensionContext.publisherId}.${extensionContext.extensionId}.tae-times-group`, () => {
            return {
                onLoaded: (args) => { this._render(args.id) },
                onSaved: (args) => { this._render(args.id) },
                onReset: (args) => { this._render(args.id) },
                onRefreshed: (args) => { this._render(args.id) }
            }
        });
    }

    private _render(id: number): void {
        if (id !== 0) {
            hasAccess().then((res) => {
                if (res) {
                    WorkItemFormService.getService().then(service => {
                        let container = $('.chart-container');
                        let containerEffort = $('.effort-chart-container');
                        let containerCost = $('.cost-chart-container');
                        this.wait = createWaitControl(container);
                        this.wait.startWait();

                        Q.all<any>([
                            getWorkItemHierarchy(TimesPageTimeHierarchyGrid.createGridOptions(id)),
                            getWorkItemHierarchy(EstimatePageEstimateHierarchyGrid.createGridOptions(id))
                        ]).spread((valTimes: IWorkItemTimeHierarchy, valEstimates: IWorkItemEstimateHierarchy) => {
                            if (!valEstimates.hours && !valTimes.hours) {
                                containerEffort.hide();
                                containerCost.hide();
                            } else {
                                containerEffort.show();
                                containerCost.show();
                                new BulletGraph(containerEffort, 'Effort', 'in hours', valEstimates.hours, valTimes.hours, 0, containerEffort[0].getBoundingClientRect().width);
                                new BulletGraph(containerCost, 'Cost', `in ${getNumberFormat().CurrencySymbol}`, valEstimates.costNumber, valTimes.costNumber, 0, containerCost[0].getBoundingClientRect().width);
                            }

                            this.wait.endWait();
                        });
                    });
                }
            })
        }
    }
}