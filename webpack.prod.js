const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = merge(common, {
    mode: 'production',
    devtool: 'source-map',
    optimization: {
        minimize: true,
        minimizer: [new OptimizeCSSAssetsPlugin({}), new TerserPlugin()],
        splitChunks: {
            chunks: 'all',
            maxInitialRequests: Infinity,
            minSize: 0,
            cacheGroups: {
              vendor: {
                test: /[\\/]node_modules[\\/]/,
                name(module) {
                  // get the name. E.g. node_modules/packageName/not/this/part.js
                  // or node_modules/packageName
                  const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
      
                  // npm package names are URL-safe, but some servers don't like @ symbols
                  return `npm.${packageName.replace('@', '')}`;
                },
              },
            },
        }
    },
});