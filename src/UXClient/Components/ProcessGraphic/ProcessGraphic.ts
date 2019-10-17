import * as d3 from 'd3';
import './ProcessGraphic.scss';
import {Component} from "./../../Interfaces/Component";
import { Slider } from '../Slider/Slider';
import { ProcessGraphicTsqExpression } from '../../Models/ProcessGraphicTsqExpression';
import { ServerClient } from '../../../ServerClient/ServerClient';
import { Utils } from '../../Utils';

class TemporalSlider extends Component {
  private slider: Slider;
  private playbackInterval: number;
  private playButtonSelection: d3.Selection<d3.BaseType, unknown, null, undefined>;

  constructor(renderTarget: Element){
    super(renderTarget);
    this.playbackInterval = null;
  }
  
  public render(data: Array<any>, options: any, width: number, selectedLabel: string = null) {
    let targetElement = d3.select(this.renderTarget);
    targetElement.html('');
    
    let self = this;
    let container = targetElement.append('div')
      .classed('tsi-playback-play', true)
      .style('width', '60px')
      .style('height', '60px');
    this.playButtonSelection = container
      .append('button')
      .text('Play')
      .on('click', function() {
        if (self.playbackInterval === null) {
          let timeout = options.playbackInterval || 1000;
          self.playbackInterval = window.setInterval(self.next.bind(self), timeout);
          d3.select(this).text('Pause');
        } else {
          self.pause();
        }
      });

    let sliderContainer = targetElement.append('div')
      .classed('tsi-playback-slider', true)
      .style('height', '60px')
      .style('width', `${width}px`);

    this.slider = new Slider(<any>sliderContainer.node());
    this.slider.render(data, options, width, selectedLabel || data[0].label, this.pause.bind(this));
  }

  public next() {
    this.slider.moveRight();
  }

  public pause() {
    // Pause only if component is in 'play' mode (i.e. an interval has ben set)
    // otherwise, do nothing.
    if (this.playbackInterval !== null) {
      window.clearInterval(this.playbackInterval);
      this.playbackInterval = null;
      this.playButtonSelection.text('Resume');
    }
  }
}

class ProcessGraphic extends Component {
  private targetElement;
  private processGraphic;
  private temporalSlider;
  private xScale: d3.ScaleLinear<number, number>;
  private yScale: d3.ScaleLinear<number, number>;
  private serverClient: ServerClient;
  private validTimeIntervals: Array<string>;
  private currentCancelTrigger;
  private sliderData;
  private image: HTMLImageElement;
  private selectedTimestamp: Date;
  private timeFormatter: Function;

  readonly playbackSliderHeight = 60;

  constructor(renderTarget: Element){ 
    super(renderTarget); 
    this.xScale = null;
    this.yScale = null;
    this.serverClient = new ServerClient();
    this.validTimeIntervals = this.computeValidTimeIntervals();
    this.currentCancelTrigger = null;
    this.processGraphic = null;
  }

  render(environmentFqdn: string, 
    getToken: () => Promise<string>, 
    imageSrc: string, 
    data: Array<ProcessGraphicTsqExpression>, 
    chartOptions) {
    this.chartOptions.setOptions(chartOptions);;
    this.timeFormatter = Utils.timeFormat(true, true, this.chartOptions.offset, true, 0, null, this.chartOptions.dateLocale);

    getToken().then((token: string) => {
      this.serverClient.getAvailability(token, environmentFqdn, '?api-version=2018-11-01-preview')
        .then((availabilityResponse) => {
          let from = new Date(availabilityResponse.availability.range.from);
          let to = new Date(availabilityResponse.availability.range.to);

          let numBuckets = 1000;
          let timeRange = new Utils.TsqRange(from, to);
          timeRange.calculateNeatBucketSize(numBuckets);
          timeRange.snapToServerBuckets();

          // let bucketSize = this.getDimensionAndIntegerForRangeAndBuckets(from.valueOf(), to.valueOf(), 1000);
          // let bucketSizeMillis = Utils.parseTimeInput(bucketSize);

          // let roundedFrom = Utils.adjustStartMillisToAbsoluteZero(from.valueOf(), bucketSizeMillis);
          // let roundedTo = Utils.roundToMillis(to.valueOf(), bucketSizeMillis);

          let sliderTimestamps = [];
          let fromMs = timeRange.from.valueOf();
          let toMs = timeRange.to.valueOf();
          for(let momentInTime = fromMs; momentInTime < toMs; momentInTime += timeRange.bucketSizeMillis) {
            sliderTimestamps.push(new Date(momentInTime));
          }

          this.sliderData = sliderTimestamps.map(ts => {
            let tsqArray = data.map(tsqExpression => {
              tsqExpression.searchSpan = { 
                from: ts.valueOf() - timeRange.bucketSizeMillis, 
                to: ts.valueOf(), 
                bucketSize: timeRange.bucketSizeStr };
              return tsqExpression.toTsq();
            });
            let timeStampLabel = this.timeFormatter(Utils.offsetUTC(ts));

            return {
              label: timeStampLabel,
              action: () => {
                this.selectedTimestamp = timeStampLabel;
                let [promise, cancelTrigger] = this.serverClient.getCancellableTsqResults(token, environmentFqdn, tsqArray);

                // We keep track of the last AJAX call we made to the server, and cancel it if it hasn't finished yet. This is
                // a cheap way to avoid a scenario where we get out-of-order responses back from the server. We can revisit 
                // this at a later time if we need to handle it in a more sophisticated way.
                if (this.currentCancelTrigger) {
                  this.currentCancelTrigger();
                }

                this.currentCancelTrigger = cancelTrigger;

                (promise as Promise<any>).then(results => {
                  let processGraphicData = results.map((r, i) => {
                    return {
                      value: this.getValueFromResult(r),
                      x: data[i].positionX,
                      y: data[i].positionY,
                      color: data[i].color
                    };
                  });

                  this.updateTextLabels(processGraphicData);
                }); 
              }
            };
          });

          this.targetElement = d3.select(this.renderTarget);
          this.targetElement.html('');
          super.themify(this.targetElement, this.chartOptions.theme);

          let graphicContainerWidth = this.renderTarget.clientWidth;
          let graphicContainerHeight = this.renderTarget.clientHeight - this.playbackSliderHeight;

          this.loadImage(imageSrc).then((image: HTMLImageElement) => {
            this.image = image;

            let resizedImageDimensions = this.getAdjustedImageDimensions(
              graphicContainerWidth,
              graphicContainerHeight,
              this.image.width,
              this.image.height);
  
            let processGraphicContainer = this.targetElement.append('div')
              .classed('tsi-process-graphic-container', true)
              .style('width', `${graphicContainerWidth}px`)
              .style('height', `${graphicContainerHeight}px`);

            this.processGraphic = processGraphicContainer.append('div')
              .classed('tsi-process-graphic', true)
              .style('width', `${resizedImageDimensions.width}px`)
              .style('height', `${resizedImageDimensions.height}px`);

            let temporalSliderContainer = this.targetElement.append('div')
              .classed('tsi-temporal-slider-container', true)
              .style('width', `${this.renderTarget.clientWidth}px`)
              .style('height', `${this.playbackSliderHeight}px`);
            this.temporalSlider = new TemporalSlider(<any>temporalSliderContainer.node());
          
            this.draw(resizedImageDimensions.width, resizedImageDimensions.height);

            window.addEventListener('resize', () => {
              this.draw(resizedImageDimensions.width, resizedImageDimensions.height);
            });
          });
        });
    })
  }

  private draw(imageWidth: number, imageHeight: number) {
    this.xScale = d3.scaleLinear()
      .domain([0, 100])
      .range([0, imageWidth]);

    this.yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([0, imageHeight]);

    this.processGraphic.append(() => this.image);

    let sliderWidth = this.renderTarget.clientWidth - 60;
    this.temporalSlider.render(this.sliderData, this.chartOptions, sliderWidth, this.selectedTimestamp);
  }

  private loadImage(imageSrc: string): Promise<HTMLImageElement> {
    return new Promise(function(resolve, reject) {
      let image = new Image();

      image.onload = () => {
        resolve(image);
      }

      image.onerror = (errorMessage) => {
        reject(errorMessage);
      }

      image.src = imageSrc;
    });
  }

  private getAdjustedImageDimensions(containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number) {
    if (containerWidth >= imageWidth && containerHeight >= imageHeight) {
      return {
        width: imageWidth,
        height: imageHeight
      }
    }

    // Calculate the factor we would need to multiply width by to make it fit in the container.
    // Do the same for height. The smallest of those two corresponds to the largest size reduction
    // needed. Multiply both width and height by the smallest factor to a) ensure we maintain the
    // aspect ratio of the image b) ensure the image fits inside the container.
    let widthFactor = containerWidth / imageWidth;
    let heightFactor = containerHeight / imageHeight;
    let resizeFactor = Math.min(widthFactor, heightFactor);

    return {
      width: Math.round(imageWidth * resizeFactor),
      height: Math.round(imageHeight * resizeFactor)
    }
  }

  private updateTextLabels(data) {
    let textElements = this.processGraphic.selectAll('span')
      .data(data);
    textElements.enter()
      .append('span')
      .classed('tsi-process-graphic-label', true)
      .merge(textElements)
      .style('left', (tsqe, i) => `${this.xScale(tsqe.x)}px`)
      .style('top', (tsqe, i) => `${this.yScale(tsqe.y)}px`)
      .text(tsqe => tsqe.value ? Utils.formatYAxisNumber(tsqe.value) : '--')
      .style('color', tsqe => tsqe.color);
  }

  private getDimensionAndIntegerForRangeAndBuckets(zoomMin: number, zoomMax: number, targetBuckets: number) {
    let timeRangeInMillis = Math.max(zoomMax - zoomMin, 1);
    let bucketSizeInMillis = Math.ceil(timeRangeInMillis / targetBuckets);
    let int: number, dim: string;
    if (bucketSizeInMillis < 1000) {
      dim = 'ms';
      int = bucketSizeInMillis;
    }
    else if (bucketSizeInMillis < 1000 * 60) {
      dim = 's';
      int = Math.ceil(bucketSizeInMillis / 1000);
    }
    else if (bucketSizeInMillis < 1000 * 60 * 60) {
      dim = 'm';
      int = Math.ceil(bucketSizeInMillis / (1000 * 60));
    }
    else if (bucketSizeInMillis < 1000 * 60 * 60 * 24) {
      dim = 'h';
      int = Math.ceil(bucketSizeInMillis / (1000 * 60 * 60));
    }
    else {
      dim = 'd';
      int = Math.ceil(bucketSizeInMillis / (1000 * 60 * 60 * 24));
    }
  
    // round to next smallest interval that is a valid interval
    let idx = -1;
    while (idx === -1) {
      idx = this.validTimeIntervals.indexOf(int + dim);
      if (idx === -1) {
        int--;
      }
    }
  
    return this.validTimeIntervals[idx];
  }

  private computeValidTimeIntervals() {
    let validTimeIntervals = [];
    for (let i = 1; i < 1000; i++) {
      if (1000 % i === 0) {
        validTimeIntervals.push(i + 'ms');
      }
    }
    for (let i = 1; i < 60; i++) {
      if (60 % i === 0) {
        validTimeIntervals.push(i + 's');
      }
    }
    for (let i = 1; i < 60; i++) {
      if (60 % i === 0) {
        validTimeIntervals.push(i + 'm');
      }
    }
    for (let i = 1; i < 24; i++) {
      if (24 % i === 0) {
        validTimeIntervals.push(i + 'h');
      }
    }
    for (let i = 1; i < 8; i++) {
      validTimeIntervals.push(i + 'd');
    }
    return validTimeIntervals;
  }

  private getValueFromResult(result) {
    return (result && result.properties && result.properties[0] && result.properties[0].values) 
      ? result.properties[0].values[0] 
      : null;
  }
}

export { ProcessGraphic};