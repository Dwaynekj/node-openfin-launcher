var exec = require('child_process').exec;
var path = require('path');
var rvmDownloader = require('./rvm-downloader');
var fs = require('fs');
var q = require('q');
var expandOptions = require('./expand-options');
var _ = require('lodash');
var defaultOptions;
var Registry = require('winreg');

// this is equivalent to %localappdata%\OpenFin
function launchOpenFin(options) {
    var deffered = q.defer();
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
                        deffered.reject(error);
                    }
                    deffered.resolve();

                });

            } else {
                console.log('no rvm found at specified location, downloading from ', combinedOpts.rvmUrl);

                rvmDownloader.download(combinedOpts.rvmUrl, path.resolve(combinedOpts.rvmPath))
                    .then(launch)
                    .fail(deffered.reject);
            }
        });
    }

    //Read the Registry for where the RVM should be installed
    var HKLMRegistryPromise = readRegistry('HKLM'), // open registry hive HKEY_LOCAL_MACHINE
        HKCURegistryPromise = readRegistry('HKCU'), // open registry hive HKEY_CURRENT_USER
        registryValue;

    // HKLM Reg values take precendence over HKCU
    // hence they are passed first in the subsequent array
    //q respects the order of the promises called in the returned result
    q.allSettled([HKLMRegistryPromise, HKCURegistryPromise])
        .then(function(results){
            //Returns the Registry keys with the HKLM values first if available
            var keys = [];
            results.forEach(function (result) {
                if (result.state === 'fulfilled') {
                    // This item was loaded!
                    //console.log(result.value);
                    keys.push(result.value);
                } else {
                    // This item failed to be loaded :(
                    //console.log(result.reason);
                }
            });

            if (keys.length > 0){
                keys = _.flattenDeep(keys);
                registryValue = _.find(keys, function (k) {
                    return !!k && (typeof k === "string") && k.length > 0;
                });

                if (registryValue) {
                    defaultAppData = registryValue;
                }
            } else {
                console.log("No registry values found in HKEY_LOCAL_MACHINE or HKEY_CURRENT_USER");
            }

            combinedOpts.rvmPath = path.resolve(defaultAppData, 'OpenFinRVM.exe');
            console.log('RVM install location set to: ' + combinedOpts.rvmPath);

            launch();
        });

    return deffered.promise;
}

function readRegistry(registryAcronym){
    var deferred = q.defer(),
        regKey = new Registry({
            hive: Registry[registryAcronym],
            key:  '\\Software\\Openfin\\RVM\\installDir'
        });

    regKey.values(function (err, items) {
        if (err) {
            //console.log(registryAcronym +' NOT FOUND: '+err);
            deferred.reject(err);
        } else {
            if (items.length > 0){
                deferred.reject();
            }
            deferred.resolve(items);
        }
    });
    return deferred.promise;
}

module.exports = {
    launchOpenFin: launchOpenFin
};

