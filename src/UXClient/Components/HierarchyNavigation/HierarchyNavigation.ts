import * as d3 from 'd3';
import './HierarchyNavigation.scss';
import {Utils} from "./../../Utils";
import {Component} from "./../../Interfaces/Component";
import {ServerClient} from '../../../ServerClient/ServerClient';
import { ModelAutocomplete } from '../ModelAutocomplete/ModelAutocomplete';
import { KeyCodes } from '../../Constants/Enums';

class HierarchyNavigation extends Component{
    private server: ServerClient;
    private getToken;
    private environmentFqdn;
    private clickedInstance;
    private isHierarchySelectionActive;
    private hierarchySelectorElem;
    private filterPathElem;
    private hierarchyListWrapperElem;
    private hierarchyListElem;
    private noResultsElem;
    private hierarchyElem;
    private instanceListElem;
    private instanceListWrapperElem;
    private lastInstanceContinuationToken;
    private usedInstanceSearchContinuationTokens = {};
    private envHierarchies = {};
    private envTypes = {};
    private selectedHierarchyName: string = HierarchySelectionValues.All;
    private viewType = ViewType.Hierarchy;
    private viewTypesElem;
    private searchGloballyElem;
    private mode = State.Navigate;
    private searchString = "";  
    private path: Array<string> = [];
    public hierarchyNavOptions = new HiararchyNavigationOptions();

    constructor(renderTarget: Element){ 
        super(renderTarget); 
        this.server = new ServerClient();
        function amIClicked() {
            return this == d3.event.target || this == d3.event.target.parentNode;
        }
        d3.select("html").on("click. keydown." + Utils.guid(), () => {
            if (this.clickedInstance && this.clickedInstance.contextMenu.filter(amIClicked).empty()) {
                if (d3.event && d3.event.type && d3.event.type === 'keydown') {
                    let key = d3.event.which || d3.event.keyCode;
                    if (key === 27) { // esc
                        this.closeContextMenu();
                        this.clickedInstance = null;
                    }
                    return;
                }
                this.closeContextMenu();
                this.clickedInstance = null;
            }
            if (this.isHierarchySelectionActive && this.hierarchySelectorElem.filter(amIClicked).empty()) {
                if (d3.event && d3.event.type && d3.event.type === 'keydown') {
                    let key = d3.event.which || d3.event.keyCode;
                    if (key === 27) { // esc
                        this.isHierarchySelectionActive = false;
                        this.hierarchyListWrapperElem.style('display', 'none');
                    }
                    return;
                }
                this.isHierarchySelectionActive = false;
                this.hierarchyListWrapperElem.style('display', 'none');
            }
        })
    }

    HierarchyNavigation(){
    }
    
    public render(environmentFqdn: string, getToken: any, hierarchyNavOptions: any){
        let self = this;
        this.getToken = getToken;
        this.environmentFqdn = environmentFqdn;
        this.resettingVariablesForEnvChange();
        this.hierarchyNavOptions.setOptions(hierarchyNavOptions);
        let targetElement = d3.select(this.renderTarget);   
        targetElement.text(''); 
        let hierarchyNavWrapper = targetElement.append('div').attr('class', 'tsi-hierarchy-nav-wrapper');
        super.themify(hierarchyNavWrapper, this.hierarchyNavOptions.theme);

        getToken().then(token => {
            self.server.getTimeseriesInstancesPathSearch(token, environmentFqdn, {searchString: '', path: [], hierarchies: {sort: {by: HierarchiesSort.CumulativeInstanceCount}, expand: {kind: HierarchiesExpand.OneLevel}, pageSize: 100}}).then(r => {
                if(r.hierarchyNodes && r.hierarchyNodes.hits && r.hierarchyNodes.hits.length > 0){
                    r.hierarchyNodes.hits.forEach(hn => {
                        this.envHierarchies[hn.name] = hn;
                    });
                }

                // hierarchy selection button
                let hierarchySelectionWrapper = hierarchyNavWrapper.append('div').classed('tsi-hierarchy-selection-wrapper', true);
                this.hierarchySelectorElem = hierarchySelectionWrapper.append('button').classed('tsi-hierarchy-select', true)
                    // .attr('aria-label', this.getString('Hierarchy list'))
                    // .attr('aria-controls', 'tsi-hierarchy-listbox')
                    // .attr("role", "combobox")
                    // .attr("aria-expanded", false)
                    // .attr("aria-owns", "tsi-hierarchy-list")
                    .attr("aria-haspopup", "listbox")
                    .on('click keydown', () => {
                        if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                        if (this.isHierarchySelectionActive) {
                        this.hierarchyListWrapperElem.style('display', 'none');
                        this.isHierarchySelectionActive = false;
                        }
                        else {
                        this.renderHierarchySelection();
                        this.isHierarchySelectionActive = true;
                        }
                    });
                this.hierarchySelectorElem.append('span').classed('tsi-hierarchy-name', true).text(self.getString("All hierarchies"));
                this.hierarchySelectorElem.append('i').classed('tsi-down-caret-icon', true);
                // hierarchy flyout list
                this.hierarchyListWrapperElem = hierarchySelectionWrapper.append('div').classed('tsi-hierarchy-list-wrapper', true);
                this.hierarchyListElem = this.hierarchyListWrapperElem.append('ul').classed('tsi-hierarchy-list', true).attr('role','listbox').attr("id", "tsi-hierarchy-listbox");
                
                // search
                let searchWrapper = hierarchyNavWrapper.append('div').classed('tsi-hierarchy-search', true);
                let modelAutocomplete = new ModelAutocomplete(searchWrapper.node() as Element);
                modelAutocomplete.render(environmentFqdn, getToken, {onInput: autocompleteOnInput, onKeydown: (event, ap) => {handleKeydown(event, ap)},theme: hierarchyNavOptions.theme});
                this.viewTypesElem = searchWrapper.append('div').classed('tsi-view-types', true).attr("role", "tablist");
                this.viewTypesElem.append('div').classed('tsi-view-type', true)
                                        .attr('title', 'Hierarchy View')
                                        .attr('tabindex', 0)
                                        .attr('arialabel', 'Hierarchy View')
                                        .attr('role', 'tab')
                                        .on('click keydown', function () {
                                            if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                                            self.switchToSearchView(ViewType.Hierarchy);
                                        })
                                        .append('i').classed('tsi-tree-icon', true)
                                            
                this.viewTypesElem.append('div').classed('tsi-view-type selected', true)
                                        .attr('title', 'List View')
                                        .attr('tabindex', 0)
                                        .attr('arialabel', 'List View')
                                        .attr('role', 'tab')
                                        .attr('aria-selected', true)
                                        .on('click keydown', function () {
                                            if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                                            self.switchToSearchView(ViewType.List);
                                        })
                                        .append('i').classed('tsi-list-icon', true)

                // filter path
                this.filterPathElem = hierarchyNavWrapper.append('div').classed('tsi-filter-path-wrapper', true);
                let filterPath = this.filterPathElem.append('div').classed('tsi-filter-path', true)
                filterPath.append('span').classed('tsi-path-list', true);
                filterPath.append('i').classed('tsi-close-icon tsi-filter-clear', true)
                    .attr('tabindex', 0)
                    .attr('arialabel', 'Clear Path Filter')
                    .attr('title', 'Clear Path Filter')
                    .on('click keydown', function () {
                        if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                        self.path = (self.selectedHierarchyName === HierarchySelectionValues.All || self.selectedHierarchyName === HierarchySelectionValues.Unparented) ? [] : [self.selectedHierarchyName];
                        if (self.selectedHierarchyName === HierarchySelectionValues.All) {
                            (self.searchGloballyElem.node() as any).style.display = 'none';
                        }
                        self.clearAndGetResults();
                        self.clearAndHideFilterPath();
                    });

                this.searchGloballyElem = hierarchyNavWrapper.append('div').classed('tsi-search-global', true);
                this.searchGloballyElem.append('a').text(this.getString("Search Globally"))
                                        .attr('title', this.getString("Search Globally"))
                                        .attr('tabindex', 0)
                                        .attr('arialabel', this.getString("Search Globally"))
                                        .on('click keydown', function () {
                                            if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                                            self.selectHierarchy(HierarchySelectionValues.All, false);
                                            self.switchToSearchView(ViewType.List);
                                            this.parentNode.style.display = 'none';
                                        })

                // result (hierarchy or flat list)
                let results = hierarchyNavWrapper.append('div').classed('tsi-hierarchy-or-list-wrapper', true);
                // no results
                this.noResultsElem = results.append('div').text(this.getString("No results")).classed('tsi-noResults', true).attr("role", "alert").style('display', 'none');
                // hierarchy
                this.hierarchyElem = results.append('div').classed('tsi-hierarchy', true).attr("role", "navigation").on('scroll', function(){
                    self.closeContextMenu();
                });
                // flat list
                this.instanceListWrapperElem = results.append('div').classed('tsi-list', true).on('scroll', function(){
                    if (self.viewType === ViewType.List) {
                        self.closeContextMenu();
                        if (self.lastInstanceContinuationToken && (self.lastInstanceContinuationToken !== "END")) {
                            let that = this as any;
                            if(that.scrollTop + that.clientHeight + 50 > (self.instanceListElem.node() as any).clientHeight){
                                if (self.lastInstanceContinuationToken === null || !self.usedInstanceSearchContinuationTokens[self.lastInstanceContinuationToken]) {
                                    self.usedInstanceSearchContinuationTokens[self.lastInstanceContinuationToken] = true;
                                    self.pathSearch(getToken, environmentFqdn, self.requestPayload(), self.instanceListElem, null, self.lastInstanceContinuationToken, null);
                                }
                            }
                        }
                    }
                });
                this.instanceListElem = this.instanceListWrapperElem.append('div').classed('tsi-search-results', true);

                this.pathSearch(getToken, environmentFqdn, self.requestPayload(), this.hierarchyElem);
            });
        });

        //get the most recent types to show in the context menu on instance click
        getToken().then(token => {
            this.server.getTimeseriesTypes(token, environmentFqdn).then(r => {
                r.types.forEach(t => {
                    this.envTypes[t.id] = t;
                });
            })
        })

        let autocompleteOnInput = (st, event) => {
            if(st.length === 0){
                this.searchString = st;
                (this.viewTypesElem.node() as any).style.display = 'none';
                (this.searchGloballyElem.node() as any).style.display = 'none';
                this.switchToSearchView(ViewType.Hierarchy, false);
                this.clearAndGetResults();
            }
            else {
                if (event.which === 13 || event.keyCode === 13) {
                    this.searchString = st;
                    this.switchToSearchView(ViewType.List, false);
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
        this.hierarchyNavOptions.isInstancesHighlighted = true;
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

    private renderHierarchySelection = () => {
        let hierarchyList = [HierarchySelectionValues.All, ...Object.keys(this.envHierarchies), HierarchySelectionValues.Unparented];
        this.hierarchyListElem.text('');
        let self = this;
        hierarchyList.forEach(h => {
            let title = h === HierarchySelectionValues.All ? this.getString("All hierarchies") :
                        h === HierarchySelectionValues.Unparented ? this.getString("Unassigned Time Series Instances") : h
            this.hierarchyListElem.append('li').classed('selected', h === this.selectedHierarchyName)
                                            .attr("hName", h)
                                            .attr('tabindex', 0)
                                            .attr('role', 'option')
                                            .attr('aria-selected', h === this.selectedHierarchyName)
                                            .attr('title', title)
                                            .text(title).on('click keydown', function () {
                                                if (d3.event && d3.event.type && d3.event.type === 'keydown') {
                                                    d3.event.preventDefault();
                                                    let key = d3.event.which || d3.event.keyCode;
                                                    if (key === KeyCodes.Down) {
                                                        if (this.nextElementSibling)
                                                            this.nextElementSibling.focus();
                                                        else {
                                                            self.hierarchyListElem.selectAll("li").nodes()[0].focus();
                                                        }
                                                    } else if (key === KeyCodes.Up) {
                                                        if (this.previousElementSibling)
                                                            this.previousElementSibling.focus();
                                                        else {
                                                            self.hierarchyListElem.selectAll("li").nodes()[self.hierarchyListElem.selectAll("li").nodes().length - 1].focus();
                                                        }
                                                    } else if (key === KeyCodes.Enter) {
                                                        self.selectHierarchy(h);
                                                        (self.searchGloballyElem.node() as any).style.display = 'none';
                                                        self.hierarchySelectorElem.node().focus();
                                                    } else if (key === KeyCodes.Esc) {
                                                        self.isHierarchySelectionActive = false;
                                                        self.hierarchyListWrapperElem.style('display', 'none');
                                                        self.hierarchySelectorElem.node().focus();
                                                    }
                                                    return;
                                                }
                                                self.selectHierarchy(h);
                                                self.hierarchySelectorElem.node().focus();
                                                if (h === HierarchySelectionValues.All) {
                                                    (self.searchGloballyElem.node() as any).style.display = 'none';
                                                }
                                            });
        });
        this.hierarchyListWrapperElem.style('display', 'inline-flex');
        this.hierarchyListElem.select("li.selected").node().focus();
    }

    //to switch between list view and hierarchy view when search string exists, i.e. in Search mode
    private switchToSearchView = (view: ViewType, applySearch: boolean = true) => {
        this.closeContextMenu();
        this.viewType = view;
        this.viewTypesElem.selectAll('.tsi-view-type').classed('selected', false).attr('aria-selected', false);
        if (this.viewType === ViewType.Hierarchy) {
            d3.select(this.viewTypesElem.selectAll('.tsi-view-type').nodes()[0]).classed('selected', true).attr('aria-selected', true);
            if (this.searchString) {
                this.mode = State.Filter;
                this.setRequestParamsForFilter();
            } else {
                this.mode = State.Navigate;
                this.setRequestParamsForNavigate();
            }
            if (d3.selectAll('.tsi-hierarchy ul').size() === 0 && applySearch) { // if the tree is empty, pull data
                this.hierarchyElem.text('');
                this.pathSearch(this.getToken, this.environmentFqdn, this.requestPayload(), this.hierarchyElem);
            }
            (this.hierarchyElem.node() as any).style.display = 'block';
            (this.instanceListWrapperElem.node() as any).style.display = 'none';
        } else {
            d3.select(this.viewTypesElem.selectAll('.tsi-view-type').nodes()[1]).classed('selected', true).attr('aria-selected', true);
            this.mode = State.Search;
            this.setRequestParamsForSearch();
            if (this.selectedHierarchyName === HierarchySelectionValues.Unparented) {
                this.hierarchyNavOptions.isInstancesRecursive = false;
            }
            if (d3.selectAll('.tsi-modelResultWrapper').size() === 0 && applySearch) { // if the list is empty, pull data
                this.instanceListElem.text('');
                this.lastInstanceContinuationToken = null;
                this.usedInstanceSearchContinuationTokens = {};
                this.pathSearch(this.getToken, this.environmentFqdn, this.requestPayload(), this.instanceListElem);
            }
            (this.hierarchyElem.node() as any).style.display = 'none';
            (this.instanceListWrapperElem.node() as any).style.display = 'block';
        }
    }

    // prepares the parameters for search request
    private requestPayload (path = null) {
        let payload = {};
        payload["searchString"] = this.searchString;
        payload["path"] = path ? path : this.path;
        payload["instances"] = {recursive: this.hierarchyNavOptions.isInstancesRecursive, sort: {by: this.hierarchyNavOptions.instancesSort}, highlights: this.hierarchyNavOptions.isInstancesHighlighted, pageSize: this.hierarchyNavOptions.instancesPageSize};
        if (this.selectedHierarchyName !== HierarchySelectionValues.Unparented && (this.mode !== State.Search)) { // hierarchyNodes are not needed for showing unassigned instances or flat list instance search results
            payload["hierarchies"] = {expand: {kind: this.hierarchyNavOptions.hierarchiesExpand}, sort: {by: this.hierarchyNavOptions.hierarchiesSort}, pageSize: this.hierarchyNavOptions.hierarchiesPageSize};
        }
        return payload;
    }

    // clears both hierarchy tree and flat list for new results
    private clearAndGetResults (applySearch: boolean = true) {
        this.instanceListElem.text('');
        this.hierarchyElem.text('');
        this.lastInstanceContinuationToken = null;
        this.usedInstanceSearchContinuationTokens = {};
        if (this.mode === State.Search) {
            this.hierarchyNavOptions.isInstancesRecursive = this.selectedHierarchyName === HierarchySelectionValues.Unparented ? false : true;
        }
        if (applySearch) {
            if (this.viewType === ViewType.Hierarchy)
            this.pathSearch(this.getToken, this.environmentFqdn, this.requestPayload(), this.hierarchyElem);
            else
            this.pathSearch(this.getToken, this.environmentFqdn, this.requestPayload(), this.instanceListElem);
        }
    }

    // renders tree for both 'Navigate' and 'Filter' mode (with Hierarchy View option selected), locInTarget refers to the 'show more' element -either hierarchy or instance- within the target
    private renderTree (data, target, locInTarget = null, skipLevels = null) {
        let self = this;
        if (Object.keys(data).length === 0) {
            this.noResultsElem.style('display', 'block');
            if (this.mode === State.Filter) {
                (this.viewTypesElem.node() as any).style.display = 'none';
                if ((this.selectedHierarchyName !== HierarchySelectionValues.All) || this.filterPathElem.classed('visible')) {
                    (this.searchGloballyElem.node() as any).style.display = 'inline-flex';
                }
            }
            return;
        } else {
            this.noResultsElem.style('display', 'none');
            if (this.mode === State.Filter) {
                (this.viewTypesElem.node() as any).style.display = 'inline-flex';
                if ((this.selectedHierarchyName !== HierarchySelectionValues.All) || this.filterPathElem.classed('visible')) {
                    (this.searchGloballyElem.node() as any).style.display = 'inline-flex';
                }
            }
        }
        let list, currentShowMore;
        if (!locInTarget) {
            list = target.append('ul').attr("role", target === this.hierarchyElem ? "tree" : "group");
        } else {
            if (locInTarget === '.tsi-show-more.tsi-show-more-hierarchy')
                currentShowMore = target.selectAll('.tsi-show-more.tsi-show-more-hierarchy').filter(function(d, i,list) {
                    return i === list.length - 1;
                });
            else
                currentShowMore = target.selectAll('.tsi-show-more.tsi-show-more-instance').filter(function(d, i,list) {
                    return i === list.length - 1;
                });
            currentShowMore.node().style.display = 'none';
            currentShowMore.classed('tsi-target-loc', true);
        }
        if (locInTarget && skipLevels) {
            while (skipLevels) {
                data = data[Object.keys(data)[0]].children;
                skipLevels--;
            }
        }
        Object.keys(data).forEach((el) => {
            let li;
            if (locInTarget) {
                li = target.insert('li', '.tsi-target-loc').classed('tsi-leaf', data[el].isLeaf);
            } else {
                li = list.append('li').classed('tsi-leaf', data[el].isLeaf);
            }       

            if(el === this.getString("Show More Hierarchies")) {
                li.classed('tsi-show-more tsi-show-more-hierarchy', true)
                    .append('span')
                        .classed('tsi-markedName', true)
                        .attr('tabindex', 0)
                        .attr("role", "treeitem").attr('aria-expanded', false)
                        .attr('style', `padding-left: ${(data[el].level) * 18 + 20}px`).text(el).on('click keydown', function () {
                    if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                    data[el].onClick();    
                });
            } else if (el === this.getString("Show More Instances")) {
                li.classed('tsi-show-more tsi-show-more-instance', true)
                    .append('span')
                        .classed('tsi-markedName', true)
                        .attr('tabindex', 0)
                        .attr("role", "treeitem").attr('aria-expanded', false)
                        .attr('style', `padding-left: ${(data[el].level) * 18 + 20}px`).text(el).on('click keydown', function () {
                    if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                    data[el].onClick();
                });
            } else {
                li.append('span').classed('tsi-caret-icon', !data[el].isLeaf).attr('style', `left: ${(data[el].level) * 18 + 20}px`);
                let newListElem = this.createHierarchyItemElem(data[el], el);
                li.node().appendChild(newListElem.node());

                if (!data[el].isLeaf && (self.viewType === ViewType.Hierarchy)) {
                    li.append('div').classed('tsi-pin-icon', true).attr('title', this.getString('Add to Filter Path'))
                        .attr('tabindex', 0)
                        .attr('arialabel', this.getString('Add to Filter Path'))
                        .on('click keydown', function() {
                            if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                            self.path = data[el].path;
                            let pathListElem = d3.select('.tsi-path-list');
                            pathListElem.text('');
                            let pathToLoop = self.selectedHierarchyName !== HierarchySelectionValues.All ? data[el].path.slice(1) : data[el].path;
                            pathToLoop.forEach((a, i) => {
                                if (i > 0) {
                                    pathListElem.append('span').text(' / ');
                                }
                                let pathName = a ? a : '(' + self.getString("Empty") + ')';
                                pathListElem.append('span').classed('tsi-path', true)
                                    .text(pathName)
                                    .attr('title', pathName)
                                    .attr('tabindex', 0)
                                    .attr('arialabel', pathName)
                                    .on('click keydown', function () {
                                        if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                                        self.path = self.path.slice(0, i + (self.selectedHierarchyName === HierarchySelectionValues.All ? 1 : 2));
                                        d3.selectAll(pathListElem.selectAll('span').nodes().splice((i * 2) + 1, pathListElem.selectAll('span').nodes().length)).remove();
                                        self.clearAndGetResults();
                                    });
                            });
                            d3.select('.tsi-filter-clear').style('display', 'inline-block');
                            self.filterPathElem.classed('visible', true);
                            self.clearAndGetResults();
                        }).on('mouseleave blur', function() {
                            if (d3.event.relatedTarget != d3.select(this.parentNode).select('.tsi-markedName').node()) {
                                (this as any).style.visibility = 'hidden';
                            }
                        });
                    newListElem.on('mouseover focus', function() {
                        if (d3.event.relatedTarget != d3.select(this.parentNode).select('.tsi-pin-icon').node()) {
                            (d3.select(this.parentNode).select('.tsi-pin-icon').node() as any).style.visibility = 'visible';
                        }
                    });
                    newListElem.on('mouseleave blur', function() {
                        if (d3.event.relatedTarget != d3.select(this.parentNode).select('.tsi-pin-icon').node()) {
                            (d3.select(this.parentNode).select('.tsi-pin-icon').node() as any).style.visibility = 'hidden';
                        }
                    })
                }
            }
            data[el].node = li;
            data[el].isExpanded = false;
            if (data[el].children) {
                data[el].isExpanded = true;
                data[el].node.classed('tsi-expanded', true);
                data[el].node.attr('aria-expanded', true);
                this.renderTree(data[el].children, data[el].node);
            }
        });
        if(locInTarget) {
            currentShowMore.remove();
        }
    }

    // renders instances data in flat list view, only in 'Search' mode
    private renderInstances (data, target) {
        let self = this;
        if (Object.keys(data).length === 0) {
            this.noResultsElem.style('display', 'block');
            (this.viewTypesElem.node() as any).style.display = 'none';
            if ((this.selectedHierarchyName !== HierarchySelectionValues.All) || this.filterPathElem.classed('visible')) {
                (this.searchGloballyElem.node() as any).style.display = 'inline-flex';
            }
            return;
        } else {
            this.noResultsElem.style('display', 'none');
            (this.viewTypesElem.node() as any).style.display = 'inline-flex';
            if ((this.selectedHierarchyName !== HierarchySelectionValues.All) || this.filterPathElem.classed('visible')) {
                (this.searchGloballyElem.node() as any).style.display = 'inline-flex';
            }
        }
        target.select('.tsi-show-more.tsi-show-more-instance').remove();

        Object.keys(data).forEach((i) => {
            let div;
            if (data[i].name === this.getString("Show More Instances")) {
                div = target.append('div').classed('tsi-show-more tsi-show-more-instance', true);
                div.append('span').classed('tsi-markedName', true).attr('tabindex', 0).text(i).on('click keydown', function() {
                    if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                    data[i].onClick();
                });
            } else {
                div = target.append('div').classed('tsi-modelResultWrapper', true).attr('tabindex', 0);
                let instanceElem = this.createInstanceElem(data[i]);
                div.node().appendChild(instanceElem.node());
                div.on('click keydown', function() {
                    let clickInstance = () => {
                        d3.event.stopPropagation();
                        self.closeContextMenu();
                        self.clickedInstance = data[i];
                        let target = self.instanceListElem.select(function() { return this.parentNode.parentNode});
                        let mouseWrapper = d3.mouse(target.node());
                        let mouseElt = d3.mouse(this as any);
                        data[i].onClick(target, mouseWrapper[1], mouseElt[1]);
                    }

                    if (d3.event && d3.event.type && d3.event.type === 'keydown') {
                        let key = d3.event.which || d3.event.keyCode;
                        if (key === 40) { // pressed down
                            if (this.nextElementSibling)
                                this.nextElementSibling.focus();
                        } else if (key === 38) { //pressed up
                            if (this.previousElementSibling)
                                this.previousElementSibling.focus();
                        } else if (key === 13) {
                            clickInstance();
                        }
                        return;
                    }
                    clickInstance(); 
                });
            }
            data[i].node = div;
        });
    }

    private pathSearch = (getToken, envFqdn, payload, target: any, locInTarget = null, instancesContinuationToken = null, hierarchiesContinuationToken = null, skipLevels = null) => {
        let self = this;
        let hierarchyData = {};
        let instancesData = {};
        getToken().then(token => {
            self.server.getTimeseriesInstancesPathSearch(token, envFqdn, payload, instancesContinuationToken, hierarchiesContinuationToken).then(r => {
                if (r.hierarchyNodes && r.hierarchyNodes.hits.length) {
                    hierarchyData = self.fillDataRecursively(r.hierarchyNodes, getToken, envFqdn, payload, payload);
                }
                if (r.instances && r.instances.hits && r.instances.hits.length) {
                    r.instances.hits.forEach((i) => {
                        instancesData[i.name ? i.name : (i.timeSeriesId.filter(id => id !== null).length ? i.timeSeriesId.join(" "): '')] = new InstanceNode(i.timeSeriesId, i.name, self.envTypes[i.typeId], i.hierarchyIds, i.highlights, self.hierarchyNavOptions.onInstanceClick, payload.path.length - self.path.length);
                    });
                }
                if (r.instances && r.instances.continuationToken && r.instances.continuationToken !== 'END') {
                    let showMoreInstances = new InstanceNode(null, this.getString("Show More Instances"), null, null, null, self.hierarchyNavOptions.onInstanceClick, payload.path.length - self.path.length);
                    showMoreInstances.onClick = () => self.pathSearch(getToken, envFqdn, payload, showMoreInstances.node.select(function() { return this.parentNode; }), '.tsi-show-more.tsi-show-more-instance', null, r.instances['continuationToken']);
                    instancesData[showMoreInstances.name] = showMoreInstances;

                    if (!self.usedInstanceSearchContinuationTokens[r.instances.continuationToken]){
                        self.lastInstanceContinuationToken = r.instances.continuationToken;
                    }
                } else {
                    self.lastInstanceContinuationToken = "END";
                }

                if (self.mode === State.Navigate) {
                    if (self.selectedHierarchyName !== HierarchySelectionValues.Unparented) {
                        self.renderTree({...hierarchyData, ...instancesData}, target, locInTarget);
                    } else {
                        self.renderTree(instancesData, target, locInTarget);
                    }
                } else if (self.mode === State.Filter) {
                    self.renderTree({...hierarchyData, ...instancesData}, target, locInTarget, skipLevels);
                } else {
                    self.renderInstances(instancesData, target);
                }
            }).catch(function (err) {
            })
        });
    }

    // creates in-depth data object using the server response for hierarchyNodes to show in the tree all expanded, considering UntilChildren
    private fillDataRecursively(hierarchyNodes, getToken, envFqdn, payload, payloadForContinuation = null) {
        let data = {};
        hierarchyNodes.hits.forEach((h) => {
            let hierarchy = new HierarchyNode(h.name, payload.path, payload.path.length - this.path.length, h.cumulativeInstanceCount);
            hierarchy.expand = () => {
                if (this.mode === State.Search)
                    this.pathSearch(getToken, envFqdn, this.requestPayload(hierarchy.path), this.instanceListElem);
                else
                    this.pathSearch(getToken, envFqdn, this.requestPayload(hierarchy.path), hierarchy.node);
                hierarchy.isExpanded = true; 
                hierarchy.node.classed('tsi-expanded', true);
                hierarchy.node.select(".tsi-markedName").attr('aria-expanded', true);
            };
            hierarchy.collapse = () => {hierarchy.isExpanded = false; hierarchy.node.classed('tsi-expanded', false); hierarchy.node.selectAll('ul').remove();};
            data[(h.name === "" ? '(' + this.getString("Empty") + ')' : h.name)] = hierarchy;
            if (h.hierarchyNodes && h.hierarchyNodes.hits.length) {
                hierarchy.children = this.fillDataRecursively(h.hierarchyNodes, getToken, envFqdn, this.requestPayload(hierarchy.path), payloadForContinuation);
            }
        });

        if (hierarchyNodes.continuationToken && hierarchyNodes.continuationToken !== 'END') {
            let showMorehierarchy = new HierarchyNode(this.getString("Show More Hierarchies"), payload.path, payload.path.length - this.path.length);
            showMorehierarchy.onClick = () => {
                let self = this;
                this.pathSearch(getToken, envFqdn, payloadForContinuation ? payloadForContinuation : payload, showMorehierarchy.node.select(function() { return this.parentNode; }), '.tsi-show-more.tsi-show-more-hierarchy', null, hierarchyNodes.continuationToken, payloadForContinuation ? payload.path.length - payloadForContinuation.path.length : null);
            }
            data[showMorehierarchy.name] = showMorehierarchy;
        }
        
        return data;
    }

    private closeContextMenu() {
        if(this.clickedInstance && this.clickedInstance.contextMenu) {
            this.clickedInstance.contextMenu.remove();
            d3.selectAll('li.tsi-selected').classed('tsi-selected', false);
        }
        d3.selectAll('.tsi-modelResultWrapper').classed('tsi-selected', false);
    }

    // returns dom elements of stripped strings including hits and spans
    private getElemsOfStrippedString = (str) => {
        let strippedElems = [];
        str.split('<hit>').map(h => {
            let strips = h.split('</hit>'); 
            if (strips.length > 1) {
                let hitElem = document.createElement('hit'); 
                hitElem.innerText = strips[0];
                strippedElems.push(hitElem);
                let spanElem = document.createElement('span'); 
                spanElem.innerText = strips[1];
                strippedElems.push(spanElem);
            } else {
                let spanElem = document.createElement('span'); 
                spanElem.innerText = strips[0];
                strippedElems.push(spanElem);
            }
        });
        return strippedElems;
    }

    //returns the dom element of one hierarchy level item for tree rendering
    private createHierarchyItemElem(hORi, key) {
        let self = this;
        let hierarchyItemElem;
        if (!hORi.highlights) {
            hierarchyItemElem = d3.create('span');
        } else {
            hierarchyItemElem = d3.create('div');
        }

        hierarchyItemElem.classed('tsi-markedName', true).attr('style', `padding-left: ${hORi.isLeaf ? hORi.level * 18 + 20 : (hORi.level + 1) * 18 + 20}px`)
                    .attr('tabindex', 0)
                    .attr('arialabel', key)
                    .attr('title', key)
                    .attr("role", "treeitem").attr('aria-expanded', hORi.isExpanded)
                    .on('click keydown', function() {
                        if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                        if (hORi.onClick) { // means it is an instance
                            d3.event.stopPropagation();
                            self.closeContextMenu();
                            self.clickedInstance = hORi; 
                            let mouseElt = d3.mouse(this as any);
                            let target = self.hierarchyElem.select(function() { return this.parentNode});
                            let mouseWrapper = d3.mouse(target.node());
                            hORi.onClick(target, mouseWrapper[1], mouseElt[1]);
                        } else {
                            hORi.isExpanded ? hORi.collapse() : hORi.expand()
                        }
                    });

        if (this.mode !== State.Navigate) {
            if (hORi.highlights) { // means it is an instance not a hierarchy
                let spanElem = hierarchyItemElem.append('span');
                if (hORi.highlights.name) {
                    this.getElemsOfStrippedString(hORi.highlights.name).forEach(s => spanElem.node().appendChild(s));
                } else {
                    this.getElemsOfStrippedString(this.getTsidFromHighlights(hORi.highlights)).forEach(s => spanElem.node().appendChild(s));
                }
                spanElem.append('br');
                if (this.hasHits(hORi.highlights.description) || hORi.highlights.instanceFieldNames.filter(this.hasHits).length > 0 || hORi.highlights.instanceFieldValues.filter(this.hasHits).length > 0) {
                    let highlightDetails = spanElem.append('span').classed('tsi-highlights-detail', true);
                    if (hORi.highlights.description && this.hasHits(hORi.highlights.description)) {
                        this.getElemsOfStrippedString(hORi.highlights.description).forEach(s => highlightDetails.node().appendChild(s))
                    } else {
                        highlightDetails.append('span');
                    }
                    
                    let hitTuples = [];
                    if (hORi.highlights.name) {
                        hitTuples.push([this.getElemsOfStrippedString(this.getString("Time Series ID")), this.getElemsOfStrippedString(this.getTsidFromHighlights(hORi.highlights))])
                    }
                    hORi.highlights.instanceFieldNames.forEach((ifn, idx) => {
                        var val = hORi.highlights.instanceFieldValues[idx];
                        if (this.hasHits(ifn) || this.hasHits(val)) {
                            hitTuples.push([this.getElemsOfStrippedString(ifn), this.getElemsOfStrippedString(hORi.highlights.instanceFieldValues[idx])])
                        }
                    });
                    let table = highlightDetails.append('table');
                    hitTuples.forEach(t => {
                        let row = table.append('tr');
                        let td = row.append('td');
                        t[0].forEach(elem => td.node().appendChild(elem));
                        td = row.append('td');
                        t[1].forEach(elem => td.node().appendChild(elem));  
                    });
                }
            }
            else {
                hierarchyItemElem.append('span').classed('tsi-name', true).text(key);
                if (hORi.cumulativeInstanceCount) {
                    hierarchyItemElem.append('span').classed('tsi-childCount', true).text(hORi.cumulativeInstanceCount);
                }
            }
        } else {
            hierarchyItemElem.append('span').classed('tsi-name', true).text(key ? key : '(null)');
            if (hORi.cumulativeInstanceCount) {
                hierarchyItemElem.append('span').classed('tsi-childCount', true).text(hORi.cumulativeInstanceCount);
            }
        }

        return hierarchyItemElem;
    }

    //returns the dom elem of one instance item for flat list rendering
    private createInstanceElem(i) {
        let instanceElem = d3.create('div').classed('tsi-modelResult', true);
        let firstLine = instanceElem.append('div').classed('tsi-modelPK', true);
        (i.highlights.name ? this.getElemsOfStrippedString(i.highlights.name) : this.getElemsOfStrippedString(this.getTsidFromHighlights(i.highlights))).forEach(a => (firstLine.node() as HTMLDivElement).appendChild(a));

        let secondLine = instanceElem.append('div').classed('tsi-modelHighlights', true);
        this.getElemsOfStrippedString(i.highlights.description && i.highlights.description.length ? i.highlights.description : 'No description').forEach(a => (secondLine.node() as HTMLDivElement).appendChild(a));
        secondLine.append('br');
        let table = secondLine.append('table');
        let row = table.append('tr');
        let td;
        if (i.highlights.name) {
            row.append('td').text(this.getString("Time Series ID"));
            td = row.append('td');
            this.getElemsOfStrippedString(this.getTsidFromHighlights(i.highlights)).forEach(a => (td.node() as HTMLTableDataCellElement).appendChild(a));
        }

        i.highlights.instanceFieldNames.map((ifn, idx) => {
            var val = i.highlights.instanceFieldValues[idx];
            if (this.searchString) {
                if (this.hasHits(ifn) || this.hasHits(val)) {
                    row = table.append('tr');
                    td = row.append('td');
                    this.getElemsOfStrippedString(ifn).forEach(a => (td.node() as HTMLTableDataCellElement).appendChild(a));
                    td = row.append('td');
                    this.getElemsOfStrippedString(i.highlights.instanceFieldValues[idx]).forEach(a => (td.node() as HTMLTableDataCellElement).appendChild(a));
                }
            } else if (val.length !== 0) {
                row = table.append('tr');
                td = row.append('td');
                this.getElemsOfStrippedString(ifn).forEach(a => (td.node() as HTMLTableDataCellElement).appendChild(a));
                td = row.append('td');
                this.getElemsOfStrippedString(i.highlights.instanceFieldValues[idx]).forEach(a => (td.node() as HTMLTableDataCellElement).appendChild(a));
            }
        });

        return instanceElem;
    }

    private hasHits = (str) => {
        return str && (str.indexOf("<hit>") !== -1);
    }

    private clearAndHideFilterPath = () => {
        d3.select('.tsi-path-list').text('');
        d3.select('.tsi-filter-clear').style('display', 'none');
        this.filterPathElem.classed('visible', false);
    }

    // when an hierarchy is selected from the flyout selection menu
    private selectHierarchy = (pathName, applySearch: boolean = true) => {
        this.path = pathName === HierarchySelectionValues.All || pathName === HierarchySelectionValues.Unparented ? [] : [pathName];
        this.selectedHierarchyName = pathName;
        let pathText = pathName === HierarchySelectionValues.All ? this.getString("All hierarchies") : pathName === HierarchySelectionValues.Unparented ? this.getString("Unassigned Time Series Instances") : pathName;
        d3.select('.tsi-hierarchy-name').text(pathText).attr('title', pathText);
        this.clearAndGetResults(applySearch);
        this.clearAndHideFilterPath();
        this.isHierarchySelectionActive = false;
        this.hierarchyListWrapperElem.style('display', 'none');
    }

    private resettingVariablesForEnvChange = () => {
        this.path = [];
        this.selectedHierarchyName = HierarchySelectionValues.All;
        this.searchString = '';
        this.lastInstanceContinuationToken = null;
        this.usedInstanceSearchContinuationTokens = {};
        this.envHierarchies = {};
        this.envTypes = {};
        this.setRequestParamsForNavigate();
        this.viewType = ViewType.Hierarchy;
        this.clickedInstance = null;
        this.isHierarchySelectionActive = false;
    }

    private getTsidFromHighlights = (highlights) => {
        return highlights.timeSeriesId ? (highlights.timeSeriesId.filter(id => id !== null && id !== '').length ? highlights.timeSeriesId.join(' ') : '(null)') : '(null)'
    }
}

function HierarchyNode (name, parentPath, level, cumulativeInstanceCount = null) {
    this.name = name;
    this.path = parentPath.concat([name]);
    this.expand = () => {};
    this.collapse = () => {};
    this.level = level;
    this.cumulativeInstanceCount = cumulativeInstanceCount;
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
    this.suppressDrawContextMenu = false;
    this.onClick = (target, wrapperMousePos, eltMousePos) => {
        this.node.classed('tsi-selected', true);
        this.prepareForContextMenu(target, wrapperMousePos, eltMousePos)
        contextMenuFunc(this);
    };
    this.prepareForContextMenu = (target, wrapperMousePos, eltMousePos) => {
        this.contextMenuProps = {};
        this.contextMenuProps['resultsWrapper'] = target;
        this.contextMenuProps['wrapperMousePos'] = wrapperMousePos;
        this.contextMenuProps['eltMousePos'] = eltMousePos;
    }
    this.drawContextMenu = (contextMenuActions) => {
        this.contextMenu = this.contextMenuProps['resultsWrapper'].append('div').classed('tsi-hierarchyNavigationContextMenu', true).attr('style', () => `top: ${this.contextMenuProps['wrapperMousePos'] - this.contextMenuProps['eltMousePos']}px`);
        var contextMenuList = this.contextMenu.append('ul');
        contextMenuActions.forEach((a) => {
            var option = Object.keys(a)[0];
            contextMenuList.append('li')
                .attr('tabindex', 0)
                .attr('arialabel', option)
                .attr('title', option)
                .text(option).on('click keydown', () => {
                    if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                    a[option]();
                });
        });

        // move context menu above if necessary for tag selection visibility around the bottom of the page
        let leftSpaceAtBottom = this.contextMenuProps['resultsWrapper'].node().getBoundingClientRect().height - parseFloat(this.contextMenu.node().style.top);
        let overflowAtBottom = this.contextMenu.node().getBoundingClientRect().height - leftSpaceAtBottom;
        if (overflowAtBottom > 0)
            this.contextMenu.style('top', (parseFloat(this.contextMenu.node().style.top) - overflowAtBottom) + 'px');
        let contextMenuFirstElt = (d3.select('.tsi-hierarchyNavigationContextMenu li').node() as any);
        if(contextMenuFirstElt){
            contextMenuFirstElt.focus();
        }
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

// search api params
export enum InstancesSort {DisplayName = "DisplayName", Rank = "Rank"};
export enum HierarchiesExpand {UntilChildren = "UntilChildren", OneLevel = "OneLevel"};
export enum HierarchiesSort {Name = "Name", CumulativeInstanceCount = "CumulativeInstanceCount"};
export enum HierarchySelectionValues {All = "0", Unparented = "-1"};
// hierarchy navigation component params
export enum ViewType {Hierarchy, List};
export enum Theme {light = "light", dark = "dark"};
export enum State {Navigate, Search, Filter};

export {HierarchyNavigation}