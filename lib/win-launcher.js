var exec = require('child_process').exec;
var path = require('path');
var rvmDownloader = require('./rvm-downloader');
var fs = require('fs');
var q = require('q');
var expandOptions = require('./expand-options');
var _ = require('lodash');
var Registry = require('regedit');
var OPENFINKEY = 'installDir';

function readRegistry(registryAcronym) {
    var deferred = q.defer(),
        key = registryAcronym+'\\SOFTWARE\\Openfin\\RVM';

    Registry.arch.list(key, function(err, result) {
        if (err) {
            deferred.reject(err);
        } else {
            if (result[key].values && result[key].values[OPENFINKEY] && result[key].values[OPENFINKEY].value) {
                deferred.resolve(result[key].values[OPENFINKEY].value);
            } else {
                deferred.reject();
            }
        }
    })
    return deferred.promise;
}

function launchOpenFin(options) {
    var deferred = q.defer();
    var combinedOpts = expandOptions(options);

    function launch() {
        //TODO:fs.exists is deprecated, need to chenge this at some point.
        fs.exists(path.resolve(combinedOpts.rvmPath), function(exists) {

            if (exists) {

                // change the working dir to either the custom location or the
                // default OpenFin dir in local app data
                process.chdir(path.resolve(path.dirname(combinedOpts.rvmPath)));

                exec('OpenFinRVM.exe --config="' + combinedOpts.configPath + '"', function callback(error) {
                    if (error) {
                        deferred.reject(error);
                    }
                    deferred.resolve();

                });

            } else {
                console.log('no rvm found at specified location, downloading from ', combinedOpts.rvmUrl);

                rvmDownloader.download(combinedOpts.rvmUrl, path.resolve(combinedOpts.rvmPath))
                    .then(launch)
                    .fail(deferred.reject);
            }
        });
    }

    //Read the Registry for where the RVM should be installed
    var HKLMRegistryPromise = readRegistry('HKLM'), // open registry hive HKEY_LOCAL_MACHINE
        HKCURegistryPromise = readRegistry('HKCU'); // open registry hive HKEY_CURRENT_USER

    // HKCUReg values take precendence over HKLM 
    // hence they are passed first in the subsequent array
    //q respects the order of the promises called in the returned result

    q.allSettled([HKCURegistryPromise, HKLMRegistryPromise])
        .then(function(results) {
            var deferred = q.defer();

            //Returns the Registry keys with the HKLM values first if available
            var registryValues = [];
            results.forEach(function(result) {
                if (result.state === 'fulfilled') {
                    // This item was loaded!
                    registryValues.push(result.value);
                } else {
                    // This item failed to be loaded :(
                    console.log(result.reason);
                }
            });
            console.dir(registryValues);
            if (registryValues.length > 0 && registryValues[0]) {
                combinedOpts.rvmPath = path.resolve(registryValues[0], 'OpenFinRVM.exe');

            } else {
                console.log("No registry values found in HKEY_LOCAL_MACHINE or HKEY_CURRENT_USER");
            }

            console.log('RVM install location set to: ' + combinedOpts.rvmPath);

            launch();
        });
    return deferred.promise;
}

module.exports = {
    launchOpenFin: launchOpenFin
};
