import * as d3 from 'd3';
import './ModelAutocomplete.scss';
import 'awesomplete';
import { Component } from '../../Interfaces/Component';
import { ChartOptions } from '../../Models/ChartOptions';
import { ServerClient } from '../../../ServerClient/ServerClient';

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
            .attr("class", "tsi-modelAutocompleteInputWrapper");
        let input = inputWrapper.append("input")
            .attr("class", "tsi-modelAutocompleteInput")
            .attr("aria-label", "Search Time Series Instances")
            .attr("placeholder", this.getString("Search Time Series Instances") + '...');
        let clear = inputWrapper.append('div').attr('class', 'tsi-clear')
                    .on('click', function(){ (input.node() as any).value = ''; noSuggest = true; input.dispatch('input'); self.ap.close(); d3.select(this).classed('tsi-shown', false); });
        
        let Awesomplete = (window as any).Awesomplete;
        this.ap = new Awesomplete(input.node(), {minChars: 1});
        let noSuggest = false;
        let justAwesompleted = false;
        (input.node() as any).addEventListener('awesomplete-selectcomplete', (event) => {noSuggest = true; input.dispatch('input'); this.ap.close(); justAwesompleted = true;});
        input.on('keydown', () => {
            this.chartOptions.onKeydown(d3.event, this.ap);
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
        
        input.on('input', function() {
            searchText = (<any>this).value;
            if(searchText.replace(/ /g,'') && !noSuggest){
                getToken().then(token => {
                    self.server.getTimeseriesInstancesSuggestions(token, environmentFqdn, searchText).then(r => {
                        self.ap.list = r.suggestions.map(s => s.searchString);
                    })
                })
            }
            else{
                self.ap.close();
            }
            self.chartOptions.onInput(searchText, noSuggest ? {which: 13} : d3.event);
            noSuggest = false;
            clear.classed('tsi-shown', searchText.length);
        })
    }

}

export {ModelAutocomplete}
