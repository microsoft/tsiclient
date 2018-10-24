import * as d3 from 'd3';
import './Heatmap.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { ChartComponent } from '../../Interfaces/ChartComponent';
import { Legend } from '../Legend/Legend';
import { HeatmapCanvas} from '../HeatmapCanvas/HeatmapCanvas';
import { ChartOptions } from '../../Models/ChartOptions';
import { AggregateExpression } from '../../Models/AggregateExpression';

class Heatmap extends ChartComponent {
    private lineHeight = 12;
    private splitByLabelWidth = 140;
    private heatmapWrapper: any;
    private splitByLabels: any;
    private legend: Legend;
    public draw: any;
    private heatmapCanvasMap: any;
    private timeLabels: any;
    private height: number;

    private timeLabelsHeight = 50;

    public render (data, chartOptions, aggregateExpressions) {
        // override visibleSplitByCap
        aggregateExpressions = aggregateExpressions.map((aE: AggregateExpression) => {
            return {...aE, visibleSplitByCap : 10000 };
        });
        this.chartOptions.setOptions(chartOptions);
        var targetElement = d3.select(this.renderTarget).classed("tsi-heatmapComponent", true);
		if(targetElement.style("position") == "static")
            targetElement.style("position", "relative");
        var width: number = targetElement.node().getBoundingClientRect().width - (this.chartOptions.legend == "shown" ? 250 : 0);
        this.height = targetElement.node().getBoundingClientRect().height;

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressions);
            
        if (this.heatmapWrapper == null) {
            this.heatmapWrapper = targetElement.append('div')
                .attr("class", "tsi-heatmapWrapper");

            super.themify(targetElement, this.chartOptions.theme);

            this.draw = () => { 
                width = Math.floor(targetElement.node().getBoundingClientRect().width) - (this.chartOptions.legend == "shown" ? 250 : 0);
                this.height = Math.floor(targetElement.node().getBoundingClientRect().height);
                this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressions);
                this.heatmapWrapper.style("width", (width - 10) + "px");

                var canvasWrapperHeight = this.height - this.timeLabelsHeight;
                this.heatmapCanvasMap = {};
                var visibleAggs = Object.keys(this.chartComponentData.displayState).filter((aggKey) => {
                    return this.chartComponentData.getAggVisible(aggKey);
                });

                var self = this;
                var canvasWrappers = this.heatmapWrapper.selectAll(".tsi-heatmapCanvasWrapper")
                    .data(visibleAggs);
                var canvasesEntered = canvasWrappers.enter()
                    .append("div")
                    .merge(canvasWrappers)
                    .attr("class", "tsi-heatmapCanvasWrapper")
                    .style("height", (d, i) => {
                        return (canvasWrapperHeight * (1 / visibleAggs.length)) + "px"
                    })
                    .style("top", (d, i) => {
                        return ((canvasWrapperHeight * (1 / visibleAggs.length)) * i) + "px";
                    }).each(function (aggKey, aggI) {
                        var heatmapCanvas = new HeatmapCanvas(this);
                        self.heatmapCanvasMap[aggKey] = heatmapCanvas;
                        var renderHeatmapCanvas = () => {

                            function onCellFocus (focusStartTime, focusEndTime, focusX1, focusX2, focusY, splitBy) {
                                self.renderTimeLabels(focusStartTime, focusEndTime, focusX1, focusX2, focusY, (aggI * canvasWrapperHeight / visibleAggs.length));
                                self.legend.legendElement.selectAll('.tsi-splitByLabel').classed("inFocus", false);
                                self.legend.legendElement.selectAll('.tsi-splitByLabel').filter(function (labelData: any) {
                                    return (d3.select(this.parentNode).datum() == aggKey) && (labelData == splitBy);
                                }).classed("inFocus", true);
                            }

                            heatmapCanvas.render(self.chartComponentData, self.chartOptions, aggKey, null, null, onCellFocus, aggI);
                        }
                        renderHeatmapCanvas();         
                    }).on("mouseleave", () => {
                        self.timeLabels.selectAll("*").remove();
                        self.legend.legendElement.selectAll('.tsi-splitByLabel').classed("inFocus", false);
                    })
                canvasWrappers.exit().remove();

                var mouseover = (hoveredAggKey, hoveredSplitBy) => {
                    var heatmapCanvas = self.heatmapCanvasMap[hoveredAggKey];
                    if (heatmapCanvas)
                        heatmapCanvas.render(self.chartComponentData, self.chartOptions, hoveredAggKey, hoveredSplitBy, null, null);
                }
                var mouseout = (selection, hoveredAggKey) => {
                    var heatmapCanvas = self.heatmapCanvasMap[hoveredAggKey];
                    if (heatmapCanvas)
                        heatmapCanvas.render(self.chartComponentData, self.chartOptions, hoveredAggKey, null, null, null);
                }

                this.legend.draw(this.chartOptions.legend, this.chartComponentData, mouseover, 
                    this.heatmapWrapper, this.chartOptions, mouseout);

                //remove all the colorKeys
                this.legend.legendElement.selectAll(".seriesLabel").selectAll(".tsi-splitByLabel").selectAll(".colorKey").style("display", "none");
            }
        }
        this.legend = new Legend(this.draw, this.renderTarget, this.CONTROLSWIDTH);
        this.draw();
        this.timeLabels = this.heatmapWrapper.append('svg').attr("class", "tsi-heatmapTimeLabels");
        window.addEventListener("resize", () => {
            if (!this.chartOptions.suppressResizeListener)
                this.draw();
        });
    }

    public renderTimeLabels = (focusStartTime, focusEndTime, focusX1, focusX2, focusY, yOffset) => {
        this.timeLabels.selectAll("*").remove();
        this.timeLabels.node().parentNode.appendChild(this.timeLabels.node());

        this.timeLabels.append("line").attr("class", "tsi-heatmapFocusLine")
            .attr("x1", focusX1)
            .attr("x2", focusX1)
            .attr("y1", focusY + yOffset)
            .attr("y2", this.height - this.timeLabelsHeight);

        this.timeLabels.append("line").attr("class", "tsi-heatmapFocusLine")
            .attr("x1", focusX2)
            .attr("x2", focusX2)
            .attr("y1", focusY + yOffset)
            .attr("y2", this.height - this.timeLabelsHeight); 
        
        var textBoxG = this.timeLabels.append("g")
            .attr("class", "tsi-heatmapTimeLabelTextBox");

        var text = textBoxG.append("text");
        
        text.append("tspan").text(Utils.timeFormat(false, false, this.chartOptions.offset)(focusStartTime))
            .attr("x", 0)
            .attr("y", 16);
        text.append("tspan").text(Utils.timeFormat(false, false, this.chartOptions.offset)(focusEndTime))
            .attr("x", 0)
            .attr("y", 30);

        var textDimensions = text.node().getBoundingClientRect();
        textBoxG.append("rect")
            .attr("x", - (textDimensions.width / 2) - 5)
            .attr("y", 0)
            .attr("height", textDimensions.height + 10)
            .attr("width", textDimensions.width + 10)

        text.node().parentNode.appendChild(text.node());
        var rawOffset = (focusX1 + focusX2) / 2;
        var leftOffset = ((rawOffset - ((textDimensions.width / 2) + 6)) > 0) ? rawOffset : ((textDimensions.width / 2) + 6);
        textBoxG.attr("transform", "translate(" + leftOffset + "," + (this.height - this.timeLabelsHeight) + ")");
    }
}

export {Heatmap}