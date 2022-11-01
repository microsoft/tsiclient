import * as d3 from 'd3';
import { interpolatePath } from 'd3-interpolate-path';
import './LinePlot.scss';
import { Plot } from '../../Interfaces/Plot';
import Utils from '../../Utils';
import { DataTypes, YAxisStates } from "../../Constants/Enums";
import { AxisState } from '../../Models/AxisState';

class LinePlot extends Plot {
    private defs;
    private chartWidth;
    private y;
    private visibleAggCount;
    private strokeOpacity;
    private previousIncludeDots;
    private areaPath;
    private yAxisState: AxisState;

    constructor (svgSelection) {
        super(svgSelection);
        this.plotDataType = DataTypes.Numeric;
    }

    private getXPosition (d, x) {
        var bucketSize = this.chartComponentData.displayState[d.aggregateKey].bucketSize;
        if (bucketSize) {
            return (x(d.dateTime) + x((new Date(d.dateTime.valueOf() + bucketSize)))) / 2;
        }
        return x(d.dateTime);
    }

    private createAreaPath (y) {
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
            return d.measures ? y(d.measures[this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)]) : 0;
        })
        .y1(this.chartHeight);
    }

   // returns the next visibleAggI
    public render (chartOptions, visibleAggI, agg, aggVisible: boolean, aggregateGroup, chartComponentData, yAxisState: AxisState,  
        chartHeight, visibleAggCount, colorMap, previousAggregateData, x, areaPath, strokeOpacity, y, yMap, defs, chartDataOptions,
        previousIncludeDots, yTopAndHeight, svgSelection, categoricalMouseover, categoricalMouseout, yAxisOnClick) {
        this.previousIncludeDots = previousIncludeDots;
        this.defs = defs;
        this.chartOptions = chartOptions;
        this.chartHeight = chartHeight;
        this.visibleAggCount = visibleAggCount;
        this.chartComponentData = chartComponentData;
        this.x = x;
        this.y = y;
        let aggKey = agg.aggKey;
        this.aggregateGroup = aggregateGroup;
        const yAxisHasOnClick = yAxisOnClick && typeof yAxisOnClick === "function";

        visibleAggI = yAxisState.positionInGroup;

        this.yTop = yTopAndHeight[0];
        this.height = yTopAndHeight[1];
        
        let aggY;
        let aggLine;
        let aggEnvelope;
        let aggGapLine;

        this.yAxisState = yAxisState;
        let yExtent = this.yAxisState.yExtent;
       
            aggY = d3.scaleLinear();
            aggY.range([this.height, this.chartOptions.aggTopMargin]);

            if (this.chartComponentData.aggHasVisibleSplitBys(aggKey)) {
                var yRange = (yExtent[1] - yExtent[0]) > 0 ? yExtent[1] - yExtent[0] : 1;
                var yOffsetPercentage = 10 / (this.chartHeight / ((this.yAxisState.axisType === YAxisStates.Overlap) ? 1 : this.visibleAggCount));
                let yDomainMin = this.chartOptions.isArea ? 
                    (Math.max(yExtent[0] - (yRange * yOffsetPercentage), 0)) : 
                    (yExtent[0] - (yRange * yOffsetPercentage));
                aggY.domain([yDomainMin, yExtent[1] + (yRange * (10 / this.chartHeight))]);
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

        let localY = aggY.copy();
        localY.range([this.yTop + this.height, this.yTop + this.chartOptions.aggTopMargin]);
        yMap[aggKey] = localY;
        
        var yAxis: any = this.aggregateGroup.selectAll(".yAxis")
                        .data([aggKey]);
        var visibleYAxis = (aggVisible && (this.yAxisState.axisType !== YAxisStates.Shared || visibleAggI === 0));

        yAxis = yAxis.enter()
            .append("g")
            .attr("class", `yAxis ${yAxisHasOnClick ? `tsi-clickableYAxis tsi-swimLaneAxis-${this.chartComponentData.displayState[aggKey].aggregateExpression.swimLane}` : ''}`)
            .merge(yAxis)
            .style("visibility", ((visibleYAxis && !this.chartOptions.yAxisHidden) ? "visible" : "hidden"));

        if (this.yAxisState.axisType === YAxisStates.Overlap) {
            yAxis.call(d3.axisLeft(aggY).tickFormat(Utils.formatYAxisNumber).tickValues(yExtent))
                .selectAll("text")
                .attr("y", (d, j) => {return (j == 0) ? (-visibleAggI * 16) : (visibleAggI * 16) })
                .style("fill", this.chartComponentData.displayState[aggKey].color);
        }
        else {
            yAxis.call(d3.axisLeft(aggY).tickFormat(Utils.formatYAxisNumber)
                .ticks(Math.max(2, Math.ceil(this.height/(this.yAxisState.axisType === YAxisStates.Stacked ? this.visibleAggCount : 1)/90))))
                .selectAll("text").classed("standardYAxisText", true)
        }

        // If yAxisOnClick present, attach to yAxis
        if(yAxisHasOnClick){
            yAxis.on("click", () => {
                yAxisOnClick();
            })
            let label = document.getElementsByClassName(`tsi-swimLaneLabel-${agg.swimLane}`)[0];
            if(label){
                yAxis.on("mouseover", () => {
                    label.classList.add("tsi-axisHover");
                    yAxis.selectAll("text").classed("tsi-boldYAxisText", true)
                })
                yAxis.on("mouseout", () => {
                    label.classList.remove("tsi-axisHover");
                    yAxis.selectAll("text").classed("tsi-boldYAxisText", false)
                })
            }
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
        let splitByGroups = this.aggregateGroup.selectAll(".tsi-splitByGroup")
            .data(Object.keys(this.chartComponentData.timeArrays[aggKey]));
        splitByGroups.enter()
            .append("g")
            .attr("class", "tsi-splitByGroup " + agg.aggKey)
            .merge(splitByGroups)
            .each(function (splitBy, j) {
                colorMap[aggKey + "_" + splitBy] = splitByColors[j];
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
                    let previousUndefined = previousAggregateData.get(this) === undefined;
                    return (self.chartOptions.noAnimate || previousUndefined) ? 0 : self.TRANSDURATION
                }

                var gapPath = d3.select(this).selectAll<SVGPathElement, unknown>(".tsi-gapLine")
                    .data(segments.map((d) => {
                        d.inTransition = true;
                        return d;
                    }));
                gapPath.enter()
                    .append("path")
                    .attr("class", "tsi-valueElement tsi-gapLine")
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
                    })
                    .on('end', (d: any) => {
                        d.inTransition = false;
                    });

                var path = d3.select(this).selectAll<SVGPathElement, unknown>(".tsi-valueLine")
                    .data([self.chartComponentData.timeArrays[aggKey][splitBy]].map(d => {
                        d.inTransition = true;
                        return d;
                    }));

                path.enter()
                    .append("path")
                    .attr("class", "tsi-valueElement tsi-valueLine")
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
                    })
                    .on('end', (d: any) => {
                        d.inTransition = false;
                    });

                if (self.chartOptions.includeDots || self.chartComponentData.displayState[aggKey].includeDots) {
                    let dots = d3.select(this).selectAll<SVGCircleElement, unknown>(".tsi-valueDot")
                        .data(self.chartComponentData.timeArrays[aggKey][splitBy].filter((d) => {
                            return d && d.measures && d.measures[self.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)] !== null;
                        }), (d: any, i) => {
                            return d.dateTime.toString();
                        });

                    dots.enter()
                        .append('circle')
                        .attr('class', 'tsi-valueElement tsi-valueDot')
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
                    d3.select(this).selectAll(".tsi-valueDot").remove();
                }
                
                let envelopeData = {};
                if ((self.chartComponentData.displayState[aggKey].includeEnvelope || self.chartOptions.includeEnvelope) && self.chartComponentData.isPossibleEnvelope(aggKey, splitBy)) {
                    envelopeData = self.chartComponentData.timeArrays[aggKey][splitBy].map((d: any) => ({...d, isEnvelope: true}));
                } 
                let envelope = d3.select(this).selectAll<SVGPathElement, unknown>(".tsi-valueEnvelope")
                        .data([envelopeData]);
                    
                envelope.enter()
                    .append("path")
                    .attr("class", "tsi-valueElement tsi-valueEnvelope")
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

                if (self.chartOptions.isArea) {
                    self.createAreaPath(aggY);
                    var area = d3.select(this).selectAll<SVGPathElement, unknown>(".tsi-valueArea")
                        .data([self.chartComponentData.timeArrays[aggKey][splitBy]]);

                    // logic for shiny gradient fill via url()
                    let svgId = Utils.guid();
                    let lg = self.defs.selectAll('linearGradient')
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
                        .attr("class", "tsi-valueArea")
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
                previousAggregateData.set(this, splitBy);
            });
            splitByGroups.exit().remove();
    }
}
export default LinePlot;