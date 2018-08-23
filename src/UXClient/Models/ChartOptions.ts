class ChartOptions {
    public aggTopMargin: number; // margin on top of each aggregate line(s)
    public arcWidthRatio: number; // number between 0 and 1 which determines how thic the pie chart arc is
    public availabilityLeftMargin: number; // number which sets the left margin of the availability chart
    public brushClearable: boolean; // whether to keep the brush selected region upon clear and non-selection of a new region
    public brushContextMenuActions: Array<any>; // pairs of names/actions for context menu for the brush
    public brushHandlesVisible: boolean; // whether handles on the brush are visible
    public brushMoveAction: any; // action fired when the brush moved
    public brushMoveEndAction: any; // action fired at the end of a mouse movement
    public color: string; // color of the time selection ghost in availability chart
    public events: Array<any>; // events passed into the linchart, an array of discrete time events
    public focusHidden: boolean; // whether focus element is hidden in chart
    public fromChart: boolean; // whether a component is a subcomponent of another one or is a standalone
    public grid: boolean; // whether the chart includes a grid and grid button
    public hideChartControlPanel: boolean; // whether to hide the panel with chart control buttons
    public includeTimezones: boolean; //whether timezone dropdown is included in dateTimePicker
    public isArea: boolean; // whether lines in LineChart are also areas
    public isCompact: boolean; // whether availability chart is in compact or expanded mode
    public is24HourTime: boolean; // whether time is displayed in 24, or 12 hour time with am/pm
    public keepBrush: boolean; // whether to keep the brush selected region upon re render
    public keepSplitByColor: boolean; //whether to keep the split By colors when state is updated
    public legend: string; //state of the legend: shown, hidden, or compact
    public maxBuckets: number // max number of buckets in availability chart
    public minBrushWidth: number // minimum possible width of brush in linechart
    public minutesForTimeLabels: boolean; // whether time labels forced to minute granularity
    public noAnimate: boolean; // whether animations happen on state change
    public offset: any; // offset for all timestamps in minutes from UTC
    public onMouseout: () => void;
    public onMouseover: (aggKey: string, splitBy: string) => void;
    public onSticky: (aggKey: string, splitBy: string) => void;
    public onUnsticky: (aggKey: string, splitBy: string) => void;
    public preserveAvailabilityState: boolean; // whether state in availability chart is saved or blown away on render
    public scaledToCurrentTime: boolean; //whether slider base component's scale is based on current time's values (or all values)
    public singleLineXAxisLabel: boolean; // whether x axis time labels are on a single line (else split into two lines)
    public snapBrush: boolean; // whether to snap linechart brush to closest value
    public stacked: boolean; //whether bars in barchart are stacked
    public states: Array<any>; // states passed into the linchart, an array of time range bound states
    public suppressResizeListener: boolean; // whether a component's resize function is ignored. Applies to components which draw an SVG
    public theme: string; // theme for styling chart, light or dark
    public timeFrame: any; // from and to to specify range of an event or state series
    public timestamp: any; //For components with a slider, this is the selected timestamp
    public tooltip: boolean; // whether tooltip is visible
    public xAxisHidden: boolean; // whether xAxis is hidden in chart
    public yAxisHidden: boolean; // whether yAxis is hidden in chart
    public yAxisState: string; // state of the y axis in line chart, either: stacked, shared, overlap
    public zeroYAxis: boolean; // whether bar chart's bar's bottom (or top if negative) is zero

    private getValueOrDefault (chartOptionsObj, propertyName, defaultValue) {
        let propertyValue = chartOptionsObj[propertyName];
        if (propertyValue == undefined){
            if (this[propertyName] == undefined)
                return defaultValue
            return this[propertyName];
        } 
        return propertyValue;  
    }
    
    setOptions (chartOptionsObj) {
        this.grid = this.getValueOrDefault(chartOptionsObj, 'grid', false);
        this.preserveAvailabilityState = this.getValueOrDefault(chartOptionsObj, 'preserveAvailabilityState', false);
        this.isCompact = this.getValueOrDefault(chartOptionsObj, 'isCompact', false);
        this.keepBrush = this.getValueOrDefault(chartOptionsObj, 'keepBrush', false);
        this.isArea = this.getValueOrDefault(chartOptionsObj, 'isArea', false); 
        this.noAnimate = this.getValueOrDefault(chartOptionsObj, 'noAnimate', false); 
        this.minutesForTimeLabels = this.getValueOrDefault(chartOptionsObj, 'minutesForTimeLabels', false);
        this.aggTopMargin = this.getValueOrDefault(chartOptionsObj, 'aggTopMargin', 12);
        this.color = this.getValueOrDefault(chartOptionsObj, 'color', null);
        this.maxBuckets = this.getValueOrDefault(chartOptionsObj, 'maxBuckets', 500);
        this.yAxisHidden = this.getValueOrDefault(chartOptionsObj, 'yAxisHidden', false);
        this.focusHidden = this.getValueOrDefault(chartOptionsObj, 'focusHidden', false);
        this.singleLineXAxisLabel = this.getValueOrDefault(chartOptionsObj, 'singleLineXAxisLabel', false);
        this.legend = this.getValueOrDefault(chartOptionsObj, 'legend', 'shown');
        this.states = this.getValueOrDefault(chartOptionsObj, 'states', null);
        this.events = this.getValueOrDefault(chartOptionsObj, 'events', null);
        this.tooltip = this.getValueOrDefault(chartOptionsObj, 'tooltip', false);
        this.snapBrush = this.getValueOrDefault(chartOptionsObj, 'snapBrush', false);
        this.minBrushWidth = this.getValueOrDefault(chartOptionsObj, 'minBrushWidth', 0);
        this.theme = this.getValueOrDefault(chartOptionsObj, 'theme', 'dark');
        this.keepSplitByColor = this.getValueOrDefault(chartOptionsObj, 'keepSplitByColor', false);
        this.brushContextMenuActions = this.getValueOrDefault(chartOptionsObj, 'brushContextMenuActions', null);
        this.timeFrame = this.getValueOrDefault(chartOptionsObj, 'timeFrame', null);
        this.fromChart = this.getValueOrDefault(chartOptionsObj, 'fromChart', false);
        this.timestamp = this.getValueOrDefault(chartOptionsObj, 'timestamp', null);
        this.stacked = this.getValueOrDefault(chartOptionsObj, 'stacked', false);
        this.scaledToCurrentTime = this.getValueOrDefault(chartOptionsObj, 'scaledToCurrentTime', false);
        this.zeroYAxis = this.getValueOrDefault( chartOptionsObj, 'zeroYAxis', true);
        this.arcWidthRatio = this.getValueOrDefault(chartOptionsObj, 'arcWidthRatio', 0);
        this.brushClearable = this.getValueOrDefault(chartOptionsObj, 'brushClearable', true);
        this.brushMoveAction = this.getValueOrDefault(chartOptionsObj, 'brushMoveAction', () => {});
        this.brushMoveEndAction = this.getValueOrDefault(chartOptionsObj, 'brushMoveEndAction', () => {});
        this.yAxisState = this.getValueOrDefault(chartOptionsObj, 'yAxisState', 'stacked');
        this.xAxisHidden = this.getValueOrDefault(chartOptionsObj, 'xAxisHidden', false);
        this.suppressResizeListener = this.getValueOrDefault(chartOptionsObj, 'suppressResizeListener', false);
        this.onMouseout = this.getValueOrDefault(chartOptionsObj, 'onMouseout', () => {});
        this.onMouseover = this.getValueOrDefault(chartOptionsObj, 'onMouseover', () => {});
        this.onSticky = this.getValueOrDefault(chartOptionsObj, 'onSticky', () => {});
        this.onUnsticky = this.getValueOrDefault(chartOptionsObj, 'onUnsticky', () => {});
        this.brushHandlesVisible = this.getValueOrDefault(chartOptionsObj, 'brushHandlesVisible', false);
        this.hideChartControlPanel = this.getValueOrDefault(chartOptionsObj, 'hideChartControlPanel', false);
        this.offset = this.getValueOrDefault(chartOptionsObj, 'offset', 0);
        this.is24HourTime = this.getValueOrDefault(chartOptionsObj, 'is24HourTime', true);
        this.includeTimezones = this.getValueOrDefault(chartOptionsObj, 'includeTimezones', true);
        this.availabilityLeftMargin = this.getValueOrDefault(chartOptionsObj, 'availabilityLeftMargin', 60);
    }

    public toObject () {
        return {
            grid: this.grid,
            preserveAvailabilityState: this.preserveAvailabilityState,
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
            states: this.states,
            events: this.events,
            tooltip: this.tooltip,
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
            brushHandlesVisible: this.brushHandlesVisible,
            hideChartControlPanel: this.hideChartControlPanel,
            offset: this.offset,
            is24HourTime: this.is24HourTime.valueOf,
            includeTimezones: this.includeTimezones,
            availabilityLeftMargin: this.availabilityLeftMargin
        }
    }
}

export {ChartOptions}