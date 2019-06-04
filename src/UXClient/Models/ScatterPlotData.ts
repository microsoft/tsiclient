import {ChartComponentData} from "./ChartComponentData";
import { GroupedBarChartData } from "./GroupedBarChartData";
import * as d3 from "d3";
import { Utils } from "../Utils";

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
        this.setValuesAtTimestamp();
        this.setAllTimestampsArray();
    }

    public updateTemporalDataArray (isTemporal: boolean) {
        if(!isTemporal){
            let dataArray = []
            this.allTimestampsArray.forEach((ts) => {
                this.timestamp = ts;
                this.setValuesAtTimestamp();
                Object.keys(this.valuesAtTimestamp).forEach((aggKey) => {
                    Object.keys(this.valuesAtTimestamp[aggKey].splitBys).forEach((splitBy, splitByI) => {
                        let measures = null, timestamp = null;
                        if (this.getSplitByVisible(aggKey, splitBy) && this.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements != undefined){
                            measures = this.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements; 
                            timestamp = this.valuesAtTimestamp[aggKey].splitBys[splitBy].timestamp; 
                        }   
                            
                        dataArray.push({
                            aggregateKey: aggKey,
                            splitBy: splitBy,
                            measures,
                            timestamp,
                            splitByI: splitByI
                        });
                    });
                });
            });
            
            this.temporalDataArray = dataArray;
        } else{
            let dataArray = []
            Object.keys(this.valuesAtTimestamp).forEach((aggKey) => {
                Object.keys(this.valuesAtTimestamp[aggKey].splitBys).forEach((splitBy, splitByI) => {
                    let measures = null, timestamp = null;
                    if (this.getSplitByVisible(aggKey, splitBy) && this.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements != undefined){
                        measures = this.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements; 
                        timestamp = this.valuesAtTimestamp[aggKey].splitBys[splitBy].timestamp; 
                    }   
                        
                    dataArray.push({
                        aggregateKey: aggKey,
                        splitBy: splitBy,
                        measures,
                        timestamp,
                        splitByI: splitByI
                    });
                });
            });
            this.temporalDataArray = dataArray;
        }
    }

    public setValuesAtTimestamp () {
        var aggregateCounterMap = {};
        this.valuesAtTimestamp = {};
        this.data.forEach((aggregate, aggI) => {
            var aggName: string = Object.keys(aggregate)[0];
            var aggKey;
            if (aggregateCounterMap[aggName]) {
                aggKey = Utils.createEntityKey(aggName, aggregateCounterMap[aggName]);
                aggregateCounterMap[aggName] += 1;
            } else {
                aggKey = Utils.createEntityKey(aggName, 0);
                aggregateCounterMap[aggName] = 1;
            }
            this.valuesAtTimestamp[aggKey] = {};
            this.valuesAtTimestamp[aggKey].splitBys = Object.keys(aggregate[aggName])
                                                .reduce((aggSplitBys: any, splitBy: string, splitByI: number) => {
                aggSplitBys[splitBy] = {};
                aggSplitBys[splitBy].measurements = aggregate[aggName][splitBy][this.timestamp];
                aggSplitBys[splitBy].timestamp = this.timestamp;
                return aggSplitBys;
            }, {});
        });
    }
}
export {ScatterPlotData}
