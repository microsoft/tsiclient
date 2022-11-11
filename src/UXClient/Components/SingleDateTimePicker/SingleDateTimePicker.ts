import * as d3 from 'd3';
import Pikaday from '../../../packages/pikaday/pikaday';
import '../../../packages/pikaday/css/pikaday.css'
import moment from 'moment';
import './SingleDateTimePicker.scss';
import { ChartComponent } from '../../Interfaces/ChartComponent';
import Utils from "../../Utils";

class SingleDateTimePicker extends ChartComponent{
    private calendar: any;
    private calendarPicker: any;
    private timeControls: any;
    private minMillis: number;
    private maxMillis: number;
    private millis: number;
    private minutes: number;
    private hours: number;
    private onSet: any;
    private targetElement: any;
    private isValid: boolean = true;
    private offsetName: string;
    private date: Date;
    private timeInput: any;
    private saveButton: any;

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    public getMillis () {
        return this.millis;
    }

    public render (chartOptions: any = {}, minMillis: number, maxMillis: number, 
                   millis: number = null, onSet = null) {
        this.minMillis = minMillis;
        this.maxMillis = maxMillis;
        if (chartOptions.offset && (typeof chartOptions.offset == "string")) {[]
            this.offsetName = chartOptions.offset;
        }

        if (millis === null) {
            millis = this.maxMillis;
        }
      
        this.chartOptions.setOptions(chartOptions);
        moment.locale(this.chartOptions.dateLocale);
        this.millis = millis;
        this.onSet = onSet;
        this.targetElement = d3.select(this.renderTarget)
            .classed("tsi-singleDateTimePicker", true)
        this.targetElement.html('');
        super.themify(this.targetElement, this.chartOptions.theme);

        this.targetElement.on('keydown', (event) => {
            if (event.keyCode <= 40 && event.keyCode >= 37) { //arrow key
                event.stopPropagation();
            }
            if (event.keyCode === 27 && this.chartOptions.dTPIsModal) { //escape
                this.onSet();
            }
        });
        this.timeControls = this.targetElement.append("div").classed("tsi-timeControlsContainer", true);
        this.calendar = this.targetElement.append("div").classed("tsi-calendarPicker", true);
        var saveButtonContainer = this.targetElement.append("div").classed("tsi-saveButtonContainer", true);
        var self = this;
        this.saveButton = saveButtonContainer.append("button").classed("tsi-saveButton", true).text(this.getString("Save"))
            .on("click", () =>  {
                if (this.isValid) {
                    self.onSet(this.millis);
                }
            })
            .on('keydown', (event) => {
                if (event.keyCode === 9 && !event.shiftKey && this.chartOptions.dTPIsModal) { // tab
                    this.timeInput.node().focus();
                    event.preventDefault();
                }    
            })
        
        this.targetElement.append("div").classed("tsi-errorMessageContainer", true);
        this.createCalendar();
        this.calendarPicker.draw();
        this.createTimePicker();

        this.updateDisplayedDateTime();

        this.date = new Date(this.millis);
        this.calendarPicker.draw();
        if (this.chartOptions.dTPIsModal) {
            this.timeInput.node().focus();
        }
        return;
    }

    //zero out everything but year, month and day
    private roundDay (d: Date) {
        let offsetDate = Utils.offsetFromUTC(d, this.chartOptions.offset);
        return new Date(offsetDate.getUTCFullYear(), offsetDate.getUTCMonth(), offsetDate.getUTCDate());
    }

    private setSelectedDate (d: Date) {
        this.calendarPicker.setDate(d, true);
        this.setDate(d);
        this.timeInput.node().value = this.createTimeString(Utils.offsetFromUTC(new Date(this.millis)));
    }

    private createCalendar () {
        var i18nOptions = {
            previousMonth : this.getString('Previous Month'),
            nextMonth     : this.getString('Next Month'),
            months        : moment.localeData().months(),
            weekdays      : moment.localeData().weekdays(),
            weekdaysShort : moment.localeData().weekdaysMin()
        };

        //@ts-ignore
        this.calendarPicker = new Pikaday({
            bound: false,
            container: this.calendar.node(),
            field: this.calendar.node(),
            i18n: i18nOptions,
            numberOfMonths: 1,
            onSelect: (d) => {
                this.setSelectedDate(d);
                this.calendarPicker.draw();
                this.checkDateTimeValidity();
            },
            onDraw: (d) => {
                var self = this;
                this.calendar.select(".pika-single").selectAll('button').attr('tabindex', -1);
            },
            minDate: this.convertToLocal(Utils.offsetFromUTC(new Date(this.minMillis), this.chartOptions.offset)),
            maxDate: this.convertToLocal(Utils.offsetFromUTC(new Date(this.maxMillis), this.chartOptions.offset)),
            defaultDate: this.convertToLocal(Utils.offsetFromUTC(new Date(this.millis), this.chartOptions.offset))
        });
    }

    private setDate (d: Date) {
        var date = Utils.offsetFromUTC(new Date(this.millis), this.chartOptions.offset);
        date.setUTCFullYear(d.getFullYear());
        date.setUTCMonth(d.getMonth());
        date.setUTCDate(d.getDate());
        this.setMillis(date.valueOf(), true);
    }

    private setIsValid (isValid: boolean){
        this.isValid = isValid;
    }

    private setMillis (millis: number, shouldOffset = true) {
        var adjustedMillis = millis - (shouldOffset ? Utils.getOffsetMinutes(this.chartOptions.offset, millis) * 60 * 1000 : 0);
        this.millis = adjustedMillis;
    } 

    private displayErrors (rangeErrors) {
        this.targetElement.select(".tsi-errorMessageContainer").selectAll(".tsi-errorMessage").remove();
        if (rangeErrors.length != 0) {
            this.targetElement.select(".tsi-errorMessageContainer").selectAll(".tsi-errorMessages")
                .data(rangeErrors)
                .enter()
                .append("div")
                .classed("tsi-errorMessage", true)
                .text(d => d);
        }
    }

    private checkDateTimeValidity () {
        let parsedMillis = this.parseUserInputDateTime();
        let errorCheck = this.dateTimeIsValid(parsedMillis);
        this.displayErrors(errorCheck.errors);
        this.setIsValid(errorCheck.rangeIsValid);
    }

    private dateTimeIsValid (prospectiveMillis: number) {
        var accumulatedErrors = [];

        if (isNaN(prospectiveMillis)) {
            accumulatedErrors.push('*time is invalid');
        } else {
            var firstDateTime = Utils.offsetFromUTC(new Date(this.minMillis), this.chartOptions.offset);
            var lastDateTime =  Utils.offsetFromUTC(new Date(this.maxMillis), this.chartOptions.offset);    
            if (prospectiveMillis < this.minMillis) {
                accumulatedErrors.push("*date/time is before first possible date and time (" + this.getTimeFormat()(firstDateTime) + ")");
            }
            if (prospectiveMillis > this.maxMillis) {
                accumulatedErrors.push("*date/time is after last possible date and time (" + this.getTimeFormat()(lastDateTime) + ")");
            }
        }

        return {
            rangeIsValid : (accumulatedErrors.length == 0),
            errors: accumulatedErrors
        };
    }

    private getTimeFormat () {
        return Utils.timeFormat(true, true, this.chartOptions.offset, true, 0, null, this.chartOptions.dateLocale);
    }

    private parseUserInputDateTime () {
        return Utils.parseUserInputDateTime(this.timeInput.node().value, this.chartOptions.offset);
    }

    private convertToCalendarDate (millis: number) {
        return this.roundDay(Utils.adjustDateFromTimezoneOffset(Utils.offsetFromUTC(new Date(millis), this.chartOptions.offset)));
    }

    private updateDisplayedDateTime (fromInput: boolean = false) {
        let selectedDate = new Date(this.millis);
        this.calendarPicker.setDate(this.convertToCalendarDate(this.millis), fromInput);
        if (!fromInput) {
            this.timeInput.node().value = this.createTimeString(Utils.offsetFromUTC(selectedDate));
        }
    }

    private createTimeString (currDate: Date) {
        let offsetDate = Utils.offsetFromUTC(currDate, this.chartOptions.offset);
        return this.getTimeFormat()(currDate);
    }

    // convert to representation such that: convertedDate.toString() === originalDate.toISOString()
    private convertToLocal (date: Date) {
        return new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
    }

    private createTimePicker () {
        var self = this;
        let timeLabel = this.timeControls.append("h4").classed("tsi-timeLabel", true).text(this.getString('Date/Time'));
        this.timeInput = this.timeControls.append('input').attr('class', 'tsi-dateTimeInput tsi-input')
            .on('input', () => {
                this.checkDateTimeValidity();
                if (this.isValid) {
                    let parsedMillis = this.parseUserInputDateTime();
                    this.setMillis(parsedMillis, false);
                    this.updateDisplayedDateTime(true);
                }
            })
            .on('keydown', (event) => {
                if (event.keyCode === 9 && event.shiftKey && this.chartOptions.dTPIsModal) { // tab
                    this.saveButton.node().focus();
                    event.preventDefault();
                }        
            });
    }
}

export default SingleDateTimePicker;