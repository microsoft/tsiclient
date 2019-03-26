import {Utils} from "./../Utils";

class Component {
	public renderTarget;
	protected currentTheme: string;

	public usesSeconds: boolean = false;
	public usesMillis: boolean = false;
	
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
