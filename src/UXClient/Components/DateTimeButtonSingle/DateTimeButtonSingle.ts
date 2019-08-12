import * as d3 from 'd3';
import './DateTimeButtonSingle.scss';
import { ChartDataOptions } from '../../Models/ChartDataOptions';
import { DateTimeButton } from '../../Interfaces/DateTimeButton';
import { Utils } from '../../Utils';

class DateTimeButtonSingle extends DateTimeButton {    

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    public render (chartOptions: any = {}, minMillis: number, maxMillis: number, selectedMillis: number = null, onSet = null) {
        super.render(chartOptions, minMillis, maxMillis, onSet);
        this.dateTimeButton.node().innerHTML = this.buttonDateTimeFormat(selectedMillis);
    }
  
}
export {DateTimeButtonSingle}
