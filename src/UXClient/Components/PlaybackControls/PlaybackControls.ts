import * as d3 from 'd3';
import './PlaybackControls.scss';
import { Component } from "./../../Interfaces/Component";
import Utils from '../../Utils';
import { TemporalXAxisComponent } from '../../Interfaces/TemporalXAxisComponent';

type d3Selection = d3.Selection<d3.BaseType, unknown, null, undefined>;

interface IPlaybackSettings {
  intervalMillis: number;
  stepSizeMillis: number;
}

class PlaybackControls extends Component {
  private playbackInterval: number;
  private playButton: d3Selection;
  private handleElement: d3Selection;
  private controlsContainer: d3Selection;
  private track: d3Selection;
  private trackXOffset: number;
  private trackYOffset: number;
  private trackWidth: number;
  private timeFormatter: Function;
  private selectedTimeStamp: Date;
  private selectTimeStampCallback: (d: Date) => {};
  private timeStampToPosition: d3.ScaleTime<number, number>;
  private playbackSettings: IPlaybackSettings;
  private end: Date;
  private wasPlayingWhenDragStarted: boolean;

  readonly handleRadius: number = 7;
  readonly minimumPlaybackInterval: number = 1000; // 1 second

  constructor(renderTarget: Element, initialTimeStamp: Date = null){
    super(renderTarget);
    this.playbackInterval = null;
    this.selectedTimeStamp = initialTimeStamp;
  }

  get currentTimeStamp() {
    return this.selectedTimeStamp;
  }
  
  render(
    start: Date, 
    end: Date, 
    onSelectTimeStamp: (d: Date) => {}, 
    options,
    playbackSettings: IPlaybackSettings) {
    this.end = end;
    this.selectTimeStampCallback = onSelectTimeStamp;
    this.chartOptions.setOptions(options);
    this.playbackSettings = playbackSettings;
    this.timeFormatter = Utils.timeFormat(true, false, this.chartOptions.offset, this.chartOptions.is24HourTime, null, null, this.chartOptions.dateLocale)

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

    this.timeStampToPosition = d3.scaleTime()
      .domain([start, end])
      .range([0, this.trackWidth]);

    let timeAxisContainer = sliderContainer.append('div')
      .classed('tsi-playback-axis', true)
      .style('top', `${this.trackYOffset + 6}px`)
      .style('left', `${this.trackXOffset}px`)
      .style('width', `${this.trackWidth}px`);

    let timeAxis = new TimeAxis(<Element>timeAxisContainer.node());
    timeAxis.render(this.chartOptions, this.timeStampToPosition);

    let gWrapper = sliderContainer
      .append('svg')
      .append('g');

    sliderContainer.append('div')
      .classed('tsi-playback-input', true)
      .style('left', `${this.trackXOffset}px`)
      .style('width', `${this.trackWidth}px`);

    this.track = gWrapper
      .append('g')
      .classed('tsi-playback-track', true);

    gWrapper.call(d3.drag()
      .container(<any>sliderContainer.select('.tsi-playback-input').node())
      .on('start.interrupt', () => { gWrapper.interrupt(); })
      .on('start drag', (event) => {
        this.onDrag(event.x);
      })
      .on('end', () => {
        this.onDragEnd();
      })
    );

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
      .style('margin', `0 ${this.trackXOffset}px`);

    this.selectedTimeStamp = this.selectedTimeStamp || start;
    let handlePosition = this.timeStampToPosition(this.selectedTimeStamp);
    this.updateSelection(handlePosition, this.selectedTimeStamp);
  }

  play() {
    if (this.playbackInterval === null) {
      // Default to an interval if one is not provided. Also, the interval should
      // not be lower than the minimum playback interval.
      let playbackIntervalMs = Math.max(this.playbackSettings.intervalMillis || this.minimumPlaybackInterval, this.minimumPlaybackInterval);

      this.next();
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

  next() {
    // If we've reached the end of the available time stamps, do nothing until 
    // the end moves forward.
    if (this.selectedTimeStamp.valueOf() === this.end.valueOf()) {
      return;
    }

    let newValue = this.selectedTimeStamp.valueOf() + this.playbackSettings.stepSizeMillis;
    newValue = Math.min(newValue, this.end.valueOf());
    this.selectedTimeStamp = new Date(newValue);
    
    let handlePosition = this.timeStampToPosition(this.selectedTimeStamp);
    this.updateSelection(handlePosition, this.selectedTimeStamp);

    this.selectTimeStampCallback(this.selectedTimeStamp);
  }

  private clamp(number: number, min: number, max: number) {
    let clamped = Math.max(number, min);
    return Math.min(clamped, max);
  }

  private onDrag(positionX: number) {
    this.wasPlayingWhenDragStarted = this.wasPlayingWhenDragStarted || 
    (this.playbackInterval !== null);
    this.pause();

    let handlePosition = this.clamp(positionX, 0, this.trackWidth);
    this.selectedTimeStamp = this.timeStampToPosition.invert(handlePosition);

    this.updateSelection(handlePosition, this.selectedTimeStamp);
  }

  private onDragEnd() {
    this.selectTimeStampCallback(this.selectedTimeStamp);
    if(this.wasPlayingWhenDragStarted){
      this.play();
      this.wasPlayingWhenDragStarted = false;
    }
  }

  private updateSelection(handlePositionX: number, timeStamp: Date) {
    this.track.select('.tsi-left-of-handle')
      .attr('x1', this.trackXOffset)
      .attr('x2', this.trackXOffset + handlePositionX);
  
    this.track.select('.tsi-right-of-handle')
      .attr('x1', this.trackXOffset + handlePositionX)
      .attr('x2', this.trackXOffset + this.trackWidth);

    this.handleElement
      .attr('cx', this.trackXOffset + handlePositionX);

    this.controlsContainer
      .select('.tsi-playback-timestamp')
      .text(this.timeFormatter(timeStamp));
  }
}

class TimeAxis extends TemporalXAxisComponent {

  constructor(renderTarget: Element) {
    super(renderTarget);
  }

  render(options, timeScale: d3.ScaleTime<number, number>) {
    this.chartOptions.setOptions(options);
    this.x = timeScale;

    if (this.chartOptions.xAxisHidden) { return; }

    let targetElement = d3.select(this.renderTarget);
    targetElement.html('');

    this.chartWidth = (<Element>targetElement.node()).clientWidth;

    this.xAxis = targetElement.append('svg')
      .classed('xAxis', true)
      .data([this.x]);

    this.drawXAxis(0, true, true);
  }
}

export default PlaybackControls