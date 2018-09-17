import * as d3 from 'd3';
import './LineChart.scss';
import {Utils} from "./../../Utils";
import {Legend} from "./../Legend/Legend";
import {Grid} from "./../Grid/Grid";
import {EventSeries} from "./../EventSeries/EventSeries";
import {ChartComponent} from "./../../Interfaces/ChartComponent";
import {StateSeries} from "../StateSeries/StateSeries";
import {LineChartData} from "./../../Models/LineChartData";
import { ContextMenu } from '../ContextMenu/ContextMenu';
import { Tooltip } from '../Tooltip/Tooltip';
import { ChartOptions } from '../../Models/ChartOptions';
import { EllipsisMenu } from '../EllipsisMenu/EllipsisMenu';

class LineChart extends ChartComponent {
    private svgSelection: any;
    private targetElement: any;
    private legendObject: Legend;
    private focus: any;
    private yAxisState: any;
    private contextMenu: ContextMenu;
    private brushContextMenu: ContextMenu;
    private setDisplayStateFromData: any;
    private chartWidth: number;
    private chartHeight: number;
    public draw: any;
    private events: any;
    private states: any;
    private minBrushWidth = 1;
    private strokeOpacity = 1;
    chartComponentData = new LineChartData();
    private surpressBrushTimeSet: boolean = false;
    private hasStackedButton: boolean = false;
    private stackedButton: any = null;
    private gridButton: any = null;
    private scooterButton: any = null;
    private visibleAggCount: number;
    private ellipsisContainer: any = null;
    private ellipsisMenu: EllipsisMenu;

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
        (<any>this.legendObject.legendElement.selectAll('.splitByLabel')).classed("inFocus", false);
        if (d3.event && d3.event.type != 'end') {
            d3.event.stopPropagation();
        }
        this.svgSelection.selectAll(".valueElement")
                    .attr("stroke-opacity", this.strokeOpacity)
                    .attr("fill-opacity", 1);

        d3.select(this.renderTarget).selectAll(".tsi-scooterValue")
            .style("opacity", 1);

        /** Update y Axis */
        if (this.yAxisState == "overlap") {
            this.svgSelection.selectAll(".yAxis")
                .selectAll("text")
                .style("fill-opacity", 1)
                .classed("standardYAxisText", false)
                .style("font-weight", "normal");
        }
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
        this.focus.select('.hLine').attr("transform", "translate(-" + xPos + ",0)");
        this.focus.select('.vLine').attr("transform", "translate(0,-" + yPos + ")");
        
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
        (<any>this.legendObject.legendElement.selectAll('.splitByLabel').filter((labelData: any) => {
            return (labelData[0] == d.aggregateKey) && (labelData[1] == d.splitBy);
        })).classed("inFocus", true);

        /** update the y axis for in focus aggregate */
        if (this.yAxisState == "overlap") {
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

        this.labelMouseover(d.aggregateKey, d.splitBy);
        this.chartOptions.onMouseover(d.aggregateKey, d.splitBy);
    }

    //get the extent of an array of timeValues
    private getYExtent (aggValues, isEnvelope: boolean = false) {   
        var extent;
        if (isEnvelope) {
            var filteredValues = this.getFilteredValues(aggValues);
            var flatValuesList = [];
            filteredValues.forEach((d: any) => {
                if (this.chartComponentData.isPossibleEnvelope(d.aggregateKey, d.splitBy)) {
                    if (d.measures['min'] != undefined) {
                        flatValuesList.push(d.measures['min']);
                    }
                    if (d.measures['avg'] != undefined) {
                        flatValuesList.push(d.measures['avg']);
                    }
                    if (d.measures['max'] != undefined) {
                        flatValuesList.push(d.measures['max']);
                    }
                } else {
                    flatValuesList.push(d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)]);
                }
            });
            extent = d3.extent(flatValuesList);        
        } else {
            extent = d3.extent(this.getFilteredValues(aggValues), (d: any) => {
                return d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)];
            });    
        }
        if (extent[0] == undefined || extent[1] == undefined)
            return [0,1]
        return extent;
    }

    private getFilteredValues (aggValues) {
        return aggValues.filter((d: any) => {
            if (d.measures)
                return true;
            return false;
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

        this.chartComponentData.stickiedKey = {
            aggregateKey: aggregateKey,
            splitBy: (splitBy == null ? null : splitBy)
        };

        (<any>this.legendObject.legendElement.selectAll('.splitByLabel').filter((labelData: any) => {
            return (labelData[0] == aggregateKey) && (labelData[1] == splitBy);
        })).classed("stickied", true);
        
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
            if ((rawRightSide <= this.xOffset) || (rawLeftSide >= (this.chartWidth - (2 * this.xOffset)))) {
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
        return this.chartMargins.left + (this.chartOptions.legend == "shown" ? legendWidth : 0);
    }

    private setScooterPosition (scooter, rawMillis: number) {
        var closestTime = this.findClosestValidTime(rawMillis);
        this.scooterGuidMap[scooter.datum()] = closestTime;
        scooter.style("display", "block");
        scooter.style("left", (d) => {
            var closestTime = this.scooterGuidMap[d];
            return (Math.round(this.x(closestTime) + this.getScooterMarginLeft()) + "px");
        });
        d3.select(this.renderTarget).selectAll(".tsi-scooterContainer").sort( (a: string, b: string) =>  { 
            return (this.scooterGuidMap[a] < this.scooterGuidMap[b]) ? 1 : -1;            
        });
    }

    private setScooterTimeLabel (scooter) {
        var millis = this.scooterGuidMap[scooter.datum()];
        var values: Array<any> = this.chartComponentData.timeMap[millis];
        var firstValue = values[0].dateTime;
        var secondValue = new Date(values[0].dateTime.valueOf() + (values[0].bucketSize != null ? values[0].bucketSize : 0));
        var timeFormat = Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
            this.chartOptions.offset, this.chartOptions.is24HourTime);
        var dateToTime = (t) => timeFormat(t).split(" ")[1];
        var text = dateToTime(firstValue) + " - " + dateToTime(secondValue);
        scooter.select(".tsi-scooterTimeLabel").html(text);        
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

    private scooterButtonClick ()  {
        this.setIsDroppingScooter(!this.isDroppingScooter); 
        if (!this.isDroppingScooter) {
            this.activeScooter.remove();
            return;
        }

        var scooterUID = Utils.guid();
        this.scooterGuidMap[scooterUID] = 0;

        this.activeScooter = d3.select(this.renderTarget).append("div")
            .datum(scooterUID)
            .attr("class", "tsi-scooterContainer")
            .style("top", this.chartMargins.top + this.chartOptions.aggTopMargin + "px")
            .style("height", this.height - (this.chartMargins.top + this.chartMargins.bottom + this.chartOptions.aggTopMargin) + "px")
            .style("display", "none");
        
        this.activeScooter.append("div")
            .attr("class", "tsi-scooterLine");
            
        var self = this;
        this.activeScooter.append("div")
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
            })
            .call(d3.drag()
            .on("start drag", function (d) { 
                var scooter = d3.select(<any>d3.select(this).node().parentNode);
                var currMillis: number = Number(self.scooterGuidMap[String(scooter.datum())]);
                var startPosition = self.x(new Date(currMillis));
                var newPosition = startPosition + d3.event.x;
                self.setScooterPosition(scooter, self.x.invert(newPosition).valueOf());
                self.setScooterLabels(scooter);
                self.setScooterTimeLabel(scooter);
            })
        );
        this.activeScooter.append("div")
            .attr("class", "tsi-scooterTimeLabel");
    }

    private voronoiMousemove (mouseEvent)  { 
        if (!this.filteredValueExist()) return;
        const [mx, my] = d3.mouse(mouseEvent);
        var filteredValues = this.getFilteredAndSticky(this.chartComponentData.allValues);
        if (filteredValues == null || filteredValues.length == 0)
            return
        const site: any = this.voronoi(filteredValues).find(mx, my);
        this.voronoiMouseout(site.data); 
        if (!this.isDroppingScooter) {
            this.voronoiMouseover(site.data);  
        } else {
            var rawTime = this.x.invert(mx);
            this.setScooterPosition(this.activeScooter, rawTime.valueOf());
            this.setScooterLabels(this.activeScooter);
            this.setScooterTimeLabel(this.activeScooter);
        }
    }

    private voronoiContextMenu (mouseEvent) {
        if (!this.filteredValueExist()) return;
        const [mx, my] = d3.mouse(mouseEvent);
        const site: any = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues)).find(mx, my);
        if (this.chartComponentData.displayState[site.data.aggregateKey].contextMenuActions && 
            this.chartComponentData.displayState[site.data.aggregateKey].contextMenuActions.length) {
            var mousePosition = d3.mouse(<any>this.targetElement.node());
            d3.event.preventDefault();
            this.contextMenu.draw(this.chartComponentData, this.renderTarget, this.chartOptions, 
                                mousePosition, site.data.aggregateKey, site.data.splitBy, null,
                                site.data.dateTime);
            this.voronoiMouseover(site.data);
        }
    }

    private voronoiClick (mouseEvent) {
        if (!this.filteredValueExist()) return;
        if (this.brushElem && !this.isDroppingScooter) return;
        const [mx, my] = d3.mouse(mouseEvent);
        var site: any = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues)).find(mx, my);
        if (!this.isDroppingScooter) {
            if (this.chartComponentData.stickiedKey != null) {
                this.chartComponentData.stickiedKey = null;
                (<any>this.legendObject.legendElement.selectAll('.splitByLabel')).classed("stickied", false);
                // recompute voronoi with no sticky
                site = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues)).find(mx, my);
                this.voronoiMouseout(site.data);
                this.voronoiMouseover(site.data);
                this.chartOptions.onUnsticky(site.data.aggregateKey, site.data.splitBy)
                return;
            }
            this.stickySeries(site.data.aggregateKey, site.data.splitBy);
            this.chartOptions.onSticky(site.data.aggregateKey, site.data.splitBy);    
        } 

        this.setIsDroppingScooter(false);
        this.activeScooter = null;
    }

    private getValueOfVisible (d) {
        if (d.measures) {
            var visibleMeasure = this.chartComponentData.getVisibleMeasure( d.aggregateKey, d.splitBy);
            if (d.measures[visibleMeasure])
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
            return;
        }
        if (d3.event && d3.event.selection == null && d3.event.sourceEvent && d3.event.sourceEvent.type == "mouseup" && this.chartOptions.minBrushWidth == 0) {
            this.brushStartTime = null;
            this.brushEndTime = null;
            this.brushStartPosition = null;
            this.brushEndPosition = null;
            const [mx, my] = d3.mouse(mouseEvent);
            var site: any = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues)).find(mx, my);
            if (this.chartComponentData.stickiedKey != null) {
                this.chartComponentData.stickiedKey = null;
                (<any>this.legendObject.legendElement.selectAll('.splitByLabel')).classed("stickied", false);
                // recompute voronoi with no sticky
                site = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues)).find(mx, my);
                this.voronoiMouseout(site.data);
                this.voronoiMouseover(site.data);
                this.chartOptions.onUnsticky(site.data.aggregateKey, site.data.splitBy)
                return;
            }
            if (!this.isDroppingScooter) {
                this.stickySeries(site.data.aggregateKey, site.data.splitBy);
                this.chartOptions.onSticky(site.data.aggregateKey, site.data.splitBy);
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
                }
            }
        }
        if (d3.event.selection[1] - d3.event.selection[0] < this.minBrushWidth) {
            let rightSide = Math.min(d3.event.selection[0] + this.minBrushWidth, this.x.range()[1]);
            transformCall = () => d3.select(mouseEvent).transition().call(d3.event.target.move, [rightSide - this.minBrushWidth, rightSide]);
        }
        if (this.chartOptions.brushMoveEndAction && (d3.event.sourceEvent && d3.event.sourceEvent.type == 'mouseup')) {
            this.chartOptions.brushMoveEndAction(this.brushStartTime, this.brushEndTime);
        }
        if (transformCall)
            transformCall();
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
            self.setScooterLabels(currScooter, true);
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

        this.svgSelection.selectAll(".valueElement")
                    .filter(selectedFilter)
                    .attr("stroke-opacity", .3)
                    .attr("fill-opacity", .3);

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
    private generateLine (tsIterator, visibleAggI, agg, aggVisible: boolean): number {
        var g = this.svgSelection.select(".svgGroup");
        var defs = this.svgSelection.select("defs");
        var aggKey = agg.aggKey;
        var aggY;
        var aggLine;
        var aggEnvelope;
        var aggGapLine;
        var yExtent;
        // var includeEnvelope = this.chartOptions.includeEnvelope && this.chartComponentData.isPossibleEnvelope(agg, splitBy)

        if ((this.yAxisState == "shared") || (Object.keys(this.chartComponentData.timeArrays)).length < 2 || !aggVisible) {
            yExtent = this.getYExtent(this.chartComponentData.allValues, this.chartOptions.includeEnvelope);
            var yRange = (yExtent[1] - yExtent[0]) > 0 ? yExtent[1] - yExtent[0] : 1;
            var yOffsetPercentage = this.chartOptions.isArea ? (1.5 / this.chartHeight) : (10 / this.chartHeight);
            this.y.domain([yExtent[0] - (yRange * yOffsetPercentage), yExtent[1] + (yRange * (10 / this.chartHeight))]);
            aggY = this.y;
            aggLine = this.line;
            aggGapLine = null;
            aggEnvelope = this.envelope;
        } else {
            var aggValues: Array<any> = [];
            Object.keys(this.chartComponentData.visibleTAs[aggKey]).forEach((splitBy) => {
                aggValues = aggValues.concat(this.chartComponentData.visibleTAs[aggKey][splitBy]);
            });
            aggY = d3.scaleLinear();
            if (this.yAxisState == "overlap") {
                aggY.range([this.chartHeight, this.chartOptions.aggTopMargin]);
            } else {
                aggY.range([(this.chartHeight / this.visibleAggCount) * (visibleAggI + 1), 
                            (this.chartHeight / this.visibleAggCount) * (visibleAggI) + this.chartOptions.aggTopMargin]);
            }
            if (this.chartComponentData.aggHasVisibleSplitBys(aggKey)) {
                yExtent = this.getYExtent(aggValues, this.chartOptions.includeEnvelope);
                var yRange = (yExtent[1] - yExtent[0]) > 0 ? yExtent[1] - yExtent[0] : 1;
                var yOffsetPercentage = 10 / (this.chartHeight / ((this.yAxisState == "overlap") ? 1 : this.visibleAggCount));
                aggY.domain([yExtent[0] - (yRange * yOffsetPercentage), 
                        yExtent[1] + (yRange * yOffsetPercentage)]);
            } else {
                aggY.domain([0,1]);
                yExtent = [0, 1];
            }
            aggLine = d3.line()
                .curve(this.chartOptions.interpolationFunction)
                .defined((d: any) =>  {
                    return (d.measures !== null) && 
                            (d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)] !== null);
                })
                .x((d: any) => this.getXPosition(d, this.x))
                .y((d: any) => {                 
                    return d.measures ? aggY(d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)]) : null;
                });

            aggEnvelope = d3.area()
                .curve(this.chartOptions.interpolationFunction)
                .defined((d: any) => (d.measures !== null) && (d.measures['min'] !== null) && (d.measures['max'] !== null))
                .x((d: any) => this.getXPosition(d, this.x))
                .y0((d: any) => d.measures ? aggY(d.measures['max']) : 0)
                .y1((d: any) => d.measures ? aggY(d.measures['min']) : 0);

            aggGapLine = aggLine;
        }

        this.yMap[aggKey] = aggY;
        
        var yAxis: any = g.selectAll(".yAxis")
                .filter((yAggKey) => { return yAggKey == aggKey})
                        .data([aggKey]);
        var visibleYAxis = (aggVisible && (this.yAxisState != "shared" || visibleAggI == 0));
        
        yAxis = yAxis.enter()
            .append("g")
            .attr("class", "yAxis")
            .merge(yAxis)
            .style("visibility", ((visibleYAxis && !this.chartOptions.yAxisHidden) ? "visible" : "hidden"));
        if (this.yAxisState == "overlap" && this.visibleAggCount > 1) {
            yAxis.call(d3.axisLeft(aggY).tickFormat(Utils.formatYAxisNumber).tickValues(yExtent))
                .selectAll("text")
                .attr("y", (d, j) => {return (j == 0) ? (-visibleAggI * 16) : (visibleAggI * 16) })
                .style("fill", this.chartComponentData.displayState[aggKey].color);
        }
        else {
            yAxis.call(d3.axisLeft(aggY).tickFormat(Utils.formatYAxisNumber)
                .ticks(Math.max(2, Math.ceil(this.chartHeight/(this.yAxisState == 'stacked' ? this.visibleAggCount : 1)/90))))
                .selectAll("text").classed("standardYAxisText", true)
        }
        yAxis.exit().remove();
        
        var guideLinesData = {
            x: this.x,
            y: aggY,
            visible: visibleYAxis
        };
        var splitByColors = Utils.createSplitByColors(this.chartComponentData.displayState, aggKey, this.chartOptions.keepSplitByColor);

        Object.keys(this.chartComponentData.timeArrays[aggKey]).forEach((splitBy: string, j: number) => {
            this.colorMap[aggKey + "_" + splitBy] = splitByColors[j];
            // createion of segments between each gap in the data
            var segments = [];
            var lineData = this.chartComponentData.timeArrays[aggKey][splitBy];
            var visibleMeasure = this.chartComponentData.getVisibleMeasure(aggKey, splitBy);
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
            var gapPath = g.selectAll(".gapLine" + tsIterator)
                .data(segments);
            gapPath.enter()
                .append("path")
                .attr("class", "valueElement gapLine gapLine" + tsIterator)
                .merge(gapPath)
                .style("visibility", (d: any) => { 
                    return (this.chartComponentData.isSplitByVisible(aggKey, splitBy)) ? "visible" : "hidden";
                })   
                .transition()
                .duration(this.chartOptions.noAnimate ? 0 : this.TRANSDURATION)
                .ease(d3.easeExp)                                         
                .attr("stroke-dasharray","5,5")            
                .attr("d", aggLine);

            var path = g.selectAll(".valueLine" + tsIterator)
                .data([this.chartComponentData.timeArrays[aggKey][splitBy]]);

            path.enter()
                .append("path")
                .attr("class", "valueElement valueLine valueLine" + tsIterator)
                .merge(path)
                .style("visibility", (d: any) => { 
                    return (this.chartComponentData.isSplitByVisible(aggKey, splitBy)) ? "visible" : "hidden";
                })                                            
                .transition()
                .duration(this.chartOptions.noAnimate ? 0 : this.TRANSDURATION)
                .ease(d3.easeExp)
                .attr("stroke", splitByColors[j])
                .attr("stroke-opacity", this.strokeOpacity)                       
                .attr("d", aggLine);
            
            if (this.chartOptions.includeEnvelope && this.chartComponentData.isPossibleEnvelope(aggKey, splitBy)) {
                var envelope = g.selectAll(".valueEnvelope" + tsIterator)
                    .data([this.chartComponentData.timeArrays[aggKey][splitBy]]);
                
                envelope.enter()
                    .append("path")
                    .attr("class", "valueElement valueEnvelope valueEnvelope" + tsIterator)
                    .merge(envelope)
                    .style("visibility", (d: any) => { 
                        return (this.chartComponentData.isSplitByVisible(aggKey, splitBy)) ? "visible" : "hidden";
                    })                                            
                    .transition()
                    .duration(this.chartOptions.noAnimate ? 0 : this.TRANSDURATION)
                    .ease(d3.easeExp)
                    .style("fill", splitByColors[j])
                    .style("fill-opacity", .2)
                    .attr("d", aggEnvelope);
            }

            if (this.chartOptions.isArea) {
                var area = g.selectAll(".valueArea" + tsIterator)
                    .data([this.chartComponentData.timeArrays[aggKey][splitBy]]);

                // logic for shiny gradient fill via url()
                let svgId = Utils.guid();
                let lg = defs.selectAll('linearGradient')
                        .data([this.chartComponentData.timeArrays[aggKey][splitBy]]);
                var gradient = lg.enter()
                    .append('linearGradient');
                gradient.merge(lg)
                    .attr('id', svgId).attr('x1', '0%').attr('x2', '0%').attr('y1', '0%').attr('y2', '100%');
                gradient.append('stop').attr('offset', '0%').attr('style', () =>{return 'stop-color:' + splitByColors[j] + ';stop-opacity:.2'});
                gradient.append('stop').attr('offset', '100%').attr('style', () =>{return 'stop-color:' + splitByColors[j] + ';stop-opacity:.03'});
                lg.exit().remove();

                area.enter()
                    .append("path")
                    .attr("class", "valueElement valueArea valueArea" + tsIterator)
                    .merge(area)
                    .style("fill", 'url(#' + (svgId) + ')')
                    .style("visibility", (d: any) => { 
                        return (this.chartComponentData.isSplitByVisible(aggKey, splitBy)) ? "visible" : "hidden";
                    })                                            
                    .transition()
                    .duration(this.chartOptions.noAnimate ? 0 : this.TRANSDURATION)
                    .ease(d3.easeExp)
                    .attr("d", this.areaPath);
                area.exit().remove();
            }

            gapPath.exit().remove();
            path.exit().remove();
            tsIterator += 1;
        });
        return tsIterator;
    }

    public render(data: any, options: any, aggregateExpressionOptions: any) {
        this.data = data;
        this.hasBrush = options.brushMoveAction || options.brushMoveEndAction || options.brushContextMenuActions;
        this.chartOptions.setOptions(options);
        this.aggregateExpressionOptions = aggregateExpressionOptions;
        var width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
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

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressionOptions, this.events, this.states);
        if (this.chartOptions.xAxisHidden && this.chartOptions.focusHidden) {
            this.chartMargins.bottom = 5;
        }

        this.timelineHeight = (this.chartComponentData.visibleEventsAndStatesCount * 10);
        this.chartHeight = Math.max(1, this.height - this.chartMargins.bottom - this.chartMargins.top - this.timelineHeight); 
        this.chartWidth = Math.max(1, width - this.chartMargins.left - this.chartMargins.right - (this.chartOptions.legend == "shown" ? this.CONTROLSWIDTH : 0));

        if (this.brush && this.svgSelection.select('.svgGroup').select(".brushElem") && !this.chartOptions.keepBrush) {
            this.svgSelection.select('.svgGroup').select(".brushElem").call(this.brush.move, null);
            this.brushStartTime = null;
            this.brushEndTime = null;
        }
        
        d3.select(this.renderTarget).select(".tsi-tooltip").remove();

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
            var voronoiRegion
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
                .attr("transform", "translate(0," + (this.chartHeight + this.chartOptions.aggTopMargin) + ")");
            var hHoverBox: any = hHoverG.append("rect")
                .attr("class", 'hHoverBox')
                .attr("x", 0)
                .attr("y", 4)
                .attr("width", 0)
                .attr("height", 0);
    
            var hHoverText: any = hHoverG.append("text")
                .attr("class", "hHoverText")
                .attr("dy", ".71em")
                .attr("transform", "translate(0,6)")
                .text(d => d);

            var hHoverBar: any = hHoverG.append("line")
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
                        
            this.yAxisState = this.chartOptions.yAxisState ? this.chartOptions.yAxisState : "stacked"; // stacked, shared, overlap

            var draw = () => {  

                this.minBrushWidth = (this.chartOptions.minBrushWidth) ? this.chartOptions.minBrushWidth : this.minBrushWidth;
                this.focus.attr("visibility", (this.chartOptions.focusHidden) ? "hidden" : "visible")
                if (this.chartOptions.xAxisHidden && this.chartOptions.focusHidden) {
                    this.chartMargins.bottom = 5;
                }

                this.chartComponentData.updateVisibleEventsAndStatesCount();
                this.timelineHeight = (this.chartComponentData.visibleEventsAndStatesCount * 10);
      
                width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
                this.chartWidth = Math.max(0, width - this.chartMargins.left - this.chartMargins.right - (this.chartOptions.legend == "shown" ? this.CONTROLSWIDTH : 0));
                this.height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);
                this.chartHeight = Math.max(1, this.height - this.chartMargins.bottom - this.chartMargins.top - this.timelineHeight); 

                this.focus.select('.hLine').attr("x2", this.chartWidth);
                this.focus.select('.vLine').attr("y2", this.chartHeight + this.timelineHeight);
                this.svgSelection
                    .attr("width", this.chartWidth + this.chartMargins.left + this.chartMargins.right)
                    .attr("height", this.height);
                     
                super.themify(this.targetElement, this.chartOptions.theme);
                        
                this.legendObject.draw(this.chartOptions.legend, this.chartComponentData, (aggKey, splitBy) => { this.labelMouseover(aggKey, splitBy); }, 
                                       this.svgSelection, this.chartOptions, () => {
                                        d3.select(this.renderTarget).selectAll(".tsi-scooterValue")
                                            .style("opacity", 1);
                                       }, this.stickySeries);

                if (!this.chartOptions.hideChartControlPanel) {
                    var controlPanelWidth = Math.max(1, (<any>d3.select(this.renderTarget).node()).clientWidth - 
                                                        (this.chartOptions.legend == "shown" ? this.CONTROLSWIDTH : 0));
                    d3.select(this.renderTarget).selectAll(".tsi-chartControlsPanel").remove();
                    var chartControlsPanel = d3.select(this.renderTarget).append("div")
                        .attr("class", "tsi-chartControlsPanel")
                        .style("width", controlPanelWidth + "px")
                        .style("top", Math.max((this.chartMargins.top - 20), 0) + "px");

                    this.hasStackedButton = true;
                    this.stackedButton = chartControlsPanel.append("div")
                        .style("left", this.chartMargins.left + "px")
                        .attr("class", "tsi-stackedButton")
                        .on("click", () => {
                            if (this.yAxisState == "stacked") 
                                this.yAxisState = "shared";
                            else if (this.yAxisState == "shared")
                                this.yAxisState = "overlap";
                            else  
                                this.yAxisState = "stacked";
                            this.draw();
                        });

                    var self = this;

                    var onScooterClick = function () {
                        self.setIsDroppingScooter(!self.isDroppingScooter); 
                        if (!self.isDroppingScooter) {
                            self.activeScooter.remove();
                            return;
                        }

                        var scooterUID = Utils.guid();
                        self.scooterGuidMap[scooterUID] = 0;

                        self.activeScooter = d3.select(self.renderTarget).append("div")
                            .datum(scooterUID)
                            .attr("class", "tsi-scooterContainer")
                            .style("top", self.chartMargins.top + self.chartOptions.aggTopMargin + "px")
                            .style("height", self.height - (self.chartMargins.top + self.chartMargins.bottom + self.chartOptions.aggTopMargin) + "px")
                            .style("display", "none");
                        
                        self.activeScooter.append("div")
                            .attr("class", "tsi-scooterLine");
                        self.activeScooter.append("div")
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
                            })
                            .call(d3.drag()
                            .on("start drag", function (d) { 
                                var scooter = d3.select(<any>d3.select(this).node().parentNode);
                                var currMillis: number = Number(self.scooterGuidMap[String(scooter.datum())]);
                                var startPosition = self.x(new Date(currMillis));
                                var newPosition = startPosition + d3.event.x;
                                self.setScooterPosition(scooter, self.x.invert(newPosition).valueOf());
                                self.setScooterLabels(scooter);
                                self.setScooterTimeLabel(scooter);
                            })
                        );
                        self.activeScooter.append("div")
                            .attr("class", "tsi-scooterTimeLabel");
                    }

                    var showGrid = () => {
                        this.chartOptions.fromChart = true; 
                        var gridComponent: Grid = new Grid(this.renderTarget);
                        gridComponent.usesSeconds = this.chartComponentData.usesSeconds;
                        gridComponent.usesMillis = this.chartComponentData.usesMillis; 
                        var grid = gridComponent.renderFromAggregates(this.chartComponentData.data, this.chartOptions, this.aggregateExpressionOptions);
                        grid.focus();
                    }

                    this.ellipsisContainer = chartControlsPanel.append("div")
                        .attr("class", "tsi-ellipsisContainerDiv");
                    
                    this.ellipsisMenu = new EllipsisMenu(this.ellipsisContainer.node());

                    var ellipsisItems = [{
                        iconClass: "flag",
                        label: "Drop a Scooter",
                        action: onScooterClick,
                        description: ""
                    }];


                    if (this.chartOptions.grid) {
                        ellipsisItems.push({
                            iconClass: "grid",
                            label: "Display Grid",
                            action: showGrid ,
                            description: ""
                        });
                    }
                    this.ellipsisMenu.render(ellipsisItems, {theme: this.chartOptions.theme});

                } else {
                    this.hasStackedButton = false;
                }
    
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
                    
                var yExtent: any = this.getYExtent(this.chartComponentData.allValues);
                var yRange = (yExtent[1] - yExtent[0]) > 0 ? yExtent[1] - yExtent[0] : 1;
                var yOffsetPercentage = this.chartOptions.isArea ? (1.5 / this.chartHeight) : (10 / this.chartHeight);
                this.y.domain([yExtent[0] - (yRange * yOffsetPercentage), yExtent[1] + (yRange * (10 / this.chartHeight))]);
                if (this.chartComponentData.visibleTAs && this.chartComponentData.visibleTSCount != 0) {
                    /******************** Creating this.x, y and line **********************/
        
                    this.line = d3.line()
                        .curve(this.chartOptions.interpolationFunction)
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

                    this.envelope = d3.area()
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
            
                    /******************** Draw Line and Points ************************/
                    var tsIterator = 0;
                    this.visibleAggCount = Object.keys(this.chartComponentData.timeArrays).reduce((count: number, aggKey: string): number => {
                        return count + (this.chartComponentData.displayState[aggKey]['visible'] ? 1 : 0);
                    }, 0);
        
                    this.yMap = {};
                    this.colorMap = {};
                    var visibleAggI = 0;
                    this.svgSelection.selectAll(".yAxis").remove();

                    this.data.forEach((agg, i) => {
                        var aggVisible = this.chartComponentData.displayState[agg.aggKey]["visible"];
                        tsIterator = this.generateLine(tsIterator, visibleAggI, agg, aggVisible);
                        if (aggVisible)
                            visibleAggI += 1;
                    }); 
                    
                    /******************** Voronoi diagram for hover action ************************/

                    var self = this;
                    this.voronoi = d3.voronoi()
                        .x(function(d: any) { return self.x(d.dateTime); })
                        .y(function(d: any) { 
                            if (d.measures) {
                                var value = self.getValueOfVisible(d)
                                return self.yMap[d.aggregateKey](self.getValueOfVisible(d))
                            }
                            return null;
                        })
                        .extent([[0, 0], [this.chartWidth, this.chartHeight]]);

                    //if brushElem present then use the overlay, otherwise create a rect to put the voronoi on
                    var voronoiSelection = (this.brushElem ? this.brushElem.select(".overlay") : voronoiRegion);
                    
                    voronoiSelection.on("mousemove", function () {
                        self.voronoiMousemove(this);
                    })
                    .on("mouseout", function (d)  {
                        if (!self.filteredValueExist()) return;
                        const [mx, my] = d3.mouse(this);
                        const site = self.voronoi(self.getFilteredAndSticky(self.chartComponentData.allValues)).find(mx, my);
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
                            if (!self.brushContextMenu)
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
                            if (this.yAxisState == "stacked") return 1;
                            if (this.yAxisState == "shared") return .6;
                            return .3;
                        })
                        .style("display", this.visibleAggCount < 2 ? "none" : "block")
                        .classed('tsi-lightTheme', this.chartOptions.theme == 'light')
                        .classed('tsi-darkTheme', this.chartOptions.theme == 'dark');
                    }
                                
                    /******************** Grid button ************************/
                    // if (this.chartOptions.grid) {
                    //     this.gridButton.classed('tsi-lightTheme', this.chartOptions.theme == 'light')
                    //         .classed('tsi-darkTheme', this.chartOptions.theme == 'dark');
                    // }
                    // if (this.scooterButton) {
                    //     this.scooterButton.classed('tsi-lightTheme', this.chartOptions.theme == 'light')
                    //         .classed('tsi-darkTheme', this.chartOptions.theme == 'dark');
                    // }
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

                if (Object.keys(this.chartComponentData.timeMap).length == 0) {
                    d3.select(this.renderTarget).selectAll(".tsi-scooterContainer").style("display", "none");
                } else {
                    d3.select(this.renderTarget).selectAll(".tsi-scooterContainer").style("display", "block");
                }
                this.updateScooterPresentation();
            }

            this.legendObject = new Legend(draw, this.renderTarget, this.CONTROLSWIDTH);
            this.contextMenu = new ContextMenu(draw, this.renderTarget);
            this.brushContextMenu = new ContextMenu(draw, this.renderTarget);
            this.draw = draw;
            window.addEventListener("resize", () => {
                if (!this.chartOptions.suppressResizeListener)   
                    this.draw();
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

        d3.select("html").on("click." + Utils.guid(), () => {
            if (this.ellipsisContainer && d3.event.target != this.ellipsisContainer.select(".tsi-ellipsisButton").node()) {
                this.ellipsisMenu.setMenuVisibility(false);
            }
        });
    }
}
export {LineChart}