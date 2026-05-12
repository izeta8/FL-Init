const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/renderer/main.ts',

  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'bundle.js',
  },

  module: {
    rules: [
      {
        test: /\.ts$/,
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
        use: ['style-loader', 'css-loader'],
      },
    ],
  },

  resolve: {
    extensions: ['.ts', '.js', '.css'],
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
        { from: 'src/renderer/styles.css', to: 'styles.css' },
      ],
    }),
  ],

  mode: 'development',

  target: 'electron-renderer',
};