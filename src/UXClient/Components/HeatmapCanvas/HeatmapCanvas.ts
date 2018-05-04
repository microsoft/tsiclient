import * as d3 from 'd3';
import './HeatmapCanvas.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { ChartComponent } from "../../Interfaces/ChartComponent";
import { HeatmapData } from "../../Models/HeatmapData";

class HeatmapCanvas extends ChartComponent {
    private heatmapData: HeatmapData;
    private canvas: any;
    private ctx: any;
    private width: number;
    private height: number;
    private rawCellWidth: number;
    private cellWidthMod: number;
    private rawCellHeight: number;
    private cellHeightMod: number; 
    private colorLegend: any;
    private colorScale: any;
    private legendWidth = 75;
    private gradientWidth = 10;
    private aggKey: string;
    private focusedXIndex: number = -1;
    private focusedYIndex: number = -1;
    private focusedText: any;
    private highlightedSplitBy: string;
    private highlightedTime: Date;
    private highlightedValue: number;
    private onCellFocus;

    private renderScale () {
        this.colorLegend.selectAll("*").remove();
        var gradient = this.colorLegend.append("defs")
            .append("linearGradient")
              .attr("id", "gradient" + this.aggKey)
              .attr("x1", "0%")
              .attr("y1", "100%")
              .attr("x2", "0%")
              .attr("y2", "0%");

        gradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", this.colorScale.range()[0])
            .attr("stop-opacity", 1);
          
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", this.colorScale.range()[1])
            .attr("stop-opacity", 1);

        var gradientRect = this.colorLegend.append("rect")
            .attr("x", this.legendWidth - this.gradientWidth)
            .attr("y", 6)
            .attr("width", this.gradientWidth)
            .attr("height", this.height - 12)
            .style("fill", "url(#gradient" + this.aggKey + ")");

        var highlightedValueY = null;
        var range: number = d3.max(this.heatmapData.allValues) - d3.min(this.heatmapData.allValues);

        var highlightedText = this.colorLegend.append("text").attr("class", "highlightedValueText");
        var highlightedLine = this.colorLegend.append("line").attr("class", "highlightedValueLine");
        var minText = this.colorLegend.append("text");
        var maxText = this.colorLegend.append("text");

        var setHighlightedValueLineAndText = (line, text) => {
            var percentile = (this.highlightedValue - d3.min(this.heatmapData.allValues)) / range;
            highlightedValueY = (this.height - 6) + (12 - this.height) * percentile;

            text.attr("x", this.legendWidth - this.gradientWidth - 10)
                .attr("y", highlightedValueY)
                .style("stroke-width", 2)
                .text(Utils.formatYAxisNumber(this.highlightedValue));
            line.attr("x1", this.legendWidth - this.gradientWidth - 5)
                .attr("x2", this.legendWidth)
                .attr("y1", highlightedValueY)
                .attr("y2", highlightedValueY)
                .style("stroke-width", 2);

            minText.attr("fill-opacity", ((highlightedValueY == null) || highlightedValueY < this.height - 18) ? 1 : 0);
            maxText.attr("fill-opacity", ((highlightedValueY == null) || highlightedValueY > 18) ? 1 : 0);
        }

        minText.attr("x", this.legendWidth - this.gradientWidth - 5)
            .attr("y", this.height - 6)
            .text(Utils.formatYAxisNumber(d3.min(this.heatmapData.allValues)))
            .attr("fill-width", ((highlightedValueY == null) || highlightedValueY < this.height - 18) ? 1 : 0);
        maxText.attr("x", this.legendWidth - this.gradientWidth - 5)
            .attr("y", 6)
            .text(Utils.formatYAxisNumber(d3.max(this.heatmapData.allValues)))
            .attr("fill-opacity", ((highlightedValueY == null) || highlightedValueY > 18) ? 1 : 0);

        //render highlightedValue text and line IF there is a highlighted time and split by, OR IF there is an 
        //  artificially produced value from hovering over the color gradient
        if (this.highlightedTime && this.highlightedSplitBy) {
            setHighlightedValueLineAndText(highlightedLine, highlightedText);
            minText.attr("fill-opacity", ((highlightedValueY == null) || highlightedValueY < this.height - 18) ? 1 : 0);
            maxText.attr("fill-opacity", ((highlightedValueY == null) || highlightedValueY > 18) ? 1 : 0);
        }

        var self = this;

        gradientRect.on("mousemove", function() {
            var yPos = d3.mouse(this)[1];
            var percentile = 1 - ((yPos - 6) / (self.height - 12));

            self.highlightedValue = d3.min(self.heatmapData.allValues) + (range * percentile);
            setHighlightedValueLineAndText(highlightedLine, highlightedText);
        })
        .on("mouseleave", () => {
            this.render(this.data, this.chartOptions, this.aggKey, null, null, this.onCellFocus);
        })
    }

    public render (data, chartOptions, aggKey, highlightedSplitBy: string = null, highlightedTime: Date = null, onCellFocus) {
        
        this.chartOptions = chartOptions;
        this.aggKey = aggKey;
        this.data = data;

        this.heatmapData = new HeatmapData(data, aggKey);
        var container = d3.select(this.renderTarget).classed("tsi-heatmapCanvasWrapper", true);
        super.themify(container, this.chartOptions.theme);

        if (highlightedSplitBy) 
            this.highlightedSplitBy = highlightedSplitBy; 
        this.highlightedTime = highlightedTime;
    
        if (this.highlightedSplitBy && this.highlightedTime) {
            this.highlightedValue =  this.heatmapData.timeValues[this.highlightedTime.toString()][this.highlightedSplitBy].value;
        }

        if (onCellFocus)
            this.onCellFocus = onCellFocus;

        if (!container.select("canvas").empty()) 
            this.canvas = container.select("canvas");
        else 
            this.canvas = container.append("canvas").attr("class", "tsi-heatmapCanvas");   

        this.width = Math.floor(container.node().getBoundingClientRect().width - this.legendWidth - 10);
        this.height = Math.floor(container.node().getBoundingClientRect().height);
        this.canvas.attr("width", this.width);
        this.canvas.attr("height", this.height);

        this.ctx = this.canvas.node().getContext("2d");
        this.ctx.clearRect(0,0, this.width, this.height);
        
        container.selectAll("svg").remove();
        var self = this;
        this.canvas.on("mousemove", function () {
            var mouseCoords = d3.mouse(this);
            var indexesChanged = false;
            var newXIndex = self.calcCellXIndex(mouseCoords[0]);
            var newYIndex = self.calcCellYIndex(mouseCoords[1]);
            var visibleSplitBys = Object.keys(self.data.displayState[aggKey].splitBys).filter((splitBy) => {
                return self.data.isSplitByVisible(self.aggKey, splitBy);
            });
            if (newXIndex != self.focusedXIndex) {
                self.focusedXIndex = newXIndex;
                indexesChanged = true;
            }
            if (newYIndex != self.focusedYIndex) {
                self.focusedYIndex = newYIndex;
                indexesChanged = true;
            }
            var highlightedSplitBy = visibleSplitBys[self.focusedYIndex];
            if (indexesChanged && self.focusedXIndex >= 0 && self.focusedYIndex >= 0) {
                var cellX = self.calcCellX(self.focusedXIndex);
                var startDate = new Date(Object.keys(self.heatmapData.timeValues)
                                               .map((d) => d.valueOf())
                                               .sort()
                                               [self.focusedXIndex]);
                this.highlightedTime = startDate;
                self.onCellFocus(startDate, new Date(startDate.valueOf() + self.heatmapData.bucketSize), 
                                 Math.max(1, cellX), cellX + self.calcCellWidth(self.focusedXIndex) + 1, 
                                 self.calcCellY(self.focusedYIndex), highlightedSplitBy);
            }
            self.render(self.data, self.chartOptions, self.aggKey, highlightedSplitBy, this.highlightedTime, self.onCellFocus);
        }).on("mouseout", function () {
            self.focusedXIndex = -1;
            self.focusedYIndex = -1;
            self.render(self.data, self.chartOptions, self.aggKey, null, null, self.onCellFocus);
        })
        this.aggKey = aggKey;

        this.rawCellHeight = Math.floor(this.height / this.heatmapData.numRows);
        this.cellHeightMod = this.height % this.heatmapData.numRows;
        this.rawCellWidth = Math.floor(this.width / this.heatmapData.numCols);
        this.cellWidthMod = this.width % this.heatmapData.numCols;

        
        this.colorLegend = container.append("svg").attr("class", "tsi-heatmapColorLegend")     
        this.colorLegend.attr("width", this.legendWidth)
            .attr("height", this.height)
            .style("left", (this.width) + "px");

        var aggColor = data.displayState[aggKey].color;
        this.colorScale = d3.scaleLinear().domain(d3.extent(this.heatmapData.allValues))
                .range([<any>d3.hcl(aggColor).brighter(), <any>d3.hcl(aggColor).darker()]);

        this.renderScale();

        Object.keys(this.heatmapData.timeValues).forEach((ts, tsI) => {
            Object.keys(this.heatmapData.timeValues[ts]).forEach((splitBy, sBI) => {
                var cellData = this.heatmapData.timeValues[ts][splitBy];
                if (highlightedSplitBy && highlightedSplitBy != splitBy) {
                    this.drawCell(cellData.rowI, cellData.colI, cellData.value, true);
                } else {
                    this.drawCell(cellData.rowI, cellData.colI, cellData.value);
                }
            });
        });

        
    }

    private calcCellXIndex (x: number) {
        if (x < (this.cellWidthMod * (this.rawCellWidth + 1)))
            return Math.floor(x / (this.rawCellWidth + 1));
        var modOffset = this.cellWidthMod * (this.rawCellWidth + 1);
        return Math.floor((x - modOffset) / this.rawCellWidth) + this.cellWidthMod; 
    }

    private calcCellYIndex (y) {
        if (y < (this.cellHeightMod * (this.rawCellHeight + 1)))
            return Math.floor(y / (this.rawCellHeight + 1));
        var modOffset = this.cellHeightMod * (this.rawCellHeight + 1);
        return Math.floor((y - modOffset) / this.rawCellHeight) + this.cellHeightMod; 
    }

    private calcCellHeight (i) {
        return this.rawCellHeight + (i < this.cellHeightMod ? 1 : 0) - (this.rawCellWidth > 10 ? 1 : 0);; 
    }

    private calcCellX(i) {
        return Math.min(i, this.cellWidthMod) + (this.rawCellWidth * i);
    }

    private calcCellWidth(i) {
        return this.rawCellWidth + (i < this.cellWidthMod ? 1 : 0) - (this.rawCellWidth > 10 ? 1 : 0); 
    }

    private calcCellY(i) {
        return Math.min(i, this.cellHeightMod) + (this.rawCellHeight * i);
    }

    private drawCell (rowI, colI, value, outOfFocus: boolean = false) {
        var x = this.calcCellX(colI);
        var y = this.calcCellY(rowI);
        this.ctx.fillStyle = this.colorScale(value);
        this.ctx.globalAlpha = outOfFocus ? .3 : 1;
        this.ctx.fillRect(this.calcCellX(colI), this.calcCellY(rowI), this.calcCellWidth(colI), this.calcCellHeight(rowI));
    }
}

export {HeatmapCanvas}