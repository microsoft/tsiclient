import Utils from "../Utils";
import {ChartComponentData} from "./ChartComponentData";
import * as d3 from 'd3';

class GroupedBarChartData extends ChartComponentData {
    public timestamp;
    public valuesAtTimestamp;

    // allValues, aggsSeries, and allTimestampsArray span the entire time period of the aggregate expressions passed in
    public valuesOfVisibleType: Array<any> = [];
    public aggsSeries;

    public globalMax: number = -Number.MAX_VALUE;
    public globalMin: number = Number.MAX_VALUE;
    public stackedAggregateObject;

	constructor(){
        super();
    }

    public mergeDataToDisplayStateAndTimeArrays (data, timestamp, aggregateExpressionOptions = null) {
        super.mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressionOptions);
        this.timestamp = timestamp;
        this.setValuesAtTimestamp();
        this.setFilteredAggregates();
    }

    private stackMin = (series): number => {
        return Number(d3.min(series, function(d) { return d[0][0]; }));
      }
      
    private stackMax = (series): number => {
        return Number(d3.max(series, function(d) { return d[0][1]; }));
    }

    //setting the data related to the entire time range (aggsSeries, allValus, globalMax, globalMin)
    public setEntireRangeData (scaledToCurrentTime) {
        this.globalMax = -Number.MAX_VALUE;
        this.globalMin = Number.MAX_VALUE;
        this.aggsSeries = {};
        this.valuesOfVisibleType = [];
        Object.keys(this.displayState).forEach((aggKey, aggI) => {
            var splitByNames = [];
            var currentTimeSeries;

            this.allTimestampsArray.forEach((ts) => {
                if (this.displayState[aggKey].visible) {
                    var localSplitByNames = [];
                    var stackedAggregateObject = Object.keys(this.displayState[aggKey].splitBys).reverse().reduce((sAO, splitByName) => {
                        var splitBy = this.displayState[aggKey].splitBys[splitByName];
                        localSplitByNames.push(splitByName);
                        var value;
                        if (this.data[aggI][this.displayState[aggKey].name][splitByName][ts])
                            value = this.data[aggI][this.displayState[aggKey].name][splitByName][ts][splitBy.visibleType];
                        else
                            value = Number.MIN_VALUE;
                        if (!splitBy.visible){
                            if (value > 0)
                                value = Number.MIN_VALUE;
                            else
                                value = -Number.MIN_VALUE;
                        } 
                        sAO[splitByName] = value;

                        if ((!scaledToCurrentTime || ts == this.timestamp) && splitBy.visible){ 
                            this.valuesOfVisibleType.push(value);
                        }
                        return sAO;
                    }, {});

                    var series = d3.stack()
                        .keys(localSplitByNames)
                        .offset(d3.stackOffsetDiverging)
                        ([stackedAggregateObject]);
                    series.reverse();
                    if (ts == this.timestamp)
                        currentTimeSeries = series;

                    if ((ts == this.timestamp || !scaledToCurrentTime) && series != undefined) {
                        this.globalMax = Math.max(this.stackMax(series), this.globalMax);
                        this.globalMin = Math.min(this.stackMin(series), this.globalMin);
                    }
                }
            });
            this.aggsSeries[aggKey] = currentTimeSeries;
        });
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
                return aggSplitBys;
            }, {});
        });
    }

    public getValueContainerData (aggKey): Array<any> {
        return Object.keys(this.displayState[aggKey].splitBys).map((splitBy) => {
            var measureType = this.displayState[aggKey].splitBys[splitBy].visibleType;
            var val;
            if (this.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements  && 
                this.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements[measureType])
                val = this.valuesAtTimestamp[aggKey].splitBys[splitBy].measurements[measureType];
            else 
                val = null;
            return {
                measureType: measureType,
                aggKey: aggKey,
                splitBy: splitBy,
                val: val
            }
        })
    }
}
export {GroupedBarChartData}
