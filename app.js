//TEMPORARY TEST APPLICATION

var cliCreator = require('./index');

var options = {
	options:{
		start: 'root'
	},
	model:{
		root:{
			title: "Main Menu",
			options:[
				{
					title: "Create/Edit An Application",
					pointer: "createEditMain"
				}
			]
		},
		createEditMain: {
			title: "Create/Edit Your Applications",
			options:[
				{
					title: "New Application",
					pointer: "newApp"
				},
				{
					title: "Edit Application",
					point: "editApp"
				}
			]
		}
	}
}

var cli = new cliCreator(options);

cli.run();