import * as d3 from 'd3';
import './PieChart.scss';
import {Utils} from "./../../Utils";
import {Legend} from './../Legend/Legend';
import {ContextMenu} from './../ContextMenu/ContextMenu';
import {ChartComponent} from "./../../Interfaces/ChartComponent";
import { ChartComponentData } from '../../Models/ChartComponentData';
import { PieChartData } from '../../Models/PieChartData';
import { Slider } from '../Slider/Slider';
import { Tooltip } from '../Tooltip/Tooltip';
import { ChartOptions } from '../../Models/ChartOptions';


class PieChart extends ChartComponent {
    private svgSelection: any;
    private legendObject: Legend;
    private contextMenu: ContextMenu;
    public draw: any;
    chartComponentData = new PieChartData();
    
    private chartMargins: any = {
        top: 20,
        bottom: 20,
        left: 20, 
        right: 20
    };

    private sliderSpace = 55;

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    PieChart() { }
    public render(data: any, options: any, aggregateExpressionOptions: any) {
        this.chartOptions.setOptions(options);
        var firstTerm = data[0][Object.keys(data[0])[0]];
        var firstSplitByKey = Object.keys(firstTerm)[0];
        var timestamp = (options.timestamp != undefined) ? options.timestamp : Object.keys(firstTerm[firstSplitByKey])[0];
        this.aggregateExpressionOptions = aggregateExpressionOptions;

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, timestamp, aggregateExpressionOptions); 

        var targetElement = d3.select(this.renderTarget)
                                .classed("tsi-pieChart", true);

        if (this.svgSelection == null) {
            
            this.svgSelection = targetElement.append("svg");
            this.svgSelection
                .attr("class", "tsi-pieChartSVG")
            var g = this.svgSelection.append("g");
            var tooltipContainer = this.svgSelection.append("g");

            var tooltip = new Tooltip(tooltipContainer);
            tooltip.render(this.chartOptions.theme);

            this.draw = () => {

                var width = +targetElement.node().getBoundingClientRect().width;
                var height = +targetElement.node().getBoundingClientRect().height;
                var chartWidth = width  - (this.chartOptions.legend == "shown" ? this.CONTROLSWIDTH : 0);
                var chartHeight = height - this.sliderSpace - (this.chartOptions.legend == "compact" ? 60 : 0);
                var outerRadius = (Math.min(chartHeight, chartWidth) - 10) / 2;
                var innerRadius = this.chartOptions.arcWidthRatio && 
                                    (this.chartOptions.arcWidthRatio < 1 && this.chartOptions.arcWidthRatio > 0) ? 
                                    outerRadius - (outerRadius * this.chartOptions.arcWidthRatio) :
                                    0;
                this.svgSelection
                    .attr("width", chartWidth)
                    .attr("height", chartHeight)
                    .style("margin-top", (this.chartOptions.legend == "compact" ? 60 : 0) + 'px')
                this.svgSelection.select("g").attr("transform", "translate(" + (chartWidth / 2)  + "," + (chartHeight / 2) + ")");

                var timestamp = (this.chartOptions.timestamp != undefined) ? this.chartOptions.timestamp : Object.keys(firstTerm[firstSplitByKey])[0];
                this.chartComponentData.updateFlatValueArray(timestamp);
                super.themify(targetElement, this.chartOptions.theme);

                // Determine the number of timestamps present, add margin for slider
                if(this.chartComponentData.allTimestampsArray.length > 1)
                    this.chartMargins.bottom = 80;

                var labelMouseover = (aggKey: string, splitBy: string = null) => {
                    //filter out the selected timeseries/splitby
                    var selectedFilter = (d: any, j: number ) => {
                        return !(d.data.aggKey == aggKey && (splitBy == null || d.data.splitBy == splitBy))
                    }
        
                    this.svgSelection.selectAll(".tsi-pie-path")
                                .filter(selectedFilter)
                                .attr("stroke-opacity", .15)
                                .attr("fill-opacity", .15);
                }

                var labelMouseout = (aggregateKey: string, splitBy: string) => {
                    this.svgSelection.selectAll(".tsi-pie-path")
                        .attr("stroke-opacity", 1)
                        .attr("fill-opacity", 1);
                }

                function drawTooltip (d: any, mousePosition) {
                    var xPos = mousePosition[0] + (chartWidth / 2);
                    var yPos = mousePosition[1] + (chartHeight / 2);
                    tooltipContainer.attr("transform", "translate(" + xPos + "," + yPos + ")");
                    tooltip.draw (d, self.chartComponentData, xPos, yPos, chartWidth , chartHeight, (text) => {
                        text.text(null);
                        //aggregate name 
                        var titleOffset = 25;
                        text.append("tspan")
                            .attr("class", "title")
                            .text(self.chartComponentData.displayState[d.data.aggKey].name);  
                        //split by if appropriate
                        if (d.data.splitBy != "") {
                            text.append("tspan")
                                .attr("class", "value")
                                .attr("x", 0)
                                .attr("y", titleOffset)
                                .text(d.data.splitBy);
                            titleOffset = 45; 
                        }

                        text.append("tspan")
                            .attr("class", "value")
                            .attr("x", 0)
                            .attr("y", titleOffset)
                            .text(Utils.formatYAxisNumber(d.data.value));
                        
                        text.append("tspan")
                            .attr("class", "value")
                            .attr("x", 0)
                            .attr("y", titleOffset + 15)
                            .text((Math.round(1000 * Math.abs(d.data.value) / self.chartComponentData.visibleValuesSum) / 10) + "%");
                    });
                }

                this.legendObject.draw(this.chartOptions.legend, this.chartComponentData, labelMouseover, 
                    this.svgSelection, this.chartOptions, labelMouseout);
                var pie = d3.pie()
                    .sort(null)
                    .value(function(d: any) { 
                        return Math.abs(d.value); 
                    });
                
                var path: any = d3.arc()
                    .outerRadius(outerRadius)
                    .innerRadius(innerRadius);
                
                var arc = g.selectAll(".tsi-pie-arc")
                    .data(pie(this.chartComponentData.flatValueArray));
                var arcEntered = arc
                    .enter().append("g")
                    .merge(arc)
                    .attr("class", "tsi-pie-arc");
                var self = this;

                var drawArc = d3.arc()
                    .innerRadius(innerRadius)
                    .outerRadius(outerRadius);

                function arcTween(a) {
                    var i = d3.interpolate(this._current, a);
                    this._current = i(0);
                    return function(t) {
                      return drawArc(i(t));
                    };
                  }

                var pathMouseout = (d: any) => {
                    if (this.contextMenu && this.contextMenu.contextMenuVisible)
                        return;
                    tooltip.hide();
                    labelMouseout(d.data.aggKey, d.data.splitBy);
                    (<any>self.legendObject.legendElement.selectAll('.splitByLabel')).classed("inFocus", false);
                } 

                function pathMouseInteraction (d: any)  {
                    if (this.contextMenu && this.contextMenu.contextMenuVisible)
                        return;
                    pathMouseout(d); 
                    labelMouseover(d.data.aggKey, d.data.splitBy);
                    (<any>self.legendObject.legendElement.selectAll('.splitByLabel').filter((labelData: any) => {
                        return (labelData[0] == d.data.aggKey) && (labelData[1] == d.data.splitBy);
                    })).classed("inFocus", true);
                    drawTooltip(d, d3.mouse(this));
                }

                var mouseOutArcOnContextMenuClick = () => {
                    arcEntered.selectAll("path").each(pathMouseout);
                }

                arcEntered.each(function () {
                    var pathElem = d3.select(this).selectAll(".tsi-pie-path").data(d => [d]);

                    var pathEntered = pathElem.enter()
                        .append("path")
                        .attr("class", "tsi-pie-path")
                        .attr("d", drawArc)
                        .on("mouseover", pathMouseInteraction)
                        .on("mousemove" , pathMouseInteraction)
                        .on("mouseout", pathMouseout)
                        .on("contextmenu", (d: any, i) => {
                            if (self.chartComponentData.displayState[d.data.aggKey].contextMenuActions && 
                                self.chartComponentData.displayState[d.data.aggKey].contextMenuActions.length) {
                                var mousePosition = d3.mouse(<any>targetElement.node());
                                d3.event.preventDefault();
                                self.contextMenu.draw(self.chartComponentData, self.renderTarget, self.chartOptions, 
                                                    mousePosition, d.data.aggKey, d.data.splitBy, mouseOutArcOnContextMenuClick,
                                                    new Date(self.chartComponentData.timestamp));
                            }
                        })
                        .each(function(d) { (<any>this)._current = d; })
                        .merge(pathElem)
                        .transition()
                        .duration(self.TRANSDURATION)
                        .ease(d3.easeLinear)
                        .attrTween("d", arcTween)
                        .attr("fill", (d: any)  => { 
                            return Utils.colorSplitBy(self.chartComponentData.displayState, d.data.splitByI, d.data.aggKey, self.chartOptions.keepSplitByColor);
                        })
                        .attr("class", "tsi-pie-path");
                });
                arc.exit().remove();

                /******************** Temporal Slider ************************/
                if(this.chartComponentData.allTimestampsArray.length > 1){
                    slider.render(this.chartComponentData.allTimestampsArray.map(ts => {
                        var action = () => {
                            this.chartOptions.timestamp = ts;
                            this.render(this.chartComponentData.data, this.chartOptions, this.aggregateExpressionOptions);
                        }
                        return {label: Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis)(new Date(ts)), action: action};
                    }), this.chartOptions, chartWidth,  Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis)(new Date(this.chartComponentData.timestamp)));
                }
                else
                    slider.remove();
            }

            this.legendObject = new Legend(this.draw, this.renderTarget, this.CONTROLSWIDTH);
            this.contextMenu = new ContextMenu(this.draw, this.renderTarget);
            
            // temporal slider
            var slider = new Slider(this.renderTarget);
            window.addEventListener("resize", () => {
                if (!this.chartOptions.suppressResizeListener)
                    this.draw();
            });
        }
        this.draw();
    }
}
export {PieChart}