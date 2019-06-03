import * as d3 from 'd3';
import './HierarchyNavigation.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import {ServerClient} from '../../../ServerClient/ServerClient';
import { ModelAutocomplete } from '../ModelAutocomplete/ModelAutocomplete';

class HierarchyNavigation extends Component{
    private server: ServerClient;
    private getToken;
    private environmentFqdn;
    private clickedInstance;
    private navTabs;
    private filterPathWrapper;
    private noResults;
    private hierarchy;
    private instanceList;
    private lastInstanceContinuationToken;
    private usedInstanceSearchContinuationTokens = {};
    private envHierarchies = {};
    private envTypes = {};
    private selectedHierarchyId = HierarchySelectionValues.Unparented;
    private selectedNavTab = NavTabs.Hierarchy;
    private mode = State.Navigate;
    private searchString = "";
    private path: Array<string> = [];
    public hierarchyNavOptions = new HiararchyNavigationOptions();

    constructor(renderTarget: Element){ 
        super(renderTarget); 
        this.server = new ServerClient();
        d3.select("html").on("click." + Utils.guid(), () => {
            if (this.clickedInstance && d3.event.target != this.clickedInstance.contextMenu) {
                this.closeContextMenu();
                this.clickedInstance = null;
            }
        })
    }

    HierarchyNavigation(){
    }
    
    public render(environmentFqdn: string, getToken: any, hierarchyNavOptions: any){
        let self = this;
        this.getToken = getToken;
        this.environmentFqdn = environmentFqdn;
        this.hierarchyNavOptions.setOptions(hierarchyNavOptions);
        let targetElement = d3.select(this.renderTarget);   
        targetElement.html(''); 
        let hierarchyNavWrapper = targetElement.append('div').attr('class', 'tsi-hierarchy-nav-wrapper');
        super.themify(hierarchyNavWrapper, this.hierarchyNavOptions.theme);


        getToken().then(token => {
            this.server.getTimeseriesHierarchies(token, environmentFqdn).then(r => {
                r.hierarchies.forEach(h => {
                    this.envHierarchies[h.id] = h;
                });

                //hierarchy selection
                let hierarchySelectionWrapper = hierarchyNavWrapper.append('div').classed('tsi-hierarchy-selection-wrapper', true);
                let hierarchySelect = hierarchySelectionWrapper.append('select').classed('tsi-hierarchy-select', true).on('change', function() {
                    var selectValue = d3.select(this).property('value');
                    self.selectedHierarchyId = selectValue;
                    hierarchySelect.attr("value", selectValue);

                    if (selectValue === HierarchySelectionValues.All || selectValue === HierarchySelectionValues.Unparented) {
                        self.path = [];
                        d3.select('.tsi-filter-path').property('value', '').attr('title', '');
                        (self.filterPathWrapper.node() as any).style.display = 'none';
                        if ((selectValue === HierarchySelectionValues.Unparented) && (self.selectedNavTab === NavTabs.Instances)) {
                            self.hierarchyNavOptions.isInstancesRecursive = false;
                        }
                    } else {
                        self.path = [self.envHierarchies[selectValue].name];
                        d3.select('.tsi-filter-path').property('value', self.envHierarchies[selectValue].name).attr('title', self.envHierarchies[selectValue].name);
                        (self.filterPathWrapper.node() as any).style.display = 'block';
                    }
                    self.clearAndGetResults();
                });
                // hierarchySelect.append('option').attr("value", HierarchySelectionValues.All).text('All');
                Object.keys(this.envHierarchies).forEach((hId, i) => {
                    hierarchySelect.append('option').attr("value", hId).text(this.envHierarchies[hId].name);
                    if(i === 0){
                        this.path = [this.envHierarchies[hId].name]
                    }
                });
                hierarchySelect.append('option').attr("value", HierarchySelectionValues.Unparented).text('Unassigned Time Series Instances');
                
                //filter path
                this.filterPathWrapper = hierarchyNavWrapper.append('div').classed('tsi-filter-path-wrapper', true);
                this.filterPathWrapper.append('input').classed('tsi-filter-path', true).attr('disabled', true);
                this.filterPathWrapper.append('button').classed('tsi-filter-clear', true).html('Clear').on('click', function () {
                    self.path = [];
                    if (self.selectedHierarchyId !== HierarchySelectionValues.All) {
                        self.selectedHierarchyId = HierarchySelectionValues.All;
                        d3.select('.tsi-hierarchy-select').property('value', HierarchySelectionValues.All);
                    } 
                    d3.select('.tsi-filter-path').property('value', '').attr('title', '');
                    (self.filterPathWrapper.node() as any).style.display = 'none';
                    self.clearAndGetResults();
                });
                
                //search
                let searchWrapper = hierarchyNavWrapper.append('div').classed('tsi-hierarchy-search', true);
                let modelAutocomplete = new ModelAutocomplete(searchWrapper.node() as Element);
                modelAutocomplete.render(environmentFqdn, getToken, {onInput: autocompleteOnInput, onKeydown: (event, ap) => {handleKeydown(event, ap)},theme: hierarchyNavOptions.theme});

                //result (tree or flat list)
                let results = hierarchyNavWrapper.append('div').classed('tsi-hierarchy-or-instances-wrapper', true);
                this.navTabs = results.append('div').classed('tsi-nav-tab-wrapper', true);
                this.navTabs.append('div').classed('tsi-nav-tab tsi-filtered-hierarchy tsi-selected', true).text('Hierarchy').on('click', () => this.switchToNavTab(NavTabs.Hierarchy));
                this.navTabs.append('div').classed('tsi-nav-tab tsi-instance-results', true).text('Instances').on('click', () => this.switchToNavTab(NavTabs.Instances));
                //no results
                this.noResults = results.append('div').html('No results').classed('tsi-noResults', true).style('display', 'none');
                //tree
                this.hierarchy = results.append('div').classed('tsi-hierarchy-filtered', true).on('scroll', function(){
                    self.closeContextMenu();
                });
                //flat list
                let instanceListWrapper = results.append('div').classed('tsi-hierarchy-instances', true).on('scroll', function(){
                    if (self.selectedNavTab === NavTabs.Instances && self.lastInstanceContinuationToken !== "END") {
                        self.closeContextMenu();
                        let that = this as any;
                        if(that.scrollTop + that.clientHeight + 50 > (self.instanceList.node() as any).clientHeight){
                            if (self.lastInstanceContinuationToken === null || !self.usedInstanceSearchContinuationTokens[self.lastInstanceContinuationToken]) {
                                self.usedInstanceSearchContinuationTokens[self.lastInstanceContinuationToken] = true;
                                self.pathSearch(getToken, environmentFqdn, self.requestPayload(), self.instanceList, '.show-more.instance', null, self.lastInstanceContinuationToken);
                            }
                        }
                    }
                });
                this.instanceList = instanceListWrapper.append('div').classed('tsi-search-results', true);

                this.pathSearch(getToken, environmentFqdn, self.requestPayload(), this.hierarchy);
            });
        });


        getToken().then(token => {
            this.server.getTimeseriesTypes(token, environmentFqdn).then(r => {
                r.types.forEach(t => {
                    this.envTypes[t.id] = t;
                });
            })
        })

        let autocompleteOnInput = (st, event) => {
            this.searchString = st;

            if(st.length === 0){
                // if (this.selectedNavTab === NavTabs.Hierarchy) {
                    this.switchToNavTab(NavTabs.Hierarchy);
                    // this.mode = State.Navigate;
                    // this.setRequestParamsForNavigate();
                // }
                // this.clearAndGetResults();
            }
            else {
                // if (this.selectedNavTab === NavTabs.Hierarchy) {
                //     if (st.length === 1) {
                //         this.mode = State.Filter;
                //         this.setRequestParamsForFilter();
                //     }
                // } 
                if (event.which === 13 || event.keyCode === 13) {
                    this.switchToNavTab(NavTabs.Instances);
                    this.clearAndGetResults();
                }
            }
        }

        let handleKeydown = (event, ap) => {
            if(!ap.isOpened) {
            }
        }
    }

    private setRequestParamsForSearch () {
        this.hierarchyNavOptions.isInstancesRecursive = true;
        this.hierarchyNavOptions.isInstancesHighlighted = true;
        this.hierarchyNavOptions.instancesSort = InstancesSort.Rank;
        this.hierarchyNavOptions.hierarchiesExpand = HierarchiesExpand.UntilChildren;
        this.hierarchyNavOptions.hierarchiesSort = HierarchiesSort.CumulativeInstanceCount;
    }

    private setRequestParamsForNavigate () {
        this.mode = State.Navigate;
        this.hierarchyNavOptions.isInstancesRecursive = false;
        this.hierarchyNavOptions.isInstancesHighlighted = false;
        this.hierarchyNavOptions.instancesSort = InstancesSort.DisplayName;
        this.hierarchyNavOptions.hierarchiesExpand = HierarchiesExpand.OneLevel;
        this.hierarchyNavOptions.hierarchiesSort = HierarchiesSort.Name;
    }

    private setRequestParamsForFilter () {
        this.hierarchyNavOptions.isInstancesRecursive = false;
        this.hierarchyNavOptions.isInstancesHighlighted = true;
        this.hierarchyNavOptions.instancesSort = InstancesSort.DisplayName;
        this.hierarchyNavOptions.hierarchiesExpand = HierarchiesExpand.UntilChildren;
        this.hierarchyNavOptions.hierarchiesSort = HierarchiesSort.CumulativeInstanceCount;
    }

    private switchToNavTab = (tab: NavTabs) => {
        this.closeContextMenu();
        if (tab === NavTabs.Hierarchy) {
            this.selectedNavTab = NavTabs.Hierarchy;
            if (this.searchString) {
                this.mode = State.Filter;
                this.setRequestParamsForFilter();
            } else {
                this.mode = State.Navigate;
                this.setRequestParamsForNavigate();
            }
            
            if (d3.selectAll('.tsi-hierarchy-filtered ul').size() === 0) {
                this.hierarchy.html('');
                this.pathSearch(this.getToken, this.environmentFqdn, this.requestPayload(), this.hierarchy);
            }
            this.navTabs.select('.tsi-filtered-hierarchy').classed('tsi-selected', true);
            this.navTabs.select('.tsi-instance-results').classed('tsi-selected', false);
            (this.hierarchy.node() as any).style.display = 'block';
            (this.instanceList.node() as any).style.display = 'none';
        } else {
            this.selectedNavTab = NavTabs.Instances;
            this.mode = State.Search;
            this.setRequestParamsForSearch();
            if (this.selectedHierarchyId === HierarchySelectionValues.Unparented) {
                this.hierarchyNavOptions.isInstancesRecursive = false;
            }
            if (d3.selectAll('.tsi-modelResultWrapper').size() === 0) {
                this.instanceList.html('');
                this.lastInstanceContinuationToken = null;
                this.usedInstanceSearchContinuationTokens = {};
                this.pathSearch(this.getToken, this.environmentFqdn, this.requestPayload(), this.instanceList);
            }
            this.navTabs.select('.tsi-filtered-hierarchy').classed('tsi-selected', false);
            this.navTabs.select('.tsi-instance-results').classed('tsi-selected', true);
            (this.hierarchy.node() as any).style.display = 'none';
            (this.instanceList.node() as any).style.display = 'block';
        }
    }

    private requestPayload (path = null) {
        let payload = {};
        payload["searchString"] = this.searchString;
        payload["path"] = path ? path : this.path;
        payload["instances"] = {recursive: this.hierarchyNavOptions.isInstancesRecursive, sort: {by: this.hierarchyNavOptions.instancesSort}, highlights: this.hierarchyNavOptions.isInstancesHighlighted, pageSize: this.hierarchyNavOptions.instancesPageSize};
        payload["hierarchies"] = {expand: {kind: this.hierarchyNavOptions.hierarchiesExpand}, sort: {by: this.hierarchyNavOptions.hierarchiesSort}, pageSize: this.hierarchyNavOptions.hierarchiesPageSize};

        return payload;
    }

    private clearAndGetResults () {
        this.instanceList.html('');
        this.hierarchy.html('');
        this.lastInstanceContinuationToken = null;
        this.usedInstanceSearchContinuationTokens = {};
        if (this.selectedNavTab === NavTabs.Hierarchy)
            this.pathSearch(this.getToken, this.environmentFqdn, this.requestPayload(), this.hierarchy);
        else
            this.pathSearch(this.getToken, this.environmentFqdn, this.requestPayload(), this.instanceList);
    }

    private renderTree (data, target, locInTarget = null) { //locInTarget is to refer 'show more' in the target
        let self = this;
        if (Object.keys(data).length === 0) {
            this.noResults.style('display', 'block');
            return;
        } else
            this.noResults.style('display', 'none');
        let list, currentShowMore;
        if (!locInTarget) {
            list = target.append('ul');
        } else {
            if (locInTarget === '.tsi-show-more.hierarchy')
                currentShowMore = target.selectAll('ul > .tsi-show-more.hierarchy').filter(function(d, i,list) {
                    return i === list.length - 1;
                });
            else
                currentShowMore = target.selectAll('ul > .tsi-show-more.instance').filter(function(d, i,list) {
                    return i === list.length - 1;
                });
            currentShowMore.node().style.display = 'none';
        }
        Object.keys(data).forEach((el) => {
            let li;
            if (locInTarget) {
                li = target.select('ul').insert('li', locInTarget + ':first-child').classed('tsi-leaf', data[el].isLeaf);
            } else {
                li = list.append('li').classed('tsi-leaf', data[el].isLeaf);
            }       

            if(el === "Show More Hierarchies") {
                li.classed('tsi-show-more hierarchy', true).append('span').classed('tsi-markedName', true).attr('style', `padding-left: ${(data[el].level) * 18 + 20}px`).html(el).on('click', data[el].onClick);
            } else if (el === "Show More Instances") {
                li.classed('tsi-show-more instance', true).append('span').classed('tsi-markedName', true).attr('style', `padding-left: ${(data[el].level) * 18 + 20}px`).html(el).on('click', data[el].onClick);
            } else {
                li.append('span').classed('tsi-caret', !data[el].isLeaf).attr('style', `left: ${(data[el].level) * 18 + 20}px`);
                let newListElem;
                if (!data[el].highlights) {
                    newListElem = li.append('span');
                } else {
                    newListElem = li.append('div');
                }
                    
                newListElem.classed('tsi-markedName', true).attr('style', `padding-left: ${data[el].isLeaf ? data[el].level * 18 + 20 : (data[el].level + 1) * 18 + 20}px`).html(this.getFilterHtml(data[el], el)).on('click', function() {
                    if (data[el].onClick) {
                        d3.event.stopPropagation();
                        self.closeContextMenu();
                        self.clickedInstance = data[el]; 
                        let mouseElt = d3.mouse(this as any);
                        let target;
                        if (self.selectedNavTab === NavTabs.Hierarchy) {
                            target = self.hierarchy;
                        } else {
                            target = self.instanceList.parentNode;
                        }
                        let mouseWrapper = d3.mouse(target.select(function() { return this.parentNode}).node());
                        data[el].onClick(target, mouseWrapper[1], mouseElt[1], self.path.length);
                    } else {
                        data[el].isExpanded ? data[el].collapse() : data[el].expand()
                    }
                });
                if (!data[el].isLeaf && (self.selectedNavTab === NavTabs.Hierarchy)) {
                    li.append('div').classed('tsi-flag', true).attr('title', 'Add to Filter Path').on('click', function() { 
                        self.path = data[el].path;
                        let pathStr = self.path.map((a) => a ? a : "(Empty)").join(" / ");
                        d3.select('.tsi-filter-path').property('value', pathStr).attr('title', pathStr);
                        (self.filterPathWrapper.node() as any).style.display = 'block';
                        self.clearAndGetResults();
                    });
                }
            }
            data[el].node = li;
            data[el].isExpanded = false;
            if (data[el].children) {
                data[el].isExpanded = true;
                data[el].node.classed('tsi-expanded', true);
                this.renderTree(data[el].children, data[el].node);
            }
        });
        if(locInTarget) {
            currentShowMore.remove();
        }
    }

    private renderInstances (data, target) {
        let self = this;
        if (Object.keys(data).length === 0) {
            this.noResults.style('display', 'block');
            return;
        } else
            this.noResults.style('display', 'none');
        target.select('.tsi-show-more.instance').remove();

        Object.keys(data).forEach((i) => {
            let div;
            if (data[i].name === "Show More Instances") {
                div = target.append('div').classed('tsi-show-more instance', true);
                div.append('span').classed('tsi-markedName', true).html(i).on('click', data[i].onClick);
            } else {
                div = target.append('div').classed('tsi-modelResultWrapper', true).html(this.getInstanceHtml(data[i])).on('click', function() {
                    d3.event.stopPropagation();
                    self.closeContextMenu();
                    self.clickedInstance = data[i];
                    let mouseWrapper = d3.mouse(self.instanceList.select(function() { return this.parentNode.parentNode}).node());
                    let mouseElt = d3.mouse(this as any);
                    data[i].onClick(self.instanceList, mouseWrapper[1], mouseElt[1], self.path.length);
                });
            }
            data[i].node = div;
        });
    }

    private pathSearch = (getToken, envFqdn, payload, target: any, locInTarget = null, instancesContinuationToken = null, hierarchiesContinuationToken = null) => {
        let self = this;
        let hierarchyData = {};
        let instancesData = {};
        getToken().then(token => {
            self.server.getTimeseriesInstancesPathSearch(token, envFqdn, payload, instancesContinuationToken, hierarchiesContinuationToken).then(r => {
                if (r.hierarchyNodes && r.hierarchyNodes.hits.length) {
                    hierarchyData = self.fillDataRecursively(r.hierarchyNodes, getToken, envFqdn, payload);
                }
                if (r.instances && r.instances.hits && r.instances.hits.length) {
                    r.instances.hits.forEach((i) => {
                        instancesData[i.name ? i.name : i.timeSeriesId.join(" ")] = new InstanceNode(i.timeSeriesId, i.name, self.envTypes[i.typeId], i.hierarchyIds, i.highlights, self.hierarchyNavOptions.onInstanceClick, payload.path.length - self.path.length);
                    });
                }
                if (r.instances && r.instances.continuationToken && r.instances.continuationToken !== 'END') {
                    let showMoreInstances = new InstanceNode(null, "Show More Instances", null, null, null, self.hierarchyNavOptions.onInstanceClick, payload.path.length - self.path.length);
                    showMoreInstances.onClick = () => self.pathSearch(getToken, envFqdn, payload, target, '.show-more.instance', null, r.instances['continuationToken']);
                    instancesData[showMoreInstances.name] = showMoreInstances;

                    if ((self.mode === State.Search) && (!self.usedInstanceSearchContinuationTokens[r.instances.continuationToken])){
                        self.lastInstanceContinuationToken = r.instances.continuationToken;
                    }
                } else {
                    if (self.mode === State.Search) {
                        self.lastInstanceContinuationToken = "END";
                    }
                }

                if (self.mode === State.Navigate) {
                    if (self.selectedHierarchyId !== HierarchySelectionValues.Unparented) {
                        self.renderTree({...hierarchyData, ...instancesData}, target, locInTarget);
                    } else {
                        self.renderTree(instancesData, target, locInTarget);
                    }
                } else if (self.mode === State.Filter) {
                    self.renderTree({...hierarchyData, ...instancesData}, target, locInTarget);
                } else {
                    self.renderInstances(instancesData, target);
                }
            }).catch(function (err) {
            })
        });
    }

    private fillDataRecursively(hierarchyNodes, getToken, envFqdn, payload) {
        let data = {};
        hierarchyNodes.hits.forEach((h) => {
            let hierarchy = new HierarchyNode(h.name, payload.path, payload.path.length - this.path.length);
            hierarchy.expand = () => {
                if (this.mode === State.Search)
                    this.pathSearch(getToken, envFqdn, this.requestPayload(hierarchy.path), this.instanceList);
                else
                    this.pathSearch(getToken, envFqdn, this.requestPayload(hierarchy.path), hierarchy.node);
                hierarchy.isExpanded = true; 
                hierarchy.node.classed('tsi-expanded', true);
            };
            hierarchy.collapse = () => {hierarchy.isExpanded = false; hierarchy.node.classed('tsi-expanded', false); hierarchy.node.selectAll('ul').remove();};
            data[(h.name === "" ? "(Empty)" : h.name) + " <span class=\"tsi-childCount\">(" + h.cumulativeInstanceCount + ")</span>"] = hierarchy;
            if (h.hierarchyNodes && h.hierarchyNodes.hits.length) {
                hierarchy.children = this.fillDataRecursively(h.hierarchyNodes, getToken, envFqdn, this.requestPayload(hierarchy.path));
            }
        });

        if (hierarchyNodes.continuationToken && hierarchyNodes.continuationToken !== 'END') {
            let showMorehierarchy = new HierarchyNode("Show More Hierarchies", payload.path, payload.path.length - this.path.length);
            showMorehierarchy.onClick = () => {
                let self = this;
                if (this.mode === State.Search) {
                    this.pathSearch(getToken, envFqdn, payload, self.instanceList, '.tsi-show-more.hierarchy', null, hierarchyNodes.continuationToken);
                } else {
                    this.pathSearch(getToken, envFqdn, payload, showMorehierarchy.node.select(function() { return this.parentNode.parentNode; }), '.tsi-show-more.hierarchy', null, hierarchyNodes.continuationToken);
                }
            }
            data[showMorehierarchy.name] = showMorehierarchy;
        }
        
        return data;
    }

    private closeContextMenu() {
        if(this.clickedInstance && this.clickedInstance.contextMenu) {
            this.clickedInstance.contextMenu.remove();
            d3.selectAll('li.selected').classed('selected', false);
        }
        d3.selectAll('.tsi-modelResultWrapper').classed('selected', false);
    }

    private stripHits = (str) => {
        return str.split('<hit>').map(h => h.split('</hit>').map(h2 => Utils.strip(h2)).join('</hit>')).join('<hit>')
    }

    private getFilterHtml(hORi, key) {
        if (this.mode !== State.Navigate) {
            if (hORi.highlights) {
                return `<span>
                            ${hORi.highlights.name ? this.stripHits(hORi.highlights.name) : this.stripHits(hORi.highlights.timeSeriesIds ? hORi.highlights.timeSeriesIds.join(' ') : hORi.highlights.timeSeriesId.join(' '))}
                            <br>
                            <span class="tsi-highlights-detail">
                                ${hORi.highlights.description && hORi.highlights.description.indexOf("<hit>") !== -1 ? this.stripHits(hORi.highlights.description) : ''}
                                <table>
                                    ${hORi.highlights.instanceFieldNames.map((ifn, idx) => {
                                        var val = hORi.highlights.instanceFieldValues[idx];
                                        return this.hasHits(ifn) || this.hasHits(val) ? '<tr><td>' + this.stripHits(ifn) + '</td><td>' + this.stripHits(hORi.highlights.instanceFieldValues[idx]) + '</tr>' : '';
                                    }).join('')}
                                </table>
                            </span>
                        </span>`; 
            }
            else return key;
        } else return key;
    }

    private getInstanceHtml(i) {
        return `<div class="tsi-modelResult">
                    <div class="tsi-modelPK">
                        ${i.highlights.name ? this.stripHits(i.highlights.name) : this.stripHits(i.highlights.timeSeriesIds ? i.highlights.timeSeriesIds.join(' ') : i.highlights.timeSeriesId.join(' '))}
                    </div>
                    <div class="tsi-modelHighlights">
                        ${this.stripHits(i.highlights.description && i.highlights.description.length ? i.highlights.description : 'No description')}
                        <br/><table>
                        ${i.highlights.name ? ('<tr><td>Time Series ID</td><td>' + this.stripHits(i.highlights.timeSeriesIds ? i.highlights.timeSeriesIds.join(' ') : i.highlights.timeSeriesId.join(' ')) + '</td></tr>') : ''}                        
                        ${i.highlights.instanceFieldNames.map((ifn, idx) => {
                            var val = i.highlights.instanceFieldValues[idx];
                            if (this.searchString)
                                return this.hasHits(ifn) || this.hasHits(val) ? '<tr><td>' + this.stripHits(ifn) + '</td><td>' + this.stripHits(i.highlights.instanceFieldValues[idx]) + '</tr>' : '' ;
                            else
                                return val.length === 0 ? '' :  '<tr><td>' + this.stripHits(ifn) + '</td><td>' + this.stripHits(i.highlights.instanceFieldValues[idx]) + '</tr>';
                        }).join('')}
                        </table>
                    </div>
                </div>`;
    }

    private hasHits = (str) => {
        return str && (str.indexOf("<hit>") !== -1);
    }
}

function HierarchyNode (name, parentPath, level) {
    this.name = name;
    this.path = parentPath.concat([name]);
    this.expand = () => {};
    this.collapse = () => {};
    this.level = level;
    this.node = null;
    this.children = null;
    this.isExpanded = false;
}

function InstanceNode (tsId, name = null, type, hierarchyIds, highlights, contextMenuFunc, level) {
    this.timeSeriesId = tsId;
    this.name = name;
    this.type = type;
    this.hierarchyIds = hierarchyIds;
    this.highlights = highlights;
    this.onClick = (target, wrapperMousePos, eltMousePos, isPathActive) => {
        this.node.classed('selected', true);
        this.prepareForContextMenu(target, wrapperMousePos, eltMousePos, isPathActive)
        contextMenuFunc(this);
    };
    this.prepareForContextMenu = (target, wrapperMousePos, eltMousePos, isPathActive) => {
        this.contextMenuProps = {};
        this.contextMenuProps['resultsWrapper'] = target;
        this.contextMenuProps['wrapperMousePos'] = wrapperMousePos;
        this.contextMenuProps['eltMousePos'] = eltMousePos;
        this.contextMenuProps['isPathActive'] = isPathActive;
    }
    this.drawContextMenu = (contextMenuActions) => {
        this.contextMenu = this.contextMenuProps['resultsWrapper'].append('div').classed('tsi-hierarchyNavigationContextMenu', true).attr('style', () => `top: ${this.contextMenuProps['wrapperMousePos'] - this.contextMenuProps['eltMousePos'] + (this.contextMenuProps['isPathActive'] ? 121 : 90)}px`);
        var contextMenuList = this.contextMenu.append('ul');
        contextMenuActions.forEach((a) => {
            var option = Object.keys(a)[0];
            contextMenuList.append('li').html(option).on('click', a[option]);
        });
        // this.contextMenuProps['hierarchy'].attr('style', `padding-bottom: ${this.contextMenu.node().getBoundingClientRect().height}px`);  margin-top = -*height of context menu
    }
    this.isLeaf = true;
    this.level = level;
    this.node = null;
}

function HiararchyNavigationOptions () {
    this.instancesPageSize = 10;
    this.hierarchiesPageSize = 10;
    this.isInstancesRecursive = false;
    this.isInstancesHighlighted = false;
    this.instancesSort = InstancesSort.DisplayName;
    this.hierarchiesExpand = HierarchiesExpand.OneLevel;
    this.hierarchiesSort = HierarchiesSort.Name;
    this.theme = Theme.light;

    this.setOptions = (options) => {
        this.instancesPageSize = options.hasOwnProperty('instancesPageSize') ? options.instancesPageSize : this.instancesPageSize; 
        this.hierarchiesPageSize = options.hasOwnProperty('hierarchiesPageSize') ? options.hierarchiesPageSize : this.hierarchiesPageSize; 
        this.isInstancesRecursive = options.hasOwnProperty('isInstancesRecursive') ? options.isInstancesRecursive : this.isInstancesRecursive; 
        this.isInstancesHighlighted = options.hasOwnProperty('isInstancesHighlighted') ? options.isInstancesHighlighted : this.isInstancesHighlighted; 
        this.instancesSort = options.hasOwnProperty('instancesSort') && options.instancesSort in InstancesSort ? options.instancesSort : this.instancesSort; 
        this.hierarchiesExpand = options.hasOwnProperty('hierarchiesExpand') && options.hierarchiesExpand in HierarchiesExpand ? options.hierarchiesExpand : this.hierarchiesExpand; 
        this.hierarchiesSort = options.hasOwnProperty('hierarchiesSort') && options.hierarchiesSort in HierarchiesSort ? options.hierarchiesSort : this.hierarchiesSort; 
        this.theme = options.hasOwnProperty('theme') && options.theme in Theme ? options.theme : this.theme;
        if (options.hasOwnProperty('onInstanceClick')) {
            this.onInstanceClick = options.onInstanceClick;
        } 
    }
}

export enum InstancesSort {DisplayName = "DisplayName", Rank = "Rank"};
export enum HierarchiesExpand {UntilChildren = "UntilChildren", OneLevel = "OneLevel"};
export enum HierarchiesSort {Name = "Name", CumulativeInstanceCount = "CumulativeInstanceCount"};
export enum HierarchySelectionValues {All = "0", Unparented = "-1"};
export enum NavTabs {Hierarchy, Instances};
export enum Theme {light = "light", dark = "dark"};
export enum State {"Navigate", "Search", "Filter"};

export {HierarchyNavigation}