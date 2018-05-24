import * as d3 from 'd3';
import './Hierarchy.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import {HierarchyNode} from "./../../Models/HierarchyNode";

class Hierarchy extends Component {
    private filterText = '';
    private root: HierarchyNode;
    private dnd: boolean = false;

    constructor(renderTarget: Element){
        super(renderTarget);
    }

    public render(data: any, options: any){
        var self = this;
        var targetElement = d3.select(this.renderTarget).classed('tsi-hierarchy', true);
        targetElement.html('');
        super.themify(targetElement, options.theme);
        this.dnd = !!options.dnd;
        this.root = this.buildTree(data);
        this.root.isExpanded = true;

        var inputDebounceTimeout;
        var filter = targetElement.append('div').classed('tsi-filterWrapper', true).append('input').attr('placeholder', 'Filter hierarchy values...').on('input', function(){
            clearTimeout(inputDebounceTimeout);
            inputDebounceTimeout = setTimeout(() => {
                self.filterText = (<any>this).value.trim();
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
                    list.append('ul').append('div').text('No filter results')
                else
                    self.expandCollapseList(self.root, list, false);
                list.select('ul').classed('tsi-noPad', true);
            }, 100);
        });

        var navTabs = targetElement.append('div').classed('tsi-navTabWrapper', true);
        var allTab = navTabs.append('div').classed('tsi-navTab tsi-selected', true).text('All');
        var selectedTab = navTabs.append('div').classed('tsi-navTab', true).text('Selected');
        
        var list = targetElement.append('div').classed('tsi-hierarchyList', true);

        allTab.on('click', () => {
            if(!allTab.classed('tsi-selected')){
                allTab.classed('tsi-selected', true)
                selectedTab.classed('tsi-selected', false)
                list.html('').classed('tsi-expanded', false);
                this.expandCollapseList(this.root, list, true);
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
                    li.append('span').html(n.name);
                    n.colorify(li);
                });
                filter.attr('disabled', true);
            }
        });

        this.expandCollapseList(this.root, list, false);
        list.select('ul').classed('tsi-noPad', true);
    }

    public expandCollapseList = (node: HierarchyNode, el, isFromClick = false,) => {
        if(el.classed('tsi-expanded')){
            el.selectAll('ul').remove();
            el.classed('tsi-expanded', false);
            node.isExpanded = false;
        }
        else{
            var list = el.append('ul');

            node.children.forEach(n => {
                if(isFromClick || n.selfInFilter || n.childrenInFilter || (node.isExpanded && this.filterText.length == 0)){
                    var self = this;
                    var clickMethod = function(){
                        if(n.isLeaf && !self.dnd){
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
                            self.expandCollapseList(n, d3.select(this), true);
                        }
                        d3.event.stopPropagation();
                    }

                    var li = list.append('li').classed('tsi-leaf', n.isLeaf)
                                .classed('draggable', n.isLeaf && self.dnd).classed('tsi-selected', n.isSelected).on('click', clickMethod)
                                .attr('draggable', n.isLeaf && self.dnd);

                    if(n.isLeaf){
                        li.node().addEventListener('dragstart', (event) => {
                                        var key = '__tsi_dragend__';
                                        window[key] = () => n.click(n);
                                        event.dataTransfer.setData('text', key);
                                    });
                    }
                    li.append('span').html(n.markedName);
                    n.colorify(li);

                    if((n.isExpanded || n.childrenInFilter) && !n.isLeaf){
                        this.expandCollapseList(n, li)
                    }
                }
            })
            node.isExpanded = (node.isExpanded || isFromClick) || (node == this.root);
            el.classed('tsi-expanded', true)
        }
    }

    public buildTree(data:any){
        var traverse = (data, key, parent = null) => {
            var node = new HierarchyNode(key);
            node.parent = parent;
            if(data.hasOwnProperty('$leaf')){
                node.isLeaf = true;
                if(data.hasOwnProperty('click'))
                    node.click = data.click;
                if(data.hasOwnProperty('color'))
                    node.color = data.color;
            }
            else{
                Object.keys(data).sort().forEach(k => {
                    node.children.push(traverse(data[k], k, node));
                })
            }
            return node;
        }
        return traverse(data, '');
    }
}
export {Hierarchy}