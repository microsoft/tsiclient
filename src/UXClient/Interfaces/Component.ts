import Utils from "../Utils";
import { TooltipMeasureFormat } from "./../Constants/Enums";
import { ChartOptions } from "../Models/ChartOptions";

class Component {
	public renderTarget;
	protected currentTheme: string;
	readonly TRANSDURATION = (window.navigator.userAgent.indexOf("Edge") > -1) ? 0 : 400;

	public usesSeconds: boolean = false;
	public usesMillis: boolean = false;

	protected chartOptions: ChartOptions = new ChartOptions();

	protected getString (str: string) {
        return this.chartOptions.stringsInstance.getString(str);
    }
	
	constructor(renderTarget: Element){
		this.renderTarget = renderTarget;
	}
	
	protected themify(targetElement: any, theme: string){
		var theme = Utils.getTheme(theme);
		targetElement?.classed(this.currentTheme, false);
		targetElement?.classed('tsi-light', false);
		targetElement?.classed('tsi-dark', false);
		targetElement?.classed(theme, true);
		this.currentTheme = theme;
	}

	protected teardropD = (width, height) => {
        return `M${width / 2} ${height / 14} 
                Q${width / 1.818} ${height / 6.17} ${width / 1.2} ${height / 2.33}
                A${width / 2.35} ${width / 2.35} 0 1 1 ${width / 6} ${width / 2.33}
                Q${width / 2.22} ${height / 6.18} ${width / 2} ${height / 14}z`;
	}
	
	protected tooltipFormat (d, text, measureFormat: TooltipMeasureFormat, xyrMeasures = null) {
		
	}

	protected createTooltipSeriesInfo (d, group, cDO) {
		let title = group.append('h2').attr('class', 'tsi-tooltipGroupName tsi-tooltipTitle');
		Utils.appendFormattedElementsFromString(title, d.aggregateName);

		if (d.splitBy && d.splitBy != ""){
			let splitBy = group.append('p')
				.attr('class', 'tsi-tooltipSeriesName tsi-tooltipSubtitle');
			Utils.appendFormattedElementsFromString(splitBy, d.splitBy);
		}
		
		if (cDO.variableAlias && cDO.isVariableAliasShownOnTooltip){
			group.append('p')
				.text(cDO.variableAlias)
				.attr('class', 'tsi-tooltipVariableAlias tsi-tooltipSubtitle');
		}
	}
	
}
export {Component}
