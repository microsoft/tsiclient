import Utils from "../Utils";
import { TimeSeriesEventCell } from "./TimeSeriesEventCell";

class TimeSeriesEvent {
    public cells = {};

	constructor(rawEvent, offset = null, offsetName: string = null, locale: string = 'en'){

        if (offset !== null) {
            let type = 'DateTime';
            let utcOffsetDate = Utils.offsetUTC(new Date(Date.parse(rawEvent['timestamp ($ts)'].split("Z").join(""))));
            rawEvent[offsetName + "_" + type] = {
                name: offsetName,
                value: () => Utils.timeFormat(true, true, offset, true, null, null, locale)(utcOffsetDate),
                type: type
            };
        } 
        this.cells = Object.keys(rawEvent).reduce((cellObj, propId) => {
            var cell: TimeSeriesEventCell;
            if (propId == "timestamp ($ts)")
                cell = new TimeSeriesEventCell('timestamp ($ts)', rawEvent[propId], 'DateTime');
            else {
                cell = new TimeSeriesEventCell(rawEvent[propId]['name'], rawEvent[propId]['value'], rawEvent[propId]['type']);
            }
            cellObj[cell.key] = cell;
            return cellObj;
        }, {});
    }
}
export {TimeSeriesEvent}