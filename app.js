var cliCreator = require('./index');

var cli = new cliCreator({
	options:{
		estimatedDir: __dirname,
		useNotifier: true,
		notificationIcon: './pizza.png',
		notificationTitle: "ACLJ User Manager",
		notificationTimeout: 5,
		welcomeTitle: "Test Title",
		welcomeDescription: "Test Description",
		backgroundColor: "white",
		welcomeColor: "Magenta",
		menuTitleColor: "Blue",
		menuColor: "Cyan",
		promptColor: "black"
	},
	model:{
		main:{
			title: "Main Menu",
			options:[
				{
					title: "Manage API Methods",
					pointer: "apiMethods"
				}
			]
		},
		apiMethods:{
			title: "Manage API Methods",
			options:[
				{
					title: "Add a new api method",
					loc: "api.$USER_KEY",
					create: "sequence",
					keyPrompt: "Enter api shortcut name: ",
					message: "Successfully added new api method",
					sequence:[
						{
							prompt: "Enter method (GET or POST: Use up/down keys to choose): ",
							arrowSelect: ['GET','POST'],
							key: "method"
						},
						{
							prompt: "Enter an api uri: ",
							key: "url"
						}
					]
				},
				{
					title: "Edit existing api methods(: $1 methods){api.$SIZE}",
					dependency: "api.$SIZE",
					pointer: "editAPI"
				}
			]
		},
		editAPI:{
			title: "Customize your api method",
			options: "api",
			pointer: "apiIndividual"
		},
		apiIndividual:{
			title: "Edit your api method",
			options: [
				{
					title: "Edit the http method",
					create: "string",
					loc: "api.$USER_KEY.method"
				}
			]
		}
	}
});

cli.run();