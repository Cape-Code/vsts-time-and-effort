import { getClient } from 'VSS/Security/RestClient';

export function hasAccess(): IPromise<boolean> {
    //this should always return false, if you are not an admin
    //need better permission handling in future release
    return getClient().hasPermissions('93bafc04-9075-403a-9367-b7164eac6b5c', 8, 'X', true).then((result) => {
        return result.every((value) => value);
    });
}