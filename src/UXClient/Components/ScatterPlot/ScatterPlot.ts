import * as d3 from 'd3';
import './ScatterPlot.scss';
import {Utils} from "./../../Utils";
import {Legend} from './../Legend/Legend';
import {ChartComponent} from "./../../Interfaces/ChartComponent";
import { ChartComponentData } from '../../Models/ChartComponentData';
import { Tooltip } from '../Tooltip/Tooltip';
import { ChartDataOptions } from '../../Models/ChartDataOptions';

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
    private g: any;
    private xScale: any;
    private yScale: any;
    private rScale: any;
    private xAxis: any;
    private yAxis: any;
    private colorMap: any = {};
    private draw: any;
    
    chartComponentData = new ChartComponentData();

    public chartMargins: any = {        
        top: 40,
        bottom: 50,
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
        
        this.aggregateExpressionOptions = data.map((d, i) => Object.assign(d, aggregateExpressionOptions && i in aggregateExpressionOptions  ? new ChartDataOptions(aggregateExpressionOptions[i]) : new ChartDataOptions({})));
        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, this.chartOptions.timestamp, aggregateExpressionOptions);  
        
        if (this.svgSelection == null) {  
            let targetElement = d3.select(this.renderTarget)
                .classed("tsi-scatterPlot", true);

            this.setWidthAndHeight();

            this.svgSelection = targetElement.append("svg")
                .attr("class", "tsi-scatterPlotSVG tsi-chartSVG")
                .attr("height", this.height)
                .attr("width", this.width);

            this.g = this.svgSelection.append("g")
                .classed("tsi-svgGroup", true)
                .attr("transform", "translate(" + this.chartMargins.left + "," + this.chartMargins.top + ")");
                
            this.tooltip = new Tooltip(d3.select(this.renderTarget));
            
            this.draw = () => {
                this.setWidthAndHeight();
                this.svgSelection
                    .attr("height", this.height)
                    .attr("width", this.width);
                
                super.themify(targetElement, this.chartOptions.theme);
                
                // Set axis extents
                this.measures = this.chartOptions.scatterPlotMeasures;
                this.measures.forEach(measure => {
                    this.extents[measure] = d3.extent(this.chartComponentData.allValues, (v:any) => measure in v.measures ? v.measures[measure] : null );
                });
                
                let xMeasure = this.measures[0], yMeasure = this.measures[1] ;
                let rMeasure = this.measures[2] !== undefined ? this.measures[2] : null;

                // Pad extents
                let xOffset = (20 / this.chartWidth) * (this.extents[xMeasure][1] - this.extents[xMeasure][0]);
                let yOffset = (20 / this.chartHeight) * (this.extents[yMeasure][1] - this.extents[yMeasure][0]);
                
                //Init scales
                this.yScale = d3.scaleLinear()
                    .range([this.chartHeight, 0])
                    .domain([this.extents[yMeasure][0] - yOffset,this.extents[yMeasure][1] + yOffset]);

                this.xScale = d3.scaleLinear()
                    .range([0, this.chartWidth])
                    .domain([this.extents[xMeasure][0] - xOffset,this.extents[xMeasure][1] + xOffset]); 
                    
                this.rScale = d3.scaleLinear()
                .range(this.chartOptions.scatterPlotRadius.slice(0,2))
                .domain(rMeasure === null ? [0, 0] : [this.extents[rMeasure][0],this.extents[rMeasure][1]]);
                
                // Create color scale for each aggregate key
                this.initColorScale();
                
                // Draw axis
                this.drawAxis();

                // Draw data
                let scatter = this.g.selectAll(".tsi-dot")
                    .data(this.cleanData(this.chartComponentData.allValues))

                let self = this;

                console.log('data', this.chartComponentData.allValues);
                
                scatter
                    .enter()
                    .append("circle")
                    .attr("class", "tsi-dot")
                    .on("mouseover", function(d) {	
                        self.drawTooltip(d, d3.mouse(<any>self.g.node()))
                        self.labelMouseOver(d.aggregateKey, d.splitBy, d.dateTime);
                    })					
                    .on("mouseout", function(d) {		
                        self.tooltip.hide();
                        self.labelMouseOut();
                    })
                    .attr("r", (d) => this.rScale(d.measures[rMeasure]))
                    .merge(scatter)
                    .transition()
                    .duration(self.TRANSDURATION)
                    .ease(d3.easeExp)
                    .attr("cx", (d) => this.xScale(d.measures[xMeasure]))
                    .attr("cy", (d) => this.yScale(d.measures[yMeasure]))
                    .attr("fill", (d) => this.colorMap[d.aggregateKey](d.splitBy))
                    .attr("stroke", (d) => this.colorMap[d.aggregateKey](d.splitBy))

                scatter.exit().remove();
                
            }

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

    private labelMouseOver(aggKey: string, splitBy: string = null, dateTime = Date){
        // Filter out selected dot
        let selectedFilter = (d: any) => {
            let currAggKey = null, currSplitBy = null, currDateTime = null;
            if(d.aggregateKey) currAggKey = d.aggregateKey
            if(d.splitBy) currSplitBy = d.splitBy
            if(d.dateTime) currDateTime = d.dateTime

            if(currAggKey == aggKey && currSplitBy == splitBy && currDateTime == dateTime){
                return false;
            }
            return true;
        }

        this.g.selectAll(".tsi-dot")
            .filter(selectedFilter)
            .attr("stroke-opacity", .3)
            .attr("fill-opacity", .3)
    }

    private labelMouseOut(){
        this.g.selectAll(".tsi-dot")
            .attr("stroke-opacity", 1)
            .attr("fill-opacity", 1)
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
        this.width = Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
        this.height = Math.max((<any>d3.select(this.renderTarget).node()).clientHeight, this.MINHEIGHT);

        this.chartWidth = this.width - this.chartMargins.left  - this.chartMargins.right;
        this.chartHeight = this.height - this.chartMargins.top - this.chartMargins.bottom;
    }

    private drawAxis(){
        // Draw dynamic x axis and label
        this.xAxis = this.g.selectAll(".xAxis").data([this.xScale]); 
        this.xAxis.enter()
            .append("g")
            .attr("class", "xAxis")
            .merge(this.xAxis)
            .attr("transform", "translate(0," + (this.chartHeight) + ")")
            .call(d3.axisBottom(this.xScale));
        
        this.xAxis.exit().remove();

        // Draw dynamic y axis and label
        this.yAxis = this.g.selectAll(".yAxis").data([this.yScale]);
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
