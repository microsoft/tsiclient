import * as d3 from 'd3';
import './TimezonePicker.scss';
import { ChartComponent } from '../../Interfaces/ChartComponent';
import Utils from "../../Utils";
import moment from 'moment-timezone';

class TimezonePicker extends ChartComponent{
    private targetElement: any;
    private timeZones: Array<string> = ["Local", "UTC", "Africa/Algiers", "Africa/Cairo", "Africa/Casablanca", "Africa/Harare", "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi", "Africa/Windhoek", "America/Anchorage", "America/Bogota", "America/Buenos Aires", "America/Caracas", "America/Chicago", "America/Chihuahua", "America/Denver", "America/Edmonton", "America/Godthab", "America/Guatemala", "America/Halifax", "America/Indiana/Indianapolis", "America/Los Angeles", "America/Manaus", "America/Mexico City", "America/Montevideo", "America/New York", "America/Phoenix", "America/Santiago", "America/Sao Paulo", "America/St Johns", "America/Tijuana", "America/Toronto", "America/Vancouver", "America/Winnipeg", "Asia/Amman", "Asia/Beirut", "Asia/Baghdad", "Asia/Baku", "Asia/Bangkok", "Asia/Calcutta", "Asia/Colombo", "Asia/Dhaka", "Asia/Dubai", "Asia/Ho Chi Minh", "Asia/Hong Kong", "Asia/Irkutsk", "Asia/Istanbul", "Asia/Jakarta", "Asia/Jerusalem", "Asia/Kabul", "Asia/Karachi", "Asia/Kathmandu", "Asia/Krasnoyarsk", "Asia/Kuala Lumpur", "Asia/Kuwait", "Asia/Magadan", "Asia/Muscat", "Asia/Novosibirsk", "Asia/Qatar", "Asia/Rangoon", "Asia/Seoul", "Asia/Shanghai", "Asia/Singapore", "Asia/Taipei", "Asia/Tbilisi", "Asia/Tehran", "Asia/Tokyo", "Asia/Vladivostok", "Asia/Yakutsk", "Asia/Yekaterinburg", "Asia/Yerevan", "Atlantic/Azores", "Atlantic/Cape Verde", "Atlantic/South Georgia", "Australia/Adelaide", "Australia/Brisbane", "Australia/Canberra", "Australia/Darwin", "Australia/Hobart", "Australia/Melbourne", "Australia/Perth", "Australia/Queensland", "Australia/Sydney", "Europe/Amsterdam", "Europe/Andorra", "Europe/Athens", "Europe/Belfast", "Europe/Belgrade", "Europe/Berlin", "Europe/Brussels", "Europe/Budapest", "Europe/Dublin", "Europe/Helsinki", "Europe/Kiev", "Europe/Lisbon", "Europe/London", "Europe/Luxembourg", "Europe/Madrid", "Europe/Minsk", "Europe/Monaco", "Europe/Moscow", "Europe/Oslo", "Europe/Paris", "Europe/Rome", "Europe/Stockholm", "Europe/Vienna", "Europe/Warsaw", "Europe/Zurich", "Pacific/Auckland", "Pacific/Fiji", "Pacific/Guam", "Pacific/Honolulu", "Pacific/Midway", "Pacific/Tongatapu"];
    constructor(renderTarget: Element){
        super(renderTarget);
    }

    private sortTimezones () {
        let filteredTimezones  = this.timeZones.filter ((tz) => {
            return !(tz.toLowerCase() == 'local' || tz == 'UTC');
        }) 

        filteredTimezones.sort((a, b) => {
            let aOffset = moment.tz(new Date(), a.split(' ').join('_')).utcOffset();
            let bOffset =  moment.tz(new Date(), b.split(' ').join('_')).utcOffset();
            if (aOffset < bOffset) {
                return -1;
            }
            if (aOffset > bOffset) {
                return 1;
            }
            return 0;
        }); 
        this.timeZones = ['Local', 'UTC'].concat(filteredTimezones);
    }

    public render (onTimezoneSelect, defaultTimeZone: string = null) {
        this.targetElement = d3.select(this.renderTarget)
            .classed("tsi-timezonePicker", true)

        let d = new Date();
        var timezoneSelection = this.targetElement.append("select")
            .attr("class", "tsi-timezonePicker tsi-select");
        
        this.sortTimezones();

        var options = timezoneSelection.selectAll("option")
            .data(this.timeZones)
            .enter()
            .append("option")
            .attr('value', d => d)
            .text((tz) => Utils.convertTimezoneToLabel(tz, this.getString('Local')));
        timezoneSelection.on("change", function (d) {
            var timezone = (<any>d3.select(this).node()).value.replace(/\s/g, "_");
            onTimezoneSelect(timezone);
        });

        defaultTimeZone = defaultTimeZone.replace(/_/g, " ");
        if (defaultTimeZone != null) {
            options.filter((d) => d == defaultTimeZone).attr("selected", true);    
        }
        return;
    }

}

export default TimezonePicker;