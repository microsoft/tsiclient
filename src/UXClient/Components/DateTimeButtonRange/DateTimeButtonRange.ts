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

    private setButtonText (fromMillis, toMillis, isRelative, quickTime) {
        let fromString = this.buttonDateTimeFormat(fromMillis);
        let tzAbbr = Utils.createTimezoneAbbreviation(this.chartOptions.offset);
        let toString = this.buttonDateTimeFormat(toMillis) + ' (' + tzAbbr + ')';
        if (!isRelative) {
            this.dateTimeButton.node().innerHTML = fromString + ' - ' + toString;
        }
        else{
            let quickTimeText = this.dateTimePicker.getQuickTimeText(quickTime);
            if(quickTimeText !== null){
                this.dateTimeButton.node().innerHTML = quickTimeText + ' (' + fromString + ' - ' + toString + ')';
            }
            else{
                this.dateTimeButton.node().innerHTML = fromString + ' - ' + this.getString('Latest') + ' (' + toString + ')';
            }
        }
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

        if (!this.dateTimePicker) {
            this.dateTimePicker = new DateTimePicker(this.dateTimePickerContainer.node());
        }

        this.setButtonText(fromMillis, toMillis, toMillis === maxMillis, this.toMillis - this.fromMillis);

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
            this.chartOptions.dTPIsModal = true;
            this.dateTimePickerContainer.style("display", "block");
            this.dateTimePicker.render(this.chartOptions, minMillis, maxMillis, this.fromMillis, this.toMillis, (fromMillis, toMillis, offset, isRelative, currentQuickTime) => {
                this.chartOptions.offset = offset;

                this.fromMillis = fromMillis;
                this.toMillis = toMillis;

                this.setButtonText(fromMillis, toMillis, isRelative, currentQuickTime);
                this.onSet(fromMillis, toMillis, offset);
                this.onClose();
            }, () => {
                this.onClose();
                this.onCancel();
            });
        });
    }
}
export {DateTimeButtonRange}
