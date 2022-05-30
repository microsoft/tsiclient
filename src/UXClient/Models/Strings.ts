class Strings {

    private stringValueDefaults = {
        "Last 30 mins": "Last 30 mins",
        "Last Hour": "Last Hour",
        "Last 2 Hours": "Last 2 Hours",
        "Last 4 Hours": "Last 4 Hours",
        "Last 12 Hours": "Last 12 Hours",
        "Last 24 Hours": "Last 24 Hours",
        "Last 7 Days": "Last 7 Days",
        "Last 30 Days": "Last 30 Days",
        "Custom": "Custom",
        "Timeframe": "Timeframe",
        "Save": "Save",
        "timezone": "timezone",
        "start": "start",
        "end": "end",
        "Latest": "Latest",
        "Show ellipsis menu": "Show ellipsis menu",
        "Hide ellipsis menu": "Hide ellipsis menu",
        "Download as CSV": "Download as CSV",
        "Toggle all columns": "Toggle all columns",
        "All Columns": "All Columns",
        "only": "only",
        "Invalid Date": "Invalid Date",
        "Stack/Unstack Bars": "Stack/Unstack Bars",
        "Stack bars": "Stack bars",
        "Unstack bars": "Unstack bars",
        "No filter results": "No filter results",
        "All hierarchies": "All hierarchies",
        "Selected": "Selected",
        "toggle visibility for": "toggle visibility for",
        "Series type selection for": "Series type selection for",
        "shifted": "shifted",
        "Click to drop marker": "Click to drop marker",
        "drag to reposition": "drag to reposition",
        "Delete marker at": "Delete marker at",
        "set axis state to": "set axis state to",
        "Drop a Marker": "Drop a Marker",
        "Search Time Series Instances": "Search Time Series Instances",
        "No results": "No results",
        "No instances": "No instances found",
        "No search result": "No instances found for entered search term.",
        "Instance not found": "Instance not found under selected hierarchy.",
        "Show more": "Show more",
        "No description": "No description",
        "Time Series ID": "Time Series ID",
        "Currently displayed time is": "Currently displayed time is",
        "Left arrow to go back in time": "Left arrow to go back in time",
        "right arrow to go forward": "right arrow to go forward",
        "Local": "Local",
        "Display Grid": "Display Grid",
        "Previous Month": "Previous Month",
        "Next Month": "Next Month",
        "Unassigned Time Series Instances": "Unassigned Time Series Instances",
        "Search globally": "Search globally",
        "Lookup globally": "Lookup globally",
        "Show More Instances": "Show more instances",
        "Show More Hierarchies": "Show more hierarchies",
        "Add to Filter Path": "Add to Filter Path",
        "Empty": "Empty",
        "Date/Time": "Date/Time",
        "show series": "show series",
        "hide series": "hide series",
        "in group": "in group",
        "show group": "show group",
        "hide group": "hide group",
        "Use the arrow keys to navigate the values of each cell": "Use the arrow keys to navigate the values of each cell",
        "A grid of values": "A grid of values",
        "close grid": "close grid",
        "column header for date": "column header for date",
        "row header for": "row header for",
        "values for cell at": "values for cell at",
        "no values at": "no values at",
        "and": "and",
        "are": "are",
        "timezone selection": "timezone selection",
        "Start time input": "Start time input",
        "End time input": "End time input",
        "*": "*",
        "snap end time to latest": "snap end time to latest",
        "zoom in": "zoom in",
        "zoom out": "zoom out",
        "A line chart zoom in": "A line chart zoom in",
        "A line chart zoom out": "A line chart zoom out",
        "select quick time of": "select quick time of",
        "a time selection control dialog": "a time selection control dialog.",
        "a button to launch a time selection dialog current selected time is ": "a button to launch a time selection dialog. current selected time is ",
        "No color": "No color",
        "Change y-axis type": "Change y-axis type",
        "Show/Hide values": "Show/Hide values",
        "Line chart": "Line chart",
        "Bar chart": "Bar chart",
        "Heatmap": "Heatmap",
        "Pie chart": "Pie chart",
        "Scatter plot": "Scatter plot",
        "Select color": "Select color",
        "Search suggestion instruction": "When autocomplete results are available use up and down arrows to review and enter to select",
        "Search suggestions available": " results available, keyboard users, use up and down arrows to review and enter to select.",
        "Hierarchy list": "Hierarchy list",
        "event in series": "Event in series",
        "at time": "at time",
        "measure with key": "measure with key",
        "and value": "and value",
        "Looking for": "Looking for",
        "Hierarchy error": "Error occured! Refreshing hierarchy...",
        "Failed to get token": "Failed to get token",
        "Error in hierarchy navigation": "Error in hierarchy navigation",
        "Failed to load types for navigation": "Failed to load types for navigation",
        "Failed to load hierarchies for navigation": "Failed to load hierarchies for navigation",
        "Failed to complete search": "Failed to complete search",
        "Failed to get instance details": "Failed to get instance details",
        "Add": "Add",
        "Search": "Search",
        "Marker": "Marker",
        "Start at": "Start at",
        "Dismiss": "Dismiss"
    };
  
    private stringValues: any = {};

	constructor(){
        this.stringValues = this.stringValueDefaults;
    }

    public mergeStrings (stringKeyValues: any) {
        Object.keys(this.stringValues).forEach((stringKey: string) => {
            if (stringKey in stringKeyValues) {
                this.stringValues[stringKey] = stringKeyValues[stringKey];
            }
        });
    }

    public getString (stringKey: string) {
        if (stringKey in this.stringValues) {
            return this.stringValues[stringKey];
        }
        return stringKey;
    }

    public toObject () {
        return this.stringValues;
    }

}

export {Strings}



