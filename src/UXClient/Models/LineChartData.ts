import Utils from "../Utils";
import {ChartComponentData} from "./ChartComponentData";

class LineChartData extends ChartComponentData {
    public timeMap: any = {};
    get yExtents(): Array<any>{
        return this._yExtents;
    };

    private _yExtents: Array<any> = [];
    
    public setYExtents(idx: number, value: [number, number]){
        this._yExtents[idx] = value;
    }

    public resetYExtents(){
        this._yExtents = [];
        for(let i = 0; i < this.data.length; i++){
            this._yExtents.push(null);
        }
    }

    public setTimeMap () {
        this.timeMap = this.allValues.reduce ((timeMap, currVal) => {
            var millis = currVal.dateTime.valueOf();
            if (currVal.bucketSize != undefined) {
                millis += (currVal.bucketSize / 2);
            }
            if (currVal.measures != null) {
                if (timeMap[millis] == undefined) {
                    timeMap[millis] = [currVal];
                } else {
                    timeMap[millis].push(currVal);
                }    
            }
            return timeMap;
        }, {});
    }

	constructor(){
        super();
    }

    public mergeDataToDisplayStateAndTimeArrays (data, aggregateExpressionOptions = null) {
        super.mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressionOptions);
    }
}
export {LineChartData}
