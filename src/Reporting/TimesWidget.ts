import { getGlobalWorkItemTimes } from '../WorkItemHelper/WorkItemHelper';

export class TimesWidget {
    public init(WidgetHelpers: any): void {
        let extensionContext = VSS.getExtensionContext();
        VSS.register(`${extensionContext.publisherId}.${extensionContext.extensionId}.tae-times-widget`, () => {
            return {
                load: (widgetSettings) => {
                    this._render();
                    return WidgetHelpers.WidgetStatusHelper.Success();
                }
            }
        });
    }

    private _render(): void {
        let now = new Date();
        this._getTimes(now, 'current-month');
        this._getTimes(new Date(now.getFullYear(), now.getMonth() - 1), 'last-month');
    }

    private _getTimes(date: Date, selector: string): void {
        let start = new Date(date.getFullYear(), date.getMonth(), 1);
        let end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        getGlobalWorkItemTimes(start, end).then((values) => {
            let totalHours = values.reduce((p, c) => {
                return p + c.hours;
            }, 0);

            let realMonth = start.getMonth() + 1;
            let title = `${realMonth < 10 ? '0' : ''}${realMonth}/${start.getFullYear()}`;
            let element = $(`h2.${selector}`);
            element.attr('title', title);
            element.text(title);

            let counter = $(`.big-count.${selector}`);
            counter.attr('title', totalHours);
            counter.text(totalHours);
        });
    }
}