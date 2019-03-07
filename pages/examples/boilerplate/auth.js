var adalJs = document.createElement('script');
adalJs.src = "https://secure.aadcdn.microsoftonline-p.com/lib/1.0.17/js/adal.min.js";

document.getElementsByTagName('head')[0].appendChild(adalJs);

function initAuth(title){

    document.getElementsByTagName('body')[0].innerHTML += `<div id="loginModal" style="display: none">
        <div>
            <span id="api_response"></span>
            <a href="#" onclick="authContext.login(); return false;">Log in</a>
        </div>
    </div>
    <div style="position: absolute; top: 0; width: 100%;">
        <div class="header">
            ${title}
            <pre id="api_response2"></pre>
            <div class="rightSide">
                <div id="username"></div>
                <div class="loginLogout">
                    <p>
                        <a href="#" onclick="authContext.logOut(); return false;">Log out</a>
                    </p>
                </div>
            </div>
        </div>
    </div>`;

    authContext = new AuthenticationContext({
        // clientId: '11a652b9-f29f-40c8-ab29-5ccbe2271823',	
        // postLogoutRedirectUri: 'https://tsiclientsample.azurewebsites.net',
        clientId: '120d688d-1518-4cf7-bd38-182f158850b6',
        postLogoutRedirectUri: 'https://insights.timeseries.azure.com',
        cacheLocation: 'localStorage'
    });

    if (authContext.isCallback(window.location.hash)) {

        // Handle redirect after token requests
        authContext.handleWindowCallback();
        var err = authContext.getLoginError();
        if (err) {
            // TODO: Handle errors signing in and getting tokens
            document.getElementById('api_response').textContent = err;
            document.getElementById('loginModal').style.display = "block";
        }

        } else {
            var user = authContext.getCachedUser();
            if (user) {
                document.getElementById('username').textContent = user.userName;
                
            } else {
                document.getElementById('username').textContent = 'Not signed in.';
            }
        }

    authContext.getTsiToken = function(){
        document.getElementById('api_response2').textContent = 'Getting tsi token...';
        
        // Get an access token to the Microsoft TSI API
        var promise = new Promise(function(resolve,reject){
            authContext.acquireToken(
            'https://api.timeseries.azure.com/',
            function (error, token) {

                if (error || !token) {
                    // TODO: Handle error obtaining access token
                    document.getElementById('api_response').textContent = error;
                    document.getElementById('loginModal').style.display = "block";
                    document.getElementById('api_response2').textContent = '';
                    return;
                }

                // Use the access token
                document.getElementById('api_response').textContent = '';
                document.getElementById('api_response2').textContent = '';
                document.getElementById('loginModal').style.display = "none";
                resolve(token);
                }
            );
        });
        
        return promise;
    }
}