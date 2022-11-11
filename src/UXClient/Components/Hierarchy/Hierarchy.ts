import * as d3 from 'd3';
import './Hierarchy.scss';
import Utils from "../../Utils";
import {Component} from "./../../Interfaces/Component";
import {HierarchyNode} from "./../../Models/HierarchyNode";

class Hierarchy extends Component {
    private filterText = '';
    private root: HierarchyNode;
    private withContextMenu: boolean = false;
    private contextMenu: any;
    private clickedNode: any;
    private hierarchyList: any;

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    public render(data: any, options: any){
        var self = this;
        var targetElement = d3.select(this.renderTarget).classed('tsi-hierarchy', true);
        targetElement.html('');
        this.chartOptions.setOptions(options);
        super.themify(targetElement, this.chartOptions.theme);
        this.withContextMenu = this.chartOptions.withContextMenu;
        this.root = this.buildTree(data);
        this.root.isExpanded = true;
        
        d3.select("html").on("click." + Utils.guid(), (event) => {
            if (this.clickedNode && event.target != this.clickedNode && this.contextMenu) {
                this.closeContextMenu();
                this.clickedNode = null;
            }
        });
        
        var inputDebounceTimeout;
        var filter = targetElement.append('div').classed('tsi-filterWrapper', true).append('input').attr('placeholder', 'Search...').on('input', function(event){
            clearTimeout(inputDebounceTimeout);
            inputDebounceTimeout = setTimeout(() => {
                self.filterText = (<any>this).value.trim();
                if(self.filterText.length == 1)
                    return;  // quick return for small sets
                var splitFilterText = self.filterText.split('/');
                self.root.filter(splitFilterText[0]);
                if(splitFilterText.length > 1){
                    for(var i = 1; i < splitFilterText.length; i++){
                        if(splitFilterText[i].length){
                            var nodesInFilter = self.root.traverse(n => n.selfInFilter);
                            nodesInFilter.forEach(n => {
                                var markedName = n.markedName;
                                n.filter(splitFilterText[i], false)
                                n.markedName = markedName;
                            });
                            nodesInFilter.forEach(n => {
                                if(!n.childrenInFilter)
                                    n.selfInFilter = false;
                            })
                        }
                    }
                }
                list.selectAll('ul').remove();
                list.classed('tsi-expanded', false);
                self.root.childrenInFilter = self.root.childrenInFilter || self.filterText.length == 0;
                if(self.root.childrenInFilter == false)
                    list.append('ul').append('div').text(self.getString('No filter results'))
                else
                    self.expandCollapseList(self.root, list, false, event);
                list.select('ul').classed('tsi-noPad', true);
            }, 250);
        });

        var navTabs = targetElement.append('div').classed('tsi-navTabWrapper', true);
        var allTab = navTabs.append('div').classed('tsi-navTab tsi-selected', true).text(this.getString('All hierarchies'));
        var selectedTab = navTabs.append('div').classed('tsi-navTab', true).text(this.getString('Selected'));
        
        var list = targetElement.append('div').classed('tsi-hierarchyList', true);
        this.hierarchyList = list;

        allTab.on('click', (event) => {
            if(!allTab.classed('tsi-selected')){
                allTab.classed('tsi-selected', true)
                selectedTab.classed('tsi-selected', false)
                list.html('').classed('tsi-expanded', false);
                this.expandCollapseList(this.root, list, true, event);
                list.select('ul').classed('tsi-noPad', true);
                filter.attr('disabled', null);
            }
        });
        selectedTab.on('click', () => {
            if(!selectedTab.classed('tsi-selected')){
                allTab.classed('tsi-selected', false)
                selectedTab.classed('tsi-selected', true)
                list.html('');
                var ul = list.append('ul').classed('tsi-noPad', true);
                var leafs = this.root.traverse(n => n.isSelected);
                leafs.forEach(n => {
                    var li = ul.append('li').classed('tsi-leaf', n.isLeaf).classed('tsi-selected', n.isSelected).on('click', function(){
                        n.isSelected = !n.isSelected;
                        d3.select(this).classed('tsi-selected', n.isSelected);
                        n.click(n)
                        n.colorify(d3.select(this));
                    });
                    li.append('span').text(n.name).classed('tsi-markedName', true);
                    n.colorify(li);
                });
                filter.attr('disabled', true);
            }
        });

        this.expandCollapseList(this.root, list, false);
        list.select('ul').classed('tsi-noPad', true);
    }

    public expandCollapseList = (node: HierarchyNode, el, isFromClick = false, event?: any) => {
        this.closeContextMenu();
        if(el.classed('tsi-expanded') && !(this.withContextMenu && node.isLeafParent)){
            el.selectAll('ul').remove();
            el.classed('tsi-expanded', false);
            node.isExpanded = false;
        }
        else{
            if(this.withContextMenu && node.isLeafParent){
                if(this.clickedNode != el.node()){
                    this.clickedNode = el.node();
                    this.contextMenu = this.hierarchyList.append('div');
                    node.children.filter(n => n.name[0] !== '~').forEach(n => {
                        this.contextMenu.append('div').text(`${n.name}`).on('click', () => n.click(n));
                    })
                    this.contextMenu.append('div').classed('tsi-break', true);
                    node.children.filter(n => n.name[0] === '~').forEach(n => {
                        let noTildeName = n.name.slice(1);
                        this.contextMenu.append('div').text(`${noTildeName}`).on('click', () => n.click(n));
                    })
                    this.contextMenu.classed('tsi-hierarchyContextMenu', true);
                    if (event) {
                        let mouseWrapper = d3.pointer(event, this.hierarchyList.node());
                        let mouseElt = d3.pointer(event, el.node());
                        this.contextMenu.attr('style', () => `top: ${mouseWrapper[1] - mouseElt[1]}px`);
                    }
                    el.classed('tsi-resultSelected', true);
                    this.hierarchyList.selectAll('.tsi-noPad').on('scroll', () => {this.closeContextMenu()});
                }
                else{
                    this.clickedNode = null;
                }
            }
            else{
                var list = el.append('ul');
                node.children.forEach(n => {
                    if(isFromClick || n.selfInFilter || n.childrenInFilter || (node.isExpanded && this.filterText.length == 0)){
                        var self = this;
                        var clickMethod = function(){
                            if(n.isLeaf){
                                var parent = n.parent;
                                while(parent != this.root){
                                    parent.isExpanded = true;
                                    parent = parent.parent;
                                }
                                n.isSelected = !n.isSelected;
                                n.click(n);
                                var selector = d3.select(this);
                                n.colorify(selector);
                                selector.classed('tsi-selected', n.isSelected);
                            }
                            else{
                                self.expandCollapseList(n, d3.select(this), true, event);
                            }
                            event.stopPropagation();
                        }

                        var li = list.append('li').classed('tsi-leaf', n.isLeaf)
                                .classed('tsi-leafParent', n.isLeafParent && this.withContextMenu)
                                .classed('tsi-selected', n.isSelected).on('click', clickMethod)

                        li.append('span').classed('tsi-caret', true).attr('style', `left: ${(n.level - 1) * 18}px`);
                        li.append('span').classed('tsi-markedName', true).html(n.markedName)  // known unsafe usage of .html
                          .attr('style', `padding-left: ${40 + (n.level - 1) * 18 - (n.isLeafParent && this.withContextMenu ? 16 : 0)}px`)
                          .attr('title', n.isLeafParent && this.withContextMenu ? n.name : '');
                        n.colorify(li);

                        if((n.isExpanded || n.childrenInFilter) && !n.isLeaf){
                            this.expandCollapseList(n, li, isFromClick, event)
                        }
                    }
                })
                node.isExpanded = (node.isExpanded || isFromClick) || (node == this.root);
                el.classed('tsi-expanded', true);
            }
        }
    }

    public buildTree(data:any){
        var traverse = (data, key, level, parent = null) => {
            var node = new HierarchyNode(key, level);
            node.parent = parent;
            if(data.hasOwnProperty('$leaf')){
                node.isLeaf = true;
                if(data.hasOwnProperty('click'))
                    node.click = data.click;
                if(data.hasOwnProperty('color'))
                    node.color = data.color;
                node.parent.isLeafParent = true;
            }
            else{
                Object.keys(data).sort().forEach(k => {
                    node.children.push(traverse(data[k], k, level+1, node));
                })
            }
            return node;
        }
        return traverse(data, '', 0);
    }

    private closeContextMenu() {
        if(this.contextMenu){
            this.contextMenu.remove();
        }
        d3.selectAll('.tsi-resultSelected').classed('tsi-resultSelected', false);
    }
}
export default Hierarchy