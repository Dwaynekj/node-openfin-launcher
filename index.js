var exec = require('child_process').exec,
    os = require('os'),
    isWindows = os.type().toLowerCase().indexOf('windows') !== -1,
    isXP = isWindows && (+os.release().split('.')[0]) < 6,
    nonSupportedOSMessage = 'non windows, launcher not supported.';

//kick out if not in windows
if (!isWindows) {
    console.log(nonSupportedOSMessage);
    process.exit();
}

var path = require('path'),
    rvmDownloader = require('./lib/rvm-downloader'),
    fs = require('fs'),
    _ = require('lodash'),
    q = require('q'),
    Registry = require('winreg'),
    HKCURegKey,
    HKLMRegKey,
    regKeyVals = [],
    xpLocation = '\\Local Settings\\Application Data\\OpenFin',
    eightOrGreater = '\\AppData\\Local\\OpenFin', //at least windows 8 or greater
    defaultAppData;

//Read the Registry for where the RVM should be installed
HKCURegKey = new Registry({
      hive: Registry.HKCU,  // open registry hive HKEY_CURRENT_USER
      key:  '\\Software\\Openfin\\RVM\\installDir'
  });

HKLMRegKey = new Registry({
    hive: Registry.HKLM, // open registry hive HKEY_LOCAL_MACHINE
    key:  '\\Software\\Openfin\\RVM\\installDir'
});

HKCURegKey.values(function (err, items) {
    if (err) {
        console.log('ERROR: '+err);
    } else {
        for (var i=0; i<items.length; i++) {
            console.log('ITEM: '+items[i].name+'\t'+items[i].type+'\t'+items[i].value);
        }
        regKeyVals = items;
    }
});

// HKLM Reg values take precendence over HKCU
HKLMRegKey.values(function (err, items) {
    if (err) {
        console.log('ERROR: '+err);
    } else {
        for (var i=0; i<items.length; i++) {
            console.log('ITEM: '+items[i].name+'\t'+items[i].type+'\t'+items[i].value);
        }
        //Overwrite the HKCU
        if (items.length > 0){
            regKeyVals = items;
        }
    }
});

if (regKeyVals[0] && regKeyVals[0].value) {
    defaultAppData = regKeyVals[0].value;
} else {
    // this is equivalent to %localappdata%\OpenFin
    defaultAppData = path.join(process.env['USERPROFILE'], isXP ? xpLocation : eightOrGreater);
}
var defaultOptions = {
    rvmPath: path.resolve(defaultAppData, 'OpenFinRVM.exe'),
    rvmUrl: 'https://developer.openfin.co/release/rvm/latestVersion', //Get the latest Version
    rvmGlobalCommand: null //this is undocumented, do we still need it?
};

function launchOpenFin(options) {
    var deffered = q.defer();

    // use the options, filling in the defaults without clobbering them
    var combinedOpts = _.defaults(_.clone(options), defaultOptions);

    function launch() {
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

    if (os.type().toLowerCase().indexOf('windows') > -1) {
        launch();
    } else {
        deffered.reject(new Error(nonSupportedOSMessage));
    }

    return deffered.promise;
}

module.exports = {
    launchOpenFin: launchOpenFin,
    downloadRvm: function() {
        return rvmDownloader.download(defaultOptions.rvmUrl);
    }
};
