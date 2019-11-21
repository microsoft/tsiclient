import {Utils, DataTypes } from "./../Utils";
import {Component} from "./Component";
import {ChartComponentData} from './../Models/ChartComponentData'; 
import {ChartOptions} from './../Models/ChartOptions';
import { EllipsisMenu } from "../Components/EllipsisMenu/EllipsisMenu";

class ChartComponent extends Component {
	readonly MINWIDTH = 350;
	protected MINHEIGHT = 150;
	readonly CONTROLSWIDTH = 200;
    public data: any;
	public aggregateExpressionOptions: any;
	protected chartControlsPanel = null;
	protected ellipsisContainer = null;
	protected ellipsisMenu: EllipsisMenu = null;
	
	public chartComponentData: ChartComponentData;
	
	constructor(renderTarget: Element){
		super(renderTarget);
		this.chartComponentData = new ChartComponentData();
	}

	protected drawEllipsisMenu (additionalEllipsisItems = []) {
		if (this.chartOptions.canDownload || this.chartOptions.grid || (this.chartOptions.ellipsisItems && this.chartOptions.ellipsisItems.length > 0) || additionalEllipsisItems.length > 0) {
			if (this.ellipsisContainer === null) {
				this.ellipsisContainer = this.chartControlsPanel.append("div")
					.attr("class", "tsi-ellipsisContainerDiv");
			}
			if (this.ellipsisMenu === null) {
				this.ellipsisMenu = new EllipsisMenu(this.ellipsisContainer.node());
			}

			var ellipsisItems = [];
			if (this.chartOptions.grid) {
				ellipsisItems.push(Utils.createGridEllipsisOption(this.renderTarget, this.chartOptions, this.aggregateExpressionOptions, this.chartComponentData, this.getString("Display Grid")));
			}
			if (this.chartOptions.canDownload) {
				ellipsisItems.push(Utils.createDownloadEllipsisOption(() => this.chartComponentData.generateCSVString(this.chartOptions.offset, this.chartOptions.dateLocale), () => Utils.focusOnEllipsisButton(this.renderTarget) ,this.getString("Download as CSV")));
			}

			if (this.chartOptions.ellipsisItems) {
				ellipsisItems = ellipsisItems.concat(this.chartOptions.ellipsisItems);
			}

			this.ellipsisMenu.render(ellipsisItems.concat(additionalEllipsisItems), {theme: this.chartOptions.theme});
		}
	}

	public downloadAsCSV = (isScatterPlot = false) => {
		Utils.downloadCSV(this.chartComponentData.generateCSVString(this.chartOptions.offset, this.chartOptions.dateLocale, isScatterPlot ? this.chartOptions.spMeasures : null));
	}

	protected removeControlPanel () {
		if (this.chartControlsPanel) {
			this.chartControlsPanel.remove();
		}
		this.chartControlsPanel = null;
		this.ellipsisContainer = null;
		this.ellipsisMenu = null;
	}

	protected removeEllipsisMenu () {
		if (this.ellipsisContainer) {
			this.ellipsisContainer.remove();
		}
		this.ellipsisContainer = null;
		this.ellipsisMenu = null;
	}

	public getVisibilityState () {
        return this.chartComponentData.getVisibilityState();
	}
	
	protected ellipsisItemsExist () {
        return (this.chartOptions.canDownload || this.chartOptions.ellipsisItems.length > 0 || this.chartOptions.grid);
	}

	protected getDataType (aggKey) {
        return this.chartComponentData.displayState[aggKey] ? this.chartComponentData.displayState[aggKey].dataType : DataTypes.Numeric;
	} 
	
	protected getCDOFromAggKey (aggKey) {
        let matches = this.aggregateExpressionOptions.filter((cDO) => {
            return cDO.aggKey === aggKey;
        });
        if (matches.length === 1) {
            return matches[0];
        }
        return {};
	}
	
	protected getFilteredMeasures (measureList, visibleMeasure) {
        let justVisibleMeasure = [visibleMeasure];
        if (measureList.length !== 3) {
            return justVisibleMeasure;
        }
        let isAvgMinMax = true;
        measureList.forEach((measure) => {
            if (!(measure === 'avg' || measure === 'min' || measure === 'max')) {
                isAvgMinMax = false;
            }
        });
        return isAvgMinMax ? measureList.sort(m => m === 'min' ? -1 : (m === 'avg' ? 0 : 1)) : justVisibleMeasure; 
	}
	
	// to get alignment for data points between other types and linechart for tooltip formatting
	protected convertToTimeValueFormat (d: any) {
		let measuresObject = {};
		let measureType = d.measureType ? d.measureType : this.chartComponentData.displayState[d.aggKey].splitBys[d.splitBy].visibleType;
		measuresObject[measureType] = d.val;
		return {
			aggregateKey: d.aggKey,
			splitBy: d.splitBy,
			aggregateName: this.chartComponentData.displayState[d.aggKey].name,
			measures: measuresObject
		}
	}

	protected tooltipFormat (d, text) {
        let dataType = this.getDataType(d.aggregateKey);
        var title = d.aggregateName;   
        let cDO = this.getCDOFromAggKey(d.aggregateKey);

        let shiftMillis = this.chartComponentData.getTemporalShiftMillis(d.aggregateKey);

        let formatDate = (date) => {
            return Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
                this.chartOptions.offset, this.chartOptions.is24HourTime, shiftMillis, null, this.chartOptions.dateLocale)(date);
        }

        text.append("div")
            .attr("class", "tsi-tooltipTitle")
            .text(d.aggregateName);

        let subtitle = text.append("div")
            .attr("class", "tsi-tooltipSubtitle")

        if (d.splitBy && d.splitBy != ""){
            subtitle.append('h4')
                .text(d.splitBy)
                .attr('class', 'tsi-tooltipSeriesName');
        }

        if (dataType === DataTypes.Categorical) {
            subtitle.append('h4')
                .attr('class', 'tsi-tooltipTimeStamp')
                .text(formatDate(d.dateTime) + ' - ' + formatDate(d.endDate));
        }

        if (dataType === DataTypes.Events) {
            subtitle.append('h4')
                .attr('class', 'tsi-tooltipTimeStamp')
                .text(formatDate(d.dateTime));
        }

        let tooltipAttrs = cDO.tooltipAttributes;
        if (shiftMillis !== 0 && tooltipAttrs) {
            tooltipAttrs = [...tooltipAttrs, [this.getString("shifted"), this.chartComponentData.getTemporalShiftString(d.aggregateKey)]];
        }

        if (tooltipAttrs && tooltipAttrs.length > 0) {
            let attrsGroup = text.append('div')
                .attr('class', 'tsi-tooltipAttributeContainer tsi-tooltipFlexyBox');
            tooltipAttrs.forEach((attrTuple, i) => {
                let timeShiftRow = attrsGroup.append('div')
                    .attr('class', 'tsi-tooltipAttribute tsi-tooltipFlexyItem');
                timeShiftRow.append('div')
                    .attr('class', 'tsi-tooltipAttrTitle')
                    .text(attrTuple[0]);
                timeShiftRow.append('div')
                    .attr('class', 'tsi-tooltipAttrValue')
                    .text(attrTuple[1]);
            })
        }

        let formatValue = (dataType === DataTypes.Events ? (d) => d : Utils.formatYAxisNumber)

        if (d.measures && Object.keys(d.measures).length) {
            let formatValue = (dataType === DataTypes.Events ? (d) => d : Utils.formatYAxisNumber)
            
            if(dataType !== DataTypes.Numeric) {
                let valueGroup = text.append('table')
                    .attr('class', 'tsi-tooltipValues tsi-tooltipTable');
                Object.keys(d.measures).forEach((measureType, i) => {
                    let tr = valueGroup.append('tr')
                        .classed('tsi-visibleValue', (dataType === DataTypes.Numeric && (measureType === this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy))))
                        .style('border-left-color', Utils.getColorForValue(cDO, measureType));
                    tr.append('td')
                        .attr('class', 'tsi-valueLabel')
                        .text(measureType);
                    tr.append('td')
                        .attr('class', 'tsi-valueCell')
                        .text(formatValue(d.measures[measureType]))
                });    
            } else {
                let valueGroup = text.append('div')
                    .attr('class', 'tsi-tooltipFlexyBox');
                let filteredMeasures = this.getFilteredMeasures(Object.keys(d.measures), this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)); 
                filteredMeasures.forEach((measureType, i) => {
                    let valueItem = valueGroup.append('div')
                        .attr('class', 'tsi-tooltipFlexyItem')
                        .classed('tsi-visibleValue', (dataType === DataTypes.Numeric && (measureType === this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy))));
                    valueItem.append('div')
                        .attr('class', 'tsi-tooltipMeasureTitle')    
                        .text(measureType);
                    valueItem.append('div')
                        .attr('class', 'tsi-tooltipMeasureValue')
                        .text(formatValue(d.measures[measureType]))
                });   
            }
        }
    }

	
}
export {ChartComponent}
