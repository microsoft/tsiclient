const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'inline-source-map',
    devServer: {
        contentBase: 'pages/examples',
        public: 'insights-local.timeseries.azure.com:443',
        host: 'insights-local.timeseries.azure.com',
        port: 443,
        https: true
    },
});