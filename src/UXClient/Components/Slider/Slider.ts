import * as d3 from 'd3';
import './Slider.scss';
import Utils from "../../Utils";
import {Component} from "./../../Interfaces/Component";

class Slider extends Component{
    private sliderSVG: any = null;
    public sliderTextDiv: any = null;
    private xScale: any;
    private data;
    private width: number;
    private sliderWidth: number;
    private selectedLabel: string;
    private isAscendingTimePeriods: boolean;

    private margins = {
        left: 60,
        right: 60
    }
    private height = 55;
	
	constructor(renderTarget: Element){
		super(renderTarget);
	}

	Slider() {
    }
    
    private getXPositionOfLabel (label: string) {
        if (this.data.map(d => d.label).indexOf(label) != -1) {
            return this.xScale(label);
        }
        // find approximate position if ascending time periods and label is a time label as well
        if ((Utils.parseTimeInput(label) > -1) && this.isAscendingTimePeriods && this.data.length > 1) {
            let labelMillis = Utils.parseTimeInput(label);
            for (var i = 0; i < this.data.length; i++) {
                if (Utils.parseTimeInput(this.data[i].label) > labelMillis) {
                    return (this.xScale(this.data[i].label) + this.xScale(this.data[Math.max(i - 1, 0)].label)) / 2;
                } 
            }
            return this.xScale(this.data[this.data.length - 1].label);
        }
        return 0;
    }

    private determineIfAscendingTimePeriods () {
        let left = this.data.length > 0 ? Utils.parseTimeInput(this.data[0].label) : -1;
        let isAscending = left !== -1;
        for( let i = 0; isAscending && i < this.data.length - 1; i++) {
            isAscending = left < (left = Utils.parseTimeInput(this.data[i+1].label));
        }
        return isAscending;
    }
	
	public render(data: Array<any>, options: any, width: number, selectedLabel: string = null){
        this.chartOptions.setOptions(options);
        this.data = data;
        this.isAscendingTimePeriods = this.determineIfAscendingTimePeriods();
        this.width = width;
        var marginsTotal = this.margins.left + this.margins.right
        this.sliderWidth = width - marginsTotal;
		var targetElement = d3.select(this.renderTarget);		
		if(targetElement.style("position") == "static")
            targetElement.style("position", "relative");
        if (selectedLabel)
            this.selectedLabel = selectedLabel;

        this.xScale = d3.scalePoint()
            .domain(data.map((d) => d.label))
            .range([0, this.sliderWidth]);

        width = Math.max(width, marginsTotal);
        var self = this;
        
        if (this.sliderSVG == null) {
            this.sliderSVG = targetElement.append("svg")
                .attr("class", "tsi-sliderComponent");
            var slider = this.sliderSVG.append("g")
                .attr("class", "slider tsi-sliderG")
            slider.append("line")
                .attr("class", "slider-track tsi-sliderTrack")
                .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
                .attr("class", "track-overlay tsi-sliderTrackOverlay")
                .call(d3.drag()
                    .on("start.interrupt", function() { slider.interrupt(); })
                    .on("start drag", (event, d) => { 
                        self.onDrag(event.x); 
                    })
                    .on("end", (event, d) => {
                        self.onDragEnd(event.x);
                    })
                );

            slider.insert("circle", ".track-overlay")
                .attr("class", "handle tsi-sliderHandle")
                .attr("r", 6);

            this.sliderTextDiv = targetElement.append("div")
                .attr("class", "tsi-sliderLabel")
                .attr("tabindex", 0)
                .attr("aria-label", selectedLabel)
                .on("keydown", (event) => {
                    if (event.keyCode == 37) {
                        this.moveLeft();
                    }
                    if (event.keyCode == 39) {
                        this.moveRight();
                    }
                });
        }
        this.themify(this.sliderSVG, this.chartOptions.theme);

        this.sliderSVG.attr("width", width + "px");

        var slider = this.sliderSVG.select(".tsi-sliderG")
                                   .attr("transform", "translate(" + this.margins.left + "," + (this.height / 2) + ")");

        slider.select(".tsi-sliderTrack")
            .attr("x1", 0)
            .attr("x2", this.sliderWidth)
            .attr("y1", 0)
            .attr("y2", 0);
        slider.select(".tsi-sliderTrackOverlay")
            .attr("x1", -20)
            .attr("x2", this.sliderWidth + 20)
            .attr("y1", 0)
            .attr("y2", 0);

        this.setStateFromLabel();
    }

    public remove() {
        if(this.sliderSVG)
            this.sliderSVG.remove();
        this.sliderSVG = null;
        if(this.sliderTextDiv)
            this.sliderTextDiv.remove();
    }

    private onDrag (h) {
        // find the closest time and set position to that
        let newSelectedLabel = this.setSelectedLabelAndGetLabelAction(h);        
        if(!this.chartOptions.throttleSlider){
            newSelectedLabel.action(newSelectedLabel.label);
        }

        this.setStateFromLabel(); 
    }

    private onDragEnd (h) {
        if(this.chartOptions.throttleSlider){
            let newSelectedLabel = this.setSelectedLabelAndGetLabelAction(h, true);        
            newSelectedLabel.action(newSelectedLabel.label);
        }
    }

    private setSelectedLabelAndGetLabelAction = (h, useFirstValue = false) => {
        //find the closest time and set position to that
        let reduceFirstValue = useFirstValue ? this.data[0] : {label: this.selectedLabel, action: () => {}};
        var newSelectedLabel = this.data.reduce((prev, curr) => {
            var currDiff = Math.abs(this.getXPositionOfLabel(curr.label) - h);
            var prevDiff = Math.abs(this.getXPositionOfLabel(prev.label) - h);
            return (currDiff < prevDiff) ? curr : prev;
        }, reduceFirstValue);
        this.selectedLabel = (newSelectedLabel != null) ? newSelectedLabel.label : this.selectedLabel;
        return newSelectedLabel;
    }
    
    private setSliderTextDivLabel = () => {
        this.sliderTextDiv.attr("aria-label", () => {
            return this.getString("Currently displayed time is") +  ' ' + this.selectedLabel + ". " + 
                this.getString("Left arrow to go back in time") + ", " + this.getString("right arrow to go forward"); 
        });
    }

    //set the position of the slider and text, and set the text, given a label
    private setStateFromLabel () {
        this.sliderSVG.select(".handle").attr("cx", this.getXPositionOfLabel(this.selectedLabel));
        this.sliderTextDiv.text(this.selectedLabel);
        this.setSliderTextDivLabel();
        //adjust until center lines up with 
        var centerDivOffset = this.sliderTextDiv.node().getBoundingClientRect().width / 2;
        this.sliderTextDiv.style("right", (this.width - (this.margins.right + this.getXPositionOfLabel(this.selectedLabel))) - centerDivOffset + "px");
    }

    private moveLeft () {
        for (var i = 0; i < this.data.length; i++) {
            if (this.data[i].label == this.selectedLabel) {
                var newI = Math.max(0, i - 1);
                this.selectedLabel = this.data[newI].label;
                this.data[newI].action(this.selectedLabel);
                this.setStateFromLabel();
                return;
            }
        }
    }

    private moveRight () {
        for (var i = 0; i < this.data.length; i++) {
            if (this.data[i].label == this.selectedLabel) {
                var newI = Math.min(this.data.length - 1, i + 1);
                this.selectedLabel = this.data[newI].label;
                this.data[newI].action(this.selectedLabel);
                this.setStateFromLabel();
                return;
            }
        }
    }
}

export default Slider
