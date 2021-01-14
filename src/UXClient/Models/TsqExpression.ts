import Utils from "../Utils";
import { ChartDataOptions } from "./ChartDataOptions";

class TsqExpression extends ChartDataOptions {
    private instanceObject: any;
    private variableObject: any;

    constructor(instanceObject: any, variableObject: any, searchSpan: any, 
                colorOrOptionsObject: any, alias?: string, contextMenu?: Array<any>){
        // This constructor should be called with the following parameters: 
        // new TsqExpression(instanceObject, variableObject, searchSpan, optionsObject)
        // where the optionsObject should contain properties for color, alias, and contextMenu.
        //
        // However, to maintain backwards compatibility with older code, the constructor still 
        // accepts the older set of parameters:
        // new TsqExpression(instanceObject, variableObject, searchSpan, color, alias, contextMenu)
        // Here we differentiate between both and call the parent class's constructor as appropriate.
        let optionsObject = (typeof(colorOrOptionsObject) === 'object' && !!colorOrOptionsObject) 
            ? { 
                ...colorOrOptionsObject, 
                searchSpan: searchSpan, 
                measureTypes: Object.keys(variableObject) 
            } 
            : { 
                color: colorOrOptionsObject, 
                searchSpan: searchSpan, 
                measureTypes: Object.keys(variableObject), 
                alias: alias, 
                contextMenu: contextMenu }; 
        
        super(optionsObject);
        this.instanceObject = instanceObject;
        this.variableObject = variableObject;
    }

    public toTsq(roundFromTo: boolean = false, getEvents: boolean = false, getSeries: boolean = false){
        var tsq = {};
        let shiftMillis = Utils.parseShift(this.timeShift, this.startAt, this.searchSpan);
        let fromMillis = this.searchSpan.from.valueOf() + shiftMillis;
        let toMillis = this.searchSpan.to.valueOf() + shiftMillis;
        if (roundFromTo) {
            let bucketSizeInMillis = Utils.parseTimeInput(this.searchSpan.bucketSize);
            let roundedFromMillis = Math.floor((fromMillis + 62135596800000) / (bucketSizeInMillis)) * (bucketSizeInMillis) - 62135596800000; 
            let roundedToMillis = Math.ceil((toMillis + 62135596800000) / (bucketSizeInMillis)) * (bucketSizeInMillis) - 62135596800000;
            fromMillis = roundedFromMillis;
            toMillis = roundedToMillis;
        }
        tsq['searchSpan'] = {from: (new Date(fromMillis)).toISOString(), to: (new Date(toMillis)).toISOString()}; 
        tsq['timeSeriesId'] = this.instanceObject.timeSeriesId;
        if (getEvents) {
            return {getEvents: tsq};
        } else if (getSeries) {
            tsq['inlineVariables'] = {...this.variableObject};
            tsq['projectedVariables'] = Object.keys(this.variableObject);
            return {getSeries: tsq};
        } else {
            tsq['interval'] = Utils.bucketSizeToTsqInterval(this.searchSpan.bucketSize);
            tsq['inlineVariables'] = {...this.variableObject};
            tsq['projectedVariables'] = Object.keys(this.variableObject);
            return {aggregateSeries: tsq};
        }
    }

    // This method will create an API query payload for the variable statistics of the first inline variable
    // of this object, for numeric dataTypes. Categorical types work as expected.
    public toStatsTsq(fromMillis, toMillis){
        let tsq = this.toTsq();
        let shiftMillis = Utils.parseShift(this.timeShift);
        fromMillis += shiftMillis;
        toMillis += shiftMillis;
        tsq.aggregateSeries['searchSpan'] = {from: (new Date(fromMillis)).toISOString(), to: (new Date(toMillis)).toISOString()}; 
        tsq.aggregateSeries['interval'] = 'P1000Y';
        if (this.dataType === 'numeric') {
            let inlineVariables = {min: {}, max: {}, avg: {}, stDev: {}};
            let firstVariable = tsq.aggregateSeries['inlineVariables'][Object.keys(tsq.aggregateSeries['inlineVariables'])[0]];
            Object.keys(inlineVariables).forEach(k => {
                inlineVariables[k] = JSON.parse(JSON.stringify(firstVariable));
                inlineVariables[k].aggregation.tsx = `${k}($value)`;
                delete inlineVariables[k]['interpolation'];
            });
            tsq.aggregateSeries['inlineVariables'] = inlineVariables;        
            tsq.aggregateSeries['projectedVariables'] = Object.keys(inlineVariables);
        }
        return tsq;
    }
}
export default TsqExpression
