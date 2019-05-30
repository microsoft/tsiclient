import {Utils} from "./../Utils";
import {ChartComponentData} from "./ChartComponentData";
import { GroupedBarChartData } from "./GroupedBarChartData";
import * as d3 from "d3";

class ScatterPlotData extends GroupedBarChartData {
    public temporalDataArray: any;
    public extents: any = {};
    private extentsSet: boolean = false

	constructor(){
        super();
    }

    public setExtents(measures: any, forceReset: boolean = false){
        if(!this.extentsSet || forceReset){
            // Set axis extents
            measures.forEach(measure => {
                this.extents[measure] = d3.extent(this.allValues, (v:any) => {
                    if(!v.measures)
                        return null
                    return measure in v.measures ? v.measures[measure] : null}
                );
            });
            this.extentsSet = true;
        } 
    }

    public mergeDataToDisplayStateAndTimeArrays (data, timestamp, aggregateExpressionOptions = null, events = null, states = null ) {
        ChartComponentData.prototype.mergeDataToDisplayStateAndTimeArrays.call(this, data, aggregateExpressionOptions, events, states);
        this.timestamp = (timestamp != undefined && this.allTimestampsArray.indexOf(timestamp) !== -1) ? timestamp : this.allTimestampsArray[0];
        super.setValuesAtTimestamp();
        this.setAllTimestampsArray();
    }

    public updateTemporalDataArray () {
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
