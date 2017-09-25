import { WaitControl, IWaitControlOptions } from 'VSS/Controls/StatusIndicator';
import { create } from 'VSS/Controls';

export function createWaitControl(container: JQuery): WaitControl {
    let waitControlOptions: IWaitControlOptions = {
        target: container,
        message: 'Loading...'
    };

    return create(WaitControl, container, waitControlOptions);
}