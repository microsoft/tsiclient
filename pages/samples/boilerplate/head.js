var sdkJs = document.createElement('script');
sdkJs.src = 'https://unpkg.com/tsiclient@1.2.24/tsiclient.js';
// sdkJs.src = '../../../../dist/tsiclient.js';  // for local testing

var promiseJs = document.createElement('script');
promiseJs.src = 'https://cdnjs.cloudflare.com/ajax/libs/bluebird/3.3.4/bluebird.min.js';

var sdkCss = document.createElement('link');
sdkCss.rel = 'stylesheet';
sdkCss.type = 'text/css';
sdkCss.href = 'https://unpkg.com/tsiclient@1.2.24/tsiclient.css';
// sdkCss.href = '../../../../dist/tsiclient.css';  // for local testing

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


// github link html
var githubUrl = 'https://github.com/Microsoft/tsiclient/tree/master/pages/samples/examples/' + (window.location.href.split('examples/')[1]);
var githubButton = document.createElement('button');
githubButton.setAttribute('onClick', 'window.open("' + githubUrl + '", "_blank")');
githubButton.style.marginBottom = '20px';
githubButton.style.float = 'right';
githubButton.style.fontSize = '16px';
githubButton.innerHTML = 'View on Github';
document.getElementsByTagName('body')[0].prepend(githubButton);