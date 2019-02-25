import {Utils} from "../Utils";

// Represents an expression that is suitable for use as the expression options parameter in a chart component
class ChartDataOptions {

    public searchSpan: any;  // from,to,bucketSize as TSX
    public color: string;
    public alias: string;
    public contextMenu: any; // describes menu shown with a split by member on context menu, and actions
    public measureTypes: Array<string>;  // 
    public interpolationFunction: string = '';
    public yExtent: any = null;
    public includeEnvelope: boolean = false;
    public visibilityState: Array<any> = null;

    constructor (optionsObject: Object){
            this.searchSpan = Utils.getValueOrDefault(optionsObject, 'searchSpan');
            this.measureTypes = Utils.getValueOrDefault(optionsObject, 'measureTypes');
            this.color = Utils.getValueOrDefault(optionsObject, 'color');
            this.alias = Utils.getValueOrDefault(optionsObject, 'alias');
            this.contextMenu = Utils.getValueOrDefault(optionsObject, 'contextMenu', []);
            this.interpolationFunction = Utils.getValueOrDefault(optionsObject, 'interpolationFunction', '');
            this.includeEnvelope = Utils.getValueOrDefault(optionsObject, 'includeEnvelope', false);
            this.visibilityState = Utils.getValueOrDefault(optionsObject, 'visibilityState');
            this.yExtent = Utils.getValueOrDefault(optionsObject, 'yExtent');
    }
}
export {ChartDataOptions}
