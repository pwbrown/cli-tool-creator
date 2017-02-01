var term = require('terminal-kit').terminal,
	jsonfile = require('jsonfile'),
	fs = require('fs');
var isEnding = false;

//CURRENT OPTIONS
/*
persistHints, start
*/

// CONSTRUCTOR
var cli = module.exports = function(config){
	term.on('key', keyClick);
	if(typeof config !== 'object'){
		error('fatal', 'cli-creator is missing an options object');
	}
	if(typeof config.model !== 'object'){
		error('fatal', 'cli-creator requires a model passed within the options object');
	}
	this.options = (typeof config.options == 'object')? config.options : {};
	this.model = config.model;
	if(typeof this.options.start == 'string' && typeof this.model[this.options.start] == 'object'){
		this.currentMenu = this.options.start;
	}else if(typeof this.model.main == 'object'){
		this.currentMenu = 'main';
	}else{
		error('fatal', 'cli-creator cannot locate starting menu');
	}
	this.navStack = [];  //Store the current navigation stack
	this.hintShown = {};
	this.displayedWelcome = false;
}

// RUN APPLICATION
cli.prototype.run = function(){
	if(!isEnding){
		if(typeof this.options.estimatedDir == 'undefined'){
			error('fatal', 'cli-creator needs an estimated directory to search for valid applications');
		}else{
			this.findConfigFile(function(){ //Will call this.isReady emitter when finished loading config data
				//INITIALIZE FULLSCREEN
				term.fullscreen(true);
				this.menuCycle();
			}.bind(this));
		}
	}
}

// OTHER METHODS - SHOULD NOT BE CALLED AS INDEPENDENT METHOD

//Function to locate or create config file
cli.prototype.findConfigFile = function(cb){
	try{
		var dirList = fs.readdirSync(this.options.estimatedDir);
	}catch(e){
		error('fatal', 'Failed to search the estimated directory');
	}
	dirList = dirList.filter(function(item){
		if(item.match(/\.json$/i) && !item.match(/package/))
			return true;
		else
			return false;
	})
	if(dirList.length > 0){
		var validApps = [];
		for(var i = 0; i < dirList.length; i++){
			var thisConfig = null;
			try{
				var testFile = (this.options.estimatedDir[this.options.estimatedDir.length-1] == "/")? dirList[i] : "/" + dirList[i];
				thisConfig = jsonfile.readFileSync(this.options.estimatedDir + testFile);
			}catch(e){
				//We don't need to do anything
			}
			if(thisConfig !== null && typeof thisConfig.searchIdentifier !== 'undefined' && thisConfig.searchIdentifier == 'cli-tool-creator'){
				validApps.push({
					dir: this.options.estimatedDir + testFile,
					name: thisConfig.appName || "No Name",
					data: thisConfig
				})
			}
		}
		if(validApps.length > 0){
			if(validApps.length == 1){
				//We have a single valid app, so just use it
				this.config = validApps[0].data;
				this.configDir = validApps[0].dir;
				return cb();
			}else{
				return this.chooseApplication(validApps, cb);
			}
		}else{
			this.createApplication(cb);
		}
	}else{
		//ASK TO GENERATE NEW CONFIGURATION FILE
		this.createApplication(cb);
	}

}

//Asks user to choose which application to load in
cli.prototype.chooseApplication = function(apps, cb){
	term.fullscreen(true);
	term.clear();
	term.blue.bold("Multiple Applications were found in your directory!\n\n");
	term.blue("Please choose one of the following to load:\n\n");
	for(var i = 0; i < apps.length; i++){
		term.blue.bold("%d : Load \"%s\"\n",(i+1), apps[i].name);
	}
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
	}.bind(this));
}

//Will Prompt user to create an application and generate a config file
cli.prototype.createApplication = function(cb){
	term.fullscreen(true);
	term.clear();
	term.blue.bold("No Applications were found in our search.\n");
	term.blue("Tip: Make sure your config file contains \"searchIdentifier\": \"cli-tool-creator\"\n\n");
	this.yesOrNo("Would you like to create a new application? [Y|n]", function(result){
		if(!result) return exit();
		else{
			this.inputField("Please Enter a name for your application: ",{
				regex: /^[a-z ]+$/i,
				error: "Please try again with only letters and spaces"
			}, function(name){
				var app = {
					searchIdentifier: 'cli-tool-creator',
					appName: name
				}
				var fileName = name.toLowerCase().replace(" ", "_") + '.json';
				if(this.options.estimatedDir[this.options.estimatedDir.length-1] == "/")
					var fileLocation = this.options.estimatedDir + fileName;
				else
					var fileLocation = this.options.estimatedDir + "/" + fileName;
				this.config = app;
				this.configDir = fileLocation;
				try{
					jsonfile.writeFileSync(fileLocation, app, {spaces: 2});
					return cb();
				}catch(e){
					return error('fatal', 'Could not create application file');
				}
			}.bind(this));
		}
	}.bind(this));
}

//Main Menu Cycling method, will repeat until program is exited
cli.prototype.menuCycle = function(){
	this.displayMenu();
	this.selectMenuOption(function(optionNumber){
		var nextMenu = null;
		var optionsArray = this.model[this.currentMenu].options;
		// Previous Menu Handling
		if(optionNumber == optionsArray.length)
			nextMenu = (this.navStack.splice(this.navStack.length-1, 1))[0];
		else{
			var option = optionsArray[optionNumber];
			if(option.pointer){
				if(typeof this.model[option.pointer] !== 'undefined'){
					nextMenu = option.pointer;
					this.navStack.push(this.currentMenu);
				}else{
					error('fatal', "Model structure for "+option.pointer+" menu was not found");
				}
			}else{
				error('fatal', "Choosen menu option does not have an associated action");
			}
		}

		//Handle Menu Change
		if(nextMenu !== null){
			this.currentMenu = nextMenu;
			this.menuCycle();
		}
	}.bind(this))
}

//Method to display full menu with options and backward navigation
cli.prototype.displayMenu = function(){
	term.clear();
	if(!this.displayedWelcome){
		this.displayedWelcome = true;
		if(typeof this.options.welcomeTitle !== 'undefined')
			term.blue.bold.underline("%s\n\n", this.options.welcomeTitle);
		if(typeof this.options.welcomeDescription !== 'undefined')
			term.blue.bold("%s\n\n\n", this.options.welcomeDescription);
	}
	var menu = this.model[this.currentMenu];
	var navText = ""
	for(var k = 0; k < this.navStack.length; k++){
		navText += (this.model[this.navStack[k]].title || ("Menu #"+(k+1))) + " -> ";
	}
	var menuTitle = menu.title || ("Menu #" + (this.navStack.length + 1));
	term.blue.underline("%s",navText);
	term.blue.bold.underline("%s\n\n",menuTitle);
	var options = menu.options || [];
	if(typeof options == 'object' && typeof options.length !== 'undefined' && options.length > 0){
		var errorFound = false;
		for(var i = 0; i <= options.length; i++){
			if(i == options.length){
				if(this.navStack.length > 0){
					if(this.model[this.navStack[this.navStack.length-1]].title)
						var prevMenuTitle = " (\""+this.model[this.navStack[this.navStack.length-1]].title+"\")";
					else
						var prevMenuTitle = "";
					term.blue.bold("%d : Back to Previous Menu%s\n",(i+1),prevMenuTitle);
				}
			}else{
				if(typeof options[i].title !== 'string')
					errorFound = true;
				term.blue.bold("%d : %s\n", (i+1), (options[i].title || "TITLE NOT FOUND"));
			}
		}
		term("\n\n");
		if(errorFound)
			error('title', 'title was missing for one or more options');
	}else{
		error('menu', 'no options were found for the '+this.currentMenu+'menu');
	}
}

//Method to handle selecting a menu option by parsing number input
cli.prototype.selectMenuOption = function(cb){
	var history = indexHistory(this.model[this.currentMenu].options.length, ((this.navStack.length > 0)? true : false));
	var optionsArray = this.model[this.currentMenu].options;
	var max = optionsArray.length;
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

//Error Check implementation of inputField
cli.prototype.inputField = function(prompt, options, cb){
	term.blue.bold("%s",prompt);
	term.inputField((options.inputOptions || {}), function(err, result){
		if(options.error) var errorMsg = options.error;
		else var errorMsg = "Invalid input, please try again";
		if(typeof err !== 'undefined' && err !== null){
			error('input', 'Failed to get user input, try again.');
			this.inputField(prompt, options, cb);
		}else{
			try{result = result.trim()}catch(e){}  //Attempt to trim result
			if(typeof result !== 'undefined' && result !== '' && (!options.regex || (options.regex && result.match(options.regex)))){
				if(options.int){
					result = parseInt(result);
					if((options.max && result > options.max) || (options.min && result < options.min)){
						error('input', errorMsg);
						return this.inputField(prompt, options, cb);
					}
				}
				cb(result);
			}else{
				error('input', errorMsg);
				return this.inputField(prompt, options, cb);
			}
		}
	}.bind(this))
}

cli.prototype.yesOrNo = function(prompt, cb){
	term.blue.bold("%s\n\n",prompt);
	term.yesOrNo({yes:['y','Y','ENTER'],no:['N','n']}, function(err, result){
		if(typeof err !== 'undefined' && err !== null){
			error('Asking', 'Failed to get user response, please try again');
			return this.yesOrNo(prompt, cb);
		}else{
			if(result)
				cb(true);
			else
				cb(false);
		}
	}.bind(this));
}


//Special parser for conditional string inputs
cli.prototype.parseText = function(txt){
	var edits = [];
	var regex = /(?:\()([^)]+)(?:\)\{)([^}]+)(?:\})/ig;
	return text.replace(regex, function(original, final, options){
		var failed = false;  //If we fail attempt to display default string
		//Organize Options
		var optionsArray = options.split("|");
		var options = {};
		optionsArray.map(function(item){
			var parts = item.split("->");
			if(parts.length >1){
				var args = parts[1].split(",");
				options[parts[0]] = args;
			}
		})
		//Organize Results
		var results = final.split("|");
		if(typeof results[0] !== 'undefined')
			var successResult = results[0];
		if(typeof results[1] !== 'undefined')
			var failureResult = results[1];
		if(typeof options.opt !== 'undefined' && options.opt.length > 0 && typeof options.loc !== 'undefined' && options.loc.length > 0){
			// STRING REPLACE HANDLING
			if(options.opt.indexOf('strReplace') !== -1){
				var newStrings = options.loc.map(function(item, index){
					var string = this.getConfigValue(item, 'string');
					if(string)
						return string;
					else{
						failed = true;
						return "";
					}
				}.bind(this))
				if(failed && typeof failureResult !== 'undefined'){
					return failureResult;
				}else if(!failed && typeof successResult !== 'undefined'){
					return successResult.replace(/\$([0-9]{1,2})/, function(orig, number){
						var number = parseInt(number);
						if(typeof newStrings[number-1] !== 'undefined')
							return newStrings[number-1];
						else
							return "";
					})
				}else{
					return "";
				}
			}
		}
	}.bind(this))
}

//Method to search this.config structure to return value at specified key mapping
cli.prototype.getConfigValue = function(keyMap, type){
	var map = keyMap.split(".");  //For nested objects
	var currentLoc = null;
	var currentValue = null;
	while(map.length > 0){
		var key = (map.splice(0,1))[0];
		if(currentLoc == null) currentLoc = this.config;
		if(typeof currentLoc[key] !== 'undefined')
			currentLoc = currentLoc[key];
		else
			break;
	}
	if(currentLoc == null){
		return false;
	}else{
		if(typeof type == 'string'){
			if(type == 'string' && typeof currentLoc == type && currentLoc !== "")
				return currentLoc;
			else
				return false;
		}else{
			return currentLoc;
		}
	}
}

//Function to handle all key presses during execution
function keyClick(name, matches, data){
	if(name === 'CTRL_C'){
		exit();
	}
}

//Function to turn array length into array of index number strings (used for inputField History)
function indexHistory(length, prev){
	//Push indexes into array backwards to work properly
	var history = [];
	if(prev) history.push((length+1).toString());
	for(var i = 0; i < length; i++)
		history.push((length-i).toString());
	return history;
}

//Function to handle error messages and potential fatal error execution end
function error(type, message){
	term.bold.red("\n\n✘ %s ERROR: %s\n\n", type.toUpperCase(), message);
	if(type.match(/fatal/i)){
		isEnding = true;
		term.blue.bold("CTRL_C to exit immediately\n\n")
		delay(4, exit)
	}else
		return;
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