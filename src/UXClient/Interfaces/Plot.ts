import {Component} from "./Component";
import { Utils, NONNUMERICTOPMARGIN } from '../Utils';

class Plot extends Component {
    protected chartHeight;
    protected x;
    protected chartDataOptions;
    protected chartComponentData;
    protected yTop;
    protected height;


	constructor(renderTarget: Element){
        super(renderTarget);
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
