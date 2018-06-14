import * as d3 from 'd3';
import './EventsTable.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import { ChartComponent } from '../../Interfaces/ChartComponent';
import { EventsTableData } from '../../Models/EventsTableData';
import { TimeSeriesEvent } from '../../Models/TimeSeriesEvent';
import { TimeSeriesEventCell } from '../../Models/TimeSeriesEventCell';
import { ChartOptions } from '../../Models/ChartOptions';

class EventsTable extends ChartComponent{

    private eventsTable;
    private eventsLegend;
    private headers;

    private maxVisibleIndex = 100;
    private isAscending = false;
    private sortColumn = 'timestamp_DateTime';
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
        this.eventsTableData.setEvents(events, fromTsx);

        var componentContainer = d3.select(this.renderTarget)
            .classed("tsi-tableComponent", true);
        super.themify(componentContainer, this.chartOptions.theme);
        if (this.eventsTable == null) {
            this.eventsLegend = componentContainer.append("div")
                .classed("tsi-tableLegend", true);
            this.eventsLegend.append("ul");
            this.eventsTable = componentContainer.append("div")
                .classed("tsi-eventsTable", true);
            this.eventsTable.append("div").classed("tsi-columnHeaders", true);
            var table = this.eventsTable.append("div").classed("tsi-eventRowsContainer", true)
                .append("table").classed("tsi-eventRows", true);         
            table.append("tr"); 
        }
        this.renderLegend();
        this.buildTable();
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

        var columns = Object.keys(this.eventsTableData.columns)
            .filter((cIdx) => { return cIdx != "timestamp_DateTime"; }) // filter out timestamp
            .map((cIdx) => this.eventsTableData.columns[cIdx]);
        
        var filteredColumnKeys = this.getFilteredColumnKeys();
        this.setSelectAllState();
        // if (filteredColumnKeys.length == )
        if (columns.length > 2) { // tristate - all selected
            // var selectAllState = Objethis.eventsTableData.columns
            var selectAllColumns = this.eventsLegend.select("ul")
                .append("li").attr("class", "tsi-selectAllColumns");
            selectAllColumns.append("button").attr("class", "tsi-columnToggleButton")
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
                            if (columnKey != "timestamp_DateTime")
                                this.eventsTableData.columns[columnKey].visible = false;
                        }
                        
                    });
                    this.setLegendColumnStates();
                    this.buildTable();
                });
            selectAllColumns.append("span").attr("class", "tsi-columnToggleCheckbox");
            selectAllColumns.append("span").attr("class", "tsi-selectAllSomeState");
            selectAllColumns.append("span").attr("class", "tsi-columnToggleName")
                .html("Select All");
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
                .on("click", (d: any) => {
                    d.visible = !d.visible;
                    self.setLegendColumnStates();
                    self.buildTable();
                });
            d3.select(this).append("div").attr("class", "tsi-columnToggleCheckbox");
            d3.select(this).append("div").attr("class", "tsi-columnTypeIcon")
                .classed(d.type, true);
            d3.select(this).select("button").append("span").attr("class", "tsi-onlyLabel").html("only")
                .on("click", (d: any) => {
                    d3.event.stopPropagation();
                    columns.forEach((column: any) => {
                        if (column.key == d.key)
                            column.visible = true;
                        else 
                            column.visible = false;
                    });
                    self.setLegendColumnStates();
                    self.buildTable();
                })
            d3.select(this).append("div").attr("class", "tsi-columnToggleName").html((d: any) => d.name);
        });
        this.setLegendColumnStates();
        toggleableColumnLis.exit().remove();
    }
    public setLegendColumnStates () {
        if (this.eventsLegend.select("ul")) {
            this.eventsLegend.select("ul").selectAll(".tsi-columnToggle").each(function () {
                d3.select(this).select(".tsi-columnToggleCheckbox").style("background-position", 
                    (d: any) => (d.visible) ? "center 16px" : "center top");
            })
        }
        this.setSelectAllState();
    }

    public getSelectAllState() {
        var selectAllState: string = Object.keys(this.eventsTableData.columns).reduce((prev, curr: any) => {
            if (curr == "timestamp_DateTime") // skip timestamp, will always be visible
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
        this.eventsLegend.select("ul").select(".tsi-selectAllColumns").select(".tsi-columnToggleCheckbox")
            .style("background-position", () => (selectAllState == "all") ? "center 16px" : "center top");
        this.eventsLegend.select("ul").select(".tsi-selectAllColumns").select(".tsi-selectAllSomeState")
            .style("visibility", () => (selectAllState == "some") ? "visible" : "hidden");
    }

    private getFilteredColumnKeys() {
        return Object.keys(this.eventsTableData.columns).filter((columnKey: string) => {
            return this.eventsTableData.columns[columnKey].visible;
        });
    }

    //creates columnHeaders, returns a dictionary of widths so that buildTable can know the min width of each column
    private buildHeaders (filteredColumnKeys) {
        this.eventsTable.select(".tsi-columnHeaders").html("");
        var self = this;
        var columnHeaders = this.eventsTable.select(".tsi-columnHeaders").selectAll(".tsi-columnHeader")
            .data(filteredColumnKeys);
        var columnHeadersEntered = columnHeaders.enter()
            .append("div")
            .classed("tsi-columnHeader", true)
            .each( function(d: string) {
                d3.select(this).append("span")
                    .classed("tsi-columnHeaderName", true)
                    .html(self.eventsTableData.columns[d].name);
                d3.select(this).append("span").attr("class", "tsi-columnTypeIcon")
                    .classed(self.eventsTableData.columns[d].type, true);
                d3.select(this).append("span").attr("class", "tsi-sortDirection").html(() => {
                    if (self.sortColumn == d) {
                        if (self.isAscending)
                            return "▲";
                        return "▼";
                    }
                    return "";
                });
                var id = JSON.parse(JSON.stringify(d));
                d3.select(this).append("button").attr("class", "tsi-sortColumnButton")
                .on("click", function (f, i) {
                    //set sort column and direction
                    if (self.sortColumn == d) {
                        self.isAscending = !self.isAscending;
                    } else {
                        self.isAscending = false;
                    }
                    self.sortColumn = d;

                    self.eventsTableData.sortEvents(d, self.isAscending);
                    self.buildTable();
                    self.eventsTable.select('.tsi-columnHeaders').node().scrollLeft = 
                        self.eventsTable.select('.tsi-eventRowsContainer').node().scrollLeft;
                });
            });
        var widthDictionary = {};
        columnHeadersEntered.each(function (d) {
            widthDictionary[d] = d3.select(this).node().getBoundingClientRect().width;
        })
        columnHeaders.exit().remove();
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
                    return (widthDictionary[d] - 19) + "px"; //13 pixel difference in element due to padding/border
                else {
                    return d3.select(this).style("width");
                }
            })
    }

    private buildTable() {
        var filteredColumnKeys = this.getFilteredColumnKeys();
        var widthDictionary = this.buildHeaders(filteredColumnKeys);
        this.eventsTable.select("table").html("");
        var self = this;
        // this.eventsTableData.sortEvents("Id_String", true);
        var rowsData = this.eventsTableData.events.slice(0, this.maxVisibleIndex);
        var firstRow = this.eventsTable.select("table").append("tr");
        var firstRowCells = firstRow.selectAll("td").data(filteredColumnKeys);
        firstRowCells.enter()
            .append("td")
            .html(d => this.eventsTableData.columns[d].name);
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
                    .style("min-width", (d: TimeSeriesEventCell) => {
                        if (widthDictionary[d.key] != null)
                            return widthDictionary[d.key] + "px";
                        else
                            return "none";
                    })
                    .html((d: TimeSeriesEventCell) => {
                        return d.value;
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
}

export {EventsTable}
