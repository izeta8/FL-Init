const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: './src/renderer/index.tsx',

  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'bundle.js',
  },

  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.renderer.json',
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
      },
    ],
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.css'],
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
    },
    fallback: {
      fs: false,
      path: false,
      child_process: false,
    },
  },

  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'src/renderer/index.html', to: 'index.html' },
      ],
    }),
    new MiniCssExtractPlugin({
      filename: 'styles.css',
    }),
  ],

  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',

  target: 'electron-renderer',

  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',

  devServer: {
    static: {
      directory: path.join(__dirname, 'dist/renderer'),
    },
    port: 3000,
    hot: true,
    historyApiFallback: true,
  },
};