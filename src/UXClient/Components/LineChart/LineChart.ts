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

class LineChart extends ChartComponent {
    private svgSelection: any;
    private legendObject: Legend;
    private focus: any;
    private yAxisState: any;
    private contextMenu: ContextMenu;
    private brushContextMenu: ContextMenu;
    private setDisplayStateFromData: any;
    private chartWidth: number;
    private draw: any;
    private events: any;
    private states: any;
    private minBrushWidth = 0;
    chartComponentData = new LineChartData();
    private surpressBrushTimeSet: boolean = false;

    public x: any;
    private brush: any;
    private brushElem: any;
    private brushStartTime: Date;
    private brushEndTime: Date;
    
    private chartMargins: any = {
        top: 8,
        bottom: 40,
        left: 70, 
        right: 60
    };
    private xOffset = 8;
    private aggTopMargin = 12;

    constructor(renderTarget: Element){
        super(renderTarget);
        this.MINHEIGHT = 32;
    }

    LineChart() { 
    }

    private voronoiMouseout (d: any)  {
        //supress if the context menu is visible
        if (this.contextMenu && this.contextMenu.contextMenuVisible)
            return;
        
        this.focus.style("display", "none");
        this.focus.select(".tooltip").style("display", "none");
        (<any>this.legendObject.legendElement.selectAll('.splitByLabel').filter((labelData: any) => {
            return true;
        })).classed("inFocus", false)
        d3.event.stopPropagation();
        this.svgSelection.selectAll(".valueElement")
                    .attr("stroke-opacity", 1)
                    .attr("fill-opacity", 1);

        /** Update y Axis */
        if (this.yAxisState == "overlap") {
            this.svgSelection.selectAll(".yAxis")
                .selectAll("text")
                .style("fill-opacity", 1)
                .classed("standardYAxisText", false)
                .style("font-weight", "normal");
        }
    }

    //get the extent of an array of timeValues
    private getYExtent (aggValues) {   
        var extent = d3.extent(this.getFilteredValues(aggValues), (d: any) => {
            return d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)];
        });
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
            if ((rawRightSide <= this.xOffset) || (rawLeftSide >= (this.chartWidth - (2 * this.xOffset)))) {
                this.brushElem.call(this.brush.move, null);
                this.brushElem.select('.selection').attr("visibility", "hidden");
                return;
            }
            this.brushElem.select(".selection").attr("visibility", "visible");

            let leftSide = Math.min(this.chartWidth - (2 * this.xOffset), Math.max(this.xOffset, this.x(this.brushStartTime)));
            let rightSide = Math.min(this.chartWidth - (2 * this.xOffset), Math.max(this.xOffset, this.x(this.brushEndTime)));
            this.surpressBrushTimeSet = true;
            this.brushElem.call(this.brush.move, [leftSide, rightSide]);
        }
    }

    public render(data: any, options: any, aggregateExpressionOptions: any) {
        this.data = data;
        this.chartOptions = options;
        this.aggregateExpressionOptions = aggregateExpressionOptions;
        var width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
        var height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);
        var legendState: string = (this.chartOptions.legend != undefined) ? this.chartOptions.legend : "shown";
        if (legendState == "compact")
            this.chartMargins.top = 40;
        var namedEvents = (this.chartOptions.events != undefined) ? this.chartOptions.events : null;
        var namedStates = (this.chartOptions.states != undefined) ? this.chartOptions.states : null;  
        this.aggTopMargin = (this.chartOptions.aggTopMargin != undefined) ? this.chartOptions.aggTopMargin : this.aggTopMargin; 
        this.events = (this.chartOptions.events != undefined) ? this.chartOptions.events : null;
        this.states = (this.chartOptions.states != undefined) ? this.chartOptions.states : null;

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressionOptions, this.events, this.states);
        if (this.chartOptions.xAxisHidden && this.chartOptions.focusHidden) {
            this.chartMargins.bottom = 5;
        }

        var timelineHeight = (this.chartComponentData.visibleEventsAndStatesCount * 10);
        var chartHeight = height - this.chartMargins.bottom - this.chartMargins.top - timelineHeight; 
        this.chartWidth = Math.max(0, width - this.chartMargins.left - this.chartMargins.right - (legendState == "shown" ? this.CONTROLSWIDTH : 0));

        if (this.brush && this.svgSelection.select('.svgGroup').select(".brushElem") && !options.keepBrush) {
            this.svgSelection.select('.svgGroup').select(".brushElem").call(this.brush.move, null);
            this.brushStartTime = null;
            this.brushEndTime = null;
        }
        
        if(this.svgSelection == null){
            
            /******************** Static Elements *********************************/
            var targetElement = d3.select(this.renderTarget)
                                .classed("tsi-lineChart", true)
            this.svgSelection = targetElement.append("svg")
                                            .attr("class", "lineChartSVG")
                                            .attr("height", height);
            
            var stackedButton = Utils.createStackedButton(this.svgSelection); 
            stackedButton.on("click", () => {
                if (this.yAxisState == "stacked") 
                    this.yAxisState = "shared";
                else if (this.yAxisState == "shared")
                    this.yAxisState = "overlap";
                else  
                    this.yAxisState = "stacked";
                draw();
            });  
             
            var gridButton: any = Utils.createGridButton(this.svgSelection, this, this.labelFormatUsesSeconds(), 
                                                         this.labelFormatUsesMillis());                
    
            var g = this.svgSelection.append("g")
                        .classed("svgGroup", true)
                        .attr("transform", "translate(" + this.chartMargins.left + "," + this.chartMargins.top + ")");
            
            this.brushElem = null; 
            var voronoiRegion
            if (options.brushContextMenuActions || options.brushMoveAction) {
                this.brushElem = g.append("g")
                    .attr("class", "brushElem");
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
                .attr("y1", this.aggTopMargin)
                .attr("y2", chartHeight + timelineHeight);
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
                .attr("transform", "translate(0," + (chartHeight + this.aggTopMargin) + ")");
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
                .attr("transform", "translate(0," + (chartHeight + this.aggTopMargin) + ")");
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
    
            var tooltip = new Tooltip(this.focus);
            tooltip.render(this.chartOptions.theme);
                        
            this.yAxisState = options.yAxisState ? options.yAxisState : "stacked"; // stacked, shared, overlap
                                
            var draw = () => {  
                const legendState: string = (this.chartOptions.legend != undefined) ? this.chartOptions.legend : "shown";
                const noAnimate: boolean = !!this.chartOptions.noAnimate;
                const tooltipVisible: boolean = !!this.chartOptions.tooltip;
                const snapBrush: boolean = !!this.chartOptions.snapBrush;
                const brushClearable: boolean = !!this.chartOptions.brushClearable;
                this.minBrushWidth = (this.chartOptions.minBrushWidth) ? this.chartOptions.minBrushWidth : this.minBrushWidth;

                this.focus.attr("visibility", (this.chartOptions.focusHidden) ? "hidden" : "visible")
                if (this.chartOptions.xAxisHidden && this.chartOptions.focusHidden) {
                    this.chartMargins.bottom = 5;
                }

                this.chartComponentData.updateVisibleEventsAndStatesCount();
                timelineHeight = (this.chartComponentData.visibleEventsAndStatesCount * 10);
      
                width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
                this.chartWidth = Math.max(0, width - this.chartMargins.left - this.chartMargins.right - (legendState == "shown" ? this.CONTROLSWIDTH : 0));
                height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);
                chartHeight = height - this.chartMargins.bottom - this.chartMargins.top - timelineHeight; 

                this.focus.select('.hLine').attr("x2", this.chartWidth);
                this.focus.select('.vLine').attr("y2", chartHeight + timelineHeight);
                this.svgSelection.attr("width", this.chartWidth + this.chartMargins.left + this.chartMargins.right);   
                this.svgSelection.attr("height", height);
                     
                super.themify(targetElement, this.chartOptions.theme);
                        
                this.legendObject.draw(legendState, this.chartComponentData, labelMouseover, 
                                       this.svgSelection, this.chartOptions, () => {});
    
                this.svgSelection.selectAll('.valueElement').style("visibility", "hidden");
                this.svgSelection.selectAll(".yAxis").style("visibility", "hidden");    

                this.x = d3.scaleTime()
                            .rangeRound([this.xOffset, Math.max(this.xOffset, this.chartWidth - (2 * this.xOffset))]);
        
                var y = d3.scaleLinear()
                        .range([Math.max(chartHeight, this.aggTopMargin), this.aggTopMargin]);

                var fromAndTo: any = this.chartComponentData.setAllValuesAndVisibleTAs();
                var xExtent: any = (this.chartComponentData.allValues.length != 0) ? d3.extent(this.chartComponentData.allValues, (d: any) => d.dateTime) : [0,1];
                var timeSet = d3.set(this.chartComponentData.allValues, (d: any) => d.dateTime);
                var xRange = (this.chartComponentData.allValues.length != 0) ? Math.max(2, (xExtent[1].valueOf() - xExtent[0].valueOf())) : 2;
                var xOffsetPercentage = this.xOffset / this.chartWidth;
                this.x.domain(fromAndTo);
                var xLowerBound = this.x(fromAndTo[0]);
                var xUpperBound = this.x(fromAndTo[1]);

                //allPossibleTimes -> a combination of the beginning and end of buckets
                var startOfBuckets = this.chartComponentData.allValues.map((d: any) => {return d.dateTime});
                var endOfBuckets = this.chartComponentData.allValues.filter((d: any) => {return d.bucketSize != null})
                                        .map((d: any) => {return new Date(d.dateTime.valueOf() + d.bucketSize)});
                var allPossibleTimes = startOfBuckets.concat(endOfBuckets);
                var timeSet = d3.set(allPossibleTimes);
                var possibleTimesArray = timeSet.values().sort().map((ts: string) => {
                    return new Date(ts);
                });

                if (voronoiRegion) {
                    voronoiRegion.attr("x", xOffsetPercentage * this.chartWidth)
                        .attr("y", this.aggTopMargin)
                        .attr("width", this.chartWidth - (xOffsetPercentage * this.chartWidth * 2))
                        .attr("height", chartHeight);
                }

                if (this.brushElem) {
                    var self = this;
                    this.brush = d3.brushX()
                    .extent([[xLowerBound, this.aggTopMargin],
                             [xUpperBound, chartHeight]])
                    .on("brush", function () {
                        if (!d3.event.sourceEvent) return;
                        if (d3.event.sourceEvent && d3.event.sourceEvent.type == 'mousemove') {
                            self.brushElem.select(".selection").attr("visibility", "visible");
                            //check boundary conditions for width of the brush
                            if (d3.event.selection[1] - d3.event.selection[0] < self.minBrushWidth) {
                                return;
                            }
                        }
                        if (self.surpressBrushTimeSet == true) {
                            self.surpressBrushTimeSet = false;
                            return;
                        }
                        if (!d3.event.selection) return; 

                        if (self.contextMenu)
                            self.contextMenu.hide();
                        if (self.brushContextMenu)
                            self.brushContextMenu.hide();
                    
                        self.brushStartTime = self.x.invert(d3.event.selection[0]);
                        self.brushEndTime = self.x.invert(d3.event.selection[1]);
                    
                        if (options.brushMoveAction) {
                            options.brushMoveAction(self.brushStartTime, self.brushEndTime);
                        }
                    })
                    .on("end", function () {
                        if (d3.event.selection == null) {
                            if (!brushClearable)
                                d3.select(this).transition().call(d3.event.target.move, [self.x(self.brushStartTime), self.x(self.brushEndTime)]);
                            return;
                        }
                        if (snapBrush) {
                            //find the closest possible value and set to that
                            if (possibleTimesArray.length > 0) {
                                var findClosestTime = (rawXValue): Date => {
                                    var closestDate = null;
                                    possibleTimesArray.reduce((prev, curr) => {
                                        var prospectiveDiff = Math.abs(rawXValue - self.x(curr));
                                        var currBestDiff = Math.abs(rawXValue - prev);
                                        if (prospectiveDiff < currBestDiff) {
                                            closestDate = curr;
                                            return self.x(curr)
                                        }
                                        return prev;
                                    }, Infinity);
                                    return closestDate;
                                }
                                self.brushStartTime = findClosestTime(d3.event.selection[0]);
                                self.brushEndTime = findClosestTime(d3.event.selection[1]);
                                var endX = findClosestTime(d3.event.selection[1]);
                                d3.select(this).transition().call(d3.event.target.move, [self.x(self.brushStartTime), self.x(self.brushEndTime)]);
                            }
                        }
                        if (d3.event.selection[1] - d3.event.selection[0] < self.minBrushWidth) {
                            let rightSide = Math.min(d3.event.selection[0] + self.minBrushWidth, self.x.range()[1]);
                            d3.select(this).transition().call(d3.event.target.move, [rightSide - self.minBrushWidth, rightSide]);
                            //set time and fire brushMoveAction since this won't happen in on brush
                            self.brushStartTime = self.x.invert(rightSide - self.minBrushWidth);
                            self.brushEndTime = self.x.invert(rightSide);
                            if (options.brushMoveAction) {
                                options.brushMoveAction(self.brushStartTime, self.brushEndTime);
                            }
                        }
                    });
                    this.brushElem.call(this.brush);
                    this.setBrush();
                }
                    
                var yExtent: any = this.getYExtent(this.chartComponentData.allValues);
                var yRange = (yExtent[1] - yExtent[0]) > 0 ? yExtent[1] - yExtent[0] : 1;
                var yOffsetPercentage = 10 / (chartHeight);
                y.domain([yExtent[0] - (yRange * yOffsetPercentage), yExtent[1] + (yRange * yOffsetPercentage)]);

                if (this.chartComponentData.visibleTAs && this.chartComponentData.visibleTSCount != 0) {
                    /******************** Creating this.x, y and line **********************/
        
                    var line = d3.line()
                                .curve(d3.curveMonotoneX)
                                .defined( (d: any) => { 
                                    return (d.measures !== null) && 
                                           (d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)] !== null);
                                })
                                .x((d: any) => {
                                    return this.getXPosition(d, this.x);
                                })
                                .y((d: any) => { 
                                    return d.measures ? y(d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)]) : 90000;
                                });
                    
                    if (!this.chartOptions.xAxisHidden) {
                        var xAxis: any = g.selectAll(".xAxis").data([this.x]);
            
                        var xAxisEntered = xAxis.enter()
                            .append("g")
                            .attr("class", "xAxis")
                            .merge(xAxis)
                            .attr("transform", "translate(0," + (chartHeight + timelineHeight) + ")")
                            .call(d3.axisBottom(this.x)
                                    .ticks(Math.floor(this.chartWidth / 150))
                                    .tickFormat(Utils.timeFormat(this.labelFormatUsesSeconds(), this.labelFormatUsesMillis())));

                                    
                        xAxisEntered.selectAll('text')
                            .call(Utils.splitTimeLabel);

                        xAxisEntered.select(".domain").style("display", "none");
                        xAxis.exit().remove();

                        var xAxisBaseline =  g.selectAll(".xAxisBaseline").data([this.x]);
                        var xAxisBaselineEntered = xAxisBaseline.enter().append("line")
                            .attr("class", "xAxisBaseline")
                            .attr("x1", .5)
                            .merge(xAxisBaseline)
                            .attr("y2", chartHeight + timelineHeight +  .5)
                            .attr("y1", chartHeight + timelineHeight + .5)
                            .attr("x2", this.chartWidth - this.xOffset);
                        xAxisBaseline.exit().remove();
                    }
            
                    /******************** Draw Line and Points ************************/
                    var tsIterator = 0;
                    var visibleAggCount: number = Object.keys(this.chartComponentData.timeArrays).reduce((count: number, aggKey: string): number => {
                        return count + (this.chartComponentData.displayState[aggKey]['visible'] ? 1 : 0);
                    }, 0);
        
                    var yMap = {};
                    
                    var visibleAggI = 0;

                    this.svgSelection.selectAll(".yAxis").remove();

                    this.data.forEach((agg, i) => {
                        var aggKey = agg.aggKey;
                        var aggVisible = this.chartComponentData.displayState[aggKey]["visible"];
                        var aggY;
                        var aggLine;
                        var aggGapLine;
                        var yExtent;
        
                        if ((this.yAxisState == "shared") || (Object.keys(this.chartComponentData.timeArrays)).length < 2 || !aggVisible) {
                            aggY = y;
                            aggLine = line;
                            aggGapLine = null;
                        } else {
                            var aggValues: Array<any> = [];
                            Object.keys(this.chartComponentData.visibleTAs[aggKey]).forEach((splitBy) => {
                                aggValues = aggValues.concat(this.chartComponentData.visibleTAs[aggKey][splitBy]);
                            });
                            aggY = d3.scaleLinear();
                            if (this.yAxisState == "overlap") {
                                aggY.range([chartHeight, this.aggTopMargin]);
                            } else {
                                aggY.range([(chartHeight / visibleAggCount) * (visibleAggI + 1), 
                                            (chartHeight / visibleAggCount) * (visibleAggI) + this.aggTopMargin]);
                            }
                            if (this.chartComponentData.aggHasVisibleSplitBys(aggKey)) {
                                yExtent = this.getYExtent(aggValues);
                                var yRange = (yExtent[1] - yExtent[0]) > 0 ? yExtent[1] - yExtent[0] : 1;
                                var yOffsetPercentage = 10 / (chartHeight / ((this.yAxisState == "overlap") ? 1 : visibleAggCount));
                                aggY.domain([yExtent[0] - (yRange * yOffsetPercentage), 
                                        yExtent[1] + (yRange * yOffsetPercentage)]);
                            } else {
                                aggY.domain([0,1]);
                                yExtent = [0, 1];
                            }
                            aggLine = d3.line()
                                .curve(d3.curveMonotoneX)
                                .defined((d: any) =>  {
                                    return (d.measures !== null) && 
                                           (d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)] !== null);
                                })
                                .x((d: any) => { return this.getXPosition(d, this.x); })
                                .y((d: any) => {                 
                                    return d.measures ? aggY(d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)]) : null;
                                });
                            aggGapLine = aggLine
                        }
        
                        yMap[aggKey] = aggY;
                        
                        var yAxis: any = g.selectAll(".yAxis" + aggKey)
                                        .data([aggY]);
                        var visibleYAxis = (aggVisible && (this.yAxisState != "shared" || visibleAggI == 0));
                        
                        yAxis = yAxis.enter()
                            .append("g")
                            .attr("class", "yAxis yAxis" + aggKey)
                            .merge(yAxis)
                            .style("visibility", ((visibleYAxis && !this.chartOptions.yAxisHidden) ? "visible" : "hidden"));
                        if (this.yAxisState == "overlap" && visibleAggCount > 1) {
                            yAxis.call(d3.axisLeft(aggY).tickFormat(Utils.formatYAxisNumber).tickValues(yExtent))
                                .selectAll("text")
                                .attr("y", (d, j) => {return (j == 0) ? (-visibleAggI * 16) : (visibleAggI * 16) })
                                .style("fill", this.chartComponentData.displayState[aggKey].color);
                        }
                        else {
                            yAxis.call(d3.axisLeft(aggY).tickFormat(Utils.formatYAxisNumber).ticks(4))
                                .selectAll("text").classed("standardYAxisText", true)
                        }
                        yAxis.exit().remove();
        
                        if (aggVisible)
                            visibleAggI += 1;
                        
                        var guideLinesData = {
                            x: this.x,
                            y: aggY,
                            visible: visibleYAxis
                        };
        
                        Object.keys(this.chartComponentData.timeArrays[aggKey]).forEach((splitBy: string, j: number) => {

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
                                .duration(noAnimate ? 0 : this.TRANSDURATION)
                                .ease(d3.easeLinear)                                         
                                // .attr("stroke",  Utils.colorSplitBy(this.chartComponentData.displayState, j, aggKey))
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
                                .duration(noAnimate ? 0 : this.TRANSDURATION)
                                .ease(d3.easeLinear)
                                .attr("stroke",  Utils.colorSplitBy(this.chartComponentData.displayState, j, aggKey, this.chartOptions.keepSplitByColor))                        
                                .attr("d", aggLine);
                            
                            // this.chartComponentData.timeArrays[aggKey][splitBy].forEach()

                            gapPath.exit().remove();
                            path.exit().remove();
                            tsIterator += 1;
                        });
                    }); 
                    
                    
                    /******************** Voronoi diagram for hover action ************************/
                    var getValueOfVisible = (d) => {
                        if (d.measures) {
                            var visibleMeasure = self.chartComponentData.getVisibleMeasure( d.aggregateKey, d.splitBy);
                            if (d.measures[visibleMeasure])
                                return d.measures[visibleMeasure];
                        } 
                        return null;
                    }
                    var self = this;
                    var voronoi = d3.voronoi()
                        .x(function(d: any) { return self.x(d.dateTime); })
                        .y(function(d: any) { 
                            if (d.measures) {
                                var value = getValueOfVisible(d)
                                return yMap[d.aggregateKey](getValueOfVisible(d))
                            }
                            return null;
                        })
                        .extent([[0, 0], [this.chartWidth, chartHeight]]);

                    var voronoiMouseover = (d: any) => {
                        //supress if the context menu is visible
                        if (this.contextMenu && this.contextMenu.contextMenuVisible)
                            return;
                            
                        var yScale = yMap[d.aggregateKey];
                        var xValue = d.dateTime;
                        var xPos = this.getXPosition(d, this.x);
                        var yValue = getValueOfVisible(d);
                        var yPos = yScale(yValue);

                        this.focus.style("display", "block");
                        this.focus.attr("transform", "translate(" + xPos + "," + yPos + ")");
                        this.focus.select('.hLine').attr("transform", "translate(-" + xPos + ",0)");
                        this.focus.select('.vLine').attr("transform", "translate(0,-" + yPos + ")");
                        
                        this.focus.select('.hHoverG')
                            .attr("transform", "translate(0," + (chartHeight + timelineHeight - yPos) + ")");
                        var text = this.focus.select('.hHoverG').select("text").text("");

                        var bucketSize = this.chartComponentData.displayState[d.aggregateKey].bucketSize;
                        var endValue = bucketSize ? (new Date(xValue.valueOf() + bucketSize)) : null;
                        
                        text.append("tspan").text(Utils.timeFormat(false, false)(xValue))
                            .attr("x", 0)
                            .attr("y", 4);
                        if (endValue) {
                            text.append("tspan").text(Utils.timeFormat(false, false)(endValue))
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
                        if (tooltipVisible)
                            tooltip.draw(d, this.chartComponentData, xPos, yPos, this.chartWidth, chartHeight, (text) => {
                                var title = d.aggregateName;   
                                
                                text.append("tspan")
                                    .attr("class", "title")
                                    .text(d.aggregateName);

                                var titleOffset = 24;
                                if (d.splitBy && d.splitBy != ""){
                                    text.append("tspan")
                                        .attr("class", "value")
                                        .attr("y", titleOffset)
                                        .attr("x", 0)
                                        .text(d.splitBy);
                                    titleOffset += this.aggTopMargin;
                                } else {
                                    titleOffset += 4;
                                }
                                                         
                                Object.keys(d.measures).forEach((measureType, i) => {
                                    text.append("tspan")
                                        .attr("x", 0)
                                        .attr("y", (i * 16) + titleOffset)
                                        .attr("class",  () => {
                                            return "value" + (measureType == this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy) ? 
                                                            " visibleValue" : "");
                                        })
                                        .text(measureType + ": " + Utils.formatYAxisNumber(d.measures[measureType]));
                                });
                            });
                        else 
                            tooltip.hide();
                        
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
                            this.svgSelection.select(".yAxis" +  d.aggregateKey)
                                .selectAll("text")
                                .style("fill-opacity", 1)
                                .classed("standardYAxisText", false)
                                .style("font-weight", "bold");
                        }

                        if (this.chartOptions.yAxisHidden) {
                            this.svgSelection.selectAll(".yAxis").style("display", "hidden");
                        } 
                
                        labelMouseover(d.aggregateKey, d.splitBy);
                    }

                    //if brushElem present then use the overlay, otherwise create a rect to put the voronoi on
                    var voronoiSelection;
                    var filteredValueExist = () => {
                        var filteredValues = self.getFilteredValues(self.chartComponentData.allValues);
                        return !(filteredValues == null || filteredValues.length == 0)
                    }
        
                    if (this.brushElem) {
                        voronoiSelection = this.brushElem.select(".overlay");
                    } else {
                        voronoiSelection = voronoiRegion;
                    }
                    voronoiSelection.on("mousemove", function () { 
                        if (!filteredValueExist()) return;
                        const [mx, my] = d3.mouse(this);
                        var filteredValues = self.getFilteredValues(self.chartComponentData.allValues);
                        if (filteredValues == null || filteredValues.length == 0)
                            return
                        const site = voronoi(filteredValues).find(mx, my);
                        self.voronoiMouseout(site.data); 
                        voronoiMouseover(site.data);
                    })
                    .on("mouseout", function (d)  {
                        if (!filteredValueExist()) return;
                        const [mx, my] = d3.mouse(this);
                        const site = voronoi(self.getFilteredValues(self.chartComponentData.allValues)).find(mx, my);
                        self.voronoiMouseout(site.data); 
                    })
                    .on("contextmenu", function (d) {
                        if (!filteredValueExist()) return;
                        const [mx, my] = d3.mouse(this);
                        const site: any = voronoi(self.getFilteredValues(self.chartComponentData.allValues)).find(mx, my);
                        if (self.chartComponentData.displayState[site.data.aggregateKey].contextMenuActions && 
                            self.chartComponentData.displayState[site.data.aggregateKey].contextMenuActions.length) {
                            var mousePosition = d3.mouse(<any>targetElement.node());
                            d3.event.preventDefault();
                            self.contextMenu.draw(self.chartComponentData, self.renderTarget, self.chartOptions, 
                                                mousePosition, site.data.aggregateKey, site.data.splitBy, null,
                                                site.data.dateTime);
                            voronoiMouseover(site.data);
                        }
                    })

                    if (this.brushElem) {
                        this.brushElem.selectAll(".selection, .handle").on("contextmenu", function (d) {
                            if (!self.brushContextMenu)
                                return;
                            var mousePosition = d3.mouse(<any>targetElement.node());
                            d3.event.preventDefault();
                            self.brushContextMenu.draw(self.chartComponentData, self.renderTarget, self.chartOptions, 
                                                mousePosition, null, null, null, self.brushStartTime, self.brushEndTime);
                        });
                    }
                    
                    /******************** Stack/Unstack button ************************/
                    stackedButton.attr("transform", () => {return 'translate(32,' + (chartHeight + timelineHeight + this.aggTopMargin) + ')'})
                                .attr("opacity",  () => {
                                    if (this.yAxisState == "stacked") return 1;
                                    if (this.yAxisState == "shared") return .5
                                    return .2;
                                })
                                .style("display", visibleAggCount < 2 ? "none" : "block");
                                
                    /******************** Grid button ************************/
                    gridButton.attr("transform", () => {return 'translate(' + (this.chartWidth + this.chartMargins.left + 26) + ',' + (chartHeight + this.aggTopMargin + timelineHeight) + ')'})
                                .style("display", !!this.chartOptions.grid ? "block" : "none");
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
                            .style("bottom", this.chartMargins.bottom + timelineHeight - (visibleEventsCount * 10)  + 'px');
                        eventSeriesComponents[i].render(namedEventSeries, {timeFrame: {from : xExtent[0], to: xExtent[1]}, xAxis: "hidden", theme: this.chartOptions.theme});
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
                            .style("bottom", this.chartMargins.bottom + timelineHeight - ((visibleEventsCount * 10) + (visibleStatesCount * 10))  + 'px');
                        stateSeriesComponents[i].render(namedStateSeries, {timeFrame: {from : xExtent[0], to: xExtent[1]}, xAxis: "hidden", theme: this.chartOptions.theme});
                    });
                }
            }
    
            var labelMouseover = (aggregateKey: string, splitBy: string = null) => {
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
                            .attr("stroke-opacity", .12)
                            .attr("fill-opacity", .12);
            }

            this.legendObject = new Legend(draw, this.renderTarget, this.CONTROLSWIDTH);
            this.contextMenu = new ContextMenu(draw, this.renderTarget);
            this.brushContextMenu = new ContextMenu(draw, this.renderTarget);
            this.draw = draw;
            window.addEventListener("resize", this.draw);

            var eventSeriesWrappers;
            var eventSeriesComponents;
            if (this.events && this.events.length > 0) {
                eventSeriesWrappers = this.events.map((events, i) => {
                    return targetElement.append("div").attr("class", "tsi-lineChartEventsWrapper");
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
                    return targetElement.append("div").attr("class", "tsi-lineChartStatesWrapper");
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
        // this.chartOptions.noAnimate = false;
    }
}
export {LineChart}