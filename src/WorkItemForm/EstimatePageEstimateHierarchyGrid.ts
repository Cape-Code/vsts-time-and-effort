import { TimeTrackingEstimateEntriesDocument } from './../Data/Contract';
import { TimeTrackingEstimateEntry, TimeTrackingEstimateEntryFactory } from './../Data/TimeTrackingEstimateEntry';
import { getNumberFormat } from 'VSS/Utils/Culture';
import { IBaseHierarchyGridOptions } from './../Base/BasicHierarchyGrid';
import { IWorkItemHierarchy } from './../WorkItemHelper/WorkItemHelper';
import { BasicHierarchyGrid } from '../Base/BasicHierarchyGrid';

export class EstimatePageEstimateHierarchyGrid extends BasicHierarchyGrid<TimeTrackingEstimateEntry, TimeTrackingEstimateEntriesDocument, TimeTrackingEstimateEntryFactory, IWorkItemEstimateHierarchy, IWorkItemEstimateAggregate> {
    public static createGridOptions(workItemId: number): IBaseHierarchyGridOptions<TimeTrackingEstimateEntry, TimeTrackingEstimateEntriesDocument, TimeTrackingEstimateEntryFactory, IWorkItemEstimateHierarchy, IWorkItemEstimateAggregate> {
        return <IBaseHierarchyGridOptions<TimeTrackingEstimateEntry, TimeTrackingEstimateEntriesDocument, TimeTrackingEstimateEntryFactory, IWorkItemEstimateHierarchy, IWorkItemEstimateAggregate>>{
            selector: '#childEstimateContainer',
            entityName: 'Estimate',
            workItemId: workItemId,
            factory: new TimeTrackingEstimateEntryFactory(),
            fnGetDocumentId: (workItemId) => { return TimeTrackingEstimateEntryFactory.prototype.createDocumentId(workItemId); },
            fnApplyValues: (element) => {
                element.role = element.workItemName;
            },
            fnInitAgg: () => { return { cost: 0, hours: 0 }; },
            fnAggValue: (value, agg) => {
                agg.hours += value.hours;
                agg.cost += value.role.cost * value.hours;
            },
            fnCheckAgg: (element, agg) => {
                let result = false;

                if (agg.hours > 0) {
                    element.hours = agg.hours;
                    result = true;
                }

                if (agg.cost > 0) {
                    element.cost = `${agg.cost}${getNumberFormat().CurrencySymbol}`;
                    element.costNumber = agg.cost;
                    result = true;
                }

                return result;
            },
            fnRollUp: (parent, agg) => {
                if (agg.hours > 0) {
                    if (!parent.hours) {
                        parent.hours = 0;
                    }

                    parent.hours += agg.hours;
                }

                if (agg.cost > 0) {
                    if (!parent.costNumber) {
                        parent.costNumber = 0;
                    }

                    parent.costNumber += agg.cost;
                    parent.cost = `${parent.costNumber}${getNumberFormat().CurrencySymbol}`;
                }
            }
        };
    }

    constructor(workItemId: number) {
        super(EstimatePageEstimateHierarchyGrid.createGridOptions(workItemId));
    }
}

export interface IWorkItemEstimateAggregate {
    cost: number;
    hours: number;
}

export interface IWorkItemEstimateHierarchy extends IWorkItemHierarchy<TimeTrackingEstimateEntry> {
    hours?: number;
    cost?: string;
    role: string;
    costNumber?: number;
}