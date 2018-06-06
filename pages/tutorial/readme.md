# PLEASE READ BEFORE MAKING CHANGES TO FILES IN THE /TUTORIAL FOLDER

The /tutorial folder exist ONLY on the "tutorial" branch, and is referenced during the build/publishing of   https://docs.microsoft.com/azure articles. The files in /tutorial are static copies of ones on the 'master' branch (which is used to publish the https://insights.timeseries.azure.com/clientsample web app). Because the 'master' branch versions will change independently of the docs articles, this folder allows the articles and source files to stay in sync. 

**If the files in /tutorial are updated, please ensure the corresponding articles are kept in sync, and vice-versa.**

**DO NOT change any file names/locations unless corresponding changes are made to the docs articles and/or publishing config file (.openpublishing.publish.config.json). Just changing a file name/location can cause all OPS builds to fail!**


## INDEX.HTML

Used as:  
- a source code "include" in the [Tutorial: Explore the Time Series Insights JavaScript client library](https://docs.microsoft.com/azure/time-series-insights/tutorial-explore-js-client-lib) article. Specifically, `[!code-javascript]` directives are used to pull in snippets and highlight them as necessary.
- the basis for the build-your-own TSI Sample Application source in the [Tutorial: Create an Azure Time Series Insights single-page web app](https://docs.microsoft.com/azure/time-series-insights/tutorial-create-tsi-sample-spa.md) article. 

## STYLES.CSS

Used as:  
- the basis for the build-your-own TSI Sample Application source in the [Tutorial: Create an Azure Time Series Insights single-page web app](https://docs.microsoft.com/azure/time-series-insights/tutorial-create-tsi-sample-spa.md) article. 
