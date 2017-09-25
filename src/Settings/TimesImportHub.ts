import { TimeTrackingBudgetAssignmentDocumentFactory, TimeTrackingBudgetAssignmentDocument } from './../Data/TimeTrackingBudgetAssignmentDocument';
import { TimeTrackingRole, TimeTrackingRoleFactory } from './../Data/TimeTrackingRole';
import { TimeTrackingEstimateEntryFactory, TimeTrackingEstimateEntry } from './../Data/TimeTrackingEstimateEntry';
import { TimeTrackingEntryFactory, TimeTrackingEntry } from './../Data/TimeTrackingEntry';
import { WaitControl } from 'VSS/Controls/StatusIndicator';
import { ICustomDocument, TimeTrackingEntriesDocument, TimeTrackingEstimateEntriesDocument, TimeTrackingEntriesTimeIndex } from './../Data/Contract';
import { hasAccess } from "../Auth/AuthHelper";
import { createNotification } from "../UIHelper/NotificationHelper";
import { getClient, WorkItemTrackingHttpClient3_2 } from "TFS/WorkItemTracking/RestClient";
import { Wiql, WorkItemUpdate } from "TFS/WorkItemTracking/Contracts";
import { getCurrentProject, getCustomDocument, createCustomDocumentWithValue, updateCustomDocument, getDocumentById, updateDocument, getTimeIndex } from "../Data/DataServiceHelper";
import * as Q from 'q';
import { createWaitControl } from "../UIHelper/WaitHelper";
import { newGuid } from "../Data/Guid";

export class TimesImportHub {
    private fnDeserialize: (x: any) => TimeTrackingImportQueueDocument;
    private fnSerialize: (x: TimeTrackingImportQueueDocument) => any;
    private project: string;
    private queueDocumentId: string;
    private wait: WaitControl;
    private client: WorkItemTrackingHttpClient3_2;
    private role: TimeTrackingRole;
    private indexes: Map<number, Map<number, TimeTrackingEntriesTimeIndex>>;
    private dirtyIndexes: Map<number, Map<number, TimeTrackingEntriesTimeIndex>>;

    public init(): void {
        /*
        To enable import add
        
        {
            "id": "tae-times-import-hub",
            "type": "ms.vss-web.hub",
            "description": "Import for the Time & Effort extension",
            "targets": [
                "ms.vss-web.project-admin-hub-group"
            ],
            "properties": {
                "name": "Time Import",
                "order": 101,
                "uri": "pages/times-import.html"
            }
        },

        to vss-extension.json

        use at OWN RISK!!!

        */
        hasAccess().then((res) => {
            if (res) {
                let container = $('#timesImportContainer');
                this.wait = createWaitControl(container);
                this.wait.startWait();
                this.project = getCurrentProject();
                this.client = getClient();
                this.fnDeserialize = (x) => <TimeTrackingImportQueueDocument>x;
                this.fnSerialize = (x) => x;
                this.queueDocumentId = `tae.${this.project}.iq`;
                this.indexes = new Map<number, Map<number, TimeTrackingEntriesTimeIndex>>();
                this.dirtyIndexes = new Map<number, Map<number, TimeTrackingEntriesTimeIndex>>();

                TimeTrackingRoleFactory.getRoles().then((roles) => {
                    this.role = roles.map.get('Developer');

                    getCustomDocument(this.queueDocumentId, this.fnDeserialize).then((queue) => {
                        this._handleQueue(queue).then((res) => {
                            this.wait.endWait();
                        }, (reason) => {
                            this.wait.endWait();
                            this._createErrorMessage(reason);
                        });
                    }, (reason) => {
                        createCustomDocumentWithValue(new TimeTrackingImportQueueDocument(this.queueDocumentId), this.fnDeserialize, this.fnSerialize).then((queue) => {
                            this._handleQueue(queue).then((res) => {
                                this.wait.endWait();
                            }, (reason) => {
                                this.wait.endWait();
                                this._createErrorMessage(reason);
                            });
                        });
                    });
                });
            } else {
                this._createErrorMessage('You are not authorized to view this page!');
            }
        });
    }

    private _createErrorMessage(message: string) {
        let container = $('.taePage');
        container.empty();
        container.removeClass('taePage');
        createNotification(container).setError($("<span />").html(message));
    }

    private _loadWorkItem(workItemId: number): IPromise<TimeTrackingImportWorkItemData> {
        return Q.all([
            this.client.getUpdates(workItemId),
            getDocumentById<TimeTrackingEntriesDocument, string, TimeTrackingEntry>(TimeTrackingEntryFactory.prototype.createDocumentId(workItemId), TimeTrackingEntryFactory.prototype.itemConstructor),
            getDocumentById<TimeTrackingEstimateEntriesDocument, string, TimeTrackingEstimateEntry>(TimeTrackingEstimateEntryFactory.prototype.createDocumentId(workItemId), TimeTrackingEstimateEntryFactory.prototype.itemConstructor),
            getCustomDocument(TimeTrackingBudgetAssignmentDocumentFactory.prototype.createDocumentId(workItemId.toString()), TimeTrackingBudgetAssignmentDocumentFactory.prototype.deserializer, true)
        ]).spread((updates: WorkItemUpdate[], times: TimeTrackingEntriesDocument, estimates: TimeTrackingEstimateEntriesDocument, assignment: TimeTrackingBudgetAssignmentDocument) => {
            return <TimeTrackingImportWorkItemData>{
                updates: updates,
                times: times,
                estimates: estimates
            };
        });
    }

    private _handleQueue(queue: TimeTrackingImportQueueDocument): IPromise<TimeTrackingImportQueueDocument> {
        return this._fillQueue(queue).then((filled) => {
            if (filled.workItemIds.length > 0) {
                let batch = filled.workItemIds.slice(0, 100);
                filled.workItemIds = filled.workItemIds.splice(100);

                console.log(`Loading next batch with size ${batch.length} -- ${filled.workItemIds.length} remaining`);

                return Q.all(batch.map((wi) => this._loadWorkItem(wi))).then((data) => {
                    let documentUpdates: IPromise<any>[] = [];

                    console.log(`Importing ${data.length} work items`);

                    return this._importWorkItems(data, documentUpdates).then(() => {
                        console.log('Batch import complete');
                        documentUpdates.push(this._updateDirtyIndexes());

                        return Q.all(documentUpdates).then(() => {
                            console.log('Batch document updates complete');
                            return updateCustomDocument(filled, this.fnDeserialize, this.fnSerialize).then((updated) => {
                                console.log('Updated queue');
                                return this._handleQueue(updated);
                            });
                        });
                    });
                });
            } else {
                console.log('Queue is empty');
                return Q(filled);
            }
        });
    }

    private _importWorkItems(items: TimeTrackingImportWorkItemData[], documentUpdates: IPromise<any>[]): IPromise<void> {
        if (items.length > 0) {
            return this._importWorkItem(items[0], documentUpdates).then(() => {
                return this._importWorkItems(items.splice(1), documentUpdates);
            });
        } else {
            console.log('All work items imported for batch');
            return Q(undefined);
        }
    }

    private _importWorkItem(workItemData: TimeTrackingImportWorkItemData, documentUpdates: IPromise<any>[]): IPromise<void> {
        console.log(`Importing work item ${workItemData.updates[0].workItemId}`);
        return this._importWorkItemUpdates(workItemData.updates, workItemData.estimates, workItemData.times, documentUpdates);
    }

    private _importWorkItemUpdates(updates: WorkItemUpdate[], estimates: TimeTrackingEstimateEntriesDocument, times: TimeTrackingEntriesDocument, documentUpdates: IPromise<any>[], lastEstimate?: TimeTrackingEstimateEntry, lastBooking?: TimeTrackingEntry): IPromise<void> {
        if (updates.length > 0) {
            console.log('Importing update for item');
            let estimate = this._importWorkItemEstimate(estimates, updates[0], lastEstimate);
            return this._importWorkItemBooking(times, updates[0], lastBooking).then((booking) => {
                return this._importWorkItemUpdates(updates.splice(1), estimates, times, documentUpdates, estimate, booking);
            });
        } else {
            console.log('All updates imported for item');
            if (lastBooking) {
                documentUpdates.push(updateDocument(times, TimeTrackingEntryFactory.prototype.itemConstructor, TimeTrackingEntryFactory.prototype.itemSerializer));
            }

            if (lastEstimate) {
                documentUpdates.push(updateDocument(estimates, TimeTrackingEstimateEntryFactory.prototype.itemConstructor, TimeTrackingEstimateEntryFactory.prototype.itemSerializer));
            }

            return Q(undefined);
        }
    }

    private _importWorkItemEstimate(estimates: TimeTrackingEstimateEntriesDocument, update: WorkItemUpdate, lastEstimate: TimeTrackingEstimateEntry): TimeTrackingEstimateEntry {
        if (update.fields) {
            let fnCreate = (hours: number) => {
                let estimate = new TimeTrackingEstimateEntry(newGuid(), this.role, hours, 'Imported', undefined, undefined);
                estimates.map.set(estimate.id, estimate);
                return estimate;
            };

            let estimated = update.fields['Microsoft.VSTS.Scheduling.OriginalEstimate'];

            if (estimated) {
                if (estimated.oldValue) {
                    if (estimated.oldValue > estimated.newValue) {
                        lastEstimate.hours = lastEstimate.hours - (estimated.oldValue - estimated.newValue);
                    } else {
                        return fnCreate(estimated.newValue - estimated.oldValue);
                    }
                } else {
                    if (estimated.newValue !== 0)
                        return fnCreate(estimated.newValue);
                }
            }
        }

        return lastEstimate;
    }

    private _importWorkItemBooking(times: TimeTrackingEntriesDocument, update: WorkItemUpdate, lastBooking: TimeTrackingEntry): IPromise<TimeTrackingEntry> {
        if (update.fields) {
            let fnCreate = (hours: number) => {
                let booking = new TimeTrackingEntry(newGuid(), update.revisedBy.id, update.revisedBy.name.substring(0, update.revisedBy.name.indexOf('<') - 1), this.role, hours, new Date(update.fields['System.ChangedDate'].newValue), 'Import');
                times.map.set(booking.id, booking);
                return this._updateTimeIndex(booking, update.workItemId).then((idx) => {
                    return booking;
                });
            };

            let completed = update.fields['Microsoft.VSTS.Scheduling.CompletedWork'];

            if (completed) {
                if (completed.oldValue) {
                    if (completed.oldValue > completed.newValue) {
                        lastBooking.hours = lastBooking.hours - (completed.oldValue - completed.newValue);
                    } else {
                        return fnCreate(completed.newValue - completed.oldValue);
                    }
                } else {
                    if (completed.newValue !== 0)
                        return fnCreate(completed.newValue);
                }
            }
        }

        return Q(lastBooking);
    }

    private _getTimeIndex(entry: TimeTrackingEntry): IPromise<TimeTrackingEntriesTimeIndex> {
        let year = entry.date.getFullYear();
        let month = entry.date.getMonth();

        if (this.indexes.has(year) && this.indexes.get(year).has(month)) {
            return Q(this.indexes.get(year).get(month));
        } else {
            return getTimeIndex(year, month).then((idx) => {
                if (!this.indexes.has(year))
                    this.indexes.set(year, new Map<number, TimeTrackingEntriesTimeIndex>());
                this.indexes.get(year).set(month, idx);

                return idx;
            });
        }
    }

    private _updateDirtyIndexes(): IPromise<void> {
        console.log('Updating dirty indexes');
        let promises: IPromise<TimeTrackingEntriesTimeIndex>[] = [];

        this.dirtyIndexes.forEach((map, year) => {
            map.forEach((idx, month) => {
                promises.push(updateDocument(idx).then((doc) => {
                    this.indexes.get(year).set(month, doc);
                }));
            });
        });

        this.dirtyIndexes.clear();

        return Q.all(promises).then(() => {
            console.log('Index update complete');
            return undefined;
        });
    }

    private _markIndexAsDirty(entry: TimeTrackingEntry, idx: TimeTrackingEntriesTimeIndex) {
        let year = entry.date.getFullYear();
        let month = entry.date.getMonth();

        if (!this.dirtyIndexes.has(year))
            this.dirtyIndexes.set(year, new Map<number, TimeTrackingEntriesTimeIndex>());
        if (!this.dirtyIndexes.get(year).has(month))
            this.dirtyIndexes.get(year).set(month, idx);
    }

    private _updateTimeIndex(entry: TimeTrackingEntry, workItemId: number): IPromise<void> {
        return this._getTimeIndex(entry).then((index) => {
            if (!index.map.has(workItemId)) {
                index.map.set(workItemId, TimeTrackingEntryFactory.prototype.createDocumentId(workItemId));
                this._markIndexAsDirty(entry, index);
            }

            return undefined;
        });
    }

    private _fillQueue(queue: TimeTrackingImportQueueDocument): IPromise<TimeTrackingImportQueueDocument> {
        if (queue.isNew) {
            return this.client.queryByWiql({ query: "select [System.Id] from WorkItems where [System.TeamProject] = @project and [System.WorkItemType] = 'Task' and ([Microsoft.VSTS.Scheduling.OriginalEstimate] <> 0 or [Microsoft.VSTS.Scheduling.CompletedWork] <> 0)" }, this.project).then((res) => {
                queue.workItemIds = res.workItems.map((wir) => wir.id);
                queue.isNew = false;

                return updateCustomDocument(queue, this.fnDeserialize, this.fnSerialize);
            });
        }

        return Q(queue);
    }
}

class TimeTrackingImportQueueDocument implements ICustomDocument {
    constructor(public id: string, public workItemIds: number[] = [], public isNew: boolean = true) {
    }
}

interface TimeTrackingImportWorkItemData {
    updates: WorkItemUpdate[];
    times: TimeTrackingEntriesDocument;
    estimates: TimeTrackingEstimateEntriesDocument;
}