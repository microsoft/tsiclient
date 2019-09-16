import * as d3 from 'd3';
import { Plot } from '../../Interfaces/Plot';
import { Utils } from '../../Utils';

const TOPMARGIN = 4;

class CategoricalPlot extends Plot {

    private height;
    private x;
    private chartComponentData;
    private TRANSDURATION = 500; //TO BE REMOVED
    private defs;
    private chartDataOptions;

    constructor (svgSelection) {
        super(svgSelection)
    }

    private createGradientKey (d, i) {
        return d.aggregateKey + i;
    }

    private addGradientStops (d, i, gradient) {
        let getColorForValue = (value) => {
            if (this.chartDataOptions.valueMapping && (this.chartDataOptions.valueMapping[value] !== undefined)) {
                return this.chartDataOptions.valueMapping[value].color;
            }
            return null;
        }
        let colorMap = this.chartDataOptions.valueMap
        Object.keys(d.measures).reduce((p, currMeasure) => {
            let currFraction = d.measures[currMeasure];
            gradient.append('stop')
                .attr("offset", (p * 100) + "%")
                .attr("stop-color", getColorForValue(currMeasure))
                .attr("stop-opacity", 1);
            let newFraction = p + currFraction; 

            gradient.append('stop')
                .attr("offset", (newFraction * 100) + "%")
                .attr("stop-color",  getColorForValue(currMeasure))
                .attr("stop-opacity", 1);
            return newFraction; 
        }, 0);
    }

    private rollUpContiguous (data) {
        let areEquivalentBuckets = (d1, d2) => {
            if (Object.keys(d1.measures).length !== Object.keys(d1.measures).length) {
                return false;
            }
            return Object.keys(d1.measures).reduce((p, c, i) => {
                return p && (d1.measures[c] === d2.measures[c]);
            }, true);
        }

        return data.filter((d, i) => {
            if (i !== 0) {
                return !areEquivalentBuckets(d, data[i - 1]);
            }
            return true;
        });
    }

    public render (chartOptions, visibleAggI, agg, aggVisible: boolean, aggregateGroup, chartComponentData, yExtent,  
        chartHeight, visibleAggCount, colorMap, previousAggregateData, x, areaPath, strokeOpacity, y, yMap, defs, chartDataOptions) {

        this.chartOptions = chartOptions;
        this.x = x;
        this.chartComponentData = chartComponentData;
        this.defs = defs;
        let aggKey = agg.aggKey;
        this.chartDataOptions = chartDataOptions;
        
        let aggY;
        let aggLine;
        let aggEnvelope;
        let aggGapLine;

        var durationFunction = (d) => {
            let previousUndefined = previousAggregateData.get(this) === undefined;
            return (self.chartOptions.noAnimate || previousUndefined) ? 0 : self.TRANSDURATION
        }

        let self = this;        
        let series: Array<string> = Object.keys(this.chartComponentData.timeArrays[aggKey]).filter((s) => {
            return self.chartComponentData.isSplitByVisible(aggKey, s);
        });

        let heightPerSeries = Math.max((self.chartDataOptions.height - (series.length * TOPMARGIN))/ series.length, 0);

        let splitByGroups = aggregateGroup.selectAll(".tsi-splitByGroup")
            .data(series);
        splitByGroups.enter()
            .append("g")
            .attr("class", "tsi-splitByGroup " + agg.aggKey)
            .merge(splitByGroups)
            .attr('transform', (d, i) => {
                return 'translate(0,' + (i * (this.chartDataOptions.height / series.length)) + ')';
            })
            .each(function (splitBy, j) {
                let data = self.rollUpContiguous(self.chartComponentData.timeArrays[aggKey][splitBy]);
                var categoricalBuckets = d3.select(this).selectAll(".tsi-categoricalBucket")
                    .data(data);

                var getWidth = (d, i) => {
                    let seriesWidth = self.x.range()[1] - self.x.range()[0];
                    var xPos1 = Math.max(Math.min(self.x(new Date(d.dateTime)), seriesWidth), 0);
                    var xPos2;
                    if (i + 1 < data.length) {
                        xPos2 = Math.max(Math.min(self.x(new Date(data[i+1].dateTime)), seriesWidth), 0); 
                    } else {
                        xPos2 = seriesWidth;
                    }
                    return xPos2 - xPos1;
                }	

                categoricalBuckets.enter()
                    .append("rect")
                    .attr("class", "valueElement valueRect tsi-categoricalBucket")
                    .merge(categoricalBuckets)
                    .style("visibility", (d: any) => { 
                        return (self.chartComponentData.isSplitByVisible(aggKey, splitBy)) ? "visible" : "hidden";
                    })
                    .transition()
                    .duration(durationFunction)
                    .ease(d3.easeExp)
                    .attr('height', heightPerSeries)
                    .attr('width', getWidth)
                    .attr('x', (d: any) => {
                        return self.x(new Date(d.dateTime))
                    })
                    .each(function (d, i) {
                        var gradient = self.defs.append("linearGradient")
                            .attr("id", self.createGradientKey(d, i))
                            .attr("x2", "0%")
                            .attr("y2", "100%");
                        self.addGradientStops(d, i, gradient);
                        d3.select(this)
                            .attr('fill', "url(#" + self.createGradientKey(d, i) + ")");
                    });
                categoricalBuckets.exit().remove();
            });
            splitByGroups.exit().remove();
        
    }
}
export {CategoricalPlot}