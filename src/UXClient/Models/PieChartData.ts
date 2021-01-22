import Utils from "../Utils";
import {ChartComponentData} from "./ChartComponentData";
import * as d3 from 'd3';
import { GroupedBarChartData } from "./GroupedBarChartData";

class PieChartData extends GroupedBarChartData {
    public timestamp;
    public flatValueArray;
    public visibleValuesSum = 0;

	constructor(){
        super();
    }

    public mergeDataToDisplayStateAndTimeArrays (data, timestamp, aggregateExpressionOptions = null) {
        ChartComponentData.prototype.mergeDataToDisplayStateAndTimeArrays.call(this, data, aggregateExpressionOptions);
        this.timestamp = Utils.getValueOrDefault({'':timestamp}, '', this.allTimestampsArray[0]);
        super.setValuesAtTimestamp();
        this.setAllTimestampsArray();
    }

    public updateFlatValueArray (timestamp) {
        this.visibleValuesSum = 0;
        var values = [];
        Object.keys(this.valuesAtTimestamp).forEach((aggKey) => {
            Object.keys(this.valuesAtTimestamp[aggKey].splitBys).forEach((splitBy, splitByI) => {
                var value = 0;
                if (this.getSplitByVisible(aggKey, splitBy) && this.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements != undefined)
                    value = this.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements[this.getVisibleMeasure(aggKey, splitBy)];
                values.push({
                    aggKey: aggKey,
                    splitBy: splitBy,
                    val: value,
                    splitByI: splitByI
                });
                this.visibleValuesSum += Math.abs(value);
            });
        });
        this.flatValueArray = values;
    }
}
export {PieChartData}
