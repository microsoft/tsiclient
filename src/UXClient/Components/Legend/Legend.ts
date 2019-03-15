import * as d3 from 'd3';
import './Legend.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { ChartOptions } from '../../Models/ChartOptions';
import { ChartComponentData } from '../../Models/ChartComponentData';

class Legend extends Component {
    public drawChart: any;
    public legendElement: any;
    public legendWidth: number;
    private chartOptions: ChartOptions;
    private chartComponentData: ChartComponentData;

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

    public triggerSplitByFocus (aggKey: string, splitBy: string) {
        if (this.chartOptions.legend == "hidden") {
            return;
        }
        this.legendElement.selectAll('.tsi-splitByLabel').classed("inFocus", false);
        this.legendElement.selectAll('.tsi-splitByLabel').filter(function (labelData: any) {
            return (d3.select(this.parentNode).datum() == aggKey) && (labelData == splitBy);
        }).classed("inFocus", true);

        var indexOfSplitBy = Object.keys(this.chartComponentData.displayState[aggKey].splitBys).sort().indexOf(splitBy);

        if (indexOfSplitBy != -1) {
            var splitByNode = this.legendElement.selectAll('.tsi-splitByContainer').filter((d) => {
                return d == aggKey;
            }).node();
            var prospectiveScrollTop = indexOfSplitBy * 40;
            if (splitByNode.scrollTop < prospectiveScrollTop - (splitByNode.clientHeight - 40) || splitByNode.scrollTop > prospectiveScrollTop) {
                splitByNode.scrollTop = prospectiveScrollTop;
            }  
        }
    }

	public draw(legendState, chartComponentData, labelMouseover, svgSelection, options, labelMouseoutAction = null, stickySeriesAction = null) {
        this.chartOptions.setOptions(options);
        this.chartComponentData = chartComponentData;
        var labelMouseout = this.labelMouseoutWrapper(labelMouseoutAction, svgSelection);
        var legend = this.legendElement;
        var self = this;
        
        super.themify(this.legendElement, this.chartOptions.theme);
        
        var toggleSplitByVisible = (aggregateKey: string, splitBy: string) => {
            var newState = !this.chartComponentData.displayState[aggregateKey].splitBys[splitBy].visible;
            this.chartComponentData.displayState[aggregateKey].splitBys[splitBy].visible = newState;
            this.chartComponentData.displayState[aggregateKey].visible = Object.keys(this.chartComponentData.displayState[aggregateKey].splitBys)
                                            .reduce((prev: boolean, curr: string): boolean => {
                                                return this.chartComponentData.displayState[aggregateKey]["splitBys"][curr]["visible"] || prev;
                                            }, false);
        //turn off sticky if making invisible
            if (newState == false && (this.chartComponentData.stickiedKey != null && 
                this.chartComponentData.stickiedKey.aggregateKey == aggregateKey && 
                this.chartComponentData.stickiedKey.splitBy == splitBy)) {
                this.chartComponentData.stickiedKey = null;
            }
        }
        
        var toggleSticky = (aggregateKey: string, splitBy: string) => {
            //don't do anything if not visible 
            if (!this.chartComponentData.displayState[aggregateKey].visible ||
                !this.chartComponentData.displayState[aggregateKey].splitBys[splitBy].visible)
                return;
            if (this.chartComponentData.stickiedKey != null && 
                this.chartComponentData.stickiedKey.aggregateKey == aggregateKey && 
                this.chartComponentData.stickiedKey.splitBy == splitBy){
                this.chartComponentData.stickiedKey = null;
            } else {
                if (stickySeriesAction) {
                    stickySeriesAction(aggregateKey, splitBy);
                }
            }
        }

        legend.style('visibility', legendState != 'hidden')
            .classed('compact', legendState == 'compact')
            .classed('hidden', legendState == 'hidden')
            .style('width', legendState == 'hidden' ? '0px' : this.legendWidth + "px");

        let seriesNames = Object.keys(this.chartComponentData.displayState).filter((seriesName: string) => {
            return (seriesName != 'states' && seriesName != 'events')
        }); 
        var seriesLabels: any = legend.selectAll(".tsi-seriesLabel")
            .data(seriesNames, d => d);

        var seriesLabelsEntered = seriesLabels.enter()
            .append("div") 
            .merge(seriesLabels)
            .attr("class", (d, i) => {
                return "tsi-seriesLabel " + (this.chartComponentData.displayState[d]["visible"] ? " shown" : "");
            })
            .style("min-width", () => {
                return Math.min(124, this.legendElement.node().clientWidth / seriesNames.length) + 'px';  
            })
            .style("border-color", function (d, i) {
                if (d3.select(this).classed("shown"))
                    return self.chartComponentData.displayState[d].color;
                return "lightgray";
            });

        var self = this;

        var events: any = (this.chartComponentData.displayState.events) ? this.chartComponentData.displayState.events : [];
        var states: any = (this.chartComponentData.displayState.states) ? this.chartComponentData.displayState.states : [];

        const heightPerSplitBy: number = 40;
        const heightPerNameLabel: number = 25;
        const verticalPaddingPerSeriesLabel: number = 16;
        const numEventsAndStates = Object.keys(events).length + Object.keys(states).length;
        const usableLegendHeight: number = legend.node().clientHeight - (numEventsAndStates * heightPerNameLabel + 
            (numEventsAndStates > 0 ? verticalPaddingPerSeriesLabel / 2 : 0));
        var prospectiveAggregateHeight = Math.ceil(Math.max(201, (usableLegendHeight / seriesLabelsEntered.size())));
        var contentHeight = 0;

        seriesLabelsEntered.each(function (aggKey: string, i: number) {
            var splitByLabelData = Object.keys(self.chartComponentData.timeArrays[aggKey]);
            var noSplitBys: boolean = splitByLabelData.length == 1 && splitByLabelData[0] == "";
            var seriesNameLabel = d3.select(this).selectAll(".tsi-seriesNameLabel").data([aggKey]);
            d3.select(this).classed('tsi-nsb', noSplitBys);
            var enteredSeriesNameLabel = seriesNameLabel.enter().append("button")
            .merge(seriesNameLabel)
            .attr("class", (agg: string, i) => {
                return "tsi-seriesNameLabel" + (self.chartComponentData.displayState[agg].visible ? " shown" : "");
            }) 
            .attr("aria-label", (agg: string) => "toggle visibility for " + agg)   
            .on("click", function (d: string, i: number) {
                var newState = !self.chartComponentData.displayState[d].visible;
                self.chartComponentData.displayState[d].visible = newState;

                //turn off sticky if making invisible
                if (newState == false && (self.chartComponentData.stickiedKey != null && 
                    self.chartComponentData.stickiedKey.aggregateKey == d)) {
                    self.chartComponentData.stickiedKey = null;
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
            var seriesNameLabelTextEntered = seriesNameLabelText.enter()
                .append("h4")
                .merge(seriesNameLabelText)
                .attr("title", (d: string) => self.chartComponentData.displayState[d].name)
                .text((d: string) => self.chartComponentData.displayState[d].name);

            seriesNameLabelText.exit().remove();
            seriesNameLabel.exit().remove();

            var splitByContainerHeight;
            if (splitByLabelData.length > 4) {
                splitByContainerHeight = prospectiveAggregateHeight - heightPerNameLabel;
                contentHeight += splitByContainerHeight + heightPerNameLabel;
            } else if (splitByLabelData.length > 1 || (splitByLabelData.length == 1 && splitByLabelData[0] != "")) {
                splitByContainerHeight = splitByLabelData.length * heightPerSplitBy + heightPerNameLabel;
                contentHeight += splitByContainerHeight + heightPerNameLabel;
            } else {
                splitByContainerHeight = 44;
                contentHeight += splitByContainerHeight;
            }
            if (self.chartOptions.legend == "shown") {
                d3.select(this).style("height", splitByContainerHeight + "px");
            } else {
                d3.select(this).style("height", "unset");
            }

            var splitByContainer = d3.select(this).selectAll(".tsi-splitByContainer").data([aggKey]);
            var splitByContainerEntered = splitByContainer.enter().append("div")
                .merge(splitByContainer)
                .classed("tsi-splitByContainer", true);


            var renderSplitBys = () => {
                var firstSplitBy = self.chartComponentData.displayState[aggKey].splitBys
                                [Object.keys(self.chartComponentData.displayState[aggKey].splitBys)[0]];
                var firstSplitByType = firstSplitBy ? firstSplitBy.visibleType : null;
                var isSame = Object.keys(self.chartComponentData.displayState[aggKey].splitBys).reduce((isSame: boolean, curr: string) => {
                    return (firstSplitByType == self.chartComponentData.displayState[aggKey].splitBys[curr].visibleType) && isSame;
                }, true);

                var splitByLabels = splitByContainerEntered.selectAll('.tsi-splitByLabel')
                    .data(splitByLabelData.slice(0, self.chartComponentData.displayState[aggKey].shownSplitBys));
                
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
                        labelMouseout(svgSelection, aggKey);
                    })
                    .attr("class", (splitBy, i) => {
                        return "tsi-splitByLabel tsi-splitByLabel" + (Utils.getAgVisible(self.chartComponentData.displayState, aggKey, splitBy) ? " shown" : "")
                    })
                    .classed("stickied", (splitBy, i) => {
                        if (self.chartComponentData.stickiedKey != null) {
                            return aggKey == self.chartComponentData.stickiedKey.aggregateKey && splitBy == self.chartComponentData.stickiedKey.splitBy;
                        }
                    });

                var colors = Utils.createSplitByColors(self.chartComponentData.displayState, aggKey, self.chartOptions.keepSplitByColor);

                splitByLabelsEntered.each(function (splitBy, j) {
                    let color = (self.chartComponentData.isFromHeatmap) ? self.chartComponentData.displayState[aggKey].color : colors[j];
                    let colorKey = d3.select(this).selectAll('.tsi-colorKey').data([color]);
                    colorKey.enter()
                        .append("div")
                        .attr("class", 'tsi-colorKey')
                        .merge(colorKey)
                        .style('background-color', (d) => {
                            return d;
                        });
                    colorKey.exit().remove();

                    if (d3.select(this).select('.tsi-eyeIcon').empty()) {
                        d3.select(this).append("button")
                            .attr("class", "tsi-eyeIcon")
                            .attr('aria-label', "toggle visibility for " + splitBy)
                            .on("click", function (data: any, i: number) {
                                d3.event.stopPropagation();
                                toggleSplitByVisible(aggKey, splitBy);
                                d3.select(this)
                                    .classed("shown", Utils.getAgVisible(self.chartComponentData.displayState, aggKey, splitBy));
                                self.drawChart();
                            });    
                    }

                    if (d3.select(this).select('.tsi-aggName').empty()) {
                        d3.select(this)
                            .append('h5')
                            .attr('class', 'tsi-aggName')
                            .text(d => (noSplitBys ? (self.chartComponentData.displayState[aggKey].name): splitBy));      
                    }
                    
                    if (d3.select(this).select('.tsi-seriesTypeSelection').empty()) {
                        d3.select(this).append("select")
                            .attr('aria-label', "Series type selection for " + splitBy)
                            .attr('class', 'tsi-seriesTypeSelection')
                            .on("change", function (data: any) {
                                var seriesType: any = d3.select(this).property("value");
                                self.chartComponentData.displayState[aggKey].splitBys[splitBy].visibleType = seriesType; 
                                self.drawChart();
                            })
                            .on("click", () => {
                                d3.event.stopPropagation();
                            });
                    }
                    d3.select(this).select('.tsi-seriesTypeSelection')
                        .each(function (d) {
                            var typeLabels = d3.select(this).selectAll('option')
                            .data(data => self.chartComponentData.displayState[aggKey].splitBys[splitBy].types.map( (type) => {
                                return {
                                    type: type,
                                    aggKey: aggKey,
                                    splitBy: splitBy,
                                    visibleMeasure: Utils.getAgVisibleMeasure(self.chartComponentData.displayState, aggKey, splitBy)
                                }
                            }));

                            typeLabels
                                .enter()
                                .append("option")
                                .attr("class", "seriesTypeLabel")
                                .merge(typeLabels)
                                .property("selected", (data: any) => {
                                    return ((data.type == Utils.getAgVisibleMeasure(self.chartComponentData.displayState, data.aggKey, data.splitBy)) ? 
                                            " selected" : "");
                                })                           
                                .text((data: any) => data.type);
                            typeLabels.exit().remove();
                        });
                });
                splitByLabels.exit().remove();

                return [splitByContainer, splitByContainerEntered];
            }
            var sBs = renderSplitBys();
            var splitByContainer = sBs[0];
            var splitByContainerEntered = sBs[1];
            splitByContainerEntered.on("scroll", function () {
                if (self.chartOptions.legend == "shown") {
                    if ((<any>this).scrollTop + (<any>this).clientHeight + 40 > (<any>this).scrollHeight) {
                        const oldShownSplitBys = self.chartComponentData.displayState[aggKey].shownSplitBys; 
                        self.chartComponentData.displayState[aggKey].shownSplitBys = Math.min(oldShownSplitBys + 20, splitByLabelData.length);
                        if (oldShownSplitBys != self.chartComponentData.displayState[aggKey].shownSplitBys) {
                            renderSplitBys();
                        }
                    }    
                }
            });
            splitByContainer.exit().remove();
            d3.select(this).on('scroll', function () {
                if (self.chartOptions.legend == "compact") {
                    if ((<any>this).scrollLeft + (<any>this).clientWidth + 40 > (<any>this).scrollWidth) {
                        const oldShownSplitBys = self.chartComponentData.displayState[aggKey].shownSplitBys; 
                        self.chartComponentData.displayState[aggKey].shownSplitBys = Math.min(oldShownSplitBys + 20, splitByLabelData.length);
                        if (oldShownSplitBys != self.chartComponentData.displayState[aggKey].shownSplitBys) {
                            renderSplitBys();                   
                        }
                    }    
                }
            });

        });

        if (this.chartOptions.legend == 'shown') {
            var legendHeight = legend.node().clientHeight;
            //minSplitBysForFlexGrow: the minimum number of split bys for flex-grow to be triggered 
            var minSplitByForFlexGrow = (prospectiveAggregateHeight - heightPerNameLabel) / heightPerSplitBy;
            if (contentHeight < usableLegendHeight) {
                this.legendElement.classed("tsi-flexLegend", true);
                seriesLabelsEntered.each(function () {
                    var splitBysCount = Object.keys(self.chartComponentData.displayState[String(d3.select(this).data()[0])].splitBys).length;
                    if (splitBysCount > minSplitByForFlexGrow) {
                        d3.select(this).style("flex-grow", 1);
                    }
                });
            } else {
                this.legendElement.classed("tsi-flexLegend", false);
            }
        }

        seriesLabels.exit().remove();

        /** Events ************************************************************************************************/

        var eventSeriesLabels: any = legend.selectAll(".tsi-eventSeriesLabel")
            .data(Object.keys(events));
        var eventSeriesLabelsEntered = eventSeriesLabels
            .enter()
            .append("div")
            .attr("class", (d, i) => "tsi-eventSeriesLabel" + (this.chartComponentData.displayState.events[d].visible ? " shown" : ""))
            .append("div")
            .attr("class", (d, i) => "tsi-seriesNameLabel" + (this.chartComponentData.displayState.events[d].visible ? " shown" : ""));

        eventSeriesLabelsEntered.each(function (d, i) {
            var eyeIcons = d3.select(this).selectAll('.tsi-eyeIcon')
                .data([d]);
            eyeIcons
                .enter().append("div")
                .attr("class", "tsi-eyeIcon")
                .on("click", function (data: any, i: number) {
                    self.chartComponentData.displayState.events[d].visible = !self.chartComponentData.displayState.events[d].visible;
                    self.drawChart();
                });
        });  

        eventSeriesLabels.merge(eventSeriesLabels)
        .classed("shown", (d, i) => {
            return  this.chartComponentData.displayState.events[d].visible;
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

        eventSeriesLabels.exit().remove();

        /** States ************************************************************************************************/
        
        var stateSeriesLabels: any = legend.selectAll(".tsi-stateSeriesLabel")
            .data(Object.keys(states));
        var stateSeriesLabelsEntered = stateSeriesLabels
            .enter()
            .append("div")
            .attr("class", d => "tsi-stateSeriesLabel" + (this.chartComponentData.displayState.states[d].visible ? " shown" : ""))
            .append("div")
            .attr("class", d => "tsi-seriesNameLabel" + (this.chartComponentData.displayState.states[d].visible ? " shown" : ""));
    
        stateSeriesLabelsEntered.each(function (d, i) {
            var eyeIcons = d3.select(this).selectAll('.tsi-eyeIcon')
                .data([d]);
            eyeIcons
                .enter().append("div")
                .attr("class", "tsi-eyeIcon")
                .on("click", function (data: any, i: number) {
                    self.chartComponentData.displayState.states[d].visible = !self.chartComponentData.displayState.states[d].visible;
                    self.drawChart();
                });
        });  

        stateSeriesLabels.merge(stateSeriesLabels)
        .classed("shown", (d, i) => {
            return  this.chartComponentData.displayState.states[d].visible;
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

        stateSeriesLabels.exit().remove();
	}
}

export {Legend}