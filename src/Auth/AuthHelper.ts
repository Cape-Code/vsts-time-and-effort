import { getClient } from 'VSS/Security/RestClient';

export function hasAccess(): IPromise<boolean> {
    //checks for "{bit: 8192, name: "WORK_ITEM_DELETE", displayName: "Delete and restore work items",…}" rights
    //need better permission handling in future release

    let project = VSS.getWebContext().project.id;

    return getClient().hasPermissions('52d39943-cb85-4d7f-8fa8-c6baac873819', 8192, `$PROJECT:vstfs:///Classification/TeamProject/${project}`).then((result) => {
        return result.every((value) => value);
    });
}