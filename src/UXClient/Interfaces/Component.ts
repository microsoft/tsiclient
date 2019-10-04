import {Utils} from "./../Utils";
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
		targetElement.classed(this.currentTheme, false);
		targetElement.classed('tsi-light', false);
		targetElement.classed('tsi-dark', false);
		targetElement.classed(theme, true);
		this.currentTheme = theme;
	}
	
}
export {Component}
