import * as d3 from 'd3';
import Utils from "../Utils";
import {ChartComponent} from "./ChartComponent";

class DateTimeButton extends ChartComponent {

    protected dateTimePicker: any;
    private pickerIsVisible: boolean = false;
    protected minMillis: number;
    protected maxMillis: number;
    protected onSet: any;
    protected dateTimeButton: any;
    protected dateTimePickerContainer: any;

	constructor(renderTarget: Element){
        super(renderTarget);
    }

    protected buttonDateTimeFormat (millis) {
        return Utils.timeFormat(!this.chartOptions.minutesForTimeLabels, !this.chartOptions.minutesForTimeLabels, 
            this.chartOptions.offset, this.chartOptions.is24HourTime, 0, null, this.chartOptions.dateLocale)(millis);
    }

    public render (chartOptions, minMillis, maxMillis, onSet = null) {
        let self = this;
        this.chartOptions.setOptions(chartOptions);
        this.minMillis = minMillis;
        this.maxMillis = maxMillis;
        this.onSet = onSet ? onSet : () => {};
        let dateTimeContainer = d3.select(this.renderTarget);
        if (!this.dateTimeButton) {
            this.dateTimeButton = dateTimeContainer.append("button")
                .classed('tsi-dateTimeButton', true);  
        }
        if (!this.dateTimePickerContainer) {
            this.dateTimePickerContainer = dateTimeContainer.append('div').classed('tsi-dateTimePickerContainer', true)
                                            .attr('role', 'dialog')
                                            .attr('aria-label', this.getString('a time selection control dialog'));
            this.dateTimePickerContainer.style('display', 'none');
        }
        super.themify(d3.select(this.renderTarget), this.chartOptions.theme);        
    }
}
export {DateTimeButton}
