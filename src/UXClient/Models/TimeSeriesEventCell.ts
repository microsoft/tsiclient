class TimeSeriesEventCell {
    public key: string;
    public name: string;
    public type: string;
    public value: any;

	constructor(name: string, value: any, type: string = null){
        this.key = name + "_" + type;
        this.name = name;
        this.type = type;
        this.value = value;
    }
}
export {TimeSeriesEventCell}