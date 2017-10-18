import { TimeTrackingRoleFactory, TimeTrackingRole } from './../Data/TimeTrackingRole';
import { TimeTrackingBudgetAssignmentDocument, TimeTrackingBudgetAssignmentDocumentFactory } from './../Data/TimeTrackingBudgetAssignmentDocument';
import { IBaseHierarchyGridOptions } from './../Base/BasicHierarchyGrid';
import { TimeTrackingEstimateEntry, TimeTrackingEstimateEntryFactory } from './../Data/TimeTrackingEstimateEntry';
import { IWorkItemHierarchy, TimeTrackingCompleteEntryHierarchy } from './WorkItemHelper';
import { getNumberFormat } from 'VSS/Utils/Culture';
import { TimeTrackingEntriesTimeIndex, TimeTrackingEntriesDocument, IDocument, IEntityFactory, TimeTrackingEstimateEntriesDocument, TimeTrackingBudgetsDocument, TimeTrackingRolesDocument } from './../Data/Contract';
import { TimeTrackingEntry, TimeTrackingEntryFactory } from './../Data/TimeTrackingEntry';
import { TimeTrackingBudget } from './../Data/TimeTrackingBudget';
import { TimeTrackingCompleteEntry } from './../Data/TimeTrackingCompleteEntry';
import { WorkItemTrackingHttpClient3_2, getClient } from 'TFS/WorkItemTracking/RestClient';
import { WorkItemRelationType, WorkItem, WorkItemExpand, WorkItemType } from 'TFS/WorkItemTracking/Contracts';
import { TimeTrackingBudgetDataDocument, TimeTrackingBudgetDataDocumentFactory } from './../Data/TimeTrackingBudgetDataDocument';
import * as Q from 'q';
import { getGlobalTimeIndex, getTimeIndexById, getDocumentById, getCustomDocument, createCustomDocumentWithValue, updateCustomDocument, createCustomDocument, getCurrentProject, updateDocument, getAllDocuments, deserializeDocument } from '../Data/DataServiceHelper';
import { updateQuery } from "./QueryHelper";
import { format } from "../Data/Date";

function getRelationTypes(client: WorkItemTrackingHttpClient3_2, filterFn: (type: WorkItemRelationType) => boolean): IPromise<Map<string, WorkItemRelationType>> {
    return client.getRelationTypes().then((types) => {
        let typesMap = new Map<string, WorkItemRelationType>();

        types.forEach((t) => {
            if (filterFn(t))
                typesMap.set(t.referenceName, t);
        });

        return typesMap;
    });
}

function getWorkItems(ids: number[], fields: string[], client: WorkItemTrackingHttpClient3_2): IPromise<WorkItem[]> {
    return client.getWorkItems(ids, fields);
}

function getWorkItemWithRelations(id: number, client: WorkItemTrackingHttpClient3_2): IPromise<WorkItem> {
    return client.getWorkItem(id, null, null, WorkItemExpand.Relations);
}

function getWorkItemsWithRelations(ids: number[], client: WorkItemTrackingHttpClient3_2): IPromise<WorkItem[]> {
    return client.getWorkItems(ids, null, null, WorkItemExpand.Relations);
}

function convertTimeFrameToIndexKeys(start: Date, end: Date): string[] {
    let startYear = start.getFullYear();
    let endYear = end.getFullYear();
    let startMonth = start.getMonth();
    let endMonth = end.getMonth();

    let result = [];

    for (let i = startYear; i <= endYear; i++) {
        for (let j = (i === startYear ? startMonth : 0); j <= (i === endYear ? endMonth : 11); j++) {
            result.push(`${i}${j}`);
        }
    }

    return result;
}

export function groupTimesByPerson(start: Date, end: Date): IPromise<TimeTrackingCompleteEntryHierarchy[]> {
    let result: TimeTrackingCompleteEntryHierarchy[] = [];
    let personMap = new Map<string, TimeTrackingCompleteEntryHierarchy>();
    let personDayMap = new Map<string, TimeTrackingCompleteEntryHierarchy>();

    let addTime = (source: TimeTrackingCompleteEntry, target: TimeTrackingCompleteEntryHierarchy) => {
        target.hours += source.hours;
        target.cost += source.hours * source.role.cost;
        target.role = `${target.cost}${getNumberFormat().CurrencySymbol}`;

        if (target.parent)
            addTime(source, <TimeTrackingCompleteEntryHierarchy>target.parent);
    };

    return getGlobalWorkItemTimes(start, end).then((times) => {
        times.forEach((time) => {
            if (!personMap.has(time.personId)) {
                let element = <TimeTrackingCompleteEntryHierarchy>{ type: 'Person', workItemName: time.person, children: [], item: undefined, workItemId: 0, title: time.person, workItemType: 'Person', workItemIdString: '', cost: 0, hours: 0 };
                personMap.set(time.personId, element);
                result.push(element);
            }

            let dayKey = time.personId + format(time.date);

            if (!personDayMap.has(dayKey)) {
                let element = <TimeTrackingCompleteEntryHierarchy>{ type: 'Day', workItemName: format(time.date), children: [time], item: undefined, workItemId: 0, title: format(time.date), workItemType: 'Day', workItemIdString: '', cost: 0, hours: 0, date: time.date };
                personDayMap.set(dayKey, element);
                let parent = personMap.get(time.personId);
                parent.children.push(element);
                element.parent = parent;
                addTime(time, element);
            } else {
                let parent = personDayMap.get(dayKey);
                addTime(time, parent);
                parent.children.push(time);
            }
        });

        return result;
    });
}

export function groupTimesByBudget(start: Date, end: Date): IPromise<TimeTrackingCompleteEntryHierarchy[]> {
    return getGlobalWorkItemTimes(start, end).then((times) => {
        let index = new Set(times.map((time) => time.workItemIdString));

        return createBudgetMap(index).then((map) => {
            let cache = new Map<string, TimeTrackingCompleteEntryHierarchy>();
            let result: TimeTrackingCompleteEntryHierarchy[] = [];

            times.forEach((time) => {
                let budget = map.get(time.workItemIdString);
                addTimeToBudget(budget ? budget.budget.id : '-', time, budget ? budget.budget.name : '-', cache, result);
            });

            return result;
        });
    });
}

export interface TimeTrackingCompleteEntryHierarchy extends IWorkItemHierarchy<TimeTrackingCompleteEntry> {
    role: string;
    cost: number;
    hours: number;
    workItemIdString: string;
    workItemType: string;
    title: string;
    date?: Date;
}

function addTimeToBudget(id: string, entry: TimeTrackingCompleteEntry, name: string, cache: Map<string, TimeTrackingCompleteEntryHierarchy>, result: TimeTrackingCompleteEntryHierarchy[]) {
    let element: TimeTrackingCompleteEntryHierarchy;

    if (cache.has(id)) {
        element = cache.get(id);
        entry.budget = element.workItemName;
        element.children.push(entry);
    } else {
        element = <TimeTrackingCompleteEntryHierarchy>{ type: 'Budget', workItemName: name, children: [entry], item: undefined, workItemId: 0, title: name, workItemType: 'Budget', workItemIdString: '', cost: 0, hours: 0 };
        entry.budget = element.workItemName;
        cache.set(id, element);
        result.push(element);
    }

    element.cost += entry.hours * entry.role.cost;
    element.hours += entry.hours;
    element.role = `${element.cost}${getNumberFormat().CurrencySymbol}`;
}

function createBudgetMap(workItemIds: Set<string>, map?: Map<string, TimeTrackingBudgetDataDocument>): IPromise<Map<string, TimeTrackingBudgetDataDocument>> {
    if (!map)
        map = new Map<string, TimeTrackingBudgetDataDocument>();

    if (workItemIds.size > 0) {
        let me = workItemIds.values().next().value;
        return getCustomDocument(TimeTrackingBudgetAssignmentDocumentFactory.prototype.createDocumentId(me.toString()), TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer).then((doc) => {
            if (doc.budgetDataId) {
                return getCustomDocument(doc.budgetDataId, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer).then((data) => {
                    data.workItems.forEach((workItemId) => {
                        map.set(workItemId.toString(), data);
                        workItemIds.delete(workItemId.toString());
                    });

                    return createBudgetMap(workItemIds, map);
                });
            } else {
                map.set(me, undefined);
                workItemIds.delete(me);

                return createBudgetMap(workItemIds, map);
            }
        });
    } else {
        return Q(map);
    }
}

export function getGlobalWorkItemTimes(start: Date, end: Date): IPromise<TimeTrackingCompleteEntry[]> {
    let client = getClient();
    let result: TimeTrackingCompleteEntry[] = [];
    let keys = convertTimeFrameToIndexKeys(start, end);

    return getGlobalTimeIndex().then((index) => {
        let promises: IPromise<TimeTrackingEntriesTimeIndex>[] = [];
        keys.forEach((key) => {
            if (index.map.has(key)) {
                promises.push(getTimeIndexById(index.map.get(key)));
            }
        });
        if (promises.length > 0) {
            return Q.all(promises).then((indexes) => {
                let map = new Map<number, IPromise<TimeTrackingEntriesDocument>>();

                indexes.forEach((idx) => {
                    idx.map.forEach((value, key) => {
                        if (!map.has(key)) {
                            map.set(key, getDocumentById(value, TimeTrackingEntryFactory.prototype.itemConstructor));
                        }
                    })
                });

                if (map.size > 0) {
                    return Q.all(Array.from(map.values())).then((docs) => {
                        let wiMap = new Map<number, TimeTrackingCompleteEntry[]>();

                        docs.forEach((doc) => {
                            doc.map.forEach((value, key) => {
                                if (value.date >= start && value.date <= end) {
                                    let id = parseInt(doc.id.match("[^.]+$")[0]);
                                    if (!wiMap.has(id)) {
                                        wiMap.set(id, []);
                                    }

                                    wiMap.get(id).push(<TimeTrackingCompleteEntry>value);
                                    result.push(<TimeTrackingCompleteEntry>value);
                                }
                            });
                        });

                        if (wiMap.size > 0) {
                            return getWorkItems(Array.from(wiMap.keys()), ['System.WorkItemType', 'System.Title'], client).then((wis) => {
                                let workItemTypes = new Set(wis.map((wi) => wi.fields['System.WorkItemType']))
                                let witPromises: IPromise<WorkItemType>[] = [];
                                let project = getCurrentProject();

                                workItemTypes.forEach((wit) => {
                                    witPromises.push(client.getWorkItemType(project, wit));
                                });

                                return Q.all(witPromises).then((wits) => {
                                    let iconCache = new Map<string, string>();
                                    wits.forEach((wit) => {
                                        iconCache.set(wit.name, wit.icon.url);
                                    });

                                    wis.forEach((wi) => {
                                        wiMap.get(wi.id).forEach((v) => {
                                            v.workItemIdString = wi.id.toString();
                                            v.workItemType = wi.fields['System.WorkItemType'];
                                            v.title = wi.fields['System.Title'];
                                            v.icon = iconCache.get(v.workItemType);
                                        });
                                    });

                                    return result;
                                });
                            });
                        } else {
                            return Q(result);
                        }
                    });
                } else {
                    return Q(result);
                }
            });
        } else {
            return Q(result);
        }
    });
}

export function updateBudget(workItemId: number, fnUpdate: (data: TimeTrackingBudgetDataDocument) => void): IPromise<TimeTrackingBudgetDataDocument> {
    return getCustomDocument(TimeTrackingBudgetAssignmentDocumentFactory.prototype.createDocumentId(workItemId.toString()), TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer).then((doc) => {
        if (doc.budgetDataId) {
            return getCustomDocument(doc.budgetDataId, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer).then((data) => {
                fnUpdate(data);
                return updateCustomDocument(data, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer, TimeTrackingBudgetDataDocumentFactory.prototype.serializer);
            });
        } else {
            return Q(undefined);
        }
    });
}

function recalculateBudgetData(data: TimeTrackingBudgetDataDocument): IPromise<TimeTrackingBudgetDataDocument> {
    return getAllDocuments().then((docs) => {
        data.assignedCost = 0;
        data.assignedHours = 0;
        data.usedCost = 0;
        data.usedHours = 0;
        data.workItems.clear();

        if (!data.version)
            data.version = 0;

        let currentProject = getCurrentProject();
        let times = new Map<string, TimeTrackingEntriesDocument>();
        let estimates = new Map<string, TimeTrackingEstimateEntriesDocument>();
        let myRegEx = /tae\.(\d+)\.ba/;

        docs.forEach((doc) => {
            if (doc.id.startsWith(`tae.${currentProject}.t.`)) {
                times.set(doc.id, deserializeDocument(doc, TimeTrackingEntryFactory.prototype.itemConstructor));
            } else if (doc.id.startsWith(`tae.${currentProject}.e.`)) {
                estimates.set(doc.id, deserializeDocument(doc, TimeTrackingEstimateEntryFactory.prototype.itemConstructor));
            } else if (doc.id.startsWith('tae.') && doc.id.endsWith('.ba') && (doc.budgetDataId && doc.budgetDataId === data.id || doc.budget && doc.budget.budgetDataDocumentId && doc.budget.budgetDataDocumentId === data.id)) {
                data.workItems.add(parseInt(myRegEx.exec(doc.id)[1]));
            }
        });

        data.workItems.forEach((wi) => {
            let estimateDocId = TimeTrackingEstimateEntryFactory.prototype.createDocumentId(wi);
            let timesDocId = TimeTrackingEntryFactory.prototype.createDocumentId(wi);

            addWorkItemDataToBudget(data, times.has(timesDocId) ? times.get(timesDocId) : undefined, estimates.has(estimateDocId) ? estimates.get(estimateDocId) : undefined);
        });

        data.version = 2;

        updateQuery(currentProject, data.queryId, Array.from(data.workItems));

        return updateCustomDocument(data, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer, TimeTrackingBudgetDataDocumentFactory.prototype.serializer);
    });
}

export function loadBudgetAssignment(workItemId: number): IPromise<TimeTrackingBudgetDataDocument> {
    let client = getClient();
    let id = TimeTrackingBudgetAssignmentDocumentFactory.prototype.createDocumentId(workItemId.toString());

    return getCustomDocument(id, TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer).then((doc) => {
        if (doc.budgetDataId) {
            return getCustomDocument(doc.budgetDataId, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer).then((data) => {
                if (data.version === 2)
                    return Q(data);
                else {
                    return recalculateBudgetData(data);
                }
            });
        } else {
            return Q(undefined);
        }
    }, (reason) => {
        return Q.all<any>([
            getRelationTypes(client, (t) => t.attributes['topology'] === 'tree' && t.attributes['usage'] === 'workItemLink'),
            getWorkItemWithRelations(workItemId, client)
        ]).spread((types: Map<string, WorkItemRelationType>, wi: WorkItem) => {
            let parentId = getParentId(wi, types);

            if (parentId !== 0) {
                return getCustomDocument(TimeTrackingBudgetAssignmentDocumentFactory.prototype.createDocumentId(parentId.toString()), TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer, true).then((doc) => {
                    return createCustomDocument(id, TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer).then((newDoc) => {
                        if (doc.budgetDataId) {
                            return reassignBudget(workItemId, newDoc, undefined, doc.budgetDataId);
                        } else {
                            return Q(undefined);
                        }
                    });
                });
            } else {
                return createCustomDocument(id, TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer).then((newDoc) => {
                    return Q(undefined);
                });
            }
        });
    });
}

function addWorkItemDataToBudget(data: TimeTrackingBudgetDataDocument, times?: TimeTrackingEntriesDocument, estimates?: TimeTrackingEstimateEntriesDocument) {
    if (times)
        times.map.forEach((value, key) => {
            if (data.roles.has(value.role.name))
                value.role = data.roles.get(value.role.name);

            data.usedHours += value.hours;
            data.usedCost += value.role.cost * value.hours;
        });

    if (estimates)
        estimates.map.forEach((value, key) => {
            if (data.roles.has(value.role.name))
                value.role = data.roles.get(value.role.name);

            data.assignedHours += value.hours;
            data.assignedCost += value.role.cost * value.hours;
        });
}

function assignBudget(workItemId: number, budget: string, times: TimeTrackingEntriesDocument, estimates: TimeTrackingEstimateEntriesDocument, assignmentDoc: TimeTrackingBudgetAssignmentDocument): IPromise<TimeTrackingBudgetDataDocument> {
    return getCustomDocument(budget, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer).then((data) => {
        data.workItems.add(workItemId);

        addWorkItemDataToBudget(data, times, estimates);

        updateQuery(getCurrentProject(), data.queryId, Array.from(data.workItems));

        assignmentDoc.budgetDataId = budget;

        return Q.all([
            updateCustomDocument(assignmentDoc, TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer, TimeTrackingBudgetAssignmentDocumentFactory.prototype.serializer),
            updateCustomDocument(data, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer, TimeTrackingBudgetDataDocumentFactory.prototype.serializer),
            updateDocument(times, TimeTrackingEntryFactory.prototype.itemConstructor, TimeTrackingEntryFactory.prototype.itemSerializer),
            updateDocument(estimates, TimeTrackingEstimateEntryFactory.prototype.itemConstructor, TimeTrackingEstimateEntryFactory.prototype.itemSerializer)
        ]).spread((_, b: TimeTrackingBudgetDataDocument, uTimes, uEstimates) => {
            return b;
        });
    });
}

export function reassignBudgets(workItemIds: number[], newBudget: string, roles: TimeTrackingRolesDocument): IPromise<void> {
    if (workItemIds.length > 0) {
        return loadAndReassignBudget(workItemIds[0], newBudget, roles).then(() => {
            return reassignBudgets(workItemIds.splice(1), newBudget, roles);
        })
    } else {
        return Q(undefined);
    }
}

function loadAndReassignBudget(workItemId: number, newBudget: string, roles: TimeTrackingRolesDocument): IPromise<TimeTrackingBudgetDataDocument> {
    return getCustomDocument(TimeTrackingBudgetAssignmentDocumentFactory.prototype.createDocumentId(workItemId.toString()), TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer, true).then((assignment) => {
        return reassignBudget(workItemId, assignment, assignment.budgetDataId, newBudget, roles);
    });
}

export function reassignBudget(workItemId: number, assignment?: TimeTrackingBudgetAssignmentDocument, oldBudget?: string, newBudget?: string, roles?: TimeTrackingRolesDocument): IPromise<TimeTrackingBudgetDataDocument> {
    return Q.all([
        oldBudget ? getCustomDocument(oldBudget, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer) : Q(undefined),
        assignment ? Q(assignment) : getCustomDocument(TimeTrackingBudgetAssignmentDocumentFactory.prototype.createDocumentId(workItemId.toString()), TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer),
        getDocumentById<TimeTrackingEntriesDocument, string, TimeTrackingEntry>(TimeTrackingEntryFactory.prototype.createDocumentId(workItemId), TimeTrackingEntryFactory.prototype.itemConstructor),
        getDocumentById<TimeTrackingEstimateEntriesDocument, string, TimeTrackingEstimateEntry>(TimeTrackingEstimateEntryFactory.prototype.createDocumentId(workItemId), TimeTrackingEstimateEntryFactory.prototype.itemConstructor),
        roles ? Q(roles) : TimeTrackingRoleFactory.getRoles()
    ]).spread((data: TimeTrackingBudgetDataDocument, assignmentDoc: TimeTrackingBudgetAssignmentDocument, times: TimeTrackingEntriesDocument, estimates: TimeTrackingEstimateEntriesDocument, rolesDoc: TimeTrackingRolesDocument) => {
        if (oldBudget) {
            data.workItems.delete(workItemId);

            times.map.forEach((value, key) => {
                data.usedHours -= value.hours;
                data.usedCost -= value.role.cost * value.hours;
                value.role = rolesDoc.map.get(value.role.name);
            });

            estimates.map.forEach((value, key) => {
                data.assignedHours -= value.hours;
                data.assignedCost -= value.role.cost * value.hours;
                value.role = rolesDoc.map.get(value.role.name);
            });

            assignmentDoc.budgetDataId = undefined;

            return updateQuery(getCurrentProject(), data.queryId, Array.from(data.workItems)).then(() => {
                return updateCustomDocument(data, TimeTrackingBudgetDataDocumentFactory.prototype.deserializer, TimeTrackingBudgetDataDocumentFactory.prototype.serializer).then((doc) => {
                    if (newBudget) {
                        return assignBudget(workItemId, newBudget, times, estimates, assignmentDoc);
                    } else {
                        return Q.all([
                            updateDocument(times, TimeTrackingEntryFactory.prototype.itemConstructor, TimeTrackingEntryFactory.prototype.itemSerializer),
                            updateDocument(estimates, TimeTrackingEstimateEntryFactory.prototype.itemConstructor, TimeTrackingEstimateEntryFactory.prototype.itemSerializer),
                            updateCustomDocument(assignmentDoc, TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer, TimeTrackingBudgetAssignmentDocumentFactory.prototype.serializer)
                        ]).spread((uTimes, uEstimates, uAssignmentDoc: TimeTrackingBudgetDataDocument) => {
                            return uAssignmentDoc;
                        });
                    }
                });
            });
        } else {
            if (newBudget) {
                return assignBudget(workItemId, newBudget, times, estimates, assignmentDoc);
            } else {
                return Q(undefined);
            }
        }
    });
}

export interface ITimeTrackingData {
    bookings: ITimeTrackingDataValue;
    estimates: ITimeTrackingDataValue;
}

export interface ITimeTrackingDataValue {
    hours: number;
    cost: number;
}

export function updateRoleRates(workItemId: number, roles: TimeTrackingRolesDocument, overriddenRoles: Map<string, TimeTrackingRole>): IPromise<ITimeTrackingData> {
    return Q.all([
        getDocumentById<TimeTrackingEntriesDocument, string, TimeTrackingEntry>(TimeTrackingEntryFactory.prototype.createDocumentId(workItemId), TimeTrackingEntryFactory.prototype.itemConstructor),
        getDocumentById<TimeTrackingEstimateEntriesDocument, string, TimeTrackingEstimateEntry>(TimeTrackingEstimateEntryFactory.prototype.createDocumentId(workItemId), TimeTrackingEstimateEntryFactory.prototype.itemConstructor)
    ]).spread((times: TimeTrackingEntriesDocument, estimates: TimeTrackingEstimateEntriesDocument) => {
        let estimatedHours = 0;
        let estimatedCost = 0;
        let hours = 0;
        let cost = 0;

        times.map.forEach((value, key) => {
            if (overriddenRoles.has(value.role.name))
                value.role = overriddenRoles.get(value.role.name);
            else if (roles.map.has(value.role.name))
                value.role = roles.map.get(value.role.name);

            hours += value.hours;
            cost += value.hours * value.role.cost;
        });

        estimates.map.forEach((value, key) => {
            if (overriddenRoles.has(value.role.name))
                value.role = overriddenRoles.get(value.role.name);
            else if (roles.map.has(value.role.name))
                value.role = roles.map.get(value.role.name);

            estimatedHours += value.hours;
            estimatedCost += value.hours * value.role.cost;
        });

        return Q.all([
            updateDocument(times, TimeTrackingEntryFactory.prototype.itemConstructor, TimeTrackingEntryFactory.prototype.itemSerializer),
            updateDocument(estimates, TimeTrackingEstimateEntryFactory.prototype.itemConstructor, TimeTrackingEstimateEntryFactory.prototype.itemSerializer)
        ]).spread((uTimes, uEstimates) => {
            return {
                bookings: {
                    hours: hours,
                    cost: cost
                },
                estimates: {
                    hours: estimatedHours,
                    cost: estimatedCost
                }
            }
        });
    });
}

export function getWorkItemHierarchy<TEntity, TDocument extends IDocument<string, TEntity>, TEntityFactory extends IEntityFactory<TEntity, TDocument>, TWorkItemHierarchy extends IWorkItemHierarchy<TEntity>, TAggregateValues>(options: IBaseHierarchyGridOptions<TEntity, TDocument, TEntityFactory, TWorkItemHierarchy, TAggregateValues>): IPromise<TWorkItemHierarchy> {
    let client = getClient();

    return Q.all<any>([
        getRelationTypes(client, (t) => t.attributes['topology'] === 'tree' && t.attributes['usage'] === 'workItemLink'),
        getWorkItemWithRelations(options.workItemId, client)
    ]).spread((types: Map<string, WorkItemRelationType>, wi: WorkItem) => {
        return createHierarchyRec<TEntity, TWorkItemHierarchy>([wi], client, types, options.fnApplyValues).then((map) => {
            return loadEntries<TEntity, TDocument, TEntityFactory, TWorkItemHierarchy, TAggregateValues>(map, options).then(() => {
                return map.get(wi.id);
            });
        });
    });
}

export function getWorkItemAncestorHierarchy<T>(workItemId: number): IPromise<IWorkItemInfo[]> {
    let client = getClient();

    return Q.all<any>([
        getRelationTypes(client, (t) => t.attributes['topology'] === 'tree' && t.attributes['usage'] === 'workItemLink'),
        getWorkItemWithRelations(workItemId, client)
    ]).spread((types: Map<string, WorkItemRelationType>, wi: WorkItem) => {
        return createParentHierarchyRec(workItemId, wi, client, types).then((parents) => {
            return parents;
        });
    });
}

export interface IWorkItemHierarchy<TEntity> extends IWorkItemInfo {
    item: WorkItem;
    children?: Array<IWorkItemHierarchy<TEntity> | TEntity>;
    parent?: IWorkItemHierarchy<TEntity>;
}

export interface IWorkItemInfo {
    workItemId: number;
    type: string;
    workItemName: string;
    icon: string;
}

export function getWorkItemInfo(workItemId: number): IPromise<IWorkItemInfo> {
    return getClient().getWorkItem(workItemId, ['System.WorkItemType', 'System.Title']).then((workItem) => {
        return <IWorkItemInfo>{ workItemId: workItem.id, workItemName: workItem.fields['System.Title'], type: workItem.fields['System.WorkItemType'] };
    });
}

function loadEntries<TEntity, TDocument extends IDocument<string, TEntity>, TEntityFactory extends IEntityFactory<TEntity, TDocument>, TWorkItemHierarchy extends IWorkItemHierarchy<TEntity>, TAggregateValues>(
    hierarchyMap: Map<number, TWorkItemHierarchy>, options: IBaseHierarchyGridOptions<TEntity, TDocument, TEntityFactory, TWorkItemHierarchy, TAggregateValues>): IPromise<void> {
    let promises: IPromise<TDocument>[] = [];
    let mapping = new Map<string, number>();

    hierarchyMap.forEach((value, key) => {
        let docId = options.fnGetDocumentId(key);
        mapping.set(docId, key);
        promises.push(getDocumentById<TDocument, string, TEntity>(docId, options.factory.itemConstructor));
    });

    return Q.all(promises).then((docs: TDocument[]) => {
        docs.forEach((doc) => {
            if (doc.map.size > 0) {
                let e = hierarchyMap.get(mapping.get(doc.id));

                if (!e.children) {
                    e.children = [];
                }

                let agg = options.fnInitAgg();

                doc.map.forEach((value, key) => {
                    options.fnAggValue(value, agg);
                    e.children.push(value);
                });

                if (options.fnCheckAgg(e, agg)) {
                    let parent = e.parent;

                    while (parent) {
                        options.fnRollUp(<TWorkItemHierarchy>parent, agg);

                        parent = parent.parent;
                    }
                }
            }
        });
    });
}

function getParentId(workItem: WorkItem, types: Map<string, WorkItemRelationType>): number {
    let parentId = 0;

    if (workItem.relations) {
        workItem.relations.forEach((r) => {
            if (types.has(r.rel) && types.get(r.rel).name === 'Parent') {
                parentId = parseInt(r.url.match("[^/]+$")[0]);
            }
        });
    }

    return parentId;
}

function createParentHierarchyRec(rootId: number, workItem: WorkItem, client: WorkItemTrackingHttpClient3_2, types: Map<string, WorkItemRelationType>, parents?: IWorkItemInfo[]): IPromise<IWorkItemInfo[]> {
    if (!parents)
        parents = [];

    if (rootId !== workItem.id) {
        parents.push(<IWorkItemInfo>{ workItemId: workItem.id, workItemName: workItem.fields['System.Title'], type: workItem.fields['System.WorkItemType'] });
    }

    let parentId = getParentId(workItem, types);

    if (parentId !== 0) {
        return getWorkItemWithRelations(parentId, client).then((parent) => createParentHierarchyRec(rootId, parent, client, types, parents));
    } else {
        return Q(parents);
    }
}

function createHierarchyRec<TEntity, TWorkItemHierarchy extends IWorkItemHierarchy<TEntity>>(items: WorkItem[], client: WorkItemTrackingHttpClient3_2, types: Map<string, WorkItemRelationType>, fnApplyValues: (element: TWorkItemHierarchy) => void, icons?: Map<string, string>, mapping?: Map<number, TWorkItemHierarchy>): IPromise<Map<number, TWorkItemHierarchy>> {
    if (!mapping) {
        mapping = new Map<number, TWorkItemHierarchy>();
    }

    if (!icons) {
        icons = new Map<string, string>();
    }

    let nextLevel: number[] = [];

    let workItemTypes = new Set(items.map((wi) => wi.fields['System.WorkItemType']))
    let witPromises: IPromise<WorkItemType>[] = [];
    let project = getCurrentProject();

    workItemTypes.forEach((wit) => {
        if (!icons.has(wit))
            witPromises.push(client.getWorkItemType(project, wit));
    });

    return Q.all(witPromises).then((wits) => {
        wits.forEach((wit) => {
            icons.set(wit.name, wit.icon.url);
        });

        items.forEach((wi) => {
            let e = <TWorkItemHierarchy>{ item: wi, workItemId: wi.id, workItemName: wi.fields['System.Title'], type: wi.fields['System.WorkItemType'] };
            e.icon = icons.get(e.type);

            fnApplyValues(e);

            mapping.set(wi.id, e);

            if (wi.relations) {
                wi.relations.forEach((r) => {
                    if (types.has(r.rel)) {
                        let id = parseInt(r.url.match("[^/]+$")[0]);

                        if (types.get(r.rel).name === 'Parent') {
                            if (mapping.has(id)) {
                                let v = mapping.get(id);
                                mapping.get(wi.id).parent = v;

                                if (!v.children) {
                                    v.children = [];
                                }

                                v.children.push(mapping.get(wi.id));
                            }
                        } else {
                            nextLevel.push(id);
                        }
                    }
                });
            }
        });

        if (nextLevel.length > 0) {
            return getWorkItemsWithRelations(nextLevel, client).then((wis) => createHierarchyRec(wis, client, types, fnApplyValues, icons, mapping));
        } else {
            return Q(mapping);
        }
    });
}