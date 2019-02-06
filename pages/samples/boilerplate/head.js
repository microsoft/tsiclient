var sdkJs = document.createElement('script');
sdkJs.src = 'https://unpkg.com/tsiclient@1.2.24/tsiclient.js';

var promiseJs = document.createElement('script');
promiseJs.src = 'https://cdnjs.cloudflare.com/ajax/libs/bluebird/3.3.4/bluebird.min.js';

var sdkCss = document.createElement('link');
sdkCss.rel = 'stylesheet';
sdkCss.type = 'text/css';
sdkCss.href = 'https://unpkg.com/tsiclient@1.2.24/tsiclient.css';

var metaCharset = document.createElement('meta');
metaCharset.charSet = 'utf-8';

var metaHttp = document.createElement('meta');
metaHttp['http-equiv'] = 'cache-control';
metaHttp.content = 'no-cache';

document.getElementsByTagName('head')[0].appendChild(sdkJs);
document.getElementsByTagName('head')[0].appendChild(promiseJs);
document.getElementsByTagName('head')[0].appendChild(sdkCss);
document.getElementsByTagName('head')[0].appendChild(metaCharset);
document.getElementsByTagName('head')[0].appendChild(metaHttp);