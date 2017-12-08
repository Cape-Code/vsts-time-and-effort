export class BulletGraph {
    private max: number;
    private width: number;

    constructor(public container: JQuery<HTMLElement>, public title: string, public subtitle: string, public limit: number, public value: number, public value2: number, public containerWidth: number, emptyContainer = true, public height = 36, public marginLeft = 60, public marginTop = 8, public marginRight = 32, public marginBottom = 16) {
        if (!limit) {
            limit = 0;
        }

        if (!value) {
            value = 0;
        }

        if (!value2) {
            value2 = 0;
        }

        let lim80 = limit * 80 / 100;
        let lim120 = limit * 120 / 100;

        this.max = Math.max(lim120, value, value2);
        this.width = containerWidth - marginLeft - marginRight;

        let svg = this._makeSVGEl('svg', { class: 'bullet', width: this.width + marginLeft + marginRight, height: height + marginTop + marginBottom });
        let g = this._makeSVGEl('g', { transform: `translate(${marginLeft},${marginTop})` });
        svg.appendChild(g);

        let wrap = this._makeSVGEl('g', { class: 'wrap' });
        g.appendChild(wrap);

        this._renderRange(wrap, lim120, 0, height);
        this._renderRange(wrap, limit, 1, height);
        this._renderRange(wrap, lim80, 2, height);

        wrap.appendChild(this._makeSVGEl('rect', { class: 'measure s1', width: this._scale(value2), height: height * 5 / 9, x: 0, y: height * 2 / 9 }));
        wrap.appendChild(this._makeSVGEl('rect', { class: 'measure s0', width: this._scale(value), height: height * 5 / 9, x: 0, y: height * 2 / 9 }));
        wrap.appendChild(this._makeSVGEl('line', { class: 'marker', x1: this._scale(limit), x2: this._scale(limit), y1: height / 6, y2: height * 5 / 6 }));

        let measureLabel = this._makeSVGEl('text', { class: 'measure-label' });
        let measureLabelText = this._makeSVGEl('tspan', { dy: '.3em', x: 10, y: height / 2 });
        measureLabelText.textContent = `${value.toString()}${value2 > 0 ? ' \u2015 ' + value2.toString() : ''}`;
        measureLabel.appendChild(measureLabelText);
        g.appendChild(measureLabel);

        let suppressLabelRange = limit * 160 / 100;
        let suppressLabel = value > suppressLabelRange || value2 > suppressLabelRange;

        this._renderTick(g, 0, height);
        this._renderTick(g, lim80, height, suppressLabel);
        this._renderTick(g, limit, height);
        this._renderTick(g, lim120, height, suppressLabel);

        g.appendChild(this._makeSVGEl('g', { class: 'axis' }));

        let titleG = this._makeSVGEl('g', { transform: `translate(-6, ${(height / 2) + 1})`, style: 'text-anchor: end;' });

        let titleText = this._makeSVGEl('text', { class: 'title' });
        titleText.textContent = title;
        titleG.appendChild(titleText);

        let subtitleText = this._makeSVGEl('text', { class: 'subtitle', dy: '1em' });
        subtitleText.textContent = subtitle;
        titleG.appendChild(subtitleText);

        g.appendChild(titleG);

        if (emptyContainer)
            container.empty();
        container.append(svg);
    }

    private _renderRange(container: SVGAElement, value: number, idx: number, height: number) {
        container.appendChild(this._makeSVGEl('rect', { class: `range s${idx}`, width: this._scale(value), height: height, x: 0 }));
    }

    private _renderTick(container: SVGAElement, value: number, height: number, suppressLabel = false) {
        let g = this._makeSVGEl('g', { class: 'tick', transform: `translate(${this._scale(value)}, 0)`, style: 'opacity: 1;' });
        g.appendChild(this._makeSVGEl('line', { y1: height, y2: height * 7 / 6 }));
        if (!suppressLabel) {
            let text = this._makeSVGEl('text', { dy: '1em', y: height * 7 / 6 });
            text.setAttribute('text-anchor', 'middle');
            text.textContent = value.toFixed(0).toString();
            g.appendChild(text);
        }
        container.appendChild(g);
    }

    private _scale(value: number): number {
        let spot = value / this.max;
        return this.width * spot;
    }

    private _makeSVGEl(tag, attrs) {
        let el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (var k in attrs) {
            el.setAttribute(k, attrs[k]);
        }
        return el;
    }
}