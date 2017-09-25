import { MessageAreaControl, IMessageAreaControlOptions } from 'VSS/Controls/Notifications';
import { BaseControl } from 'VSS/Controls';

export function createNotification(container: JQuery): MessageAreaControl {
    let messageControlOptions: IMessageAreaControlOptions = {
        closeable: true
    };

    return <MessageAreaControl>BaseControl.createIn(MessageAreaControl, container, messageControlOptions);
}