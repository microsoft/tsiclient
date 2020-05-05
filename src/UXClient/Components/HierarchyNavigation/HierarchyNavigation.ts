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
    private searchWrapperElem;
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
    private instanceLookupLoadingElem;
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
            if (this.clickedInstance && this.clickedInstance.contextMenu && this.clickedInstance.contextMenu.filter(amIClicked).empty()) {
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

        //get the most recent types to show in the context menu on instance click
        getToken().then(token => {
            this.server.getTimeseriesTypes(token, environmentFqdn).then(r => {
                r.types.forEach(t => {
                    this.envTypes[t.id] = t;
                });
            })
        });

        //get the most recent hierarchies for reverse lookup
        getToken().then(token => {
            this.server.getTimeseriesHierarchies(token, environmentFqdn).then(r => {
                r.hierarchies.forEach(h => {
                    this.envHierarchies[h.name] = h;
                });
            })
        });

        getToken().then(token => {
            self.server.getTimeseriesInstancesPathSearch(token, environmentFqdn, {searchString: '', path: [], hierarchies: {sort: {by: HierarchiesSort.CumulativeInstanceCount}, expand: {kind: HierarchiesExpand.OneLevel}, pageSize: 100}}).then(r => {
                // hierarchy selection button
                let hierarchySelectionWrapper = hierarchyNavWrapper.append('div').classed('tsi-hierarchy-selection-wrapper', true);
                this.hierarchySelectorElem = hierarchySelectionWrapper.append('button').classed('tsi-hierarchy-select', true)
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
                this.searchWrapperElem = hierarchyNavWrapper.append('div').classed('tsi-hierarchy-search', true);
                let modelAutocomplete = new ModelAutocomplete(this.searchWrapperElem.node() as Element);
                modelAutocomplete.render(environmentFqdn, getToken, {onInput: autocompleteOnInput, onKeydown: (event, ap) => {handleKeydown(event, ap)},theme: hierarchyNavOptions.theme});
                this.viewTypesElem = this.searchWrapperElem.append('div').classed('tsi-view-types', true).attr("role", "tablist");
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
                                        });

                this.instanceLookupLoadingElem = hierarchyNavWrapper.append('div').classed('tsi-instance-lookup-loading', true);
                this.instanceLookupLoadingElem.append('i').classed('tsi-spinner-icon', true);
                this.instanceLookupLoadingElem.append('span').classed('tsi-lookup-instance', true);

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
                                    self.thenablePathSearchAndRenderResult({search: {payload: self.requestPayload(), instancesContinuationToken: self.lastInstanceContinuationToken}, render: {target: self.instanceListElem}});
                                }
                            }
                        }
                    }
                });
                this.instanceListElem = this.instanceListWrapperElem.append('div').classed('tsi-search-results', true);
                this.thenablePathSearchAndRenderResult({search: {payload: self.requestPayload()}, render: {target: this.hierarchyElem}});
            });
        });

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

    private setModeAndRequestParamsForSearch () {
        this.mode = State.Search;
        this.hierarchyNavOptions.isInstancesRecursive = true;
        this.hierarchyNavOptions.isInstancesHighlighted = true;
        this.hierarchyNavOptions.instancesSort = InstancesSort.Rank;
        this.hierarchyNavOptions.hierarchiesExpand = HierarchiesExpand.UntilChildren;
        this.hierarchyNavOptions.hierarchiesSort = HierarchiesSort.CumulativeInstanceCount;
    }

    private setModeAndRequestParamsForNavigate () {
        this.mode = State.Navigate;
        this.hierarchyNavOptions.isInstancesRecursive = false;
        this.hierarchyNavOptions.isInstancesHighlighted = true;
        this.hierarchyNavOptions.instancesSort = InstancesSort.DisplayName;
        this.hierarchyNavOptions.hierarchiesExpand = HierarchiesExpand.OneLevel;
        this.hierarchyNavOptions.hierarchiesSort = HierarchiesSort.Name;
    }

    private setModeAndRequestParamsForFilter () {
        this.mode = State.Filter;
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
                this.setModeAndRequestParamsForFilter();
            } else {
                this.setModeAndRequestParamsForNavigate();
            }
            if (d3.selectAll('.tsi-hierarchy ul').size() === 0 && applySearch) { // if the tree is empty, pull data
                this.hierarchyElem.text('');
                this.thenablePathSearchAndRenderResult({search: {payload: this.requestPayload()}, render: {target: this.hierarchyElem}});
            }
            (this.hierarchyElem.node() as any).style.display = 'block';
            (this.instanceListWrapperElem.node() as any).style.display = 'none';
        } else {
            d3.select(this.viewTypesElem.selectAll('.tsi-view-type').nodes()[1]).classed('selected', true).attr('aria-selected', true);
            this.setModeAndRequestParamsForSearch();
            if (this.selectedHierarchyName === HierarchySelectionValues.Unparented) {
                this.hierarchyNavOptions.isInstancesRecursive = false;
            }
            if (d3.selectAll('.tsi-modelResultWrapper').size() === 0 && applySearch) { // if the list is empty, pull data
                this.instanceListElem.text('');
                this.lastInstanceContinuationToken = null;
                this.usedInstanceSearchContinuationTokens = {};
                this.thenablePathSearchAndRenderResult({search: {payload: this.requestPayload()}, render: {target: this.instanceListElem}});
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
            if (this.viewType === ViewType.Hierarchy) {
                return this.asyncPathSearchAndRenderResult({search: {payload: this.requestPayload()}, render: {target: this.hierarchyElem}});
            }
            else {
                return this.asyncPathSearchAndRenderResult({search: {payload: this.requestPayload()}, render: {target: this.instanceListElem}});
            }
        }
    }

    public showInstance (timeSeriesID: Array<string>, hierarchyIds: Array<string> = null) {
        let isHierarchySelected = this.selectedHierarchyName !== HierarchySelectionValues.All && this.selectedHierarchyName !== HierarchySelectionValues.Unparented;
        let hierarchyNamesFromParam = hierarchyIds ? hierarchyIds.map(hId => Object.keys(this.envHierarchies).find(n => this.envHierarchies[n].id === hId)) : null;
        let hNames = hierarchyNamesFromParam ? hierarchyNamesFromParam : isHierarchySelected ? [this.selectedHierarchyName] : Object.keys(this.envHierarchies);
        hNames = [null, ...hNames]; // adding null for search with direct instances
        let instance, instanceIdentifier;

        // clear dom and reset some variables for fresh navigation experience 
        let prepareComponentForLookup = () => {
            this.instanceListElem.text('');
            this.hierarchyElem.text('');
            this.hierarchyElem.style('display', 'none');
            this.noResultsElem.style('display', 'none');
            this.instanceLookupLoadingElem.select('.tsi-lookup-instance').text("Looking for " + timeSeriesID.join(" "));
            this.instanceLookupLoadingElem.style('display', 'flex');
            this.clearAndHideFilterPath();
            this.viewTypesElem.style("display", "none");
            this.searchWrapperElem.select("input").node().value = "";
            this.searchGloballyElem.style("display", "none");
            this.path = isHierarchySelected ? [this.selectedHierarchyName] : [];
        }

        // pull instance to get its name to search in the tree if exist
        let getInstance = () => {
            return this.getToken().then(token => {
                return this.server.getTimeseriesInstances(token, this.environmentFqdn, 1, [timeSeriesID]);
            });
        }

        // do exact search with tsid to retrieve all possible paths until that instance to traverse for expansion
        let doExactSearchWithPossiblePaths = () => {
            this.setModeAndRequestParamsForFilter();
            this.searchString = '"' + timeSeriesID.join(" ").replace(":", " ") + '"'; //TODO: null vs string null check for exact search and escape for character : fix from backend will come here!!

            return Promise.all(hNames.map(hName => {
                let payload = hName ? this.requestPayload([hName]) : this.requestPayload(null);
                return this.getToken().then(token => 
                    this.server.getTimeseriesInstancesPathSearch(token, this.environmentFqdn, payload, null, null));
            }));
        };

        // simulate expand operation for each hierarchy node in a full path until the instance and then locate the instance
        let simulateExpand = async (path: Array<string>) => {
            let lastHierarchyNodeParent = document.getElementsByClassName("tsi-hierarchy")[0];
            let ulToLook, nameSpan;
            for (let idx = 0; idx < path.length; idx++){ //forEach does not work with await
                let p = path[idx];
                if (isHierarchySelected && idx === 0) {continue;};
                let hierarchyNodeToExpand;
                let pathNodeName = this.hierarchyNodeIdentifier(p);
                ulToLook = lastHierarchyNodeParent.getElementsByTagName("ul")[0];
                nameSpan = Array.from(ulToLook.getElementsByClassName("tsi-name")).find(e => (e as HTMLElement).innerText === pathNodeName);
                if (!nameSpan) { // if the hierarchy node we are looking is not there, add it manually to prevent possible show more calls and dom insertions
                    let hierarchyNode = new HierarchyNode(pathNodeName, path.slice(0, idx), isHierarchySelected || hierarchyNamesFromParam ? idx - 1 : idx, '');
                    hierarchyNode.expand = async () => {
                        const r = await this.asyncPathSearchAndRenderResult({search: {payload: this.requestPayload(hierarchyNode.path)}, render: {target: hierarchyNode.node}})
                        
                        hierarchyNode.isExpanded = true; 
                        hierarchyNode.node.classed('tsi-expanded', true);
                        hierarchyNode.node.attr('aria-expanded', true);
                        return r;
                    };

                    // create the dom element for this new hierarchy node
                    let li = d3.create("li");
                    let newListContentElem = this.createHierarchyItemElem(hierarchyNode, hierarchyNode.name);
                    li.node().appendChild(newListContentElem.node());
                    ulToLook.insertBefore(li.node(), ulToLook.firstChild); // put it to the top of the list
                    hierarchyNode.node = li;
                    nameSpan = newListContentElem.select('.tsi-name').node() as HTMLElement;

                    let hitCount = parseInt((lastHierarchyNodeParent.getElementsByClassName("tsi-hitCount")[0] as HTMLElement).innerText);
                    if (ulToLook.getElementsByClassName("tsi-hierarchyItem").length === hitCount + 1) {
                        ulToLook.removeChild(ulToLook.lastChild); // remove show more to prevent duplication
                    }
                }
                hierarchyNodeToExpand = (nameSpan.parentNode as HTMLElement); 
                lastHierarchyNodeParent = hierarchyNodeToExpand.parentNode;
                let onClickFunc = d3.select(hierarchyNodeToExpand).on("click");
                await onClickFunc.apply(hierarchyNodeToExpand);
            }

            // locate the instance
            ulToLook = lastHierarchyNodeParent.getElementsByTagName("ul")[0];
            nameSpan = Array.from((ulToLook as HTMLElement).getElementsByClassName("tsi-name")).find(e => (e as HTMLElement).innerText === instanceIdentifier);
            if (!nameSpan) {//if the instance node we are looking is not there after expansion, add it manually to prevent possible show more calls and dom insertions
                let instanceNode = new InstanceNode(instance.timeSeriesId, instance.name, this.envTypes[instance.typeId], instance.hierarchyIds, instance.highlights, this.hierarchyNavOptions.onInstanceClick, isHierarchySelected || hierarchyNamesFromParam ? path.length - 1 : path.length);
                let li = d3.create("li").classed('tsi-leaf', true);
                let newListContentElem = this.createHierarchyItemElem(instanceNode, instance.name ? instance.name : (instance.timeSeriesId.filter(id => id !== null).length ? instance.timeSeriesId.join(" "): ''));
                li.node().appendChild(newListContentElem.node());
                ulToLook.insertBefore(li.node(), ulToLook.getElementsByClassName('tsi-leaf')[0]); // put it to the top of the instance list after hierarchy nodes
                instanceNode.node = li;
                let instanceCount = parseInt((lastHierarchyNodeParent.getElementsByClassName("tsi-instanceCount")[0] as HTMLElement).innerText);
                if (ulToLook.getElementsByClassName("tsi-hierarchyItem").length === instanceCount + 1) {
                    ulToLook.removeChild(ulToLook.lastChild); // remove show more to prevent duplication
                }
                nameSpan = newListContentElem.select('.tsi-name').node() as HTMLElement;
            } else {
                ulToLook.insertBefore(nameSpan.parentNode.parentNode, ulToLook.getElementsByClassName('tsi-leaf')[0]); // move it to the top of the instance list after hierarchy nodes
            }
            // mark the instance identifier manually to highlight it
            nameSpan.innerText = '';
            let hitElem = document.createElement('hit'); 
            hitElem.innerText = instanceIdentifier;
            nameSpan.appendChild(hitElem);
        }

        prepareComponentForLookup();
        getInstance().then(r => {
            instance = r['get'][0]['instance'];
            if (instance) {
                instanceIdentifier = this.instanceNodeIdentifier(instance); 
                doExactSearchWithPossiblePaths().then(async results => {
                    let paths = [];
                    results.forEach((r, idx) => {// get full paths
                        if (idx === 0) { // if instance is direct instance of the top root
                            if (r.instances && r.instances.hitCount) {
                                paths.push([]);
                            };
                        } else if (r.hierarchyNodes && r.hierarchyNodes.hits.length) {
                            r.hierarchyNodes.hits.forEach(h => {
                                let path: Array<string> = [hNames[idx]];
                                let currentHit = h;
                                path.push(currentHit.name);
                                while (currentHit.hierarchyNodes) {
                                    currentHit = currentHit.hierarchyNodes.hits[0];
                                    path.push(currentHit.name);
                                }
                                paths.push(path);
                            });
                        }
                    });
                    // go back to default navigate mode without exact search
                    this.searchString = "";
                    console.log(paths);
                    this.setModeAndRequestParamsForNavigate();
                    this.viewType = ViewType.Hierarchy;
                    await this.clearAndGetResults(); // get a fresh hierarchy with defaulf settings for navigation, ready to expand and locate
                    await Promise.all(paths.map(p => simulateExpand(p)));
                    this.hierarchyElem.style('display', 'block');
                    this.instanceLookupLoadingElem.style('display', 'none');
                });
            } else {
                this.searchString = "";
                this.setModeAndRequestParamsForNavigate();
                this.viewType = ViewType.Hierarchy;
                this.hierarchyElem.style('display', 'block');
                this.noResultsElem.style('display', 'block');
                this.instanceLookupLoadingElem.style('display', 'none');
            }
        });
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
            let li, newListElem;
            if (locInTarget) {
                if (target.selectAll(".tsi-name").nodes().find(e => e.innerText === el)) {return;}
                li = target.insert('li', '.tsi-target-loc').classed('tsi-leaf', data[el].isLeaf);
            } else {
                li = list.append('li').classed('tsi-leaf', data[el].isLeaf);
            }       

            if(el === this.getString("Show More Hierarchies")) {
                li.classed('tsi-show-more tsi-show-more-hierarchy', true)
                    .append('span')
                        .classed('tsi-hierarchyItem', true)
                        .attr('tabindex', 0)
                        .attr("role", "treeitem").attr('aria-expanded', false)
                        .attr('style', `padding-left: ${(data[el].level) * 18 + 20}px`).text(el).on('click keydown', function () {
                    if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                    return data[el].onClick();    
                });
            } else if (el === this.getString("Show More Instances")) {
                li.classed('tsi-show-more tsi-show-more-instance', true)
                    .append('span')
                        .classed('tsi-hierarchyItem', true)
                        .attr('tabindex', 0)
                        .attr("role", "treeitem").attr('aria-expanded', false)
                        .attr('style', `padding-left: ${(data[el].level) * 18 + 20}px`).text(el).on('click keydown', function () {
                    if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                    data[el].onClick();
                });
            } else {
                newListElem = this.createHierarchyItemElem(data[el], el);
                li.node().appendChild(newListElem.node());
            }
            data[el].node = li;
            if (data[el].children) {
                data[el].isExpanded = true;
                data[el].node.classed('tsi-expanded', true);
                data[el].node.attr('aria-expanded', true);
                this.renderTree(data[el].children, data[el].node);
            }
            if (data[el] instanceof HierarchyNode && el !== this.getString("Show More Hierarchies") && this.mode === State.Filter && !data[el].isExpanded) { //expand the last parent node by default to prevent additional click to see the filter results
                newListElem.node().click();
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

    private thenablePathSearchAndRenderResult = ({search: {payload, instancesContinuationToken = null, hierarchiesContinuationToken = null}, render: {target, locInTarget = null, skipLevels = null}}) => {
        this.pathSearch(payload, instancesContinuationToken, hierarchiesContinuationToken).then(r => {
            this.renderSearchResult(r, payload, target, locInTarget, skipLevels);
        })
    }

    private asyncPathSearchAndRenderResult = async ({search: {payload, instancesContinuationToken = null, hierarchiesContinuationToken = null}, render: {target, locInTarget = null, skipLevels = null}}) => {
        const r = await this.pathSearch(payload, instancesContinuationToken, hierarchiesContinuationToken);
        this.renderSearchResult(r, payload, target, locInTarget, skipLevels);
    }

    private pathSearch = (payload, instancesContinuationToken = null, hierarchiesContinuationToken = null) => {
        return this.getToken().then(token => {
            return this.server.getTimeseriesInstancesPathSearch(token, this.environmentFqdn, payload, instancesContinuationToken, hierarchiesContinuationToken);
        });
    }

    private renderSearchResult = (r, payload, target: any, locInTarget = null, skipLevels = null) => {
        let self = this;
        let hierarchyData = {};
        let instancesData = {};
        if (r.hierarchyNodes && r.hierarchyNodes.hits.length) {
            let hitCountElem = target.select(".tsi-hitCount");
            if (hitCountElem.size() == 0) {
                hitCountElem = target.append('span').classed('tsi-hitCount', true).text('');
            }
            hitCountElem.text(r.hierarchyNodes.hitCount);
            hierarchyData = self.fillDataRecursively(r.hierarchyNodes, this.getToken, this.environmentFqdn, payload, payload);
        }
        if (r.instances && r.instances.hits && r.instances.hits.length) {
            r.instances.hits.forEach((i) => {
                instancesData[this.instanceNodeIdentifier(i)] = new InstanceNode(i.timeSeriesId, i.name, self.envTypes[i.typeId], i.hierarchyIds, i.highlights, self.hierarchyNavOptions.onInstanceClick, payload.path.length - self.path.length);
            });
        }
        if (r.instances && r.instances.continuationToken && r.instances.continuationToken !== 'END') {
            let showMoreInstances = new InstanceNode(null, this.getString("Show More Instances"), null, null, null, self.hierarchyNavOptions.onInstanceClick, payload.path.length - self.path.length);
            showMoreInstances.onClick = async () => {
                const response = await self.pathSearch(payload, null, r.instances['continuationToken']);
                this.renderSearchResult(response, payload, showMoreInstances.node.select(function() { return this.parentNode; }), '.tsi-show-more.tsi-show-more-instance');
            }
                
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
    }

    // creates in-depth data object using the server response for hierarchyNodes to show in the tree all expanded, considering UntilChildren
    private fillDataRecursively(hierarchyNodes, getToken, envFqdn, payload, payloadForContinuation = null) {
        let data = {};
        hierarchyNodes.hits.forEach((h) => {
            let hierarchy = new HierarchyNode(h.name, payload.path, payload.path.length - this.path.length, h.cumulativeInstanceCount);
            hierarchy.expand = async () => {
                const r = await this.mode === State.Search ? 
                    this.asyncPathSearchAndRenderResult({search: {payload: this.requestPayload(hierarchy.path)}, render: {target: this.instanceListElem}}) : 
                    this.asyncPathSearchAndRenderResult({search: {payload: this.requestPayload(hierarchy.path)}, render: {target: hierarchy.node}})
                
                hierarchy.isExpanded = true; 
                hierarchy.node.classed('tsi-expanded', true);
                hierarchy.node.attr('aria-expanded', true);
                return r;
            };
            data[this.hierarchyNodeIdentifier(h.name)] = hierarchy;
            if (h.hierarchyNodes && h.hierarchyNodes.hits.length) {
                hierarchy.children = this.fillDataRecursively(h.hierarchyNodes, getToken, envFqdn, this.requestPayload(hierarchy.path), payloadForContinuation);
            }
        });

        if (hierarchyNodes.continuationToken && hierarchyNodes.continuationToken !== 'END') {
            let showMorehierarchy = new HierarchyNode(this.getString("Show More Hierarchies"), payload.path, payload.path.length - this.path.length);
            showMorehierarchy.onClick = () => {
                return this.asyncPathSearchAndRenderResult({search: {payload: (payloadForContinuation ? payloadForContinuation : payload), hierarchiesContinuationToken: hierarchyNodes.continuationToken}, render: {target: showMorehierarchy.node.select(function() { return this.parentNode; }), locInTarget: '.tsi-show-more.tsi-show-more-hierarchy', skipLevels: payloadForContinuation ? payload.path.length - payloadForContinuation.path.length : null}})
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
        let isHierarchyNode = hORi instanceof HierarchyNode;
        let hierarchyItemElem = d3.create('div').classed('tsi-hierarchyItem', true)
            .attr('style', `padding-left: ${hORi.isLeaf ? hORi.level * 18 + 20 : (hORi.level + 1) * 18 + 20}px`)
            .attr('tabindex', 0)
            .attr('arialabel', key)
            .attr('title', key)
            .attr("role", "treeitem").attr('aria-expanded', hORi.isExpanded)
            .on('click keydown', async function() {
                if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                if (!isHierarchyNode) { // means it is an instance
                    d3.event.stopPropagation();
                    self.closeContextMenu();
                    self.clickedInstance = hORi; 
                    let mouseElt = d3.mouse(this as any);
                    let target = self.hierarchyElem.select(function() { return this.parentNode});
                    let mouseWrapper = d3.mouse(target.node());
                    hORi.onClick(target, mouseWrapper[1], mouseElt[1]);
                } else {
                    const a = await hORi.isExpanded ? hORi.collapse() : hORi.expand();
                    return a;
                }
            })
            .on('mouseover focus', function() {
                if (isHierarchyNode) {
                    if (d3.event.relatedTarget != d3.select(this.parentNode).select('.tsi-pin-icon').node()) {
                        (d3.select(this.parentNode).select('.tsi-pin-icon').node() as any).style.visibility = 'visible';
                    }
                }
            })
            .on('mouseleave blur', function() {
                if (isHierarchyNode) {
                    if (d3.event.relatedTarget != d3.select(this.parentNode).select('.tsi-pin-icon').node()) {
                        (d3.select(this.parentNode).select('.tsi-pin-icon').node() as any).style.visibility = 'hidden';
                    }
                }
            });

        if (isHierarchyNode) {
            hierarchyItemElem.append('span').classed('tsi-caret-icon', true).attr('style', `left: ${(hORi.level) * 18 + 20}px`);
            hierarchyItemElem.append('span').classed('tsi-name', true).text(key ? key : '(null)');
            hierarchyItemElem.append('span').classed('tsi-instanceCount', true).text(hORi.cumulativeInstanceCount);
            hierarchyItemElem.append('span').classed('tsi-hitCount', true).text(''); // hit count is the number of hierarchy nodes below, it is filled after expand is clicked for this node (after search is done for this path)

            hierarchyItemElem.append('div').classed('tsi-pin-icon', true).attr('title', this.getString('Add to Filter Path'))
                .attr('tabindex', 0)
                .attr('arialabel', this.getString('Add to Filter Path'))
                .on('click keydown', function() {
                    if (Utils.isKeyDownAndNotEnter(d3.event)) {return; }
                    self.path = hORi.path;
                    let pathListElem = d3.select('.tsi-path-list');
                    pathListElem.text('');
                    let pathToLoop = self.selectedHierarchyName !== HierarchySelectionValues.All ? hORi.path.slice(1) : hORi.path;
                    pathToLoop.forEach((a, i) => {
                        if (i > 0) {
                            pathListElem.append('span').text(' / ');
                        }
                        let pathName = self.hierarchyNodeIdentifier(a);
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
                    if (d3.event.relatedTarget != d3.select((this as HTMLElement).parentNode)) {
                        (this as any).style.visibility = 'hidden';
                    }
                });
        } else {
            let spanElem = hierarchyItemElem.append('span').classed('tsi-name', true);
            if (hORi.highlights) {
                if (hORi.highlights.name) {
                    this.getElemsOfStrippedString(hORi.highlights.name).forEach(s => (spanElem.node() as HTMLElement).appendChild(s));
                } else {
                    this.getElemsOfStrippedString(this.getTsidFromHighlights(hORi.highlights)).forEach(s => (spanElem.node() as HTMLElement).appendChild(s));
                }
            } else {
                spanElem.text(key ? key : '(null)');
            }
            
            if (hORi.highlights) {
                let hitsExist = false;
                let highlightDetails = hierarchyItemElem.append('div').classed('tsi-highlights-detail', true);
                if (hORi.highlights.description && this.hasHits(hORi.highlights.description)) {
                    hitsExist = true;
                    this.getElemsOfStrippedString(hORi.highlights.description).forEach(s => (highlightDetails.node() as HTMLElement).appendChild(s))
                }
                let hitTuples = [];
                if (hORi.highlights.name && this.hasHits(this.getTsidFromHighlights(hORi.highlights))) {
                    hitsExist = true;
                    hitTuples.push([this.getElemsOfStrippedString(this.getString("Time Series ID")), this.getElemsOfStrippedString(this.getTsidFromHighlights(hORi.highlights))])
                }
                hORi.highlights.instanceFieldNames.forEach((ifn, idx) => {
                    var val = hORi.highlights.instanceFieldValues[idx];
                    if (this.hasHits(ifn) || this.hasHits(val)) {
                        hitsExist = true;
                        hitTuples.push([this.getElemsOfStrippedString(ifn), this.getElemsOfStrippedString(hORi.highlights.instanceFieldValues[idx])])
                    }
                });
                let table = highlightDetails.append('table');
                hitTuples.forEach(t => {
                    let row = table.append('tr');
                    let td = row.append('td');
                    t[0].forEach(elem => (td.node() as HTMLElement).appendChild(elem));
                    td = row.append('td');
                    t[1].forEach(elem => (td.node() as HTMLElement).appendChild(elem));  
                });

                if (hitsExist) {
                    highlightDetails.style("display", "block");
                }
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

    private hierarchyNodeIdentifier = (hName) => {
        return hName ? hName : '(' + this.getString("Empty") + ')';
    }

    private instanceNodeIdentifier = (instance) => {
        return instance.name ? instance.name : (instance.timeSeriesId.filter(id => id !== null).length ? instance.timeSeriesId.join(" "): '');
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
        this.setModeAndRequestParamsForNavigate();
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
    this.level = level;
    this.cumulativeInstanceCount = cumulativeInstanceCount;
    this.node = null;
    this.children = null;
    this.isExpanded = false;
    this.collapse = () => {this.isExpanded = false; this.node.classed('tsi-expanded', false); this.node.selectAll('ul').remove();};
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
    this.instancesPageSize = 2;
    this.hierarchiesPageSize = 2;
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