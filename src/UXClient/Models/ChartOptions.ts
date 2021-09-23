import * as d3 from 'd3';
import Utils from '../Utils';
import { Strings } from './Strings';
import { DefaultHierarchyNavigationOptions } from '../Constants/Constants';
import { InterpolationFunctions, YAxisStates } from '../Constants/Enums';
import { HorizontalMarker } from '../Utils/Interfaces';

// Interfaces
interface swimLaneOption {
    yAxisType: YAxisStates, 
    label?: string, 
    onClick?: (lane: number) => any, 
    collapseEvents?: string,
    horizontalMarkers?: Array<HorizontalMarker>
}

class ChartOptions {
    public aggTopMargin: number; // margin on top of each aggregate line(s)
    public arcWidthRatio: number; // number between 0 and 1 which determines how thic the pie chart arc is
    public autoTriggerBrushContextMenu: boolean; // whether the brush context menu gets triggered on brush mouse up
    public availabilityLeftMargin: number; // number which sets the left margin of the availability chart
    public bucketSizeMillis: number; // desired bucket size, expressed in milliseconds, that will likely be rounded down the the nearest neat bucket size
    public brushClearable: boolean; // whether to keep the brush selected region upon clear and non-selection of a new region
    public brushContextMenuActions: Array<any>; // pairs of names/actions for context menu for the brush
    public brushHandlesVisible: boolean; // whether handles on the brush are visible
    public brushMoveAction: any; // action fired when the brush moved
    public brushMoveEndAction: any; // action fired at the end of a mouse movement
    public brushRangeVisible: boolean; // whether the brush duration label is visible
    public canDownload: boolean; // whether chart's ellipsis menu contains download button
    public color: string; // color of the time selection ghost in availability chart
    public colors: Array<string>; // array of colors to select in the color picker
    public dateLocale: string; //moment locale specifying the location specific format for dates, along with translations for month and day names
    public defaultAvailabilityZoomRangeMillis: number; // default max period of time shown in the zoomed region of the availability chart
    public defaultColor: any; //default initial color for the color picker - can be null
    public dTPIsModal: boolean; //whether date time picker should behave like a modal
    public ellipsisItems: Array<any>; //objects reprenting options in the ellipsis menu 
    public focusHidden: boolean; // whether focus element is hidden in chart
    public fromChart: boolean; // whether a component is a subcomponent of another one or is a standalone
    public grid: boolean; // whether the chart includes a grid and grid button
    public hideChartControlPanel: boolean; // whether to hide the panel with chart control buttons
    public includeDots: boolean; // whether the linechart uses dots for values
    public includeEnvelope: boolean; //whether to include an area showing min/max boundaries in the line chart
    public includeTimezones: boolean; //whether timezone dropdown is included in dateTimePicker
    public initialValue: any; // a value used to hydrate the initial state of the chart
    public interpolationFunction: any; //which interpolation function used for line chart lines
    public isArea: boolean; // whether lines in LineChart are also areas
    public isColorValueHidden: boolean; // switch to show/hide hex value of the color right next to the color in the color picker button 
    public isCompact: boolean; // whether availability chart is in compact or expanded mode
    public isTemporal: boolean; // whether scatter plot has temporal slider
    public is24HourTime: boolean; // whether time is displayed in 24, or 12 hour time with am/pm
    public keepBrush: boolean; // whether to keep the brush selected region upon re render
    public keepSplitByColor: boolean; //whether to keep the split By colors when state is updated
    public labelSeriesWithMarker: boolean; //whether to add a marker at the right side of line chart with label for each series
    public legend: string; //state of the legend: shown, hidden, or compact
    public markers: Array<any>; // tuple of millisecond timestamps and labels per marker, listed as any to support back compatibility with when these were just timestamp millis
    public maxBuckets: number // max number of buckets in availability chart
    public minBrushWidth: number // minimum possible width of brush in linechart
    public minutesForTimeLabels: boolean; // whether time labels forced to minute granularity
    public noAnimate: boolean; // whether animations happen on state change
    public numberOfColors: number; // number of colors to show in the color picker grid
    public updateInterval: number; // frequency with which the component should trigger updates
    public offset: any; // offset for all timestamps in minutes from UTC
    public onClick: (d3Event: any) => void; // for handling click, e.g. clicking on color picker
    public onInput: (searchText: string, event) => void; // for handling after input actions in ModelAutocomplete
    public onInstanceClick: (instance: any) => any;  // for model search, takes an instance and returns an object of context menu actions
    public onKeydown: (d3Event: any, awesompleteObject: any) => void;  // for handling keydown actions in ModelAutocomplete
    public onMarkersChange: (markers: Array<number>) => any; //triggered when a marker is either added or removed in the linechart
    public onMouseout: () => void;
    public onMouseover: (aggKey: string, splitBy: string) => void;
    public onSelect: (value: any) => void; // for handling selection action with a parameter passed in a component, e.g. to pass color value string while color selection with color picker component
    public onSticky: (aggKey: string, splitBy: string) => void;
    public onUnsticky: (aggKey: string, splitBy: string) => void;
    public preserveAvailabilityState: boolean; // whether state in availability chart is saved or blown away on render
    public persistDateTimeButtonRange: boolean; // whether the date time button range component is persisted in compact availability chart
    public scaledToCurrentTime: boolean; //whether slider base component's scale is based on current time's values (or all values)
    public spMeasures: Array<string>; // measures passed into scatter plot to plot on axis
    public scatterPlotRadius: Array<number>; // Range of values to use for radius measure range
    public spAxisLabels: Array<string>; // X and Y axis labels for scatter plot
    public singleLineXAxisLabel: boolean; // whether x axis time labels are on a single line (else split into two lines)
    public snapBrush: boolean; // whether to snap linechart brush to closest value
    public stacked: boolean; //whether bars in barchart are stacked
    public shouldSticky: boolean; // whether sticky is triggered in the linechart when stickySeries or unStickySeries is called
    public strings: any; // passed in key value pairs of strings -> strings
    public suppressResizeListener: boolean; // whether a component's resize function is ignored. Applies to components which draw an SVG
    public swimLaneOptions: {[key: number]: swimLaneOption} | null;  // mapping of swim lane number to information about that swimlane, including axis type
    public theme: string; // theme for styling chart, light or dark
    public timeFrame: any; // from and to to specify range of an event or state series
    public timestamp: any; //For components with a slider, this is the selected timestamp
    public tooltip: boolean; // whether tooltip is visible
    public throttleSlider: boolean; // whether slider is throttled to only fire on mouseup vs slider move
    public warmStoreRange: Array<string>; //start and optional end timestamp representing the availability chart region within warm store. If no second value, endTime is assumed to be end of warm range
    public xAxisHidden: boolean; // whether xAxis is hidden in chart
    public xAxisTimeFormat: (d, i, isFirst, isLast) => {}; //takes in a date string, tick index, isFirst, and isLast, outputs a moment.js style date format string
    public yAxisHidden: boolean; // whether yAxis is hidden in chart
    public yAxisState: string; // state of the y axis in line chart, either: stacked, shared, overlap
    public yExtent: any; // [min, max] of range of y values in chart
    public zeroYAxis: boolean; // whether bar chart's bar's bottom (or top if negative) is zero
    public withContextMenu: boolean; // whether the hierarchy uses a context menu when you click on a parent of leaf nodes
    public hierarchyOptions: any; // hierarchy navigation related options for search api
    public onError: (titleKey, messageKey, xhr) => any;
    public timeSeriesIdProperties: Array<{name: string, type: any}>; // time series id properties to highlight and prioritize in events table

    public stringsInstance: Strings = new Strings(); 

    private getInterpolationFunction (interpolationName: string) {
        if (interpolationName == InterpolationFunctions.CurveLinear)
            return d3.curveLinear;
        if (interpolationName == InterpolationFunctions.CurveStep) 
            return d3.curveStep;
        if (interpolationName == InterpolationFunctions.CurveStepBefore) 
            return d3.curveStepBefore;
        if (interpolationName == InterpolationFunctions.CurveStepAfter)
            return d3.curveStepAfter;
        if (interpolationName == InterpolationFunctions.CurveBasis) 
            return d3.curveBasis;
        if (interpolationName == InterpolationFunctions.CurveCardinal) 
            return d3.curveCardinal;
        if (interpolationName == InterpolationFunctions.CurveMonotoneX) 
            return d3.curveMonotoneX;
        if (interpolationName == InterpolationFunctions.CurveCatmullRom) 
            return d3.curveCatmullRom;
        // default
        return d3.curveMonotoneX;
    }
    
    setOptions (chartOptionsObj) {
        chartOptionsObj = !chartOptionsObj ? {} : chartOptionsObj
        this.grid = this.mergeValue(chartOptionsObj, 'grid', false);
        this.preserveAvailabilityState = this.mergeValue(chartOptionsObj, 'preserveAvailabilityState', false);
        this.persistDateTimeButtonRange = this.mergeValue(chartOptionsObj, 'persistDateTimeButtonRange', false);
        this.isCompact = this.mergeValue(chartOptionsObj, 'isCompact', false);
        this.keepBrush = this.mergeValue(chartOptionsObj, 'keepBrush', false);
        this.isArea = this.mergeValue(chartOptionsObj, 'isArea', false); 
        this.noAnimate = this.mergeValue(chartOptionsObj, 'noAnimate', false); 
        this.updateInterval = this.mergeValue(chartOptionsObj, 'updateInterval', 0);
        this.minutesForTimeLabels = this.mergeValue(chartOptionsObj, 'minutesForTimeLabels', false);
        this.aggTopMargin = this.mergeValue(chartOptionsObj, 'aggTopMargin', 12);
        this.color = this.mergeValue(chartOptionsObj, 'color', null);
        this.maxBuckets = this.mergeValue(chartOptionsObj, 'maxBuckets', 500);
        this.yAxisHidden = this.mergeValue(chartOptionsObj, 'yAxisHidden', false);
        this.focusHidden = this.mergeValue(chartOptionsObj, 'focusHidden', false);
        this.singleLineXAxisLabel = this.mergeValue(chartOptionsObj, 'singleLineXAxisLabel', false);
        this.legend = this.mergeValue(chartOptionsObj, 'legend', 'shown');
        this.tooltip = this.mergeValue(chartOptionsObj, 'tooltip', false);
        this.throttleSlider = this.mergeValue(chartOptionsObj, 'throttleSlider', false);
        this.snapBrush = this.mergeValue(chartOptionsObj, 'snapBrush', false);
        this.minBrushWidth = this.mergeValue(chartOptionsObj, 'minBrushWidth', 0);
        this.theme = this.mergeValue(chartOptionsObj, 'theme', 'dark');
        this.keepSplitByColor = this.mergeValue(chartOptionsObj, 'keepSplitByColor', false);
        this.brushContextMenuActions = this.mergeValue(chartOptionsObj, 'brushContextMenuActions', null);
        this.timeFrame = this.mergeValue(chartOptionsObj, 'timeFrame', null);
        this.fromChart = this.mergeValue(chartOptionsObj, 'fromChart', false);
        this.timestamp = this.mergeValue(chartOptionsObj, 'timestamp', null);
        this.stacked = this.mergeValue(chartOptionsObj, 'stacked', false);
        this.scaledToCurrentTime = this.mergeValue(chartOptionsObj, 'scaledToCurrentTime', false);
        this.zeroYAxis = this.mergeValue( chartOptionsObj, 'zeroYAxis', true);
        this.arcWidthRatio = this.mergeValue(chartOptionsObj, 'arcWidthRatio', 0);
        this.bucketSizeMillis = this.mergeValue(chartOptionsObj, 'bucketSizeMillis', 0);
        this.brushClearable = this.mergeValue(chartOptionsObj, 'brushClearable', true);
        this.brushMoveAction = this.mergeValue(chartOptionsObj, 'brushMoveAction', () => {});
        this.brushMoveEndAction = this.mergeValue(chartOptionsObj, 'brushMoveEndAction', () => {});
        this.yAxisState = this.mergeValue(chartOptionsObj, 'yAxisState', 'stacked');
        this.xAxisHidden = this.mergeValue(chartOptionsObj, 'xAxisHidden', false);
        this.suppressResizeListener = this.mergeValue(chartOptionsObj, 'suppressResizeListener', false);
        this.onMouseout = this.mergeValue(chartOptionsObj, 'onMouseout', () => {});
        this.onMouseover = this.mergeValue(chartOptionsObj, 'onMouseover', () => {});
        this.onSticky = this.mergeValue(chartOptionsObj, 'onSticky', () => {});
        this.onUnsticky = this.mergeValue(chartOptionsObj, 'onUnsticky', () => {});
        this.onKeydown= this.mergeValue(chartOptionsObj, 'onKeydown', () => {});
        this.onInput = this.mergeValue(chartOptionsObj, 'onInput', () => {});
        this.brushHandlesVisible = this.mergeValue(chartOptionsObj, 'brushHandlesVisible', false);
        this.hideChartControlPanel = this.mergeValue(chartOptionsObj, 'hideChartControlPanel', false);
        this.offset = this.mergeValue(chartOptionsObj, 'offset', 0);
        this.is24HourTime = this.mergeValue(chartOptionsObj, 'is24HourTime', true);
        this.includeTimezones = this.mergeValue(chartOptionsObj, 'includeTimezones', true);
        this.availabilityLeftMargin = this.mergeValue(chartOptionsObj, 'availabilityLeftMargin', 60);
        this.onInstanceClick = this.mergeValue(chartOptionsObj, 'onInstanceClick', () => {return {}});
        this.interpolationFunction = this.getInterpolationFunction(this.mergeValue(chartOptionsObj, 'interpolationFunction', InterpolationFunctions.None));
        this.includeEnvelope = this.mergeValue(chartOptionsObj, 'includeEnvelope', false);
        this.canDownload = this.mergeValue(chartOptionsObj, 'canDownload', true);
        this.withContextMenu = this.mergeValue(chartOptionsObj, 'withContextMenu', false);
        this.autoTriggerBrushContextMenu = this.mergeValue(chartOptionsObj, 'autoTriggerBrushContextMenu', false);
        this.includeDots = this.mergeValue(chartOptionsObj, 'includeDots', false);
        this.yExtent = this.mergeValue(chartOptionsObj, 'yExtent', null);
        this.ellipsisItems = this.mergeValue(chartOptionsObj, 'ellipsisItems', []);
        this.markers = Utils.getValueOrDefault(chartOptionsObj, 'markers', null); // intentionally not mergeValue
        this.onMarkersChange = this.mergeValue(chartOptionsObj, 'onMarkersChange', (markers) => {});
        this.spMeasures = this.mergeValue(chartOptionsObj, 'spMeasures', null);
        this.scatterPlotRadius = this.mergeValue(chartOptionsObj, 'scatterPlotRadius', [4,10]);
        this.spAxisLabels = this.mergeValue(chartOptionsObj, 'spAxisLabels', null);
        this.isTemporal = this.mergeValue(chartOptionsObj, "isTemporal", false);
        this.xAxisTimeFormat = this.mergeValue(chartOptionsObj, 'xAxisTimeFormat', null);
        this.brushRangeVisible = this.mergeValue(chartOptionsObj, 'brushRangeVisible', true);
        this.strings = this.mergeStrings(Utils.getValueOrDefault(chartOptionsObj, 'strings', {}));
        this.dateLocale = this.mergeValue(chartOptionsObj, 'dateLocale', Utils.languageGuess());
        this.defaultAvailabilityZoomRangeMillis = this.mergeValue(chartOptionsObj, 'defaultAvailabilityZoomRangeMillis', null);
        this.warmStoreRange = this.mergeValue(chartOptionsObj, 'warmStoreRange', null);
        this.initialValue = this.mergeValue(chartOptionsObj, 'initialValue', null);
        this.dTPIsModal = this.mergeValue(chartOptionsObj, 'dTPIsModal', false);
        this.defaultColor = this.mergeValue(chartOptionsObj, 'defaultColor', null);
        this.numberOfColors = this.mergeValue(chartOptionsObj, 'numberOfColors', 15);
        this.colors = Utils.generateColors(this.numberOfColors, chartOptionsObj['colors'] ? chartOptionsObj['colors'] : null);
        this.isColorValueHidden = this.mergeValue(chartOptionsObj, 'isColorValueHidden', false);
        this.onClick = this.mergeValue(chartOptionsObj, 'onClick', () => {});
        this.onSelect = this.mergeValue(chartOptionsObj, 'onSelect', () => {});
        this.swimLaneOptions = this.mergeValue(chartOptionsObj, 'swimLaneOptions', null);
        this.hierarchyOptions = this.mergeValue(chartOptionsObj, 'hierarchyOptions', Object.assign({}, DefaultHierarchyNavigationOptions));
        this.labelSeriesWithMarker = this.mergeValue(chartOptionsObj, 'labelSeriesWithMarker', false);
        this.onError = this.mergeValue(chartOptionsObj, 'onError', (titleKey, messageKey, xhr) => {});
        this.timeSeriesIdProperties = Utils.getValueOrDefault(chartOptionsObj, 'timeSeriesIdProperties', []);
        this.shouldSticky = this.mergeValue(chartOptionsObj, 'shouldSticky', true);
    }

    private mergeStrings (strings) {
        this.stringsInstance.mergeStrings(strings);
        return this.stringsInstance.toObject();
    }

    private mergeValue (chartOptionsObj, propertyName, defaultValue) {
        if (this[propertyName] !== undefined && chartOptionsObj[propertyName] === undefined) {
            return this[propertyName];
        } 
        return Utils.getValueOrDefault(chartOptionsObj, propertyName, defaultValue);
    }

    public toObject () {
        return {
            grid: this.grid,
            preserveAvailabilityState: this.preserveAvailabilityState,
            persistDateTimeButtonRange: this.persistDateTimeButtonRange,
            isCompact: this.isCompact,
            keepBrush: this.keepBrush,
            isArea: this.isArea, 
            noAnimate: this.noAnimate,  
            minutesForTimeLabels: this.minutesForTimeLabels,
            aggTopMargin: this.aggTopMargin, 
            color: this.color,
            maxBuckets: this.maxBuckets,
            yAxisHidden: this.yAxisHidden,
            focusHidden: this.focusHidden,
            singleLineXAxisLabel: this.singleLineXAxisLabel,
            legend: this.legend,
            tooltip: this.tooltip,
            throttleSlider: this.throttleSlider,
            snapBrush: this.snapBrush,
            minBrushWidth: this.minBrushWidth,
            theme: this.theme,
            keepSplitByColor: this.keepSplitByColor,
            brushContextMenuActions: this.brushContextMenuActions,
            timeFrame: this.timeFrame,
            fromChart: this.fromChart,
            timestamp: this.timestamp,
            stacked: this.stacked,
            scaledToCurrentTime: this.scaledToCurrentTime,
            zeroYAxis: this.zeroYAxis,
            arcWidthRatio: this.arcWidthRatio,
            brushClearable: this.brushClearable,
            brushMoveAction: this.brushMoveAction,
            yAxisState: this.yAxisState,
            xAxisHidden: this.xAxisHidden,
            suppressResizeListener: this.suppressResizeListener,
            brushMoveEndAction: this.brushMoveEndAction,
            onMouseout: this.onMouseout,
            onMouseover: this.onMouseover,
            onSticky: this.onSticky,
            onUnsticky: this.onUnsticky,
            onKeydown: this.onKeydown,
            onInput: this.onInput,
            brushHandlesVisible: this.brushHandlesVisible,
            hideChartControlPanel: this.hideChartControlPanel,
            offset: this.offset,
            is24HourTime: this.is24HourTime.valueOf,
            includeTimezones: this.includeTimezones,
            availabilityLeftMargin: this.availabilityLeftMargin,
            onInstanceClick: this.onInstanceClick,
            interpolationFunction: this.interpolationFunction,
            includeEnvelope: this.includeEnvelope,
            canDownload: this.canDownload,
            withContextMenu: this.withContextMenu,
            autoTriggerBrushContextMenu: this.autoTriggerBrushContextMenu,
            includeDots: this.includeDots,
            yExtent: this.yExtent,
            ellipsisItems: this.ellipsisItems,
            markers: this.markers,
            onMarkersChange: this.onMarkersChange,
            xAxisTimeFormat: this.xAxisTimeFormat,
            spMeasures: this.spMeasures,
            scatterPlotRadius: this.scatterPlotRadius,
            spAxisLabels: this.spAxisLabels,
            brushRangeVisible: this.brushRangeVisible,
            strings: this.strings.toObject(),
            dateLocale: this.dateLocale,
            defaultAvailabilityZoomRangeMillis: this.defaultAvailabilityZoomRangeMillis,
            warmStoreRange: this.warmStoreRange,
            initialValue: this.initialValue,
            bucketSizeMillis: this.bucketSizeMillis,
            updateInterval: this.updateInterval,
            dTPIsModal: this.dTPIsModal,
            numberOfColors: this.numberOfColors,
            defaultColor: this.defaultColor,
            isColorValueHidden: this.isColorValueHidden,
            onClick: this.onClick,
            onSelect: this.onSelect,
            colors: this.colors,
            swimLaneOptions: this.swimLaneOptions,
            hierarchyOptions: this.hierarchyOptions,
            onError: this.onError,
            labelSeriesWithMarker: this.labelSeriesWithMarker,
            timeSeriesIdProperties: this.timeSeriesIdProperties,
            shouldSticky: this.shouldSticky
        }
    }
}

export {ChartOptions}