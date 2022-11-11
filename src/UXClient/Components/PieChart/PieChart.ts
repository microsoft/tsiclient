import * as d3 from 'd3';
import './PieChart.scss';
import Utils from "../../Utils";
import { TooltipMeasureFormat } from "./../../Constants/Enums";
import Legend from './../Legend';
import ContextMenu from './../ContextMenu';
import { PieChartData } from '../../Models/PieChartData';
import Slider from '../Slider';
import Tooltip from '../Tooltip';
import { ChartVisualizationComponent } from '../../Interfaces/ChartVisualizationComponent';


class PieChart extends ChartVisualizationComponent {
    private contextMenu: ContextMenu;
    chartComponentData = new PieChartData();
    
    constructor(renderTarget: Element){
        super(renderTarget);
        this.chartMargins = {
            top: 20,
            bottom: 28,
            left: 0, 
            right: 0
        }
    }

    PieChart() { }

    public render(data: any, options: any, aggregateExpressionOptions: any) {
        super.render(data, options, aggregateExpressionOptions);

        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(this.data, this.chartOptions.timestamp, this.aggregateExpressionOptions);
        var timestamp = (options && options.timestamp != undefined) ? options.timestamp : this.chartComponentData.allTimestampsArray[0];
 
        var targetElement = d3.select(this.renderTarget)
                                .classed("tsi-pieChart", true);

        if (this.svgSelection == null) {
            
            this.svgSelection = targetElement.append("svg")
                .attr("class", "tsi-pieChartSVG tsi-chartSVG")
                .attr('title', this.getString('Pie chart'));
            var g = this.svgSelection.append("g");
            var tooltip = new Tooltip(d3.select(this.renderTarget));
            d3.select(this.renderTarget).append('div').classed('tsi-sliderWrapper', true);

            this.draw = (isFromResize = false, event) => {
                // Determine the number of timestamps present, add margin for slider
                if(this.chartComponentData.allTimestampsArray.length > 1)
                    this.chartMargins.bottom = 68;
                if(this.chartOptions.legend == "compact") {
                    this.chartMargins.top = 68;
                } else {
                    this.chartMargins.top = 20;
                }

                this.width = this.getWidth();
                var height = +targetElement.node().getBoundingClientRect().height;
                if (!isFromResize) {
                    this.chartWidth = this.getChartWidth();
                }
                var chartHeight = height;
                var usableHeight = height - this.chartMargins.bottom - this.chartMargins.top
                var outerRadius = (Math.min(usableHeight, this.chartWidth) - 10) / 2;
                var innerRadius = this.chartOptions.arcWidthRatio && 
                                    (this.chartOptions.arcWidthRatio < 1 && this.chartOptions.arcWidthRatio > 0) ? 
                                    outerRadius - (outerRadius * this.chartOptions.arcWidthRatio) :
                                    0;
                this.svgSelection
                    .attr("width", this.chartWidth)
                    .attr("height", chartHeight)
                this.svgSelection.select("g").attr("transform", "translate(" + (this.chartWidth / 2)  + "," + (chartHeight / 2) + ")");

                var timestamp = (this.chartOptions.timestamp != undefined) ? this.chartOptions.timestamp : this.chartComponentData.allTimestampsArray[0];
                this.chartComponentData.updateFlatValueArray(timestamp);
                super.themify(targetElement, this.chartOptions.theme);


                if (!this.chartOptions.hideChartControlPanel && this.chartControlsPanel === null) {
                    this.chartControlsPanel = Utils.createControlPanel(this.renderTarget, this.CONTROLSWIDTH, this.chartMargins.top, this.chartOptions);
                } else  if (this.chartOptions.hideChartControlPanel && this.chartControlsPanel !== null){
                    this.removeControlPanel();
                }

                if (this.ellipsisItemsExist() && !this.chartOptions.hideChartControlPanel) {
                    this.drawEllipsisMenu();
                    this.chartControlsPanel.style("top", Math.max((this.chartMargins.top - 24), 0) + 'px');
                } else {
                    this.removeControlPanel();
                }


                var labelMouseover = (aggKey: string, splitBy: string = null) => {
                    //filter out the selected timeseries/splitby
                    var selectedFilter = (d: any, j: number ) => {
                        return !(d.data.aggKey == aggKey && (splitBy == null || d.data.splitBy == splitBy))
                    }
        
                    this.svgSelection.selectAll(".tsi-pie-path")
                                .filter(selectedFilter)
                                .attr("stroke-opacity", .3)
                                .attr("fill-opacity", .3);
                }

                var labelMouseout = (aggregateKey: string, splitBy: string) => {
                    this.svgSelection.selectAll(".tsi-pie-path")
                        .attr("stroke-opacity", 1)
                        .attr("fill-opacity", 1);
                }

                function drawTooltip (d: any, mousePosition) {
                    var xPos = mousePosition[0];
                    var yPos = mousePosition[1];
                    tooltip.render(self.chartOptions.theme);
                    let color = Utils.colorSplitBy(self.chartComponentData.displayState, d.data.splitByI, d.data.aggKey, self.chartOptions.keepSplitByColor);
                    tooltip.draw(d, self.chartComponentData, xPos, yPos, {...self.chartMargins, top: 0, bottom: 0}, (text) => {
                        self.tooltipFormat(self.convertToTimeValueFormat(d.data), text, TooltipMeasureFormat.SingleValue);
                    }, null, 20, 20, color);
                }

                this.legendObject.draw(
                    this.chartOptions.legend,
                    this.chartComponentData,
                    labelMouseover, 
                    this.svgSelection,
                    this.chartOptions,
                    labelMouseout,
                    null,
                    event);
                var pie = d3.pie()
                    .sort(null)
                    .value(function(d: any) { 
                        return Math.abs(d.val); 
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

                var self = this;
                function pathMouseout (event, d: any) {
                    if (self.contextMenu && self.contextMenu.contextMenuVisible)
                        return;
                    tooltip.hide();
                    labelMouseout(d.data.aggKey, d.data.splitBy);
                    (<any>self.legendObject.legendElement.selectAll('.tsi-splitByLabel')).classed("inFocus", false);
                } 

                function pathMouseInteraction (event, d: any)  {
                    if (this.contextMenu && this.contextMenu.contextMenuVisible)
                        return;
                    pathMouseout(event, d); 
                    labelMouseover(d.data.aggKey, d.data.splitBy);
                    (<any>self.legendObject.legendElement.selectAll('.tsi-splitByLabel').filter(function (filteredSplitBy: string) {
                        return (d3.select(this.parentNode).datum() == d.data.aggKey) && (filteredSplitBy == d.data.splitBy);
                    })).classed("inFocus", true);
                    drawTooltip(d, d3.pointer(event, self.svgSelection.node()));
                }

                var mouseOutArcOnContextMenuClick = () => {
                    arcEntered.selectAll("path").each(pathMouseout);
                }

                arcEntered.each(function () {
                    var pathElem = d3.select(this).selectAll<SVGPathElement, unknown>(".tsi-pie-path").data(d => [d]);
                    var pathEntered = pathElem.enter()
                        .append("path")
                        .attr("class", "tsi-pie-path")
                        .attr("d", drawArc)
                        .on("mouseover", pathMouseInteraction)
                        .on("mousemove" , pathMouseInteraction)
                        .on("mouseout", pathMouseout)
                        .on("contextmenu", (event, d: any) => {
                            if (self.chartComponentData.displayState[d.data.aggKey].contextMenuActions && 
                                self.chartComponentData.displayState[d.data.aggKey].contextMenuActions.length) {
                                var mousePosition = d3.pointer(event, <any>targetElement.node());
                                event.preventDefault();
                                self.contextMenu.draw(self.chartComponentData, self.renderTarget, self.chartOptions, 
                                                    mousePosition, d.data.aggKey, d.data.splitBy, mouseOutArcOnContextMenuClick,
                                                    new Date(self.chartComponentData.timestamp));
                            }
                        })
                        .each(function(d) { (<any>this)._current = d; })
                        .merge(pathElem)
                        .transition()
                        .duration(self.TRANSDURATION)
                        .ease(d3.easeExp)
                        .attrTween("d", arcTween)
                        .attr("fill", (d: any)  => { 
                            return Utils.colorSplitBy(self.chartComponentData.displayState, d.data.splitByI, d.data.aggKey, self.chartOptions.keepSplitByColor);
                        })
                        .attr("class", "tsi-pie-path");
                });
                arc.exit().remove();

                /******************** Temporal Slider ************************/
                if(this.chartComponentData.allTimestampsArray.length > 1){
                    d3.select(this.renderTarget).select('.tsi-sliderWrapper').classed('tsi-hidden', false);
                    slider.render(this.chartComponentData.allTimestampsArray.map(ts => {
                        var action = () => {
                            this.chartOptions.timestamp = ts;
                            this.render(this.chartComponentData.data, this.chartOptions, this.aggregateExpressionOptions);
                        }
                        return {label: Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
                            this.chartOptions.offset, this.chartOptions.is24HourTime, null, null, this.chartOptions.dateLocale)(new Date(ts)), action: action};
                    }), this.chartOptions, this.chartWidth, Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
                        this.chartOptions.offset, this.chartOptions.is24HourTime, null, null, this.chartOptions.dateLocale)(new Date(this.chartComponentData.timestamp)));
                }
                else{
                    slider.remove();
                    d3.select(this.renderTarget).select('.tsi-sliderWrapper').classed('tsi-hidden', true);
                }

            }

            this.legendObject = new Legend(this.draw, this.renderTarget, this.CONTROLSWIDTH);
            this.contextMenu = new ContextMenu(this.draw, this.renderTarget);
            
            // temporal slider
            var slider = new Slider(<any>d3.select(this.renderTarget).select('.tsi-sliderWrapper').node());
            window.addEventListener("resize", () => {
                if (!this.chartOptions.suppressResizeListener)
                    this.draw();
            });
        }
        this.draw();
        this.gatedShowGrid();

        d3.select("html").on("click." + Utils.guid(), (event) => {
            if (this.ellipsisContainer && event.target != this.ellipsisContainer.select(".tsi-ellipsisButton").node()) {
                this.ellipsisMenu.setMenuVisibility(false);
            }
        });

        this.legendPostRenderProcess(this.chartOptions.legend, this.svgSelection, true);
    }
}
export default PieChart