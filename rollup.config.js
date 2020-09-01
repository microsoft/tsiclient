// import typescript from '@rollup/plugin-typescript';
import typescript from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import url from '@rollup/plugin-url';
import postcss from 'rollup-plugin-postcss'
import pkg from './package.json';
import {terser} from 'rollup-plugin-terser';
import path from 'path';

const getPluginConfig = () => {
    const config = [
        typescript({typescript: require('typescript')}),
        postcss({
            // extract: path.resolve('dist/tsiclient.css'),
            // extensions: ['.css', 'scss'],
            extract: path.resolve('dist/tsiclient.css'),
            modules: true,
            use: ['sass'],
            minimize: true
        }),
        nodeResolve(),
        commonjs({sourceMap: false}),
        json(),
        terser(),
        url({
            limit: 8000,
        }),
    ]
    return config;
}

export default () => {
    // browser-friendly UMD build
    const browserBundle = 
    {
        input: 'src/tsiclient.ts',
        output: {
            file: path.join('dist', pkg.main),
            format: 'umd',
            name: 'tsiclient'
        }
    };

    // ESM builds
    const esmBundle = 
    {
        input: 'src/components.ts',
        output: {
            file: path.join('dist', pkg.module),
            format: 'es',
            sourcemap: true
        }
        
    }
    
    let bundle = [browserBundle, esmBundle]
    
    // Add plugins to each bundle config
    bundle.map(b => b.plugins = getPluginConfig())
    return bundle;
};

// export default 
// {
//     input: 'src/TsiIndex.ts',
//     output: [
//         {
//             file: pkg.main,
//             format: 'es',
//             sourcemap: true
//         },
//         {
//             file: pkg.umd,
//             format: 'umd',
//             name: 'tsiclient',
//             sourcemap: true
//         }
//     ],
//     plugins: [
//         typescript({typescript: require('typescript')}),
//         terser(),
//         postcss({
//             extract: path.resolve('dist/tsiclient.css'),
//             extensions: ['.css', 'scss'],
//             minimize: true
//         }),
//         nodeResolve(),
//         commonjs(),
//         json()
//     ]
// }
    
