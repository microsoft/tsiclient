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
                                .style("width", this.legendWidth + "px");
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

        var seriesLabels: any = legend.selectAll(".seriesLabel")
            .data(Object.keys(chartComponentData.timeArrays));

        seriesLabels
            .enter()
            .append("div") 
            .merge(seriesLabels)
            .attr("class", (d, i) => {
                return "seriesLabel " + (chartComponentData.displayState[d]["visible"] ? " shown" : "");
            })
            .style("border-color", function (d, i) {
                if (d3.select(this).classed("shown"))
                    return chartComponentData.displayState[d].color;
                return "lightgray";
            });

        /** Events ************************************************************************************************/

        var events: any = (chartComponentData.displayState.events) ? chartComponentData.displayState.events : [];
        var eventSeriesLabels: any = legend.selectAll(".eventSeriesLabel")
            .data(Object.keys(events));
            var eventSeriesLabelsEntered = eventSeriesLabels
            .enter()
            .append("div")
            .attr("class", (d, i) => "eventSeriesLabel" + (chartComponentData.displayState.events[d].visible ? " shown" : ""))
            .append("div")
            .attr("class", (d, i) => "seriesNameLabel" + (chartComponentData.displayState.events[d].visible ? " shown" : ""));

        eventSeriesLabelsEntered.each(function (d, i) {
            var eyeIcons = d3.select(this).selectAll('.eyeIcon')
                .data([d]);
            eyeIcons
                .enter().append("div")
                .attr("class", "eyeIcon")
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
        var stateSeriesLabels: any = legend.selectAll(".stateSeriesLabel")
            .data(Object.keys(states));
        var stateSeriesLabelsEntered = stateSeriesLabels
            .enter()
            .append("div")
            .attr("class", d => "stateSeriesLabel" + (chartComponentData.displayState.states[d].visible ? " shown" : ""))
            .append("div")
            .attr("class", d => "seriesNameLabel" + (chartComponentData.displayState.states[d].visible ? " shown" : ""));
    
        stateSeriesLabelsEntered.each(function (d, i) {
            var eyeIcons = d3.select(this).selectAll('.eyeIcon')
                .data([d]);
            eyeIcons
                .enter().append("div")
                .attr("class", "eyeIcon")
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
        
        /** Aggregates ********************************************************************************************/
        legend.selectAll(".seriesLabel").html("");

        Object.keys(chartComponentData.timeArrays).forEach((aggKey: string, i) => {

            var splitByLabelData = Object.keys(chartComponentData.timeArrays[aggKey]).map((splitBy) => {
                return [aggKey, splitBy];
            });
            var noSplitBys: boolean = splitByLabelData.length == 1 && splitByLabelData[0][1] == "";
            if(noSplitBys)
                splitByLabelData[0].push(chartComponentData.displayState[aggKey].name);

            /******************** Series Name Label ***********************/
            var seriesNameLabel: any = legend.selectAll('.seriesLabel')
                .filter((d) => {
                    return (d == aggKey);
                })
                .selectAll('.seriesNameLabel')
                .data([aggKey]);
            var enteredSeriesNameLabel = seriesNameLabel
                .enter()       
                .append("div")
                .merge(seriesNameLabel)
                .attr("class", (agg, i) => {
                    return "seriesNameLabel" + (noSplitBys ? ' tsi-nsb' : '') + (chartComponentData.displayState[agg].visible ? " shown" : "");
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



            var seriesNameLabelText = enteredSeriesNameLabel
                .selectAll('h4')
                .data(d => [d]);
            seriesNameLabelText = seriesNameLabelText.enter()
                .append("h4")
                .attr("title", (d: string) => chartComponentData.displayState[d].name)
                .merge(seriesNameLabelText)
                .text((d: string) => chartComponentData.displayState[d].name)

            var firstSplitBy = chartComponentData.displayState[aggKey].splitBys
                                [Object.keys(chartComponentData.displayState[aggKey].splitBys)[0]]
            var firstSplitByType = firstSplitBy ? firstSplitBy.visibleType : null;
            var isSame = Object.keys(chartComponentData.displayState[aggKey].splitBys).reduce((isSame: boolean, curr: string) => {
                return (firstSplitByType == chartComponentData.displayState[aggKey].splitBys[curr].visibleType) && isSame;
            }, true);

            var selectOptions = [];
            if (firstSplitBy) {
                selectOptions = chartComponentData.displayState[aggKey].splitBys[Object.keys(chartComponentData.displayState[aggKey].splitBys)[0]].types;
                var typeSelected = false;
                selectOptions = selectOptions.map((selectOption) => {
                    var isSelectedType = isSame && firstSplitByType == selectOption;
                    if (isSelectedType)
                        typeSelected = true;
                    return [selectOption, isSelectedType];
                });
                if (selectOptions.length > 1 && (selectOptions[selectOptions.length - 1] != "") && !noSplitBys) {
                    selectOptions.push(["", false]);
                }
            }

            var aggs = legend.select('.seriesLabel')
                .filter(d => d == aggKey)
            .selectAll('.seriesNameLabel').selectAll("select").selectAll('option');

            var aggregateTypeSelection: any = enteredSeriesNameLabel
                .selectAll("select").data(d => [d]);

            aggregateTypeSelection = aggregateTypeSelection.enter()
                .append("select")
                .on("change", function (aggKey: any) {
                    var visibleType: any = d3.select(this).property("value");
                    if (visibleType == "")
                        return;
                    Object.keys(chartComponentData.displayState[aggKey].splitBys).forEach((splitBy) => {
                        chartComponentData.displayState[aggKey].splitBys[splitBy].visibleType = visibleType;
                    });
                    self.drawChart();
                }).on("click", () => {
                    d3.event.stopPropagation();
                });

            aggregateTypeSelection.exit().remove();
            
            var aggregateTypeOptions = enteredSeriesNameLabel.select("select").selectAll('option')
                .data(selectOptions);
            aggregateTypeOptions.enter()
                .append("option")
                .merge(aggregateTypeOptions)
                .text(d => d[0])
                .property("selected", (d) => {
                    if (d[1])
                        return "selected";
                    if (d[0] == "" && !typeSelected) // no type selected, set empty string to selected
                        return "selected";
                    return "";
                });
            aggregateTypeOptions.exit().remove();
            seriesNameLabelText.exit().remove();  
            enteredSeriesNameLabel.exit().remove();

            /******************** Split By Labels *************************/

            var splitByLabels: any = legend.selectAll('.seriesLabel')
                .filter(d => d == aggKey)
                .selectAll(".splitByLabel")
                .data(splitByLabelData);
            splitByLabels = splitByLabels                    
                .enter()
                .append("div")
                .merge(splitByLabels)
                .on("click", function (data: any, i: number) {
                    if (legendState == "compact") {
                        toggleSplitByVisible(data[0], data[1])
                    } else {
                        toggleSticky(data[0], data[1]);
                    }
                    self.drawChart();
                })
                .on("mouseover", function(data: any, i: number) {
                    d3.event.stopPropagation();
                    labelMouseover(data[0], data[1]);
                })
                .on("mouseout", function(d: any, i: number) {
                    d3.event.stopPropagation();
                    svgSelection.selectAll(".valueElement")
                                .attr("stroke-opacity", 1)
                                .attr("fill-opacity", 1);
                    labelMouseout(svgSelection, d[0]);
                })
                .attr("class", (data, i) => "splitByLabel splitByLabel" + (Utils.getAgVisible(chartComponentData.displayState, data[0], data[1]) ? " shown" : ""))
                .classed("stickied", (d, i) => {
                    if (chartComponentData.stickiedKey != null) {
                        return d[0] == chartComponentData.stickiedKey.aggregateKey && d[1] == chartComponentData.stickiedKey.splitBy;
                    }
                });


            /******************** Color Blocks ****************************/
            var colors = Utils.createSplitByColors(chartComponentData.displayState, aggKey, this.chartOptions.keepSplitByColor);
            var splitByLabelsBlocks = splitByLabels
                .selectAll('.colorKey')
                .data((d, i) => [[d, i]]);
            splitByLabelsBlocks = splitByLabelsBlocks.enter().append("div")
                .attr("class", "colorKey")
                .merge(splitByLabelsBlocks)
                .style("background-color", (d, j) => {
                    return colors[d[1]];
                });
            splitByLabelsBlocks.exit().remove();

            /******************** Eye Icons *******************************/
            var self = this;
            splitByLabels.each(function (d, i) {
                var eyeIcons = d3.select(this).selectAll('.eyeIcon')
                    .data([d]);
                eyeIcons
                    .enter().append("div")
                    .attr("class", "eyeIcon")
                    .on("click", function (data: any, i: number) {
                        d3.event.stopPropagation();
                        toggleSplitByVisible(data[0], data[1]);
                        d3.select(this)
                            .classed("shown", Utils.getAgVisible(chartComponentData.displayState, data[0], data[1]));
                        self.drawChart();
                    });
            });  

            /******************** Text ************************************/
            var splitByLabelsText = splitByLabels
                .selectAll('h5')
                .data(d => noSplitBys ? [d[2]] : [d[1]]);
            splitByLabelsText = splitByLabelsText.enter()
                .append("h5")
                .merge(splitByLabelsText)
                .text(d => d);
            splitByLabelsText.exit().remove();  
            
            /******************** Select **********************************/
            var seriesTypeSelections = splitByLabels.selectAll('select')
                .data(d => [d]);
            seriesTypeSelections = seriesTypeSelections.enter()
                .append("select")
                .on("change", function (data: any) {
                    var seriesType: any = d3.select(this).property("value");
                    chartComponentData.displayState[data[0]].splitBys[data[1]].visibleType = seriesType; 
                    self.drawChart();
                })
                .on("click", () => {
                    d3.event.stopPropagation();
                })
                .merge(seriesTypeSelections)
                .each(function (d) {
                    var typeLabels = d3.select(this).selectAll('option')
                    .data(data => chartComponentData.displayState[data[0]].splitBys[data[1]].types.map( (type) => {
                        return {
                            type: type,
                            aggKey: data[0],
                            splitBy: data[1],
                            visibleMeasure: Utils.getAgVisibleMeasure(chartComponentData.displayState, data[0], data[1])
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
            seriesTypeSelections.exit().remove();
            splitByLabels.exit().remove();
        });
        seriesLabels.exit().remove();
	}
}

export {Legend}