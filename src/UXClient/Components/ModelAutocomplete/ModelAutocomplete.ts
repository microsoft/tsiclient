import * as d3 from 'd3';
import './ModelAutocomplete.scss';
import 'awesomplete';
import { Component } from '../../Interfaces/Component';
import { ChartOptions } from '../../Models/ChartOptions';
import ServerClient from '../../../ServerClient';
import Utils from '../../Utils';

class ModelAutocomplete extends Component{
    public chartOptions: any = new ChartOptions();  // TODO handle onkeyup and oninput in chart options
    public ap: any; // awesomplete object
    private server: ServerClient;

    constructor(renderTarget: Element){ 
        super(renderTarget); 
        this.server = new ServerClient();
    }

    public render(environmentFqdn: string, getToken: any, chartOptions: any){
        this.chartOptions.setOptions(chartOptions);
        let targetElement = d3.select(this.renderTarget);	
        targetElement.html('');	
        let wrapper = targetElement.append('div').attr('class', 'tsi-modelAutocompleteWrapper');
        super.themify(wrapper, this.chartOptions.theme);
        let inputWrapper = wrapper.append("div")
            .attr("class", "tsi-search");
        inputWrapper.append('i').classed('tsi-search-icon', true);
        let input = inputWrapper.append("input")
            .attr("class", "tsi-searchInput")
            .attr("aria-label", this.getString("Search Time Series Instances"))
            .attr("aria-describedby", "tsi-search-desc")
            .attr("role", "combobox")
            .attr("aria-owns", "tsi-search-results")
            .attr("aria-expanded", "false")
            .attr("aria-haspopup", "listbox")
            .attr("placeholder", this.getString("Search Time Series Instances") + '...')
        let clear = inputWrapper.append('div').attr('class', 'tsi-clear')
                    .attr("tabindex", "0").attr("role", "button")
                    .attr("aria-label", "Clear Search")
                    .on('click keydown', function(event) {
                        if (Utils.isKeyDownAndNotEnter(event)) {return; }
                        (input.node() as any).value = ''; 
                        noSuggest = true; 
                        input.dispatch('input'); 
                        self.ap.close(); 
                        d3.select(this).classed('tsi-shown', false); });
        inputWrapper.append('span').attr("id", "tsi-search-desc").style("display", "none").text(this.getString("Search suggestion instruction"));
        inputWrapper.append('div').attr("class", "tsi-search-results-info").attr("aria-live", "assertive");

        let Awesomplete = (window as any).Awesomplete;
        this.ap = new Awesomplete(input.node(), {minChars: 1});
        let noSuggest = false;
        let justAwesompleted = false;
        (input.node() as any).addEventListener('awesomplete-selectcomplete', (event) => {noSuggest = true; input.dispatch('input'); this.ap.close(); justAwesompleted = true;});
        input.on('keydown', (event) => {
            this.chartOptions.onKeydown(event, this.ap);
        });

        (input.node() as any).addEventListener('keyup', function(event){
            if(justAwesompleted){
                justAwesompleted = false;
                return;
            }
            let key = event.which || event.keyCode;
            if(key === 13){
                noSuggest = true;
                input.dispatch('input');
            }
        });

        var searchText;
        var self = this;
        
        input.on('input', function(event) {
            searchText = (<any>this).value;
            if(searchText.replace(/ /g,'') && !noSuggest){
                getToken().then(token => {
                    self.server.getTimeseriesInstancesSuggestions(token, environmentFqdn, searchText).then((r:any) => {
                        self.ap.list = r.suggestions.map(s => s.searchString);
                        self.ap.ul.setAttribute("role", "listbox");
                        self.ap.ul.setAttribute("tabindex", "0");
                        self.ap.ul.setAttribute("id", "tsi-search-results");
                        self.ap.ul.querySelectorAll("li").forEach(li => {li.setAttribute("role", "option"); li.setAttribute("tabindex", "-1")});
                        let liveAria = (document.getElementsByClassName("tsi-search-results-info")[0] as HTMLDivElement);
                        liveAria.innerText = self.ap.suggestions && self.ap.suggestions.length ? self.ap.suggestions.length + self.getString("Search suggestions available") : self.getString("No results");
                        setTimeout(function () {
                            liveAria.innerText = '';
                        }, 1000);
                    })
                })
            }
            else{
                self.ap.close();
            }
            self.chartOptions.onInput(searchText, noSuggest ? {which: 13} : event);
            noSuggest = false;
            clear.classed('tsi-shown', searchText.length);
        })
    }

}

export default ModelAutocomplete;
