import {Utils} from "./../Utils";
import {ChartComponentData} from "./ChartComponentData";
import {TimeSeriesEvent} from "./TimeSeriesEvent";
import * as d3 from 'd3';
import { TimeSeriesEventCell } from "./TimeSeriesEventCell";

class EventsTableData {
    public columns = {};
    public rows = [];
    public events: Array<TimeSeriesEvent> = [];

	constructor(){
        
    }

    public mergeEvents (rawEvents, fromTsx) {
        rawEvents.forEach((rawEvent) => {
            if (!fromTsx) {
                rawEvent = Object.keys(rawEvent).reduce((newEventMap, currColName) => {
                    newEventMap[currColName] = {
                        name: currColName, 
                        value: rawEvent[currColName]
                    };
                    return newEventMap;
                }, {});
            }
            var event = new TimeSeriesEvent(rawEvent);
            this.events.push(event);
        });
        this.constructColumns();
    }

    public sortEvents (columnKey, isAscending) {
        var sortType = this.columns[columnKey].type;
        var aTop = 1;
        var bTop = -1;
        if (!isAscending) {
            aTop = -1;
            bTop = 1;
        }
        this.events.sort((a: TimeSeriesEvent, b: TimeSeriesEvent) => {
            if ((a.cells && a.cells[columnKey]) || (b.cells && b.cells[columnKey])) {
                var aConverted = (a.cells && a.cells[columnKey]) ? a.cells[columnKey].value : null;
                var bConverted = (b.cells && b.cells[columnKey]) ? b.cells[columnKey].value : null;
                
                //one value is null
                if (aConverted == null)
                    return bTop;
                if (bConverted == null)
                    return aTop;

                //convert to appropriate type
                if (sortType == "Double"){
                    aConverted = Number(aConverted);
                    bConverted = Number(bConverted);
                }
                else if (sortType == "DateTime") {
                    aConverted = (new Date(aConverted)).valueOf();
                    bConverted = (new Date(bConverted)).valueOf();
                }

                //compare
                if (aConverted > bConverted)
                    return aTop;
                if (aConverted < bConverted)
                    return bTop;
                return 0;
            }
            return 0;
        });
    }

    public constructColumns () {
        this.events.forEach((event: TimeSeriesEvent) => {
            Object.keys(event.cells).forEach((cellKey: string) => {
                var cell = event.cells[cellKey];
                if (this.columns[cell.key] == null) {
                    this.columns[cell.key] = { 
                        key:  cell.key,
                        name: cell.name,
                        visible: true,
                        type: cell.type
                    }
                }
            })
        });
    }

}
export {EventsTableData}
