import {Utils} from "./../Utils";
import {ChartComponentData} from "./ChartComponentData";
import * as d3 from 'd3';

class HeatmapData {
    public chartComponentData: ChartComponentData;
    public visibleSBs: Array<any> = [];
    public timeStamps: Array<Date> = [];
    public colorScale: any;
    public from: Date;
    public to: Date;
    public bucketSize: number;
    public timeValues: any;
    public aggKey: string;
    public numRows: number = 0;
    public numCols: number = 0;
    public allValues: Array<any>;


	constructor(chartComponentData: ChartComponentData, aggKey: string){
        this.aggKey = aggKey;
        this.chartComponentData = chartComponentData;
        this.visibleSBs = Object.keys(this.chartComponentData.displayState[aggKey].splitBys).filter((sb) => {
            return (this.chartComponentData.getSplitByVisible(aggKey, sb));
        });
        this.numRows = this.visibleSBs.length;
        this.from = new Date(chartComponentData.displayState[aggKey].aggregateExpression.searchSpan.from);
        this.to =  new Date(chartComponentData.displayState[aggKey].aggregateExpression.searchSpan.to);
        this.bucketSize = Utils.parseTimeInput(chartComponentData.displayState[aggKey].aggregateExpression.searchSpan.bucketSize);
        this.createTimeValues();
    }

    private createTimeValues () {
        this.timeValues = {};
        this.allValues = [];
        //turn time array into an object keyed by timestamp 
        for (var currTime = this.from; (currTime.valueOf() < this.to.valueOf()); 
             currTime = new Date(currTime.valueOf() + this.bucketSize)) {
            this.timeValues[currTime.toString()] = this.visibleSBs.reduce((obj, splitBy) => {
                obj[splitBy] = null;
                return obj;
            }, {});
        }
        this.numCols = Object.keys(this.timeValues).length;

        this.visibleSBs.forEach((splitBy, rowI) => {
            this.chartComponentData.timeArrays[this.aggKey][splitBy].forEach((valueObject, colI) => {
                var timestamp = valueObject.dateTime.toString();
                var visibleMeasure = this.chartComponentData.getVisibleMeasure(this.aggKey, splitBy);
                if (this.timeValues[timestamp]) {                    
                    this.timeValues[timestamp][splitBy] = {
                        value: valueObject.measures[visibleMeasure],
                        rowI: rowI,
                        colI: colI
                    }
                    this.allValues.push(valueObject.measures[visibleMeasure]);
                }
            });
        });
    }
}
export {HeatmapData}
