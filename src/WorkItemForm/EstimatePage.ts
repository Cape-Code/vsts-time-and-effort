import { EstimatePageEstimateHierarchyGrid } from './EstimatePageEstimateHierarchyGrid';
import { EstimatePageEstimatesGrid } from './EstimatePageEstimatesGrid';
import { WorkItemFormService } from 'TFS/WorkItemTracking/Services';
import { MessageAreaControl, MessageAreaType } from 'VSS/Controls/Notifications';
import { createSplitter } from '../UIHelper/SplitterHelper';
import { createNotification } from '../UIHelper/NotificationHelper';
import { hasAccess } from "../Auth/AuthHelper";

export class EstimatePage {
    private globalNotification: MessageAreaControl;

    public init(): void {
        createSplitter($('#splitter'), 1000);
        let extensionContext = VSS.getExtensionContext();
        VSS.register(`${extensionContext.publisherId}.${extensionContext.extensionId}.tae-estimate-page`, () => {
            return {
                onLoaded: (args) => { this._render(args.id) },
                onSaved: (args) => { this._render(args.id) },
                onReset: (args) => { this._render(args.id) },
                onRefreshed: (args) => { this._render(args.id) }
            }
        });
    }

    private _render(id: number): void {
        hasAccess().then((res) => {
            if (res) {
                if (id !== 0) {
                    if (this.globalNotification) {
                        this.globalNotification.clear();
                    }

                    WorkItemFormService.getService().then(service => {
                        new EstimatePageEstimatesGrid(id);
                        new EstimatePageEstimateHierarchyGrid(id);
                    });
                } else {
                    if (!this.globalNotification) {
                        this.globalNotification = createNotification($('#splitter'));
                    }
                    this.globalNotification.setMessage($("<span />").html('Please save the new work item first to enable Time & Effort!'), MessageAreaType.Warning);
                }
            }
        });
    }
}