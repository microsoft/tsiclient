// import typescript from '@rollup/plugin-typescript';
import typescript from 'rollup-plugin-typescript2';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import serve from 'rollup-plugin-serve'
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss'
import pkg from './package.json';
import {terser} from 'rollup-plugin-terser';
import path from 'path';
var fs = require('fs');

const getPluginConfig = async (prod) => {
    const config = [
        typescript({typescript: require('typescript')}),
        postcss({
            extract: path.resolve('dist/tsiclient.css'),
            extensions: ['.css', 'scss'],
            minimize: prod ? true : false
        }),
        nodeResolve(),
        commonjs(),
        json()
    ]

    // Production specific plugins
    if(prod){
        config.push(terser());
    } else{ 
        // Dev specific plugins
        config.push(serve({
            contentBase: ['pages/examples', 'dist'],
            open: true,
            port: 443,
            host: 'insights-local.timeseries.azure.com',
            https: {
                key: fs.readFileSync('ssl_keys/server.key'),
                cert: fs.readFileSync('ssl_keys/server.cer'),
                ca: fs.readFileSync('ssl_keys/server.csr'),
            }
        }))
    }

    return config;
}

export default async CLIArgs => {
    const prod = !!CLIArgs.configProd;

    // browser-friendly UMD build
    const browserBundle = 
    {
        input: 'src/TsiClient.ts',
        output: {
            file: pkg.browser,
            format: 'umd',
            name: 'TsiClient'
        }
    };

    // Commonjs and ESM builds
    const cjsEsmBundle = 
    {
        input: 'src/TsiIndex.ts',
        output: [
            {
                file: pkg.main,
                format: 'cjs',
                sourcemap: true
            },
            {
                file: pkg.module,
                format: 'es',
                sourcemap: true
            }
        ]
    }
    
    let bundle = [browserBundle]
    
    // Bundle CJS & ESM in prod mode
    if(prod){
        bundle.push(cjsEsmBundle)
    }

    // Add plugins to each bundle config
    bundle.map(async b => b.plugins = await getPluginConfig(prod))
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
    
