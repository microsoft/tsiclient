import * as d3 from 'd3';
import { interpolatePath } from 'd3-interpolate-path';
import './LineChart.scss';
import {Utils, DataTypes, YAxisStates, LINECHARTTOPPADDING, TooltipMeasureFormat} from "./../../Utils";
import {Legend} from "./../Legend/Legend";
import {TemporalXAxisComponent} from "./../../Interfaces/TemporalXAxisComponent";
import {LineChartData} from "./../../Models/LineChartData";
import { ContextMenu } from '../ContextMenu/ContextMenu';
import { Tooltip } from '../Tooltip/Tooltip';
import { ChartOptions } from '../../Models/ChartOptions';
import { EllipsisMenu } from '../EllipsisMenu/EllipsisMenu';
import { ChartDataOptions } from '../../Models/ChartDataOptions';
import { LinePlot } from '../LinePlot/LinePlot';
import { CategoricalPlot } from '../CategoricalPlot/CategoricalPlot';
import { EventsPlot } from '../EventsPlot/EventsPlot';
import { AxisState } from '../../Models/AxisState';

class LineChart extends TemporalXAxisComponent {
    private targetElement: any;
    private focus: any;
    private contextMenu: ContextMenu;
    private brushContextMenu: ContextMenu;
    private setDisplayStateFromData: any;
    private minBrushWidth = 1;
    private strokeOpacity = 1;
    private nonFocusStrokeOpactiy = .3;
    chartComponentData = new LineChartData();
    private surpressBrushTimeSet: boolean = false;
    private hasStackedButton: boolean = false;
    private stackedButton: any = null;
    private scooterButton: any = null;
    private visibleAggCount: number;

    private tooltip: Tooltip;
    private height: number;
    private xLowerBound: number;
    private xUpperBound: number;
    private y: any;
    private yMap: any;
    private line: any;
    private areaPath: any;
    private envelope: any;
    private voronoi: any;
    private possibleTimesArray: any;
    private colorMap: any;
    private activeScooter: any;
    private scooterGuidMap: any = {};
    private brush: any;
    private brushElem: any;
    public brushStartTime: Date;
    public brushEndTime: Date;
    private brushStartPosition: number;
    private brushEndPosition: number;
    private hasBrush: boolean = false;
    private isDroppingScooter: boolean = false;
    private isClearingBrush: boolean = false;
    private previousAggregateData: any = d3.local();
    private previousIncludeDots: any = d3.local();
    private voronoiDiagram;
    private voronoiRegion;
    private mx = null;
    private my = null;
    private focusedAggKey: string = null;
    private focusedSplitby: string = null;

    private plotComponents = {};

    private isFirstMarkerDrop = true;
    private xOffset = 8;

    private swimlaneYExtents = {}; // mapping of swimlanes to the y extents of that swimlane
    private swimLaneContents = {}; 

    private originalSwimLanes: Array<number>;
    private originalSwimLaneOptions: any;

    constructor(renderTarget: Element){
        super(renderTarget);
        this.MINHEIGHT = 26;
        this.chartMargins = {        
            top: 40,
            bottom: 40,
            left: 70, 
            right: 60
        };
    }

    LineChart() { 
    }

    private setIsDroppingScooter (isDropping: boolean) {
        this.isDroppingScooter = isDropping;
        if (this.scooterButton) {
            this.scooterButton.style("border-color", this.isDroppingScooter ? "grey" : "transparent");
        }
    }

    //get the left and right positions of the brush
    public getBrushPositions () {
        var leftPos = null;
        var rightPos = null;
        if (this.brushStartTime) {
            var rawLeft = this.x(this.brushStartTime);
            if (rawLeft >= 0 && rawLeft <= this.chartWidth)
                leftPos = Math.round(rawLeft + this.chartMargins.left);
        }
        if (this.brushEndTime) {
            var rawRight = this.x(this.brushEndTime);
            if (rawRight >= 0 && rawRight <= this.chartWidth)
                rightPos = Math.round(rawRight + this.chartMargins.left);
        }
        return {
            leftPos: leftPos,
            rightPos: rightPos
        };
    }

    private voronoiMouseout (d: any)  {
        //supress if the context menu is visible
        if (this.contextMenu && this.contextMenu.contextMenuVisible)
            return;
        
        this.focus.style("display", "none");
        d3.select(this.renderTarget).select(".tooltip").style("display", "none");
        (<any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel')).classed("inFocus", false);
        if (d3.event && d3.event.type != 'end') {
            d3.event.stopPropagation();
        }

        this.svgSelection.selectAll(".valueElement")
                    .attr("stroke-opacity", this.strokeOpacity)
                    .filter(function () {
                        return !d3.select(this).classed("valueEnvelope");
                    })
                    .attr("fill-opacity", 1);

        this.svgSelection.selectAll(".valueEnvelope")
            .attr("fill-opacity", .2);
            
        d3.select(this.renderTarget).selectAll(".tsi-scooterValue")
            .style("opacity", 1);

        /** Update y Axis */
        if (this.chartOptions.yAxisState == YAxisStates.Overlap) {
            this.svgSelection.selectAll(".yAxis")
                .selectAll("text")
                .style("fill-opacity", 1)
                .classed("standardYAxisText", false)
                .style("font-weight", "normal");
        }
        this.focusedAggKey = null;
        this.focusedSplitby = null;
    }

    private createMarkerInstructions () {
        this.targetElement.selectAll(".tsi-markerInstructions").remove();
        this.targetElement.append("div")
            .classed("tsi-markerInstructions", true)
            .text(this.getString("Click to drop marker") + "," + this.getString("drag to reposition") + "."); 
    }

    private destroyMarkerInstructions () {
        this.targetElement.selectAll(".tsi-markerInstructions").remove();
    }   

    public triggerLineFocus = (aggKey: string, splitBy: string) => {
        this.svgSelection.selectAll(".valueElement")
            .attr("stroke-opacity", this.nonFocusStrokeOpactiy)
            .attr("fill-opacity", .3);
        this.svgSelection.selectAll(".valueEnvelope")
            .attr("fill-opacity", .1);

        let selectedFilter = this.createValueFilter(aggKey, splitBy);
        
        this.svgSelection.selectAll(".valueElement")
            .filter(selectedFilter)
            .attr("stroke-opacity", this.strokeOpacity)
            .attr("fill-opacity", 1);
        this.svgSelection.selectAll(".valueEnvelope")
            .filter(selectedFilter)
            .attr("fill-opacity", .3);

        this.focusedAggKey = aggKey;
        this.focusedSplitby = splitBy;
    }

    private getMouseoverFunction (chartType =DataTypes.Numeric) {
        switch (chartType) {
            case DataTypes.Categorical:
                return this.categoricalMouseover;
            case DataTypes.Events:
                return this.discreteEventsMouseover;
            default:
                return () => {}
        }
    }

    private getMouseoutFunction (chartType = DataTypes.Numeric) {
        switch (chartType) {
            case DataTypes.Categorical:
                return this.categoricalMouseout;
            case DataTypes.Events:
                return this.discreteEventsMouseout;
            default:
                return () => {}
        }
    }

    private discreteEventsMouseover = (d, x, y, width) => {
        if (this.isDroppingScooter) {
            return false;
        }
        this.legendObject.triggerSplitByFocus(d.aggregateKey, d.splitBy);

        let xPos = x;
        let yPos = y + this.chartMargins.top;

        let yValue = this.getValueOfVisible(d);

        if (this.chartOptions.tooltip){
            this.tooltip.render(this.chartOptions.theme);
            this.tooltip.draw(d, this.chartComponentData, xPos, y, this.chartMargins, (text) => {
                this.tooltipFormat(d, text, TooltipMeasureFormat.SingleValue);
            }, width, 0, 0);
        }
        else 
            this.tooltip.hide();
        return true;
    }

    private discreteEventsMouseout = () => {
        (<any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel')).classed("inFocus", false);
        this.tooltip.hide();
    }
    private mismatchingChartType (aggKey) {
        if (!this.plotComponents[aggKey]) {
            return false;
        }
        let typeOfPlot = this.plotComponents[aggKey].plotDataType;
        return typeOfPlot !== this.getDataType(aggKey);
    }

    //returns false if supressed via isDroppingScooter, true otherwise
    private categoricalMouseover = (d, x, y, endDate, width) => {
        if (this.isDroppingScooter) {
            return false;
        }
        this.legendObject.triggerSplitByFocus(d.aggregateKey, d.splitBy);

        let xPos = x;
        let yPos = y + this.chartMargins.top;

        let yValue = this.getValueOfVisible(d);

        if (this.chartOptions.tooltip){
            this.tooltip.render(this.chartOptions.theme);
            this.tooltip.draw(d, this.chartComponentData, xPos, y, this.chartMargins, (text) => {
                d.endDate = endDate;
                this.tooltipFormat(d, text,TooltipMeasureFormat.SingleValue);
            }, width, 0, 0);
        }
        else 
            this.tooltip.hide();
        return true;
    }

    private categoricalMouseout = () => {
        (<any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel')).classed("inFocus", false);
        this.tooltip.hide();
    }

    private voronoiMouseover = (d: any) => {
        //supress if the context menu is visible
        if (this.contextMenu && this.contextMenu.contextMenuVisible)
            return;

        let shiftMillis = this.chartComponentData.getTemporalShiftMillis(d.aggregateKey);
        var yScale = this.yMap[d.aggregateKey];
        var xValue = d.dateTime;
        var xPos = this.getXPosition(d, this.x);
        var yValue = this.getValueOfVisible(d);
        var yPos = yScale(yValue);

        this.focus.style("display", "block");
        this.focus.attr("transform", "translate(" + xPos + "," + yPos + ")");
        this.focus.select('.hLine').attr("transform", "translate(" + (-xPos) + ",0)");
        this.focus.select('.vLine').attr("transform", "translate(0," + (-yPos) + ")");
        
        this.focus.select('.hHoverG')
            .attr("transform", "translate(0," + (this.chartHeight - yPos) + ")");
        var text = this.focus.select('.hHoverG').select("text").text("");

        var bucketSize = this.chartComponentData.displayState[d.aggregateKey].bucketSize;
        var endValue = bucketSize ? (new Date(xValue.valueOf() + bucketSize)) : null;
        
        text.append("tspan").text(Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
                 this.chartOptions.offset, this.chartOptions.is24HourTime, shiftMillis, null, this.chartOptions.dateLocale)(xValue))
            .attr("x", 0)
            .attr("y", 4);
        if (endValue) {
            text.append("tspan").text(Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
                    this.chartOptions.offset, this.chartOptions.is24HourTime, shiftMillis, null, this.chartOptions.dateLocale)(endValue))
                .attr("x", 0)
                .attr("y", 27);
            var barWidth = this.x(endValue) - this.x(xValue);
            this.focus.select('.hHoverG').select('.hHoverValueBar')
                .attr("x1", (-barWidth / 2))
                .attr("x2", (barWidth / 2));
        }
        else {
            this.focus.select('.hHoverG').select('.hHoverValueBar')
                .attr("x2", 0);
        }

        var textElemDimensions = (<any>this.focus.select('.hHoverG').select("text")
            .node()).getBoundingClientRect();
        this.focus.select(".hHoverG").select("rect")
            .attr("x", -(textElemDimensions.width / 2) - 3)
            .attr("width", textElemDimensions.width + 6)
            .attr("height", textElemDimensions.height + 5);

        this.focus.select('.vHoverG')
            .attr("transform", "translate(" + (-xPos) + ",0)")
            .select("text")
            .text(Utils.formatYAxisNumber(yValue));
        var textElemDimensions = (<any>this.focus.select('.vHoverG').select("text")
            .node()).getBoundingClientRect();
        this.focus.select(".vHoverG").select("rect")
            .attr("x", -(textElemDimensions.width) - 13)
            .attr("y", -(textElemDimensions.height / 2) - 3)
            .attr("width", textElemDimensions.width + 6)
            .attr("height", textElemDimensions.height + 4);
        if (this.chartOptions.tooltip){
            this.tooltip.render(this.chartOptions.theme);
            this.tooltip.draw(d, this.chartComponentData, xPos, yPos, this.chartMargins, (text) => {
                this.tooltipFormat(d, text, TooltipMeasureFormat.Enveloped);
            }, null, 20, 20, this.colorMap[d.aggregateKey + "_" + d.splitBy]);
        }
        else 
            this.tooltip.hide();
        
        (<any>this.focus.node()).parentNode.appendChild(this.focus.node());
        this.legendObject.triggerSplitByFocus(d.aggregateKey, d.splitBy);

        /** update the y axis for in focus aggregate */
        if (this.chartOptions.yAxisState === YAxisStates.Overlap) {
            this.svgSelection.selectAll(".yAxis")
                .selectAll("text")
                .style("fill-opacity", .5)
                .classed("standardYAxisText", true);
            this.svgSelection.selectAll(".yAxis")
            .filter((yAxisAggKey) => {
                return yAxisAggKey == d.aggregateKey; 
            })
                .selectAll("text")
                .style("fill-opacity", 1)
                .classed("standardYAxisText", false)
                .style("font-weight", "bold");
        }

        if (this.chartOptions.yAxisHidden) {
            this.svgSelection.selectAll(".yAxis").style("display", "hidden");
        } 
        if (this.chartOptions.xAxisHidden) {
            this.svgSelection.selectAll(".xAxis").style("display", "none");
        }

        this.chartOptions.onMouseover(d.aggregateKey, d.splitBy);
    }

    // //get the extent of an array of timeValues
    private getYExtent (aggValues, isEnvelope, aggKey = null) {   
        let extent;
        if (aggKey !== null && (this.chartComponentData.displayState[aggKey].yExtent !== null)) {
            return this.chartComponentData.displayState[aggKey].yExtent;
        }
        if (this.chartOptions.yExtent !== null) {
            return this.chartOptions.yExtent;
        } 
        if (isEnvelope) {
            var filteredValues = this.getFilteredValues(aggValues);
            var flatValuesList = [];
            filteredValues.forEach((d: any) => {
                if (this.chartComponentData.isPossibleEnvelope(d.aggregateKey, d.splitBy)) {
                    if (d.measures['min'] != undefined && d.measures['min'] != null) {
                        flatValuesList.push(d.measures['min']);
                    }
                    if (d.measures['avg'] != undefined && d.measures['avg'] != null) {
                        flatValuesList.push(d.measures['avg']);
                    }
                    if (d.measures['max'] != undefined && d.measures['max'] != null) {
                        flatValuesList.push(d.measures['max']);
                    }
                } else {
                    var visibleMeasure = this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy);
                    if (d.measures[visibleMeasure] != undefined && d.measures[visibleMeasure] != null) {
                        flatValuesList.push(d.measures[visibleMeasure]);
                    }
                }
            });
            extent = d3.extent(flatValuesList);        
        } else {
            extent = d3.extent(this.getFilteredValues(aggValues), (d: any) => {
                var visibleMeasure = this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy);
                if (d.measures[visibleMeasure] != undefined && d.measures[visibleMeasure] != null) {
                    return d.measures[visibleMeasure];
                }
                return null;
            });    
        }
        if (extent[0] == undefined || extent[1] == undefined)
            return [0,1]
        return extent;
    }

    private getFilteredValues (aggValues) {
        return aggValues.filter((d: any) => {
            return (d.measures && this.getValueOfVisible(d) !== null);
        });
    }

    private getFilteredAndSticky (aggValues) { //getFilteredValues, then filter by sticky
        var filteredValues = this.getFilteredValues(aggValues);
        let numericFiltered = filteredValues.filter((d: any) => {
            return (this.getDataType(d.aggregateKey) === DataTypes.Numeric)
        })
        if (this.chartComponentData.stickiedKey == null)
            return numericFiltered;
        return numericFiltered.filter((d: any) => {
            return d.aggregateKey == this.chartComponentData.stickiedKey.aggregateKey &&
                ((this.chartComponentData.stickiedKey.splitBy == null) ? true : 
                d.splitBy == this.chartComponentData.stickiedKey.splitBy);
        });
    }

    public stickyOrUnstickySeries = (aggKey, splitBy) => {
        if (this.chartComponentData.stickiedKey && this.chartComponentData.stickiedKey.aggregateKey === aggKey && 
            this.chartComponentData.stickiedKey.splitBy === splitBy) {
            this.unstickySeries(aggKey, splitBy);
        } else {
            this.stickySeries(aggKey, splitBy);
        }
    }

    public unstickySeries = (aggKey, splitby = null) => {
        if (this.getDataType(aggKey) !== DataTypes.Numeric) {
            return;
        }
        this.chartComponentData.stickiedKey = null;
        (<any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel')).classed("stickied", false);
        // recompute voronoi with no sticky
        this.voronoiDiagram = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues));
        this.chartOptions.onUnsticky(aggKey, splitby);
    }

    private stickySeries = (aggregateKey: string, splitBy: string = null) => {
        if (this.getDataType(aggregateKey) !== DataTypes.Numeric) {
            return;
        }
        var filteredValues = this.getFilteredAndSticky(this.chartComponentData.allValues);
        if (filteredValues == null || filteredValues.length == 0)
            return;
        this.focusedAggKey = null;
        this.focusedSplitby = null;

        this.chartComponentData.stickiedKey = {
            aggregateKey: aggregateKey,
            splitBy: (splitBy == null ? null : splitBy)
        };

        (<any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel').filter(function (filteredSplitBy: any)  {
            return (d3.select(this.parentNode).datum() == aggregateKey) && (filteredSplitBy == splitBy);
        })).classed("stickied", true);

        this.voronoiDiagram = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues));
        this.chartOptions.onSticky(aggregateKey, splitBy);    
    }

    private getHandleHeight (): number {
        return Math.min(Math.max(this.chartHeight / 2, 24), this.chartHeight + 8);
    }

    private getXPosition (d, x) {
        var bucketSize = this.chartComponentData.displayState[d.aggregateKey].bucketSize;
        if (bucketSize)
            return (x(d.dateTime) + x((new Date(d.dateTime.valueOf() + bucketSize)))) / 2
        return x(d.dateTime);
    }

    public setBrushStartTime(startTime) {
        this.brushStartTime = startTime;
    }

    public setBrushEndTime (endTime) {
        this.brushEndTime = endTime;
    }

    public setBrush () {
        if (this.brushStartTime && this.brushEndTime && this.brushElem && this.brush) {
            var rawLeftSide = this.x(this.brushStartTime);
            var rawRightSide = this.x(this.brushEndTime);

            //if selection is out of range of brush. clear brush
            this.brushElem.call(this.brush.move, null);
            if ((rawRightSide < this.xOffset) || (rawLeftSide > (this.chartWidth - (2 * this.xOffset)))) {
                this.isClearingBrush = true;
                this.brushElem.call(this.brush.move, null);
                return;
            }

            let leftSide = Math.min(this.chartWidth - (2 * this.xOffset), Math.max(this.xOffset, this.x(this.brushStartTime)));
            let rightSide = Math.min(this.chartWidth - (2 * this.xOffset), Math.max(this.xOffset, this.x(this.brushEndTime)));
            
            this.surpressBrushTimeSet = true;
            this.brushStartPosition = leftSide;
            this.brushEndPosition = rightSide;
            //small adjusetment so that width is always at least 1 pixel
            if (rightSide - leftSide < 1) {
                if (rightSide + 1 > this.chartWidth - (2 * this.xOffset)) {
                    leftSide += -1;
                } else {
                    rightSide += 1;
                }
            }
            this.brushElem.call(this.brush.move, [leftSide, rightSide]);        
        }
    }

    private findClosestValidTime (rawMillis: number) {
        var minDiff = Infinity;
        return Object.keys(this.chartComponentData.timeMap).reduce((closestValue: number, currValue: any) => {
            var diff = Math.abs(Number(currValue) - rawMillis);
            if (diff < minDiff) {
                minDiff = diff;
                return Number(currValue);
            }
            return closestValue;
        }, Infinity);
    }

    private getScooterMarginLeft () {
        var legendWidth = this.legendObject.legendElement.node().getBoundingClientRect().width;
        return this.chartMargins.left + (this.chartOptions.legend === "shown" || this.chartOptions.legend === "hidden" ? legendWidth : 0) + 
            (this.chartOptions.legend === "shown" ? this.GUTTERWIDTH : 0);
    }

    // when re-rendering, scooters need to be repositioned - this function takes in a scooter and outputs the time on the timemap which 
    private findClosestScooterTime (prevMillis: number): number {
        var minDistance = Infinity;
        var closestValue = null;
        Object.keys(this.chartComponentData.timeMap).forEach((intervalCenterString) => {
            var intervalCenter = Number(intervalCenterString);
            if (Math.abs(intervalCenter - prevMillis) < minDistance) {
                minDistance = Math.abs(intervalCenter - prevMillis);
                closestValue = intervalCenter;
            }
        });
        return closestValue;
    }

    private setScooterPosition (scooter, rawMillis: number = null) {
        if (!scooter) {
            return;
        }
        var closestTime;
        if (rawMillis != null) {
            closestTime = this.findClosestValidTime(rawMillis);
            this.scooterGuidMap[scooter.datum()] = closestTime;    
        }
        closestTime = this.scooterGuidMap[scooter.datum()];
        if (closestTime < this.chartComponentData.fromMillis || closestTime > this.chartComponentData.toMillis) {
            scooter.style("display", "none");
        } else {
            scooter.style("display", "block")
                .style("left", (d) => {
                    var closestTime = this.scooterGuidMap[d];
                    return (Math.round(this.x(closestTime) + this.getScooterMarginLeft()) + "px");
                })
                .style("top", this.chartMargins.top + this.chartOptions.aggTopMargin + "px")
                .style("height", this.height - (this.chartMargins.top + this.chartMargins.bottom + this.chartOptions.aggTopMargin) + "px");
        }

        d3.select(this.renderTarget).selectAll(".tsi-scooterContainer").sort((a: string, b: string) =>  { 
            return (this.scooterGuidMap[a] < this.scooterGuidMap[b]) ? 1 : -1;            
        });
    }

    public exportMarkers () {
        return Object.keys(this.scooterGuidMap)
        .map((guid) => this.scooterGuidMap[guid]);
    }

    private importMarkers () {
        if (this.chartOptions.markers && this.chartOptions.markers.length > 0) {
            this.scooterGuidMap = {};
            d3.select(this.renderTarget).selectAll(".tsi-scooterContainer").remove();
            
            this.chartOptions.markers.forEach((markerMillis) => {
                let scooterUID = Utils.guid();
                this.scooterGuidMap[scooterUID] = markerMillis;
                let millis = (markerMillis < this.chartComponentData.fromMillis || markerMillis > this.chartComponentData.toMillis) ? null : markerMillis;
                let scooter = this.createScooter(scooterUID);
                this.setScooterPosition(scooter, millis);
                this.setScooterLabels(scooter);
                this.setScooterTimeLabel(scooter);
            });
        }
    }

    private focusOnEllipsis () {
        if (this.ellipsisContainer !== null) {
            this.ellipsisContainer.select(".tsi-ellipsisButton").node().focus();
        }
    }

    private setScooterTimeLabel (scooter) {
        var millis = this.scooterGuidMap[scooter.datum()];
        var values: Array<any> = this.chartComponentData.timeMap[millis];
        if (values == undefined || values.length == 0) {
            return;
        }
        var firstValue = values[0].dateTime;
        var secondValue = new Date(values[0].dateTime.valueOf() + (values[0].bucketSize != null ? values[0].bucketSize : 0));
        var timeFormat = Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
            this.chartOptions.offset, this.chartOptions.is24HourTime, null, null, this.chartOptions.dateLocale);
        var dateToTime = (t) => ((timeFormat(t).split(" ") && timeFormat(t).split(" ").length > 1) ? timeFormat(t).split(" ")[1] : '');
        var text = dateToTime(firstValue) + " - " + dateToTime(secondValue);
        var timeLabel = scooter.select(".tsi-scooterTimeLabel");
        let self = this;
        timeLabel.text(text)
            .append("button")
            .attr("aria-label", this.getString("Delete marker at") + ' ' + text) 
            .classed("tsi-closeButton", true)
            .on("click", function () {
                let markerGuid: string = String(d3.select(d3.select(this).node().parentNode.parentNode).datum());
                delete self.scooterGuidMap[markerGuid];
                d3.select(d3.select(this).node().parentNode.parentNode).remove();
                self.setIsDroppingScooter(false);
                self.focusOnEllipsis();
                self.chartOptions.onMarkersChange(self.exportMarkers());
            });

        var scooterLeft: number = Number(scooter.style("left").replace("px", ""));
        var timeLabelWidth: number = Math.round(timeLabel.node().getBoundingClientRect().width);
        var minLeftPosition = this.getScooterMarginLeft() + 20;
        var maxRightPosition = this.width - this.chartMargins.right;
        var calculatedLeftPosition = scooterLeft - (timeLabelWidth / 2);
        var calculatedRightPosition = scooterLeft + (timeLabelWidth / 2);
        var translate = "translateX(calc(-50% + 1px))";
        if (calculatedLeftPosition < minLeftPosition) {
            translate = "translateX(-" + Math.max(0, scooterLeft - minLeftPosition) + "px)";
        }
        if (calculatedRightPosition > maxRightPosition) {
            translate = "translateX(calc(-50% + " + (maxRightPosition - calculatedRightPosition) + "px))";
        }

        scooter.select(".tsi-scooterTimeLabel")
            .style("-webkit-tranform", translate)
            .style("transform", translate);
    }

    private calcTopOfScooterValueLabel (d) {
        var yScale = this.yMap[d.aggregateKey];
        return Math.round(yScale(this.getValueOfVisible(d)) - this.chartOptions.aggTopMargin) + "px";
    }

    private setScooterLabels (scooter, includeTransition = false) {
        var millis = this.scooterGuidMap[scooter.datum()];
        var values = this.chartComponentData.timeMap[millis] != undefined ? this.chartComponentData.timeMap[millis] : [];
        values = values.filter((d) => {
            return (this.getValueOfVisible(d) !== null) && this.getDataType(d.aggregateKey) === DataTypes.Numeric; 
        });
        var self = this;

        var valueLabels = scooter.selectAll(".tsi-scooterValue").data(values, (d) => {
            return d.aggregateKey + "_" + d.splitBy;
        });

        valueLabels.enter()
            .append("div")
            .classed("tsi-scooterValue", true)
            .merge(valueLabels)
            .each(function (d: any) {
                var valueLabel = d3.select(this).selectAll(".tsi-scooterValueLabel").data([d]);
                valueLabel.enter()
                    .append("div")
                    .classed("tsi-scooterValueLabel", true)
                    .merge(valueLabel)
                    .text(() => Utils.formatYAxisNumber(self.getValueOfVisible(d)))
                    .style("border-color", () => self.colorMap[d.aggregateKey + "_" + d.splitBy])
                valueLabel.exit().remove();

                var valueCaret = d3.select(this).selectAll(".tsi-scooterValueCaret").data([d])
                valueCaret.enter()
                    .append("div")
                    .classed("tsi-scooterValueCaret", true)
                    .merge(valueCaret)
                    .style("border-right-color", () => self.colorMap[d.aggregateKey + "_" + d.splitBy]);
                valueCaret.exit().remove();
            })
            .transition()
            .duration((self.chartOptions.noAnimate || !includeTransition) ? 0 : self.TRANSDURATION)
            .style("top", (d) => this.calcTopOfScooterValueLabel(d));

        valueLabels.exit().remove();
    }

    private filteredValueExist = () => {
        var filteredValues = this.getFilteredAndSticky(this.chartComponentData.allValues);
        return !(filteredValues == null || filteredValues.length == 0)
    }

    private createScooter = (scooterUID) => {
        let scooter: any = d3.select(this.renderTarget).append("div")
            .datum(scooterUID)
            .attr("class", "tsi-scooterContainer")
            .style("top", this.chartMargins.top + this.chartOptions.aggTopMargin + "px")
            .style("height", this.height - (this.chartMargins.top + this.chartMargins.bottom + this.chartOptions.aggTopMargin) + "px")
            .style("display", "none");
        
        scooter.append("div")
            .attr("class", "tsi-scooterLine");

        var self = this;
        scooter.append("div")
            .attr("class", "tsi-scooterDragger")
            .on("mouseover", function () {
                d3.select(this).classed("tsi-isHover", true);
            })
            .on("mouseout", function () {
                d3.select(this).classed("tsi-isHover", false);
            })
            .on("contextmenu", function () {
                d3.select(d3.select(this).node().parentNode).remove();
                d3.event.preventDefault();
            });
        var timeLabel = scooter.append("div")
            .attr("class", "tsi-scooterTimeLabel");
        
        scooter.selectAll(".tsi-scooterDragger,.tsi-scooterTimeLabel,.tsi-scooterLine")
            .call(d3.drag()
                .on("drag", function (d) {
                    if (d3.select(d3.event.sourceEvent.target).classed("tsi-closeButton")) {
                        return;
                    }
                    var scooter = d3.select(<any>d3.select(this).node().parentNode);
                    var currMillis: number = Number(self.scooterGuidMap[String(scooter.datum())]);
                    var startPosition = self.x(new Date(currMillis));
                    var newPosition = startPosition + d3.event.x;
                    self.setScooterPosition(scooter, self.x.invert(newPosition).valueOf());
                    self.setScooterLabels(scooter);
                    self.setScooterTimeLabel(scooter);
                    self.chartOptions.onMarkersChange(self.exportMarkers());
                })
                .on("end", function (d) {
                    if (!d3.select(d3.event.sourceEvent.target).classed("tsi-closeButton")) {
                        self.chartOptions.onMarkersChange(self.exportMarkers());
                    }
                })
            );
            
        scooter.style("pointer-events", "none");
        return scooter;
    }

    public addMarker = () => {
        if (this.isFirstMarkerDrop) {
            this.isFirstMarkerDrop = false;
            this.createMarkerInstructions();
        }
        this.setIsDroppingScooter(!this.isDroppingScooter); 
        if (!this.isDroppingScooter) {
            this.activeScooter.remove();
            this.destroyMarkerInstructions();
            return;
        }

        var scooterUID = Utils.guid();
        this.scooterGuidMap[scooterUID] = 0;

        this.activeScooter = this.createScooter(scooterUID);
        Utils.focusOnEllipsisButton(this.renderTarget);
    }

    private createValueFilter (aggregateKey, splitBy) {
        return (d: any, j: number ) => {
            var currAggKey: string;
            var currSplitBy: string;
            if (d.aggregateKey) {
                currAggKey = d.aggregateKey;
                currSplitBy = d.splitBy;
            } else  if (d && d.length){
                currAggKey = d[0].aggregateKey;
                currSplitBy = d[0].splitBy
            } else 
                return true;
            return (currAggKey == aggregateKey && (splitBy == null || splitBy == currSplitBy));
        }     
    } 

    private voronoiExists (): boolean {
        return (this.getVisibleNumerics() !== 0); 
    }

    private voronoiMousemove (mouseEvent) {
        if (!this.filteredValueExist() || !this.voronoiExists()) return;
        this.mx = mouseEvent[0];
        this.my = mouseEvent[1];
        const [mx, my] = mouseEvent;      
        var site: any = this.voronoiDiagram.find(this.mx, this.my);
        if (!this.isDroppingScooter) {
            this.voronoiMouseover(site.data);  
        } else {
            var rawTime = this.x.invert(mx);
            this.setScooterPosition(this.activeScooter, rawTime.valueOf());
            this.setScooterLabels(this.activeScooter);
            this.setScooterTimeLabel(this.activeScooter);
            return;
        }

        if (site.data.aggregateKey !== this.focusedAggKey || site.data.splitBy !== this.focusedSplitby) {
            let selectedFilter = this.createValueFilter(site.data.aggregateKey, site.data.splitBy);
            let oldFilter = this.createValueFilter(this.focusedAggKey, this.focusedSplitby);

            this.focusScooterLabel(selectedFilter, site.data.aggregateKey, site.data.splitBy);

            this.svgSelection.selectAll(".valueElement")
                .filter(selectedFilter)
                .attr("stroke-opacity", this.strokeOpacity)
                .attr("fill-opacity", 1);
            this.svgSelection.selectAll(".valueEnvelope")
                .filter(selectedFilter)
                .attr("fill-opacity", .3);

            this.svgSelection.selectAll(".valueElement")
                .filter(oldFilter)
                .attr("stroke-opacity", this.nonFocusStrokeOpactiy)
                .attr("fill-opacity", .3);
            this.svgSelection.selectAll(".valueEnvelope")
                .filter(oldFilter)
                .attr("fill-opacity", .1);


            this.focusedAggKey = site.data.aggregateKey;
            this.focusedSplitby = site.data.splitBy;
        }
    } 

    private voronoiContextMenu (mouseEvent) {
        if (!this.filteredValueExist() || !this.voronoiExists()) return;
        const [mx, my] = d3.mouse(mouseEvent);
        const site: any = this.voronoiDiagram.find(mx, my);
        if (this.chartComponentData.displayState[site.data.aggregateKey].contextMenuActions && 
            this.chartComponentData.displayState[site.data.aggregateKey].contextMenuActions.length) {
            var mousePosition = d3.mouse(<any>this.targetElement.node());

            let sitePageCoords;
            if (this.hasBrush) {
                sitePageCoords = this.brushElem.node().getBoundingClientRect();
            } else {
                sitePageCoords = this.voronoiRegion.node().getBoundingClientRect();
            }
            
            let eventSite = {pageX: sitePageCoords.left + site[0], pageY: sitePageCoords.top + site[1] - 12}

            d3.event.preventDefault();
            this.contextMenu.draw(this.chartComponentData, this.renderTarget, this.chartOptions, 
                                mousePosition, site.data.aggregateKey, site.data.splitBy, null,
                                site.data.dateTime, null, eventSite);
            if (this.brushContextMenu) {
                this.brushContextMenu.hide();
            }
            this.voronoiMouseover(site.data);
        }
    }

    private voronoiClick (mouseEvent) {
        if (!this.filteredValueExist() || !this.voronoiExists()) return;
        if (this.brushElem && !this.isDroppingScooter) return;
        const [mx, my] = d3.mouse(mouseEvent);
        var site: any = this.voronoiDiagram.find(mx, my);
        let cDO = this.getCDOFromAggKey(site.data.aggregateKey);
        if (!this.isDroppingScooter) {
            if (site.data && cDO.onElementClick !== null) {
                cDO.onElementClick(site.data.aggregateKey, site.data.splitBy, site.data.dateTime.toISOString(), site.data.measures);
            } else {
                if (this.chartComponentData.stickiedKey != null) {
                    site = this.voronoiDiagram.find(mx, my);
                    this.voronoiMousemove(site.data);
                    this.unstickySeries(site.data.aggregateKey, site.data.splitBy);
                    return;
                }
                this.stickySeries(site.data.aggregateKey, site.data.splitBy);    
            }
        } 

        this.destroyMarkerInstructions();
        if (!this.hasBrush) {
            this.setIsDroppingScooter(false);
        }
        if (this.activeScooter != null) {
            this.activeScooter.style("pointer-events", "all");
            this.activeScooter = null;
            this.chartOptions.onMarkersChange(this.exportMarkers());
        }
    }

    private getValueOfVisible (d) {
        if (d.measures) {
            var visibleMeasure = this.chartComponentData.getVisibleMeasure( d.aggregateKey, d.splitBy);
            if (d.measures[visibleMeasure] != null || d.measures[visibleMeasure] != undefined)
                return d.measures[visibleMeasure];
        } 
        return null;
    }

    private brushBrush () {
        var handleHeight = this.getHandleHeight();
        this.brushElem.selectAll('.handle')
            .attr('height', handleHeight)
            .attr('y', (this.chartHeight - handleHeight) / 2);

        if (!d3.event.sourceEvent){
            return;
        } 
        if (d3.event.sourceEvent && d3.event.sourceEvent.type === 'mousemove') {
            this.brushElem.select(".selection").attr("visibility", "visible");
            //check boundary conditions for width of the brush
            if (d3.event.selection[1] - d3.event.selection[0] < this.minBrushWidth) {
                return;
            } else {
                this.brushElem.selectAll(".handle").attr("visibility", "visible");
            }
        }
        if (this.surpressBrushTimeSet == true) {
            this.surpressBrushTimeSet = false;
            return;
        }
        if (!d3.event.selection) return; 

        if (this.contextMenu)
            this.contextMenu.hide();
        if (this.brushContextMenu)
            this.brushContextMenu.hide();
        
        var newBrushStartPosition = d3.event.selection[0];
        var newBrushEndPosition = d3.event.selection[1];
        if (newBrushStartPosition != this.brushStartPosition) {
            this.brushStartTime = this.x.invert(d3.event.selection[0]);
            this.brushStartPosition = newBrushStartPosition;
        }
        if (newBrushEndPosition != this.brushEndPosition) {
            this.brushEndTime = this.x.invert(d3.event.selection[1]);
            this.brushEndPosition = newBrushEndPosition;
        }
    
        if (this.chartOptions.brushMoveAction) {
            this.chartOptions.brushMoveAction(this.brushStartTime, this.brushEndTime);
        }
    }

    private brushEnd (mouseEvent) {
        if (this.isClearingBrush) {
            this.isClearingBrush = false;
            if (this.brushContextMenu) {
                this.brushContextMenu.hide();
            }
            return;
        }
        if (d3.event && d3.event.selection == null && d3.event.sourceEvent && d3.event.sourceEvent.type == "mouseup" && this.chartOptions.minBrushWidth == 0) {
            if (this.brushContextMenu) {
                this.brushContextMenu.hide();
            }
            const [mx, my] = d3.mouse(mouseEvent);
            var site: any = this.voronoiDiagram.find(mx, my);
            let isClearingBrush = (this.brushStartPosition !== null) && (this.brushEndPosition !== null);
            if (this.chartComponentData.stickiedKey != null && !this.isDroppingScooter && !isClearingBrush) {
                this.chartComponentData.stickiedKey = null;
                (<any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel')).classed("stickied", false);
                // recompute voronoi with no sticky
                this.voronoiDiagram = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues));
                site = this.voronoiDiagram.find(mx, my);
                this.voronoiMousemove(site.data);
                this.chartOptions.onUnsticky(site.data.aggregateKey, site.data.splitBy)
                return;
            }

            this.brushStartTime = null;
            this.brushEndTime = null;
            this.brushStartPosition = null;
            this.brushEndPosition = null;

            if (!this.isDroppingScooter && !isClearingBrush) {
                this.stickySeries(site.data.aggregateKey, site.data.splitBy);
            } else {
                this.setIsDroppingScooter(false);
            }
            return;
        }

        if (d3.event.selection == null) {
            if (!this.chartOptions.brushClearable) {
                d3.select(mouseEvent).transition().call(d3.event.target.move, [this.x(this.brushStartTime), this.x(this.brushEndTime)]);
            }
            return;
        }
        var transformCall = null; //if the brush needs to be transformed due to snap brush or it being too small, this is envoked
        var isZeroWidth = false; //clear the brush context menu if the brush has 0 width
        if (this.chartOptions.snapBrush) {
            //find the closest possible value and set to that
            if (this.possibleTimesArray.length > 0) {
                var findClosestTime = (rawXValue): Date => {
                    var closestDate = null;
                    this.possibleTimesArray.reduce((prev, curr) => {
                        var prospectiveDiff = Math.abs(rawXValue - this.x(curr));
                        var currBestDiff = Math.abs(rawXValue - prev);
                        if (prospectiveDiff < currBestDiff) {
                            closestDate = curr;
                            return this.x(curr)
                        }
                        return prev;
                    }, Infinity);
                    return closestDate;
                }
                var newBrushStartTime = findClosestTime(d3.event.selection[0]);
                var newBrushEndTime = findClosestTime(d3.event.selection[1]);
                if (newBrushStartTime != this.brushStartTime || newBrushEndTime != this.brushEndTime) {
                    this.brushStartTime = newBrushStartTime;
                    this.brushEndTime = newBrushEndTime;
                    this.brushStartPosition = this.x(this.brushStartTime);
                    this.brushEndPosition = this.x(this.brushEndTime);
                    transformCall = () => d3.select(mouseEvent).transition().call(d3.event.target.move, [this.x(this.brushStartTime), this.x(this.brushEndTime)]);
                    isZeroWidth = this.x(this.brushStartTime) == this.x(this.brushEndTime);
                }
            }
        }
        if (d3.event.selection[1] - d3.event.selection[0] < this.minBrushWidth) {
            let rightSide = Math.min(d3.event.selection[0] + this.minBrushWidth, this.x.range()[1]);
            transformCall = () => d3.select(mouseEvent).transition().call(d3.event.target.move, [rightSide - this.minBrushWidth, rightSide]);
            isZeroWidth = (rightSide - this.minBrushWidth == rightSide);
        }
        if (this.chartOptions.brushMoveEndAction && (d3.event.sourceEvent && d3.event.sourceEvent.type == 'mouseup')) {
            this.chartOptions.brushMoveEndAction(this.brushStartTime, this.brushEndTime);
        }
        if (this.chartOptions.brushContextMenuActions && this.chartOptions.autoTriggerBrushContextMenu && 
            (d3.event.sourceEvent && d3.event.sourceEvent.type == 'mouseup')) {
            if (!this.chartOptions.brushContextMenuActions || this.chartOptions.brushContextMenuActions.length == 0)
                return;
            var mousePosition = d3.mouse(<any>this.targetElement.node());
            //constrain the mouse position to the renderTarget
            var boundingCRect = this.targetElement.node().getBoundingClientRect();
            var correctedMousePositionX = Math.min(boundingCRect.width, Math.max(mousePosition[0], 0));
            var correctedMousePositionY = Math.min(boundingCRect.height, Math.max(mousePosition[1], 0));
            var correctedMousePosition = [correctedMousePositionX, correctedMousePositionY];
            
            this.brushContextMenu.draw(this.chartComponentData, this.renderTarget, this.chartOptions, 
                                correctedMousePosition, null, null, null, this.brushStartTime, this.brushEndTime);
        }
        if (transformCall) {
            transformCall();
            if (this.brushContextMenu && isZeroWidth) {
                this.brushContextMenu.hide();
            } 
        }
    }

    // updates the display of scooters but not their underlying data. Updates all if no scooter is passed in
    private updateScooterPresentation (scooter = null) {
        var scooterSelection;
        if (scooter != null) {
            scooterSelection = scooter;
        } else {
            scooterSelection = d3.select(this.renderTarget).selectAll(".tsi-scooterContainer");
        }
        var self = this;
        scooterSelection.each(function () {
            var currScooter = d3.select(this);
            var millis = Number(self.scooterGuidMap[String(currScooter.datum())]);

            if (self.chartComponentData.timeMap[millis] == undefined && millis >= self.chartComponentData.fromMillis && millis <= self.chartComponentData.toMillis) {
                self.scooterGuidMap[String(currScooter.datum())] = self.findClosestScooterTime(millis);
            }
            self.setScooterLabels(currScooter, true);
            self.setScooterPosition(currScooter);
            self.setScooterTimeLabel(currScooter);
            currScooter.transition()
                .duration(self.chartOptions.noAnimate ? 0 : self.TRANSDURATION)
                .style("left", (d) => (Math.round(self.x(d) + self.getScooterMarginLeft()) + "px"));
        });
    } 

    private focusScooterLabel (filterFunction, aggKey, splitBy) {
        d3.select(this.renderTarget).selectAll(".tsi-scooterValue").style("opacity", .2);

        d3.select(this.renderTarget).selectAll(".tsi-scooterValue")
            .filter(filterFunction)
            .style("opacity", 1);
        
        d3.select(this.renderTarget).selectAll(".tsi-scooterContainer").each(function () {
            d3.select(this).selectAll(".tsi-scooterValue").sort(function (a: any, b: any) { 
                return (a.aggregateKey == aggKey && (splitBy == null || splitBy == a.splitBy)) ? 1 : -1;            
            });
        });
    }  

    public labelMouseout = () =>{
        if (this.svgSelection) {
            d3.select(this.renderTarget).selectAll(".tsi-scooterValue")
                .style("opacity", 1);
        
            this.svgSelection.selectAll(".valueElement")
                .filter(function () { return !d3.select(this).classed("valueEnvelope"); })
                .attr("stroke-opacity", 1)
                .attr("fill-opacity", 1);
            this.svgSelection.selectAll(".valueEnvelope")
                .attr("fill-opacity", .3);
        }
    }

    public labelMouseover = (aggregateKey: string, splitBy: string = null) => {
        //filter out the selected timeseries/splitby
        var selectedFilter = (d: any, j: number ) => {
            var currAggKey: string;
            var currSplitBy: string;
            if (d.aggregateKey) {
                currAggKey = d.aggregateKey;
                currSplitBy = d.splitBy;
            } else  if (d && d.length){
                currAggKey = d[0].aggregateKey;
                currSplitBy = d[0].splitBy
            } else 
                return true;
            return !(currAggKey == aggregateKey && (splitBy == null || splitBy == currSplitBy));
        }
        if (this.svgSelection) {
            this.svgSelection.selectAll(".valueElement")
                .filter(selectedFilter)
                .attr("stroke-opacity", this.nonFocusStrokeOpactiy)
                .attr("fill-opacity", .3);

            this.svgSelection.selectAll(".valueEnvelope")
                .filter(selectedFilter)
                .attr("fill-opacity", .1);
                
            this.focusScooterLabel(this.createValueFilter(aggregateKey, splitBy), aggregateKey, splitBy);
        }
    }

    private drawBrushRange () {
        if (this.chartOptions.brushRangeVisible) {
            if (this.targetElement.select('.tsi-rangeTextContainer').empty() && (this.brushStartTime || this.brushEndTime)) {
                var rangeTextContainer = this.targetElement.append("div")
                    .attr("class", "tsi-rangeTextContainer");
            }
            this.updateBrushRange();
        }
    }

    public updateBrushRange () {
        let svgLeftOffset = this.chartOptions.legend === 'shown' ? (this.width - this.svgSelection.node().getBoundingClientRect().width) : 0;
        if (!(this.brushStartTime || this.brushEndTime)) {
            this.deleteBrushRange();
            return;
        }

        let rangeText = Utils.rangeTimeFormat(this.brushEndTime.valueOf() - this.brushStartTime.valueOf());
        let rangeTextContainer = this.targetElement.select('.tsi-rangeTextContainer');

        let leftPos = this.chartMargins.left + 
            Math.min(Math.max(0, this.x(this.brushStartTime)), this.x.range()[1]) + svgLeftOffset;

        let rightPos = this.chartMargins.left + 
            Math.min(Math.max(0, this.x(this.brushEndTime)), this.x.range()[1]) + svgLeftOffset;
 
        rangeTextContainer
            .text(rangeText)
            .style("left", Math.max(8, Math.round((leftPos + rightPos) / 2)) + "px")
            .style("top", (this.chartMargins.top + this.chartOptions.aggTopMargin) + 'px')
        
        if (this.chartOptions.color) {
            rangeTextContainer
                .style('background-color', this.chartOptions.color)
                .style('color', 'white');
        }

        let calcedWidth = rangeTextContainer.node().getBoundingClientRect().width;	
        if (this.chartOptions.isCompact && (rightPos - leftPos) < calcedWidth) {	
            rangeTextContainer.style('visibility', 'hidden');	
        } else {
            rangeTextContainer.style('visibility', 'visible');
        }
    }

    public deleteBrushRange () {
        this.targetElement.select('.tsi-rangeTextContainer').remove();
    }

    private nextStackedState = () => {
        if (this.chartOptions.yAxisState === YAxisStates.Stacked) 
            return "shared";
        else if (this.chartOptions.yAxisState === YAxisStates.Shared)
            return "overlap";
        else  
            return "stacked";
    };

    private clearBrush () {
        this.svgSelection.select('.svgGroup').select(".brushElem").call(this.brush.move, null);
        this.deleteBrushRange();
        if (this.brushContextMenu) {
            this.brushContextMenu.hide();
        }
    }

    private getVisibleNumerics () {
        let visibleGroups = this.chartComponentData.data.filter((agg) => this.chartComponentData.displayState[agg.aggKey]["visible"]);
        let visibleCDOs = this.aggregateExpressionOptions.filter((cDO) => this.chartComponentData.displayState[cDO.aggKey]["visible"]);
        return visibleGroups.filter((aggKey, i) => {
            return visibleCDOs[i].dataType === DataTypes.Numeric;
        }).length;
    }

    private getSwimlaneOffsets (linechartTopPadding: number, visibleGroups: Array<ChartDataOptions>, visibleCDOs: Array<ChartDataOptions>, heightPerNumeric: number, swimLaneSet: any) {
        let cumulativeOffset = LINECHARTTOPPADDING;
        //initialize to null and set while going through swimLanes
        let visibleGroupEndValues = visibleGroups.map(() => null);

        Object.keys(swimLaneSet).sort((a, b) => (Number(a) <= Number(b) ? -1 : 1)).forEach((swimLane) => {
            // find all numerics and set to cumulative offset/height per non numeric
            let hasNumeric = false;
            visibleGroups.forEach((aggGroup, i) => {
                if (aggGroup.swimLane === Number(swimLane) && aggGroup.dataType === DataTypes.Numeric) {
                    hasNumeric = true;
                    visibleGroupEndValues[i] = [cumulativeOffset, heightPerNumeric];
                }
            });

            // find all non-numerics and set their offset/heights
            let swimLaneOffset = hasNumeric ? heightPerNumeric : 0;
            visibleGroups.forEach((aggGroup, i) => {
                if (aggGroup.swimLane === Number(swimLane) && aggGroup.dataType !== DataTypes.Numeric) {
                    let currGroupsHeight = Utils.getNonNumericHeight(aggGroup.height);
                    visibleGroupEndValues[i] = [swimLaneOffset + cumulativeOffset, currGroupsHeight]
                    swimLaneOffset += currGroupsHeight;
                }
            });
            cumulativeOffset += swimLaneOffset; 
        });
        return visibleGroupEndValues;
    }

    private setSwimLaneYExtents (visibleGroups, visibleCDOs, swimLanes) {
        let extents = {};
        swimLanes.forEach((lane) => {
            let extent = [];
            visibleGroups.forEach((aggGroup) => {
                if (aggGroup.dataType !== DataTypes.Numeric) {
                    return;
                }
                let aggValues = [];
                if (aggGroup.swimLane === lane) {
                    let aggKey = aggGroup.aggKey;
                    Object.keys(this.chartComponentData.visibleTAs[aggKey]).forEach((splitBy) => {
                        aggValues = aggValues.concat(this.chartComponentData.visibleTAs[aggKey][splitBy]);
                    });    
                    let yExtent = this.getYExtent(aggValues, 
                        this.chartComponentData.displayState[aggKey].includeEnvelope ? 
                            this.chartComponentData.displayState[aggKey].includeEnvelope : 
                            this.chartOptions.includeEnvelope, null);
                    extent = d3.extent(yExtent.concat(extent));
                    extents[lane] = extent;
                }
            });
        });
        this.swimlaneYExtents = extents;
    }

    //returns an array of tuples of y offset and height for each visible aggregate group 
    private createYOffsets () {
        let visibleGroups = this.chartComponentData.data.filter((agg) => this.chartComponentData.displayState[agg.aggKey]["visible"]);
        let visibleCDOs = this.aggregateExpressionOptions.filter((cDO) => this.chartComponentData.displayState[cDO.aggKey]["visible"]);

        let visibleNumericCount;
        let swimLaneSet = {};

        visibleCDOs.forEach((aEO, i) => {
            if (aEO.swimLane === null) {
                aEO.swimLane = i + 1;
            }
        });

        visibleCDOs.forEach((cDO) => {
            swimLaneSet[cDO.swimLane] = swimLaneSet[cDO.swimLane] || (cDO.dataType === DataTypes.Numeric);
        });    
        visibleNumericCount = Object.keys(swimLaneSet).reduce((visibleCount, swimLane) => {
            return visibleCount + (swimLaneSet[swimLane] ? 1 : 0);
        }, 0);

        let countNumericLanes = visibleNumericCount;

        let linechartTopPadding = this.chartOptions.isArea ? 0 : LINECHARTTOPPADDING;
        let useableHeight = this.chartHeight - linechartTopPadding;

        let heightNonNumeric = visibleGroups.reduce((sumPrevious, currGroup) => {
            return sumPrevious + (currGroup.dataType !== DataTypes.Numeric ? Utils.getNonNumericHeight(currGroup.height) : 0);
        }, 0);
        
        let heightPerNumeric = (useableHeight - heightNonNumeric) / countNumericLanes;

        this.setSwimLaneYExtents(visibleGroups, visibleCDOs, Object.keys(swimLaneSet).filter((lane) => swimLaneSet[lane]).map((stringLane) => Number(stringLane)));
        return this.getSwimlaneOffsets(linechartTopPadding, visibleGroups, visibleCDOs, heightPerNumeric, swimLaneSet);

    }

    private heightNonNumeric () {
        let visibleGroups = this.chartComponentData.data.filter((agg) => this.chartComponentData.displayState[agg.aggKey]["visible"]);
        return visibleGroups.reduce((sumPrevious, currGroup) => {
            return sumPrevious + (currGroup.dataType !== DataTypes.Numeric ? Utils.getNonNumericHeight(currGroup.height) : 0);
        }, 0);
    }

    private getGroupYExtent (aggKey, aggVisible, aggValues, yExtent) {        
        if ((this.chartOptions.yAxisState === YAxisStates.Shared) || (Object.keys(this.chartComponentData.timeArrays)).length < 2 || !aggVisible) {
            yExtent = this.getYExtent(this.chartComponentData.allNumericValues, this.chartComponentData.displayState[aggKey].includeEnvelope ? 
                        this.chartComponentData.displayState[aggKey].includeEnvelope : 
                        this.chartOptions.includeEnvelope, null);
        } else if (this.chartComponentData.aggHasVisibleSplitBys(aggKey)) {
            yExtent = this.getYExtent(aggValues, this.chartComponentData.displayState[aggKey].includeEnvelope ? 
                this.chartComponentData.displayState[aggKey].includeEnvelope : 
                this.chartOptions.includeEnvelope, aggKey);
        } else {
            yExtent = [0,1];
        }
        return yExtent;
    }

    private getAggAxisType (agg) {
        if (this.chartOptions.yAxisState === YAxisStates.Stacked) {
            if (this.chartOptions.swimLaneOptions && this.chartOptions.swimLaneOptions[agg.swimLane] && this.chartOptions.swimLaneOptions[agg.swimLane].yAxisType) {
                return this.chartOptions.swimLaneOptions[agg.swimLane].yAxisType;
            } else {
                return YAxisStates.Shared;
            }
        }
        return this.chartOptions.yAxisState;
    }

    private adjustSwimLanes () {
        if (this.chartOptions.yAxisState === YAxisStates.Shared || this.chartOptions.yAxisState === YAxisStates.Overlap) {
            this.aggregateExpressionOptions.forEach((aEO) => {
                aEO.swimLane = 0;
            });
            this.chartOptions.swimLaneOptions = {0: {yAxisType: this.chartOptions.yAxisState}};
        } else {
            let minimumPresentSwimLane = this.aggregateExpressionOptions.reduce((currMin, aEO) => {
                return Math.max(aEO.swimLane, currMin); 
            }, 0);
            this.aggregateExpressionOptions.forEach((aEO) => {
                if (aEO.swimLane === null) {
                    aEO.swimLane = ++minimumPresentSwimLane;
                }
            }); 
        }
    }

    private overwriteSwimLanes () {
        this.aggregateExpressionOptions.forEach((aEO, i) => {
            this.aggregateExpressionOptions[i].swimLane = this.originalSwimLanes[i];
        });
        this.chartOptions.swimLaneOptions = this.originalSwimLaneOptions;
    }

    public render (data: any, options: any, aggregateExpressionOptions: any) {
        data = Utils.standardizeTSStrings(data);
        this.data = data;
        this.aggregateExpressionOptions = data.map((d, i) => Object.assign(d, aggregateExpressionOptions && i in aggregateExpressionOptions  ? new ChartDataOptions(aggregateExpressionOptions[i]) : new ChartDataOptions({})));

        this.originalSwimLanes = this.aggregateExpressionOptions.map((aEO) => {
            return aEO.swimLane;
        });
        this.originalSwimLaneOptions = options.swimLaneOptions;

        this.hasBrush = options && (options.brushMoveAction || options.brushMoveEndAction || options.brushContextMenuActions);
        this.chartOptions.setOptions(options);
        this.width = this.getWidth();
        this.height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);
        if (this.chartOptions.legend == "compact")
            this.chartMargins.top = 72;
        else
            this.chartMargins.top = 40;
        
        if (this.chartOptions.hideChartControlPanel) {
            this.chartMargins.top += -28;
        }

        if (!this.chartOptions.brushRangeVisible && this.targetElement) {
            this.deleteBrushRange();
        }

        this.strokeOpacity = this.chartOptions.isArea ? .55 : 1;
        this.nonFocusStrokeOpactiy = this.chartOptions.isArea ? .55 : .3;


        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressionOptions);
        if (this.chartOptions.xAxisHidden && this.chartOptions.focusHidden) {
            this.chartMargins.bottom = 5;
        }

        this.chartHeight = Math.max(1, this.height - this.chartMargins.bottom - this.chartMargins.top); 
        this.chartWidth = this.getChartWidth();

        if (this.brush && this.svgSelection.select('.svgGroup').select(".brushElem") && !this.chartOptions.keepBrush) {
            this.brushStartTime = null;
            this.brushEndTime = null;
            this.clearBrush();
        }
        
        d3.select(this.renderTarget).select(".tsi-tooltip").remove();

        if (!this.chartOptions.hideChartControlPanel && this.chartControlsPanel === null) {
            this.chartControlsPanel = Utils.createControlPanel(this.renderTarget, this.legendWidth + (this.GUTTERWIDTH / 2), Math.max((this.chartMargins.top + 12), 0), this.chartOptions);
            var self = this;
            this.hasStackedButton = true;
            this.stackedButton = this.chartControlsPanel.append("button")
                .style("left", "60px")
                .attr("class", "tsi-stackedButton")
                .attr("aria-label", () => this.getString("set axis state to") + ' ' + this.nextStackedState())
                .attr("title", () => this.getString("Change y-axis type"))
                .attr("type", "button")
                .on("click", function () {
                    self.overwriteSwimLanes();
                    self.render(self.data, {...self.chartOptions, yAxisState: self.nextStackedState()}, self.aggregateExpressionOptions);
                    d3.select(this).attr("aria-label", () => self.getString("set axis state to") + ' ' + self.nextStackedState());
                    setTimeout (() => (d3.select(this).node() as any).focus(), 200);
                });
        } else if (this.chartOptions.hideChartControlPanel && this.chartControlsPanel !== null){
            this.hasStackedButton = false;
            this.removeControlPanel();
        }

        if (this.chartControlsPanel !== null) {
            this.drawEllipsisMenu([{
                iconClass: "flag",
                label: this.getString("Drop a Marker"),
                action: this.addMarker,
                description: ""
            }]);
            this.chartControlsPanel.style("top", Math.max((this.chartMargins.top - 24), 0) + 'px');
        }

        this.adjustSwimLanes();
        
        if(this.svgSelection == null){
            
            /******************** Static Elements *********************************/
            this.targetElement = d3.select(this.renderTarget)
                                .classed("tsi-lineChart", true)
            this.svgSelection = this.targetElement.append("svg")
                                            .attr("class", "tsi-lineChartSVG tsi-chartSVG")
                                            .attr("height", this.height);
             
            var g = this.svgSelection.append("g")
                        .classed("svgGroup", true)
                        .attr("transform", "translate(" + this.chartMargins.left + "," + this.chartMargins.top + ")");
            
            var defs = this.svgSelection.append('defs');
            
            this.brushElem = null; 
            if (this.hasBrush) {
                this.brushElem = g.append("g")
                    .attr("class", "brushElem");
                this.brushElem.classed("hideBrushHandles", !this.chartOptions.brushHandlesVisible);
            } else {
                //if there is no brushElem, the voronoi lives here
                this.voronoiRegion = g.append("rect").classed("voronoiRect", true);
            }
    
            this.focus = g.append("g")
                .attr("transform", "translate(-100,-100)")
                .attr("class", "focus");
            
            this.focus.append("line")
                .attr("class", "focusLine vLine")
                .attr("x1", 0)
                .attr("x2", 0)
                .attr("y1", this.chartOptions.aggTopMargin)
                .attr("y2", this.chartHeight);
            this.focus.append("line")
                .attr("class", "focusLine hLine")
                .attr("x1", 0)
                .attr("x2", this.chartWidth)
                .attr("y1", 0)
                .attr("y2", 0);
    
            this.focus.append("circle")
                .attr("r", 4);
    
            var hHoverG: any = this.focus.append("g")
                .attr("class", 'hHoverG')
                .style("pointer-events", "none")
                .attr("transform", "translate(0," + (this.chartHeight + this.chartOptions.aggTopMargin) + ")");
            var hHoverBox: any = hHoverG.append("rect")
                .style("pointer-events", "none")
                .attr("class", 'hHoverBox')
                .attr("x", 0)
                .attr("y", 4)
                .attr("width", 0)
                .attr("height", 0);
    
            var hHoverText: any = hHoverG.append("text")
                .style("pointer-events", "none")
                .attr("class", "hHoverText")
                .attr("dy", ".71em")
                .attr("transform", "translate(0,6)")
                .text(d => d);

            var hHoverBar: any = hHoverG.append("line")
                .style("pointer-events", "none")
                .attr("class", "hHoverValueBar")
                .attr("x1", 0)
                .attr("x2", 0)
                .attr("y1", 2)
                .attr("y2", 2);

            var vHoverG: any = this.focus.append("g")
                .attr("class", 'vHoverG')
                .attr("transform", "translate(0," + (this.chartHeight + this.chartOptions.aggTopMargin) + ")");
            var vHoverBox: any = vHoverG.append("rect")
                .attr("class", 'vHoverBox')
                .attr("x", -5)
                .attr("y", 0)
                .attr("width", 0)
                .attr("height", 0)
            var vHoverText: any = vHoverG.append("text")
                .attr("class", "vHoverText")
                .attr("dy", ".32em")
                .attr("x", -10)
                .text(d => d);
    
            this.tooltip = new Tooltip(d3.select(this.renderTarget));                        

            this.draw = (isFromResize = false) => {  
                this.minBrushWidth = (this.chartOptions.minBrushWidth) ? this.chartOptions.minBrushWidth : this.minBrushWidth;
                this.focus.attr("visibility", (this.chartOptions.focusHidden) ? "hidden" : "visible")
                if (this.chartOptions.xAxisHidden && this.chartOptions.focusHidden) {
                    this.chartMargins.bottom = 5;
                }

                this.width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
                if (!isFromResize) {
                    this.chartWidth = this.getChartWidth();
                }
                this.height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);
                this.chartHeight = Math.max(1, this.height - this.chartMargins.bottom - this.chartMargins.top); 

                g.attr("transform", "translate(" + this.chartMargins.left + "," + this.chartMargins.top + ")");

                if (this.brushElem) {
                    this.brushElem.classed("hideBrushHandles", !this.chartOptions.brushHandlesVisible);
                }

                this.focus.select('.hLine').attr("x2", this.chartWidth);
                this.focus.select('.vLine').attr("y2", this.chartHeight);
                this.svgSelection
                    .style("width", this.getSVGWidth() + "px")
                    .style("height", this.height + "px");
                     
                super.themify(this.targetElement, this.chartOptions.theme);

                
                if (!isFromResize) {
                    this.legendObject.draw(this.chartOptions.legend, this.chartComponentData, (aggKey, splitBy) => { this.labelMouseover(aggKey, splitBy); }, 
                    this.svgSelection, this.chartOptions, () => {
                     d3.select(this.renderTarget).selectAll(".tsi-scooterValue")
                         .style("opacity", 1);
                    }, this.stickySeries);
                }        

                this.svgSelection.selectAll('.valueElement').style("visibility", "hidden");
                this.svgSelection.selectAll(".yAxis").style("visibility", "hidden");    

                this.x = d3.scaleTime()
                            .rangeRound([this.xOffset, Math.max(this.xOffset, this.chartWidth - (2 * this.xOffset))]);
        
                this.y = d3.scaleLinear()
                        .range([Math.max(this.chartHeight - this.heightNonNumeric(), this.chartOptions.aggTopMargin) - LINECHARTTOPPADDING, this.chartOptions.aggTopMargin]);

                var fromAndTo: any = this.chartComponentData.setAllValuesAndVisibleTAs();
                var xExtent: any = (this.chartComponentData.allValues.length != 0) ? d3.extent(this.chartComponentData.allValues, (d: any) => d.dateTime) : [0,1];
                var timeSet = d3.set(this.chartComponentData.allValues, (d: any) => d.dateTime);
                var xRange = (this.chartComponentData.allValues.length != 0) ? Math.max(2, (xExtent[1].valueOf() - xExtent[0].valueOf())) : 2;
                var xOffsetPercentage = this.xOffset / this.chartWidth;
                if (this.chartOptions.timeFrame) {
                    fromAndTo = [new Date(this.chartOptions.timeFrame[0]), new Date(this.chartOptions.timeFrame[1])];
                }
                this.x.domain(fromAndTo);
                this.xLowerBound = this.x(fromAndTo[0]);
                this.xUpperBound = this.x(fromAndTo[1]);

                //allPossibleTimes -> a combination of the beginning and end of buckets
                this.chartComponentData.setTimeMap();
                var startOfBuckets = this.chartComponentData.allValues.map((d: any) => d.dateTime);
                var endOfBuckets = this.chartComponentData.allValues.filter((d: any) => {return d.bucketSize != null})
                                        .map((d: any) => {return new Date(d.dateTime.valueOf() + d.bucketSize)});
                var allPossibleTimes = startOfBuckets.concat(endOfBuckets);
                var timeSet = d3.set(allPossibleTimes);
                this.possibleTimesArray = timeSet.values().sort().map((ts: string) => {
                    return new Date(ts);
                });

                if (this.voronoiRegion) {
                    this.voronoiRegion.attr("x", xOffsetPercentage * this.chartWidth)
                        .attr("y", this.chartOptions.aggTopMargin)
                        .attr("width", this.chartWidth - (xOffsetPercentage * this.chartWidth * 2))
                        .attr("height", this.chartHeight);
                }

                if (this.brushElem) {
                    var self = this;
                    this.brush = d3.brushX()
                    .extent([[this.xLowerBound, this.chartOptions.aggTopMargin],
                             [this.xUpperBound, this.chartHeight]])
                    .on("start", function() {
                        if (self.activeScooter != null && self.isDroppingScooter) {
                            self.voronoiClick(this);
                        }
                        var handleHeight = self.getHandleHeight();
                        self.brushElem.selectAll('.handle')
                            .attr('height', handleHeight)
                            .attr('y', (self.chartHeight - handleHeight) / 2)
                            .attr('rx', '4px')
                            .attr('ry', '4px');
                    })
                    .on("brush", function () { 
                        self.brushBrush(); 
                        self.drawBrushRange();
                    })
                    .on("end", function () { 
                        self.brushEnd(this);
                        self.drawBrushRange();
                    });
                    this.brushElem.call(this.brush);
                    this.setBrush();
                }

                var yExtent: any = this.getYExtent(this.chartComponentData.allValues, false, null);
                var yRange = (yExtent[1] - yExtent[0]) > 0 ? yExtent[1] - yExtent[0] : 1;
                var yOffsetPercentage = this.chartOptions.isArea ? (1.5 / this.chartHeight) : (10 / this.chartHeight);
                this.y.domain([yExtent[0] - (yRange * yOffsetPercentage), yExtent[1] + (yRange * (10 / this.chartHeight))]);

                if (this.chartOptions.isArea) {
                    this.areaPath = d3.area()
                        .curve(this.chartOptions.interpolationFunction)
                        .defined( (d: any) => { 
                            return (d.measures !== null) && 
                                    (d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)] !== null);
                        })
                        .x((d: any) => {
                            return this.getXPosition(d, this.x);
                        })
                        .y0((d: any) => { 
                            return d.measures ? this.y(d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)]) : 0;
                        })
                        .y1(this.chartHeight);
                }
                    
                if (!this.chartOptions.xAxisHidden) {
                    this.xAxis = g.selectAll(".xAxis").data([this.x]);
                    this.drawXAxis(this.chartHeight);
                    this.xAxis.exit().remove();

                    var xAxisBaseline =  g.selectAll(".xAxisBaseline").data([this.x]);
                    var xAxisBaselineEntered = xAxisBaseline.enter().append("line")
                        .attr("class", "xAxisBaseline")
                        .attr("x1", .5)
                        .merge(xAxisBaseline)
                        .attr("y2", this.chartHeight + .5)
                        .attr("y1", this.chartHeight + .5)
                        .attr("x2", this.chartWidth - this.xOffset);
                    xAxisBaseline.exit().remove();
                }
                if (g.selectAll(".xAxis").size() !== 0) {
                    g.selectAll(".xAxis").style("visibility", ((!this.chartOptions.xAxisHidden) ? "visible" : "hidden"));
                }

            
                /******************** Draw Line and Points ************************/
                this.visibleAggCount = Object.keys(this.chartComponentData.timeArrays).reduce((count: number, aggKey: string): number => {
                    return count + (this.chartComponentData.displayState[aggKey]['visible'] ? 1 : 0);
                }, 0);
    
                this.yMap = {};
                this.colorMap = {};
                this.svgSelection.selectAll(".yAxis").remove();

                let visibleGroupData = this.chartComponentData.data.filter((agg) => this.chartComponentData.displayState[agg.aggKey]["visible"]);
                let visibleCDOs = this.aggregateExpressionOptions.filter((cDO) => {
                    return this.chartComponentData.displayState[cDO.aggKey]["visible"];
                });
                let offsetsAndHeights = this.createYOffsets();

                let swimLaneCounts = {};

                let aggregateGroups = this.svgSelection.select('.svgGroup').selectAll('.tsi-aggGroup')
                    .data(visibleGroupData, (agg) => agg.aggKey);
                    var self = this;

                    let visibleNumericI = 0;
                    aggregateGroups.enter()
                        .append('g')
                        .classed('tsi-aggGroup', true)
                        .merge(aggregateGroups)
                        .transition()
                        .duration((this.chartOptions.noAnimate) ? 0 : self.TRANSDURATION)            
                        .ease(d3.easeExp)                                         
                        .attr('transform', (agg, i) => {
                            return self.chartOptions.isArea ? null : 'translate(0,' + offsetsAndHeights[i][0] + ')';
                        })
                        .each(function (agg, i) {
                            let yExtent ;
                            let aggVisible = true;
                            var aggValues: Array<any> = [];
                            let aggKey = agg.aggKey;
                            Object.keys(self.chartComponentData.visibleTAs[aggKey]).forEach((splitBy) => {
                                aggValues = aggValues.concat(self.chartComponentData.visibleTAs[aggKey][splitBy]);
                            });

                            yExtent = self.getGroupYExtent(aggKey, aggVisible, aggValues, yExtent);

                            if (self.plotComponents[aggKey] === undefined || self.mismatchingChartType(aggKey)) {
                                let g = d3.select(this);
                                delete self.plotComponents[aggKey];
                                g.selectAll('*').remove();
                                self.plotComponents[aggKey] = self.createPlot(g, i, visibleCDOs);
                            }

                            let mouseoverFunction = self.getMouseoverFunction(visibleCDOs[i].dataType);
                            let mouseoutFunction = self.getMouseoutFunction(visibleCDOs[i].dataType);
                            let positionInGroup = visibleNumericI;
                            if (self.getAggAxisType(agg) === YAxisStates.Shared) {
                                yExtent = self.swimlaneYExtents[agg.swimLane];
                            }

                            //should count all as same swim lane when not in stacked.
                            let swimLane = agg.swimLane;
                            let offsetImpact = (agg.dataType === DataTypes.Numeric) ? 1 : 0;
                            if (swimLaneCounts[swimLane]) {
                                positionInGroup = swimLaneCounts[swimLane];
                                swimLaneCounts[swimLane] += offsetImpact;
                            } else {
                                positionInGroup = 0;
                                swimLaneCounts[swimLane] = offsetImpact;
                            }

                            let axisState = new AxisState(self.getAggAxisType(agg), yExtent, positionInGroup);

                            self.plotComponents[aggKey].render(self.chartOptions, visibleNumericI, agg, true, d3.select(this), self.chartComponentData, axisState, 
                                self.chartHeight, self.visibleAggCount, self.colorMap, self.previousAggregateData, 
                                self.x, self.areaPath, self.strokeOpacity, self.y, self.yMap, defs, visibleCDOs[i], self.previousIncludeDots, offsetsAndHeights[i], 
                                g, mouseoverFunction, mouseoutFunction);
                            
                            //increment index of visible numerics if appropriate
                            visibleNumericI += (visibleCDOs[i].dataType === DataTypes.Numeric ? 1 : 0);
                        });
                    aggregateGroups.exit().remove();
                    /******************** Voronoi diagram for hover action ************************/

                    this.voronoi = d3.voronoi()
                        .x(function(d: any) {
                            return (d.bucketSize != undefined ? self.x(new Date(d.dateTime.valueOf() + (d.bucketSize / 2))) : self.x(d.dateTime))})
                        .y(function(d: any) { 
                            if (d.measures) {
                                return self.yMap[d.aggregateKey] ? self.yMap[d.aggregateKey](self.getValueOfVisible(d)) : null;
                            }
                            return null;
                        })
                        .extent([[0, 0], [this.chartWidth, this.chartHeight]]);

                    //if brushElem present then use the overlay, otherwise create a rect to put the voronoi on
                    var voronoiSelection = (this.brushElem ? this.brushElem.select(".overlay") : this.voronoiRegion);
                    
                    voronoiSelection.on("mousemove", function () {
                        let mouseEvent = d3.mouse(this);
                        self.voronoiMousemove(mouseEvent);
                    })
                    .on("mouseover", function () {
                        if (!self.isDroppingScooter) {
                            self.svgSelection.selectAll(".valueElement")
                                .filter(function () {
                                    return !d3.select(this).classed('tsi-categoricalBucket');
                                })
                                .attr("stroke-opacity", self.nonFocusStrokeOpactiy)
                                .attr("fill-opacity", .3);
                            self.svgSelection.selectAll(".valueEnvelope")
                                .attr("fill-opacity", .1);
                        }
                    })
                    .on("mouseout", function (d)  {
                        if (!self.filteredValueExist() || !self.voronoiExists()) return;
                        const [mx, my] = d3.mouse(this);
                        const site = self.voronoiDiagram.find(mx, my);
                        self.voronoiMouseout(site.data); 
                        self.chartOptions.onMouseout();
                        if (self.tooltip)
                            self.tooltip.hide();
                    })
                    .on("contextmenu", function (d) {
                        self.voronoiContextMenu(this);
                    })
                    .on("click", function (d) {
                       self.voronoiClick(this);
                    });

                    if (this.brushElem) {
                        this.brushElem.selectAll(".selection, .handle").on("contextmenu", function (d) {
                            if (!self.chartOptions.brushContextMenuActions || self.chartOptions.brushContextMenuActions.length == 0 || self.chartOptions.autoTriggerBrushContextMenu)
                                return;
                            var mousePosition = d3.mouse(<any>self.targetElement.node());
                            d3.event.preventDefault();
                            self.brushContextMenu.draw(self.chartComponentData, self.renderTarget, self.chartOptions, 
                                                mousePosition, null, null, null, self.brushStartTime, self.brushEndTime);
                        });
                        this.brushElem.selectAll('.selection')
                            .attr('stroke', this.chartOptions.color ? this.chartOptions.color : 'none')
                            .attr('fill', this.chartOptions.color ? this.chartOptions.color : 'grey');

                        var handleHeight = self.getHandleHeight();
                        this.brushElem.selectAll('.handle')
                            .attr('fill', this.chartOptions.color ? this.chartOptions.color : 'grey')
                            .attr('height', handleHeight)
                            .attr('y', (this.chartHeight - handleHeight) / 2);
                    }

                /******************** Stack/Unstack button ************************/
                if (this.hasStackedButton) {
                    this.stackedButton.style("opacity",  () => {
                        if (this.chartOptions.yAxisState === YAxisStates.Stacked) return 1;
                        if (this.chartOptions.yAxisState === YAxisStates.Shared) return .6;
                        return .3;
                    })
                    .style("display", this.visibleAggCount < 2 ? "none" : "block")
                    .classed('tsi-lightTheme', this.chartOptions.theme == 'light')
                    .classed('tsi-darkTheme', this.chartOptions.theme == 'dark');
                }

                let timeFrame = (this.chartOptions.timeFrame) ? this.chartOptions.timeFrame : this.x.domain();

                if (!this.chartOptions.hideChartControlPanel && this.chartControlsPanel !== null) {
                    this.chartControlsPanel.style("width", this.calcSVGWidth() + "px")
                }

                if (Object.keys(this.chartComponentData.timeMap).length == 0) {
                    d3.select(this.renderTarget).selectAll(".tsi-scooterContainer").style("display", "none");
                } else {
                    d3.select(this.renderTarget).selectAll(".tsi-scooterContainer").style("display", "block");
                }
                this.updateScooterPresentation();
                this.voronoiDiagram = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues));
            }

            this.legendObject = new Legend(this.draw, this.renderTarget, this.legendWidth);
            this.contextMenu = new ContextMenu(this.draw, this.renderTarget);
            this.brushContextMenu = new ContextMenu(this.draw, this.renderTarget);
            window.addEventListener("resize", () => {
                var self = this;
                if (!this.chartOptions.suppressResizeListener) {
                    this.draw();
                    d3.select(this.renderTarget).selectAll(".tsi-scooterContainer").each(function () {
                        self.setScooterPosition(d3.select(this));
                    });
                }
            });
        }

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(this.data, this.aggregateExpressionOptions);
        this.draw();
        this.gatedShowGrid();
        this.chartOptions.noAnimate = false;  // ensure internal renders are always animated, overriding the users noAnimate option

        if (this.chartOptions.markers && this.chartOptions.markers.length > 0) {
            this.importMarkers();
        }

        d3.select("html").on("click." + Utils.guid(), () => {
            if (this.ellipsisContainer && d3.event.target != this.ellipsisContainer.select(".tsi-ellipsisButton").node()) {
                this.ellipsisMenu.setMenuVisibility(false);
            }
        });

        if (this.chartOptions.legend === 'shown') {
            this.splitLegendAndSVG(this.svgSelection.node(), () => {                
                this.updateBrushRange();
            });
            this.setControlsPanelWidth();
        }
    }

    private createPlot (svgGroup, i, cDO) {
        let chartType = cDO[i].dataType;
        if (chartType === DataTypes.Numeric) {
            return new LinePlot(svgGroup);
        } else if (chartType === DataTypes.Categorical) {
            return new CategoricalPlot(svgGroup);
        } else if (chartType === DataTypes.Events) {
            return new EventsPlot(svgGroup);
        }
        return null;
    }
}
export {LineChart}