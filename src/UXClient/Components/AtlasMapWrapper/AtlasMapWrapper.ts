
export default class AtlasMapWrapper{
    private Atlas: any = null;

    constructor(){}

    public getAtlas = async () => {
        if(this.Atlas) return this.Atlas;
        this.Atlas = await import(/* webpackChunkName: "azure-maps-control" */ "azure-maps-control");
        return this.Atlas;
    }
}