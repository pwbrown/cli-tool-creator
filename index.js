var term = require('terminal-kit').terminal,
	jsonfile = require('jsonfile'),
	fs = require('fs');

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
		//Holds options to display on menu (stored here for the case of dynamic options)
		this.menuList = null;
		//Array holding navigation stack (navigating will push/pull from stack)
		this.navStack = [];
		//Indicates whether CLI welcome message has displayed
		this.displayedWelcome = false;
		//Indicates whether CLI is in the process of ending execution (prevents race conditions)
		this.isEnding = false;
		//For use with dynamic lists created by objects or arrays to indicate selected option index/key
		this.objectKey = 0;
		//Holds configuration object that cli tool is modifying (Automatically set on run)
		this.config = {};
		//Holds location of config object within the file system (Automatically set on run)
		this.configDir = "";
	}
}


//Initiates start of cli program
cli.prototype.run = function(){
	//Initialize key click listener to allow user to exit at any point
	term.on('key', keyClick);

	//Load/Create an application
	this.loadApplication(function(){
		//Application is ready to use so...
		//Enter fullscreen
		term.fullscreen(true);
		term.clear();
		//Begin our Menu Cycle
		this.loadCurrentMenu();
	}.bind(this));
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
		term("selected option %d\n", optionNum);
	});
}

//Displays options in a menu-like form
cli.prototype.displayMenuOptions = function(){
	term.clear();
	this.displayWelcomeMessage();
	this.displayStackReference();
	for(var i = 0; i < this.menuList.length; i++){
		var title = this.menuList[i].title || "Title Not Found";
		term.blue.bold("%d : %s\n", (i+1), this.parseText(title));
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
		return cb(selection-1);
	})
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
	term.clear();
	term.blue.bold.underline("Multiple applications were found in your directory!\n\n");
	term.blue("Please choose one of the following to load:\n\n");
	for(var i = 0; i < apps.length; i++)
		term.blue.bold("%d : Load in \"%s\"", (i+1), apps[i].name);
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
	term.clear();
	term.blue.bold.underline("No Valid Applications were found in our search.\n");
	term.blue.italic("Tip: If you do have an application make sure we can find it by including the root attribute \"searchIdentifier\": \"cli-tool\"\n\n");
	this.yesOrNo("Would you like to create a new application? [Y|n]", function(result){
		if(!result){
			term.blue.bold("Goodbye!!\n\n");
			delay(1, exit);
		}else{
			this.inputField("Please enter a name for your application: ",{
				regex: /^[a-z0-9 ]+$/i,
				error: "Please try again with only alphanumeric characters and spaces"
			}, function(name){
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
			}.bind(this))
		}
	}.bind(this))
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
					if(typeof value == 'string'){
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
cli.prototype.getConfig = function(keyMap, returnType){
	var map = keyMap.split(".");  //For nested values
	var currentValue = null;
	var found = true;
	while(map.length > 0){
		var key = (map.splice(0,1))[0]; //Grab the first key in the current map
		if(currentValue == null) currentValue = this.config;
		//HANDLE DIFFERENT OPTIONS
		if(key == '$SIZE'){  //Make sure size of the 
			if(objectSize(currentValue) > 0)
				return true;
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

// Will display welcome title and description if not already displayed
cli.prototype.displayWelcomeMessage = function(){
	if(!this.displayedWelcome){
		this.displayedWelcome = true;
		if(typeof this.options.welcomeTitle == 'string' && this.options.welcomeTitle !== '')
			term.blue.bold.underline("%\n\n", this.parseText(this.options.welcomeTitle));
		if(typeof this.options.welcomeDescription == 'string' && this.options.welcomeDescription !== '')
			term.blue.bold.italic("%s\n\n\n", this.parseText(this.options.welcomeDescription));
	}
}

// Will display menu stack reference
cli.prototype.displayStackReference = function(){
	var navText = "";
	for(var i = 0; i < this.navStack.length; i++)
		navText += (this.model[this.navStack[i]].title || ("Menu #"+(i+1))) + " -> ";
	var menuTitle = this.model[this.currentMenu].title || ("Menu #" + (this.navStack.length + 1));
	term.blue.italic.underline("%s",this.parseText(navText));
	term.blue.bold.underline("%s\n\n",this.parseText(menuTitle));
}

//Will Display Previous Menu Option when nav stack length is non-zero
cli.prototype.displayPrevMenuOption = function(){
	if(this.navStack.length > 0){
		term.blue.bold("%d : Back to Previous Menu\n", (this.menuList.length + 1));
	}
}

//Checks if an option has a valid dependency
cli.prototype.hasDependency = function(option){
	if(option.dependency){
		if(this.getConfigValue(option.dependency))
			return true;
		else
			return false;
	}else{
		return true;
	}
}

//Handles displaying error to terminal (optional shouldTerminate)
cli.prototype.error = function(label, message, shouldTerminate){
	term.bold.red("\n\n✘ %s ERROR: %s\n\n", label.toUpperCase(), message);
	if(shouldTerminate){
		this.isEnding = true;
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
	return false;
}


//**PROTOTYPE TERMINAL HELPER FUNCTIONS**

//Terminal Boolean prompt (yes = true, no = false)
cli.prototype.yesOrNo = function(prompt, cb){
	term.blue.bold("%s\n\n",prompt);
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
	term.blue.bold("%s",prompt);
	term.inputField((options.inputOptions || {}), function(err, result){
		if(options.error) var errorMsg = options.error;
		else var errorMsg = "Invalid input, please try again";
		if(typeof err !== 'undefined' && err !== null){
			this.error('input', 'Failed to get user input, try again.');
			this.inputField(prompt, options, cb);
		}else{
			try{result = result.trim()}catch(e){}  //Attempt to trim result
			if(typeof result !== 'undefined' && result !== '' && (!options.regex || (options.regex && result.match(options.regex)))){
				if(options.int){
					result = parseInt(result);
					if((options.max && result > options.max) || (options.min && result < options.min)){
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

//Function to exit execution
function exit(){
	term.fullscreen(false);
	term.clear();
	process.exit();
}

//Delay function with built in countdown timer (Will execute callback on completion)
function delay(amount, cb){
	term.blue.underline("%d...",amount);
	setTimeout(function(){
		if(amount == 0){
			cb();
		}else{
			delay(amount-1, cb);
		}
	},1000);
}