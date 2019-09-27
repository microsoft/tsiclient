import * as d3 from 'd3';
import { Plot } from '../../Interfaces/Plot';
import { Utils, NONNUMERICTOPMARGIN } from '../../Utils';

const TOPMARGIN = 4;

class CategoricalPlot extends Plot {
    private x;
    private chartHeight;

    private height;
    private chartComponentData;
    private TRANSDURATION = 500; //TO BE REMOVED
    private defs;
    private hoverRect;
    private chartGroup;
    private categoricalMouseover;
    private categoricalMouseout;
    private yTopAndHeight;
    private aggregateGroup;
    private splitBysGroup;
    private backdropRect = null;

    constructor (svgSelection) {
        super(svgSelection)
    }

    private onMouseover (d, rectWidth) {
        let visibleMeasures = this.getVisibleMeasures(d.measures)

        this.hoverRect.attr('visibility', 'visible')
            .attr('x', () => {
                return this.x(new Date(d.dateTime))
            })
            .attr('width', rectWidth)
            .attr('height', this.chartHeight + 1)
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
                .attr('y', 0)
                .attr('height', this.chartHeight + 1)
        }
    }

    //common to categorical
    private createBackdropRect () {
        if (this.backdropRect === null) {
            this.backdropRect = this.aggregateGroup.append('rect')
                .attr('class', 'tsi-backdropRect')
                .attr('x', 0)
                .attr('y', 0);
        }
        this.backdropRect
            .attr('width', this.x.range()[1])
            .attr('height', this.yTopAndHeight[1]);
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
        
    }
}
export {CategoricalPlot}