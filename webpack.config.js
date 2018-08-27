const path = require('path')

module.exports = {
  devtool: 'source-map',
  entry: './src/index.js',
  output: {
    library: 'ExtractGifFrames',
    libraryTarget: 'umd',
    path: path.resolve('index.js')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  }
}
