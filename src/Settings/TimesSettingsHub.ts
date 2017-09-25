import { TimesSettingsBudgetGrid } from './TimesSettingsBudgetGrid';
import { TimesSettingsCustomerGrid } from './TimesSettingsCustomerGrid';
import { TimesSettingsRoleGrid } from './TimesSettingsRoleGrid';
import { hasAccess } from "../Auth/AuthHelper";
import { createNotification } from "../UIHelper/NotificationHelper";

export class TimesSettingsHub {
    public init(): void {
        hasAccess().then((res) => {
            if (res) {
                new TimesSettingsBudgetGrid();
                new TimesSettingsRoleGrid();
                new TimesSettingsCustomerGrid();
            } else {
                let container = $('.taePage');
                container.empty();
                container.removeClass('taePage');
                createNotification(container).setError($("<span />").html('You are not authorized to view this page!'));
            }
        });
    }
}