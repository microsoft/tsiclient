import {Utils} from "./../Utils";
import { TimeSeriesEventCell } from "./TimeSeriesEventCell";

class TimeSeriesEvent {
    public cells = {};

	constructor(rawEvent){
        this.cells = Object.keys(rawEvent).reduce((cellObj, propId) => {
            var cell: TimeSeriesEventCell;
            if (propId == "timestamp")
                cell = new TimeSeriesEventCell('timestamp', rawEvent[propId], 'DateTime');
            else {
                cell = new TimeSeriesEventCell(rawEvent[propId]['name'], rawEvent[propId]['value'], rawEvent[propId]['type']);
            }
            cellObj[cell.key] = cell;
            return cellObj;
        }, {});
    }
}
export {TimeSeriesEvent}