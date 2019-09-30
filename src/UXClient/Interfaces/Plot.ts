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
