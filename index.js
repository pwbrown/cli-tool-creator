var term = require('terminal-kit').terminal,
	jsonfile = require('jsonfile'),
	fs = require('fs'),
	notifier = require('node-notifier');

var colors = ['black','red','green','yellow','blue','magenta','cyan','white'];
var colorCodes = {
	black:[0,0,0],
	red:[180,0,0],
	green:[0,180,0],
	yellow:[180,180,0],
	blue:[0,0,180],
	magenta:[180,0,180],
	cyan:[0,180,180],
	white:[220,220,220]
}

//Class Constructor
var cli = module.exports = function(config){
	//Checks for errors
	var failed = this.checkConfigForErrors(config);
	if(!failed){	
		//Holds instance options
		this.options = config.options;
		//User defined menu model
		this.model = config.model;
		//Root key name of model indicating current menu
		this.currentMenu = this.options.start || 'main';
		//Defines the default name of the application to create
		this.defaultAppName = this.options.defaultAppName || null;
		//Holds options to display on menu (stored here for the case of dynamic options)
		this.menuList = null;
		//Array holding navigation stack (navigating will push/pull from stack)
		this.navStack = [];
		//Indicates whether CLI welcome message has displayed
		this.displayedWelcome = false;
		//Indicates whether CLI is in the process of ending execution (prevents race conditions)
		this.isEnding = false;
		//For use with dynamic lists created by objects or arrays to indicate selected option index/key
		this.keyStack = [];
		//Works with key stack to determine if a stack variable should be removed when going to the previous menu
		this.shouldRemoveKey = [];
		//Holds configuration object that cli tool is modifying (Automatically set on run)
		this.config = {};
		//Holds location of config object within the file system (Automatically set on run)
		this.configDir = "";
		this.isEnding = false;
		this.defineColors();
	}else{
		this.isEnding = true;
	}
}


//Initiates start of cli program
cli.prototype.run = function(){
	if(!this.isEnding){
		//Initialize key click listener to allow user to exit at any point
		term.on('key', keyClick);
		term.windowTitle(this.config.appName || this.options.welcomeTitle || "CLI Application");

		//Load/Create an application
		this.loadApplication(function(){
			//Application is ready to use so...
			//Enter fullscreen
			term.fullscreen(true);
			term["bg"+this.backgroundColor[0].toUpperCase() + this.backgroundColor.substring(1)](true);
			term.clear();
			//Begin our Menu Cycle
			this.loadCurrentMenu();
		}.bind(this));
	}
}

//Searches for valid applications using the estimatedDir
cli.prototype.loadApplication = function(cb){
	//Retrieve all file/directory names in estimatedDir
	fs.readdir(this.options.estimatedDir, function(err, files){
		if(typeof err !== 'undefined' && err !== null)
			this.error('File System', 'Could not search estimatedDir', true);
		else{
			var potentialFiles = files.filter(function(item){
				if(item.match(/\.json$/i) && !item.match(/package.json/i)) return true;
			})
			var validApps = this.findValidApplications(potentialFiles);
			//Only one app was found so use it
			if(validApps.length == 1){
				this.config = validApps[0].data;
				this.configDir = validApps[0].dir;
				return cb();
			}
			//Multiple apps found, user chooses
			else if(validApps.length > 1)
				return this.chooseValidApplication(validApps, cb);
			//No apps found, user can create one
			else
				return this.createApplication(cb);
		}
	}.bind(this))
}

//Loads the current menu onto the terminal
cli.prototype.loadCurrentMenu = function(){
	this.setMenuList();          //Load in Options
	this.displayMenuOptions();   //Display Options
	this.selectMenuOption(function(optionNum){
		//GOING BACK
		if(optionNum == this.menuList.length){
			this.currentMenu = (this.navStack.splice(this.navStack.length-1,1))[0];
			var shouldRemove = (this.shouldRemoveKey.splice(this.shouldRemoveKey.length-1,1))[0];
			if(shouldRemove)
				this.keyStack.splice(this.keyStack.length-1,1);
			return this.loadCurrentMenu();
		}else{
			this.handleOptions(this.menuList[optionNum], function(){
				this.loadCurrentMenu();
			}.bind(this))
		}
	}.bind(this));
}

//Displays options in a menu-like form
cli.prototype.displayMenuOptions = function(){
	term["bg"+this.backgroundColor[0].toUpperCase() + this.backgroundColor.substring(1)](true);
	term.clear();
	this.displayWelcomeMessage();
	this.displayStackReference();
	for(var i = 0; i < this.menuList.length; i++){
		var title = this.menuList[i].title || "Title Not Found";
		term[this.menuColor].bold("%d : %s\n", (i+1), this.parseText(title));
	}
	this.displayPrevMenuOption();
	term("\n\n");
}

//User selects menu option and option is returned in callback
cli.prototype.selectMenuOption = function(cb){
	var history = indexHistory(this.menuList.length, ((this.navStack.length > 0)? true : false));
	var max = this.menuList.length;
	if(this.navStack.length > 0) max++;
	this.inputField("Menu Option(Type option # or use up/down keys): ",{
		inputOptions:{
			history:history
		},
		regex: /^[0-9]{1,2}$/,
		error: 'Please enter a valid menu item number',
		int: true,
		max: max,
		min: 1
	}, function(selection){
		term("\n\n");
		return cb(selection-1);
	})
}

//Handles the various options that can be associated with a menu item
cli.prototype.handleOptions = function(item, cb){
	if(item.create || item.insert)
		this.setConfig(item, cb);
	else if(item.pointer){
		if(typeof this.model[item.pointer] !== 'undefined'){
			this.navStack.push(this.currentMenu);
			if(typeof item.thisIndex !== 'undefined'){
				this.keyStack.push(item.thisIndex);
				this.shouldRemoveKey.push(true);
			}else{
				this.shouldRemoveKey.push(false);
			}
			this.currentMenu = item.pointer;
			cb();
		}else{
			this.error('pointer', 'Could not find ' + item.pointer + ' menu', true);
		}
	}
	else{
		cb();
	}
}

//**PROTOTYPE HELPER FUNCTIONS**

cli.prototype.findValidApplications = function(files){
	var validApps = [];
	var baseDir = this.options.estimatedDir;
	for(var i = 0; i < files.length; i++){
		var thisConfig = null;
		try{
			var fileName = (baseDir[baseDir.length-1] == "/")? files[i] : "/" + files[i];
			thisConfig = jsonfile.readFileSync(baseDir + fileName);
		}catch(e){}
		if(thisConfig !== null && typeof thisConfig.searchIdentifier !== 'undefined' && thisConfig.searchIdentifier == 'cli-tool'){
			validApps.push({
				dir: baseDir + fileName,
				data: thisConfig,
				name: thisConfig.appName || fileName
			})
		}
	}
	return validApps;
}

//Allows user to choose a valid application
cli.prototype.chooseValidApplication = function(apps, cb){
	term.fullscreen(true);
	term["bg"+this.backgroundColor[0].toUpperCase() + this.backgroundColor.substring(1)](true);
	term.clear();
	term[this.promptColor].bold.underline("Multiple applications were found in your directory!\n\n");
	term[this.promptColor]("Please choose one of the following to load:\n\n");
	for(var i = 0; i < apps.length; i++)
		term[this.promptColor].bold("%d : Load in \"%s\"", (i+1), apps[i].name);
	term("\n\n");
	this.inputField("Please select an application to load: ", {
		int: true,
		regex: /^[0-9]{1,2}$/,
		error: "Please enter a valid number from the list",
		min: 1,
		max: apps.length
	}, function(appId){
		this.config = apps[appId-1].data;
		this.configDir = apps[appId-1].dir;
		return cb();
	}.bind(this))
}

//Allows user to create a new application
cli.prototype.createApplication = function(cb){
	term.fullscreen(true);
	term["bg"+this.backgroundColor[0].toUpperCase() + this.backgroundColor.substring(1)](true);
	term.clear();
	term[this.promptColor].bold.underline("No Valid Applications were found in our search.\n");
	term[this.promptColor].italic("Tip: If you do have an application, make sure we can find it by including the root attribute \"searchIdentifier\": \"cli-tool\"\n\n");
	this.yesOrNo("Would you like to create a new application? [Y|n]", function(result){
		if(!result){
			term[this.promptColor].bold("Goodbye!!\n\n");
			delay(1, exit);
		}else{
			if(this.defaultAppName !== null && this.defaultAppName !== ''){
				return this.createAppFile(this.defaultAppName, cb);
			}else{
				this.inputField("Please enter a name for your application: ",{
					regex: /^[a-z0-9 ]+$/i,
					error: "Please try again with only alphanumeric characters and spaces"
				}, function(name){
					return this.createAppFile(name, cb);
				}.bind(this))
			}
		}
	}.bind(this))
}

//Final function to create application file
cli.prototype.createAppFile = function(name, cb){
	var app = {searchIdentifier: 'cli-tool', appName: name};
	var fileName = name.toLowerCase().replace(/ /g, "_") + '.json';
	if(this.options.estimatedDir[this.options.estimatedDir.length-1] == "/")
		var fileLoc = this.options.estimatedDir + fileName; 
	else
		var fileLoc = this.options.estimatedDir + "/" + fileName;
	this.config = app;
	this.configDir = fileLoc;
	//Attempt to create new application file
	try{
		jsonfile.writeFileSync(fileLoc, app, {spaces: 2});
	}catch(e){
		return this.error('File System', 'Could not create the application file', true);
	}
	return cb();
}

//Will set this.menuList to valid options or dynamic options of 
cli.prototype.setMenuList = function(){
	var menu = this.model[this.currentMenu];
	if(typeof menu.options == 'string'){
		var options = this.getConfig(menu.options, 'object');
		if(options){
			var optionsArray = [];
			for(var key in options){
				var thisOption = JSON.parse(JSON.stringify(menu));  //Deep copy menu
				thisOption.type = typeof options[key];
				thisOption.parentType = typeof options;
				if(typeof key == 'string')  //For Object
					thisOption.title = key;
				else if(typeof options[key] == 'object' && thisOption.titleKey) //For array of objects
					thisOption.title = options[key][thisOption.titleKey] || 'Title Not Found';
				else if(typeof options[key] == 'string')  //For array with string values
					thisOption.title = options[key];
				else
					thisOption.title = 'Title Not Found';
				thisOption.thisIndex = key;
				optionsArray.push(thisOption);
			}
			return this.menuList = optionsArray;
		}else{
			this.error('Menu List', 'Could not find data for dynamic list');
			return this.menuList = [];
		}
	}else if(typeof menu.options == 'object'){
		return this.menuList = menu.options.filter(function(thisOption){
			return this.hasDependency(thisOption);
		}.bind(this))
	}else{
		return this.error('Options', 'Current Menu is missing an options attribute', true);
	}
}

//Returns keys required for setConfig.  Combination of keyStack and user generated keys
cli.prototype.getKeys = function(options, cb){
	var keyParse = options.loc.match(/(?:\$USER_KEY|\$INDEX)/g);
	if(typeof keyParse !== 'undefined' && keyParse !== null){
		var keysNeeded = keyParse.length - this.keyStack.length;
		if(keysNeeded <= 0)
			return cb(this.keyStack);
		else if(keysNeeded > 1)
			return this.error('User Key', 'Only one key can be generated at a time');
		else if(keysNeeded == 1){
			var prompt = "Enter a key name: ";
			var regex = /^[a-z][a-z0-9]*$/i;
			if(options.regex)
				regex = genRegex(options.regex);
			var error = "Only use alphanumeric characters and key must begin with a letter";
			this.inputField((options.keyPrompt || prompt), {
				regex: regex,
				error: (options.keyError || error)
			}, function(keyName){
				term("\n\n");
				var keys = [];
				keys = keys.concat(this.keyStack);
				keys.push(keyName);
				return cb(keys);
			}.bind(this))
		}
	}else{
		return cb([])
	}
}

//Asks user for an input value using given options
cli.prototype.getValue = function(options, cb){
	var possibleTypes = ['string', 'integer', 'float', 'boolean', 'array', 'object', 'sequence'];
	var type = options.create || options.insert;
	if(typeof type !== 'string' || possibleTypes.indexOf(type.toLowerCase()) == -1)
		type = 'string'; //default to string input
	type = type.toLowerCase();
	if(type == 'sequence')
		this.getSequence(JSON.parse(JSON.stringify(options)), function(sequenceStructure){
			return cb(sequenceStructure);
		});
	else if(type == 'array')
		return cb([]);
	else if(type == 'object')
		return cb({});
	else if(type == 'boolean'){
		var prompt = "Choose your response [Y|n] ";
		this.yesOrNo((options.prompt || prompt), function(response){
			return cb(response);	
		})
	}else if(type == 'string' || type == 'integer' || type == 'float'){
		var regex = /.*/;
		if(options.regex)
			regex = genRegex(options.regex);
		var error = "Invalid input. Please try again.";
		var prompt = "Please enter in " + ((type == 'integer')? "an " : "a ") + type + " value: ";
		var inputOptions = {
			regex: regex,
			error: options.error || error,
			inputOptions:{
				history: options.arrowSelect || []
			}
		}
		if(type == 'integer') inputOptions.int = true;
		else if(type == 'float') inputOptions.float = true;
		if(options.max) inputOptions.max = options.max;
		if(options.min) inputOptions.min = options.min;
		this.inputField((options.prompt || prompt), inputOptions, function(value){
			term("\n\n");
			return cb(value);
		})
	}
}

//Handles multiple value inputs at a time
cli.prototype.getSequence = function(options, cb){
	if(typeof options.sequence == 'undefined' || typeof options.sequence.length == 'undefined'){
		return cb(false);
	}else{
		if(options.sequence.length == 0){
			return cb(options.finalSequence || false);
		}else{
			if(!options.finalSequence) options.finalSequence = {};
			var _this = (options.sequence.splice(0,1))[0];
			if(typeof _this.key !== 'string' || _this.key == ''){
				this.error('Sequence', 'Item is missing a key', true);
				//return cb(false);
			}
			this.getValue(JSON.parse(JSON.stringify(_this)), function(_thisValue){
				if(typeof _thisValue !== 'undefined'){
					options.finalSequence[_this.key] = _thisValue;
				}
				this.getSequence(options, cb);
			}.bind(this));
		}
	}
}

//Parses text to insert or replace content from the config file
cli.prototype.parseText = function(input){
	var formatRegex = /(?:\()([^)]+)(?:\)\{)([^}]+)(?:\})/ig;
	return input.replace(formatRegex, function(orig, display, locations){
		var failed = false;
		display = display.split("|");
		if(typeof display[0] == 'string' && display[0] !== '')
			var successDisplay = display[0];
		if(typeof display[1] == 'string' && display[1] !== '')
			var failureDisplay = display[1];
		locations.split(",").map(function(location, index){
			location = location.trim();
			var value = this.getConfig(location);
			if(typeof value !== 'undefined' && value == false)
				failed = true;
			if(!failed){
				var format = "(([^$])\\$"+(index+1)+"|^\\$"+(index+1)+")";
				var regex = new RegExp(format, 'g');
				successDisplay = successDisplay.replace(regex, function(orig, match, before){
					if(typeof value == 'string' || typeof value == 'number'){
						if(typeof before !== 'undefined')
							return before + value;
						else
							return value;
					}
					else{
						failed = true;
						return "";
					}
				})
			}
		}.bind(this));
		successDisplay = successDisplay.replace("$$", "$");
		if(failed && typeof failureDisplay !== 'undefined')
			return failureDisplay;
		else if(!failed && typeof successDisplay !== 'undefined')
			return successDisplay;
		else
			return "";
	}.bind(this));
}

//Searches through config model for value at specified key mapping
cli.prototype.getConfig = function(keyMap, returnType, preParsedArray){
	if(preParsedArray)
		var map = JSON.parse(JSON.stringify(preParsedArray));
	else{
		var map = keyMap.split(".");  //For nested values
	}
	var currentValue = null;
	var found = true;
	if(map.length == 0) return this.config;
	while(map.length > 0){
		var key = (map.splice(0,1))[0]; //Grab the first key in the current map
		if(currentValue == null) currentValue = this.config;
		//HANDLE DIFFERENT OPTIONS
		if(key == '$SIZE'){  //Make sure size of the 
			var size = objectSize(currentValue);
			if(size > 0)
				return size;
			else
				return false;
		}else if(key == '$EXISTS'){
			if(typeof currentValue !== 'undefined')
				return true;
			else
				return false;
		}else if(key.match(/^\$LIST_(AND|OR)$/)){
			var type = key.match("AND")? 'and' : 'or';
			var list = objectListString(currentValue, type);
			if(list)
				return list;
			else
				return false;
		}
		if(typeof currentValue[key] !== 'undefined')
			currentValue = currentValue[key];
		else{
			found = false;
			break;
		}
	}
	if(!found)
		return false;
	else{
		if(typeof returnType == 'string'){
			if(returnType.toLowerCase() == 'string' && typeof currentValue == returnType.toLowerCase() && currentValue !== "")
				return currentValue;
			else if(typeof returnType == 'string' && typeof currentValue == returnType.toLowerCase())
				return currentValue;
			else
				return false;
		}else{
			return currentValue;
		}
	}
}

//Accepts options to set a configuration value at a certain location ("loc") key mapping
cli.prototype.setConfig = function(options, cb){
	if(typeof options.loc == 'string' && options.loc !== ""){
		this.getKeys(JSON.parse(JSON.stringify(options)), function(keys){
			this.getValue(JSON.parse(JSON.stringify(options)), function(value){
				var failed = false;
				var map = options.loc.split(".");
				map = getArrayKeys(map);
				filled = fillArrayKeys(map, keys);
				var currentValue = null;
				var first = true;
				while(map.length > 0){
					if(currentValue == null) currentValue = value;
					var valueAtKey = this.getConfig(null, null, filled);
					var key = (map.splice((map.length-1),1))[0];  //Grab the last key in the mapping)
					var filledKey = (filled.splice(filled.length-1,1))[0]; //Remove the same key index from filled array as well
					if(key == '$USER_KEY' || key == '$INDEX') key = filledKey;
					var valueBeforeKey = this.getConfig(null, null, filled);
					if(typeof valueAtKey == 'object' && typeof valueAtKey.length !== 'undefined' && options.insert && first){  //Check if we have an array
						first = false;
						var temp = JSON.parse(JSON.stringify(currentValue));
						currentValue = valueAtKey;
						if(typeof options.index === 'number') currentValue.splice(options.index,0,temp);
						else currentValue.push(temp);
					}else if(options.insert && first){
						first = false;
						var temp = JSON.parse(JSON.stringify(currentValue));
						currentValue = [];
						currentValue.push(temp);
					}
					var temp = JSON.parse(JSON.stringify(currentValue));
					if(valueBeforeKey){
						currentValue = valueBeforeKey;
					}else{
						currentValue = {};
					}
					currentValue[key] = temp;
				}
				this.config = currentValue;
				this.saveConfig(function(){
					if(options.message && options.message !== ""){
						this.notify({message: options.message});
					}
					return cb();
				}.bind(this));
			}.bind(this))
		}.bind(this))
	}else{
		this.error('Create/Insert', 'Menu item is missing a \"loc\" option', true);
	}
}

// Will display welcome title and description if not already displayed
cli.prototype.displayWelcomeMessage = function(){
	term["bg"+this.backgroundColor[0].toUpperCase() + this.backgroundColor.substring(1)](true);
	if(!this.displayedWelcome){
		this.displayedWelcome = true;
		if(typeof this.options.welcomeTitle == 'string' && this.options.welcomeTitle !== '')
			term[this.welcomeColor].bold.underline("%s\n\n", this.parseText(this.options.welcomeTitle));
		if(typeof this.options.welcomeDescription == 'string' && this.options.welcomeDescription !== '')
			term[this.welcomeColor].bold.italic("%s\n\n\n", this.parseText(this.options.welcomeDescription));
	}
}

// Will display menu stack reference
cli.prototype.displayStackReference = function(){
	term["bg"+this.backgroundColor[0].toUpperCase() + this.backgroundColor.substring(1)](true);
	var navText = "";
	for(var i = 0; i < this.navStack.length; i++)
		navText += (this.model[this.navStack[i]].title || ("Menu #"+(i+1))) + " -> ";
	var menuTitle = this.model[this.currentMenu].title || ("Menu #" + (this.navStack.length + 1));
	term[this.menuTitleColor].italic.underline("%s",this.parseText(navText));
	term[this.menuTitleColor].bold.underline("%s\n\n",this.parseText(menuTitle));
}

//Will Display Previous Menu Option when nav stack length is non-zero
cli.prototype.displayPrevMenuOption = function(){
	term["bg"+this.backgroundColor[0].toUpperCase() + this.backgroundColor.substring(1)](true);
	if(this.navStack.length > 0){
		term[this.menuColor].bold("%d : Back to Previous Menu\n", (this.menuList.length + 1));
	}
}

//Checks if an option has a valid dependency
cli.prototype.hasDependency = function(option){
	if(option.dependency){
		if(this.getConfig(option.dependency))
			return true;
		else
			return false;
	}else{
		return true;
	}
}

//Handles displaying error to terminal (optional shouldTerminate)
cli.prototype.error = function(label, message, shouldTerminate){
	if(this.backgroundColor)
		term["bg"+this.backgroundColor[0].toUpperCase() + this.backgroundColor.substring(1)](true);
	term.bold.red("\n\n✘ %s ERROR: %s\n\n", label.toUpperCase(), message);
	if(shouldTerminate){
		this.isEnding = true;
		if(this.promptColor)
			term[this.promptColor].bold("CTRL_C to exit immediately\n\n");
		else
			term.blue.bold("CTRL_C to exit immediately\n\n");
		delay(4, exit);
	}
}

// Function to check for valid config object
cli.prototype.checkConfigForErrors = function(config){
	if(typeof config !== 'object'){
		term.on('key', keyClick); //Add key click listener
		this.error('configuration', 'Constructor is missing a configuration object', true);
		return true;
	}
	if(typeof config.model !== 'object'){
		term.on('key', keyClick); //Add key click listener
		this.error('configuration', 'Configuration object is missing a model object', true);
		return true;
	}
	if(typeof config.options !== 'object'){
		term.on('key', keyClick); //Add key click listener
		this.error('configuration', 'Configuration object is missing an options object', true);
		return true;
	}
	if(typeof config.options.estimatedDir !== 'string' || config.options.estimatedDir == ""){
		term.on('key', keyClick); //Add key click listener
		this.error('configuration', 'Configuration object is missing an estimatedDir string in the options object', true);
		return true;
	}
	if((typeof config.options.start == 'string' && typeof config.model[config.options.start] !== 'object') || (typeof config.options.start == 'undefined' && typeof config.model.main !== 'object')){
		term.on('key', keyClick); //Add key click listener
		this.error('configuration', 'Configuration model is missing a starting menu called \"'+((typeof config.options.start == 'string' && typeof config.model[config.options.start] !== 'object')? config.options.start : 'main')+"\"", true);
		return true;
	}
	var start = config.model[(config.options.start || 'main')];
	if(typeof start.options == 'undefined' || typeof start.options.length == 'undefined' || start.options.length == 0){
		term.on('key', keyClick);
		this.error('configuration', 'Starting menu is missing options to display',true);
		return true;
	}
	return false;
}

//Mac and Windows Notifications Function
cli.prototype.notify = function(options){
	var notifOptions = {};
	if(options.message && options.message !== "" && this.options.useNotifier){
		notifOptions.message = options.message;
		if(options.title && options.title !== "") notifOptions.title = options.title;
		else if(this.options.notificationTitle && this.options.notificationTitle !== "") notifOptions.title = this.options.notificationTitle;
		else if(this.config.appName && this.config.appName !== "") notifOptions.title = this.config.appName;
		else notifOptions.title = "Application Tool";
		if(this.options.notificationSound) notifOptions.sound = true;
		if(this.options.notificationIcon && this.options.notificationIcon !== "") notifOptions.icon = this.options.notificationIcon;
		else notifOptions.icon = './cli.png';
		if(typeof this.options.notificationTimeout == 'number') notifOptions.timeout = this.options.notificationTimeout;
		else notifOptions.timeout = 5;
		notifOptions.closeLabel = "Close";
		notifier.notify(notifOptions);
	}
}


//**PROTOTYPE TERMINAL HELPER FUNCTIONS**

//Terminal Boolean prompt (yes = true, no = false)
cli.prototype.yesOrNo = function(prompt, cb){
	term["bg"+this.backgroundColor[0].toUpperCase() + this.backgroundColor.substring(1)](true);
	term[this.promptColor].bold("%s\n\n",prompt);
	term.yesOrNo({yes:['y','Y','ENTER'],no:['N','n']}, function(err, result){
		if(typeof err !== 'undefined' && err !== null){
			this.error('Asking', 'Failed to get user response, please try again');
			return this.yesOrNo(prompt, cb);
		}else{
			if(result)
				cb(true);
			else
				cb(false);
		}
	}.bind(this));
}

//Error Check implementation of inputField
cli.prototype.inputField = function(prompt, options, cb){
	term["bg"+this.backgroundColor[0].toUpperCase() + this.backgroundColor.substring(1)](true);
	term[this.promptColor](true).bold("%s",prompt);
	term.inputField((options.inputOptions || {}), function(err, result){
		if(options.error) var errorMsg = options.error;
		else var errorMsg = "Invalid input, please try again";
		if(typeof err !== 'undefined' && err !== null){
			this.error('input', 'Failed to get user input, try again.');
			this.inputField(prompt, options, cb);
		}else{
			try{result = result.trim()}catch(e){}  //Attempt to trim result
			if(typeof result !== 'undefined' && (!options.regex || (options.regex && result.match(options.regex)))){
				if(options.int || options.float){
					if(options.int) result = parseInt(result);
					else result = parseFloat(result);
					if(isNaN(result) || (options.max && result > options.max) || (options.min && result < options.min)){
						this.error('input', errorMsg);
						return this.inputField(prompt, options, cb);
					}
				}
				cb(result);
			}else{
				this.error('input', errorMsg);
				return this.inputField(prompt, options, cb);
			}
		}
	}.bind(this))
}

//Saves the value currently stored in this.config to the loaded configuration file
cli.prototype.saveConfig = function(cb){
	jsonfile.writeFile(this.configDir, this.config, {spaces: 2}, function(err){
		if(err)
			this.error('File Write', 'Failed to save changes', true);
		else
			cb();
	})
}

//Defines global colors for different parts of the application
cli.prototype.defineColors = function(){
	this.backgroundColor = (typeof this.options.backgroundColor == 'string' && colors.indexOf(this.options.backgroundColor.toLowerCase()) !== -1)? this.options.backgroundColor.toLowerCase() : 'white';
	this.welcomeColor = (typeof this.options.welcomeColor == 'string' && colors.indexOf(this.options.welcomeColor.toLowerCase()) !== -1)? this.options.welcomeColor.toLowerCase() : 'blue';
	this.menuTitleColor = (typeof this.options.menuTitleColor == 'string' && colors.indexOf(this.options.menuTitleColor.toLowerCase()) !== -1)? this.options.menuTitleColor.toLowerCase() : 'blue';
	this.menuColor = (typeof this.options.menuColor == 'string' && colors.indexOf(this.options.menuColor.toLowerCase()) !== -1)? this.options.menuColor.toLowerCase() : 'blue';
	this.promptColor = (typeof this.options.promptColor == 'string' && colors.indexOf(this.options.promptColor.toLowerCase()) !== -1)? this.options.promptColor.toLowerCase() : 'blue';
}


//**NON-PROTOTYPE HELPER FUNCTIONS**

//Turns an object or array into comma seperated string list with spaces and keyword (ex. apples, oranges, peaches, and grapes)
function objectListString(value, type){
	var values = [];
	if(typeof value == 'object'){
		//Get values into an array format of only strings or number values
		for(var key in value){
			if(typeof key == 'string' && !key.match(/^[0-9]+$/)) //For objects
				values.push(key);
			else if(typeof value[key] == 'string' || typeof value[key] == 'number')  //For arrays
				values.push(value[key]);
		}
		var objectList = "";
		//Create objectList
		for(var i = 0; i < values.length; i++){
			if(i == values.length - 1 && values.length > 1)
				objectList += type + " ";
			objectList += values[i];
			if(i !== values.length-1){
				if(values.length > 2)
					objectList += ", ";
				else
					objectList += " ";
			}
		}
		return objectList
	}else{
		return false;
	}
}

//Function to handle all key presses during execution
function keyClick(name, matches, data){
	if(name === 'CTRL_C'){
		exit();
	}
}

//Get the size of an object
var objectSize = function(obj) {
    if(typeof obj !== 'undefined'){
    	if(typeof obj.length !== 'undefined')
    		return obj.length;
    	else
    		return Object.keys(obj).length;
    }
    return 0;
};

//Function to turn array length into array of index number strings (used for inputField History)
function indexHistory(length, prev){
	//Push indexes into array backwards to work properly
	var history = [];
	if(prev) history.push((length+1).toString());
	for(var i = 0; i < length; i++)
		history.push((length-i).toString());
	return history;
}

//Accepts an array of key strings and parses and adds keys related to array syntax
function getArrayKeys(array){
	for(var i = 0; i < array.length; i++){
		var parts = array[i].match(/^(.+)\[(.*)\]$/);
		if(parts !== null){
			array.splice(i,1,parts[1]);
			array.splice((i+1),0,parts[2]);
			i++;
		}
	}
	return array;
}
function fillArrayKeys(map, keys){
	var keyIndex = 0;
	var filledMap = [];
	for(var i = 0; i < map.length; i++){
		if(map[i] == '$INDEX' || map[i] == '$USER_KEY'){
			filledMap.push(keys[keyIndex]);
			keyIndex++;
		}else{
			filledMap.push(map[i]);
		}
	}
	return filledMap;
}

//Function to exit execution
function exit(){
	term.fullscreen(false);
	term.clear();
	process.exit();
}

//Function to generate a regex object from an array ["regex_string", "options"]
function genRegex(regex){
	if(regex.length > 1){
		return new RegExp(regex[0], regex[1]);
	}else if(regex.length == 1){
		return new RegExp(regex[0]);
	}else{
		return /.*/;
	}
}

//Delay function with built in countdown timer (Will execute callback on completion)
function delay(amount, cb){
	term.red.underline("%d...",amount);
	setTimeout(function(){
		if(amount == 0){
			cb();
		}else{
			delay(amount-1, cb);
		}
	},1000);
}