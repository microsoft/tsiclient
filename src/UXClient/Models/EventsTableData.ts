import Utils from "../Utils";
import { valueTypes } from "./../Constants/Enums";
import {TimeSeriesEvent} from "./TimeSeriesEvent";

class EventsTableData {
    public columns = {};
    public rows = [];
    public events: Array<TimeSeriesEvent> = [];
    private timestampColumnKey= "timestamp ($ts)_DateTime"
    private offsetName = null;
    private maxVisibleToStart = 10;
    private offsetNameCache = {};
    private timeSeriesIdProperties: Array<{name: string, type: any}> = [];

	constructor(){
        
    }

    private createOffsetName (offset) {
        if(offset in this.offsetNameCache){
            return this.offsetNameCache[offset];
        }
        var offsetSubstring = "";
        if ((typeof offset) === 'string') {
            offsetSubstring = Utils.convertTimezoneToLabel(offset);
        } else {
            offsetSubstring = Utils.formatOffsetMinutes(offset);
        }
        let offsetName = "timestamp " + offsetSubstring;
        this.offsetNameCache[offset] = offsetName;
        return offsetName;
    }

    public sortColumnKeys () {
        let columnKeys = Object.keys(this.columns);
        let existingTsidColumnKeys = Object.values(this.columns).filter(c => c['isTsid']).map(c => c['key']); // detect existing time series id properties in column keys
        columnKeys = existingTsidColumnKeys.concat(columnKeys.filter(c => !existingTsidColumnKeys.includes(c))); // put these time series id properties to the beginning of the column key list
        let offsetKey = this.offsetName + "_DateTime";

        let lessTimestamps = columnKeys.filter((columnKey) => {
            return (columnKey !== this.timestampColumnKey && columnKey !== offsetKey);
        });
        let timestamps = [];
        if (columnKeys.indexOf(this.timestampColumnKey) !== -1) 
            timestamps.push(this.timestampColumnKey);
        if (columnKeys.indexOf(offsetKey) !== -1) 
            timestamps.push(offsetKey);

        return timestamps.concat(lessTimestamps);
    }

    public setEvents (rawEvents, fromTsx, timeSeriesIdProperties, offset = null) {
        this.timeSeriesIdProperties = timeSeriesIdProperties;
        this.events = [];
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
            if (offset !== null) {
                this.offsetName = this.createOffsetName(offset);
            }
            var event = new TimeSeriesEvent(rawEvent, offset, (offset !== null ? this.offsetName: null));
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
        var timeSeriesIdPropertyKeys = this.timeSeriesIdProperties.map(p => `${p.name}_${p.type}`);
        var newColumns = {};
        this.events.forEach((event: TimeSeriesEvent) => {
            Object.keys(event.cells).forEach((cellKey: string) => {
                var cell = event.cells[cellKey];
                if (this.columns[cell.key] == null) {
                    newColumns[cell.key] = { 
                        key: cell.key,
                        name: cell.name,
                        visible: true,
                        type: cell.type,
                        isTsid: timeSeriesIdPropertyKeys.includes(cell.key)
                    }
                } else {
                    newColumns[cell.key] = this.columns[cell.key];
                }
            })
        });
        var visibleColumnCounter = Object.values(newColumns).filter(c => c['isTsid']).length;
        Object.keys(newColumns).forEach(columnKey => {
            if (newColumns[columnKey].isTsid) {
                newColumns[columnKey].visible = true;
            } else {
                newColumns[columnKey].visible =  visibleColumnCounter < this.maxVisibleToStart;
                visibleColumnCounter++
            }
        });
        this.columns = newColumns;
    }

    public generateCSVString (includeAllColumns: boolean = true, offset: number = 0): string {
        //replace comma at end of line with end line character
        var endLine = (s: string): string => {
            return s.slice(0, s.length - 1) + "\n";
        }
        let columnKeys = this.sortColumnKeys();
        var csvString = endLine(columnKeys.reduce((headerString, columnKey) => {
            return headerString + Utils.sanitizeString(columnKey, valueTypes.String) + ",";
        }, ""));

        this.events.forEach((event: TimeSeriesEvent) => {
            csvString += endLine(columnKeys.reduce((lineString, columnKey) => {
                let value = (event.cells[columnKey] ? (typeof(event.cells[columnKey].value) === 'function' ? event.cells[columnKey].value() : event.cells[columnKey].value) : null);
                return lineString + ((event.cells[columnKey] != null && Utils.sanitizeString(value, event.cells[columnKey].type) !== null) ? 
                Utils.sanitizeString(value, event.cells[columnKey].type) : "") + ","
            }, ""));
        });
        return csvString;
    }

}
export {EventsTableData}
