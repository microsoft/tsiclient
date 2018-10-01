import {Utils} from "./../Utils";
import { ChartableExpression } from "./ChartableExpression";

class TsqExpression extends ChartableExpression {
    private instanceObject: any;
    private variableObject: any;

    constructor(instanceObject: any, variableObject: any, searchSpan: any, 
                color: string = Utils.generateColors(1)[0], alias: string = 'Expression1', contextMenu: Array<any> = []){
        super(searchSpan, color, alias, contextMenu, Object.keys(variableObject));
        this.instanceObject = instanceObject;
        this.variableObject = variableObject;
    }

    public toTsq(roundFromTo: boolean = false){
        var tsq = {};
        let fromMillis = this.searchSpan.from.valueOf(), toMillis = this.searchSpan.to.valueOf();
        let bucketSizeInMillis = Utils.parseTimeInput(this.searchSpan.bucketSize);
        let roundedFromMillis = Math.floor((fromMillis + 62135596800000) / (bucketSizeInMillis)) * (bucketSizeInMillis) - 62135596800000; 
        let roundedToMillis = Math.ceil((toMillis + 62135596800000) / (bucketSizeInMillis)) * (bucketSizeInMillis) - 62135596800000;
        if (roundFromTo) {
            fromMillis = roundedFromMillis;
            toMillis = roundedToMillis;
        }
        tsq['searchSpan'] = {from: (new Date(fromMillis)).toISOString(), to: (new Date(toMillis)).toISOString()}; 
        tsq['interval'] = Utils.bucketSizeToTsqInterval(this.searchSpan.bucketSize);
        tsq['timeSeriesId'] = this.instanceObject.timeSeriesId;
        tsq['inlineVariables'] = this.variableObject;
        tsq['projectedVariables'] = Object.keys(this.variableObject);
        return {getSeries: tsq};
    }
}
export {TsqExpression}
