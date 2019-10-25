import * as d3 from 'd3';
import './ProcessGraphic.scss';
import { Component } from "./../../Interfaces/Component";
import { PlaybackControls } from '../PlaybackControls/PlaybackControls';
import { ServerClient } from '../../../ServerClient/ServerClient';
import { Utils } from '../../Utils';
import { TsqExpression } from '../../Models/TsqExpression';

type d3Selection = d3.Selection<d3.BaseType, unknown, null, undefined>;

class ProcessGraphic extends Component {
  private targetElement: d3Selection;
  private tsqExpressions: Array<TsqExpression>;
  private processGraphicContainer: d3Selection;
  private processGraphic: d3Selection;
  private playbackControlsContainer: d3Selection;
  private playbackControls: PlaybackControls;
  private serverClient: ServerClient;
  private currentCancelTrigger: Function;
  private sliderData: Array<any>;
  private image: HTMLImageElement;
  private imageOriginalWidth: number;
  private imageOriginalHeight: number;
  private timeFormatter: Function;
  private availabilityInterval: number;
  private environmentFqdn: string;
  private availabilityFrom: Date;
  private availabilityTo: Date;
  private getLatestCallback: Function;

  readonly numberOfBuckets = 1000;
  readonly fetchAvailabilityFrequency = 30000; // 30 seconds
  readonly playbackSliderHeight = 72;
  readonly previewApiFlag = '?api-version=2018-11-01-preview';

  constructor(renderTarget: Element){ 
    super(renderTarget); 
    this.serverClient = new ServerClient();
    this.currentCancelTrigger = null;
  }

  render(environmentFqdn: string, 
    getToken: () => Promise<string>, 
    imageSrc: string, 
    data: Array<TsqExpression>, 
    chartOptions) {
    this.environmentFqdn = environmentFqdn;
    this.tsqExpressions = data;
    this.chartOptions.setOptions(chartOptions);
    this.timeFormatter = Utils.timeFormat(true, true, this.chartOptions.offset, true, 0, null, this.chartOptions.dateLocale);

    getToken().then((authToken: string) => {
      this.getLatestCallback = this.getLatest.bind(this, authToken);
      this.serverClient.getAvailability(authToken, this.environmentFqdn, this.previewApiFlag)
        .then(availabilityResponse => {

          if (!this.availabilityInterval) {
            this.availabilityInterval = window.setInterval(this.pollAvailability.bind(this, authToken), this.fetchAvailabilityFrequency);
          }

          let { from, to } = this.parseAvailabilityResponse(availabilityResponse);

          this.availabilityFrom = from;
          this.availabilityTo = to;
          this.updatePlaybackControlsData(authToken);

          this.targetElement = d3.select(this.renderTarget);
          this.targetElement.html('');
          this.targetElement.classed('tsi-process-graphic-target', true);
          super.themify(this.targetElement, this.chartOptions.theme);

          this.loadImage(imageSrc).then((image: HTMLImageElement) => {
            this.image = image;
            this.imageOriginalWidth = this.image.width;
            this.imageOriginalHeight = this.image.height;
  
            this.processGraphicContainer = this.targetElement
              .append('div')
              .classed('tsi-process-graphic-container', true);

            this.processGraphic = this.processGraphicContainer
              .append('div')
              .classed('tsi-process-graphic', true);

            this.processGraphic.append(() => this.image);

            this.playbackControlsContainer = this.targetElement
              .append('div')
              .classed('tsi-playback-controls-container', true);

            this.playbackControls = new PlaybackControls(<any>this.playbackControlsContainer.node());
          
            this.draw();

            window.addEventListener('resize', () => {
              this.draw();
            });
          });
        })
        .catch(reason => {
          console.error(`Failed while fetching data availability: ${reason}`);
        });
    })
  }

  pauseAvailabilityUpdates() {
    if(this.availabilityInterval) {
      window.clearInterval(this.availabilityInterval);
    }
  }

  private async pollAvailability(authToken: string): Promise<boolean> {
    return this.serverClient.getAvailability(authToken, this.environmentFqdn, this.previewApiFlag)
      .then(availabilityResponse => {
        let { from, to } = this.parseAvailabilityResponse(availabilityResponse);

        if (from.valueOf() !== this.availabilityFrom.valueOf() || 
          to.valueOf() !== this.availabilityTo.valueOf()) {
          this.availabilityFrom = from;
          this.availabilityTo = to;
          this.updatePlaybackControlsData(authToken);

          this.playbackControls.render(
            this.sliderData, 
            this.chartOptions, 
            this.getLatestCallback,
            this.playbackControls.currentTimestamp);
          
          return true;
        }

        return false;
      })
      .catch(reason => {
        console.log(`Failed to update data availability: ${reason}`);
      });
  }

  private updatePlaybackControlsData(authToken: string) {
    let timeRange = new Utils.TsqRange(this.availabilityFrom, this.availabilityTo);
    timeRange.calculateNeatBucketSize(this.numberOfBuckets);
    timeRange.snapToServerBuckets();

    let sliderTimestamps = [];
    let fromMs = timeRange.from.valueOf();
    let toMs = timeRange.to.valueOf();
    for(let momentInTime = fromMs; momentInTime < toMs; momentInTime += timeRange.bucketSizeMillis) {
      sliderTimestamps.push(new Date(momentInTime));
    }

    this.sliderData = sliderTimestamps.map(ts => this.generateSliderDataElement(ts, timeRange, authToken));
  }

  private async getLatest(authToken: string): Promise<any> {
    return this.pollAvailability(authToken)
      .then((availbilityHasChanged: boolean) => {
        if (availbilityHasChanged && this.sliderData.length > 0) {
          // Trigger the last action of the slider data, which will set the 
          // process graphic text labels to the values at the latest timestamp
          let getLatestDataHandler = this.sliderData[this.sliderData.length - 1].action;
          if(typeof(getLatestDataHandler) === typeof(Function)) {
            getLatestDataHandler();
          }
        }
      });
  }

  private generateSliderDataElement( 
    timeStamp: Date,
    sliderTimeRange,
    authToken: string) {
    let tsqArray = this.tsqExpressions.map(tsqExpression => {
      tsqExpression.searchSpan = { 
        from: timeStamp.valueOf() - sliderTimeRange.bucketSizeMillis, 
        to: timeStamp.valueOf(), 
        bucketSize: sliderTimeRange.bucketSizeStr };
      return tsqExpression.toTsq();
    });

    let timeStampLabel = this.timeFormatter(Utils.offsetUTC(timeStamp));
    return {
      label: timeStampLabel,
      action: () => {
        let [promise, cancelTrigger] = this.serverClient.getCancellableTsqResults(authToken, this.environmentFqdn, tsqArray);

        // We keep track of the last AJAX call we made to the server, and cancel it if it hasn't finished yet. This is
        // a cheap way to avoid a scenario where we get out-of-order responses back from the server during 'play' mode.
        // We can revisit this at a later time if we need to handle it in a more sophisticated way.
        if (this.currentCancelTrigger) {
          this.currentCancelTrigger();
        }

        this.currentCancelTrigger = <Function>cancelTrigger;

        (promise as Promise<any>).then(results => {
          let processGraphicData = results.map((r, i): ProcessGraphicLabelInfo => {
            return {
              value: this.parseTsqResponse(r),
              alias: this.tsqExpressions[i].alias,
              x: this.tsqExpressions[i].positionX,
              y: this.tsqExpressions[i].positionY,
              color: this.tsqExpressions[i].color
            };
          });

          this.updateTextLabels(processGraphicData);
        }); 
      }
    };
  }

  private draw() {
    let graphicContainerWidth = this.renderTarget.clientWidth;
    let graphicContainerHeight = this.renderTarget.clientHeight - this.playbackSliderHeight;

    this.processGraphicContainer
      .style('width', `${graphicContainerWidth}px`)
      .style('height', `${graphicContainerHeight}px`);

    let resizedImageDim = this.getResizedImageDimensions(
      graphicContainerWidth,
      graphicContainerHeight,
      this.imageOriginalWidth,
      this.imageOriginalHeight);

    this.processGraphic
      .style('width', `${resizedImageDim.width}px`)
      .style('height', `${resizedImageDim.height}px`);

    this.playbackControlsContainer
      .style('width', `${this.renderTarget.clientWidth}px`)
      .style('height', `${this.playbackSliderHeight}px`);

    this.playbackControls.render(this.sliderData, this.chartOptions, this.getLatestCallback);
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

  private getResizedImageDimensions(containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number) {
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
      width: imageWidth * resizeFactor,
      height: imageHeight * resizeFactor
    }
  }

  private updateTextLabels(graphicValues: Array<ProcessGraphicLabelInfo>) {
    let textElements = this.processGraphic.selectAll('div')
      .data(graphicValues);

    let newElements = textElements.enter()
      .append('div')
      .classed('tsi-process-graphic-label', true);

    newElements.append('div')
      .classed('title', true);

    newElements.append('div')
      .classed('value', true);

    newElements.merge(textElements)
      .classed('tsi-dark', false)
      .classed('tsi-light', false)
      .classed(Utils.getTheme(this.chartOptions.theme), true)
      .style('left', tsqe => `${tsqe.x}%`)
      .style('top', tsqe => `${tsqe.y}%`);

    this.processGraphic.selectAll('.title')
      .data(graphicValues)
      .text(tsqe => tsqe.alias || '');

    this.processGraphic.selectAll('.value')
      .data(graphicValues)
      .text(tsqe => tsqe.value ? Utils.formatYAxisNumber(tsqe.value) : '--')
      .style('color', tsqe => tsqe.color);
  }

  private parseAvailabilityResponse(response) {
    let range = response && response.availability && response.availability.range;
    let from = (range && range.from && new Date(range.from)) || null;
    let to = (range && range.to && new Date(range.to)) || null;

    if (from === null || to === null) {
      throw 'Query to get availability returned a response with an unexpected structure';
    }

    return { from, to };
  }

  private parseTsqResponse(response) {
    return (response && response.properties && response.properties[0] && response.properties[0].values) 
      ? response.properties[0].values[0] 
      : null;
  }
}

interface ProcessGraphicLabelInfo {
  value: number,
  alias: string,
  x: number,
  y: number,
  color: string
}

export { ProcessGraphic };