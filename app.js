//TEMPORARY TEST APPLICATION

var cliCreator = require('./index');

var options = {
	model:{
		main:{
			title:"Main Menu",
			options:[
				{
					title:"Create/Edit Alexa Application",
					pointer:"createEditMain"
				}
			]
		},
		createEditMain:{
			options:[
				{
					title:"Add/Edit Application Environment Variable(s)",
					pointer:"globalVarMain"
				}
			]
		},
		globalVarMain:{
			options:[
				{
					title:"Add New Environment Variable"
				}
			]
		}
	}
}

var cli = new cliCreator(options);

cli.run();