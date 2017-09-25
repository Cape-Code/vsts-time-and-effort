import { TimeTrackingBudget, TimeTrackingBudgetFactory } from './../Data/TimeTrackingBudget';
import { reassignBudgets } from "../WorkItemHelper/WorkItemHelper";

let provider = {
    getMenuItems: (context) => {
        return _getBudgets().then((budgets) => {
            let items: IContributedMenuItem[] = [];
            items.push(<IContributedMenuItem>{ id: '-1', text: 'None', action: _handleClick });
            items.push({ separator: true });
            items = items.concat(budgets.map((b) => _createMenuItem(b)));

            return [<IContributedMenuItem>{
                title: "Assign Budget",
                groupId: "modify",
                childItems: items
            }];
        });
    }
};

VSS.register(`${VSS.getExtensionContext().publisherId}.${VSS.getExtensionContext().extensionId}.tae-query-budget-context`, provider);

function _handleClick(actionContext: any): void {
    let workItemIds: number[] = [];

    if (actionContext.workItemId) {
        workItemIds.push(actionContext.workItemId);
    } else {
        workItemIds = actionContext.workItemIds;
    }

    let showNotice = workItemIds.length > 4;

    reassignBudgets(workItemIds, this.__budget).then(() => {
        if (showNotice)
            alert('Budget assigned');
    });
}

function _getBudgets(): IPromise<TimeTrackingBudget[]> {
    return TimeTrackingBudgetFactory.getBudgets().then((budgets) => {
        let res: TimeTrackingBudget[] = [];
        budgets.map.forEach((value, key) => {
            if (value.end > new Date()) {
                res.push(value);
            }
        });

        return res;
    });
}

function _createMenuItem(budget: TimeTrackingBudget) {
    return <IContributedMenuItem>{
        id: budget.id,
        text: budget.toString(),
        action: _handleClick,
        __budget: budget
    };
}
