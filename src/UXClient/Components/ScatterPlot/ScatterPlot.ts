import * as d3 from 'd3';
import './ScatterPlot.scss';
import {Utils} from "./../../Utils";
import {Legend} from './../Legend/Legend';
import {ChartComponent} from "./../../Interfaces/ChartComponent";
import { ChartComponentData } from '../../Models/ChartComponentData';
import { Tooltip } from '../Tooltip/Tooltip';
import { ChartDataOptions } from '../../Models/ChartDataOptions';
import { AsyncResource } from 'async_hooks';

class ScatterPlot extends ChartComponent {
    private svgSelection: any;
    private legendObject: Legend;
    private tooltip: Tooltip;
    private measures: Array<string>;
    private extents: any = {}
    private width: number;
    private height: number;
    private chartWidth: number;
    private chartHeight: number;
    private controlsOffset: number;
    private g: any;
    private pointWrapper: any;
    private xScale: any;
    private yScale: any;
    private rScale: any;
    private xMeasure: string;
    private yMeasure: string;
    private rMeasure: string;
    private xAxis: any;
    private yAxis: any;
    private colorMap: any = {};
    private labelMouseOver: any;
    private labelMouseOut: any;
    private draw: any;
    private voronoi: any;
    private voronoiGroup: any;
    private voronoiDiagram: any;
    private focus: any;
    
    chartComponentData = new ChartComponentData();

    public chartMargins: any = {        
        top: 40,
        bottom: 40,
        left: 70, 
        right: 60
    };
    
    constructor(renderTarget: Element){
        super(renderTarget);
    }

    ScatterPlot(){}
    public render(data: any, options: any, aggregateExpressionOptions: any) {
        this.chartOptions.setOptions(options);

        // If measure options not set, or less than 2, default measures to all measures
        if(this.chartOptions["scatterPlotMeasures"] == null || (this.chartOptions["scatterPlotMeasures"] != null && this.chartOptions["scatterPlotMeasures"].length < 2)){
            console.log("Scatter plot measures not specified or less than 2");
            return;
        }

        this.chartMargins.top = (this.chartOptions.legend === 'compact') ? 84 : 52;
        this.aggregateExpressionOptions = data.map((d, i) => Object.assign(d, aggregateExpressionOptions && i in aggregateExpressionOptions  ? new ChartDataOptions(aggregateExpressionOptions[i]) : new ChartDataOptions({})));
        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, this.chartOptions.timestamp, aggregateExpressionOptions);  
        
        this.controlsOffset = (this.chartOptions.legend == "shown" ? this.CONTROLSWIDTH : 0)
        this.setWidthAndHeight();

        if (this.svgSelection == null) {  
            let targetElement = d3.select(this.renderTarget)
                .classed("tsi-scatterPlot", true);
           
            this.svgSelection = targetElement.append("svg")
                .attr("class", "tsi-scatterPlotSVG tsi-chartSVG")
                .attr("height", this.height)
                .attr("width", this.width);

            this.g = this.svgSelection.append("g")
                .classed("tsi-svgGroup", true)
                .attr("transform", "translate(" + this.chartMargins.left + "," + this.chartMargins.top + ")");

            this.pointWrapper = this.g.append("g")
                .classed("tsi-pointWrapper", true);
                
            this.tooltip = new Tooltip(d3.select(this.renderTarget));

            let svgWrap = this.svgSelection;

            this.labelMouseOver = (aggKey: string, splitBy: string = null, dateTime: Date = null) => {
                //Highlight active group
                svgWrap.selectAll(".tsi-dot")
                    .attr("stroke-opacity", 1)
                    .attr("fill-opacity", 1)
                    .attr("stroke", (d) => this.colorMap[d.aggregateKey](d.splitBy))
                    .attr("stroke-width", "1px");

                // Remove highlight on previous legend group
                <any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel').classed("inFocus", false);

                // Filter selected
                let selectedFilter = (d: any) => {
                    let currAggKey = null, currSplitBy = null;
                    if(d.aggregateKey) currAggKey = d.aggregateKey
                    if(d.splitBy) currSplitBy = d.splitBy

                    if(splitBy == null)
                        return currAggKey == aggKey;
        
                    if(currAggKey == aggKey && currSplitBy == splitBy)
                        return false;
                    return true;
                }
                
                // Decrease opacity of unselected
                svgWrap.selectAll(".tsi-dot")
                    .filter(selectedFilter)
                    .attr("stroke-opacity", .15)
                    .attr("fill-opacity", .15)
                    .attr("z-index", -1)

                // Add highlight border to single focused dot
                if(dateTime != null && splitBy != null){
                    // Raise crosshair to top
                    this.focus.raise().classed("active", true);
                    let highlightColor = this.chartOptions.theme == "light" ? "black": "white";
                    svgWrap.selectAll(".tsi-dot")
                    .filter((d:any) => {
                        if(d.aggregateKey == aggKey && d.splitBy == splitBy && d.dateTime == dateTime)
                            return true;
                        return false;
                    })
                    .attr("stroke", highlightColor)
                    .attr("stroke-width", "2px")
                    // Raise active dot above crosshair
                    .raise().classed("active", true);
                }

                // Highlight legend group
                (this.legendObject.legendElement.selectAll('.tsi-splitByLabel').filter(function (filteredSplitBy: string) {
                    return (d3.select(this.parentNode).datum() == aggKey) && (filteredSplitBy == splitBy);
                })).classed("inFocus", true);
            }

            this.labelMouseOut = () => {
                
                 // Remove highlight on legend group
                 <any>this.legendObject.legendElement.selectAll('.tsi-splitByLabel').classed("inFocus", false);

                this.g.selectAll(".tsi-dot")
                    .attr("stroke-opacity", .6)
                    .attr("fill-opacity", .6)
                    .attr("z-index", 1)
                    .attr("stroke", (d) => this.colorMap[d.aggregateKey](d.splitBy))
                    .attr("stroke-width", "1px");
            }
            let self = this;

            // Initialize voronoi
            this.voronoiGroup = this.g.append("rect")
                .attr("class", "tsi-voronoiWrap")
                .attr("width", this.chartWidth)
                .attr("height", this.chartHeight)
                .attr("fill", "transparent");

            // Initialize focus crosshair lines
            this.focus = this.pointWrapper.append("g")
                .attr("transform", "translate(-100,-100)")
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
            
            // Initialize focus hover data boxes
            let hHoverG: any = this.focus.append("g")
                .attr("class", 'hHoverG')
                .style("pointer-events", "none")
                .attr("transform", "translate(0," + (this.chartHeight + this.chartOptions.aggTopMargin) + ")");
            
            let hHoverBox: any = hHoverG.append("rect")
                .style("pointer-events", "none")
                .attr("class", 'hHoverBox')
                .attr("x", 0)
                .attr("y", 4)
                .attr("width", 0)
                .attr("height", 0);
            
            let hHoverText: any = hHoverG.append("text")
                .style("pointer-events", "none")
                .attr("class", "hHoverText")
                .attr("dy", ".71em")
                .attr("transform", "translate(0,9)")
                .text(d => d);

            let vHoverG: any = this.focus.append("g")
                .attr("class", 'vHoverG')
                .attr("transform", "translate(0," + (this.chartHeight + this.chartOptions.aggTopMargin) + ")");
            let vHoverBox: any = vHoverG.append("rect")
                .attr("class", 'vHoverBox')
                .attr("x", -5)
                .attr("y", 0)
                .attr("width", 0)
                .attr("height", 0)
            let vHoverText: any = vHoverG.append("text")
                .attr("class", "vHoverText")
                .attr("dy", ".32em")
                .attr("x", -10)
                .text(d => d);


            this.draw = () => {
                this.focus.attr("visibility", (this.chartOptions.focusHidden) ? "hidden" : "visible")
                this.setWidthAndHeight();
                this.svgSelection
                    .attr("height", this.height)
                    .attr("width", this.width);
                
                super.themify(targetElement, this.chartOptions.theme);

                // Size focus line
                this.focus.select('.tsi-hLine').attr("x2", this.chartWidth);
                this.focus.select('.tsi-vLine').attr("y2", this.chartHeight);
                
                // Set axis extents
                this.measures = this.chartOptions.scatterPlotMeasures;
                this.measures.forEach(measure => {
                    this.extents[measure] = d3.extent(this.chartComponentData.allValues, (v:any) => measure in v.measures ? v.measures[measure] : null );
                });
                
                this.xMeasure = this.measures[0];
                this.yMeasure = this.measures[1];
                this.rMeasure = this.measures[2] !== undefined ? this.measures[2] : null;

                // Pad extents
                let xOffset = (20 / this.chartWidth) * (this.extents[this.xMeasure][1] - this.extents[this.xMeasure][0]);
                let yOffset = (20 / this.chartHeight) * (this.extents[this.yMeasure][1] - this.extents[this.yMeasure][0]);
                
                //Init scales
                this.yScale = d3.scaleLinear()
                    .range([this.chartHeight, 0])
                    .domain([this.extents[this.yMeasure][0] - yOffset,this.extents[this.yMeasure][1] + yOffset]);

                this.xScale = d3.scaleLinear()
                    .range([0, this.chartWidth])
                    .domain([this.extents[this.xMeasure][0] - xOffset,this.extents[this.xMeasure][1] + xOffset]); 
                    
                this.rScale = d3.scaleLinear()
                .range(this.chartOptions.scatterPlotRadius.slice(0,2))
                .domain(this.rMeasure === null ? [0, 0] : [this.extents[this.rMeasure][0],this.extents[this.rMeasure][1]]);
                
                // Create color scale for each aggregate key
                this.initColorScale();
                
                // Draw axis
                this.drawAxis();

                // Draw data
                let scatter = this.pointWrapper.selectAll(".tsi-dot")
                    .data(this.cleanData(this.chartComponentData.allValues))

                let self = this;
                
                scatter
                    .enter()
                    .append("circle")
                    .attr("class", "tsi-dot")
                    .attr("r", (d) => this.rScale(d.measures[this.rMeasure]))
                    .merge(scatter)
                    .transition()
                    .duration(self.TRANSDURATION)
                    .ease(d3.easeExp)
                    .attr("display", (d) => self.getVisibleState(d))
                    .attr("cx", (d) => this.xScale(d.measures[this.xMeasure]))
                    .attr("cy", (d) => this.yScale(d.measures[this.yMeasure]))
                    .attr("fill", (d) => this.colorMap[d.aggregateKey](d.splitBy))
                    .attr("stroke", (d) => this.colorMap[d.aggregateKey](d.splitBy))
                    .attr("stroke-opacity", .6)
                    .attr("fill-opacity", .6)
                    .attr("stroke-width", "1px")

                scatter.exit().remove();
                
                // Draw Legend
                this.legendObject.draw(this.chartOptions.legend, this.chartComponentData, this.labelMouseOver, 
                    this.svgSelection, this.chartOptions, this.labelMouseOut);
                
                // Draw voronoi
                this.drawVoronoi();
            }

            this.legendObject = new Legend(this.draw, this.renderTarget, this.CONTROLSWIDTH);

            // Add Window Resize Listener
            window.addEventListener("resize", () => {
                let self = this;
                if (!this.chartOptions.suppressResizeListener) {
                    this.draw();
                }
            });
        }   
        this.draw();                            
    }

    private drawVoronoi(){
        let voronoiData = this.getVoronoiData(this.chartComponentData.allValues);
        let self = this;
        this.voronoi = d3.voronoi()
            .x((d:any) => this.xScale(d.measures[this.xMeasure]))
            .y((d:any) => this.yScale(d.measures[this.yMeasure]))
            .extent([[0, 0], [this.chartWidth, this.chartHeight]]);

        this.voronoiDiagram = this.voronoi(voronoiData);

        this.voronoiGroup
            .on("mousemove", function(){
                let mouseEvent = d3.mouse(this);
                self.voronoiMouseMove(mouseEvent);
            })
            .on("mouseout", function(){
                self.voronoiMouseOut();
            }) 
    }

    private voronoiMouseMove(mouseEvent){
        let mouse_x = mouseEvent[0];
        let mouse_y = mouseEvent[1];
        let site = this.voronoiDiagram.find(mouse_x, mouse_y);
        this.drawTooltip(site.data, [site[0], site[1]]);
        this.labelMouseOver(site.data.aggregateKey, site.data.splitBy, site.data.dateTime);

        // Draw focus cross hair
        this.focus.style("display", "block");
        this.focus.attr("transform", "translate(" + site[0] + "," + site[1] + ")");
        this.focus.select('.tsi-hLine').attr("transform", "translate(" + (-site[0]) + ",0)");
        this.focus.select('.tsi-vLine').attr("transform", "translate(0," + (-site[1]) + ")");

        // Draw horizontal hover box 
        this.focus.select('.hHoverG')
        .attr("transform", "translate(0," + (this.chartHeight - site[1]) + ")")
        .select("text")
        .text((Utils.formatYAxisNumber(site.data.measures[this.xMeasure])));
        let textElemDimensions = (<any>this.focus.select('.hHoverG').select("text")
            .node()).getBoundingClientRect();
        this.focus.select(".hHoverG").select("rect")
            .attr("x", -(textElemDimensions.width / 2) - 3)
            .attr("width", textElemDimensions.width + 6)
            .attr("height", textElemDimensions.height + 5);

        // Draw vertical hover box
        this.focus.select('.vHoverG')
            .attr("transform", "translate(" + (-site[0]) + ",0)")
            .select("text")
            .text(Utils.formatYAxisNumber(site.data.measures[this.yMeasure]))
        textElemDimensions = (<any>this.focus.select('.vHoverG').select("text")
            .node()).getBoundingClientRect();
        this.focus.select(".vHoverG").select("rect")
            .attr("x", -(textElemDimensions.width) - 13)
            .attr("y", -(textElemDimensions.height / 2) - 3)
            .attr("width", textElemDimensions.width + 6)
            .attr("height", textElemDimensions.height + 4);
  
    }

    private voronoiMouseOut(){
        this.focus.style("display", "none");
        this.tooltip.hide();
        this.labelMouseOut();
    }

    private getVoronoiData(rawData: any){
        let cleanData = this.cleanData(rawData);
        return cleanData.filter((d) => {
            return (this.chartComponentData.displayState[d.aggregateKey].visible && 
                this.chartComponentData.displayState[d.aggregateKey].splitBys[d.splitBy].visible)
        });
    }

    private getVisibleState(d:any){
        return (this.chartComponentData.displayState[d.aggregateKey].visible && 
                this.chartComponentData.displayState[d.aggregateKey].splitBys[d.splitBy].visible 
                ? "inherit" : "none");
    }

    private initColorScale(){
        this.chartComponentData.data.forEach((d) => {
            let colors = Utils.createSplitByColors(this.chartComponentData.displayState, d.aggKey, this.chartOptions.keepSplitByColor);
            this.colorMap[d.aggKey] = d3.scaleOrdinal()
                .domain(this.chartComponentData.displayState[d.aggKey].splitBys)
                .range(colors);
        });
    }

    private cleanData(data){
        // Exclude any data which does not contain the specified
        // chart option measure
        let filtered = data.filter((value) => {
            let valOk = true;            
            this.chartOptions.scatterPlotMeasures
            .forEach((measure) => {
                if(!(measure in value.measures)){
                    valOk = false;
                }
            });
            return valOk;
        })
        return filtered;
    }

    private setWidthAndHeight(){
        this.width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH) - this.controlsOffset;
        this.height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);

        this.chartWidth = this.width - this.chartMargins.left  - this.chartMargins.right;
        this.chartHeight = this.height - this.chartMargins.top - this.chartMargins.bottom;
    }

    private drawAxis(){
        // Draw dynamic x axis and label
        this.xAxis = this.pointWrapper.selectAll(".xAxis").data([this.xScale]); 
        this.xAxis.enter()
            .append("g")
            .attr("class", "xAxis")
            .merge(this.xAxis)
            .attr("transform", "translate(0," + (this.chartHeight) + ")")
            .call(d3.axisBottom(this.xScale));
        
        this.xAxis.exit().remove();

        // Draw dynamic y axis and label
        this.yAxis = this.pointWrapper.selectAll(".yAxis").data([this.yScale]);
        this.yAxis.enter()
            .append("g")
            .attr("class", "yAxis")
            .merge(this.yAxis)
            .call(d3.axisLeft(this.yScale));
            
        this.yAxis.exit().remove()
    }

    private drawTooltip (d: any, mousePosition) {
        if (this.chartOptions.tooltip){
            let xPos = mousePosition[0];
            let yPos = mousePosition[1];

            this.tooltip.render(this.chartOptions.theme);
            this.tooltip.draw(d, this.chartComponentData, xPos, yPos, this.chartMargins, (text) => {
                text.append("div")
                    .attr("class", "title")
                    .text(d.aggregateName);  
                    text.append("div")
                    .attr("class", "value")
                    .text(d.splitBy);

                text.append("div")
                .attr("class", "value")
                .text(Utils.timeFormat(this.labelFormatUsesSeconds(), this.labelFormatUsesMillis(), this.chartOptions.offset, this.chartOptions.is24HourTime)(d.dateTime));  

                let valueGroup = text.append('div').classed('valueGroup', true);
                Object.keys(d.measures).forEach((measureType, i) => {
                    valueGroup.append("div")
                        .attr("class",  "value")
                        .text(measureType + ": " + Utils.formatYAxisNumber(d.measures[measureType]));
                });
            });
        }
    }

    private labelFormatUsesSeconds () {
        return !this.chartOptions.minutesForTimeLabels && this.chartComponentData.usesSeconds;
    }

    private labelFormatUsesMillis () {
        return !this.chartOptions.minutesForTimeLabels && this.chartComponentData.usesMillis;
    }

}

export {ScatterPlot}
