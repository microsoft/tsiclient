import {ServerClient} from "./ServerClient/ServerClient";
import {UXClient} from "./UXClient/UXClient";
import * as d3 from 'd3';

class TsiClient {
    public server = new ServerClient();
    public ux = new UXClient();
}
export {TsiClient}

(<any>window).TsiClient = TsiClient;

