const path = require('path');
const webpack = require('webpack');
const ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
  entry: './src/TsiClient.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.(scss|css)$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: ['css-loader', 'sass-loader']
        })
      },
      {
        test: /\.(png|jp(e*)g|svg)$/,  
        use: [{
            loader: 'url-loader',
            options: { 
                limit: 8000, // Convert images < 8kb to base64 strings
                name: 'images/[hash]-[name].[ext]'
            } 
        }]
    }
    ]
  },
  devtool: 'source-map',

  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    filename: 'tsiclient.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'umd'
  },
  plugins: [
    new ExtractTextPlugin('tsiclient.css')
  ]
};