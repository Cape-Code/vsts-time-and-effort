import { IDocument, TimeTrackingEntriesGlobalTimeIndex, TimeTrackingEntriesTimeIndex, ICustomDocument } from './Contract';
import { ExtensionDataService } from 'VSS/SDK/Services/ExtensionData';

function _getService(): IPromise<ExtensionDataService> {
    return VSS.getService(VSS.ServiceIds.ExtensionData).then((dataService: ExtensionDataService) => {
        return dataService;
    });
}

function _getCurrentCollection(): string {
    return VSS.getWebContext().collection.name;
}

export function getCurrentProject(): string {
    return VSS.getWebContext().project.id.replace(/-/g, '');
}

function _serializeData<T extends IDocument<U, V>, U, V>(value: T, serializeFn?: (x: V) => any): T {
    if (serializeFn) {
        value.serialized = [];
        for (let kvp of value.map.entries()) {
            value.serialized.push([kvp[0], serializeFn(kvp[1])]);
        }
    } else {
        value.serialized = Array.from(value.map.entries());
    }

    return value;
}

function _deserializeData<T extends IDocument<U, V>, U, V>(value: T, constructorFn?: (x: any) => V): T {
    value.map = new Map<U, V>();

    value.serialized.forEach((v) => {
        value.map.set(v[0], constructorFn ? constructorFn(v[1]) : v[1]);
    });

    value.serialized = [];
    return value;
}

export function getGlobalTimeIndex(): IPromise<TimeTrackingEntriesGlobalTimeIndex> {
    return getDocument<TimeTrackingEntriesGlobalTimeIndex, string, string>(`tae.${getCurrentProject()}.gti`);
}

export function getTimeIndex(year: number, month: number): IPromise<TimeTrackingEntriesTimeIndex> {
    return getDocument<TimeTrackingEntriesTimeIndex, number, string>(`tae.${getCurrentProject()}.ti.${year}${month}`, { idForGlobalIndex: `${year}${month}` });
}

export function getTimeIndexById(id: string): IPromise<TimeTrackingEntriesTimeIndex> {
    return getDocument<TimeTrackingEntriesTimeIndex, number, string>(id);
}

export function getDocumentById<T extends IDocument<U, V>, U, V>(id: string, constructorFn?: (x: any) => V): IPromise<T> {
    return getDocument(id, { constructorFn: constructorFn });
}

export interface IGetDocumentParameter<V> {
    constructorFn?: (x: any) => V;
    serializeFn?: (x: V) => any;
    idForGlobalIndex?: number | string;
}

export function createCustomDocument<T extends ICustomDocument>(id: string, constructorFn: (x: any) => T): IPromise<T> {
    let collection = _getCurrentCollection();

    return _getService().then((dataService) => {
        return dataService.createDocument(collection, { id: id }).then((doc) => {
            return constructorFn(doc);
        }, (reason) => {
            throw reason;
        });
    });
}

export function createCustomDocumentWithValue<T extends ICustomDocument>(value: T, constructorFn: (x: any) => T, serializeFn: (x: T) => any): IPromise<T> {
    let collection = _getCurrentCollection();

    return _getService().then((dataService) => {
        return dataService.createDocument(collection, serializeFn(value)).then((doc) => {
            return constructorFn(doc);
        }, (reason) => {
            throw reason;
        });
    });
}

export function getCustomDocument<T extends ICustomDocument>(id: string, constructorFn: (x: any) => T, createIfNotExists = false): IPromise<T> {
    let collection = _getCurrentCollection();

    return _getService().then((dataService) => {
        return dataService.getDocument(collection, id).then((doc) => {
            if (doc.id === id) {
                return constructorFn(doc);
            } else {
                throw `Id mismatch from service!!! Requested document ${id} and got ${doc.id}!`;
            }
        }, (reason) => {
            if (createIfNotExists) {
                return dataService.createDocument(collection, { id: id }).then((doc) => {
                    return constructorFn(doc);
                }, (reason) => {
                    throw reason;
                });
            } else
                throw reason;
        });
    });
}

export function updateCustomDocument<T extends ICustomDocument>(doc: T, constructorFn: (x: any) => T, serializeFn: (x: T) => any): IPromise<T> {
    let collection = _getCurrentCollection();

    return _getService().then((dataService) => {
        return dataService.getDocument(collection, doc.id).then((storedDoc) => {
            if (storedDoc.__etag > doc.__etag) {
                throw 'Conflicting change detected! Please reload & try again!';
            } else {
                return dataService.updateDocument(collection, serializeFn(doc)).then((doc) => {
                    return constructorFn(doc);
                });
            }
        });
    });
}

export function getDocument<T extends IDocument<U, V>, U, V>(id: string, options?: IGetDocumentParameter<V>): IPromise<T> {
    let collection = _getCurrentCollection();

    if (!options)
        options = {};

    return _getService().then((dataService) => {
        return dataService.getDocument(collection, id).then((doc) => {
            if (doc.id === id) {
                return _deserializeData(doc, options.constructorFn);
            } else {
                throw `Id mismatch from service!!! Requested document ${id} and got ${doc.id}!`;
            }
        }, (reason) => {
            if (options.idForGlobalIndex && typeof options.idForGlobalIndex === 'string') {
                return getGlobalTimeIndex().then((index) => {
                    index.map.set(<string>options.idForGlobalIndex, id);
                    return updateDocument(index).then(() => {
                        return createDocument(dataService, collection, id, options);
                    });
                });
            }

            return createDocument(dataService, collection, id, options);
        });
    });
}

export function deserializeDocument<T extends IDocument<U, V>, U, V>(doc: any, constructorFn: (x: any) => V) {
    return _deserializeData(doc, constructorFn);
}

function createDocument<T extends IDocument<U, V>, U, V>(dataService: ExtensionDataService, collection: string, id: string, options?: IGetDocumentParameter<V>): IPromise<T> {
    return dataService.createDocument(collection, _serializeData(<T>{ id: id, map: new Map<U, V>(), serialized: [] }, options.serializeFn)).then((doc) => {
        return _deserializeData(doc, options.constructorFn);
    }, (reason) => {
        throw reason;
    });
}

export function updateDocument<T extends IDocument<U, V>, U, V>(doc: T, constructorFn?: (x: any) => V, serializeFn?: (x: V) => any): IPromise<T> {
    let collection = _getCurrentCollection();

    return _getService().then((dataService) => {
        return dataService.getDocument(collection, doc.id).then((storedDoc) => {
            if (storedDoc.__etag > doc.__etag) {
                throw 'Conflicting change detected! Please reload & try again!';
            } else {
                return dataService.updateDocument(collection, _serializeData(doc, serializeFn)).then((doc) => {
                    return _deserializeData(doc, constructorFn);
                });
            }
        });
    });
}

export function deleteDocument(id: string): IPromise<void> {
    let collection = _getCurrentCollection();
    return _getService().then((dataService) => {
        return dataService.deleteDocument(collection, id);
    });
}

export function getAllDocuments(): IPromise<any[]> {
    let collection = _getCurrentCollection();
    return _getService().then((dataService) => {
        return dataService.getDocuments(collection).then((docs) => docs);
    });
}

// export function deleteAllDocuments(): IPromise<void> {
//     let collection = _getCurrentCollection();
//     return _getService().then((dataService) => {
//         return dataService.getDocuments(collection).then((docs) => {
//             let promises: IPromise<void>[] = [];

//             docs.forEach((doc) => {
//                 if (doc.id && (<string>doc.id).startsWith('tae'))
//                     promises.push(dataService.deleteDocument(collection, doc.id));
//             });

//             return Q.all(promises).then(() => undefined);
//         });
//     });
// }