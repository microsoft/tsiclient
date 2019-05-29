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
        Object.keys(this.valuesAtTimestamp).forEach((aggKey) => {
            Object.keys(this.valuesAtTimestamp[aggKey].splitBys).forEach((splitBy, splitByI) => {
                let measures = null;
                if (this.getSplitByVisible(aggKey, splitBy) && this.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements != undefined)
                    measures = this.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements;
                dataArray.push({
                    aggregateKey: aggKey,
                    splitBy: splitBy,
                    measures,
                    splitByI: splitByI
                });
            });
        });
        this.temporalDataArray = dataArray;
    }
}
export {ScatterPlotData}
