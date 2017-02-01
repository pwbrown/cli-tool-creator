var term = require('terminal-kit').terminal,
	jsonfile = require('jsonfile');
var isEnding = false;

//CURRENT OPTIONS
/*
persistHints, start
*/

// CONSTRUCTOR
var cli = module.exports = function(config){
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
	if(typeof this.options.configFile == 'undefined'){
		error('fatal', 'cli-creator cannot find a config file location to read or output to');
	}else{
		var inputFile = {};
		try{
			inputFile = jsonfile.readFileSync(this.options.configFile);
		}catch(e){
			try{
				jsonfile.writeFileSync(this.options.configFile, {}, {spaces: 4});
			}catch(e){
				error('fatal', 'cli-creator could not open or create a file in the specified location');
			}
		}
		this.config = inputFile;
	}
	this.navStack = [];  //Store the current navigation stack
	this.hintShown = {};
	this.displayedWelcome = false;
}

// RUN APPLICATION
cli.prototype.run = function(){
	if(!isEnding){
		//INITIALIZE FULLSCREEN
		term.fullscreen(true);

		//ADD LISTENERS
		term.on('key', keyClick);

		this.menuCycle();
	}
}

// OTHER METHODS - SHOULD NOT BE CALLED AS INDEPENDENT METHOD

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
	term.blue("Select A Menu Option");
	if(!this.hintShown.selectMenuOption){
		term.blue("(Type option # or use up/down keys): ");
		if(!this.options.persistHints)
			this.hintShown.selectMenuOption = true;
	}else
		term.blue(": ");
	var history = indexHistory(this.model[this.currentMenu].options.length, ((this.navStack.length > 0)? true : false));
	term.inputField({history: history}, function(err, selection){
		var optionsArray = this.model[this.currentMenu].options;
		if(typeof err !== 'undefined' && err !== null){
			error('input', 'Failed to get selection, please try again');
			return this.selectMenuOption(cb)
		}else if(typeof selection == 'string' && selection.match(/^ *[0-9]{1,3} *$/)){
			selection = selection.trim();
			selection = parseInt(selection);
			if(isNaN(selection)){
				error('input', 'Please enter a valid menu item number');
				return this.selectMenuOption(cb);
			}else if((selection == optionsArray.length+1 && this.navStack.length > 0) || (selection > 0 && selection <= optionsArray.length)){
				return cb(selection - 1);  //Index offset
			}else{
				error('input', "Please enter a valid menu item number");
				return this.selectMenuOption(cb);
			}
		}else{
			error('input', 'Please enter a valid menu item number');
			return this.selectMenuOption(cb);
		}
	}.bind(this))
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