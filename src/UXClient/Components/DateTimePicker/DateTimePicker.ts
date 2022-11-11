import * as d3 from 'd3';
import Pikaday from '../../../packages/pikaday/pikaday';
import '../../../packages/pikaday/css/pikaday.css'
import moment from 'moment';
import './DateTimePicker.scss';
import { ChartComponent } from '../../Interfaces/ChartComponent';
import TimezonePicker from '../TimezonePicker/TimezonePicker';
import Utils from "../../Utils";

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
    private isValid: boolean = true;

    private targetElement: any;
    private dateTimeSelectionPanel: any;
    private quickTimesPanel: any;

    private isSettingStartTime: boolean = true;
    private startRange;
    private endRange;
    private anchorDate;
    private offsetName: string;

    private fromInput: any;
    private toInput: any;

    private quickTimeArray: Array<any> = [
        ["Last 15 mins", 15 * 60 * 1000],
        ["Last 30 mins", 30 * 60 * 1000],
        ["Last Hour", 60 * 60 * 1000],
        ["Last 2 Hours", 2 * 60 * 60 * 1000],
        ["Last 4 Hours", 4 * 60 * 60 * 1000],
        ["Last 12 Hours", 12 * 60 * 60 * 1000],
        ["Last 24 Hours", 24 * 60 * 60 * 1000],
        ["Last 7 Days", 7 * 24 * 60 * 60 * 1000],
        ["Last 30 Days", 30 * 24 * 60 * 60 * 1000],
        ["Last 90 Days", 90 * 24 * 60 * 60 * 1000]
    ];
	

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    // returns -1 if not currently a quicktime
    private getCurrentQuickTime () {
        let matchingQuickTime = this.quickTimeArray.filter((quickTimeTuple) => {
            return (this.toMillis - this.fromMillis === quickTimeTuple[1]);
        });
        if (matchingQuickTime.length !== 1 || this.toMillis !== this.maxMillis) {
            return -1;
        }
        return matchingQuickTime[0][1];
    }

    public getQuickTimeText (quickTimeMillis) {
        let filteredQuickTime = this.quickTimeArray.filter((quickTimeTuple) => {
            return (quickTimeMillis === quickTimeTuple[1]);
        });
        if (filteredQuickTime.length !== 1) {
            return null;
        }
        return filteredQuickTime[0][0];
    }

    private convertToCalendarDate (millis) {
        return this.roundDay(Utils.adjustDateFromTimezoneOffset(Utils.offsetFromUTC(new Date(millis), this.chartOptions.offset)))
    }

    private setNewOffset (oldOffset: any) {
        var valuesToUpdate = ['fromMillis', 'toMillis'];
        valuesToUpdate.forEach((currValue: string) => {
            var oldOffsetMinutes = Utils.getMinutesToUTC(oldOffset, this[currValue]);
            var utcMillis = this[currValue] - (oldOffsetMinutes * 60 * 1000);
            this[currValue] = utcMillis - Utils.getOffsetMinutes(this.chartOptions.offset, utcMillis) * 60 * 1000;
        });   

        this.setFromMillis(this.fromMillis);
        this.setToMillis(this.toMillis);

        this.updateDisplayedFromDateTime();
        this.updateDisplayedToDateTime();

        this.startRange = new Date(this.fromMillis);
        this.endRange = new Date(this.toMillis);

        this.calendarPicker.config({minDate: this.convertToCalendarDate(this.minMillis)});
        this.calendarPicker.config({maxDate: this.convertToCalendarDate(this.maxMillis)});

        this.calendarPicker.draw();

        var rangeErrorCheck = this.rangeIsValid(this.fromMillis, this.toMillis);
        this.setIsSaveable(rangeErrorCheck.isSaveable);
        this.displayRangeErrors(rangeErrorCheck.errors);
    }

    private onSaveOrCancel = () => {
        this.isSettingStartTime = true;
    }

    public render (chartOptions: any = {}, minMillis: number, maxMillis: number, 
                   fromMillis: number = null, toMillis: number = null, onSet = null, onCancel = null) {
        this.isSettingStartTime = true;
        this.minMillis = minMillis;
        this.maxMillis = maxMillis;
        if (chartOptions.offset && (typeof chartOptions.offset === "string")) {
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
        this.targetElement.html('');
        super.themify(this.targetElement, this.chartOptions.theme);

        let group = this.targetElement.append('div')
            .classed('tsi-dateTimeGroup', true)
            .on('keydown', (event) => {
                if (event.keyCode <= 40 && event.keyCode >= 37) { //arrow key
                    event.stopPropagation();
                }
                if (event.keyCode === 27 && this.chartOptions.dTPIsModal) { //escape
                    this.onCancel();
                    this.onSaveOrCancel();
                }
            });

        this.quickTimesPanel = group.append('div')
            .classed('tsi-quickTimesPanel', true);
        this.buildQuickTimesPanel();

        this.dateTimeSelectionPanel = group.append('div')
            .classed('tsi-dateTimeSelectionPanel', true);

        this.timeControls = this.dateTimeSelectionPanel.append("div").classed("tsi-timeControlsContainer", true);
        this.calendar = this.dateTimeSelectionPanel.append("div").classed("tsi-calendarPicker", true);
        this.createTimezonePicker();
        var saveButtonContainer = this.dateTimeSelectionPanel.append("div").classed("tsi-saveButtonContainer", true);
        var self = this;


        var saveButton = saveButtonContainer.append("button").classed("tsi-saveButton", true).text(this.getString("Save"))
            .on("click", function () {
                self.onSet(self.fromMillis, self.toMillis, self.chartOptions.offset, self.maxMillis === self.toMillis, self.getCurrentQuickTime());
                self.onSaveOrCancel();
            });
        
        var cancelButton = saveButtonContainer.append('button')
            .attr('class', 'tsi-cancelButton')
            .text(this.getString('Cancel'))
            .on('click', () => {
                this.onCancel();
                this.onSaveOrCancel();
            })
            .on('keydown', (event) => {
                if (event.keyCode === 9 && !event.shiftKey && this.chartOptions.dTPIsModal) { // tab
                    this.quickTimesPanel.selectAll('.tsi-quickTime')
                        .filter((d, i) => i === 0)
                        .node()
                        .focus();
                    event.preventDefault();
                }
            });

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

    private setFromQuickTimes (relativeMillis) {
        this.isSettingStartTime = true;
        this.setToMillis(this.maxMillis);
        this.setFromMillis(this.maxMillis - relativeMillis); 
        this.updateDisplayedFromDateTime();
        this.updateDisplayedToDateTime();
        this.calendarPicker.draw();
    }

    private buildQuickTimesPanel () {
        let quickTimes = this.quickTimesPanel.selectAll('.tsi-quickTime')
            .data(this.quickTimeArray);
        let enteredQuickTimes = quickTimes.enter()
            .append('button')
            .attr('class', 'tsi-quickTime')
            .on('click', (event, d) => {
                this.setFromQuickTimes(d[1]);
            })
            .text((d) => d[0])
            .attr('aria-label', (d) => `${this.getString('select quick time of')} ${d[0]}`);
        // wrap around tab order if dTP in modal form
        let firstQuickTime = enteredQuickTimes.filter((d, i) => {
            return (i === 0);
        })            
        .on('keydown', (event) => {
            if (event.keyCode === 9 && event.shiftKey && this.chartOptions.dTPIsModal) { // shift tab
                this.dateTimeSelectionPanel.select(".tsi-saveButtonContainer").select(".tsi-cancelButton").node().focus();
                event.preventDefault();
            }
        });

        if (this.chartOptions.dTPIsModal) {
            firstQuickTime.node().focus();
        }
    }

    private createTimeString (currDate: Date) {
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
            var timezoneContainer = this.dateTimeSelectionPanel.append("div").attr("class", "tsi-timezoneContainer");
            let timezoneSelectionLabelID = Utils.guid();
            let timezoneSelectionID = timezoneSelectionLabelID + 'Tz';
            timezoneContainer.append("label")
                .classed("tsi-timeLabel", true)
                .attr('aria-label', this.getString('timezone selection'))
                .attr('id', timezoneSelectionLabelID)
                .attr('for', timezoneSelectionID)
                .text(this.getString('timezone'));
            var timezonePickerContainer = timezoneContainer.append("div").classed("tsi-timezonePickerContainer", true);
            var timezonePicker = new TimezonePicker(timezonePickerContainer.node());
            timezonePicker.render((newOffset) => {
                let matchingQuickTime = this.getCurrentQuickTime();
                var oldOffset = this.chartOptions.offset;
                this.chartOptions.offset = newOffset;
                this.setNewOffset(oldOffset);
                if (matchingQuickTime !== -1) {
                    this.setFromQuickTimes(matchingQuickTime); 
                }
            }, (typeof offset == "string" ? offset : "UTC"));
            d3.select(timezonePicker.renderTarget).select('select')
                .attr('aria-labelledBy', timezoneSelectionLabelID)
                .attr('id', timezoneSelectionID);
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
                    .on("mouseover", function () { 
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
            minDate: this.convertToCalendarDate(this.minMillis),
            maxDate: this.convertToCalendarDate(this.maxMillis),
            defaultDate: Utils.adjustDateFromTimezoneOffset(new Date(this.fromMillis))
        });
    }

    private setSelectedQuickTimes () {
        let isSelected = d => {
            return (this.toMillis === this.maxMillis && (this.toMillis - this.fromMillis === d[1]));
        }
        this.quickTimesPanel.selectAll('.tsi-quickTime')
        .classed('tsi-isSelected', isSelected)
        .attr('aria-pressed', isSelected);
    }

    private setFromDate (calendarDate: Date) {
        let convertedFrom = new Date(Utils.offsetFromUTC(new Date(this.fromMillis), this.chartOptions.offset));
        convertedFrom.setUTCFullYear(calendarDate.getFullYear());
        convertedFrom.setUTCMonth(calendarDate.getMonth());
        convertedFrom.setUTCDate(calendarDate.getDate());
        this.setFromMillis(Utils.offsetToUTC(convertedFrom, this.chartOptions.offset).valueOf());
    }

    private setToDate (calendarDate: Date) {
        let convertedTo = new Date(Utils.offsetFromUTC(new Date(this.toMillis), this.chartOptions.offset));
        convertedTo.setUTCFullYear(calendarDate.getFullYear());
        convertedTo.setUTCMonth(calendarDate.getMonth());
        convertedTo.setUTCDate(calendarDate.getDate());
        this.setToMillis(Utils.offsetToUTC(convertedTo, this.chartOptions.offset).valueOf());
    }

    private setIsSaveable (isSaveable: boolean){
        // For now, lets allow users to save the time even in the presence of errors
        this.dateTimeSelectionPanel.select(".tsi-saveButtonContainer").select(".tsi-saveButton")
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
        var rangeErrorCheck = this.rangeIsValid(millis, this.toMillis);
        this.fromMillis = millis;
        this.setIsSaveable(rangeErrorCheck.isSaveable);
        this.displayRangeErrors(rangeErrorCheck.errors);
        this.setSelectedQuickTimes();
    } 

    private setToMillis (millis: number) {
        var rangeErrorCheck = this.rangeIsValid(this.fromMillis, millis);
        this.toMillis = millis;
        this.setIsSaveable(rangeErrorCheck.isSaveable);
        this.displayRangeErrors(rangeErrorCheck.errors);
        this.setSelectedQuickTimes();
    }

    private displayRangeErrors (rangeErrors) {
        this.targetElement.select(".tsi-errorMessageContainer").selectAll(".tsi-errorMessage").remove();
        if (rangeErrors.length != 0) {
            this.targetElement.select(".tsi-errorMessageContainer").selectAll(".tsi-errorMessages")
                .data(rangeErrors)
                .enter()
                .append("div")
                .classed("tsi-errorMessage", true)
                .attr('role', 'alert')

                .attr('aria-live', 'assertive')

                .text(d => d);
                
              
        }
    }

    private rangeIsValid (prospectiveFromMillis: number, prospectiveToMillis: number) {
        var accumulatedErrors = [];
        var isSaveable = true;
        let bothTimesValid = !isNaN(prospectiveFromMillis) && !isNaN(prospectiveToMillis);

        if (isNaN(prospectiveFromMillis)) {

            accumulatedErrors.push("*Invalid Start date/time");

            isSaveable = false;
        }

        if (isNaN(prospectiveToMillis)) {
            accumulatedErrors.push("*Invalid end date/time");
            isSaveable = false;
        }

        if (bothTimesValid) {
            if (prospectiveFromMillis > prospectiveToMillis) {
                accumulatedErrors.push("*Start time must be before end time");
                isSaveable = false;
            }
            if (prospectiveFromMillis < this.minMillis) {
                accumulatedErrors.push("*Start time is before first possible time (" + this.getTimeFormat()(this.minMillis) + ")");
            }
            if (prospectiveFromMillis > this.maxMillis) {
                accumulatedErrors.push("*Start time is after last possible time (" + this.getTimeFormat()(this.maxMillis) + ")");
            }
            if (prospectiveToMillis > this.maxMillis) {
                accumulatedErrors.push("*End time is after last possible time (" + this.getTimeFormat()(this.maxMillis) + ")");            
            }
            if (prospectiveToMillis < this.minMillis) {
                accumulatedErrors.push("*End time is before first possible time (" + this.getTimeFormat()(this.minMillis) + ")");
            }    
        }
        return {
            rangeIsValid : (accumulatedErrors.length == 0),
            errors: accumulatedErrors,
            isSaveable: isSaveable
        };
    }

    private updateDisplayedFromDateTime (fromInput = false) {
        this.calendarPicker.setStartRange(this.convertToCalendarDate(this.fromMillis));
        if (!fromInput)
            this.setTimeInputBox(new Date(this.fromMillis), true);
    }

    private updateDisplayedToDateTime (fromInput = false) {
        this.calendarPicker.setEndRange(this.convertToCalendarDate(this.toMillis));
        if (!fromInput)
            this.setTimeInputBox(new Date(this.toMillis), false);
    }

    private offsetUTC (date: Date) {
        var dateCopy = new Date(date.valueOf())
        dateCopy.setTime(dateCopy.getTime() - dateCopy.getTimezoneOffset()*60*1000);
        return dateCopy;
    }

    private offsetFromUTC (date: Date) {
        var dateCopy = new Date(date.valueOf())
        dateCopy.setTime(dateCopy.getTime() + dateCopy.getTimezoneOffset()*60*1000 );
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
            this.fromInput.node().value = this.createTimeString(utcDate);
        } else {
            this.toInput.node().value = this.createTimeString(utcDate);
        }
    }

    private createTimePicker () {
        var timeInputContainer = this.timeControls.append("div").attr("class", "tsi-timeInputContainer");
        var createTimePicker = (startOrEnd) => {
            var fromOrToContainer = timeInputContainer.append("div").classed("tsi-" + startOrEnd + "Container", true);
            let inputLabelID = Utils.guid();
            let inputID = inputLabelID + 'Input';
            let timeLabel = fromOrToContainer.append("label")
                .classed("tsi-timeLabel", true)
                .attr('id', inputLabelID)
                .attr('for', inputID)
                .attr('aria-label', `${startOrEnd === 'start' ? this.getString('Start time input') : this.getString('End time input')}`)
                .text(this.getString(startOrEnd));
            timeLabel.append("span")
                .classed("tsi-timeRequired", true)
                .text(this.getString('*'));
            let inputName = startOrEnd === 'start' ? 'fromInput' : 'toInput'
            this[inputName] = fromOrToContainer.append('input')
                .attr('class', 'tsi-dateTimeInput', true)
                .attr('aria-labelledby', inputLabelID)
                .attr('required', true)
                .attr('id', inputID)
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
                fromOrToContainer.append("button")
                    .attr("class", "tsi-snapToEndRangeButton")
                    .text(this.getString("Latest"))
                    .attr('aria-label', this.getString('snap end time to latest'))
                    .on("click", () => {
                        if (!this.isSettingStartTime) {
                            this.setFromDate(this.startRange);
                        }
                        this.setToMillis(this.maxMillis);
                        this.updateDisplayedFromDateTime();
                        this.updateDisplayedToDateTime();
                        this.isSettingStartTime = true;
                        this.calendarPicker.draw();
                    });
            }
        }
        createTimePicker("start");
        createTimePicker("end");
    }
}

export default DateTimePicker;