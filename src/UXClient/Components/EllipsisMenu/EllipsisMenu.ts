import * as d3 from 'd3';
import './EllipsisMenu.scss';
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

    private focusOnMenuItem (itemIndex: number = 0) {
        itemIndex = (itemIndex + this.menuItems.length) % this.menuItems.length;
        let menuItem = this.menuElement.selectAll(".tsi-ellipsisMenuItem").filter((d, i) => {
            return (itemIndex === i);
        });
        menuItem.node().focus();
    }

    private menuItemKeyHandler (event, d, i) {
        switch(event.keyCode) {
            case 9: //tab
                this.focusOnMenuItem(i + 1);
                event.preventDefault();
                break;
            case 27: //escape
                this.setMenuVisibility(false);
                this.buttonElement.node().focus();
                event.preventDefault();
                break;
            case 38: // up arrow
                this.focusOnMenuItem(i - 1);
                event.preventDefault();
                break;
            case 40: // down arrow
                this.focusOnMenuItem(i + 1);
                event.preventDefault();
                break;
        }
    }

    public render (menuItems, options: any = {}) {
        this.menuIsVisible = false;
        this.chartOptions.setOptions(options);

        this.containerElement = d3.select(this.renderTarget).classed("tsi-ellipsisMenuContainer", true);
        this.setMenuItems(menuItems);
        d3.select(this.renderTarget).selectAll("*").remove();
        super.themify(this.containerElement, this.chartOptions.theme);

        let self = this;
        this.buttonElement = d3.select(this.renderTarget).insert("button")
            .attr("class", "tsi-ellipsisButton")
            .attr("aria-label", this.getString("Show ellipsis menu"))
            .attr("title", this.getString("Show ellipsis menu"))
            .attr("type", "button")
            .on("click", function () {
                d3.select(this).attr("aria-label", !self.menuIsVisible ? self.getString("Show ellipsis menu") : self.getString("Hide ellipsis menu"))
                               .attr("title", !self.menuIsVisible ? self.getString("Show ellipsis menu") : self.getString("Hide ellipsis menu"));
                self.setMenuVisibility(!self.menuIsVisible);
                if(self.menuIsVisible) {
                    self.focusOnMenuItem(0);
                }
            });
        
        this.menuElement = d3.select(this.renderTarget).insert("div")
            .attr("class", "tsi-ellipsisMenu")
            .attr("role", "menu");

        const menuElementEntered = this.menuElement.selectAll(".tsi-ellipsisMenuItem").data(this.menuItems)
            .enter()
            .append("button")
            .classed("tsi-ellipsisMenuItem", true)
            .attr("aria-label", d => d.label)
            .attr("type", "button")
            .attr("role", "menuitem")
            .on('keydown', (event, d) => {
                const e = menuElementEntered.nodes();
                const i = e.indexOf(event.currentTarget);
                this.menuItemKeyHandler(event, d, i);
            })
            .on("click", (event, d: any) => {
                d.action();
            })
            .each(function () {
                d3.select(this)
                    .append("div")
                    .attr("class", (d: any) => "tsi-ellipsisMenuIcon " + self.createIconPath(d.iconClass, self.chartOptions.theme));

                d3.select(this)
                    .append("div")
                    .classed("tsi-ellipsisMenuLabel", true)
                    .text((d: any) => d.label);
                    
                d3.select(this)
                    .append("div")
                    .classed("tsi-ellipsisMenuDescription", true)
                    .style("display", "none");
            });
    }

    private setMenuItems (rawMenuItems: Array<any>) {
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

export default EllipsisMenu