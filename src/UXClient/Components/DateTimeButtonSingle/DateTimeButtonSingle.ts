import * as d3 from 'd3';
import './DateTimeButtonSingle.scss';
import { ChartDataOptions } from '../../Models/ChartDataOptions';
import { DateTimeButton } from '../../Interfaces/DateTimeButton';
import { Utils } from '../../Utils';
import { SingleDateTimePicker } from '../SingleDateTimePicker/SingleDateTimePicker';

class DateTimeButtonSingle extends DateTimeButton {    

    private selectedMillis: number;

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    public render (chartOptions: any = {}, minMillis: number, maxMillis: number, selectedMillis: number = null, onSet = null) {
        super.render(chartOptions, minMillis, maxMillis, onSet);
        this.selectedMillis = selectedMillis;
        d3.select(this.renderTarget).classed('tsi-dateTimeContainerSingle', true);
        this.dateTimeButton.node().innerHTML = this.buttonDateTimeFormat(selectedMillis);
        if (!this.dateTimePicker) {
            this.dateTimePicker = new SingleDateTimePicker(this.dateTimePickerContainer.node());
        }
        this.dateTimeButton.on("click", () => {
                this.dateTimePickerContainer.style("display", "block");
                this.dateTimePicker.render(this.chartOptions, this.minMillis, this.maxMillis, this.selectedMillis, (d) => {
                    this.dateTimeButton.node().innerHTML = this.buttonDateTimeFormat(d);
                    this.dateTimePickerContainer.style("display", "none");
                    this.selectedMillis = d;
                });
            });       
    }
  
}
export {DateTimeButtonSingle}
