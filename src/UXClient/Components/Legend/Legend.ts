import * as d3 from 'd3';
import './Legend.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { ChartOptions } from '../../Models/ChartOptions';

class Legend extends Component {
    public drawChart: any;
    public legendElement: any;
    public legendWidth: number;
    private chartOptions: ChartOptions;

	constructor(drawChart: any, renderTarget: Element, legendWidth: number) {
        super(renderTarget);
        this.chartOptions = new ChartOptions();
        this.drawChart = drawChart;
        this.legendWidth = legendWidth;
        this.legendElement = d3.select(renderTarget).insert("div", ":first-child")
                                .attr("class", "tsi-legend")
                                .style("left", "0px")
                                .style("width", (this.legendWidth) + "px"); // - 16 for the width of the padding
    }

    private labelMouseoutWrapper (labelMouseout, svgSelection) {
        return (svgSelection, aggKey) => {
            d3.event.stopPropagation();
            svgSelection.selectAll(".valueElement")
                        .filter(function () { return !d3.select(this).classed("valueEnvelope"); })
                        .attr("stroke-opacity", 1)
                        .attr("fill-opacity", 1);
            svgSelection.selectAll(".valueEnvelope")
                        .attr("fill-opacity", .2);
            labelMouseout(svgSelection, aggKey);
        }
    }

	public draw(legendState, chartComponentData, labelMouseover, svgSelection, options, labelMouseoutAction = null, stickySeriesAction = null) {
        this.chartOptions.setOptions(options);
        var labelMouseout = this.labelMouseoutWrapper(labelMouseoutAction, svgSelection);
        var legend = this.legendElement;
        var self = this;
        
        super.themify(this.legendElement, this.chartOptions.theme);
        
        var toggleSplitByVisible = (aggregateKey: string, splitBy: string) => {
            var newState = !chartComponentData.displayState[aggregateKey].splitBys[splitBy].visible;
            chartComponentData.displayState[aggregateKey].splitBys[splitBy].visible = newState;
            chartComponentData.displayState[aggregateKey].visible = Object.keys(chartComponentData.displayState[aggregateKey].splitBys)
                                            .reduce((prev: boolean, curr: string): boolean => {
                                                return chartComponentData.displayState[aggregateKey]["splitBys"][curr]["visible"] || prev;
                                            }, false);
        //turn off sticky if making invisible
            if (newState == false && (chartComponentData.stickiedKey != null && 
                chartComponentData.stickiedKey.aggregateKey == aggregateKey && 
                chartComponentData.stickiedKey.splitBy == splitBy)) {
                chartComponentData.stickiedKey = null;
            }
        }
        
        var toggleSticky = (aggregateKey: string, splitBy: string) => {
            //don't do anything if not visible 
            if (!chartComponentData.displayState[aggregateKey].visible ||
                !chartComponentData.displayState[aggregateKey].splitBys[splitBy].visible)
                return;
            if (chartComponentData.stickiedKey != null && 
                chartComponentData.stickiedKey.aggregateKey == aggregateKey && 
                chartComponentData.stickiedKey.splitBy == splitBy){
                chartComponentData.stickiedKey = null;
            } else {
                if (stickySeriesAction) {
                    stickySeriesAction(aggregateKey, splitBy);
                }
            }
        }

        if (legendState == "hidden") {
            legend.style("display", "none");
            legend.style("width", "0px"); 
            return; 
        }
        if(legendState == "compact")
            legend.classed("compact", true)
        else
            legend.classed("compact", false)
            
        legend.style("visibility", "visible");
        legend.style("width", this.legendWidth + "px");

        var seriesLabels: any = legend.selectAll(".tsi-seriesLabel")
            .data(Object.keys(chartComponentData.timeArrays));

        var seriesLabelsEntered = seriesLabels.enter()
            .append("div") 
            .merge(seriesLabels)
            .attr("class", (d, i) => {
                return "tsi-seriesLabel " + (chartComponentData.displayState[d]["visible"] ? " shown" : "");
            })
            .style("border-color", function (d, i) {
                if (d3.select(this).classed("shown"))
                    return chartComponentData.displayState[d].color;
                return "lightgray";
            });

        var self = this;
        seriesLabelsEntered.each(function (aggKey: string, i: number) {
            var splitByLabelData = Object.keys(chartComponentData.timeArrays[aggKey]);
            var noSplitBys: boolean = splitByLabelData.length == 1 && splitByLabelData[0] == "";
            var seriesNameLabel = d3.select(this).selectAll(".tsi-seriesNameLabel").data([aggKey]);
            var enteredSeriesNameLabel = seriesNameLabel.enter().append("div")
            .merge(seriesNameLabel)
            .attr("class", (agg: string, i) => {
                return "tsi-seriesNameLabel" + (noSplitBys ? ' tsi-nsb' : '') + (chartComponentData.displayState[agg].visible ? " shown" : "");
            })                    
            .on("click", function (d: string, i: number) {
                var newState = !chartComponentData.displayState[d].visible;
                chartComponentData.displayState[d].visible = newState;

                //turn off sticky if making invisible
                if (newState == false && (chartComponentData.stickiedKey != null && 
                    chartComponentData.stickiedKey.aggregateKey == d)) {
                    chartComponentData.stickiedKey = null;
                }
                self.drawChart();
            })
            .on("mouseover", (d) => {
                labelMouseover(d);
            })
            .on("mouseout", (d) => {
                labelMouseout(svgSelection, d);
            });

            var seriesNameLabelText = enteredSeriesNameLabel.selectAll("h4").data([aggKey]);
            seriesNameLabelText = seriesNameLabelText.enter()
                .append("h4")
                .merge(seriesNameLabelText)
                .attr("title", (d: string) => chartComponentData.displayState[d].name)
                .text((d: string) => chartComponentData.displayState[d].name);

            seriesNameLabelText.exit().remove();
            enteredSeriesNameLabel.exit().remove();

            var firstSplitBy = chartComponentData.displayState[aggKey].splitBys
                                [Object.keys(chartComponentData.displayState[aggKey].splitBys)[0]];
            var firstSplitByType = firstSplitBy ? firstSplitBy.visibleType : null;
            var isSame = Object.keys(chartComponentData.displayState[aggKey].splitBys).reduce((isSame: boolean, curr: string) => {
                return (firstSplitByType == chartComponentData.displayState[aggKey].splitBys[curr].visibleType) && isSame;
            }, true);

            var splitByContainer = d3.select(this).selectAll(".tsi-splitByContainer").data([aggKey]);
            var splitByContainerEntered = splitByContainer.enter().append("div")
                .merge(splitByContainer)
                .classed("tsi-splitByContainer", true);

            var splitByLabels = splitByContainerEntered.selectAll('.tsi-splitByLabel')
                .data(splitByLabelData);
            
            var splitByLabelsEntered = splitByLabels                    
                .enter()
                .append("div")
                .merge(splitByLabels)
                .on("click", function (splitBy: string, i: number) {
                    if (legendState == "compact") {
                        toggleSplitByVisible(aggKey, splitBy)
                    } else {
                        toggleSticky(aggKey, splitBy);
                    }
                    self.drawChart();
                })
                .on("mouseover", function(splitBy: string, i: number) {
                    d3.event.stopPropagation();
                    labelMouseover(aggKey, splitBy);
                })
                .on("mouseout", function(splitBy: string, i: number) {
                    d3.event.stopPropagation();
                    svgSelection.selectAll(".valueElement")
                                .attr("stroke-opacity", 1)
                                .attr("fill-opacity", 1);
                    labelMouseout(svgSelection, splitBy);
                })
                .attr("class", (splitBy, i) => {
                    return "tsi-splitByLabel tsi-splitByLabel" + (Utils.getAgVisible(chartComponentData.displayState, aggKey, splitBy) ? " shown" : "")
                })
                .classed("stickied", (splitBy, i) => {
                    if (chartComponentData.stickiedKey != null) {
                        return aggKey == chartComponentData.stickiedKey.aggregateKey && splitBy == chartComponentData.stickiedKey.splitBy;
                    }
                });

            var colors = Utils.createSplitByColors(chartComponentData.displayState, aggKey, self.chartOptions.keepSplitByColor);

            splitByLabelsEntered.each(function (splitBy, j) {
                d3.select(this).selectAll("*").remove();
                d3.select(this).append("div")
                    .attr("class", 'tsi-colorKey')
                    .style('background-color', () => {
                        return colors[j];
                    });

                d3.select(this).append("div")
                    .attr("class", "tsi-eyeIcon")
                    .on("click", function (data: any, i: number) {
                        d3.event.stopPropagation();
                        toggleSplitByVisible(aggKey, splitBy);
                        d3.select(this)
                            .classed("shown", Utils.getAgVisible(chartComponentData.displayState, aggKey, splitBy));
                        self.drawChart();
                    });

                d3.select(this).append('h5').text(d => (noSplitBys ? (chartComponentData.displayState[aggKey].name): splitBy));      
                
                var seriesTypeSelection = d3.select(this).append("select")
                .on("change", function (data: any) {
                    var seriesType: any = d3.select(this).property("value");
                    chartComponentData.displayState[aggKey].splitBys[splitBy].visibleType = seriesType; 
                    self.drawChart();
                })
                .on("click", () => {
                    d3.event.stopPropagation();
                })
                .each(function (d) {
                    var typeLabels = d3.select(this).selectAll('option')
                    .data(data => chartComponentData.displayState[aggKey].splitBys[splitBy].types.map( (type) => {
                        return {
                            type: type,
                            aggKey: aggKey,
                            splitBy: splitBy,
                            visibleMeasure: Utils.getAgVisibleMeasure(chartComponentData.displayState, aggKey, splitBy)
                        }
                    }));

                    typeLabels
                        .enter()
                        .append("option")
                        .attr("class", "seriesTypeLabel")
                        .merge(typeLabels)
                        .property("selected", (data: any) => {
                            return ((data.type == Utils.getAgVisibleMeasure(chartComponentData.displayState, data.aggKey, data.splitBy)) ? 
                                    " selected" : "");
                        })                           
                        .text((data: any) => data.type);
                    typeLabels.exit().remove();
                });
            });
            splitByLabelsEntered.exit().remove();
            splitByContainerEntered.exit().remove();
        });

        seriesLabelsEntered.exit().remove();

        /** Events ************************************************************************************************/

        var events: any = (chartComponentData.displayState.events) ? chartComponentData.displayState.events : [];
        var eventSeriesLabels: any = legend.selectAll(".tsi-eventSeriesLabel")
            .data(Object.keys(events));
        var eventSeriesLabelsEntered = eventSeriesLabels
            .enter()
            .append("div")
            .attr("class", (d, i) => "tsi-eventSeriesLabel" + (chartComponentData.displayState.events[d].visible ? " shown" : ""))
            .append("div")
            .attr("class", (d, i) => "tsi-seriesNameLabel" + (chartComponentData.displayState.events[d].visible ? " shown" : ""));

        eventSeriesLabelsEntered.each(function (d, i) {
            var eyeIcons = d3.select(this).selectAll('.tsi-eyeIcon')
                .data([d]);
            eyeIcons
                .enter().append("div")
                .attr("class", "tsi-eyeIcon")
                .on("click", function (data: any, i: number) {
                    chartComponentData.displayState.events[d].visible = !chartComponentData.displayState.events[d].visible;
                    self.drawChart();
                });
        });  

        eventSeriesLabels.merge(eventSeriesLabels)
        .classed("shown", (d, i) => {
            return  chartComponentData.displayState.events[d].visible;
        });

        var eventSeriesLabelText = eventSeriesLabelsEntered
            .append("h4");

        eventSeriesLabelText.each(function() {
            var svg = d3.select(this).append("svg")
                            .attr("width", 20)
                            .attr("height", 10);
            Utils.createSeriesTypeIcon("event", svg);
        }); 
        eventSeriesLabelText.html(function(d) { 
            return d3.select(this).html() + events[d].name;
        });

        /** States ************************************************************************************************/
        
        var states: any = (chartComponentData.displayState.states) ? chartComponentData.displayState.states : [];
        var stateSeriesLabels: any = legend.selectAll(".tsi-stateSeriesLabel")
            .data(Object.keys(states));
        var stateSeriesLabelsEntered = stateSeriesLabels
            .enter()
            .append("div")
            .attr("class", d => "tsi-stateSeriesLabel" + (chartComponentData.displayState.states[d].visible ? " shown" : ""))
            .append("div")
            .attr("class", d => "tsi-seriesNameLabel" + (chartComponentData.displayState.states[d].visible ? " shown" : ""));
    
        stateSeriesLabelsEntered.each(function (d, i) {
            var eyeIcons = d3.select(this).selectAll('.tsi-eyeIcon')
                .data([d]);
            eyeIcons
                .enter().append("div")
                .attr("class", "tsi-eyeIcon")
                .on("click", function (data: any, i: number) {
                    chartComponentData.displayState.states[d].visible = !chartComponentData.displayState.states[d].visible;
                    self.drawChart();
                });
        });  

        stateSeriesLabels.merge(stateSeriesLabels)
        .classed("shown", (d, i) => {
            return  chartComponentData.displayState.states[d].visible;
        });

        var stateSeriesLabelText = stateSeriesLabelsEntered
            .append("h4").each(function() {
            var svg = d3.select(this).append("svg")
                            .attr("width", 20)
                            .attr("height", 10);
            Utils.createSeriesTypeIcon("state", svg);
        }); 
        stateSeriesLabelText.html(function(d) { 
            return d3.select(this).html() + states[d].name;
        });
	}
}

export {Legend}