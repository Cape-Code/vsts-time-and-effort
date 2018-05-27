var path = require('path');

module.exports = {
    devtool: 'source-map',
    target: "web",

    entry: {
        polyfills: './src/polyfills.ts',
        budgetContextAssign: './src/ContextMenu/AssignBudget.ts',
        budgetGroup: './src/WorkItemForm/BudgetGroup.ts',
        budgetsHub: './src/Reporting/BudgetsHub.ts',
        estimatePage: './src/WorkItemForm/EstimatePage.ts',
        timesGroup: './src/WorkItemForm/TimesGroup.ts',
        timesHub: './src/Reporting/TimesHub.ts',
        timesImport: './src/Settings/TimesImportHub.ts',
        timesPage: './src/WorkItemForm/TimesPage.ts',
        timesSettings: './src/Settings/TimesSettingsHub.ts'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        libraryTarget: "amd",
        filename: 'app.[name].js',
        devtoolModuleFilenameTemplate: "webpack:///[absolute-resource-path]",
    },
    externals: [
        /^VSS\/.*/, /^TFS\/.*/, /^q$/,/^ReleaseManagement\/.*/,
    ],
    resolve: {
        extensions: ["*", ".webpack.js", ".web.js", ".ts", ".tsx", ".js"],
        modules: [path.resolve("./src"), "node_modules"],
    },
    module: {
        rules: [
            {
                test: /\.ts?$/,
                use: "ts-loader",
                exclude: /node_modules/
            },
        ],
    }
};