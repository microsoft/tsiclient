import * as d3 from 'd3';
import './EllipsisMenu.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";

class EllipsisMenu extends Component {

    private containerElement: any;
    private buttonElement: any;
    private menuElement: any;
    private menuItems: Array<any>;
    private menuIsVisible: boolean;

	constructor(renderTarget: Element) {
        super(renderTarget);
    }

    private createIconPath (iconName: string, theme: string): string {
        var supportedNames: Array<string> = ["flag", "grid", "download"];
        return (supportedNames.indexOf(iconName) != -1) ? iconName + "Icon" : "";
    }

    public setMenuVisibility(isVisible) {
        this.menuIsVisible = isVisible;
        this.containerElement.classed("tsi-ellipsisMenuShown", this.menuIsVisible);
    }

    public render (menuItems, options: any = {}) {
        this.menuIsVisible = false;

        this.containerElement = d3.select(this.renderTarget).classed("tsi-ellipsisMenuContainer", true);
        this.setMenuItems(menuItems);
        d3.select(this.renderTarget).selectAll("*").remove();
        options.theme = options.theme ? options.theme : "dark";
        super.themify(this.containerElement, options.theme);

        this.buttonElement = d3.select(this.renderTarget).insert("div")
            .attr("class", "tsi-ellipsisButton")
            .on("click", () => {
                this.setMenuVisibility(!this.menuIsVisible)
            })
        
        this.menuElement = d3.select(this.renderTarget).insert("div")
            .attr("class", "tsi-ellipsisMenu");

        var self = this;
        this.menuElement.selectAll(".tsi-ellipsisMenuItem").data(this.menuItems)
            .enter()
            .append("div")
            .classed("tsi-ellipsisMenuItem", true)
            .on("click", (d: any) => {
                d.action();
            })
            .each(function () {
                d3.select(this)
                    .append("div")
                    .attr("class", (d: any) => "tsi-ellipsisMenuIcon " + self.createIconPath(d.iconClass, options.theme));

                d3.select(this)
                    .append("div")
                    .classed("tsi-ellipsisMenuLabel", true)
                    .html((d: any) => d.label);
                    
                d3.select(this)
                    .append("div")
                    .classed("tsi-ellipsisMenuDescription", true)
                    .style("display", "none");
            });
    }

    private setMenuItems (rawMenuItems: Array<any>) {
        // TODO - add validaction to each rawMenuItem
        this.menuItems = rawMenuItems.reduce((menuItems, currMenuItem) => {
            menuItems.push({
                iconClass : currMenuItem.iconClass,
                label: currMenuItem.label,
                action: currMenuItem.action,
                description: currMenuItem.description
            });
            return menuItems;
        }, []);
    }
}

export {EllipsisMenu}