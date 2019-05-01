import * as d3 from 'd3';
import { interpolatePath } from 'd3-interpolate-path';
import './LineChart.scss';
import {Utils} from "./../../Utils";
import {Legend} from "./../Legend/Legend";
import {EventSeries} from "./../EventSeries/EventSeries";
import {ChartComponent} from "./../../Interfaces/ChartComponent";
import {StateSeries} from "../StateSeries/StateSeries";
import {LineChartData} from "./../../Models/LineChartData";
import { ContextMenu } from '../ContextMenu/ContextMenu';
import { Tooltip } from '../Tooltip/Tooltip';
import { ChartOptions } from '../../Models/ChartOptions';
import { EllipsisMenu } from '../EllipsisMenu/EllipsisMenu';
import { ChartDataOptions } from '../../Models/ChartDataOptions';

class LineChart extends ChartComponent {
    private svgSelection: any;
    private targetElement: any;
    private legendObject: Legend;
    private focus: any;
    private contextMenu: ContextMenu;
    private brushContextMenu: ContextMenu;
    private setDisplayStateFromData: any;
    private width: number;
    private chartWidth: number;
    private chartHeight: number;
    public draw: any;
    private events: any;
    private states: any;
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
    public x: any;
    private xLowerBound: number;
    private xUpperBound: number;
    private y: any;
    private yMap: any;
    private timelineHeight: number;
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
    private mx = null;
    private my = null;
    private focusedAggKey: string = null;
    private focusedSplitby: string = null;

    private isFirstMarkerDrop = true;
    
    public chartMargins: any = {        
        top: 40,
        bottom: 40,
        left: 70, 
        right: 60
    };
    private xOffset = 8;

    constructor(renderTarget: Element){
        super(renderTarget);
        this.MINHEIGHT = 26;
    }

    LineChart() { 
    }

    public getXTickNumber (singleLineXAxisLabel) {
        return (singleLineXAxisLabel ? Math.floor(this.chartWidth / 300) :  Math.floor(this.chartWidth / 160));
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
    
    //create xAxis is public so that users of linechart can programmatically change the axis labels
    public createXAxis (singleLineXAxisLabel) {
        return d3.axisBottom(this.x)
            .ticks(this.getXTickNumber(singleLineXAxisLabel))
            .tickFormat(Utils.timeFormat(this.labelFormatUsesSeconds(), this.labelFormatUsesMillis(), this.chartOptions.offset, this.chartOptions.is24HourTime));
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
        if (this.chartOptions.yAxisState == "overlap") {
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
            .html("Click to drop marker, drag to reposition."); 
    }

    private destroyMarkerInstructions () {
        this.targetElement.selectAll(".tsi-markerInstructions").remove();
    }   
    
    private tooltipFormat (d, text) {
        var title = d.aggregateName;   
        
        text.append("div")
            .attr("class", "title")
            .text(d.aggregateName);

        if (d.splitBy && d.splitBy != ""){
            text.append("div")
                .attr("class", "value")
                .text(d.splitBy);
        }
                                
        Object.keys(d.measures).forEach((measureType, i) => {
            text.append("div")
                .attr("class",  () => {
                    return "value" + (measureType == this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy) ? 
                                    " visibleValue" : "");
                })
                .text(measureType + ": " + Utils.formatYAxisNumber(d.measures[measureType]));
        });
    }

    private voronoiMouseover = (d: any) => {
        //supress if the context menu is visible
        if (this.contextMenu && this.contextMenu.contextMenuVisible)
            return;

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
            .attr("transform", "translate(0," + (this.chartHeight + this.timelineHeight - yPos) + ")");
        var text = this.focus.select('.hHoverG').select("text").text("");

        var bucketSize = this.chartComponentData.displayState[d.aggregateKey].bucketSize;
        var endValue = bucketSize ? (new Date(xValue.valueOf() + bucketSize)) : null;
        
        text.append("tspan").text(Utils.timeFormat(false, false, this.chartOptions.offset, this.chartOptions.is24HourTime)(xValue))
            .attr("x", 0)
            .attr("y", 4);
        if (endValue) {
            text.append("tspan").text(Utils.timeFormat(false, false, this.chartOptions.offset, this.chartOptions.is24HourTime)(endValue))
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
                this.tooltipFormat(d, text);
            });
        }
        else 
            this.tooltip.hide();
        
        (<any>this.focus.node()).parentNode.appendChild(this.focus.node());
        this.legendObject.triggerSplitByFocus(d.aggregateKey, d.splitBy);

        /** update the y axis for in focus aggregate */
        if (this.chartOptions.yAxisState == "overlap") {
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

        this.labelMouseover(d.aggregateKey, d.splitBy);
        this.chartOptions.onMouseover(d.aggregateKey, d.splitBy);
    }

    //get the extent of an array of timeValues
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
            return (d.measures && this.getValueOfVisible(d) != null);
        });
    }

    private getFilteredAndSticky (aggValues) { //getFilteredValues, then filter by sticky
        var filteredValues = this.getFilteredValues(aggValues);
        if (this.chartComponentData.stickiedKey == null)
            return filteredValues;
        var stickiedValues = filteredValues.filter((d: any) => {
            return d.aggregateKey == this.chartComponentData.stickiedKey.aggregateKey &&
                ((this.chartComponentData.stickiedKey.splitBy == null) ? true : 
                d.splitBy == this.chartComponentData.stickiedKey.splitBy);
        });
        return stickiedValues;
    }

    public stickySeries  = (aggregateKey: string, splitBy: string = null) => {
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
    }

    private getHandleHeight (): number {
        return Math.min(Math.max(this.chartHeight / 2, 24), this.chartHeight + 8);
    }

    private labelFormatUsesSeconds () {
        return !this.chartOptions.minutesForTimeLabels && this.chartComponentData.usesSeconds;
    }

    private labelFormatUsesMillis () {
        return !this.chartOptions.minutesForTimeLabels && this.chartComponentData.usesMillis;
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
        return this.chartMargins.left + (this.chartOptions.legend == "shown" || this.chartOptions.legend == "hidden" ? legendWidth : 0);
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
            this.chartOptions.offset, this.chartOptions.is24HourTime);
        var dateToTime = (t) => timeFormat(t).split(" ")[1];
        var text = dateToTime(firstValue) + " - " + dateToTime(secondValue);
        var timeLabel = scooter.select(".tsi-scooterTimeLabel");
        let self = this;
        timeLabel.html(text)
            .append("button")
            .attr("aria-label", "Delete marker at " + text) 
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
        values = values.filter((d) => this.getValueOfVisible(d) != null );
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
                    .html(() => Utils.formatYAxisNumber(self.getValueOfVisible(d)))
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

    private scooterButtonClick = () => {
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

    private voronoiMousemove (mouseEvent) {
        if (!this.filteredValueExist()) return;
        this.mx = mouseEvent[0];
        this.my = mouseEvent[1];
        const [mx, my] = mouseEvent;
      
        var filteredValues = this.getFilteredAndSticky(this.chartComponentData.allValues);
        if (filteredValues == null || filteredValues.length == 0)
            return;
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
        if (!this.filteredValueExist()) return;
        const [mx, my] = d3.mouse(mouseEvent);
        const site: any = this.voronoiDiagram.find(mx, my);
        if (this.chartComponentData.displayState[site.data.aggregateKey].contextMenuActions && 
            this.chartComponentData.displayState[site.data.aggregateKey].contextMenuActions.length) {
            var mousePosition = d3.mouse(<any>this.targetElement.node());
            d3.event.preventDefault();
            this.contextMenu.draw(this.chartComponentData, this.renderTarget, this.chartOptions, 
                                mousePosition, site.data.aggregateKey, site.data.splitBy, null,
                                site.data.dateTime);
            if (this.brushContextMenu) {
                this.brushContextMenu.hide();
            }
            this.voronoiMouseover(site.data);
        }
    }

    private voronoiClick (mouseEvent) {
        if (!this.filteredValueExist()) return;
        if (this.brushElem && !this.isDroppingScooter) return;
        const [mx, my] = d3.mouse(mouseEvent);
        var site: any = this.voronoiDiagram.find(mx, my);
        if (!this.isDroppingScooter) {
            if (this.chartComponentData.stickiedKey != null) {
                this.chartComponentData.stickiedKey = null;
                (<any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel')).classed("stickied", false);
                // recompute voronoi with no sticky
                this.voronoiDiagram = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues));
                site = this.voronoiDiagram.find(mx, my);
                this.voronoiMousemove(site.data);
                this.chartOptions.onUnsticky(site.data.aggregateKey, site.data.splitBy)
                return;
            }
            this.stickySeries(site.data.aggregateKey, site.data.splitBy);
            this.chartOptions.onSticky(site.data.aggregateKey, site.data.splitBy);    
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

        if (!d3.event.sourceEvent) return;
        if (d3.event.sourceEvent && d3.event.sourceEvent.type == 'mousemove') {
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
                this.chartOptions.onSticky(site.data.aggregateKey, site.data.splitBy);
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

    private labelMouseover (aggregateKey: string, splitBy: string = null) {
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

        d3.select(this.renderTarget).selectAll(".tsi-scooterValue").style("opacity", 1);

        d3.select(this.renderTarget).selectAll(".tsi-scooterValue")
            .filter(selectedFilter)
            .style("opacity", .2);
        
        d3.select(this.renderTarget).selectAll(".tsi-scooterContainer").each(function () {
            d3.select(this).selectAll(".tsi-scooterValue").sort(function (a: any, b: any) { 
                return (a.aggregateKey == aggregateKey && (splitBy == null || splitBy == a.splitBy)) ? 1 : -1;            
            });
        });
    }

    // returns the next visibleAggI
    private generateLine = (visibleAggI, agg, aggVisible: boolean, aggregateGroup) => {
        var defs = this.svgSelection.select("defs");
        var aggKey = agg.aggKey;
        var aggY;
        var aggLine;
        var aggEnvelope;
        var aggGapLine;
        var yExtent;

        let overwriteYRange = null;
        if ((this.chartOptions.yAxisState == "shared") || (Object.keys(this.chartComponentData.timeArrays)).length < 2 || !aggVisible) {
            yExtent = this.getYExtent(this.chartComponentData.allValues, this.chartComponentData.displayState[aggKey].includeEnvelope ? this.chartComponentData.displayState[aggKey].includeEnvelope : this.chartOptions.includeEnvelope, null);
            var yRange = (yExtent[1] - yExtent[0]) > 0 ? yExtent[1] - yExtent[0] : 1;
            var yOffsetPercentage = this.chartOptions.isArea ? (1.5 / this.chartHeight) : (10 / this.chartHeight);
            this.y.domain([yExtent[0] - (yRange * yOffsetPercentage), yExtent[1] + (yRange * (10 / this.chartHeight))]);
            aggY = this.y;
            aggLine = d3.line()
                    .curve(this.chartComponentData.displayState[aggKey].interpolationFunction ? d3[this.chartComponentData.displayState[aggKey].interpolationFunction] : this.chartOptions.interpolationFunction)
                    .defined( (d: any) => { 
                        return (d.measures !== null) && 
                                (d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)] !== null);
                    })
                    .x((d: any) => {
                        return this.getXPosition(d, this.x);
                    })
                    .y((d: any) => { 
                        return d.measures ? this.y(d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)]) : 0;
                    });
            aggGapLine = null;
            aggEnvelope = d3.area()
                        .curve(this.chartComponentData.displayState[aggKey].interpolationFunction ? d3[this.chartComponentData.displayState[aggKey].interpolationFunction] : this.chartOptions.interpolationFunction)
                        .defined( (d: any) => { 
                            return (d.measures !== null) && (d.measures['min'] !== null) && (d.measures['max'] !== null);
                        })
                        .x((d: any) => {
                            return this.getXPosition(d, this.x);
                        })
                        .y0((d: any) => { 
                            return d.measures ? this.y(d.measures['max']) : 0;
                        })
                        .y1((d: any) => { 
                            return d.measures ? this.y(d.measures['min']) : 0;
                        });
        } else {
            var aggValues: Array<any> = [];
            Object.keys(this.chartComponentData.visibleTAs[aggKey]).forEach((splitBy) => {
                aggValues = aggValues.concat(this.chartComponentData.visibleTAs[aggKey][splitBy]);
            });
            aggY = d3.scaleLinear();
            if (this.chartOptions.yAxisState == "overlap") {
                aggY.range([this.chartHeight, this.chartOptions.aggTopMargin]);
            } else {
                overwriteYRange = [(this.chartHeight / this.visibleAggCount) * (visibleAggI + 1), 
                    (this.chartHeight / this.visibleAggCount) * (visibleAggI) + this.chartOptions.aggTopMargin];
                aggY.range([(this.chartHeight / this.visibleAggCount), this.chartOptions.aggTopMargin]);
            }
            if (this.chartComponentData.aggHasVisibleSplitBys(aggKey)) {
                yExtent = this.getYExtent(aggValues, this.chartComponentData.displayState[aggKey].includeEnvelope ? this.chartComponentData.displayState[aggKey].includeEnvelope : this.chartOptions.includeEnvelope, aggKey);
                var yRange = (yExtent[1] - yExtent[0]) > 0 ? yExtent[1] - yExtent[0] : 1;
                var yOffsetPercentage = 10 / (this.chartHeight / ((this.chartOptions.yAxisState == "overlap") ? 1 : this.visibleAggCount));
                aggY.domain([yExtent[0] - (yRange * yOffsetPercentage), 
                        yExtent[1] + (yRange * yOffsetPercentage)]);
            } else {
                aggY.domain([0,1]);
                yExtent = [0, 1];
            }
            aggLine = d3.line()
                .curve(this.chartComponentData.displayState[aggKey].interpolationFunction ? d3[this.chartComponentData.displayState[aggKey].interpolationFunction] : this.chartOptions.interpolationFunction)
                .defined((d: any) =>  {
                    return (d.measures !== null) && 
                            (d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)] !== null);
                })
                .x((d: any) => this.getXPosition(d, this.x))
                .y((d: any) => {                 
                    return d.measures ? aggY(d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)]) : null;
                });

            aggEnvelope = d3.area()
                .curve(this.chartComponentData.displayState[aggKey].interpolationFunction ? d3[this.chartComponentData.displayState[aggKey].interpolationFunction] : this.chartOptions.interpolationFunction)
                .defined((d: any) => (d.measures !== null) && (d.measures['min'] !== null) && (d.measures['max'] !== null))
                .x((d: any) => this.getXPosition(d, this.x))
                .y0((d: any) => d.measures ? aggY(d.measures['max']) : 0)
                .y1((d: any) => d.measures ? aggY(d.measures['min']) : 0);

            aggGapLine = aggLine;
        }

        let localY = aggY.copy();
        if (overwriteYRange !== null) {
            localY.range(overwriteYRange)
        } 
        this.yMap[aggKey] = localY;
        
        var yAxis: any = aggregateGroup.selectAll(".yAxis")
                        .data([aggKey]);
        var visibleYAxis = (aggVisible && (this.chartOptions.yAxisState != "shared" || visibleAggI == 0));
        
        yAxis = yAxis.enter()
            .append("g")
            .attr("class", "yAxis")
            .merge(yAxis)
            .style("visibility", ((visibleYAxis && !this.chartOptions.yAxisHidden) ? "visible" : "hidden"));
        if (this.chartOptions.yAxisState == "overlap" && this.visibleAggCount > 1) {
            yAxis.call(d3.axisLeft(aggY).tickFormat(Utils.formatYAxisNumber).tickValues(yExtent))
                .selectAll("text")
                .attr("y", (d, j) => {return (j == 0) ? (-visibleAggI * 16) : (visibleAggI * 16) })
                .style("fill", this.chartComponentData.displayState[aggKey].color);
        }
        else {
            yAxis.call(d3.axisLeft(aggY).tickFormat(Utils.formatYAxisNumber)
                .ticks(Math.max(2, Math.ceil(this.chartHeight/(this.chartOptions.yAxisState == 'stacked' ? this.visibleAggCount : 1)/90))))
                .selectAll("text").classed("standardYAxisText", true)
        }
        yAxis.exit().remove();
        
        var guideLinesData = {
            x: this.x,
            y: aggY,
            visible: visibleYAxis
        };
        let splitByColors = Utils.createSplitByColors(this.chartComponentData.displayState, aggKey, this.chartOptions.keepSplitByColor);

        let includeDots = this.chartOptions.includeDots || this.chartComponentData.displayState[aggKey].includeDots;

        let self = this;        
        let splitByGroups = aggregateGroup.selectAll(".tsi-splitByGroup")
            .data(Object.keys(this.chartComponentData.timeArrays[aggKey]));
        splitByGroups.enter()
            .append("g")
            .attr("class", "tsi-splitByGroup " + agg.aggKey)
            .merge(splitByGroups)
            .each(function (splitBy, j) {
                self.colorMap[aggKey + "_" + splitBy] = splitByColors[j];
                // creation of segments between each gap in the data
                var segments = [];
                var lineData = self.chartComponentData.timeArrays[aggKey][splitBy];
                var visibleMeasure = self.chartComponentData.getVisibleMeasure(aggKey, splitBy);
                for (var i = 0; i < lineData.length - 1; i++) {
                    if (lineData[i].measures !== null && lineData[i].measures[visibleMeasure] !== null) {
                        var scannerI: number = i + 1;
                        while(scannerI < lineData.length && ((lineData[scannerI].measures == null) || 
                                                                lineData[scannerI].measures[visibleMeasure] == null)) {
                            scannerI++;
                        }
                        if (scannerI < lineData.length && scannerI != i + 1) {
                            segments.push([lineData[i], lineData[scannerI]]);
                        }
                        i = scannerI - 1;
                    }
                }

                var durationFunction = (d) => {
                    let previousUndefined = self.previousAggregateData.get(this) === undefined;
                    return (self.chartOptions.noAnimate || previousUndefined) ? 0 : self.TRANSDURATION
                }

                var gapPath = d3.select(this).selectAll(".gapLine")
                    .data(segments);
                gapPath.enter()
                    .append("path")
                    .attr("class", "valueElement gapLine")
                    .merge(gapPath)
                    .style("visibility", (d: any) => { 
                        return (self.chartComponentData.isSplitByVisible(aggKey, splitBy)) ? "visible" : "hidden";
                    })   
                    .transition()
                    .duration(durationFunction)
                    .ease(d3.easeExp)                                         
                    .attr("stroke-dasharray","5,5")      
                    .attr("stroke", splitByColors[j])
                    .attrTween('d', function (d) {
                        var previous = d3.select(this).attr('d');
                        var current = aggLine(d);
                        return interpolatePath(previous, current);
                    });

                var path = d3.select(this).selectAll(".valueLine")
                    .data([self.chartComponentData.timeArrays[aggKey][splitBy]]);

                path.enter()
                    .append("path")
                    .attr("class", "valueElement valueLine")
                    .merge(path)
                    .style("visibility", (d: any) => { 
                        return (self.chartComponentData.isSplitByVisible(aggKey, splitBy)) ? "visible" : "hidden";
                    })                                            
                    .transition()
                    .duration(durationFunction)
                    .ease(d3.easeExp)
                    .attr("stroke", splitByColors[j])
                    .attr("stroke-opacity", self.strokeOpacity)
                    .attrTween('d', function (d) {
                        var previous = d3.select(this).attr('d');
                        var current = aggLine(d);
                        return interpolatePath(previous, current);
                    });

                if (self.chartOptions.includeDots || self.chartComponentData.displayState[aggKey].includeDots) {
                    let dots = d3.select(this).selectAll(".valueDot")
                        .data(self.chartComponentData.timeArrays[aggKey][splitBy].filter((d) => {
                            return d && d.measures && d.measures[self.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)] !== null;
                        }), (d: any, i) => {
                            return d.dateTime.toString();
                        });

                    dots.enter()
                        .append('circle')
                        .attr('class', 'valueElement valueDot')
                        .attr('r', 3)
                        .merge(dots)
                        .style("visibility", (d: any) => { 
                            return (self.chartComponentData.isSplitByVisible(aggKey, splitBy) && d.measures) ? "visible" : "hidden";
                        }) 
                        .transition()
                        .duration(function (d, i) {
                            return (self.previousIncludeDots.get(this) === true) ? durationFunction(d) : 0;
                        })
                        .ease(d3.easeExp)
                        .attr("fill", splitByColors[j])
                        .attr('cx', (d: any) => self.getXPosition(d, self.x))
                        .attr('cy', (d: any) => {     
                            return d.measures ? aggY(d.measures[self.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)]) : null;
                        })
                        .each(function () {
                            self.previousIncludeDots.set(this, includeDots);
                        })
                    
                    dots.exit().remove();
                } else {
                    d3.select(this).selectAll(".valueDot").remove();
                }
                
                if ((self.chartComponentData.displayState[aggKey].includeEnvelope || self.chartOptions.includeEnvelope) && self.chartComponentData.isPossibleEnvelope(aggKey, splitBy)) {
                    var envelopeData = self.chartComponentData.timeArrays[aggKey][splitBy].map((d: any) => ({...d, isEnvelope: true}));
                    var envelope = d3.select(this).selectAll(".valueEnvelope")
                        .data([envelopeData]);
                    
                    envelope.enter()
                        .append("path")
                        .attr("class", "valueElement valueEnvelope")
                        .merge(envelope)
                        .style("visibility", (d: any) => { 
                            return (self.chartComponentData.isSplitByVisible(aggKey, splitBy)) ? "visible" : "hidden";
                        })                                            
                        .transition()
                        .duration(durationFunction)
                        .ease(d3.easeExp)
                        .style("fill", splitByColors[j])
                        .attr("fill-opacity", .2)
                        .attr("d", aggEnvelope);
                }

                if (self.chartOptions.isArea) {
                    var area = d3.select(this).selectAll(".valueArea")
                        .data([self.chartComponentData.timeArrays[aggKey][splitBy]]);

                    // logic for shiny gradient fill via url()
                    let svgId = Utils.guid();
                    let lg = defs.selectAll('linearGradient')
                            .data([self.chartComponentData.timeArrays[aggKey][splitBy]]);
                    var gradient = lg.enter()
                        .append('linearGradient');
                    gradient.merge(lg)
                        .attr('id', svgId).attr('x1', '0%').attr('x2', '0%').attr('y1', '0%').attr('y2', '100%');
                    gradient.append('stop').attr('offset', '0%').attr('style', () =>{return 'stop-color:' + splitByColors[j] + ';stop-opacity:.2'});
                    gradient.append('stop').attr('offset', '100%').attr('style', () =>{return 'stop-color:' + splitByColors[j] + ';stop-opacity:.03'});
                    lg.exit().remove();

                    area.enter()
                        .append("path")
                        .attr("class", "valueArea")
                        .merge(area)
                        .style("fill", 'url(#' + (svgId) + ')')
                        .style("visibility", (d: any) => { 
                            return (self.chartComponentData.isSplitByVisible(aggKey, splitBy)) ? "visible" : "hidden";
                        })                                            
                        .transition()
                        .duration(durationFunction)
                        .ease(d3.easeExp)
                        .attr("d", self.areaPath);
                    area.exit().remove();
                }

                gapPath.exit().remove();
                path.exit().remove();
                self.previousAggregateData.set(this, splitBy);
            });
    }

    private getChartWidth () {
        return Math.max(0, this.width - this.chartMargins.left - this.chartMargins.right - (this.chartOptions.legend == "shown" ? this.CONTROLSWIDTH + 16 : 0));
    }

    private nextStackedState = () => {
        if (this.chartOptions.yAxisState == "stacked") 
            return "shared";
        else if (this.chartOptions.yAxisState == "shared")
            return "overlap";
        else  
            return "stacked";
    };

    public render(data: any, options: any, aggregateExpressionOptions: any) {
        this.data = data;
        this.hasBrush = options && (options.brushMoveAction || options.brushMoveEndAction || options.brushContextMenuActions);
        this.chartOptions.setOptions(options);
        this.aggregateExpressionOptions = data.map((d, i) => Object.assign(d, aggregateExpressionOptions && i in aggregateExpressionOptions  ? new ChartDataOptions(aggregateExpressionOptions[i]) : new ChartDataOptions({})));
        this.width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
        this.height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);
        if (this.chartOptions.legend == "compact")
            this.chartMargins.top = 72;
        else
            this.chartMargins.top = 40;
        
        if (this.chartOptions.hideChartControlPanel) {
            this.chartMargins.top += -28;
        }

        this.events = (this.chartOptions.events != undefined) ? this.chartOptions.events : null;
        this.states = (this.chartOptions.states != undefined) ? this.chartOptions.states : null;
        this.strokeOpacity = this.chartOptions.isArea ? .55 : 1;
        this.nonFocusStrokeOpactiy = this.chartOptions.isArea ? .55 : .3;

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressionOptions, this.events, this.states);
        if (this.chartOptions.xAxisHidden && this.chartOptions.focusHidden) {
            this.chartMargins.bottom = 5;
        }

        this.timelineHeight = (this.chartComponentData.visibleEventsAndStatesCount * 10);
        this.chartHeight = Math.max(1, this.height - this.chartMargins.bottom - this.chartMargins.top - this.timelineHeight); 
        this.chartWidth = this.getChartWidth();

        if (this.brush && this.svgSelection.select('.svgGroup').select(".brushElem") && !this.chartOptions.keepBrush) {
            this.svgSelection.select('.svgGroup').select(".brushElem").call(this.brush.move, null);
            this.brushStartTime = null;
            this.brushEndTime = null;
        }
        
        d3.select(this.renderTarget).select(".tsi-tooltip").remove();

        if (!this.chartOptions.hideChartControlPanel && this.chartControlsPanel === null) {
            this.chartControlsPanel = Utils.createControlPanel(this.renderTarget, this.CONTROLSWIDTH, Math.max((this.chartMargins.top + 12), 0), this.chartOptions);
            var self = this;
            this.hasStackedButton = true;
            this.stackedButton = this.chartControlsPanel.append("button")
                .style("left", "60px")
                .attr("class", "tsi-stackedButton")
                .attr("aria-label", () => "set axis state to " + this.nextStackedState())
                .on("click", function () {
                    d3.select(this).attr("aria-label", () => "set axis state to " + self.nextStackedState());
                    self.chartOptions.yAxisState = self.nextStackedState();
                    self.draw();
                    setTimeout (() => (d3.select(this).node() as any).focus(), 200);
                });
        } else if (this.chartOptions.hideChartControlPanel && this.chartControlsPanel !== null){
            this.hasStackedButton = false;
            this.removeControlPanel();
        }

        if (this.chartControlsPanel !== null) {
            this.drawEllipsisMenu([{
                iconClass: "flag",
                label: "Drop a Marker",
                action: this.scooterButtonClick,
                description: ""
            }]);
            this.chartControlsPanel.style("top", Math.max((this.chartMargins.top - 24), 0) + 'px');
        }
        
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
            var voronoiRegion;
            if (this.hasBrush) {
                this.brushElem = g.append("g")
                    .attr("class", "brushElem");
                this.brushElem.classed("hideBrushHandles", !this.chartOptions.brushHandlesVisible);
            } else {
                //if there is no brushElem, the voronoi lives here
                voronoiRegion = g.append("rect").classed("voronoiRect", true);
            }
    
            this.focus = g.append("g")
                .attr("transform", "translate(-100,-100)")
                .attr("class", "focus");
            
            this.focus.append("line")
                .attr("class", "focusLine vLine")
                .attr("x1", 0)
                .attr("x2", 0)
                .attr("y1", this.chartOptions.aggTopMargin)
                .attr("y2", this.chartHeight + this.timelineHeight);
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

            var draw = () => {  

                this.minBrushWidth = (this.chartOptions.minBrushWidth) ? this.chartOptions.minBrushWidth : this.minBrushWidth;
                this.focus.attr("visibility", (this.chartOptions.focusHidden) ? "hidden" : "visible")
                if (this.chartOptions.xAxisHidden && this.chartOptions.focusHidden) {
                    this.chartMargins.bottom = 5;
                }

                this.chartComponentData.updateVisibleEventsAndStatesCount();
                this.timelineHeight = (this.chartComponentData.visibleEventsAndStatesCount * 10);
      
                this.width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
                this.chartWidth = this.getChartWidth();
                this.height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);
                this.chartHeight = Math.max(1, this.height - this.chartMargins.bottom - this.chartMargins.top - this.timelineHeight); 

                g.attr("transform", "translate(" + this.chartMargins.left + "," + this.chartMargins.top + ")");

                if (this.brushElem) {
                    this.brushElem.classed("hideBrushHandles", !this.chartOptions.brushHandlesVisible);
                }

                this.focus.select('.hLine').attr("x2", this.chartWidth);
                this.focus.select('.vLine').attr("y2", this.chartHeight + this.timelineHeight);
                this.svgSelection
                    .style("width", (this.chartWidth + this.chartMargins.left + this.chartMargins.right) + "px")
                    .style("height", this.height + "px");
                     
                super.themify(this.targetElement, this.chartOptions.theme);
                        
                this.legendObject.draw(this.chartOptions.legend, this.chartComponentData, (aggKey, splitBy) => { this.labelMouseover(aggKey, splitBy); }, 
                                       this.svgSelection, this.chartOptions, () => {
                                        d3.select(this.renderTarget).selectAll(".tsi-scooterValue")
                                            .style("opacity", 1);
                                       }, this.stickySeries);

                this.svgSelection.selectAll('.valueElement').style("visibility", "hidden");
                this.svgSelection.selectAll(".yAxis").style("visibility", "hidden");    

                this.x = d3.scaleTime()
                            .rangeRound([this.xOffset, Math.max(this.xOffset, this.chartWidth - (2 * this.xOffset))]);
        
                this.y = d3.scaleLinear()
                        .range([Math.max(this.chartHeight, this.chartOptions.aggTopMargin), this.chartOptions.aggTopMargin]);

                var fromAndTo: any = this.chartComponentData.setAllValuesAndVisibleTAs();
                var xExtent: any = (this.chartComponentData.allValues.length != 0) ? d3.extent(this.chartComponentData.allValues, (d: any) => d.dateTime) : [0,1];
                var timeSet = d3.set(this.chartComponentData.allValues, (d: any) => d.dateTime);
                var xRange = (this.chartComponentData.allValues.length != 0) ? Math.max(2, (xExtent[1].valueOf() - xExtent[0].valueOf())) : 2;
                var xOffsetPercentage = this.xOffset / this.chartWidth;
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

                if (voronoiRegion) {
                    voronoiRegion.attr("x", xOffsetPercentage * this.chartWidth)
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
                    .on("brush", function () { self.brushBrush(); })
                    .on("end", function () { self.brushEnd(this); });
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
                        var xAxis: any = g.selectAll(".xAxis").data([this.x]);
            
                        var xAxisEntered = xAxis.enter()
                            .append("g")
                            .attr("class", "xAxis")
                            .merge(xAxis)
                            .attr("transform", "translate(0," + (this.chartHeight + this.timelineHeight) + ")")
                            .call(this.createXAxis(this.chartOptions.singleLineXAxisLabel));

                        if (!this.chartOptions.singleLineXAxisLabel)                                     
                            xAxisEntered.selectAll('text').call(Utils.splitTimeLabel);

                        xAxisEntered.select(".domain").style("display", "none");
                        xAxis.exit().remove();

                        var xAxisBaseline =  g.selectAll(".xAxisBaseline").data([this.x]);
                        var xAxisBaselineEntered = xAxisBaseline.enter().append("line")
                            .attr("class", "xAxisBaseline")
                            .attr("x1", .5)
                            .merge(xAxisBaseline)
                            .attr("y2", this.chartHeight + this.timelineHeight + .5)
                            .attr("y1", this.chartHeight + this.timelineHeight + .5)
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
                    let aggregateGroups = this.svgSelection.select('.svgGroup').selectAll('.tsi-aggGroup')
                        .data(this.data.filter((agg) => this.chartComponentData.displayState[agg.aggKey]["visible"]), 
                            (agg) => agg.aggKey);
                    var self = this;
                    aggregateGroups.enter()
                        .append('g')
                        .classed('tsi-aggGroup', true)
                        .merge(aggregateGroups)
                        .transition()
                        .duration((this.chartOptions.noAnimate) ? 0 : self.TRANSDURATION)            
                        .ease(d3.easeExp)                                         
                        .attr('transform', (agg, i) => {
                            let yTranslate = 0;
                            if (this.chartOptions.yAxisState === "stacked") {
                                yTranslate = (i / this.visibleAggCount) * this.chartHeight;
                            }
                            return 'translate(0,' + yTranslate + ')';
                        })
                        .each(function (agg, i) {
                            self.generateLine(i, agg, true, d3.select(this));
                        });
                    aggregateGroups.exit().remove();
                    /******************** Voronoi diagram for hover action ************************/

                    this.voronoi = d3.voronoi()
                        .x(function(d: any) {
                            return (d.bucketSize != undefined ? self.x(new Date(d.dateTime.valueOf() + (d.bucketSize / 2))) : self.x(d.dateTime))})
                        .y(function(d: any) { 
                            if (d.measures) {
                                return self.yMap[d.aggregateKey](self.getValueOfVisible(d));
                            }
                            return null;
                        })
                        .extent([[0, 0], [this.chartWidth, this.chartHeight]]);

                    //if brushElem present then use the overlay, otherwise create a rect to put the voronoi on
                    var voronoiSelection = (this.brushElem ? this.brushElem.select(".overlay") : voronoiRegion);
                    
                    voronoiSelection.on("mousemove", function () {
                        let mouseEvent = d3.mouse(this);
                        self.voronoiMousemove(mouseEvent);
                    })
                    .on("mouseover", function () {
                        if (!self.isDroppingScooter) {
                            self.svgSelection.selectAll(".valueElement")
                                .attr("stroke-opacity", self.nonFocusStrokeOpactiy)
                                .attr("fill-opacity", .3);
                            self.svgSelection.selectAll(".valueEnvelope")
                                .attr("fill-opacity", .1);
                        }
                    })
                    .on("mouseout", function (d)  {
                        if (!self.filteredValueExist()) return;
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
                        if (this.chartOptions.yAxisState == "stacked") return 1;
                        if (this.chartOptions.yAxisState == "shared") return .6;
                        return .3;
                    })
                    .style("display", this.visibleAggCount < 2 ? "none" : "block")
                    .classed('tsi-lightTheme', this.chartOptions.theme == 'light')
                    .classed('tsi-darkTheme', this.chartOptions.theme == 'dark');
                }

                var visibleEventsCount = 0;
                if (this.chartComponentData.events) {
                    this.chartComponentData.events.forEach((namedEventSeries, i) => {
                        var name = Object.keys(namedEventSeries)[0];
                        var eventSeries = namedEventSeries[name];
                        var isVisible = this.chartComponentData.displayState.events[namedEventSeries.key].visible;
                        visibleEventsCount += (isVisible) ? 1 : 0;
                        eventSeriesWrappers[i].style("width", this.chartWidth  + 'px')
                            .style("height", d => isVisible ? '10px' : '0px')
                            .style("visibility", d => isVisible ? "visible" : "hidden")
                            .style("right", this.chartMargins.right  + 'px')
                            .style("bottom", this.chartMargins.bottom + this.timelineHeight - (visibleEventsCount * 10)  + 'px');
                        eventSeriesComponents[i].render(namedEventSeries, {timeFrame: {from : xExtent[0], to: xExtent[1]}, 
                                                        xAxisHidden: true, theme: this.chartOptions.theme, 
                                                        offset: this.chartOptions.offset});
                    });
                }
                if (this.chartComponentData.states) {
                    var visibleStatesCount = 0;
                    this.chartComponentData.states.forEach((namedStateSeries, i) => {
                        var name = Object.keys(namedStateSeries)[0];
                        var stateSeries = namedStateSeries[name];
                        var isVisible = this.chartComponentData.displayState.states[namedStateSeries.key].visible;
                        visibleStatesCount += (isVisible) ? 1 : 0;
                        stateSeriesWrappers[i].style("width", this.chartWidth + 'px')
                            .style("height", d => this.chartComponentData.displayState.states[namedStateSeries.key].visible ? '10px' : '0px')
                            .style("visibility", d => this.chartComponentData.displayState.states[namedStateSeries.key].visible ? "visible" : "hidden")
                            .style("right", this.chartMargins.right + 'px')
                            .style("bottom", this.chartMargins.bottom + this.timelineHeight - ((visibleEventsCount * 10) + (visibleStatesCount * 10))  + 'px');
                        stateSeriesComponents[i].render(namedStateSeries, {timeFrame: {from : xExtent[0], to: xExtent[1]}, 
                                                                           offset: this.chartOptions.offset,
                                                                           xAxisHidden: true, theme: this.chartOptions.theme});
                    });
                }

                if (!this.chartOptions.hideChartControlPanel && this.chartControlsPanel !== null) {
                    let controlPanelWidth = Utils.getControlPanelWidth(this.renderTarget, this.CONTROLSWIDTH, this.chartOptions.legend === 'shown');
                    this.chartControlsPanel.style("width", controlPanelWidth + "px");
                }

                if (Object.keys(this.chartComponentData.timeMap).length == 0) {
                    d3.select(this.renderTarget).selectAll(".tsi-scooterContainer").style("display", "none");
                } else {
                    d3.select(this.renderTarget).selectAll(".tsi-scooterContainer").style("display", "block");
                }
                this.updateScooterPresentation();
                this.voronoiDiagram = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues));
            }

            this.legendObject = new Legend(draw, this.renderTarget, this.CONTROLSWIDTH);
            this.contextMenu = new ContextMenu(draw, this.renderTarget);
            this.brushContextMenu = new ContextMenu(draw, this.renderTarget);
            this.draw = draw;
            window.addEventListener("resize", () => {
                var self = this;
                if (!this.chartOptions.suppressResizeListener) {
                    this.draw();
                    d3.select(this.renderTarget).selectAll(".tsi-scooterContainer").each(function () {
                        self.setScooterPosition(d3.select(this));
                    });
                }
            });

            var eventSeriesWrappers;
            var eventSeriesComponents;
            if (this.events && this.events.length > 0) {
                eventSeriesWrappers = this.events.map((events, i) => {
                    return this.targetElement.append("div").attr("class", "tsi-lineChartEventsWrapper");
                });
                eventSeriesComponents = this.events.map((eSC, i) => {
                    return (new EventSeries(<any>eventSeriesWrappers[i].node()));
                });
            }
            else {
                eventSeriesWrappers = [];
                eventSeriesComponents = [];
            }

            var stateSeriesWrappers;
            var stateSeriesComponents;
            if (this.states && this.states.length > 0) {
                stateSeriesWrappers = this.states.map((state, i) => {
                    return this.targetElement.append("div").attr("class", "tsi-lineChartStatesWrapper");
                });
                stateSeriesComponents = this.states.map((tSC, i) => {
                    return (new StateSeries(<any>stateSeriesWrappers[i].node()));
                });
            } 
            else {
                stateSeriesWrappers = [];
                stateSeriesComponents = [];
            }
        }    
        
        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(this.data, this.aggregateExpressionOptions, this.events, this.states);
        this.draw();
        this.chartOptions.noAnimate = false;  // ensure internal renders are always animated, overriding the users noAnimate option

        if (this.chartOptions.markers && this.chartOptions.markers.length > 0) {
            this.importMarkers();
        }

        d3.select("html").on("click." + Utils.guid(), () => {
            if (this.ellipsisContainer && d3.event.target != this.ellipsisContainer.select(".tsi-ellipsisButton").node()) {
                this.ellipsisMenu.setMenuVisibility(false);
            }
        });
    }
}
export {LineChart}