import {Utils} from "../Utils";
import { color } from "d3";

// Represents an expression that is suitable for use as the expression options parameter in a chart component
abstract class ChartDataOptions {

    public searchSpan: any;  // from,to,bucketSize as TSX
    public color: string;
    public alias: string;
    public contextMenu: any; // describes menu shown with a split by member on context menu, and actions
    public measureTypes: Array<string>;  // 
    public interpolationFunction: string = '';
    public yExtent: any = null;
    public includeEnvelope: boolean = false;
    public visibilityState: Array<any> = null;

    constructor (searchSpan: any, measureTypes: Array<any>, colorOrOptionsObject: any, alias: string, contextMenu: Array<any>){
        this.searchSpan = searchSpan;
        this.measureTypes = measureTypes;
        if(typeof(colorOrOptionsObject) === 'object' && !!colorOrOptionsObject){
            this.color = Utils.getValueOrDefault(colorOrOptionsObject, 'color');
            this.alias = Utils.getValueOrDefault(colorOrOptionsObject, 'alias');
            this.contextMenu = Utils.getValueOrDefault(colorOrOptionsObject, 'contextMenu', []);
            this.interpolationFunction = Utils.getValueOrDefault(colorOrOptionsObject, 'interpolationFunction', '');
            this.includeEnvelope = Utils.getValueOrDefault(colorOrOptionsObject, 'includeEnvelope', false);
            this.visibilityState = Utils.getValueOrDefault(colorOrOptionsObject, 'visibilityState');
            this.yExtent = Utils.getValueOrDefault(colorOrOptionsObject, 'yExtent');
        }
        else{
            this.color = colorOrOptionsObject;
            this.alias = alias;
            this.contextMenu = contextMenu;
        }
    }
}
export {ChartDataOptions}
