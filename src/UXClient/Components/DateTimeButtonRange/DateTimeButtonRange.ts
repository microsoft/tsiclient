import * as d3 from 'd3';
import './DateTimeButtonSingle.scss';
import { ChartDataOptions } from '../../Models/ChartDataOptions';
import { DateTimeButton } from '../../Interfaces/DateTimeButton';

class DateTimeButtonSingle extends DateTimeButton {    

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    public render (chartOptions: any = {}, minMillis: number, maxMillis: number, 
        fromMillis: number = null, toMillis: number = null, onSet = null, onCancel = null) {
        super.render(chartOptions, minMillis, maxMillis, onSet);
    }
  
}
export {DateTimeButtonSingle}
