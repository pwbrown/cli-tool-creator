//TEMPORARY TEST APPLICATION

var cliCreator = require('./index');

var options = {
	options:{
		estimatedDir: __dirname
	},
	model:{
		main:{
			title: "($1|Alexa Application){appName} Main Menu",
			options:[
				{
					title: "Manage Application Variables",
					pointer: "appVarsMain"
				}
			]
		},
		appVarsMain:{
			title: "Application Variable Manager",
			options:[
				{
					title: "Add a new string value",
					create: "string",
					loc: "appVars.$USER_KEY",
					keyPrompt: "Enter the name of your application variable: ",
					prompt: "Enter the value of your application variable: "
				},
				{
					title: "Add a new number value",
					create: "float",
					loc: "appVars.$USER_KEY"
				},
				{
					title: "Add a new boolean value",
					create: "boolean",
					loc: "appVars.$USER_KEY"
				},
				{
					title: "Edit existing variables",
					dependency: "appVars.$EXISTS",
					pointer: "editAppVars"
				}
			]
		},
		editAppVars:{
			title: "Edit an application Variable",
			options: "appVars"
		}
	}
}

var cli = new cliCreator(options);

cli.run();