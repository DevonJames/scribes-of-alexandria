const path = require('path');

module.exports = {
    mode: 'development', // or 'production' depending on your environment
    entry: {
        popup: './popup.js',
        background: './background.js',
        contentScript: './contentScript.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].bundle.js'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    resolve: {
        extensions: ['.js'],
    },
};