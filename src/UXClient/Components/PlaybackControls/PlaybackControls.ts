import * as d3 from 'd3';
import './PlaybackControls.scss';
import { Component } from "./../../Interfaces/Component";

type d3Selection = d3.Selection<d3.BaseType, unknown, null, undefined>;

class PlaybackControls extends Component {
  private playbackInterval: number;
  private playButton: d3Selection;
  private trackPositionToLabelMapper: Function;
  private handleElement: d3Selection;
  private notchPositions: Array<number>;
  private data: Array<any>;
  private controlsContainer: d3Selection;
  private selectedLabelIndex: number;
  private onGetLatest: Function;
  private options;
  private track: d3Selection;
  private trackXOffset: number;
  private trackYOffset: number;
  private trackWidth: number;

  readonly handleRadius: number = 7;

  constructor(renderTarget: Element){
    super(renderTarget);
    this.playbackInterval = null;
    this.selectedLabelIndex = 0;
  }
  
  render(data: Array<any>, options, onGetLatest: Function = null, startingTimestamp = null) {
    this.data = data;
    this.onGetLatest = onGetLatest;
    this.options = options;

    if (startingTimestamp !== null) { 
      this.selectedLabelIndex = this.findClosestTimestamp(startingTimestamp);
    }

    let targetElement = d3.select(this.renderTarget);
    super.themify(targetElement, this.chartOptions.theme);

    targetElement.html('');

    let sliderContainer = targetElement.append('div')
      .classed('tsi-playback-timeline', true);

    let sliderContainerWidth = (<any>sliderContainer.node()).clientWidth;
    let sliderContainerHeight = (<any>sliderContainer.node()).clientHeight;
    this.trackXOffset = this.handleRadius + 8;
    this.trackYOffset = Math.floor(sliderContainerHeight / 2);
    this.trackWidth = sliderContainerWidth - (2 * this.trackXOffset);

    this.notchPositions = data.map((v, index) => {
      if (index === 0) { return 0; }
      if (index === data.length - 1) { return this.trackWidth; }
      return Math.floor((this.trackWidth / data.length) * (index + 0.5));
    });

    let bucketWidthPixels = this.trackWidth / (this.data.length - 1);
    let inputOffset = Math.floor(bucketWidthPixels / 2);
    this.trackPositionToLabelMapper = d3.scaleQuantize()
      .domain([-inputOffset, this.trackWidth + inputOffset])
      .range(d3.range(data.length));
    
    let gWrapper = sliderContainer
      .append('svg')
      .append('g');

    sliderContainer.append('div')
      .classed('tsi-playback-input', true)
      .style('left', `${this.trackXOffset}px`)
      .style('width', `${this.trackWidth}px`)
      .style('height', '100%')

    this.track = gWrapper
      .append('g')
      .classed('tsi-playback-track', true);

    gWrapper.call(d3.drag()
      .container(<any>sliderContainer.select('.tsi-playback-input').node())
      .on('start.interrupt', () => { gWrapper.interrupt(); })
      .on('start drag', () => {
        this.onDrag(d3.event.x);
      })
      .on('end', () => {
        this.onDragEnd();
      })
    );
    
    let handlePosition = this.notchPositions[this.selectedLabelIndex] + this.trackXOffset;

    this.track.append('line')
      .classed('tsi-left-of-handle', true)
      .attr('y1', this.trackYOffset)
      .attr('y2', this.trackYOffset);
    
    this.track.append('line')
      .classed('tsi-right-of-handle', true)
      .attr('y1', this.trackYOffset)
      .attr('y2', this.trackYOffset);

    this.handleElement = gWrapper.append('circle')
      .classed('tsi-playback-handle', true)
      .attr('r', this.handleRadius)
      .attr('cy', this.trackYOffset);

    this.drawTrackAndHandle(handlePosition);

    this.controlsContainer = targetElement.append('div')
      .classed('tsi-playback-buttons', true);
    
    this.playButton = this.controlsContainer.append('button')
      .classed('tsi-play-button', this.playbackInterval === null)
      .classed('tsi-pause-button', this.playbackInterval !== null)
      .on('click', () => {
        if (this.playbackInterval === null) {
          this.play();
        } else {
          this.pause();
        }
      });

    this.controlsContainer.append('span')
      .classed('tsi-playback-timestamp', true)
      .text(data[this.selectedLabelIndex].label);
  }

  get currentTimestamp() {
    return this.data[this.selectedLabelIndex].label;
  }

  next() {
    // If we are already at the timeline, trigger the onGetLatest() callback instead.
    if (this.selectedLabelIndex === this.data.length - 1) {
      if (typeof(this.onGetLatest) === typeof(Function)) {
        this.onGetLatest();
      }
    } else {
      this.selectedLabelIndex++;
      this.setStateFromLabelIndex(this.selectedLabelIndex);
      this.triggerCurrentAction();
    }
  }

  play() {
    if (this.playbackInterval === null) {
      // Default to a 2 second interval if one is not provided. Also, the interval should
      // not be lower than 2 seconds.
      let playbackIntervalMs = Math.max(this.options.playbackIntervalMs || 2000, 2000);

      this.playbackInterval = window.setInterval(this.next.bind(this), playbackIntervalMs);
      this.playButton
      .classed('tsi-play-button', false)
      .classed('tsi-pause-button', true);
    }
  }

  pause() {
    // Pause only if component is in 'play' mode (i.e. an interval has ben set)
    // otherwise, do nothing.
    if (this.playbackInterval !== null) {
      window.clearInterval(this.playbackInterval);
      this.playbackInterval = null;
      this.playButton
        .classed('tsi-play-button', true)
        .classed('tsi-pause-button', false);
    }
  }

  private onDrag(positionX: number) {
    this.pause();
    this.updateHandleSelection(positionX);
  }

  private onDragEnd() {
    this.triggerCurrentAction();
  }

  private updateHandleSelection(positionX: number) {
    this.selectedLabelIndex = this.trackPositionToLabelMapper(positionX);
    this.setStateFromLabelIndex(this.selectedLabelIndex);
  }

  private drawTrackAndHandle(handlePositionX: number) {
    this.track.select('.tsi-left-of-handle')
      .attr('x1', this.trackXOffset)
      .attr('x2', handlePositionX);
  
    this.track.select('.tsi-right-of-handle')
      .attr('x1', handlePositionX)
      .attr('x2', this.trackXOffset + this.trackWidth);

    this.handleElement
      .attr('cx', handlePositionX);
  }

  private setStateFromLabelIndex(labelIndex: number) {
    this.drawTrackAndHandle(this.notchPositions[labelIndex] + this.trackXOffset);

    let tsqExpression = this.data[labelIndex];
    this.controlsContainer
      .select('.tsi-playback-timestamp')
      .text(tsqExpression.label);
  }

  private triggerCurrentAction() {
    let tsqExpression = this.data[this.selectedLabelIndex];
    if (typeof(tsqExpression.action) === typeof(Function)) { tsqExpression.action(); }
  }

  private findClosestTimestamp(timestamp: number | string) {
    if (!this.data || this.data.length === 0) {
      return;
    }

    let asDate = new Date(timestamp);
    let smallestDiff = this.dateDiff(asDate, new Date(this.data[0].label));
    let closestMatchIndex = 0;

    for(let i = 1; i < this.data.length; i++) {
      let diff = this.dateDiff(asDate, new Date(this.data[i].label));
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestMatchIndex = i;
      }
    }

    return closestMatchIndex;
  }

  private dateDiff(date1: Date, date2: Date): number {
    return Math.abs(date1.valueOf() - date2.valueOf());
  }
}

export { PlaybackControls };