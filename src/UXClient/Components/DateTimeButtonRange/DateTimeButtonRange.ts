import * as d3 from 'd3';
import './DateTimeButtonRange.scss';
import { ChartDataOptions } from '../../Models/ChartDataOptions';
import { DateTimeButton } from '../../Interfaces/DateTimeButton';
import { DateTimePicker } from '../DateTimePicker/DateTimePicker';
import { Utils } from '../../Utils';

class DateTimeButtonRange extends DateTimeButton {    
    private onCancel;
    private fromMillis: number;
    private toMillis: number;

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    private setButtonText (fromMillis, toMillis, timezoneAbbr) {
        this.dateTimeButton.node().innerHTML = this.buttonDateTimeFormat(fromMillis) + ' - ' + this.buttonDateTimeFormat(toMillis) + ' (' + timezoneAbbr + ')';
    }

    public render (chartOptions: any = {}, minMillis: number, maxMillis: number, 
        fromMillis: number = null, toMillis: number = null, onSet = null, onCancel = null) {
        super.render(chartOptions, minMillis, maxMillis, onSet);

        this.fromMillis = fromMillis;
        this.toMillis = toMillis;

        this.onCancel = onCancel ? onCancel : () => {};
        this.setButtonText (fromMillis, toMillis, 'Local');
        if (!this.dateTimePicker) {
            this.dateTimePicker = new DateTimePicker(this.dateTimePickerContainer.node());
        }
        this.dateTimeButton.on("click", () => {
                this.dateTimePickerContainer.style("display", "block");
                var minMillis = this.minMillis + (Utils.getOffsetMinutes(this.chartOptions.offset, this.minMillis) * 60 * 1000);
                var maxMillis = this.maxMillis + (Utils.getOffsetMinutes(this.chartOptions.offset, this.maxMillis) * 60 * 1000);
                var adjustedFrom = this.fromMillis + (Utils.getOffsetMinutes(this.chartOptions.offset, this.fromMillis) * 60 * 1000);
                var adjustedTo = this.toMillis + (Utils.getOffsetMinutes(this.chartOptions.offset, this.toMillis) * 60 * 1000);

                this.dateTimePicker.render(this.chartOptions, minMillis, maxMillis, adjustedFrom, adjustedTo, (fromMillis, toMillis, offset) => {
                    this.chartOptions.offset = offset;
                    var adjustedFrom = fromMillis - (Utils.getOffsetMinutes(this.chartOptions.offset, fromMillis) * 60 * 1000);
                    var adjustedTo = toMillis - (Utils.getOffsetMinutes(this.chartOptions.offset, toMillis) * 60 * 1000);

                    this.fromMillis = adjustedFrom;
                    this.toMillis = adjustedTo;
    
                    this.setButtonText(adjustedFrom, adjustedTo, offset);
                    this.onSet(adjustedFrom, adjustedTo, offset);

                    this.dateTimePickerContainer.style("display", "none");
                    (<any>d3.select(this.renderTarget).select(".tsi-dateTimeContainer").node()).focus();
                },
                () => {
                    this.dateTimePicker.updateFromAndTo(fromMillis, toMillis);
                    this.dateTimePickerContainer.style("display", "none");
                    (<any>d3.select(this.renderTarget).select(".tsi-dateTimeContainer").node()).focus();
                });
        });
    }
}
export {DateTimeButtonRange}
