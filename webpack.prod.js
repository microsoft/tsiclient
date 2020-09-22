const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

/* Used to build UMD bundle, associated typings in dist/types, and minified css*/
module.exports = merge(common, {
  mode: 'production',
  devtool: 'source-map',
  plugins: [
    new BundleAnalyzerPlugin({generateStatsFile: true, analyzerMode: 'disabled', statsFilename: '../build_artifacts/umd_stats.json'}),
    new MiniCssExtractPlugin({
      filename: 'tsiclient.min.css'
    })
  ],
  optimization: {
    minimize: true,
    minimizer: [new OptimizeCSSAssetsPlugin({}), new TerserPlugin()],
  },
});