
> nodejs OpenFin Launcher


## Install

```sh
$ npm install --save openfin-launcher
```


## Usage

```js
var openfin-launcher = require('openfin-launcher');

//for a non hosted app.json file
openfin-launcher.launchOpenFin({configPath:'file:/C:/helloWorld/app.json'});

//or a hosted app.json file
openfin-launcher.launchOpenFin({configPath:'http://localhost:5000/app.json'});
```
