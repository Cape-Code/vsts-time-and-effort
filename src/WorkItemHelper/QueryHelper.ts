import { getClient } from 'TFS/WorkItemTracking/RestClient';
import { QueryHierarchyItem } from 'TFS/WorkItemTracking/Contracts';

export function createFolderIfNotExists(project: string, name: string): IPromise<QueryHierarchyItem> {
    let client = getClient();

    return client.getQuery(project, `Shared Queries/${name}`).then((query) => query, (reason) => {
        return client.createQuery(<QueryHierarchyItem>{ name: name, isFolder: true }, project, 'Shared Queries');
    });
}

export function createQuery(project: string, name: string, ids: number[], parent: QueryHierarchyItem): IPromise<QueryHierarchyItem> {
    return getClient().createQuery(<QueryHierarchyItem>{ name: name, wiql: createWIQL(ids) }, project, parent.path);
}

export function updateQuery(project: string, queryId: string, ids: number[]): IPromise<QueryHierarchyItem> {
    let client = getClient();

    return client.getQuery(project, queryId).then((query) => {
        return client.updateQuery(<QueryHierarchyItem>{ wiql: createWIQL(ids) }, project, query.id);
    });
}

export function deleteQuery(project: string, queryId: string): IPromise<void> {
    return getClient().deleteQuery(project, queryId);
}

function createWIQL(ids: number[]): string {
    if (ids.length === 0)
        ids.push(0);

    return `select [System.Id], [System.WorkItemType], [System.Title], [System.AssignedTo], [System.State], [System.Tags], [System.IterationPath], [System.AreaPath] from WorkItemLinks where (Source.[System.TeamProject] = @project and Source.[System.WorkItemType] <> '' and Source.[System.Id] in (${ids.join()})) and ([System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward') and (Target.[System.TeamProject] = @project and Target.[System.WorkItemType] <> '' and Target.[System.Id] in (${ids.join()})) mode (Recursive)`;
}