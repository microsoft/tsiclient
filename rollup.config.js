// import typescript from '@rollup/plugin-typescript';
import typescript from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss'
import pkg from './package.json';
import {terser} from 'rollup-plugin-terser';
import path from 'path';
import postcssUrl from "postcss-url";
import analyze from 'rollup-plugin-analyzer'

const getPluginConfig = () => {
    const config = [
        typescript({typescript: require('typescript')}),
        postcss({
            extract: path.resolve('dist/tsiclient.css'),
            plugins: [
                postcssUrl({
                    url: 'inline',
                })
            ],
            minimize: true
        }),
        nodeResolve(),
        commonjs({sourceMap: false}),
        json(),
        terser(),
        analyze({summaryOnly: true, limit: 20})
    ]
    return config;
}

export default (args) => {
    // browser-friendly UMD build
    const browserBundle = 
    {
        input: 'src/tsiclient.ts',
        output: {
            file: path.join('dist', pkg.umd),
            format: 'umd',
            name: 'tsiclient'
        }
    };

    // ESM Component build
    const esmComponentBundle = 
    {
        input: 'src/components.ts',
        output: {
            file: path.join('dist', 'components.js'),
            format: 'es',
            sourcemap: true
        }
    }

    // ESM TsiClient (all-up) build
    const esmTsiClientBundle = {
        input: 'src/tsiclient.ts',
        output: {
            file: path.join('dist', pkg.main),
            format: 'es',
            sourcemap: true
        }
    }
    
    let bundle = [browserBundle, esmComponentBundle, esmTsiClientBundle]
    
    // Add plugins to each bundle config
    bundle.map(b => {
        b.plugins = getPluginConfig();
        //b.external = ['azure-maps-control'] // Mark AzMapCtrl as external dependency
    })
    return bundle;
};