import * as d3 from 'd3';
import * as d3Voronoi from 'd3-voronoi';
import './LineChart.scss';
import Utils from "../../Utils";
import { DataTypes, YAxisStates, TooltipMeasureFormat } from "./../../Constants/Enums";
import { LINECHARTTOPPADDING, LINECHARTCHARTMARGINS, VALUEBARHEIGHT, SERIESLABELWIDTH } from "./../../Constants/Constants";
import Legend from "./../Legend";
import {TemporalXAxisComponent} from "./../../Interfaces/TemporalXAxisComponent";
import {LineChartData} from "./../../Models/LineChartData";
import ContextMenu  from '../ContextMenu';
import Tooltip  from '../Tooltip';
import { ChartDataOptions } from '../../Models/ChartDataOptions';
import LinePlot from '../LinePlot';
import CategoricalPlot from '../CategoricalPlot';
import EventsPlot from '../EventsPlot';
import { AxisState } from '../../Models/AxisState';
import Marker from '../Marker';
import { swimlaneLabelConstants} from '../../Constants/Constants'
import { HorizontalMarker } from '../../Utils/Interfaces';

class LineChart extends TemporalXAxisComponent {
    private targetElement: any;
    private focus: any;
    private horizontalValueBox: any;
    private verticalValueBox: any;
    private horizontalValueBar: any;
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
    private visibleAggCount: number;
    private swimLaneLabelGroup: any;
    private horizontalLabelOffset = LINECHARTCHARTMARGINS.left + swimlaneLabelConstants.leftMarginOffset;

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

    private markers = {};

    private seriesLabelsMarker: Marker = null;
    private markerGuidMap: any = {};
    private isDroppingMarker: boolean = false;
    private activeMarker: Marker;
    private brush: any;
    private brushElem: any;
    public brushStartTime: Date;
    public brushEndTime: Date;
    private brushStartPosition: number = null;
    private brushEndPosition: number = null;
    private hasBrush: boolean = false;
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
        this.chartMargins = Object.assign({}, LINECHARTCHARTMARGINS);
    }

    LineChart() { 
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

    private resetValueElementsFocus = () => {
        this.svgSelection.selectAll(".tsi-valueElement")
                    .attr("stroke-opacity", this.strokeOpacity)
                    .filter(function () {
                        return !d3.select(this).classed("tsi-valueEnvelope");
                    })
                    .attr("fill-opacity", 1);

        this.svgSelection.selectAll(".tsi-valueEnvelope")
            .attr("fill-opacity", .2);
            
            Utils.revertAllSubtitleText(d3.select(this.renderTarget).selectAll('.tsi-markerValue'));

        this.focusedAggKey = null;
        this.focusedSplitby = null;
    }

    private hideFocusElements () {
        this.focus.style('display', 'none');
        this.verticalValueBox.style('display', 'none');
        this.horizontalValueBox.style('display', 'none');
    }

    private voronoiMouseout (event, d: any)  {
        //supress if the context menu is visible
        if (this.contextMenu && this.contextMenu.contextMenuVisible)
            return;
        
        this.hideFocusElements();        
        this.tooltip.hide();
        (<any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel')).classed("inFocus", false);
        if (event && event.type != 'end') {
            event.stopPropagation();
        }

        this.resetValueElementsFocus();

        /** Update y Axis */
        if (this.chartOptions.yAxisState == YAxisStates.Overlap) {
            this.svgSelection.selectAll(".yAxis")
                .selectAll("text")
                .style("fill-opacity", 1)
                .classed("standardYAxisText", false)
                .style("font-weight", "normal");
        }
    }

    private createMarkerInstructions () {
        this.targetElement.selectAll(".tsi-markerInstructions").remove();
        this.targetElement.append("div")
            .classed("tsi-markerInstructions", true)
            .attr('role', 'alert')
            .attr('aria-live', 'assertive')
            .text(this.getString("Click to drop marker") + "," + this.getString("drag to reposition") + "."); 
    }

    private destroyMarkerInstructions () {
        this.targetElement.selectAll(".tsi-markerInstructions").remove();
    }   

    public triggerLineFocus = (aggKey: string, splitBy: string) => {
        this.focusedAggKey = null;
        this.focusedSplitby = null;
        this.focusOnlyHoveredSeries(aggKey, splitBy, true);
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

    private focusOnlyHoveredSeries = (aggKey, splitBy, shouldSetFocusedValues: boolean) => {
        if (aggKey !== this.focusedAggKey || splitBy !== this.focusedSplitby) {
            let selectedFilter = Utils.createValueFilter(aggKey, splitBy);

            this.focusMarkerLabel(selectedFilter, aggKey, splitBy);

            this.svgSelection.selectAll(".tsi-valueElement")
                .attr("stroke-opacity", this.nonFocusStrokeOpactiy)
                .attr("fill-opacity", .3);
            this.svgSelection.selectAll(".tsi-valueEnvelope")
                .attr("fill-opacity", .1);

            this.svgSelection.selectAll(".tsi-valueElement")
                .filter(selectedFilter)
                .attr("stroke-opacity", this.strokeOpacity)
                .attr("fill-opacity", 1);
            this.svgSelection.selectAll(".tsi-valueEnvelope")
                .filter(selectedFilter)
                .attr("fill-opacity", .3);

            if (shouldSetFocusedValues) {
                this.focusedAggKey = aggKey;
                this.focusedSplitby = splitBy;
            }
        }
    }

    private discreteEventsMouseover = (d, x, y, width) => {
        if (this.isDroppingMarker) {
            return false;
        }
        this.legendObject.triggerSplitByFocus(d.aggregateKey, d.splitBy);
        this.focusOnlyHoveredSeries(d.aggregateKey, d.splitBy, true);

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
        this.resetValueElementsFocus();
        this.tooltip.hide();
    }
    private mismatchingChartType (aggKey) {
        if (!this.plotComponents[aggKey]) {
            return false;
        }
        let typeOfPlot = this.plotComponents[aggKey].plotDataType;
        return typeOfPlot !== this.getDataType(aggKey);
    }

    //returns false if supressed via isDroppingMarker, true otherwise
    private categoricalMouseover = (d, x, y, endDate, width) => {
        if (this.isDroppingMarker) {
            return false;
        }
        this.legendObject.triggerSplitByFocus(d.aggregateKey, d.splitBy);
        this.focusOnlyHoveredSeries(d.aggregateKey, d.splitBy, true);

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
        this.resetValueElementsFocus();
        this.tooltip.hide();
    }

    private setHorizontalValuePosAndText (d: any, xPos: number, xValue: any, shiftMillis: number) {
        var bucketSize = this.chartComponentData.displayState[d.aggregateKey].bucketSize;
        var endValue = bucketSize ? (new Date(xValue.valueOf() + bucketSize)) : null;
        
        this.horizontalValueBox.text('')
            .style('left', `${xPos}px`)
            .style('top', `${(this.chartMargins.top + this.chartHeight + VALUEBARHEIGHT)}px`)
            .style('display', 'block');
        this.horizontalValueBox.append('div')
            .attr('class', 'tsi-valueBoxText')
            .text(Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
                this.chartOptions.offset, this.chartOptions.is24HourTime, shiftMillis, null, this.chartOptions.dateLocale)(xValue))
        if (endValue !== null) {
            this.horizontalValueBox.append('div')
                .attr('class', 'tsi-valueBoxText')
                .text(Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
                    this.chartOptions.offset, this.chartOptions.is24HourTime, shiftMillis, null, this.chartOptions.dateLocale)(endValue))
        }
            

    }

    private setVerticalValueAndPosition (yValue: number, yPos) {
        this.verticalValueBox.style('top', `${yPos}px`)
            .style('right', `${(this.chartMargins.right + this.chartWidth)}px`)
            .style('display', 'block')
            .text(Utils.formatYAxisNumber(yValue));
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
        this.focus.select('.tsi-hLine').attr("transform", "translate(" + (-xPos) + ",0)");
        this.focus.select('.tsi-vLine').attr("transform", "translate(0," + (-yPos) + ")");

        this.setHorizontalValuePosAndText(d, xPos + this.getSVGLeftOffset() + this.chartMargins.left, xValue, shiftMillis);
        this.setVerticalValueAndPosition(yValue, yPos + this.chartMargins.top);
        
        var bucketSize = this.chartComponentData.displayState[d.aggregateKey].bucketSize;
        var endValue = bucketSize ? (new Date(xValue.valueOf() + bucketSize)) : null;

        if (endValue) {
            let barWidth = this.x(endValue) - this.x(xValue);
            this.horizontalValueBar
                .style('display', 'block')
                .attr("x1", (-barWidth / 2))
                .attr("x2", (barWidth / 2))
                .attr('y1', this.chartHeight - yPos + 2)
                .attr('y2', this.chartHeight - yPos + 2)
        } else {
            this.horizontalValueBar.style('display', 'none');
        }
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
        if (this.getDataType(aggKey) !== DataTypes.Numeric || !this.chartOptions.shouldSticky) {
            return;
        }
        this.chartComponentData.stickiedKey = null;
        (<any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel')).classed("stickied", false);
        // recompute voronoi with no sticky
        this.voronoiDiagram = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues));
        this.chartOptions.onUnsticky(aggKey, splitby);
    }

    private stickySeries = (aggregateKey: string, splitBy: string = null) => {
        if (this.getDataType(aggregateKey) !== DataTypes.Numeric || !this.chartOptions.shouldSticky) {
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

    private getMarkerMarginLeft () {
        var legendWidth = this.legendObject.legendElement.node().getBoundingClientRect().width;
        return this.chartMargins.left + (this.chartOptions.legend === "shown" || this.chartOptions.legend === "hidden" ? legendWidth : 0) + 
            (this.chartOptions.legend === "shown" ? this.GUTTERWIDTH : 0);
    }

    public exportMarkers () {
        this.chartOptions.markers = Object.keys(this.markerGuidMap)
            .filter((markerGuid) => !this.activeMarker || this.activeMarker.getGuid() !== markerGuid)
            .map((markerGuid) => {return [this.markerGuidMap[markerGuid].getMillis(), this.markerGuidMap[markerGuid].getLabelText()]});
        this.chartOptions.onMarkersChange(this.chartOptions.markers);
    }

    private createOnMarkerChange (markerGuid: string, marker: any) {
        return (isDeleting, droppedMarker, shouldSort: boolean = true) => {
            if (droppedMarker) {
                this.markerGuidMap[markerGuid] = marker;
            }
            else if (isDeleting) {
                delete this.markerGuidMap[markerGuid];

                //set focus to first marker if markers exist on delete
                let visibleMarkers: any = Object.values(this.markerGuidMap).filter((marker: Marker) => {
                    return marker.isMarkerInRange();
                });
                if (visibleMarkers.length !== 0) {
                    visibleMarkers[0].focusCloseButton();
                } else {
                    this.focusOnEllipsis();
                }
            }   
            this.exportMarkers();
            if (shouldSort)
                this.sortMarkers();
        }
    }

    private renderMarker (marker: Marker, millis: number, onChange: any = null, labelText: string = null, isSeriesLabels: boolean = false) {
        marker.render(millis, this.chartOptions, this.chartComponentData, {
            chartMargins: this.chartMargins,
            x: this.x,
            marginLeft: this.getMarkerMarginLeft() + (isSeriesLabels ? this.getAdditionalOffsetFromHorizontalMargin() : 0),
            colorMap: this.colorMap,
            yMap: this.yMap,
            onChange: onChange,
            chartHeight: this.height,
            isDropping: false,
            labelText: labelText,
            isSeriesLabels: isSeriesLabels
        });
    }

    private sortMarkers () {
        d3.select(this.renderTarget).selectAll(".tsi-markerContainer").sort((a: any, b: any) =>  {
            return (a.timestamp < b.timestamp) ? 1 : -1;
        });
    }

    private getAllLinesTransitionsComplete () {
        return new Promise ((resolve, reject) => {
            let checkAllLines = (numberOfAttempts: number = 0) => {
                if (numberOfAttempts < 5) {
                    setTimeout(() => {
                        let allOutOfTransition = true;
                        d3.select(this.renderTarget).selectAll('.tsi-gapLine').data().forEach((d: any) => {
                            allOutOfTransition = allOutOfTransition && !d.inTransition;
                        });
                        d3.select(this.renderTarget).selectAll('.tsi-valueLine').data().forEach((d: any) => {
                            allOutOfTransition = allOutOfTransition && !d.inTransition;
                        });
                        if (allOutOfTransition){
                            resolve(null);
                        } else {
                            checkAllLines(numberOfAttempts + 1);
                        }
                    }, Math.max(this.TRANSDURATION, 250));
                } else {
                    reject();
                }
            }
            checkAllLines(0);
        });
    }

    private importMarkers () {
        if (this.chartOptions.markers && this.chartOptions.markers.length > 0) {
            // delete all the old markers
            if (Object.keys(this.markerGuidMap).length) {
                Object.keys(this.markerGuidMap).forEach((guid) => {
                    this.markerGuidMap[guid].destroyMarker();
                    delete this.markerGuidMap[guid];
                });
            }
            this.markerGuidMap = {};            
            this.chartOptions.markers.forEach((markerValueTuples, markerIndex) => {
                if (markerValueTuples === null || markerValueTuples === undefined) {
                    return;
                }
                let marker = new Marker(this.renderTarget);
                let markerUID = Utils.guid();

                let markerMillis;
                if (typeof markerValueTuples === 'number') {
                    markerMillis = markerValueTuples;
                    marker.setLabelText(`${this.getString('Marker')} ${markerIndex + 1}`);
                } else {
                    marker.setLabelText(markerValueTuples[1]);
                    markerMillis = markerValueTuples[0];
                }
                marker.setMillis(markerMillis);
                this.markerGuidMap[markerUID] = marker;
            });
            this.renderAllMarkers();
            this.sortMarkers();
        }
    }


    private createSeriesLabelsMarker () {
        this.seriesLabelsMarker = new Marker(this.renderTarget);
    }

    private renderSeriesLabelsMarker () {
        if (this.chartOptions.labelSeriesWithMarker) {
            this.renderMarker(this.seriesLabelsMarker, this.x.domain()[1], () => {}, null, true);
        }
    }

    private renderAllMarkers () {
        this.getAllLinesTransitionsComplete().then(() => {
            Object.keys(this.markerGuidMap).forEach((guid) => {
                let marker = this.markerGuidMap[guid];
                let onChange = this.createOnMarkerChange(guid, marker);
                this.renderMarker(marker, marker.getMillis(), onChange)
            });
            if (this.seriesLabelsMarker) {
                this.renderSeriesLabelsMarker();
            }    
        });
    }

    private focusOnEllipsis () {
        if (this.ellipsisContainer !== null) {
            this.ellipsisContainer.select(".tsi-ellipsisButton").node().focus();
        }
    }

    private filteredValueExist = () => {
        var filteredValues = this.getFilteredAndSticky(this.chartComponentData.allValues);
        return !(filteredValues == null || filteredValues.length == 0)
    }

    public addMarker = () => {
        if (this.isFirstMarkerDrop) {
            this.isFirstMarkerDrop = false;
            this.createMarkerInstructions();
        }
        this.isDroppingMarker = !this.isDroppingMarker;
        if (!this.isDroppingMarker) {
            this.destroyMarkerInstructions();
            return;
        }

        Utils.focusOnEllipsisButton(this.renderTarget);
        
        let marker = new Marker(this.renderTarget);
        let markerUID = Utils.guid();
        let onChange = this.createOnMarkerChange(markerUID, marker);
        this.activeMarker = marker;
        this.markerGuidMap[markerUID] = marker;
        this.renderMarker(marker, Infinity, onChange, `${this.getString('Marker')} ${Object.keys(this.markerGuidMap).length}`);
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
        if (!this.isDroppingMarker) {
            this.voronoiMouseover(site.data);  
        } else {
            let rawTime = this.x.invert(mx);
            let closestTime = Utils.findClosestTime(rawTime.valueOf(), this.chartComponentData.timeMap);
            this.renderMarker(this.activeMarker, closestTime);
            return;
        }

        if (site.data.aggregateKey !== this.focusedAggKey || site.data.splitBy !== this.focusedSplitby) {
            let selectedFilter = Utils.createValueFilter(site.data.aggregateKey, site.data.splitBy);
            this.focusMarkerLabel(selectedFilter, site.data.aggregateKey, site.data.splitBy);
            this.focusOnlyHoveredSeries(site.data.aggregateKey, site.data.splitBy, true);
        }
    } 

    private voronoiContextMenu (d3Event, mouseEvent) {
        if (!this.filteredValueExist() || !this.voronoiExists()) return;
        const [mx, my] = d3.pointer(d3Event, mouseEvent);
        const site: any = this.voronoiDiagram.find(mx, my);
        if (this.chartComponentData.displayState[site.data.aggregateKey].contextMenuActions && 
            this.chartComponentData.displayState[site.data.aggregateKey].contextMenuActions.length) {
            var mousePosition = d3.pointer(d3Event, <any>this.targetElement.node());

            let sitePageCoords;
            if (this.hasBrush) {
                sitePageCoords = this.brushElem.node().getBoundingClientRect();
            } else {
                sitePageCoords = this.voronoiRegion.node().getBoundingClientRect();
            }
            
            let eventSite = {pageX: sitePageCoords.left + site[0], pageY: sitePageCoords.top + site[1] - 12}

            d3Event.preventDefault();
            this.contextMenu.draw(this.chartComponentData, this.renderTarget, this.chartOptions, 
                                mousePosition, site.data.aggregateKey, site.data.splitBy, null,
                                site.data.dateTime, null, eventSite);
            if (this.brushContextMenu) {
                this.brushContextMenu.hide();
            }
            this.voronoiMouseover(site.data);
        }
    }

    private voronoiClick (d3Event, mouseEvent) {
        //supress if the context menu is visible
        if (this.contextMenu && this.contextMenu.contextMenuVisible)
            return;
    
        if (!this.filteredValueExist() || !this.voronoiExists()) return;
        if (this.brushElem && !this.isDroppingMarker) return;
        const [mx, my] = d3.pointer(d3Event, mouseEvent);
        var site: any = this.voronoiDiagram.find(mx, my);
        let cDO = this.getCDOFromAggKey(site.data.aggregateKey);
        if (!this.isDroppingMarker) {
            if (site.data && cDO.onElementClick !== null) {
                cDO.onElementClick(site.data.aggregateKey, site.data.splitBy, site.data.dateTime.toISOString(), site.data.measures);
            } else {
                if (this.chartComponentData.stickiedKey !== null) {
                    site = this.voronoiDiagram.find(mx, my);
                    this.voronoiMousemove(site.data);
                    this.unstickySeries(site.data.aggregateKey, site.data.splitBy);
                    return;
                }
                this.stickySeries(site.data.aggregateKey, site.data.splitBy);    
            }
        } else {
            if (!this.hasBrush) {
                this.isDroppingMarker = false;
            }
        }

        this.destroyMarkerInstructions();
        if (Utils.safeNotNullOrUndefined(() => this.activeMarker)) {
            this.activeMarker.onChange(false, true);
            this.exportMarkers();
            this.activeMarker = null;
        }
    }

    private getValueOfVisible (d) {
        return Utils.getValueOfVisible(d, this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy));
    }

    private brushBrush (event) {
        var handleHeight = this.getHandleHeight();
        this.brushElem.selectAll('.handle')
            .attr('height', handleHeight)
            .attr('y', (this.chartHeight - handleHeight) / 2);

        if (!event.sourceEvent){
            return;
        } 
        if (event.sourceEvent && event.sourceEvent.type === 'mousemove') {
            this.brushElem.select(".selection").attr("visibility", "visible");
            //check boundary conditions for width of the brush
            if (event.selection[1] - event.selection[0] < this.minBrushWidth) {
                return;
            } else {
                this.brushElem.selectAll(".handle").attr("visibility", "visible");
            }
        }
        if (this.surpressBrushTimeSet == true) {
            this.surpressBrushTimeSet = false;
            return;
        }
        if (!event.selection) return; 

        if (this.contextMenu)
            this.contextMenu.hide();
        if (this.brushContextMenu)
            this.brushContextMenu.hide();
        
        var newBrushStartPosition = event.selection[0];
        var newBrushEndPosition = event.selection[1];
        if (newBrushStartPosition != this.brushStartPosition) {
            this.brushStartTime = this.x.invert(event.selection[0]);
            this.brushStartPosition = newBrushStartPosition;
        }
        if (newBrushEndPosition != this.brushEndPosition) {
            this.brushEndTime = this.x.invert(event.selection[1]);
            this.brushEndPosition = newBrushEndPosition;
        }
    
        if (this.chartOptions.brushMoveAction) {
            this.chartOptions.brushMoveAction(this.brushStartTime, this.brushEndTime);
        }
    }

    private brushEnd (d3Event, mouseEvent) {
        if (this.isClearingBrush) {
            this.isClearingBrush = false;
            if (this.brushContextMenu) {
                this.brushContextMenu.hide();
            }
            return;
        }
        if (d3Event && d3Event.selection == null && d3Event.sourceEvent && d3Event.sourceEvent.type == "mouseup" && this.chartOptions.minBrushWidth == 0) {
            if (this.brushContextMenu) {
                this.brushContextMenu.hide();
            }
            const [mx, my] = d3.pointer(d3Event, mouseEvent);
            var site: any = this.voronoiDiagram.find(mx, my);
            let isClearingBrush = (this.brushStartPosition !== null) && (this.brushEndPosition !== null);
            if (this.chartComponentData.stickiedKey !== null && !this.isDroppingMarker && !isClearingBrush) {
                this.chartComponentData.stickiedKey = null;
                (<any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel')).classed("stickied", false);
                // recompute voronoi with no sticky
                this.voronoiDiagram = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues));
                site = this.voronoiDiagram.find(mx, my);
                this.voronoiMousemove(site.data);
                this.chartOptions.onUnsticky(site.data.aggregateKey, site.data.splitBy);
                return;
            }

            this.brushStartTime = null;
            this.brushEndTime = null;
            this.brushStartPosition = null;
            this.brushEndPosition = null;

            if (!this.isDroppingMarker && !isClearingBrush && !(this.contextMenu && this.contextMenu.contextMenuVisible)) {
                this.stickySeries(site.data.aggregateKey, site.data.splitBy);
            } else {
                this.isDroppingMarker = false;
            }
            return;
        }

        if (d3Event.selection == null) {
            if (!this.chartOptions.brushClearable) {
                d3.select(mouseEvent).transition().call(d3Event.target.move, [this.x(this.brushStartTime), this.x(this.brushEndTime)]);
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
                var newBrushStartTime = findClosestTime(d3Event.selection[0]);
                var newBrushEndTime = findClosestTime(d3Event.selection[1]);
                if (newBrushStartTime != this.brushStartTime || newBrushEndTime != this.brushEndTime) {
                    this.brushStartTime = newBrushStartTime;
                    this.brushEndTime = newBrushEndTime;
                    this.brushStartPosition = this.x(this.brushStartTime);
                    this.brushEndPosition = this.x(this.brushEndTime);
                    transformCall = () => d3.select(mouseEvent).transition().call(d3Event.target.move, [this.x(this.brushStartTime), this.x(this.brushEndTime)]);
                    isZeroWidth = this.x(this.brushStartTime) == this.x(this.brushEndTime);
                }
            }
        }
        if (d3Event.selection[1] - d3Event.selection[0] < this.minBrushWidth) {
            let rightSide = Math.min(d3Event.selection[0] + this.minBrushWidth, this.x.range()[1]);
            transformCall = () => d3.select(mouseEvent).transition().call(d3Event.target.move, [rightSide - this.minBrushWidth, rightSide]);
            isZeroWidth = (rightSide - this.minBrushWidth == rightSide);
        }
        if (this.chartOptions.brushMoveEndAction && (d3Event.sourceEvent && d3Event.sourceEvent.type == 'mouseup')) {
            this.chartOptions.brushMoveEndAction(this.brushStartTime, this.brushEndTime);
        }
        if (this.chartOptions.brushContextMenuActions && this.chartOptions.autoTriggerBrushContextMenu && 
            (d3Event.sourceEvent && d3Event.sourceEvent.type == 'mouseup')) {
            if (!this.chartOptions.brushContextMenuActions || this.chartOptions.brushContextMenuActions.length == 0)
                return;
            var mousePosition = d3.pointer(d3Event, <any>this.targetElement.node());
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

    private focusMarkerLabel (filterFunction, aggKey, splitBy) {
        Utils.revertAllSubtitleText(d3.select(this.renderTarget).selectAll(".tsi-markerValue"), .2);


        d3.select(this.renderTarget).selectAll(".tsi-markerValue")
            .filter(filterFunction)
            .style("opacity", 1)
            .classed('tsi-isExpanded', true)
            .each(function () {
                Utils.setSeriesLabelSubtitleText(d3.select(this).selectAll('.tsi-tooltipSubtitle'), true);
            });
        
        d3.select(this.renderTarget).selectAll(".tsi-markerContainer").each(function () {
            d3.select(this).selectAll(".tsi-markerValue").sort(function (a: any, b: any) { 
                return (a.aggregateKey == aggKey && (splitBy == null || splitBy == a.splitBy)) ? 1 : -1;            
            });
        });
    }  

    public labelMouseout = () => {
        if (this.svgSelection) {    
            Utils.revertAllSubtitleText(d3.select(this.renderTarget).selectAll('.tsi-markerValue'));
            this.svgSelection.selectAll(".tsi-valueElement")
                .filter(function () { return !d3.select(this).classed("tsi-valueEnvelope"); })
                .attr("stroke-opacity", 1)
                .attr("fill-opacity", 1);
            this.svgSelection.selectAll(".tsi-valueEnvelope")
                .attr("fill-opacity", .3);
        }
    }

    public labelMouseover = (aggregateKey: string, splitBy: string = null) => {
        this.focusOnlyHoveredSeries(aggregateKey, splitBy, false);
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

    private getSVGLeftOffset () {
        return this.chartOptions.legend === 'shown' ? (this.width - this.svgSelection.node().getBoundingClientRect().width) : 0;
    }

    public updateBrushRange () {
        let svgLeftOffset = this.getSVGLeftOffset();
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

    public getYExtents(){
        return this.chartComponentData.yExtents;
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
        let visibleGroups = this.data.filter((agg) => this.chartComponentData.displayState[agg.aggKey]["visible"]);
        let visibleCDOs = this.aggregateExpressionOptions.filter((cDO) => this.chartComponentData.displayState[cDO.aggKey]["visible"]);
        return visibleGroups.filter((aggKey, i) => {
            return visibleCDOs[i].dataType === DataTypes.Numeric;
        }).length;
    }

    private getSwimlaneOffsets (linechartTopPadding: number, visibleGroups: Array<ChartDataOptions>, visibleCDOs: Array<ChartDataOptions>, heightPerNumeric: number, swimLaneSet: any) {
        let cumulativeOffset = LINECHARTTOPPADDING;
        //initialize to null and set while going through swimLanes
        let visibleGroupEndValues = visibleGroups.map(() => null);

        Object.keys(swimLaneSet).sort((a, b) => (Number(a) <= Number(b) ? -1 : 1)).forEach((swimLaneStr) => {
            // find all numerics and set to cumulative offset/height per non numeric
            let swimlane = Number(swimLaneStr);
            let hasNumeric = false;
            visibleCDOs.forEach((aggGroup, i) => {
                if (aggGroup.swimLane === swimlane && aggGroup.dataType === DataTypes.Numeric) {
                    hasNumeric = true;
                    visibleGroupEndValues[i] = [cumulativeOffset, heightPerNumeric];
                }
            });

            // find all non-numerics and set their offset/heights
            let swimLaneOffset = hasNumeric ? heightPerNumeric : 0;

            let currGroupsHeight = 0;
            if (this.chartOptions.swimLaneOptions && this.chartOptions.swimLaneOptions[swimlane] && this.chartOptions.swimLaneOptions[swimlane].collapseEvents) {
                swimLaneOffset += this.getEventsCollapsedSwimlaneHeight(visibleCDOs, swimlane);
                visibleCDOs.forEach((aggGroup, i) => {
                    if (aggGroup.swimLane === swimlane) {
                        visibleGroupEndValues[i] = [cumulativeOffset, this.getEventsCollapsedSwimlaneHeight(visibleCDOs, swimlane)]
                    }
                });    
            } else {
                visibleCDOs.forEach((aggGroup, i) => {
                    if (aggGroup.swimLane === swimlane && aggGroup.dataType !== DataTypes.Numeric) {
                        let currGroupsHeight = Utils.getNonNumericHeight(aggGroup.height);
                        visibleGroupEndValues[i] = [swimLaneOffset + cumulativeOffset, currGroupsHeight]
                        swimLaneOffset += currGroupsHeight;
                    }
                });    
            }
            cumulativeOffset += swimLaneOffset; 
        });
        return visibleGroupEndValues;
    }

    private setSwimLaneYExtents (visibleGroups, visibleCDOs, swimLanes, swimLaneOptions) {
        let extents = {};
        swimLanes.forEach((lane) => {
            let extent = [];

            // Check if swim lane options sets y-axis extents for this lane. If so use that
            // value for yExtents.
            if(swimLaneOptions && swimLaneOptions[lane] && swimLaneOptions[lane].yExtent) {
                extents[lane] = swimLaneOptions[lane].yExtent;
                return;
            }

            visibleGroups.forEach((aggGroup, i) => {
                let cDO = visibleCDOs[i];
                if (cDO.dataType !== DataTypes.Numeric) {
                    return;
                }
                let aggValues = [];
                if (cDO.swimLane === lane) {
                    let aggKey = cDO.aggKey;
                    Object.keys(this.chartComponentData.visibleTAs[aggKey]).forEach((splitBy) => {
                        aggValues = aggValues.concat(this.chartComponentData.visibleTAs[aggKey][splitBy]);
                    });    
                    let yExtent = this.getYExtent(aggValues, 
                        this.chartComponentData.displayState[aggKey].includeEnvelope ? 
                            this.chartComponentData.displayState[aggKey].includeEnvelope : 
                            this.chartOptions.includeEnvelope, aggKey);
                    extent = d3.extent(yExtent.concat(extent));
                    extents[lane] = extent;
                }
            });
        });

        this.swimlaneYExtents = extents;
    }

    private getEventsCollapsedSwimlaneHeight (visibleCDOs, swimlane) {
        // if a swimlane has collapsed events, the events height impact is the largest height of a visible events group in the swimlane
        let rawHeight = visibleCDOs.reduce((tallest, currGroup) => {
            if (currGroup.dataType === DataTypes.Events && currGroup.swimLane === swimlane) {
                return Math.max(tallest, currGroup.height);
            } 
            return tallest;
        }, 0);
        return rawHeight !== 0 ? Utils.getNonNumericHeight(rawHeight) : 0;
    }

    //returns an array of tuples of y offset and height for each visible aggregate group 
    private createYOffsets () {
        let visibleGroups = this.data.filter((agg) => this.chartComponentData.displayState[agg.aggKey]["visible"]);
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

        let fixedEventsHeight = 0;
        if (this.chartOptions.swimLaneOptions) {
            Object.keys(this.chartOptions.swimLaneOptions).forEach((swimlaneKey) => {
                let swimlane = Number(swimlaneKey)
                let sLO = this.chartOptions.swimLaneOptions[swimlane];
                if (sLO.collapseEvents) {
                    let swimlaneHeight = this.getEventsCollapsedSwimlaneHeight(visibleCDOs, swimlane);
                    fixedEventsHeight += swimlaneHeight;
                }    
            });
        }
        let heightNonNumeric = visibleCDOs.reduce((sumPrevious, currGroup, i) => {
            if (currGroup.dataType === DataTypes.Events && this.chartOptions.swimLaneOptions && this.chartOptions.swimLaneOptions[currGroup.swimLane] && this.chartOptions.swimLaneOptions[currGroup.swimLane].collapseEvents) {
                return sumPrevious;
            }
            return sumPrevious + (currGroup.dataType !== DataTypes.Numeric ? Utils.getNonNumericHeight(currGroup.height) : 0);
        }, 0);
        heightNonNumeric += fixedEventsHeight;
        
        let heightPerNumeric = (useableHeight - heightNonNumeric) / countNumericLanes;
        
        this.setSwimLaneYExtents(
            visibleGroups, 
            visibleCDOs, 
            Object.keys(swimLaneSet)
                .filter((lane) => swimLaneSet[lane])
                .map((stringLane) => Number(stringLane)),
            this.chartOptions.swimLaneOptions
        );
        return this.getSwimlaneOffsets(linechartTopPadding, visibleGroups, visibleCDOs, heightPerNumeric, swimLaneSet);
    }

    private heightNonNumeric () {
        let visibleCDOs = this.aggregateExpressionOptions.filter((agg) => this.chartComponentData.displayState[agg.aggKey]["visible"]);
        return visibleCDOs.reduce((sumPrevious, currGroup) => {
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
            // consolidate horizontal markers
            if (this.chartOptions.swimLaneOptions) {
                const horizontalMarkers = [];
                Object.values(this.chartOptions.swimLaneOptions).forEach((lane) => {
                    horizontalMarkers.push(...lane.horizontalMarkers);
                });
                this.chartOptions.swimLaneOptions = {0: {yAxisType: this.chartOptions.yAxisState, horizontalMarkers: horizontalMarkers}};
            }
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

    private getHorizontalMarkersWithYScales ()  {
        let visibleCDOs = this.aggregateExpressionOptions.filter((cDO) => this.chartComponentData.displayState[cDO.aggKey]["visible"]);
        const markerList = [];
        const pushMarker = (cDO, marker, markerList) => {
            if (this.chartOptions.yAxisState === YAxisStates.Overlap) {
                return;
            }
            const domain = this.chartOptions.yAxisState === YAxisStates.Stacked ? 
                this.swimlaneYExtents[cDO.swimLane] :
                this.swimlaneYExtents[0];
            // filter out markers not in the y range of that lane and in lanes that have overlap axis
            if (domain && 
                this.chartOptions.swimLaneOptions?.[cDO.swimLane]?.yAxisType !== YAxisStates.Overlap &&
                marker.value >= domain[0] && 
                marker.value <= domain[1]) {
                markerList.push({yScale: this.yMap[cDO.aggKey], ...marker});
            }
        }
        visibleCDOs.forEach((cDO) => {
            cDO.horizontalMarkers.forEach((horizontalMarkerParams: HorizontalMarker) => {
                pushMarker(cDO, horizontalMarkerParams, markerList);
            });
        });

        // find a visible CDO for a swimlane 
        const findFirstVisibleCDO = (swimlaneNumber) => {
            return visibleCDOs.find((cDO) => {
                return (cDO.swimLane === swimlaneNumber);
            });
        }

        if (this.chartOptions.yAxisState !== YAxisStates.Overlap && this.chartOptions.swimLaneOptions) {
            Object.keys(this.chartOptions.swimLaneOptions).forEach((swimlaneNumber) => {
                const swimlaneOptions = this.chartOptions.swimLaneOptions[swimlaneNumber];
                swimlaneOptions.horizontalMarkers?.forEach((horizontalMarkerParams: HorizontalMarker) => {
                    const firstVisibleCDO = findFirstVisibleCDO(Number(swimlaneNumber));
                    if (firstVisibleCDO) {
                        pushMarker(firstVisibleCDO, horizontalMarkerParams, markerList);
                    }
                });
            });
        }
        return markerList;
    }

    // having horizontal markers present should add additional right hand margin to allow space for series labels 
    private getAdditionalOffsetFromHorizontalMargin () {
        return this.getHorizontalMarkersWithYScales().length ? 16 : 0;
    }

    private drawHorizontalMarkers () {
        const markerList = this.getHorizontalMarkersWithYScales();
        const self = this;

        const markerContainers = this.svgSelection.select('.svgGroup').selectAll('.tsi-horizontalMarker')
            .data(markerList);
        markerContainers
            .enter()
            .append('g')
            .merge(markerContainers)
            .attr('class', 'tsi-horizontalMarker')
            .attr("transform", (marker) => {
                return "translate(" + 0 + "," + marker.yScale(marker.value) + ")";
            })
            .each(function (marker) {
                const valueText = d3.select(this)
                    .selectAll<SVGTextElement, unknown>('.tsi-horizontalMarkerText')
                    .data([marker.value]);
                valueText
                    .enter() 
                    .append('text')
                    .merge(valueText)
                    .attr('class', 'tsi-horizontalMarkerText')
                    .attr('x', self.chartWidth)
                    .attr('y', -4)
                    .text((value) => value);
                valueText.exit().remove();

                const valueLine = d3.select(this)
                    .selectAll<SVGLineElement, unknown>('.tsi-horizontalMarkerLine')
                    .data([marker]);
                valueLine
                    .enter()
                    .append('line')
                    .merge(valueLine)
                    .attr('class', 'tsi-horizontalMarkerLine')
                    .attr('stroke', marker => marker.color)
                    .attr('x1', 0)
                    .attr('y1', 0)
                    .attr('x2', self.chartWidth)
                    .attr('y2', 0);
                valueLine.exit().remove();
            });
        markerContainers.exit().remove();
    }

    private createSwimlaneLabels(offsetsAndHeights, visibleCDOs){

        // swimLaneLabels object contains data needed to render each lane label
        let swimLaneLabels: {
            [key: number]: {
                offset: number,
                height: number,
                label: string | null,
                onClick: () => any;
            }
        } | {} = {};

        /* 
            The logic below constructs swimlane labels. The first aggregate found in each
            lane is used to position that lanes label. Numeric aggs are prioritized first,
            as they share a y-Axis, meaning only the first numeric in each lane needs to be
            considered.  Next, non-numerics are checked, if they are the first agg found in 
            their lane, their position data is used, otherwise, their height is added to the 
            current height of the lane. 
        */
       
        const useAggForLaneLabel = (aggGroup) => {
            let swimLane = aggGroup.swimLane;
            let aggIndex = visibleCDOs.findIndex(el => el.aggKey === aggGroup.aggKey);
            let onClick = null;
            if(typeof this.chartOptions?.swimLaneOptions?.[swimLane]?.onClick === 'function'){
                onClick = () => this.chartOptions?.swimLaneOptions?.[swimLane]?.onClick?.(swimLane)
            }
            swimLaneLabels[swimLane] = {
                offset: offsetsAndHeights[aggIndex][0],
                height: offsetsAndHeights[aggIndex][1],
                label: this.chartOptions?.swimLaneOptions?.[swimLane]?.label,
                onClick
            }
        }

        // First add numeric dataTypes (share Y-Axis) to label map
        visibleCDOs.filter(aggGroup => aggGroup.dataType === DataTypes.Numeric).forEach(aggGroup => {
            if(!(aggGroup.swimLane in swimLaneLabels)){ // Only add swimlanes once to swimLaneLabels map
                useAggForLaneLabel(aggGroup);
            }
        })

        // Then, map over any non-numeric dataType and increment heights if they're sharing a lane
        visibleCDOs.filter(aggGroup => aggGroup.dataType !== DataTypes.Numeric).forEach(aggGroup => {
            let aggIndex = visibleCDOs.findIndex(el => el.aggKey === aggGroup.aggKey);
            if(!(aggGroup.swimLane in swimLaneLabels)){ // Only add swimlanes once to swimLaneLabels map
                useAggForLaneLabel(aggGroup);
            } else{ // if lane contains non-numeric data and is being added to another lane
                if(!this.chartOptions?.swimLaneOptions?.[aggGroup.swimLane]?.collapseEvents){ // Only increment event heights if collapseEvents === false
                    swimLaneLabels[aggGroup.swimLane].height += offsetsAndHeights[aggIndex][1]; // add heights (non-numerics don't share Y axis)
                }
            }
        });

        // Clear prior labels
        this.swimLaneLabelGroup.selectAll('*').remove();

        // Function to trim labels to max height
        const truncateLabel = (labelRef: HTMLElement, data) => {
            const maxHeight = data.height - swimlaneLabelConstants.swimLaneLabelHeightPadding; // padding on actual lane height
            if(data.label){
                let labelClientRect = labelRef.getBoundingClientRect();
                let labelText = labelRef.textContent;

                while ( labelClientRect.height > maxHeight && labelText.length > 0) {
                    labelText = labelText.slice(0, -1);
                    labelRef.textContent = labelText + '...';
                    labelClientRect = labelRef.getBoundingClientRect();
                }
            }
        }

        const boldYAxisText = (enabled: boolean, lane: string) => {
            this.svgSelection.select('.svgGroup')
                .selectAll(`.tsi-swimLaneAxis-${lane}`)
                .selectAll('text')
                .classed('tsi-boldYAxisText', enabled)
        }

        const onClickPresentAndValid = (dp) => dp.onClick && typeof dp.onClick === 'function';
        
        // Map over swimLanes and create labels
        Object.keys(swimLaneLabels).forEach(lane => {
            let labelData = [swimLaneLabels[lane]];
            let label = this.swimLaneLabelGroup.selectAll(`tsi-swimLaneLabel-${lane}`).data(labelData);

            label.enter()
                .append("text")
                .attr("class", (d) => `tsi-swimLaneLabel-${lane} tsi-swimLaneLabel ${onClickPresentAndValid(d) ? 'tsi-boldOnHover' : ''}`)
                .merge(label)
                .style("text-anchor", "middle")
                .attr("transform", d => `translate(${( -this.horizontalLabelOffset + swimlaneLabelConstants.labelLeftPadding )},${(d.offset + d.height / 2)}) rotate(-90)`)
                .text(d => d.label)
                .each(function(d){truncateLabel(this, d)})
                .on("click", (event, d) => {
                    if(onClickPresentAndValid(d)){
                        d.onClick()
                    }
                })
                .on("mouseover", (event, d) => {
                    if(onClickPresentAndValid(d)){
                        boldYAxisText(true, lane);
                    }
                })
                .on("mouseout", () => {
                    boldYAxisText(false, lane);
                })
                .append("svg:title")
                    .text(d => d.label);

            label.exit().remove();
        })
    }

    public render (data: any, options: any, aggregateExpressionOptions: any) {
        super.render(data, options, aggregateExpressionOptions);

        this.originalSwimLanes = this.aggregateExpressionOptions.map((aEO) => {
            return aEO.swimLane;
        });
        this.originalSwimLaneOptions = options.swimLaneOptions;

        this.hasBrush = options && (options.brushMoveAction || options.brushMoveEndAction || options.brushContextMenuActions);
        this.chartOptions.setOptions(options);
        this.chartMargins.right = this.chartOptions.labelSeriesWithMarker ? (SERIESLABELWIDTH + 8) : LINECHARTCHARTMARGINS.right;
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

        if (this.seriesLabelsMarker && !this.chartOptions.labelSeriesWithMarker) {
            this.seriesLabelsMarker.destroyMarker();
            this.seriesLabelsMarker = null;
        }

        this.strokeOpacity = this.chartOptions.isArea ? .55 : 1;
        this.nonFocusStrokeOpactiy = this.chartOptions.isArea ? .55 : .3;


        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(this.data, this.aggregateExpressionOptions);
        this.chartComponentData.data.forEach((d, i) => {
            this.aggregateExpressionOptions[i].aggKey = d.aggKey;
        });
        if (this.chartOptions.xAxisHidden && this.chartOptions.focusHidden) {
            this.chartMargins.bottom = 5;
        }

        this.chartHeight = Math.max(1, this.height - this.chartMargins.bottom - this.chartMargins.top); 
        this.chartWidth = this.getChartWidth();

        if (this.brush && this.svgSelection.select('.svgGroup').select(".brushElem") && !this.chartOptions.keepBrush) {
            this.brushStartTime = null;
            this.brushEndTime = null;
            this.brushStartPosition = null;
            this.brushEndPosition = null;
            this.clearBrush();
        }
        
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
                                            .attr('title', this.getString('Line chart'))
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
                .attr("transform", "translate(-200,-100)")
                .attr("class", "tsi-focus");
            
            this.focus.append("line")
                .attr("class", "tsi-focusLine tsi-vLine")
                .attr("x1", 0)
                .attr("x2", 0)
                .attr("y1", this.chartOptions.aggTopMargin)
                .attr("y2", this.chartHeight);
            this.focus.append("line")
                .attr("class", "tsi-focusLine tsi-hLine")
                .attr("x1", 0)
                .attr("x2", this.chartWidth)
                .attr("y1", 0)
                .attr("y2", 0);
    
            this.focus.append("circle")
                .attr("r", 4);
    
            this.horizontalValueBox = d3.select(this.renderTarget)
                .append('div')
                .attr('class', 'tsi-horizontalValueBox tsi-chartValueTextBox')
                .style('display', 'none')
                .attr('pointer-events', 'none');

            this.verticalValueBox =  d3.select(this.renderTarget)
                .append('div')
                .attr('class', 'tsi-verticalValueBox')
                .style('display', 'none');
                
            this.horizontalValueBar = this.focus.append('line')
                .attr('y1', 0)
                .attr('y2', 0)
                .attr('class', 'tsi-horizontalValueBar')
                .style('display', 'none');        

            this.swimLaneLabelGroup = g.append("g").
                attr("class", "tsi-swimLaneLabels");

            if (!this.tooltip) {
                this.tooltip = new Tooltip(d3.select(this.renderTarget));                        
            }

            this.draw = (isFromResize = false, event) => {  
                this.minBrushWidth = (this.chartOptions.minBrushWidth) ? this.chartOptions.minBrushWidth : this.minBrushWidth;
                this.focus.attr("visibility", (this.chartOptions.focusHidden) ? "hidden" : "visible");
                this.verticalValueBox.style("visibility", (this.chartOptions.focusHidden) ? "hidden" : "visible");
                this.horizontalValueBox.style("visibility", (this.chartOptions.focusHidden) ? "hidden" : "visible");
                if (this.chartOptions.xAxisHidden && this.chartOptions.focusHidden) {
                    this.chartMargins.bottom = 5;
                }

                // Check if any swimlane labels present & modify left margin if so
                let isLabelVisible = false;
                this.aggregateExpressionOptions.filter((aggExpOpt) => {
                    return this.chartComponentData.displayState[aggExpOpt.aggKey]["visible"];
                }).forEach(visibleAgg => {
                    if(this.originalSwimLaneOptions?.[visibleAgg.swimLane]?.label){
                        isLabelVisible = true;
                    }
                });

                if(isLabelVisible){
                    this.chartMargins.left = this.horizontalLabelOffset;
                } else if(this.chartMargins.left === this.horizontalLabelOffset){
                    this.chartMargins.left = LINECHARTCHARTMARGINS.left;
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

                this.focus.select('.tsi-hLine').attr("x2", this.chartWidth);
                this.focus.select('.tsi-vLine').attr("y2", this.chartHeight);
                this.svgSelection
                    .style("width", this.getSVGWidth() + "px")
                    .style("height", this.height + "px");
                     
                super.themify(this.targetElement, this.chartOptions.theme);

                
                if (!isFromResize) {
                    this.legendObject.draw(
                        this.chartOptions.legend,
                        this.chartComponentData,
                        (aggKey, splitBy) => { this.labelMouseover(aggKey, splitBy); }, 
                        this.svgSelection,
                        this.chartOptions, () => {
                            Utils.revertAllSubtitleText(d3.select(this.renderTarget).selectAll('.tsi-markerValue'));
                        },
                        this.stickySeries,
                        event);
                }        

                this.svgSelection.selectAll(".yAxis").style("visibility", "hidden");    

                this.x = d3.scaleTime()
                            .rangeRound([this.xOffset, Math.max(this.xOffset, this.chartWidth - (2 * this.xOffset))]);
        
                this.y = d3.scaleLinear()
                        .range([Math.max(this.chartHeight - this.heightNonNumeric(), this.chartOptions.aggTopMargin) - LINECHARTTOPPADDING, this.chartOptions.aggTopMargin]);

                var fromAndTo: any = this.chartComponentData.setAllValuesAndVisibleTAs();
                var xExtent: any = (this.chartComponentData.allValues.length != 0) ? d3.extent(this.chartComponentData.allValues, (d: any) => d.dateTime) : [0,1];
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
                var timeSet = new Set(allPossibleTimes);
                this.possibleTimesArray = Array.from(timeSet.values()).sort().map((ts: string) => {
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
                    .extent([[this.xLowerBound, Math.min(this.chartHeight, this.chartOptions.aggTopMargin)],
                             [this.xUpperBound, this.chartHeight]])
                    .on("start", function(event) {
                        if (self.activeMarker !== null && self.isDroppingMarker) {
                            self.voronoiClick(event, this);
                        }
                        var handleHeight = self.getHandleHeight();
                        self.brushElem.selectAll('.handle')
                            .attr('height', handleHeight)
                            .attr('y', (self.chartHeight - handleHeight) / 2)
                            .attr('rx', '4px')
                            .attr('ry', '4px');
                    })
                    .on("brush", function (event) { 
                        self.brushBrush(event); 
                        self.drawBrushRange();
                    })
                    .on("end", function (event) { 
                        self.brushEnd(event, this);
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

                // Add swimlane labels to SVG
                this.createSwimlaneLabels(offsetsAndHeights, visibleCDOs);

                let swimLaneCounts = {};

                // Reset public facing yExtents
                this.chartComponentData.resetYExtents(); 

                let aggregateGroups = this.svgSelection.select('.svgGroup').selectAll('.tsi-aggGroup')
                    .data(visibleCDOs, (agg) => agg.aggKey);
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

                            // Update yExtent index in LineChartData after all local yExtent updates (this is public facing yExtent)
                            // Only update if dataType is numeric
                            if(agg.dataType === 'numeric'){
                                let idx = self.aggregateExpressionOptions.findIndex(el => el.aggKey === aggKey)
                                self.chartComponentData.setYExtents(idx, yExtent);
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

                            let yAxisOnClick = null;
                            if(typeof self.chartOptions?.swimLaneOptions?.[swimLane]?.onClick === 'function'){
                                yAxisOnClick = () => self.chartOptions.swimLaneOptions[swimLane].onClick?.(swimLane);
                            }

                            self.plotComponents[aggKey].render(self.chartOptions, visibleNumericI, agg, true, d3.select(this), self.chartComponentData, axisState, 
                                self.chartHeight, self.visibleAggCount, self.colorMap, self.previousAggregateData, 
                                self.x, self.areaPath, self.strokeOpacity, self.y, self.yMap, defs, visibleCDOs[i], self.previousIncludeDots, offsetsAndHeights[i], 
                                g, mouseoverFunction, mouseoutFunction, yAxisOnClick);
                            
                            //increment index of visible numerics if appropriate
                            visibleNumericI += (visibleCDOs[i].dataType === DataTypes.Numeric ? 1 : 0);
                        });
                    aggregateGroups.exit().remove();
                    /******************** Voronoi diagram for hover action ************************/

                    this.voronoi = d3Voronoi.voronoi()
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
                    
                    voronoiSelection.on("mousemove", function (event) {
                        let mouseEvent = d3.pointer(event);
                        self.voronoiMousemove(mouseEvent);
                    })
                    .on("mouseout", function (event, d)  {
                        if (!self.filteredValueExist() || !self.voronoiExists()) return;
                        const [mx, my] = d3.pointer(event);
                        const site = self.voronoiDiagram.find(mx, my);
                        self.voronoiMouseout(event, site.data); 
                        self.chartOptions.onMouseout();
                        if (self.tooltip)
                            self.tooltip.hide();
                    })
                    .on("contextmenu", function (event, d) {
                        self.voronoiContextMenu(event, this);
                    })
                    .on("click", function (event, d) {
                       self.voronoiClick(event, this);
                    });

                    if (this.brushElem) {
                        this.brushElem.selectAll(".selection, .handle").on("contextmenu", function (event, d) {
                            if (!self.chartOptions.brushContextMenuActions || self.chartOptions.brushContextMenuActions.length == 0 || self.chartOptions.autoTriggerBrushContextMenu)
                                return;
                            var mousePosition = d3.pointer(event, <any>self.targetElement.node());
                            event.preventDefault();
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

                this.renderAllMarkers();
                this.drawHorizontalMarkers();
                this.voronoiDiagram = this.voronoi(this.getFilteredAndSticky(this.chartComponentData.allValues));
            }

            this.legendObject = new Legend(this.draw, this.renderTarget, this.legendWidth);
            this.contextMenu = new ContextMenu(this.draw, this.renderTarget);
            this.brushContextMenu = new ContextMenu(this.draw, this.renderTarget);
            window.addEventListener("resize", (event) => {
                var self = this;
                if (!this.chartOptions.suppressResizeListener) {
                    this.draw(true, event);
                    this.renderAllMarkers();
                }
            });
        }

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(this.data, this.aggregateExpressionOptions);
        this.draw();
        this.gatedShowGrid();
        this.chartOptions.noAnimate = false;  // ensure internal renders are always animated, overriding the users noAnimate option

        if (this.chartOptions.labelSeriesWithMarker && this.seriesLabelsMarker === null) {
            this.createSeriesLabelsMarker();
        } 

        this.renderSeriesLabelsMarker();

        if (this.chartOptions.markers && this.chartOptions.markers.length > 0) {
            this.importMarkers();
        }

        d3.select("html").on("click." + Utils.guid(), (event) => {
            if (this.ellipsisContainer && event.target != this.ellipsisContainer.select(".tsi-ellipsisButton").node()) {
                this.ellipsisMenu.setMenuVisibility(false);
            }
        });

        this.legendPostRenderProcess(this.chartOptions.legend, this.svgSelection, true, () => {                
            this.updateBrushRange();
        });
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
export default LineChart