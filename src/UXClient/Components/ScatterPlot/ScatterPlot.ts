import * as d3 from 'd3';
import './ScatterPlot.scss';
import {Utils} from "./../../Utils";
import {Legend} from './../Legend/Legend';
import {ContextMenu} from './../ContextMenu/ContextMenu';
import {ChartComponent} from "./../../Interfaces/ChartComponent";
import { ChartComponentData } from '../../Models/ChartComponentData';
import { Slider } from '../Slider/Slider';
import { Tooltip } from '../Tooltip/Tooltip';
import { ChartOptions } from '../../Models/ChartOptions';
import { EllipsisMenu } from '../EllipsisMenu/EllipsisMenu';
import { ChartDataOptions } from '../../Models/ChartDataOptions';

class ScatterPlot extends ChartComponent {
    private svgSelection: any;
    private legendObject: Legend;
    private tooltip: Tooltip;
    private measures: any;
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
    public draw: any;
    
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
        this.aggregateExpressionOptions = data.map((d, i) => Object.assign(d, aggregateExpressionOptions && i in aggregateExpressionOptions  ? new ChartDataOptions(aggregateExpressionOptions[i]) : new ChartDataOptions({})));
        this.chartComponentData.mergeDataToDisplayStateAndTimeArrays(data, this.chartOptions.timestamp, aggregateExpressionOptions);

        // If measure options not set, or less than 2, default measures to all measures
        if(this.chartOptions["scatterPlotMeasures"] == null || (this.chartOptions["scatterPlotMeasures"] != null && this.chartOptions["scatterPlotMeasures"].length < 2)){
            console.log("Scatter plot measures not specified or less than 2");
            return;
        }  
        
        if (this.svgSelection == null) {  
            let targetElement = d3.select(this.renderTarget)
                .classed("tsi-scatterPlot", true);

            this.setWidthAndHeight();

            this.svgSelection = targetElement.append("svg")
                .attr("class", "tsi-scatterPlotSVG tsi-chartSVG")
                .attr("height", this.height)
                .attr("width", this.width);

            this.g = this.svgSelection.append("g")
                .classed("svgGroup", true)
                .attr("transform", "translate(" + this.chartMargins.left + "," + this.chartMargins.top + ")");
                
            let tooltip = new Tooltip(d3.select(this.renderTarget));
            
            this.draw = () => {
                this.setWidthAndHeight();
                this.svgSelection
                    .attr("height", this.height)
                    .attr("width", this.width);

                this.g
                    .attr("width", this.chartWidth)
                    .attr("height", this.chartHeight)
                   
                super.themify(targetElement, this.chartOptions.theme);
                
                this.measures = this.chartOptions.scatterPlotMeasures;
                this.measures.forEach(measure => {
                    this.extents[measure] = d3.extent(this.chartComponentData.allValues, (v:any) => measure in v.measures ? v.measures[measure] : null );
                });

                // Pad extents
                let xOffsetPercentage = 10 / this.chartWidth;
                let yOffsetPercentage = 10 / this.chartHeight;
                
                let xMeasure = this.measures[0], yMeasure = this.measures[1] ;
                let rMeasure = this.measures[2] !== undefined ? this.measures[2] : null;
                
                //Init Scales
                this.yScale = d3.scaleLinear()
                    .range([this.chartHeight, 0])
                    .domain([this.extents[yMeasure][0] - yOffsetPercentage,this.extents[yMeasure][1] + yOffsetPercentage]);

                this.xScale = d3.scaleLinear()
                    .range([0, this.chartWidth])
                    .domain([this.extents[xMeasure][0] - xOffsetPercentage,this.extents[xMeasure][1] + xOffsetPercentage]); 
                    
                if(rMeasure != null){
                    this.rScale = d3.scaleLinear()
                    .range([1, 10])
                    .domain([this.extents[rMeasure][0],this.extents[rMeasure][1]]);
                } else{
                    this.rScale = () => 3.5;
                }  

                this.initColorScale();
                
                // Draw Axis
                this.drawAxis();

                // Draw data
                let scatter = this.g.selectAll(".dot")
                    .data(this.cleanData(this.chartComponentData.allValues))

                scatter
                    .enter()
                    .append("circle")
                    .attr("class", "dot")
                    .attr("r", (d) => this.rScale(d.measures[rMeasure]))
                    .merge(scatter)
                    .attr("cx", (d) => this.xScale(d.measures[xMeasure]))
                    .attr("cy", (d) => this.yScale(d.measures[yMeasure]))
                    .attr("fill", (d) => this.colorMap[d.aggregateKey](d.splitBy))
                    .attr("stroke-width", "1px")
                    .attr("fill-opacity", .7)
                    .attr("stroke-opacity", 1)
                    .attr("stroke", (d) => this.colorMap[d.aggregateKey](d.splitBy))

                scatter.exit().remove();    
            }

            // Add Window Resize Listener
            window.addEventListener("resize", () => {
                var self = this;
                if (!this.chartOptions.suppressResizeListener) {
                    this.draw();
                }
            });
            
            this.draw();
        }                               
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
                if(!Object.keys(value.measures).includes(measure)){
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
        let xAxisEntered = this.xAxis.enter()
            .append("g")
            .attr("class", "xAxis")
            .merge(this.xAxis)
            .attr("transform", "translate(0," + (this.chartHeight) + ")")
            .call(d3.axisBottom(this.xScale));
        
        this.xAxis.exit().remove();

        // Draw dynamic y axis and label
        this.yAxis = this.g.selectAll(".yAxis").data([this.yScale]);
        let yAxisEntered = this.yAxis.enter()
            .append("g")
            .attr("class", "yAxis")
            .merge(this.yAxis)
            .call(d3.axisLeft(this.yScale));
            
        this.yAxis.exit().remove()
    }

}

export {ScatterPlot}
