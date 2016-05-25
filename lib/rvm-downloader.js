var https = require('https');
var http = require('http');
var request = require('request');
var path = require('path');
var unzip = require('unzip');
var q = require('q');

function download(url, writePath) {
    var deffered = q.defer(),
        isHttps,
        downloadStream;

    function onError(err) {
        if (isHttps) {
            console.log('HTTPS download failed, trying http');
            getRvm(url.replace('https', 'http'));
        } else {
            deffered.reject(new Error(err));
        }
    }

    function getRvm(rvmUrl) {
        isHttps = rvmUrl.lastIndexOf('https') >= 0;
        downloadStream = isHttps ? https : http;

        request.get(rvmUrl).on('error', onError).pipe(unzip.Extract({
            path: path.dirname(writePath)
        }).on('close', function() {
            deffered.resolve();
        }));
    }

    getRvm(url);

    return deffered.promise;
}

module.exports = {
    download: download
};
