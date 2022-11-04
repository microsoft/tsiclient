import * as d3 from 'd3';
import './HeatmapCanvas.scss';
import Utils from "../../Utils";
import { ChartComponent } from "../../Interfaces/ChartComponent";
import { HeatmapData } from "../../Models/HeatmapData";

class HeatmapCanvas extends ChartComponent {
    private heatmapData: HeatmapData;
    private canvas: any;
    private ctx: any;
    private height: number;
    private rawCellWidth: number;
    private cellWidthMod: number;
    private rawCellHeight: number;
    private cellHeightMod: number; 
    private colorLegend: any;
    private colorScale: any;
    private gradientWidth = 8;
    private aggKey: string;
    private focusedXIndex: number = -1;
    private focusedYIndex: number = -1;
    private focusedText: any;
    private highlightedSplitBy: string;
    private highlightedTime: Date;
    private highlightedValue: number;
    private onCellFocus;
    private aggI: number;
    private isOnlyAgg: boolean;

    constructor (renderTarget) {
        super(renderTarget);
        this.legendWidth = 80;
    }

    private renderScale (aggColor: any, isOnlyAgg: boolean) {
        this.colorLegend.selectAll("*").remove();
        if (this.colorScale.domain() === null || isNaN(this.colorScale.domain()[0]) || isNaN(this.colorScale.domain()[1])) {
            return;
        }
        let gradientGuid = Utils.guid();
        var gradient = this.colorLegend.append("defs")
            .append("linearGradient")
              .attr("id", "gradient" + this.aggI + gradientGuid)
              .attr("x1", "0%")
              .attr("y1", "100%")
              .attr("x2", "0%")
              .attr("y2", "0%");

        let interpolatedColors = [];

        var percentileCalc = (i) => i * (this.colorScale.domain()[1] - this.colorScale.domain()[0]) + this.colorScale.domain()[0]; 
        for (let i = 0; i <= 20; i++) {
            const color = this.getColor(aggColor, percentileCalc(i / 20), isOnlyAgg);

            gradient.append("stop")
                .attr("offset", (i * 5) + "%")
                .attr("stop-color", color)
                .attr("stop-opacity", 1);
        }

        var gradientRect = this.colorLegend.append("rect")
            .attr("x", this.legendWidth - this.gradientWidth)
            .attr("y", 6)
            .attr("width", this.gradientWidth)
            .attr("height", Math.max(0, this.height - 12))
            .style("fill", "url(#gradient" + String(this.aggI) + gradientGuid + ")");

        var highlightedValueY = null;
        var range: number = this.colorScale.domain()[1] - this.colorScale.domain()[0];

        var highlightedText = this.colorLegend.append("text").attr("class", "highlightedValueText");
        var highlightedLine = this.colorLegend.append("line").attr("class", "highlightedValueLine");
        var minText = this.colorLegend.append("text");
        var maxText = this.colorLegend.append("text");

        var setHighlightedValueLineAndText = (line, text) => {
            var percentile;
            if (range == 0) {
                percentile = .5;
            } else {
                percentile = (this.highlightedValue != null) ? (this.highlightedValue - this.colorScale.domain()[0]) / range : 0;
            }

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
            .text(Utils.formatYAxisNumber(this.colorScale.domain()[0]))
            .attr("fill-width", ((highlightedValueY == null) || highlightedValueY < this.height - 18) ? 1 : 0);
        maxText.attr("x", this.legendWidth - this.gradientWidth - 5)
            .attr("y", 6)
            .text(Utils.formatYAxisNumber(this.colorScale.domain()[1]))
            .attr("fill-opacity", ((highlightedValueY == null) || highlightedValueY > 18) ? 1 : 0);

        //render highlightedValue text and line IF there is a highlighted time and split by, OR IF there is an 
        //  artificially produced value from hovering over the color gradient
        if (this.highlightedTime && this.highlightedSplitBy != null && this.highlightedValue != null) {
            setHighlightedValueLineAndText(highlightedLine, highlightedText);
            minText.attr("fill-opacity", ((highlightedValueY == null) || highlightedValueY < this.height - 18) ? 1 : 0);
            maxText.attr("fill-opacity", ((highlightedValueY == null) || highlightedValueY > 18) ? 1 : 0);
        }

        var self = this;

        gradientRect.on("mousemove", function(event) {
            var yPos = d3.pointer(event)[1];
            var percentile = 1 - ((yPos - 6) / (self.height - 12));

            self.highlightedValue = self.colorScale.domain()[0] + (range * percentile);
            setHighlightedValueLineAndText(highlightedLine, highlightedText);
        })
        .on("mouseleave", () => {
            this.render(this.data, this.chartOptions, this.aggKey, null, null, this.onCellFocus, null, this.isOnlyAgg);
        })
    }

    private getExtent () {
        let rawExtent = d3.extent(this.heatmapData.allValues);
        let extent = rawExtent;
        if (rawExtent[0] === rawExtent[1]) {
            extent = [rawExtent[0] - .05, rawExtent[1] + .05];
        }
        return extent;
    }

    public render (data, chartOptions, aggKey, highlightedSplitBy: string = null, highlightedTime: Date = null, onCellFocus, aggI: number, isOnlyAgg: boolean) {
        this.chartOptions.setOptions(chartOptions);
        this.aggKey = aggKey;
        this.data = data;
        this.isOnlyAgg = isOnlyAgg;

        if (aggI != null) {
            this.aggI = aggI;
        }

        this.heatmapData = new HeatmapData(data, aggKey);
        var container = d3.select(this.renderTarget).classed("tsi-heatmapCanvasWrapper", true);
        super.themify(container, this.chartOptions.theme);

        if (highlightedSplitBy != null) 
            this.highlightedSplitBy = highlightedSplitBy; 
        this.highlightedTime = highlightedTime;
    
        if (this.highlightedSplitBy != null && this.highlightedTime) {
            if (this.heatmapData.timeValues[this.highlightedTime.toISOString()][this.highlightedSplitBy] != null) {
                this.highlightedValue = this.heatmapData.timeValues[this.highlightedTime.toISOString()][this.highlightedSplitBy].value;
            }
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
        this.canvas.on("mousemove", function (event) {
            var mouseCoords = d3.pointer(event);
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
                var sortedDates = Object.keys(self.heatmapData.timeValues)
                    .sort((a: string, b: string): number => {
                        return ((new Date(a)).valueOf() < (new Date(b)).valueOf()) ? -1 : 1;
                    });
                var startDate = new Date(sortedDates[self.focusedXIndex]);
                this.highlightedTime = startDate;
                self.onCellFocus(startDate, new Date(startDate.valueOf() + self.heatmapData.bucketSize), 
                                 Math.max(0, cellX), cellX + self.calcCellWidth(self.focusedXIndex), 
                                 self.calcCellY(self.focusedYIndex), highlightedSplitBy);
            }
            self.render(self.data, self.chartOptions, self.aggKey, highlightedSplitBy, this.highlightedTime, self.onCellFocus, null, self.isOnlyAgg);
        }).on("mouseout", function () {
            self.focusedXIndex = -1;
            self.focusedYIndex = -1;
            self.render(self.data, self.chartOptions, self.aggKey, null, null, self.onCellFocus, null, self.isOnlyAgg);
        })
        this.aggKey = aggKey;

        this.rawCellHeight = Math.floor(this.height / this.heatmapData.numRows);
        this.cellHeightMod = this.height % this.heatmapData.numRows;
        this.rawCellWidth = this.width / this.heatmapData.numCols;
        this.cellWidthMod = this.width % this.heatmapData.numCols;

        
        this.colorLegend = container.append("svg").attr("class", "tsi-heatmapColorLegend")     
        this.colorLegend.attr("width", this.legendWidth)
            .attr("height", this.height)
            .style("left", (this.width) + "px");

        var aggColor = data.displayState[aggKey].color;

        if (isOnlyAgg) {
            this.colorScale = d3.scaleSequential(d3.interpolateViridis).domain(this.getExtent());
        } else {
            this.colorScale = d3.scaleLinear().domain(this.getExtent())
                .range([d3.hcl(aggColor).brighter().l, d3.hcl(aggColor).darker().l]);
        }

        this.renderScale(aggColor, isOnlyAgg);

        var sortedTimes = Object.keys(this.heatmapData.timeValues).sort((a: string, b: string): number => {
            return ((new Date(a)).valueOf() < (new Date(b)).valueOf()) ? -1 : 1;
        });

        sortedTimes.forEach((ts, tsI) => {
            Object.keys(this.heatmapData.timeValues[ts]).forEach((splitBy, sBI) => {
                var cellData = this.heatmapData.timeValues[ts][splitBy];
                if (cellData != null) {
                    if (highlightedSplitBy && highlightedSplitBy != splitBy) {
                        this.drawCell(cellData.rowI, cellData.colI, cellData.value, aggColor, isOnlyAgg, true);
                    } else {
                        this.drawCell(cellData.rowI, cellData.colI, cellData.value, aggColor, isOnlyAgg);
                    }
                } 
            });
        });

        
    }

    private calcCellXIndex (x: number) {
        let xI = 0;
        while(Math.round(xI * this.rawCellWidth) < x) {
            xI++;
        }
        return Math.max(xI - 1, 0);
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
        return Math.round(this.rawCellWidth * i);
        return Math.min(i, this.cellWidthMod) + (this.rawCellWidth * i);
    }

    private calcCellWidth(i) {
        return (Math.round(this.rawCellWidth * (i + 1)) - Math.round(this.rawCellWidth * i) - (this.rawCellWidth > 10 ? 1 : 0));
    }

    private calcCellY(i) {
        return Math.min(i, this.cellHeightMod) + (this.rawCellHeight * i);
    }

    private drawCell (rowI, colI, value, aggColor, isOnlyAgg, outOfFocus: boolean = false) {
        var x = this.calcCellX(colI);
        var y = this.calcCellY(rowI);
        this.ctx.fillStyle = value !== null ? this.getColor(aggColor, value, isOnlyAgg) : "transparent";
        this.ctx.globalAlpha = outOfFocus ? .3 : 1;
        this.ctx.fillRect(this.calcCellX(colI), this.calcCellY(rowI), this.calcCellWidth(colI), this.calcCellHeight(rowI));
    }

    private getColor(aggColor: any, index: number, isOnlyAgg: boolean): string {
        let color: string;
        if (isOnlyAgg) {
            color = this.colorScale(index);
        } else {
            const interpolatedColorLuminance = this.colorScale(index);
            const newColor = d3.hcl(aggColor);
            newColor.l = interpolatedColorLuminance;
            color = newColor.formatHex();
        }
        return color;
    }
}

export default HeatmapCanvas;