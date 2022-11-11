import * as d3 from 'd3';
import './EventsTable.scss';
import Utils from "../../Utils";
import { ChartComponent } from '../../Interfaces/ChartComponent';
import { EventsTableData } from '../../Models/EventsTableData';
import { TimeSeriesEvent } from '../../Models/TimeSeriesEvent';
import { TimeSeriesEventCell } from '../../Models/TimeSeriesEventCell';

class EventsTable extends ChartComponent{

    private eventsTable;
    private eventsLegend;
    private headers;

    private maxVisibleIndex = 100;
    private isAscending = true;
    private timestampColumnName = 'timestamp ($ts)';
    private sortColumn = 'timestamp ($ts)';
    private allSelectedState = "all" // all | some | none

    private eventsTableData = new EventsTableData();

    private margins = {
        left: 10,
        right: 10
    }
	
	constructor(renderTarget: Element){
		super(renderTarget);
	}

	EventsTable() {
    }
    
    public renderFromEventsTsx(eventsFromTsx: any, chartOptions: any) {
        this.render(eventsFromTsx, chartOptions, true);
    }
	
    public render(events: any, chartOptions: any, fromTsx: boolean = false) {
        this.chartOptions.setOptions(chartOptions);
        this.maxVisibleIndex = 100;
        this.eventsTableData.setEvents(events, fromTsx, this.chartOptions.timeSeriesIdProperties, chartOptions.offset);

        var componentContainer = d3.select(this.renderTarget)
            .classed("tsi-tableComponent", true);
        super.themify(componentContainer, this.chartOptions.theme);
        var tableLeftPanel;
        if (this.eventsTable == null) {
            tableLeftPanel = componentContainer.append("div")
                .classed("tsi-tableLeftPanel", true);
            this.eventsLegend = tableLeftPanel.append("div")            
                .classed("tsi-tableLegend", true);
            this.eventsLegend.append("ul");
            this.eventsTable = componentContainer.append("div")
                .classed("tsi-eventsTable", true);
            this.eventsTable.append("div").classed("tsi-columnHeaders", true);
            var table = this.eventsTable.append("div").classed("tsi-eventRowsContainer", true)
                .append("table").classed("tsi-eventRows", true);         
            table.append("tr"); 
        } else {
            tableLeftPanel = componentContainer.select("tsi-tableLeftPanel");
        }
        this.renderLegend();
        this.buildTable();

        tableLeftPanel.selectAll(".tsi-eventsDownload").remove();
        var downloadButton = tableLeftPanel.append("button")
            .attr("class", "tsi-eventsDownload tsi-primaryButton")
            .attr("aria-label", this.getString("Download as CSV"))
            .on("click", function() {
                this.classList.add('tsi-downloading');
                setTimeout(() => {
                    Utils.downloadCSV(self.eventsTableData.generateCSVString(true, 0), "Events")
                    this.classList.remove('tsi-downloading');
                }, 100);
            });
        downloadButton.append("div").attr("class", "tsi-downloadEventsIcon");
        downloadButton.append("div").attr("class", "tsi-downloadEventsText").text(this.getString("Download as CSV"));


         //listen for table scroll and adjust the headers accordingly
        var self = this;

        this.eventsTable.select('.tsi-eventRowsContainer').node().scrollLeft = 0;
        this.eventsTable.select('.tsi-eventRowsContainer').node().scrollTop = 0;

        this.eventsTable.select('.tsi-eventRowsContainer').node().addEventListener('scroll', function(evt) {
            self.eventsTable.select('.tsi-columnHeaders').node().scrollLeft = this.scrollLeft;
            //check to see if need to infiniteScroll
            if ((this.scrollTop + this.clientHeight) > (this.scrollHeight - 100)) {
                let oldVisibleIndex = self.maxVisibleIndex
                self.maxVisibleIndex += (Math.min(100, self.eventsTableData.events.length - self.maxVisibleIndex));
                if (self.maxVisibleIndex != oldVisibleIndex)
                    self.buildTable();
            }
        }, false);
    }

    public renderLegend() {
        this.eventsLegend.html("");
        this.eventsLegend.append("ul");

        var columns = this.eventsTableData.sortColumnKeys()
            .map((cIdx) => this.eventsTableData.columns[cIdx]);
        
        this.setSelectAllState();
        if (columns.length > 2) { // tristate - all selected
            var selectAllColumns = this.eventsLegend.select("ul")
                .append("li").attr("class", "tsi-selectAllColumns");
            selectAllColumns.append("button").attr("class", "tsi-columnToggleButton")
                .attr("aria-label", () => {
                    var selectAllState = this.getSelectAllState();
                    return selectAllState !== "all" ? this.getString("Toggle all columns") : this.getString("Toggle all columns");
                })
                .on("click", () => {
                    var setAllVisible: boolean = false;
                    var selectAllState = this.getSelectAllState();
                    if (selectAllState != "all") {
                        setAllVisible = true;
                    }
                    Object.keys(this.eventsTableData.columns).forEach((columnKey) => {
                        if (setAllVisible) {
                            this.eventsTableData.columns[columnKey].visible = true;
                        } else {
                            if (columnKey != this.timestampColumnName)
                                this.eventsTableData.columns[columnKey].visible = false;
                        }
                        
                    });
                    this.setLegendColumnStates();
                    this.buildTable();
                });
            selectAllColumns.append("span").attr("class", "tsi-columnToggleCheckbox");
            selectAllColumns.append("span").attr("class", "tsi-selectAllSomeState");
            selectAllColumns.append("span").attr("class", "tsi-columnToggleName")
                .text(this.getString("All Columns"));
        }
        var toggleableColumnLis = this.eventsLegend.select("ul").selectAll(".tsi-columnToggle")
            .data(columns);
        
        var toggleableColumnLisEntered = toggleableColumnLis.enter()
            .append("li")
            .classed("tsi-columnToggle", true)
            .merge(toggleableColumnLis)
        var self = this;
        toggleableColumnLisEntered.each(function (d) {
            d3.select(this).append("button").attr("class", "tsi-columnToggleButton")
                .attr("aria-label", (d: any) => "toggle column " + d.key)
                .on("click", (event, d: any) => {
                    d.visible = !d.visible;
                    self.setLegendColumnStates();
                    self.buildTable();
                });
            d3.select(this).append("div").attr("class", "tsi-columnToggleCheckbox");
            if (d.isTsid) {
                let typeIconCOntainer = d3.select(this).append("div").attr("class", "tsi-columnTypeIcons");
                typeIconCOntainer.append("span").attr("class", "tsi-columnTypeIcon")
                    .classed("tsid", true).attr("title", self.getString("Time Series ID"));
                typeIconCOntainer.append("span").attr("class", "tsi-columnTypeIcon")
                    .classed(d.type, true);
            } else {
                d3.select(this).append("div").attr("class", "tsi-columnTypeIcon")
                    .classed(d.type, true);
            }
            d3.select(this).select("button").append("div").attr("class", "tsi-onlyLabel").text(self.getString("only"))
                .attr('tabindex', "0")
                .attr('role', 'button')
                .on("click", (event, d: any) => {
                    event.stopPropagation();
                    columns.forEach((column: any) => {
                        if (column.key == d.key)
                            column.visible = true;
                        else 
                            column.visible = false;
                    });
                    self.setLegendColumnStates();
                    self.buildTable();
                })
            d3.select(this).append("div").attr("class", "tsi-columnToggleName").classed('tsidPropertyName', (d: any) => d.isTsid).text((d : any) => columns.filter(c => c.name === d.name).length > 1 ? `${d.name} (${d.type})` : d.name);
        });
        this.setLegendColumnStates();
        toggleableColumnLis.exit().remove();
    }
    public setLegendColumnStates () {
        if (this.eventsLegend.select("ul")) {
            this.eventsLegend.select("ul").selectAll(".tsi-columnToggle").each(function () {
                d3.select(this).select(".tsi-columnToggleCheckbox").classed("tsi-notSelected", 
                    (d: any) => !(d.visible));
            })
        }
        this.setSelectAllState();
    }

    public getSelectAllState() {
        var selectAllState: string = Object.keys(this.eventsTableData.columns).reduce((prev, curr: any) => {
            if (curr == this.timestampColumnName) // skip timestamp, will always be visible
                return prev;
            if (prev == null) 
                return (this.eventsTableData.columns[curr].visible) ? "all" : "none";
            if (prev == "some") 
                return "some";
            return (prev == (this.eventsTableData.columns[curr].visible ? "all" : "none")) ? prev : "some"
        }, null);
        
        if (selectAllState == null)
            selectAllState = "none";

        return selectAllState;
    }

    public setSelectAllState() {
        var selectAllState: string = this.getSelectAllState();
        let selectAllColumns = this.eventsLegend.select("ul").select(".tsi-selectAllColumns");
        selectAllColumns.select(".tsi-columnToggleCheckbox")
            .classed("tsi-notSelected", () => selectAllState !== "all");
        selectAllColumns.select(".tsi-columnToggleButton")
            .attr("aria-label", (selectAllState !== "all" ? this.getString("Toggle all columns on") : this.getString("Toggle all columns off")));
        this.eventsLegend.select("ul").select(".tsi-selectAllColumns").select(".tsi-selectAllSomeState")
            .style("visibility", () => (selectAllState == "some") ? "visible" : "hidden");
    }

    private getFilteredColumnKeys() {
        return this.eventsTableData.sortColumnKeys().filter((columnKey: string) => {
            return this.eventsTableData.columns[columnKey].visible;
        });
    }

    //creates columnHeaders, returns a dictionary of widths so that buildTable can know the min width of each column
    private buildHeaders (filteredColumnKeys, focusedHeader = null) {
        let longAndDoubleExist = (propertyKey) => {
            let propertyName = this.eventsTableData.columns[propertyKey].name;
            return this.eventsTableData.columns.hasOwnProperty(propertyName + "_Long") && this.eventsTableData.columns.hasOwnProperty(propertyName + "_Double")
        }

        this.eventsTable.select(".tsi-columnHeaders").html("");
        var self = this;
        var columnHeaders = this.eventsTable.select(".tsi-columnHeaders").selectAll(".tsi-columnHeader")
            .data(filteredColumnKeys);
        var isOffsetDateTimeColumn = (d: string) => d.includes('timestamp') && (d.includes('') || d.includes('-')) && !d.includes('$ts') ? true : null
        var columnHeadersEntered = columnHeaders.enter()
            .append("div")
            .classed("tsi-columnHeader", true)
            .classed("tsi-columnHeaderDisabled", isOffsetDateTimeColumn)
            .each( function(d: string) {
                d3.select(this).append("span")
                    .classed("tsi-columnHeaderName", true)
                    .classed("moreMarginRight", (d: any) => self.eventsTableData.columns[d].isTsid)
                    .text(longAndDoubleExist(d) ? `${self.eventsTableData.columns[d].name} (${self.eventsTableData.columns[d].type})` : self.eventsTableData.columns[d].name);
                d3.select(this).append("span").attr("class", "tsi-columnSortIcon").classed("moreRight", self.eventsTableData.columns[d].isTsid)
                    .classed("up", (self.sortColumn == d && self.isAscending))
                    .classed("down", (self.sortColumn == d && !self.isAscending));
                if (self.eventsTableData.columns[d].isTsid) {
                    let typeIconContainer = d3.select(this).append("div").attr("class", "tsi-columnTypeIcons");
                    typeIconContainer.append("span").attr("class", "tsi-columnTypeIcon")
                        .classed("tsid", true).attr("title", self.getString("Time Series ID"));
                    typeIconContainer.append("span").attr("class", "tsi-columnTypeIcon")
                        .classed(self.eventsTableData.columns[d].type, true);
                } else {
                    d3.select(this).append("span").attr("class", "tsi-columnTypeIcon")
                        .classed(self.eventsTableData.columns[d].type, true);
                }
                var id = JSON.parse(JSON.stringify(d));
                d3.select(this).append("button").attr("class", "tsi-sortColumnButton")
                    .attr("aria-label", title => "Sort by column " + title)
                    .on("click", function (event, f) {
                        //set sort column and direction
                        if (self.sortColumn == d) {
                            self.isAscending = !self.isAscending;
                        } else {
                            self.isAscending = false;
                        }
                        self.sortColumn = d;

                        self.eventsTableData.sortEvents(d, self.isAscending);
                        self.buildTable(f);
                        self.eventsTable.select('.tsi-columnHeaders').node().scrollLeft = 
                            self.eventsTable.select('.tsi-eventRowsContainer').node().scrollLeft;
                        
                    })
                    .attr("disabled", isOffsetDateTimeColumn);
            });
        var widthDictionary = {};
        columnHeadersEntered.each(function (d) {
            widthDictionary[d] = d3.select(this).node().getBoundingClientRect().width;
        })
        columnHeaders.exit().remove();

        if (focusedHeader !== null) {
            let columnHeader = d3.select(columnHeadersEntered.filter((d) => {
                return d === focusedHeader;
            }).nodes()[0]);

            if (columnHeader) {
                (<any>columnHeader.select("button").node()).focus();
            }
        }

        return widthDictionary;
    }

    private adjustHeaderWidth(widthDictionary) {
        //set the width to fit inside the container less the scroll bar
        var tableSelection = this.eventsTable.select('.tsi-eventRowsContainer').node();
        var scrollBarWidthDiff = tableSelection.getBoundingClientRect().width - tableSelection.clientWidth;
        this.eventsTable.select(".tsi-columnHeaders").style("width", "calc(100% - " + scrollBarWidthDiff + "px)");

        this.eventsTable.select(".tsi-columnHeaders").selectAll(".tsi-columnHeader")
            .style("width", function(d) {
                if (widthDictionary[d])
                    return (widthDictionary[d] - 17) + "px"; //17 pixel difference in element due to padding/border
                else {
                    return d3.select(this).style("width");
                }
            })
    }

    private buildTable (currentSortedCol = null) {
        var filteredColumnKeys = this.getFilteredColumnKeys();
        var widthDictionary = this.buildHeaders(filteredColumnKeys, currentSortedCol);
        this.eventsTable.select("table").html("");
        var self = this;
        var rowsData = this.eventsTableData.events.slice(0, this.maxVisibleIndex);
        var firstRow = this.eventsTable.select("table").append("tr")
            .classed("tsi-eventRow", true);
        var firstRowCells = firstRow.selectAll("td").data(filteredColumnKeys);
        firstRowCells.enter()
            .append("td")
            .classed("tsi-eventCell", true)
            .text(d => this.eventsTableData.columns[d].name);
        var rows = this.eventsTable.select("table").selectAll("tsi-eventRow").data(rowsData);
        var rowsEntered = rows.enter()
            .append("tr")
            .classed("tsi-eventRow", true)
            .merge(rows)
            .each(function (event: TimeSeriesEvent) {
                var visibleCells = filteredColumnKeys.map((columnKey: string) => {
                    if (event.cells[columnKey])
                        return event.cells[columnKey]
                    return { key: columnKey, value: null };
                });
                var valueCells = d3.select(this).selectAll("td").data(visibleCells);
                var valueCellsEntered = valueCells.enter()
                    .append("td")
                    .classed("tsi-eventCell", true)
                    .style("min-width", (d: TimeSeriesEventCell) => {
                        if (widthDictionary[d.key] != null)
                            return Math.ceil(widthDictionary[d.key]) + "px";
                        else
                            return "none";
                    })
                    .text((d: TimeSeriesEventCell) => {
                        return self.formatValue(d.value, d.type);
                    });
                valueCells.exit().remove();
            });
        if (rowsEntered.size() > 0) {
            var firstRow = rowsEntered.filter(function (d, i) { return i === 0;})
            firstRow.selectAll("td").each(function(d) {
                var cellWidth = d3.select(this).node().getBoundingClientRect().width;
                widthDictionary[d.key] = (cellWidth > widthDictionary[d.key]) ? cellWidth : widthDictionary[d.key];
            });
        }
        rows.exit().remove();
        this.adjustHeaderWidth(widthDictionary);
    }

    private formatValue (value, type) {
        if (type === 'Dynamic') {
            return JSON.stringify(value);
        }
        if (type !== 'DateTime' || value === null || value === undefined) {
            return value;
        }
        if (typeof(value) === 'function') {
            return value();
        }
        let timeFormatFunction = Utils.timeFormat(true, true, 0, this.chartOptions.is24HourTime, null, null, this.chartOptions.dateLocale);
        let dateValue = new Date(value.split("Z").join(""));
        return timeFormatFunction(Utils.offsetUTC(dateValue));
    }
}

export default EventsTable
