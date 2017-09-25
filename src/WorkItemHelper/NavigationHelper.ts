import { WorkItemFormNavigationService } from 'TFS/WorkItemTracking/Services';

export function openWorkItem(id: number) {
    WorkItemFormNavigationService.getService().then((service) => {
        service.openWorkItem(id);
    })
}