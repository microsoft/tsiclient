import Utils from "../Utils";
import { DataTypes, TooltipMeasureFormat } from "./../Constants/Enums";
import { GRIDCONTAINERCLASS } from "./../Constants/Constants";
import {Component} from "./Component";
import {ChartComponentData} from './../Models/ChartComponentData'; 
import EllipsisMenu from "../Components/EllipsisMenu";
import * as d3 from 'd3';
import Split from 'split.js';
import Legend from "../Components/Legend";
import { ShiftTypes } from "../Constants/Enums";
import Grid from "../Components/Grid";

class ChartComponent extends Component {
	readonly MINWIDTH = 350;
	protected MINHEIGHT = 150;
	readonly CONTROLSWIDTH = 200;
	readonly GUTTERWIDTH = 6;
    public data: any;
	public aggregateExpressionOptions: any;
	protected chartControlsPanel = null;
	protected ellipsisContainer = null;
	protected ellipsisMenu: EllipsisMenu = null;
	protected legendObject: Legend;

	protected width: number;
	protected chartWidth: number;
	protected svgSelection = null;
	protected legendWidth: number = this.CONTROLSWIDTH;
	public draw;
	
	public chartComponentData: ChartComponentData;
	public chartMargins: any;
	
	constructor(renderTarget: Element){
		super(renderTarget);
		this.chartComponentData = new ChartComponentData();
	}

	public showGrid () {
		Grid.showGrid(this.renderTarget, this.chartOptions, this.aggregateExpressionOptions, this.chartComponentData);
	}

	public gatedShowGrid () {
		if (this.isGridVisible()) {
			this.showGrid();
		}
	}

	public hideGrid () {
		Grid.hideGrid(this.renderTarget);
	}

	public isGridVisible () {
		return !d3.select(this.renderTarget).selectAll(`.${GRIDCONTAINERCLASS}`).empty();
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
				ellipsisItems.push(Grid.createGridEllipsisOption(this.renderTarget, this.chartOptions, this.aggregateExpressionOptions, this.chartComponentData, this.getString("Display Grid")));
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

	protected getWidth () {
		return Math.max((<any>d3.select(this.renderTarget).node()).clientWidth, this.MINWIDTH);
	}

	public getVisibilityState () {
        return this.chartComponentData.getVisibilityState();
	}
	
	protected ellipsisItemsExist () {
        return (this.chartOptions.canDownload || this.chartOptions.ellipsisItems.length > 0 || this.chartOptions.grid);
	}

	protected getDataType (aggKey) {
		return this.chartComponentData.getDataType(aggKey);
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
	
	protected getFilteredMeasures (measureList, visibleMeasure, measureFormat: TooltipMeasureFormat, xyrMeasures = null) {
		let justVisibleMeasure = [visibleMeasure];
		switch (measureFormat) {
			case TooltipMeasureFormat.SingleValue: 
				return justVisibleMeasure;
			case TooltipMeasureFormat.Scatter:
				return xyrMeasures;
			default:
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

	protected formatDate (date, shiftMillis) {
		return Utils.timeFormat(this.chartComponentData.usesSeconds, this.chartComponentData.usesMillis, 
			this.chartOptions.offset, this.chartOptions.is24HourTime, shiftMillis, null, this.chartOptions.dateLocale)(date);
	}

	protected tooltipFormat (d, text, measureFormat: TooltipMeasureFormat, xyrMeasures = null) {
        let dataType = this.getDataType(d.aggregateKey);
        var title = d.aggregateName;   
		let cDO = this.getCDOFromAggKey(d.aggregateKey);

		let shiftMillis = this.chartComponentData.getTemporalShiftMillis(d.aggregateKey);
		let formatDate = (date) => this.formatDate(date, shiftMillis);

        let titleGroup = text.append("div")
			.attr("class", "tsi-tooltipTitleGroup");
		
		this.createTooltipSeriesInfo(d, titleGroup, cDO);

        if (dataType === DataTypes.Categorical) {
            titleGroup.append('h4')
                .attr('class', 'tsi-tooltipSubtitle tsi-tooltipTimeStamp')
                .text(formatDate(d.dateTime) + ' - ' + formatDate(d.endDate));
        }

        if (dataType === DataTypes.Events) {
        	titleGroup.append('h4')
                .attr('class', 'tsi-tooltipSubtitle tsi-tooltipTimeStamp')
                .text(formatDate(d.dateTime));
		}		

        let tooltipAttrs = cDO.tooltipAttributes;
        if (shiftMillis !== 0 && tooltipAttrs) {
			let shiftTuple = this.chartComponentData.getTemporalShiftStringTuple(d.aggregateKey);
			if (shiftTuple !== null) {
				let keyString = this.getString(shiftTuple[0]);
				let valueString = (keyString === ShiftTypes.startAt) ? this.formatDate(new Date(shiftTuple[1]), 0) : shiftTuple[1]; 
				tooltipAttrs = [...tooltipAttrs, [keyString, valueString]];
			}
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


        if (d.measures && Object.keys(d.measures).length) {
            let formatValue = (dataType === DataTypes.Events ? (d) => d : Utils.formatYAxisNumber)
            
            if(dataType !== DataTypes.Numeric) {
                let valueGroup = text.append('table')
                    .attr('class', 'tsi-tooltipValues tsi-tooltipTable');
                Object.keys(d.measures).forEach((measureType, i) => {
					if(!(dataType === DataTypes.Categorical) || d.measures[measureType] !== 0){
							valueGroup.append('tr').classed('tsi-tableSpacer', true);
							let tr = valueGroup.append('tr')
								.classed('tsi-visibleValue', (dataType === DataTypes.Numeric && (measureType === this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy))))
								.style('border-left-color', Utils.getColorForValue(cDO, measureType));
							tr.append('td')
								.attr('class', 'tsi-valueLabel')
								.text(measureType);
							tr.append('td')
								.attr('class', 'tsi-valueCell')
								.text(formatValue(d.measures[measureType]))
					}
                });    
            } else {
                let valueGroup = text.append('div')
					.attr('class', 'tsi-tooltipFlexyBox');
                let filteredMeasures = this.getFilteredMeasures(Object.keys(d.measures), this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy), measureFormat, xyrMeasures); 
				filteredMeasures.forEach((measureType, i) => {
                    let valueItem = valueGroup.append('div')
                        .attr('class', 'tsi-tooltipFlexyItem')
						.classed('tsi-visibleValue', 
							(dataType === DataTypes.Numeric && 
							(measureType === this.chartComponentData.getVisibleMeasure(d.aggregateKey, d.splitBy)) &&
							(measureFormat !== TooltipMeasureFormat.Scatter)));
                    let measureTitle = valueItem.append('div')
						.attr('class', 'tsi-tooltipMeasureTitle')
					Utils.appendFormattedElementsFromString(measureTitle, measureType);
                    valueItem.append('div')
                        .attr('class', 'tsi-tooltipMeasureValue')
                        .text(formatValue(d.measures[measureType]))
                });   
            }
        }
    }

	protected getSVGWidth () {
        return this.chartWidth + this.chartMargins.left + this.chartMargins.right;
	}
	
	protected getChartWidth (legendWidth = this.CONTROLSWIDTH) {
        legendWidth = this.legendWidth;// + this.GUTTERWIDTH;
        return Math.max(1, this.width - this.chartMargins.left - this.chartMargins.right - (this.chartOptions.legend === "shown" ? legendWidth : 0));
	}

	protected calcSVGWidth () {
        return this.svgSelection.node().getBoundingClientRect().width;
	}
	
	protected setControlsPanelWidth () {
		if (!this.chartOptions.hideChartControlPanel && this.chartControlsPanel !== null) {
			//either calculate expected or just use svg if it's in the DOM
			let controlPanelWidth = this.svgSelection && this.svgSelection.node() ?  
				this.calcSVGWidth() : 
				this.getWidth() - (this.chartOptions.legend === 'shown' ? (this.legendWidth + this.GUTTERWIDTH) : 0);
			this.chartControlsPanel.style("width", controlPanelWidth + "px");
		}
	}

	protected legendPostRenderProcess (legendState: string, chartElement: any, shouldSetControlsWidth: boolean, splitLegendOnDrag: any = undefined) {
		if (legendState === 'shown') {
			this.splitLegendAndSVG(chartElement.node(), splitLegendOnDrag);
			if (shouldSetControlsWidth) {
				this.setControlsPanelWidth();
			}	
		} else {
			d3.select(this.renderTarget).select('.tsi-resizeGutter').remove();
		}
	}

	protected splitLegendAndSVG (chartElement, onDrag = () => {}) {
        let svgWidth = this.getSVGWidth();
		let legendWidth = this.width - svgWidth;
		d3.select(this.renderTarget).select('.tsi-resizeGutter').remove();
		let legend = this.legendObject.legendElement;

		Split([this.legendObject.legendElement.node(), chartElement], {
            sizes: [legendWidth / this.width * 100, svgWidth / this.width * 100],
            gutterSize: 2,
            minSize: [200, 0],
            snapOffset: 0,
            cursor: 'e-resize',
            onDragEnd: (sizes) => {
				let legendWidth = this.width * (sizes[0] / 100);
                this.legendWidth = legendWidth;
                this.chartWidth = this.getChartWidth();
                this.draw(true);
                legend.style('width', this.legendWidth + 'px');
                d3.select(this.renderTarget).select('.tsi-resizeGutter')
                    .classed('tsi-isDragging', false);
            },
            onDragStart: () => {
                d3.select(this.renderTarget).select('.tsi-resizeGutter')
                    .classed('tsi-isDragging', true); 
            },
            onDrag: () => {
				if (!this.chartOptions.hideChartControlPanel && this.chartControlsPanel !== null) {
                    let svgLeftOffset = this.calcSVGWidth();
                    this.chartControlsPanel.style("width", Math.max(svgLeftOffset, this.chartMargins.left + 8) + "px"); //8px to account for the width of the icon
                }
				onDrag();
            },
            gutter: (index, direction) => {
                const gutter = document.createElement('div');
                gutter.className = `gutter tsi-resizeGutter`;
                return gutter;
			},
			direction: 'horizontal'
		});
		
		// explicitly set the width of the legend to a pixel value
		let calcedLegendWidth = legend.node().getBoundingClientRect().width;
		legend.style("width", calcedLegendWidth + "px");
	}	
}
export {ChartComponent}
