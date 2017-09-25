import { show, ModalDialog, IModalDialogOptions } from 'VSS/Controls/Dialogs';
import { IComboOptions, Combo } from 'VSS/Controls/Combos';
import { parseDate, format } from '../Data/Date';
import { Enhancement, create } from 'VSS/Controls';
import { ComboTreeBehaviorName } from 'VSS/Controls/TreeView';

export function showModalDialog<T, U, V>(container: JQuery, dialogTitle: string, okText: string, okFn: (value: T) => void, createDialogUIFn: (container: JQuery, self: U, type: V, entry: T) => IPromise<JQuery>, validateFn: (dialogElement: JQuery, type: V) => boolean, valueFn: (dialogElment: JQuery, self: U, type: V, entry: T) => T, type: V, self: U, entry?: T): void {
    createDialogUIFn(container, self, type, entry).then((content) => {
        let dialogOptions = _createModalDialogOptions<T>(okText, okFn, dialogTitle, content);
        let dialog = show(ModalDialog, dialogOptions);
        let dialogElement = dialog.getElement();

        let onBlur = () => {
            if (validateFn(dialogElement, type)) {
                dialog.setDialogResult(valueFn(dialogElement, self, type, entry));
                dialog.updateOkButton(true);
            } else {
                dialog.updateOkButton(false);
            }
        }

        dialogElement.on('blur', <JQuery.Selector>'input, textarea', (e: any) => {
            onBlur();
        });

        if (entry) {
            onBlur();
        }
    });
}

function _createModalDialogOptions<T>(okText: string, okFn: (value: T) => void, title: string, content: JQuery): IModalDialogOptions {
    let dialogOptions: IModalDialogOptions = {
        okText: okText,
        okCallback: okFn,
        useBowtieStyle: true,
        resizable: true,
        title: title,
        content: content
    };

    return dialogOptions;
}

export function createModalDialogUI(container: JQuery): JQuery {
    let dialog = $(`<div class="dialog-content"></div>`);
    container.append(dialog);
    return dialog;
}

export function addTextbox(container: JQuery, title: string, id: string, isRequired: boolean, initialValue: string, isDisabled: boolean): JQuery {
    let p = _addTitle(container, title);
    let textBox = $(`<input id="${id}" type="text" ${isRequired ? 'required="required" ' : ''}${isDisabled ? 'disabled="disabled" ' : ''}/>`);

    if (initialValue) {
        textBox.val(initialValue);
    }

    p.append(textBox);
    return container;
}

export function addToggle(container: JQuery, title: string, id: string, initialValue: boolean, isDisabled: boolean): JQuery {
    let p = _addTitle(container, title);
    let toggle = $(`<input id="${id}" type="checkbox" ${isDisabled ? 'disabled="disabled" ' : ''}${initialValue ? 'checked="checked" ' : ''}/>`);

    toggle.click(function () {
        let val = $(this).is(':checked');
        $(this).attr('checked', val ? 'checked' : null);
        $(this).blur();
    });

    p.append(toggle);
    return container;
}

export function addNumber(container: JQuery, title: string, id: string, min: number, max: number, step: number, isRequired: boolean, initialValue: number, isDisabled: boolean): JQuery {
    let p = _addTitle(container, title);
    let numberInput = $(`<input id="${id}" type="number" min="${min}" max="${max}" step="${step}" ${isRequired ? 'required="required" ' : ''}${isDisabled ? 'disabled="disabled" ' : ''}class="input-text-box" />`);

    if (initialValue) {
        numberInput.val(initialValue);
    }

    p.append(numberInput);
    return container;
}

export function addComboBox<T>(container: JQuery, title: string, id: string, isRequired: boolean, initialValue: T, isDisabled: boolean, data: T[], selector: (t: T) => string): JQuery {
    let p = _addTitle(container, title);

    if (initialValue === undefined && data.length === 1)
        initialValue = data[0];

    let options: IComboOptions = {
        id: id,
        allowEdit: false,
        enabled: !isDisabled,
        mode: 'drop',
        source: data.map((v) => selector(v)),
        value: initialValue ? selector(initialValue) : undefined,
        disableTextSelectOnFocus: true
    };

    create(Combo, p, options);

    return container;
}

export function addTreePicker(container: JQuery, title: string, id: string, isRequired: boolean, isDisabled: boolean, data: any): JQuery {
    let p = _addTitle(container, title);

    let options: IComboOptions = {
        id: id,
        allowEdit: false,
        enabled: !isDisabled,
        mode: 'drop',
        type: ComboTreeBehaviorName,
        source: data,
        disableTextSelectOnFocus: true
    }

    create(Combo, p, options);

    return container;
}

export function addDatePicker(container: JQuery, title: string, id: string, isRequired: boolean, initialValue: Date | string, isDisabled: boolean): JQuery {
    let p = _addTitle(container, title);
    let datePicker = $(`<input id="${id}" type="text" ${isRequired ? 'required="required" ' : ''}${isDisabled ? 'disabled="disabled" ' : ''}/>`);
    p.append(datePicker);

    if (initialValue) {
        if (typeof initialValue === "string") {
            initialValue = parseDate(<string>initialValue);
        }

        datePicker.val(format(<Date>initialValue));
    }

    <Combo>Enhancement.enhance(Combo, datePicker, {
        type: "date-time"
    });

    return container;
}

export function addTextArea(container: JQuery, title: string, id: string, isRequired: boolean, initialValue: string, isDisabled: boolean): JQuery {
    let p = _addTitle(container, title);
    let textArea = $(`<textarea id="${id}" ${isRequired ? 'required="required" ' : ''}${isDisabled ? 'disabled="disabled" ' : ''}/>`);

    if (initialValue) {
        textArea.val(initialValue);
    }

    p.append(textArea);
    return container;
}

function _addTitle(container: JQuery, title: string): JQuery {
    let titleElem = $(`<p><label>${title}:</label></p>`);
    container.append(titleElem);
    return titleElem;
}