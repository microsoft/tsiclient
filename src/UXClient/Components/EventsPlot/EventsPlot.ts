import * as d3 from 'd3';
import { Plot } from '../../Interfaces/Plot';
import { Utils, NONNUMERICTOPMARGIN, EventElementTypes, DataTypes, LINECHARTTOPPADDING } from '../../Utils';

const TOPMARGIN = 4;

class EventsPlot extends Plot {
    private defs;
    private hoverLine;
    private chartGroup;
    private discreteEventsMouseover;
    private discreteEventsMouseout;
    private splitBysGroup;
    private eventHeight;

    private gradientArray = {};

    constructor (svgSelection) {
        super(svgSelection);
        this.plotDataType = DataTypes.Events;
    }

    private onMouseover (d, seriesNumber) {
        
        let getX = () => {
            return this.x(new Date(d.dateTime));
        }

        let seriesWidth = Math.ceil(this.eventHeight * Math.sqrt(2))
        let seriesTop = this.yTop + NONNUMERICTOPMARGIN + (seriesWidth * seriesNumber) + (seriesWidth / 2);

        let shouldMouseover = this.discreteEventsMouseover(d, getX() + (seriesWidth / 2), seriesTop, seriesWidth);
        if (!shouldMouseover) {
            return;
        }

        let visibleMeasures = this.getVisibleMeasures(d.measures)

        this.hoverLine.attr('visibility', 'visible')
            .attr('x1', getX)
            .attr('x2', getX)
            .attr('y1', LINECHARTTOPPADDING)
            .attr('y2', this.chartHeight + 1)
            .attr('stroke', () => {
                return visibleMeasures.length === 1 ? this.getColorForValue(visibleMeasures[0]) : 'grey'
            });
    }

    private onMouseout () {
        this.hoverLine.attr('visibility', 'hidden');
        this.discreteEventsMouseout();
    }

    private createHoverLine () {
        if (!this.hoverLine) {
            this.hoverLine = this.chartGroup.append('line')
                .attr('class', 'tsi-discreteEventHoverLine')
                .attr('y1', LINECHARTTOPPADDING)
                .attr('y2', this.chartHeight + 1)
                .attr('pointer-events', 'none')
                .attr('visibility', 'hidden');
        } else {
            this.hoverLine.raise();
        }
    }

    private setEventHeight (visibleSeriesCount) {
        let useableHeight = this.height - NONNUMERICTOPMARGIN;
        this.eventHeight = Math.floor((useableHeight / visibleSeriesCount) / Math.sqrt(2)); 
    }

    public render (chartOptions, visibleAggI, agg, aggVisible: boolean, aggregateGroup, chartComponentData, yExtent,  
        chartHeight, visibleAggCount, colorMap, previousAggregateData, x, areaPath, strokeOpacity, y, yMap, defs, 
        chartDataOptions, previousIncludeDots, yTopAndHeight, chartGroup, discreteEventsMouseover, discreteEventsMouseout) {
        this.chartOptions = chartOptions;
        this.yTop = yTopAndHeight[0];
        this.height = yTopAndHeight[1];
        this.x = x;
        this.chartComponentData = chartComponentData;
        let aggKey = agg.aggKey;
        this.chartDataOptions = chartDataOptions;
        this.chartHeight = chartHeight;
        this.chartGroup = chartGroup;
        this.aggregateGroup = aggregateGroup;
        this.discreteEventsMouseover = discreteEventsMouseover;
        this.discreteEventsMouseout = discreteEventsMouseout;

        this.createBackdropRect();
        if (this.aggregateGroup.selectAll('defs').empty()) {
            this.defs = this.aggregateGroup.append('defs');
        }

        this.createHoverLine();

        let series = this.getVisibleSeries(agg.aggKey);
        this.setEventHeight(series.length);

        if (this.aggregateGroup.selectAll('.tsi-splitBysGroup').empty()) {
            this.splitBysGroup = this.aggregateGroup.append('g').classed('tsi-splitBysGroup', true);
        }

        let self = this;

        let splitByGroups = this.splitBysGroup.selectAll(".tsi-splitByGroup")
            .data(series, (d) => {
                return d.splitBy;
            });

        let gradientData = [];

        let teardropD = (width, height) => {
            return `M${width / 2} ${height / 14} 
                    Q${width / 1.818} ${height / 6.17} ${width / 1.2} ${height / 2.33}
                    A${width / 2.35} ${width / 2.35} 0 1 1 ${width / 6} ${width / 2.33}
                    Q${width / 2.22} ${height / 6.18} ${width / 2} ${height / 14}z`;
        }

        let enterEventElements = (discreteEvents) => {
            switch(this.chartDataOptions.eventElementType) {
                case EventElementTypes.Teardrop:
                    return discreteEvents.enter().append('path')
                        .attr('y', 0)
                        .attr('x', 0)
                        .attr('class', 'tsi-discreteEvent tsi-discreteEventTeardrop')
                        .merge(discreteEvents)
                        .attr('transform', (d: any) => {
                            return 'translate(' + (self.x(new Date(d.dateTime)) + self.eventHeight / 2) + ',' + (self.eventHeight * 1.4) + ') rotate(180)';
                        })
                        .attr('width', self.eventHeight)
                        .attr('height', self.eventHeight)
                        .attr('d', teardropD(self.eventHeight, self.eventHeight))
                        .attr('stroke-width', Math.min(self.eventHeight / 4, 8))
                        .attr('stroke', (d: any) => {
                            if (d.measures) {
                                if (Object.keys(d.measures).length === 1) {
                                    return self.getColorForValue(Object.keys(d.measures)[0]);                            
                                } else {
                                    return 'grey';
                                }
                            }
                            return 'none';
                        });
                case EventElementTypes.Diamond:
                    return discreteEvents.enter()
                        .append('rect')
                        .attr('y', 0)
                        .attr('x', 0)
                        .attr('class', 'tsi-discreteEvent')
                        .merge(discreteEvents)
                        .attr('transform', (d: any) => {
                            return 'translate(' + self.x(new Date(d.dateTime)) + ',0) rotate(45)';
                        })
                        .attr('width', self.eventHeight)
                        .attr('height', self.eventHeight)
                        .attr('fill', (d: any) => {
                            // NOTE - hardcoded for single value or first value if multiple
                            if (d.measures) {
                                if (Object.keys(d.measures).length === 1) {
                                    return self.getColorForValue(Object.keys(d.measures)[0]);                            
                                } else {
                                    return 'grey';
                                }
                            }
                            return 'none';
                        });
            }
        }

        let enteredSplitByGroups = splitByGroups.enter()
            .append("g")
            .attr("class", "tsi-splitByGroup " + agg.aggKey)
            .merge(splitByGroups)
            .attr('transform', (d, i) => {
                return 'translate(0,' + (  + (i * (this.chartDataOptions.height / series.length))) + ')';
            })
            .each(function (splitBy, j) {
                let data = self.chartComponentData.timeArrays[aggKey][splitBy];
                var discreteEvents = d3.select(this).selectAll(".tsi-discreteEvent")
                    .data(data);
                let enteredEvents = enterEventElements(discreteEvents)
                    .on('mouseover', function (d) {
                        d3.select(this).raise();
                        self.onMouseover(d, j);
                    })
                    .on('mouseout', () => {
                        self.onMouseout();
                    })
                    .on('click', (d: any) => {
                        if (self.chartDataOptions.onElementClick) {
                            self.chartDataOptions.onElementClick(d.aggregateKey, d.splitBy, d.dateTime.toISOString(), d.measures);
                        }
                    })
                    .attr('cursor', (self.chartDataOptions.onElementClick ? 'pointer' : 'inherit'))
                    .each(function (d: any, i) {
                        if (Object.keys(d.measures).length > 1) {
                            let gradientKey = self.createGradientKey(d, j, i);
                            gradientData.push([gradientKey, d]);
                            d3.select(this)
                                .attr(self.chartDataOptions.eventElementType === EventElementTypes.Teardrop ? 'stroke' : 'fill', "url(#" + gradientKey + ")");    
                        }
                    });
                discreteEvents.exit().remove();
                });
            splitByGroups.exit().remove();

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
export {EventsPlot}