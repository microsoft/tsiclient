import typescript from '@wessberg/rollup-plugin-ts';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import postcss from 'rollup-plugin-postcss'
import postcssUrl from "postcss-url";
import autoExternal from 'rollup-plugin-auto-external';
import visualizer from 'rollup-plugin-visualizer';

/* Used to generate direct import bundle for each component, associated types, and unminified css */
export default {
    input: {
        // TsiClient core
        ServerClient: 'src/ServerClient/ServerClient.ts',
        UXClient: 'src/UXClient/UXClient.ts',
        Utils: 'src/UXClient/Utils/index.ts',
        tsiclient: 'src/TsiClient.ts', // Used to generated correctly referenced tsiclient.d.ts file.  
        
        // Direct component imports 
        LineChart: 'src/UXClient/Components/LineChart/LineChart.ts',
        AvailabilityChart: 'src/UXClient/Components/AvailabilityChart/AvailabilityChart.ts',
        PieChart: 'src/UXClient/Components/PieChart/PieChart.ts',
        ScatterPlot: 'src/UXClient/Components/ScatterPlot/ScatterPlot.ts',
        GroupedBarChart: 'src/UXClient/Components/GroupedBarChart/GroupedBarChart.ts',
        Grid: 'src/UXClient/Components/Grid/Grid.ts',
        Slider: 'src/UXClient/Components/Slider/Slider.ts',
        Hierarchy: 'src/UXClient/Components/Hierarchy/Hierarchy.ts',
        AggregateExpression: 'src/UXClient/Models/AggregateExpression.ts',
        Heatmap: 'src/UXClient/Components/Heatmap/Heatmap.ts',
        EventsTable: 'src/UXClient/Components/EventsTable/EventsTable.ts',
        ModelSearch: 'src/UXClient/Components/ModelSearch/ModelSearch.ts',
        DateTimePicker: 'src/UXClient/Components/DateTimePicker/DateTimePicker.ts',
        TimezonePicker: 'src/UXClient/Components/TimezonePicker/TimezonePicker.ts',
        EllipsisMenu: 'src/UXClient/Components/EllipsisMenu/EllipsisMenu.ts',
        TsqExpression: 'src/UXClient/Models/TsqExpression.ts',
        ModelAutocomplete: 'src/UXClient/Components/ModelAutocomplete/ModelAutocomplete.ts',
        HierarchyNavigation: 'src/UXClient/Components/HierarchyNavigation/HierarchyNavigation.ts',
        SingleDateTimePicker:'src/UXClient/Components/SingleDateTimePicker/SingleDateTimePicker.ts',
        DateTimeButtonSingle: 'src/UXClient/Components/DateTimeButtonSingle/DateTimeButtonSingle.ts',
        DateTimeButtonRange: 'src/UXClient/Components/DateTimeButtonRange/DateTimeButtonRange.ts',
        ProcessGraphic: 'src/UXClient/Components/ProcessGraphic/ProcessGraphic.ts',
        PlaybackControls: 'src/UXClient/Components/PlaybackControls/PlaybackControls.ts',
        ColorPicker: 'src/UXClient/Components/ColorPicker/ColorPicker.ts',
        GeoProcessGraphic: 'src/UXClient/Components/GeoProcessGraphic/GeoProcessGraphic.ts'
    },
    output: {
        dir: 'dist',
        format: 'esm',
        sourcemap: false
    },
    context: "window",
    plugins: [
        nodeResolve(), // Resolve node_module imports
        typescript(), // Compile typescript and associated .d.ts files using tsconfig.json
        autoExternal(), // Auto mark prod dependencies as external
        commonjs(), // Convert cjs imports to esm
        json(), // Handle json file imports
        postcss({ // Convert scss to css and inline svg's
            extract:'tsiclient.css',
            plugins: [
                postcssUrl({
                    url: 'inline',
                })
            ],
            minimize: false,
            sourceMap: false
        }),    
        visualizer({filename: 'build_artifacts/esm_stats.html'}) // Generate esm bundle stats
    ]
};