// Set up ADAL
var authContext = new AuthenticationContext({
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