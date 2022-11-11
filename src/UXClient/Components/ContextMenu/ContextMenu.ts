import * as d3 from 'd3';
import './ContextMenu.scss';
import {Component} from "./../../Interfaces/Component";

const ACTIONELEMENTHEIGHT = 28;
const ACTIONELEMENTMAXWIDTH = 200;
const ACTIONELEMENTCONTAINERMAXHEIGHT = 200;
const VERTICALPADDING = 4;

class ContextMenu extends Component {
    public drawChart: any;
    public contextMenuElement: any;
    public actions: any;
    public contextMenuVisible: boolean = false;
    public startTime;
    public endTime;

    private left: number;
    private top: number;

    private ae: string;
    private splitBy: string;
    private onClick: any;

    private subMenuFromSubLevel;
    private subMenuFromActionIndex;

	constructor(drawChart: any, renderTarget: Element) {
        super(renderTarget);
        this.drawChart = drawChart;
        this.contextMenuElement = d3.select(renderTarget).insert("div", ":first-child")
                                .attr("class", "tsi-contextMenu")
                                .style("left", "0px")
                                .style("top", "0px");
    }

    private launchSubMenu (parent, subMenuActions, subLevel, top) {
        let container = this.contextMenuElement
            .selectAll(`.tsi-actionElementContainer${subLevel}`)
            .data([{subLevel: subLevel}]);
        let enteredContainer = container.enter()
            .append('div')
            .attr("class", (d) => `tsi-actionElementContainer tsi-actionElementContainer${d.subLevel}`)
            .merge(container)
            .style('max-height', `${ACTIONELEMENTCONTAINERMAXHEIGHT}px`)
            .style('display', 'block');
        this.createActionElements(enteredContainer, subMenuActions, subLevel);
        this.positionAEC(enteredContainer, subMenuActions.length, top, subLevel);
        container.exit().remove();
    }

    private positionAEC (container, subMenuActionsCount, top, subLevel) {
        this.verticalPositionAEC(container, top, subMenuActionsCount, subLevel);
        this.horizontalPositionAEC(container, subLevel)
    }

    private shouldHorizontalFlip (rawLeft) {
        let containerLeft = rawLeft + this.left;
        let totalWidth = d3.select(this.renderTarget).node().getBoundingClientRect().width;
        return ((containerLeft + ACTIONELEMENTMAXWIDTH) > totalWidth);
    }

    private shouldVerticalFlip (rawTop, elementCount) {
        let containerTop = rawTop + this.top;
        let totalHeight = d3.select(this.renderTarget).node().getBoundingClientRect().height;
        let heightOfElements = Math.min(elementCount * ACTIONELEMENTHEIGHT + (VERTICALPADDING * 2), ACTIONELEMENTCONTAINERMAXHEIGHT);
        return ((containerTop + heightOfElements) > totalHeight);
    }

    //determine position relative to the chart as a whole
    private getRelativeHorizontalPosition (node, isLeft: boolean = true) {
        return node.getBoundingClientRect().x + (isLeft ? 0 : node.getBoundingClientRect().width) - this.renderTarget.getBoundingClientRect().x;
    }

    private verticalPositionAEC (actionElementContainer, rawTop, elementCount, subLevel) {
        let totalHeight = this.contextMenuElement.node().getBoundingClientRect().height;
        if (this.shouldVerticalFlip(rawTop, elementCount)) {
            actionElementContainer.style('bottom', `${(totalHeight - rawTop) - (subLevel === 0 ? 0 : ACTIONELEMENTHEIGHT + VERTICALPADDING)}px`)
                .style('top', null);
        } else {
            actionElementContainer.style('top', `${rawTop - VERTICALPADDING}px`)
                .style('bottom', null);
        }
    }

    private horizontalPositionAEC (actionElementContainer, subLevel) {
        let leftPosition = 0;
        let rightPosition = 0;
        if (subLevel !== 0) {
            let oneLevelUp = this.contextMenuElement.selectAll(`.tsi-actionElementContainer${subLevel - 1}`);
            if (oneLevelUp.size()) {
                rightPosition = this.getRelativeHorizontalPosition(oneLevelUp.nodes()[0], false) - this.left;  
                leftPosition = this.getRelativeHorizontalPosition(oneLevelUp.nodes()[0], true) - this.left;
            } 
        }
        if (this.shouldHorizontalFlip(rightPosition)) {
            actionElementContainer.style('left', null)
                .style('right', `${0 - leftPosition}px`);
        } else {
            actionElementContainer.style('left', `${rightPosition}px`)
                .style('right', null);
        }
    }

    private getActionElementContainerTop (launchedFromActionNode: any = null) {
        if (launchedFromActionNode === null) {
            return 0;
        }
        return launchedFromActionNode.getBoundingClientRect().top - 
                this.contextMenuElement.node().getBoundingClientRect().top;
    }

    private removeSubMenusAboveLevel (level) {
        d3.select(this.renderTarget).selectAll('.tsi-actionElementContainer').filter((subMenuD: any) => {
            return (subMenuD.subLevel > level);
        }).remove();
    }

    private createActionElements (container, actions, subLevel = 0) {
        let self = this;
        var actionElements = container.selectAll(`.tsi-actionElement`)
            .data(actions.map((a) => {
                a.subLevel = subLevel;
                return a;
            }));
            
        var actionElementsEntered = actionElements.enter()
            .append("div")
            .attr("class", `tsi-actionElement`)
            .classed('tsi-hasSubMenu', d => d.isNested)
            .merge(actionElements)
            .text(d => d.name)
            .on('mouseenter', function (event, d) {
                const e = actionElementsEntered.nodes();
                const i = e.indexOf(event.currentTarget);
                if (d.isNested) {
                    self.launchSubMenu(d3.select(this), d.subActions, subLevel + 1, self.getActionElementContainerTop(this));
                    self.subMenuFromActionIndex = i;
                    self.subMenuFromSubLevel = d.subLevel;
                    return;
                }
                if ((d.subLevel === self.subMenuFromSubLevel && i !== self.subMenuFromActionIndex) || d.subLevel < self.subMenuFromSubLevel) {
                    self.removeSubMenusAboveLevel(d.subLevel);
                }
            })
            .on("click", function (event, d) {
                if (d.isNested) {
                    return;
                }
                if (self.endTime) { // if endTime is present, this is a brush action
                    var startTime = self.startTime ?  self.startTime.toISOString().slice(0,-5)+"Z" : null;
                    var endTime = self.endTime ?  self.endTime.toISOString().slice(0,-5)+"Z" : null;
                    d.action(startTime, endTime);
                } else {
                    var timestamp = self.startTime ?  self.startTime.toISOString().slice(0,-5)+"Z" : null;
                    d.action(self.ae, self.splitBy, timestamp, event);
                }
                self.hide();
                if (self.onClick)
                    self.onClick();
            });
        actionElements.exit().remove();
    }

	public draw(chartComponentData, renderTarget, options, mousePosition, aggKey, splitBy, onClick = null, startTime = null, endTime = null, event = null) {
        this.contextMenuVisible = true;

        if (!endTime) {
            this.actions = chartComponentData.displayState[aggKey].contextMenuActions;
            this.ae = chartComponentData.displayState[aggKey].aggregateExpression;
        } else {
            this.actions = options.brushContextMenuActions;
        }
        this.splitBy = splitBy;

        this.startTime = startTime;
        this.endTime = endTime;
        this.onClick = onClick;

        super.themify(this.contextMenuElement, options.theme);

        this.left = mousePosition[0];
        this.top = mousePosition[1];

        this.contextMenuElement
            .style('left', this.left + 'px')
            .style('top', this.top + 'px');

        this.contextMenuElement.selectAll('*').remove();

        this.contextMenuElement.style("display", "block")
            .on('mouseleave', () => {
                this.removeSubMenusAboveLevel(0);
            });

        let actionContainer = this.contextMenuElement
            .selectAll('.tsi-actionElementContainer0')
            .data([{subLevel: 0}]);
        let actionContainerEntered = actionContainer.enter()
            .append('div')
            .attr('class', 'tsi-actionElementContainer tsi-actionElementContainer0');
        
        this.createActionElements(actionContainerEntered, this.actions);
        this.positionAEC(actionContainerEntered, this.actions.length, 0, 0);

        let self = this;
        d3.select(this.renderTarget).on("click", function (event) {
            if (!d3.select(event.srcElement).classed('tsi-actionElement')) {
                if (onClick) {
                    onClick();
                }
                self.hide();
            }
        });
    }

    public hide () {
        this.contextMenuElement.style("display", "none");
        this.contextMenuVisible = false;
    }
}
export default ContextMenu;