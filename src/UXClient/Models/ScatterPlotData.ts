import {Utils} from "./../Utils";
import {ChartComponentData} from "./ChartComponentData";
import { GroupedBarChartData } from "./GroupedBarChartData";

class ScatterPlotData extends GroupedBarChartData {
    public timestamp: any;
    public temporalDataArray: any;

	constructor(){
        super();
    }

    public mergeDataToDisplayStateAndTimeArrays (data, timestamp, aggregateExpressionOptions = null, events = null, states = null ) {
        ChartComponentData.prototype.mergeDataToDisplayStateAndTimeArrays.call(this, data, aggregateExpressionOptions, events, states);
        this.timestamp = Utils.getValueOrDefault({'':timestamp}, '', this.allTimestampsArray[0]);
        super.setValuesAtTimestamp();
        this.setAllTimestampsArray();
    }

    public updateTemporalDataArray (timestamp: any) {
        let dataArray = []
        this.allValues.forEach(element => {
            let d1 = new Date(element.dateTime)
            let d2 = new Date(timestamp);
            if(d1.getTime() === d2.getTime())
                dataArray.push(element);
        });

        this.temporalDataArray = dataArray;
    }
}
export {ScatterPlotData}
