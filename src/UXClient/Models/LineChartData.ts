import {Utils} from "./../Utils";
import {ChartComponentData} from "./ChartComponentData";

class LineChartData extends ChartComponentData {
    public events: any;
    public states: any;
    public visibleEventsAndStatesCount: number = 0;
    public timeMap: any = {};

    public updateVisibleEventsAndStatesCount () {
        this.visibleEventsAndStatesCount = 0;
        if (this.displayState.events) {
            Object.keys(this.displayState.events).forEach((eventName) => {
                if (this.displayState.events[eventName].visible)
                    this.visibleEventsAndStatesCount += 1;
            });
        }

        if (this.displayState.states) {
            Object.keys(this.displayState.states).forEach((stateName) => {
                if (this.displayState.states[stateName].visible)
                    this.visibleEventsAndStatesCount += 1;
            });
        }
    }

    public setTimeMap () {
        this.timeMap = this.allValues.reduce ((timeMap, currVal) => {
            var millis = currVal.dateTime.valueOf();
            if (currVal.bucketSize != undefined) {
                millis += (currVal.bucketSize / 2);
            }
            if (timeMap[millis] == undefined) {
                timeMap[millis] = [currVal];
            } else {
                timeMap[millis].push(currVal);
            }
            return timeMap;
        }, {});
    }

	constructor(){
        super();
    }

    public mergeDataToDisplayStateAndTimeArrays (data, aggregateExpressionOptions = null, events = null, states = null ) {
        super.mergeDataToDisplayStateAndTimeArrays(data, aggregateExpressionOptions, events, states);
        this.visibleEventsAndStatesCount = 0;
        if (events) {
            this.events = events;
            this.addEntitiesToDisplayState(events, "events");
        }
        if (states) {
            this.states = states;
            this.addEntitiesToDisplayState(states, "states");
        }
    }

    private addEntitiesToDisplayState(entities, typeOfEntity): void {
        var counterMap = {};
        var newEntityDisplayState = {};
        
        entities.forEach((entity: any, i: number) => {
            var entityName: string = Object.keys(entity)[0];
            
            //construct the aggregate key based on the aggregate index and name
            var entityKey;
            if (counterMap[entityName]) {
                entityKey = Utils.createEntityKey(entityName, counterMap[entityName]);
                counterMap[entityName] += 1;
            } else {
                entityKey = Utils.createEntityKey(entityName, 0);
                counterMap[entityName] = 1;
            }

            entity.key = entityKey;

            if (this.displayState[entityKey]) {
                newEntityDisplayState[entityKey] = this.displayState[typeOfEntity][entityKey];
            } else {
                newEntityDisplayState[entityKey] = {
                    visible: true,
                    name: entityName
                }                    
            } 

            if (newEntityDisplayState[entityKey].visible) {
                this.visibleEventsAndStatesCount += 1;
            }
        });
        this.displayState[typeOfEntity] = newEntityDisplayState;
    }
}
export {LineChartData}
