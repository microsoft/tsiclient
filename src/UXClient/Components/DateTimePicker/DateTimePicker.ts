import * as d3 from 'd3';
import * as Pikaday from '../../../packages/pikaday/pikaday';
import * as moment from 'moment';
import './DateTimePicker.scss';
import '../../../packages/pikaday/css/pikaday.css';
import { ChartComponent } from '../../Interfaces/ChartComponent';
import { TimezonePicker } from '../TimezonePicker/TimezonePicker';
import { entries } from 'd3';
import { Utils } from "./../../Utils";


class DateTimePicker extends ChartComponent{
    private calendar: any;
    private calendarPicker: any;
    private timeControls: any;
    private minMillis: number;
    private maxMillis: number;
    private fromMillis: number;
    private toMillis: number;
    private fromMinutes: number;
    private fromHours: number;
    private toMinutes: number;
    private toHours: number;
    private onSet: any;
    private onCancel: any;
    private targetElement: any;
    private isValid: boolean = true;

    private isSettingStartTime: boolean = true;
    private startRange;
    private endRange;
    private anchorDate;
    private offsetName: string;

    private fromInput: any;
    private toInput: any;

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    private setNewOffset (oldOffset: any) {
        var valuesToUpdate = ["minMillis", "maxMillis"];
        valuesToUpdate.forEach((currValue: string) => {
            var oldOffsetMinutes = Utils.getMinutesToUTC(oldOffset, this[currValue]);
            var utcMillis = this[currValue] + (oldOffsetMinutes * 60 * 1000);
            this[currValue] = utcMillis + Utils.getOffsetMinutes(this.chartOptions.offset, utcMillis) * 60 * 1000;
        });   
        this.setFromMillis(this.fromMillis);
        this.setToMillis(this.toMillis);
        
        this.updateDisplayedFromDateTime();
        this.updateDisplayedToDateTime();

        this.startRange = new Date(this.fromMillis);
        this.endRange = new Date(this.toMillis);

        this.calendarPicker.config({minDate: this.roundDay(this.offsetFromUTC(new Date(this.minMillis)))});
        this.calendarPicker.config({maxDate: this.roundDay(this.offsetFromUTC(new Date(this.maxMillis)))});

        this.calendarPicker.draw();

        var rangeErrorCheck = this.rangeIsValid(this.fromMillis, this.toMillis);
        this.setIsSaveable(rangeErrorCheck.isSaveable);
        this.displayRangeErrors(rangeErrorCheck.errors);
    }

    public render (chartOptions: any = {}, minMillis: number, maxMillis: number, 
                   fromMillis: number = null, toMillis: number = null, onSet = null, onCancel = null) {
        this.isSettingStartTime = true;
        this.minMillis = minMillis;
        this.maxMillis = maxMillis;
        if (chartOptions.offset && (typeof chartOptions.offset == "string")) {
            this.offsetName = chartOptions.offset;
        }

        if (toMillis == null) {
            toMillis = this.maxMillis;
        }
        if (fromMillis == null) {
            fromMillis = Math.max(toMillis - (24 * 60 * 60 * 1000), minMillis);
        }
        this.chartOptions.setOptions(chartOptions);
        moment.locale(this.chartOptions.dateLocale);
        this.fromMillis = fromMillis;
        this.toMillis = toMillis;
        this.onSet = onSet;
        this.onCancel = onCancel;
        this.targetElement = d3.select(this.renderTarget)
            .classed("tsi-dateTimePicker", true);
        this.targetElement.node().innerHTML = "";
        super.themify(this.targetElement, this.chartOptions.theme);
        this.timeControls = this.targetElement.append("div").classed("tsi-timeControlsContainer", true);
        this.calendar = this.targetElement.append("div").classed("tsi-calendarPicker", true);
        this.createTimezonePicker();
        var saveButtonContainer = this.targetElement.append("div").classed("tsi-saveButtonContainer", true);
        var self = this;

        var onSaveOrCancel = () => {
            this.isSettingStartTime = true;
        }

        var saveButton = saveButtonContainer.append("button").classed("tsi-saveButton", true).html(this.getString("Save"))
            .on("click", function () {
                self.onSet(self.fromMillis, self.toMillis, self.chartOptions.offset);
                onSaveOrCancel();
            });
        
        var cancelButton = saveButtonContainer.append('button')
            .attr('class', 'tsi-cancelButton')
            .html(this.getString('Cancel'))
            .on('click', function () {
                self.onCancel();
                onSaveOrCancel();
            })

        //originally set toMillis to last possible time
        this.toMillis = this.maxMillis;
        this.setFromMillis(fromMillis);
        this.setToMillis(toMillis); 
        
        this.targetElement.append("div").classed("tsi-errorMessageContainer", true);
        this.createTimePicker();
        this.createCalendar();
        this.calendarPicker.draw();

        this.updateDisplayedFromDateTime();
        this.updateDisplayedToDateTime();

        this.startRange = new Date(this.fromMillis);
        this.endRange = new Date(this.toMillis);
        this.calendarPicker.draw();
        return;
    }

    private updateDisplayedDateTimes () {
        ['from', 'to'].forEach((fromOrTo) => {
            var selectedDate = new Date(this[fromOrTo + 'Millis']);
            this.calendarPicker.setDate(this.roundDay(Utils.offsetFromUTC(selectedDate)));
            this[fromOrTo + 'Input'].node().value = this.createTimeString(Utils.offsetFromUTC(selectedDate));    
        })
    }

    private createTimeString (currDate: Date) {
        let offsetDate = Utils.offsetFromUTC(currDate, this.chartOptions.offset);
        return this.getTimeFormat()(currDate);
    }

    private getTimeFormat () {
        return Utils.timeFormat(true, true, this.chartOptions.offset, true, 0, null, this.chartOptions.dateLocale);
    }

    public updateFromAndTo (fromMillis, toMillis) {
        this.setFromMillis(fromMillis);
        this.setToMillis(toMillis);

        this.updateDisplayedFromDateTime();
        this.updateDisplayedToDateTime();

        this.startRange = new Date(this.fromMillis);
        this.endRange = new Date(this.toMillis);
        this.calendarPicker.draw();
    }

    private createTimezonePicker () {
        const offset = this.chartOptions.offset;
        if (this.chartOptions.includeTimezones && (typeof offset == "string" || offset == 0)) {
            var timezoneContainer = this.targetElement.append("div").attr("class", "tsi-timezoneContainer");
            timezoneContainer.append("h4").classed("tsi-timeLabel", true).html(this.getString("Time Zone"));
            var timezonePickerContainer = timezoneContainer.append("div").classed("tsi-timezonePickerContainer", true);
            var timezonePicker = new TimezonePicker(timezonePickerContainer.node());
            timezonePicker.render((newOffset) => {
                var oldOffset = this.chartOptions.offset;
                this.chartOptions.offset = newOffset;
                this.setNewOffset(oldOffset);
            }, (typeof offset == "string" ? offset : "UTC"));
        }
    }

    //zero out everything but year, month and day
    private roundDay (d: Date) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    private setTimeRange (d: Date, isFromSelect: boolean) {
        if (this.isSettingStartTime) {
            this.calendarPicker.setStartRange(d);
            this.calendarPicker.setEndRange(null);
            this.startRange = d;
            this.anchorDate = d;
        }
        else {
            if (d.valueOf() > this.anchorDate.valueOf()) {
                if (isFromSelect) {
                    this.setFromDate(this.anchorDate);
                    this.setToDate(d);
                }
                this.calendarPicker.setEndRange(d);
                this.calendarPicker.setStartRange(this.anchorDate);
                this.startRange = this.anchorDate;
                this.endRange = d;
            } else {
                if (isFromSelect) {
                    this.setFromDate(d);
                    this.setToDate(this.anchorDate);
                }

                this.calendarPicker.setStartRange(d);
                this.calendarPicker.setEndRange(this.anchorDate);
                this.endRange = this.anchorDate;
                this.startRange = d;
            }
            this.setTimeInputBox(this.fromMillis, true);
            this.setTimeInputBox(this.toMillis, false);
        }
    }

    private createCalendar () {
        var i18nOptions = {
            previousMonth : this.getString('Previous Month'),
            nextMonth     : this.getString('Next Month'),
            months        : moment.localeData()._months,
            weekdays      : moment.localeData()._weekdays,
            weekdaysShort : moment.localeData()._weekdaysMin
        };

        this.calendarPicker = new Pikaday({ 
            bound: false,
            container: this.calendar.node(),
            field: this.calendar.node(),
            i18n: i18nOptions,
            numberOfMonths: 2,
            onSelect: (d) => {
                this.setTimeRange(d, true);
                this.isSettingStartTime = !this.isSettingStartTime;
                this.calendarPicker.draw();
            },
            onDraw: (d) => {
                if (this.isSettingStartTime)
                    return; 
                var self = this;
                this.calendar.select(".pika-single").selectAll(".pika-day")
                    .on("mouseover", function (d) { 
                        var date = new Date( Number(d3.select(this).attr("data-pika-year")),
                                            Number(d3.select(this).attr("data-pika-month")), 
                                            Number(d3.select(this).attr("data-pika-day")));
                        if (!self.isSettingStartTime) {
                            if (date.valueOf() < self.anchorDate.valueOf() && self.startRange.valueOf() != date.valueOf()) {
                                self.setTimeRange(date, false);
                                self.calendarPicker.draw();
                                return;
                            }
                            if (date.valueOf() >= self.anchorDate.valueOf() && (self.endRange == undefined || self.endRange.valueOf() != date.valueOf())) {
                                self.setTimeRange(date, false);
                                self.calendarPicker.draw();
                                return;
                            }
                        }
                    });
            },
            minDate: this.offsetFromUTC(new Date(this.minMillis)),
            maxDate: this.offsetFromUTC(new Date(this.maxMillis)),
            defaultDate: this.offsetFromUTC(new Date(this.fromMillis))
        });
    }

    private setFromDate (d: Date) {
        var fromDate = new Date(this.fromMillis);
        fromDate.setUTCFullYear(d.getFullYear());
        fromDate.setUTCMonth(d.getMonth());
        fromDate.setUTCDate(d.getDate());
        this.setFromMillis(fromDate.valueOf());
    }

    private setToDate (d: Date) {
        var toDate = new Date(this.toMillis);
        toDate.setUTCFullYear(d.getFullYear());
        toDate.setUTCMonth(d.getMonth());
        toDate.setUTCDate(d.getDate());
        this.setToMillis(toDate.valueOf());
    }

    private setIsSaveable (isSaveable: boolean){
        // For now, lets allow users to save the time even in the presence of errors
        this.targetElement.select(".tsi-saveButtonContainer").select(".tsi-saveButton")
            .attr("disabled", isSaveable ? null : true)
            .classed("tsi-buttonDisabled", !isSaveable);
        this.isValid = isSaveable;
    }

    //line up the seconds and millis with the second and millis of the max date
    private adjustSecondsAndMillis (rawMillis) {
        var currDate = new Date(rawMillis);
        var maxDate = new Date(this.maxMillis);
        currDate.setUTCSeconds(maxDate.getUTCSeconds());
        currDate.setUTCMilliseconds(maxDate.getUTCMilliseconds());
        return currDate.valueOf();
    }

    private setFromMillis (millis: number) {
        var adjustedMillis = this.adjustSecondsAndMillis(millis);
        var rangeErrorCheck = this.rangeIsValid(millis, this.toMillis);
        this.fromMillis = adjustedMillis;
        this.setIsSaveable(rangeErrorCheck.isSaveable);
        this.displayRangeErrors(rangeErrorCheck.errors);
    } 

    private setToMillis (millis: number) {
        var adjustedMillis = this.adjustSecondsAndMillis(millis);
        var rangeErrorCheck = this.rangeIsValid(this.fromMillis, adjustedMillis);
        this.toMillis = adjustedMillis;
        this.setIsSaveable(rangeErrorCheck.isSaveable);
        this.displayRangeErrors(rangeErrorCheck.errors);
    }

    private displayRangeErrors (rangeErrors) {
        this.targetElement.select(".tsi-errorMessageContainer").selectAll(".tsi-errorMessage").remove();
        if (rangeErrors.length != 0) {
            this.targetElement.select(".tsi-errorMessageContainer").selectAll(".tsi-errorMessages")
                .data(rangeErrors)
                .enter()
                .append("div")
                .classed("tsi-errorMessage", true)
                .html(d => d);
        }
    }

    private rangeIsValid (prospectiveFromMillis: number, prospectiveToMillis: number) {
        var accumulatedErrors = [];
        var isSaveable = true;
        var firstDateTime = new Date(this.minMillis);
        var firstTimeText = Utils.getUTCHours(firstDateTime, this.chartOptions.is24HourTime) + ":" + 
                            (firstDateTime.getUTCMinutes() < 10 ? "0" : "") + String(firstDateTime.getUTCMinutes()) +
                            (this.chartOptions.is24HourTime ? "" : (firstDateTime.getUTCHours() < 12 ? " AM" : " PM"));
        var lastDateTime = new Date(this.maxMillis);
        var lastTimeText = Utils.getUTCHours(lastDateTime, this.chartOptions.is24HourTime) + ":" + 
                           (lastDateTime.getUTCMinutes() < 10 ? "0" : "") + String(lastDateTime.getUTCMinutes()) + 
                           (this.chartOptions.is24HourTime ? "" : (lastDateTime.getUTCHours() < 12 ? " AM" : " PM"));
        let bothTimesValid = !isNaN(prospectiveFromMillis) && !isNaN(prospectiveToMillis);

        if (isNaN(prospectiveFromMillis)) {
            accumulatedErrors.push("*Invalid from date/time");
            isSaveable = false;
        }

        if (isNaN(prospectiveToMillis)) {
            accumulatedErrors.push("*Invalid to date/time");
            isSaveable = false;
        }

        if (bothTimesValid) {
            if (prospectiveFromMillis > prospectiveToMillis) {
                accumulatedErrors.push("*Start time must be before end time");
                isSaveable = false;
            }
            if (prospectiveFromMillis < this.minMillis) {
                accumulatedErrors.push("*Start time is before first possible time (" + firstTimeText + ")");
            }
            if (prospectiveFromMillis > this.maxMillis) {
                accumulatedErrors.push("*Start time is after last possible time (" + lastTimeText + ")");
            }
            if (prospectiveToMillis > this.maxMillis) {
                accumulatedErrors.push("*End time is after last possible time (" + lastTimeText + ")");            
            }
            if (prospectiveToMillis < this.minMillis) {
                accumulatedErrors.push("*End time is before first possible time (" + firstTimeText + ")");
            }    
        }
        return {
            rangeIsValid : (accumulatedErrors.length == 0),
            errors: accumulatedErrors,
            isSaveable: isSaveable
        };
    }

    private updateDisplayedFromDateTime (fromInput = false) {
        var fromDate = new Date(this.fromMillis);
        this.calendarPicker.setStartRange(this.roundDay(this.offsetFromUTC(fromDate)));
        if (!fromInput)
            this.setTimeInputBox(fromDate, true);
    }

    private updateDisplayedToDateTime (fromInput = false) {
        var toDate = new Date(this.toMillis);
        this.calendarPicker.setEndRange(this.roundDay(this.offsetFromUTC(toDate)));
        if (!fromInput)
            this.setTimeInputBox(toDate, false);
    }

    private offsetUTC (date: Date) {
        var dateCopy = new Date(date.valueOf())
        dateCopy.setTime( dateCopy.getTime() - dateCopy.getTimezoneOffset()*60*1000 );
        return dateCopy;
    }

    private offsetFromUTC(date: Date) {
        var dateCopy = new Date(date.valueOf())
        dateCopy.setTime( dateCopy.getTime() + dateCopy.getTimezoneOffset()*60*1000 );
        return dateCopy;    
    }

    private checkDateTimeValidity () {
        let parsedFrom = Utils.parseUserInputDateTime(this.fromInput.node().value, this.chartOptions.offset);
        let parsedTo = Utils.parseUserInputDateTime(this.toInput.node().value, this.chartOptions.offset);
        let rangeErrorCheck = this.rangeIsValid(parsedFrom, parsedTo);
        this.setIsSaveable(rangeErrorCheck.isSaveable);
        this.displayRangeErrors(rangeErrorCheck.errors);
    }

    private setTimeInputBox (utcDate, isFrom) {
        if (isFrom) {
            this.fromInput.node().value = this.createTimeString(Utils.offsetFromUTC(utcDate));
        } else {
            this.toInput.node().value = this.createTimeString(Utils.offsetFromUTC(utcDate));
        }
    }

    private createTimePicker () {
        var timeInputContainer = this.timeControls.append("div").attr("class", "tsi-timeInputContainer");
        var createTimePicker = (startOrEnd) => {
            var fromOrToContainer = timeInputContainer.append("div").classed("tsi-" + startOrEnd + "Container", true);
            let timeLabel = fromOrToContainer.append("h4").classed("tsi-timeLabel", true).html(this.getString(startOrEnd));
            let inputName = startOrEnd === 'start' ? 'fromInput' : 'toInput'
            this[inputName] = fromOrToContainer.append('input').attr('class', 'tsi-dateTimeInput', true)
                .on('input', () => {
                    let rangeErrorCheck: any = this.checkDateTimeValidity();
                    this.isSettingStartTime = true;
                    if (this.isValid) {
                        if (startOrEnd === 'start') {
                            let parsedFrom = Utils.parseUserInputDateTime(this.fromInput.node().value, this.chartOptions.offset);
                            this.setFromMillis(parsedFrom);
                            this.updateDisplayedFromDateTime(true);
                            this.calendarPicker.draw();
                        } else {
                            let parsedTo = Utils.parseUserInputDateTime(this.toInput.node().value, this.chartOptions.offset);
                            this.setToMillis(parsedTo);
                            this.updateDisplayedToDateTime(true);
                            this.calendarPicker.draw();
                        }
                    }
                });
            if (startOrEnd == 'end') {
                timeLabel.append("button")
                    .attr("class", "tsi-snapToEndRangeButton")
                    .html(this.getString("Latest"))
                    .on("click", () => {
                        this.setFromDate(this.startRange);
                        this.setToMillis(this.maxMillis);
                        this.updateDisplayedFromDateTime();
                        this.updateDisplayedToDateTime();
                        this.isSettingStartTime = true;
                        this.calendarPicker.draw();
                    })
            }
        }
        createTimePicker("start");
        createTimePicker("end");
    }
}

export {DateTimePicker};