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

    private setButtonText (fromMillis, toMillis) {
        this.dateTimeButton.node().innerHTML = this.buttonDateTimeFormat(fromMillis) + ' - ' + this.buttonDateTimeFormat(toMillis) + ' (' + Utils.createTimezoneAbbreviation(this.chartOptions.offset) + ')';
    }

    private onClose () {
        this.dateTimePickerContainer.style("display", "none");
        this.dateTimeButton.node().focus();
    }

    public render (chartOptions: any = {}, minMillis: number, maxMillis: number, 
        fromMillis: number = null, toMillis: number = null, onSet = null, onCancel = null) {
        super.render(chartOptions, minMillis, maxMillis, onSet);
        d3.select(this.renderTarget).classed('tsi-dateTimeContainerRange', true);
        this.fromMillis = fromMillis;
        this.toMillis = toMillis;

        this.onCancel = onCancel ? onCancel : () => {};

        this.setButtonText (fromMillis, toMillis);
        if (!this.dateTimePicker) {
            this.dateTimePicker = new DateTimePicker(this.dateTimePickerContainer.node());
        }

        let targetElement = <any>d3.select(this.renderTarget)
        var dateTimeTextChildren =   (targetElement.select(".tsi-dateTimeContainer")).selectAll("*");
        d3.select("html").on("click." + Utils.guid(), () => {
            let pickerContainerChildren = this.dateTimePickerContainer.selectAll("*");
            var outside = dateTimeTextChildren.filter(Utils.equalToEventTarget).empty() 
                && targetElement.selectAll(".tsi-dateTimeContainer").filter(Utils.equalToEventTarget).empty()
                && targetElement.selectAll(".tsi-dateTimeButton").filter(Utils.equalToEventTarget).empty();
            var inClickTarget = pickerContainerChildren.filter(Utils.equalToEventTarget).empty();
            if (outside && inClickTarget && (this.dateTimePickerContainer.style('display') !== 'none')) {
                this.onClose();
            }
        });

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
    
                    this.setButtonText(adjustedFrom, adjustedTo);
                    this.onSet(adjustedFrom, adjustedTo, offset);
                    this.onClose();
                }, () => {
                    this.onClose();
                    this.onCancel();
                });
        });
    }
}
export {DateTimeButtonRange}
