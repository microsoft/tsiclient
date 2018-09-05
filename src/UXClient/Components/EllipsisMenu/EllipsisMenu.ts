import * as d3 from 'd3';
import './EllipsisMenu.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";

class EllipsisMenu extends Component {

    private buttonElement: any;
    private menuElement: any;
    private menuItems: any;
    private MenuIsVisible: any;

	constructor(renderTarget: Element, menuItems: Array<any>) {
        super(renderTarget);
    }

    private render (menuItems) {
        this.setMenuItems(menuItems);
        d3.select(this.renderTarget).selectAll("*").remove();
        this.buttonElement = d3.select(this.renderTarget).insert("div", ":first-child")
            .attr("class", "tsi-ellipsisButton")
            .style("left", "0px")
            .style("top", "0px")
            .on("click", () => {
                // this.
            })
        
        this.menuElement = d3.select(this.renderTarget).insert("div")
            .attr("class", "tsi-ellipsisButton")
            .style("left", "0px")
            .style("top", "0px")
            .style("display", "none");
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
        }, {});
    }
}

export {EllipsisMenu}