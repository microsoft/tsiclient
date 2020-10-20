import {ChartComponentData} from "./ChartComponentData";
import { GroupedBarChartData } from "./GroupedBarChartData";
import * as d3 from "d3";
import Utils from "../Utils";

class ScatterPlotData extends GroupedBarChartData {
    public temporalDataArray: any;
    public extents: any = {};
    private extentsSet: boolean = false;

	constructor(){
        super();
    }

    /******** SETS EXTENT OF EACH DATA MEASURE -- MEASURES UPDATED WHEN RENDER CALLED OUTSIDE OF TEMPORAL ********/
    public setExtents(measures: any, forceReset: boolean = false){
        if(!this.extentsSet || forceReset){
            // Reset extents
            this.extents = {};
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

    /******** UPDATE EXTENTS BASED ON VISIBLE DATA ********/
    public updateExtents(measures: any){
        let visibleData: Array<any> = []

        this.data.forEach((aggregate) => {
            let aggName: string = Object.keys(aggregate)[0];
            let aggKey = aggregate.aggKey;

            if(this.displayState[aggKey].visible == true){
                Object.keys(aggregate[aggName]).forEach((splitBy) => {
                    if(this.displayState[aggKey].splitBys[splitBy].visible == true){
                        visibleData.push(Object.values(aggregate[aggName][splitBy]));
                    }
                })
            }
        })

        visibleData = [].concat.apply([], visibleData);

        measures.forEach(measure => {
            this.extents[measure] = d3.extent(visibleData, (v:any) => {
                return measure in v ? v[measure] : null}
            );
        });
    }

    /******** UPDATES CHART DATA, ALL TIMESTAMPS, AND VALUES AT THE CURRENT TIMESTAMP ********/
    public mergeDataToDisplayStateAndTimeArrays (data, timestamp, aggregateExpressionOptions = null) {
        ChartComponentData.prototype.mergeDataToDisplayStateAndTimeArrays.call(this, data, aggregateExpressionOptions);
        this.timestamp = (timestamp != undefined && this.allTimestampsArray.indexOf(timestamp) !== -1) ? timestamp : this.allTimestampsArray[0];
        this.setValuesAtTimestamp();
        this.setAllTimestampsArray();
    }

    /******** UPDATES DATA TO BE DRAWN -- IF SCATTER IS TEMPORAL, FLATTENS ALL TIMESTAMP DATA ********/
    public updateTemporalDataArray (isTemporal: boolean) {
        this.temporalDataArray = []

        if(!isTemporal){
            this.allTimestampsArray.forEach((ts) => {
                this.timestamp = ts;
                this.setValuesAtTimestamp();
                this.updateTemporal();
            });
        } else{
            this.updateTemporal();
        }
    }

    /******** HELPER TO FETCH DATA AT THE CURRENT TIMESTAMP AND BUILD AN OBJECT FOR THAT TIMESTAMP ********/
    private updateTemporal(){
        Object.keys(this.valuesAtTimestamp).forEach((aggKey) => {
            Object.keys(this.valuesAtTimestamp[aggKey].splitBys).forEach((splitBy, splitByI) => {
                let measures = null, timestamp = null;
                if (this.getSplitByVisible(aggKey, splitBy) && this.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements != undefined){
                    measures = this.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements; 
                    timestamp = this.valuesAtTimestamp[aggKey].splitBys[splitBy].timestamp; 
                }   
                    
                this.temporalDataArray.push({
                    aggregateKey: aggKey,
                    aggregateKeyI: this.data.findIndex((datum) => datum.aggKey === aggKey),
                    splitBy: splitBy,
                    measures,
                    timestamp,
                    splitByI: splitByI
                });
            });
        });
    }

    /******** OVERRIDES GROUPEDBARCHARTDATA -- UPDATES VALUES AT TIMESTAMP WITH MEASURES & TIMESTAMP********/
    public setValuesAtTimestamp () {
        let aggregateCounterMap = {};
        this.valuesAtTimestamp = {};
        this.data.forEach((aggregate, aggI) => {
            let aggName: string = Object.keys(aggregate)[0];
            let aggKey;
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
