import * as d3 from 'd3';
import './Heatmap.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { ChartComponent } from '../../Interfaces/ChartComponent';
import { Legend } from '../Legend/Legend';
import { HeatmapCanvas} from '../HeatmapCanvas/HeatmapCanvas';
import { ChartOptions } from '../../Models/ChartOptions';
import { AggregateExpression } from '../../Models/AggregateExpression';
import { ChartDataOptions } from '../../Models/ChartDataOptions';
import { EllipsisMenu } from '../EllipsisMenu/EllipsisMenu';

class Heatmap extends ChartComponent {
    private lineHeight = 12;
    private splitByLabelWidth = 140;
    private heatmapWrapper: any;
    private splitByLabels: any;
    private legend: Legend;
    public draw: any;
    private heatmapCanvasMap: any;
    private timeLabels: any = null;
    private height: number;
    private heatmapWrapperHeight: number;
    private timeLabelsHeight = 50;

    private focusOnEllipsis () {
        if (this.ellipsisContainer !== null) {
            this.ellipsisContainer.select(".tsi-ellipsisButton").node().focus();
        }
    }

    private createControlsPanel () {
        this.chartControlsPanel = Utils.createControlPanel(this.renderTarget, this.CONTROLSWIDTH, 52, this.chartOptions);
        this.ellipsisContainer = this.chartControlsPanel.append("div")
            .attr("class", "tsi-ellipsisContainerDiv");
        this.ellipsisMenu = new EllipsisMenu(this.ellipsisContainer.node());
    }

    private ellipsisItemsExist () {
        return (this.chartOptions.canDownload || this.chartOptions.ellipsisItems.length > 0);
    }

    private chartControlsExist () {
        return (this.ellipsisItemsExist() && !this.chartOptions.hideChartControlPanel);
    }

    public render (data, chartOptions, aggregateExpressionOptions) {
        aggregateExpressionOptions = data.map((d, i) => Object.assign(d, aggregateExpressionOptions && i in aggregateExpressionOptions  ? new ChartDataOptions(aggregateExpressionOptions[i]) : new ChartDataOptions({})));
        // override visibleSplitByCap
        aggregateExpressionOptions = aggregateExpressionOptions.map((aE: AggregateExpression) => {
            return {...aE, visibleSplitByCap : 10000 };
        });
        this.chartOptions.setOptions(chartOptions);
        var targetElement = d3.select(this.renderTarget).classed("tsi-heatmapComponent", true);
		if(targetElement.style("position") == "static")
            targetElement.style("position", "relative");
        var width: number = targetElement.node().getBoundingClientRect().width - (this.chartOptions.legend == "shown" ? 250 : 0);
        this.height = targetElement.node().getBoundingClientRect().height;
        this.heatmapWrapperHeight = this.height - ((12 + (this.chartControlsExist() ? 28 : 0) + (this.chartOptions.legend === 'compact' ? 48 : 0)));

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressionOptions);


        if (this.chartControlsExist() && this.chartControlsPanel === null) {
            this.createControlsPanel();
        } else  if ((this.chartOptions.hideChartControlPanel || !this.ellipsisItemsExist()) && this.chartControlsPanel !== null){
            this.chartControlsPanel.remove();
            this.chartControlsPanel = null;
        }

        if (this.chartControlsExist()) {
            this.chartControlsPanel.style("top", (16 + (this.chartOptions.legend === 'compact' ? 32 : 0)) + 'px');
            this.drawEllipsisMenu();
        }
            
        if (this.heatmapWrapper == null) {
            this.heatmapWrapper = targetElement.append('div')
                .attr("class", "tsi-heatmapWrapper");

            this.draw = () => { 
                super.themify(targetElement, this.chartOptions.theme);
                width = Math.floor(targetElement.node().getBoundingClientRect().width) - (this.chartOptions.legend == "shown" ? 250 : 0);
                this.height = Math.floor(targetElement.node().getBoundingClientRect().height);
                this.heatmapWrapper.style("width", (width - 12) + "px")
                    .style("height", this.heatmapWrapperHeight + "px")
                    .style("top", (20 + (this.chartControlsExist() ? 36 : 0) + (this.chartOptions.legend === 'compact' ? 40 : 0)) + "px");

                if (this.chartControlsExist()) {
                    let controlPanelWidth = Utils.getControlPanelWidth(this.renderTarget, this.CONTROLSWIDTH, this.chartOptions.legend === 'shown');
                    this.chartControlsPanel.style("width", controlPanelWidth + "px");
                }    

                var canvasWrapperHeightTotal = this.heatmapWrapperHeight - this.timeLabelsHeight;
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
                        return (canvasWrapperHeightTotal * (1 / visibleAggs.length)) + "px"
                    })
                    .style("top", (d, i) => {
                        return ((canvasWrapperHeightTotal * (1 / visibleAggs.length)) * i) + "px";
                    }).each(function (aggKey, aggI) {
                        var heatmapCanvas = new HeatmapCanvas(this);
                        self.heatmapCanvasMap[aggKey] = heatmapCanvas;
                        var renderHeatmapCanvas = () => {

                            function onCellFocus (focusStartTime, focusEndTime, focusX1, focusX2, focusY, splitBy) {
                                self.renderTimeLabels(focusStartTime, focusEndTime, focusX1, focusX2, focusY, (aggI * canvasWrapperHeightTotal / visibleAggs.length));
                                self.legend.triggerSplitByFocus(aggKey, splitBy);
                            }

                            heatmapCanvas.render(self.chartComponentData, self.chartOptions, aggKey, null, null, onCellFocus, aggI, visibleAggs.length === 1);
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
                        heatmapCanvas.render(self.chartComponentData, self.chartOptions, hoveredAggKey, hoveredSplitBy, null, null, null, visibleAggs.length === 1);
                }
                var mouseout = (selection, hoveredAggKey) => {
                    var heatmapCanvas: HeatmapCanvas = self.heatmapCanvasMap[hoveredAggKey];
                    if (heatmapCanvas)
                        heatmapCanvas.render(self.chartComponentData, self.chartOptions, hoveredAggKey, null, null, null, null, visibleAggs.length === 1);
                }

                this.legend.draw(this.chartOptions.legend, this.chartComponentData, mouseover, 
                    this.heatmapWrapper, this.chartOptions, mouseout);

                //remove all the colorKeys
                this.legend.legendElement.selectAll(".seriesLabel").selectAll(".tsi-splitByLabel").selectAll(".colorKey").style("display", "none");
            }
            this.legend = new Legend(this.draw, this.renderTarget, this.CONTROLSWIDTH);
        }
        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressionOptions);
        this.draw();
        if (this.timeLabels === null) {
            this.timeLabels = this.heatmapWrapper.append('svg').attr("class", "tsi-heatmapTimeLabels");
        }
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
            .attr("y2", this.heatmapWrapperHeight - this.timeLabelsHeight);

        this.timeLabels.append("line").attr("class", "tsi-heatmapFocusLine")
            .attr("x1", focusX2)
            .attr("x2", focusX2)
            .attr("y1", focusY + yOffset)
            .attr("y2", this.heatmapWrapperHeight - this.timeLabelsHeight); 
        
        var textBoxG = this.timeLabels.append("g")
            .attr("class", "tsi-heatmapTimeLabelTextBox");

        var text = textBoxG.append("text");
        
        text.append("tspan").text(Utils.timeFormat(false, false, this.chartOptions.offset, this.chartOptions.is24HourTime)(focusStartTime))
            .attr("x", 0)
            .attr("y", 16);
        text.append("tspan").text(Utils.timeFormat(false, false, this.chartOptions.offset, this.chartOptions.is24HourTime)(focusEndTime))
            .attr("x", 0)
            .attr("y", 30);

        var textDimensions = text.node().getBoundingClientRect();
        textBoxG.append("rect")
            .attr("x", - (textDimensions.width / 2) - 5)
            .attr("y", 0)
            .attr("height", textDimensions.height + 12)
            .attr("width", textDimensions.width + 10)

        text.node().parentNode.appendChild(text.node());
        var rawOffset = (focusX1 + focusX2) / 2;
        var leftOffset = ((rawOffset - ((textDimensions.width / 2) + 6)) > 0) ? rawOffset : ((textDimensions.width / 2) + 6);
        textBoxG.attr("transform", "translate(" + leftOffset + "," + (this.heatmapWrapperHeight - this.timeLabelsHeight) + ")");
    }
}

export {Heatmap}