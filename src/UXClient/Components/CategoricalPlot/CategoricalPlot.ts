import * as d3 from 'd3';
import { Plot } from '../../Interfaces/Plot';
import Utils from '../../Utils';
import { DataTypes } from "../../Constants/Enums";
import { NONNUMERICTOPMARGIN, LINECHARTTOPPADDING } from "../../Constants/Constants";

const TOPMARGIN = 4;

class CategoricalPlot extends Plot {
    private defs;
    private hoverRect;
    private chartGroup;
    private categoricalMouseover;
    private categoricalMouseout;
    private splitBysGroup;

    constructor (svgSelection) {
        super(svgSelection);
        this.plotDataType = DataTypes.Categorical;
    }

    private onMouseover (d, rectWidth) {
        let visibleMeasures = this.getVisibleMeasures(d.measures);

        this.hoverRect.attr('visibility', 'visible')
            .attr('x', () => {
                return this.x(new Date(d.dateTime))
            })
            .attr('width', rectWidth)
            .attr('height', Math.max(0, this.chartHeight + 1 - LINECHARTTOPPADDING))
            .attr('fill', () => {
                return visibleMeasures.length === 1 ? this.getColorForValue(visibleMeasures[0]) : 'none'
            });
    }

    private onMouseout () {
        this.hoverRect.attr('visibility', 'hidden');
        this.categoricalMouseout();
    }

    private createHoverRect () {
        if (!this.hoverRect) {
            this.hoverRect = this.chartGroup.append('rect')
                .attr('class', 'tsi-categoricalHoverRect')
                .attr('y', LINECHARTTOPPADDING)
                .attr('height', this.chartHeight + 1)
        } else {
            this.hoverRect.raise();
        }
    }

    private getSeriesEndDate () {
        if (this.chartDataOptions.searchSpan) {
            return new Date(this.chartDataOptions.searchSpan.to);
        }
        return new Date(this.chartComponentData.toMillis);
    }

    private getBucketEndDate (d, i) {
        let data = this.chartComponentData.timeArrays[d.aggregateKey][d.splitBy];
        if (i + 1 < data.length) {
            return data[i+1].dateTime; 
        } else {
            let shouldRoundEnd = Utils.safeNotNullOrUndefined(() => this.chartDataOptions.searchSpan) && Utils.safeNotNullOrUndefined(() => this.chartDataOptions.searchSpan.bucketSize);
            return shouldRoundEnd ? Utils.roundToMillis(this.getSeriesEndDate().valueOf(), Utils.parseTimeInput(this.chartDataOptions.searchSpan.bucketSize)) : this.getSeriesEndDate();        
        }
    }

    public render (chartOptions, visibleAggI, agg, aggVisible: boolean, aggregateGroup, chartComponentData, yExtent,  
        chartHeight, visibleAggCount, colorMap, previousAggregateData, x, areaPath, strokeOpacity, y, yMap, defs, 
        chartDataOptions, previousIncludeDots, yTopAndHeight, chartGroup, categoricalMouseover, categoricalMouseout) {
        this.chartOptions = chartOptions;
        this.yTop = yTopAndHeight[0];
        this.height = yTopAndHeight[1];
        this.x = x;
        this.chartComponentData = chartComponentData;
        let aggKey = agg.aggKey;
        this.chartDataOptions = chartDataOptions;
        this.chartHeight = chartHeight;
        this.chartGroup = chartGroup;
        this.categoricalMouseover = categoricalMouseover;
        this.aggregateGroup = aggregateGroup;
        this.categoricalMouseout = categoricalMouseout;
        this.createBackdropRect(true);
        if (this.aggregateGroup.selectAll('defs').empty()) {
            this.defs = this.aggregateGroup.append('defs');
        }
        if (this.aggregateGroup.selectAll('.tsi-splitBysGroup').empty()) {
            this.splitBysGroup = this.aggregateGroup.append('g').classed('tsi-splitBysGroup', true);
        }

        let gradientData = [];
        
        var durationFunction = (d) => {
            let previousUndefined = previousAggregateData.get(this) === undefined;
            return (self.chartOptions.noAnimate || previousUndefined) ? 0 : self.TRANSDURATION
        }

        let self = this;    
        this.createHoverRect(); 

        let series: Array<string> = this.getVisibleSeries(aggKey);

        let heightPerSeries = Math.max((self.chartDataOptions.height - (series.length * TOPMARGIN))/ series.length, 0);
        let splitByGroups = this.splitBysGroup.selectAll(".tsi-splitByGroup")
            .data(series, (d) => {
                return d.splitBy;
            });
        splitByGroups.enter()
            .append("g")
            .attr("class", "tsi-splitByGroup " + agg.aggKey)
            .merge(splitByGroups)
            .attr('transform', (d, i) => {
                return 'translate(0,' + (NONNUMERICTOPMARGIN + (i * (this.chartDataOptions.height / series.length))) + ')';
            })
            .each(function (splitBy, j) {
                let data = self.chartComponentData.timeArrays[aggKey][splitBy];
                var categoricalBuckets = d3.select(this).selectAll<SVGRectElement, unknown>(".tsi-categoricalBucket")
                    .data(data);

                var getWidth = (d, i) => {
                    let seriesWidth = self.x.range()[1] - self.x.range()[0];
                    var xPos1 = Math.max(self.x(new Date(d.dateTime)), 0);
                    var xPos2 = self.x(self.getBucketEndDate(d, i));
                    return Math.max(xPos2 - xPos1, 1);
                }	

                const categoricalBucketsEntered = categoricalBuckets.enter()
                    .append("rect")
                    .attr("class", "tsi-valueElement tsi-categoricalBucket")
                    .merge(categoricalBuckets)
                    .style("visibility", (d: any) => { 
                        return (self.chartComponentData.isSplitByVisible(aggKey, splitBy) && self.hasData(d)) ? "visible" : "hidden";
                    })
                    .on('mouseover', (event, d: any) => {
                        const e = categoricalBucketsEntered.nodes();
                        const i = e.indexOf(event.currentTarget);
                        let y = self.yTop + (j * (self.chartDataOptions.height / series.length));
                        let x = self.x(new Date(d.dateTime)) + (getWidth(d, i));

                        let shouldMouseover = self.categoricalMouseover(d, x, y + NONNUMERICTOPMARGIN, self.getBucketEndDate(d, i), getWidth(d, i));
                        if (shouldMouseover) {
                            self.onMouseover(d, getWidth(d, i));
                        }
                    })
                    .on('mouseout', () => {
                        self.onMouseout();
                    })
                    .attr('cursor', (self.chartDataOptions.onElementClick ? 'pointer' : 'inherit'))
                    .on('click', (event, d: any) => {
                        if (self.chartDataOptions.onElementClick) {
                            self.chartDataOptions.onElementClick(d.aggregateKey, d.splitBy, d.dateTime.toISOString(), d.measures);
                        }
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
                        let gradientKey = self.createGradientKey(d, j, i);
                        gradientData.push([gradientKey, d]);
                        d3.select(this)
                            .attr('fill', "url(#" + gradientKey + ")");
                    });
                categoricalBuckets.exit().remove();
            });
            splitByGroups.exit().remove();
        
        //corresponding linear gradients
        let gradients = this.defs.selectAll('linearGradient')
                        .data(gradientData, (d) => {
                            return d[1].splitBy;
                        });
        let enteredGradients = gradients.enter()
            .append('linearGradient')
            .attr("x2", "0%")
            .attr("y2", "100%")
            .merge(gradients)
            .attr("id", d => d[0]);
        enteredGradients
            .each(function (d) {
                self.addGradientStops(d[1], d3.select(this));
            });
        gradients.exit().remove();
        
    }
}
export default CategoricalPlot;