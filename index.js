var term = require('terminal-kit').terminal;

//CURRENT OPTIONS
/*
persistHints, 
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
	this.navStack = [];  //Store the current navigation stack
	this.hintShown = {};
}

// RUN APPLICATION
cli.prototype.run = function(){
	//INITIALIZE FULLSCREEN
	term.fullscreen(true);

	//ADD LISTENERS
	term.on('key', keyClick);
	this.menuCycle();
}

// OTHER METHODS - SHOULD NOT BE CALLED AS INDEPENDENT METHOD

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

cli.prototype.displayMenu = function(){
	term.clear();
	var menu = this.model[this.currentMenu];
	var navText = ""
	for(var k = 0; k < this.navStack.length; k++){
		navText += (this.model[this.navStack[k]].title || ("Menu #"+(k+1))) + "/";
	}
	var menuTitle = menu.title || ("Menu #" + (this.navStack.length + 1));
	term.blue.underline("%s",navText);
	term.blue.bold.underline("%s\n\n",menuTitle);
	var options = menu.options || [];
	if(typeof options == 'object' && typeof options.length !== 'undefined' && options.length > 0){
		var errorFound = false;
		for(var i = 0; i <= options.length; i++){
			if(i == options.length){
				if(this.navStack.length > 0)
					term.blue.bold("%d : Back to Previous Menu\n",(i+1));
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

cli.prototype.selectMenuOption = function(cb){
	term.blue("Select A Menu Option");
	if(!this.hintShown.selectMenuOption){
		term.blue("(Type option # or use left/right keys): ");
		if(!this.options.persistHints)
			this.hintShown.selectMenuOption = true;
	}else
		term.blue(": ");
	term.inputField(function(err, selection){
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
			}
		}else{
			error('input', 'Please enter a valid menu item number');
			return this.selectMenuOption(cb);
		}
	}.bind(this))
}


function keyClick(name, matches, data){
	if(name === 'CTRL_C'){
		term.fullscreen(false);
		term.clear();
		process.exit();
	}
}

function error(type, message){
	term.bold.red("\n\n✘ %s ERROR: %s\n\n", type.toUpperCase(), message);
	if(type.match(/fatal/i)){
		delay(4, function(){
			term.fullscreen(false);
			term.clear();
			process.exit();
		})
	}else
		return;
}

function exit(){
	term.fullscreen(false);
	term.clear();
	process.exit();
}

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