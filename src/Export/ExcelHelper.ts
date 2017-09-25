declare function saveAs(p1: any, p2: any);
declare var XLSX: any;

export class ExcelExporter {
    public Workbook: Workbook;

    constructor(public fileName: string) {
        this.Workbook = new Workbook();
    }

    public addSheet<T>(name: string, data: T[], columns: [{ (t: T): number | string | Date | boolean; }, IExcelColumnFormatOptions][]) {
        let sheet = {};
        let range = { s: { c: 0, r: 0 }, e: { c: columns.length - 1, r: data.length } };

        columns.forEach((f, i) => {
            sheet[XLSX.utils.encode_cell({ c: i, r: 0 })] = { v: f[1].title, t: 's' };
        });

        data.forEach((d, i) => {
            columns.forEach((c, j) => {
                let value = c[0](d);
                let cellType = '';
                let isDate = false;

                if (typeof value === 'number') {
                    cellType = 'n';
                } else if (typeof value === 'boolean') {
                    cellType = 'b';
                } else if (value instanceof Date) {
                    cellType = 'n';
                    value = this._convertToExcelDate(<Date>value);
                    isDate = true;
                } else {
                    cellType = 's';
                }
                let cell = { v: value, t: cellType, z: isDate ? XLSX.SSF._table[14] : undefined };
                sheet[XLSX.utils.encode_cell({ c: j, r: i + 1 })] = cell;
            });
        });

        sheet['!ref'] = XLSX.utils.encode_range(range);

        this.Workbook.SheetNames.push(name);
        this.Workbook.Sheets[name] = sheet;
    }

    _s2ab(s: string) {
        let buf = new ArrayBuffer(s.length);
        let view = new Uint8Array(buf);
        for (let i = 0; i != s.length; ++i) {
            view[i] = s.charCodeAt(i) & 0xFF;
        }
        return buf;
    }

    _convertToExcelDate(v: Date) {
        return (v.valueOf() - (new Date(Date.UTC(1899, 11, 30)).valueOf())) / (24 * 60 * 60 * 1000);
    }

    public writeFile() {
        let wbout = XLSX.write(this.Workbook, { bookType: 'xlsx', bookSST: false, type: 'binary' });
        saveAs(new Blob([this._s2ab(wbout)], { type: 'application/octet-stream' }), this.fileName);
    }
}

class Workbook {
    public SheetNames: string[];
    public Sheets: any;

    constructor() {
        this.SheetNames = [];
        this.Sheets = {};
    }
}

export interface IExcelColumnFormatOptions {
    title: string;
}