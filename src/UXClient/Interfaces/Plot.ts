import {Component} from "./Component";
import { Utils, NONNUMERICTOPMARGIN } from '../Utils';

class Plot extends Component {
    protected chartHeight;
    protected x;
    protected chartDataOptions;
    protected chartComponentData;
    protected yTop;
    protected height;
    protected aggregateGroup;
    protected backdropRect = null;


	constructor(renderTarget: Element){
        super(renderTarget);
    }

    protected getVisibleSeries (aggKey) { 
        return Object.keys(this.chartComponentData.timeArrays[aggKey]).filter((s) => {
            return this.chartComponentData.isSplitByVisible(aggKey, s);
        });
    }

    protected createGradientKey (d, splitByIndex, i) {
        return unescape(d.aggregateKey).split(" ").join("_") + '_' + splitByIndex + '_' + i;
    }

    protected addGradientStops (d, gradient) {

        gradient.selectAll('stop').remove();

        let colorMap = this.chartDataOptions.valueMap;
        if (!d.measures) {
            return;
        }

        //behavior if numeric measures
        let allMeasuresNumeric = Object.keys(d.measures).reduce((p, currMeasure) => {
            return (typeof d.measures[currMeasure]) === 'number' && p;
        }, true);

        let sumOfMeasures;
        if (allMeasuresNumeric) {
            sumOfMeasures = Object.keys(d.measures).reduce((p, currMeasure) => {
                return p + d.measures[currMeasure];
            }, 0);
            if (sumOfMeasures <= 0) {
                return;
            }
        }

        let numMeasures = Object.keys(d.measures).length
        Object.keys(d.measures).reduce((p, currMeasure, i) => {
            let currFraction = allMeasuresNumeric ? (d.measures[currMeasure] / sumOfMeasures) : (i / numMeasures);
            gradient.append('stop')
                .attr("offset", (p * 100) + "%")
                .attr("stop-color", this.getColorForValue(currMeasure))
                .attr("stop-opacity", 1);

            let newFraction = allMeasuresNumeric ? (p + currFraction) : ((i + 1) / numMeasures);

            gradient.append('stop')
                .attr("offset", (newFraction * 100) + "%")
                .attr("stop-color",  this.getColorForValue(currMeasure))
                .attr("stop-opacity", 1);
            return newFraction; 
        }, 0);
    }


    protected createBackdropRect () {
        if (this.backdropRect === null) {
            this.backdropRect = this.aggregateGroup.append('rect')
                .attr('class', 'tsi-backdropRect')
                .attr('x', 0)
                .attr('y', 0);
        }
        this.backdropRect
            .attr('width', this.x.range()[1])
            .attr('height', this.height);
    }


    protected getColorForValue (value) {
        return Utils.getColorForValue(this.chartDataOptions, value);
    }

    protected getVisibleMeasures (measures) {
        return Object.keys(measures).filter((measure) => {
            return measures[measure] !== 0;
        });
    }

    protected hasData (d) {
        return d.measures && (Object.keys(d.measures).length !== 0);
    }
}
export {Plot}
