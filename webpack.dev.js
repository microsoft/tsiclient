const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

/* Used to run hot-reloading development server */
module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    contentBase: 'pages/examples',
    public: 't6dev.cloudapp.net:443',
    host: 't6dev.cloudapp.net',
    port: 443,
    https: true
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'tsiclient.css'
    })
  ]
});