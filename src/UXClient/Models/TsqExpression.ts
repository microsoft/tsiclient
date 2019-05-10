import {Utils} from "./../Utils";
import { ChartDataOptions } from "./ChartDataOptions";

class TsqExpression extends ChartDataOptions {
    private instanceObject: any;
    private variableObject: any;

    constructor(instanceObject: any, variableObject: any, searchSpan: any, 
                colorOrOptionsObject: any, alias: string, contextMenu: Array<any>){
        super((typeof(colorOrOptionsObject) === 'object' && !!colorOrOptionsObject) ? {...colorOrOptionsObject, searchSpan: searchSpan, measureTypes: Object.keys(variableObject)} : {color: colorOrOptionsObject, searchSpan: searchSpan, measureTypes: Object.keys(variableObject), alias: alias, contextMenu: contextMenu });
        this.instanceObject = instanceObject;
        this.variableObject = variableObject;
    }

    public toTsq(roundFromTo: boolean = false, getEvents: boolean = false){
        var tsq = {};
        let shiftMillis = Utils.parseShift(this.temporalShift);
        let fromMillis = this.searchSpan.from.valueOf() + shiftMillis;
        let toMillis = this.searchSpan.to.valueOf() + shiftMillis;
        let bucketSizeInMillis = Utils.parseTimeInput(this.searchSpan.bucketSize);
        let roundedFromMillis = Math.floor((fromMillis + 62135596800000) / (bucketSizeInMillis)) * (bucketSizeInMillis) - 62135596800000; 
        let roundedToMillis = Math.ceil((toMillis + 62135596800000) / (bucketSizeInMillis)) * (bucketSizeInMillis) - 62135596800000;
        if (roundFromTo) {
            fromMillis = roundedFromMillis;
            toMillis = roundedToMillis;
        }
        tsq['searchSpan'] = {from: (new Date(fromMillis)).toISOString(), to: (new Date(toMillis)).toISOString()}; 
        tsq['timeSeriesId'] = this.instanceObject.timeSeriesId;
        if (getEvents) {
            return {getEvents: tsq};
        }
        else {
            tsq['interval'] = Utils.bucketSizeToTsqInterval(this.searchSpan.bucketSize);
            tsq['inlineVariables'] = this.variableObject;
            tsq['projectedVariables'] = Object.keys(this.variableObject);
            return {aggregateSeries: tsq};
        }
    }
}
export {TsqExpression}
