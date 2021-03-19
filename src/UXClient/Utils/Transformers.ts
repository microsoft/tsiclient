const transformTsqResultsForVisualization = (tsqResults: Array<any>, options): Array<any> => {
    var result = [];
    tsqResults.forEach((tsqr, i) => {
        var transformedAggregate = {};
        var aggregatesObject = {};
        transformedAggregate[options[i].alias] = {'': aggregatesObject};
        
        if(tsqr.hasOwnProperty('__tsiError__'))
            transformedAggregate[''] = {};
        else{
            tsqr.timestamps.forEach((ts, j) => {
                aggregatesObject[ts] = tsqr.properties.reduce((p,c) => { // there can be multiple values for the same timestamp for a property, here we keep the latest non-null value if exist
                    p[c.name] = aggregatesObject[ts] && aggregatesObject[ts][c.name] !== null ? aggregatesObject[ts][c.name] : c['values'][j]; return p;
                }, {});
            }); 
        }
        result.push(transformedAggregate);
    });
    return result;
}

export { transformTsqResultsForVisualization };