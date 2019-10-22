import {Utils, DataTypes, EventElementTypes} from "../Utils";

const DEFAULT_HEIGHT = 40;
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
    public includeDots: boolean = false;
    public visibilityState: Array<any> = null;
    public timeShift: string;
    public dataType: string; //numeric, categorical, events?
    public valueMapping: any; //only present for non-numeric
    public height: number; //only present for non-numeric
    public onElementClick: any;
    public eventElementType: any;
    public rollupCategoricalValues: boolean;
    public positionX: number;
    public positionY: number;

    constructor (optionsObject: Object){
        this.searchSpan = Utils.getValueOrDefault(optionsObject, 'searchSpan');
        this.measureTypes = Utils.getValueOrDefault(optionsObject, 'measureTypes');
        this.color = Utils.getValueOrDefault(optionsObject, 'color');
        this.alias = Utils.getValueOrDefault(optionsObject, 'alias');
        this.contextMenu = Utils.getValueOrDefault(optionsObject, 'contextMenu', []);
        this.interpolationFunction = Utils.getValueOrDefault(optionsObject, 'interpolationFunction', '');
        this.includeEnvelope = Utils.getValueOrDefault(optionsObject, 'includeEnvelope', false);
        this.includeDots = Utils.getValueOrDefault(optionsObject, 'includeDots', false);
        this.visibilityState = Utils.getValueOrDefault(optionsObject, 'visibilityState');
        this.yExtent = Utils.getValueOrDefault(optionsObject, 'yExtent');
        this.timeShift = Utils.getValueOrDefault(optionsObject, 'timeShift', '');
        this.dataType = Utils.getValueOrDefault(optionsObject, 'dataType', DataTypes.Numeric);
        this.valueMapping = Utils.getValueOrDefault(optionsObject, 'valueMapping', {});
        this.height = Utils.getValueOrDefault(optionsObject, 'height', DEFAULT_HEIGHT);
        this.onElementClick = Utils.getValueOrDefault(optionsObject, 'onElementClick', null);
        this.eventElementType = Utils.getValueOrDefault(optionsObject, 'eventElementType', EventElementTypes.Diamond);
        this.rollupCategoricalValues = Utils.getValueOrDefault(optionsObject, 'rollupCategoricalValues', false);
        this.positionX = Utils.getValueOrDefault(optionsObject, 'positionX', 0);
        this.positionY = Utils.getValueOrDefault(optionsObject, 'positionY', 0);
    }
}
export {ChartDataOptions}
