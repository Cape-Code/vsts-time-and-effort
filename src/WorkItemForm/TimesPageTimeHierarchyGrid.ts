import { getNumberFormat } from 'VSS/Utils/Culture';
import { IBaseHierarchyGridOptions } from './../Base/BasicHierarchyGrid';
import { TimeTrackingEntriesDocument } from './../Data/Contract';
import { TimeTrackingEntry, TimeTrackingEntryFactory } from './../Data/TimeTrackingEntry';
import { IWorkItemHierarchy } from './../WorkItemHelper/WorkItemHelper';
import { BasicHierarchyGrid } from '../Base/BasicHierarchyGrid';

export class TimesPageTimeHierarchyGrid extends BasicHierarchyGrid<TimeTrackingEntry, TimeTrackingEntriesDocument, TimeTrackingEntryFactory, IWorkItemTimeHierarchy, IWorkItemTimeAggregate> {
    public static createGridOptions(workItemId: number): IBaseHierarchyGridOptions<TimeTrackingEntry, TimeTrackingEntriesDocument, TimeTrackingEntryFactory, IWorkItemTimeHierarchy, IWorkItemTimeAggregate> {
        return <IBaseHierarchyGridOptions<TimeTrackingEntry, TimeTrackingEntriesDocument, TimeTrackingEntryFactory, IWorkItemTimeHierarchy, IWorkItemTimeAggregate>>{
            selector: '#childTimesContainer',
            entityName: 'Time',
            workItemId: workItemId,
            factory: new TimeTrackingEntryFactory(),
            fnGetDocumentId: (workItemId) => { return TimeTrackingEntryFactory.prototype.createDocumentId(workItemId); },
            fnApplyValues: (element) => {
                element.person = element.workItemName;
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
                    element.role = `${agg.cost}${getNumberFormat().CurrencySymbol}`;
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
                    parent.role = `${parent.costNumber}${getNumberFormat().CurrencySymbol}`;
                }
            }
        };
    }

    constructor(workItemId: number) {
        super(TimesPageTimeHierarchyGrid.createGridOptions(workItemId));
    }
}

export interface IWorkItemTimeAggregate {
    cost: number;
    hours: number;
}

export interface IWorkItemTimeHierarchy extends IWorkItemHierarchy<TimeTrackingEntry> {
    hours?: number;
    cost?: number;
    role: string;
    costNumber?: number;
    person: string;
}