# CLI Tool Creator
***
##Description
A CLI wrapper for your application configuration json files. Highly customizable to fit the needs of YOU, the developer.  Give it the content to display and the functionality to implement and this tool will take care of generating an approachable command-line graphical interface for your application users to interact with.
##Purpose
This package seeks to resolve the concern of providing a complex but custom configuration model for your software that is easy for the end user to interact with and easy to build for the application developer. Inspiration for this project came from the use of custom command line interface tools that were built to aid in helping obsfucate the end result of the software from the nitty gritty details of its implementation.  A great example of this end result is the "package.json" file we so frequently use and love. It's not often that us as application developers would take the time to manually create our package.json file object, so we use tools like "npm init". Npm init is a great example of a very custom and simplistic use case of a command line interface, but this package seeks to help you as the developer replicate it's end result but with much more freedom and custom functionality.
#NOTE: This project is in an *Alpha Testing* state and has not been published to npm. Use the temporary install path to get started
##Installation
	npm install cli-tool-creator --save
##Basic structure to get you started
```Javascript
//Retrieve the package
var cliCreator = require('cli-tool-creator');

//Initialize a new CLI with a model for its functionality
var cli = new cliCreator({
	options:{
		// ** refer to the next section for detailed options definitions
	},
	model:{
		// ** refer to the next sections for detailed model definitions
	}
});

//Run your application and the package will take care of the rest
cli.run();
```

***
#Creating your application's Command Line Interface
***
##Step 1: Provide options
*  ***The following model defines the available options***

```Javascript
options:{
	estimatedDir: "string",         //- REQUIRED
	start: "string",                //- OPTIONAL
}
```
###***estimatedDir*** - definition

estimatedDir is the estimated location of the end-user's configuration file.  This allows this CLI package to search the estimated directory for valid configuration files and automatically load them into the custom CLI tool.  It is recommended to make use of nodejs built-in file system commands/variables to aid in this process.  ***This is also the location that the config file is saved to if the user goes through the prompts to create a new application.*** For example:
	
	options:{
		estimatedDir: __dirname   // Will search directory of execution for valid files
	}
	
###***start*** - definition

start defines the name of a key in the root structure of the model to decide which menu to display first. This name is optional and if not provided will default to ***"main"***. Refer to model documentation (Step 2) for details on creating menus

##***Additional Options:***
###--*Welcome Text*
**Options are as follows:**

```Javascript
//Both welcome parts are optional and have no dependencies on eachother
options:{
	welcomeTitle: "string",
	welcomeDescription: "string"
}
```

**NOTE: Welcome Text is displayed when the first menu has been displayed on application load**

###--*Customize Colors*
**Available Color Choices**:

* white
* black
* red
* green
* yellow
* blue
* magenta
* cyan

**Color assignments are as follows:**

```Javascript
//All color customization options are optional
options:{
	backgroundColor: 'color_string',   //Background of the terminal application
	welcomeColor: 'color_string',      //Color of the welcome title and description
	menuTitleColor: 'color_string',    //Color of the menu title
	menuColor: 'color_string',         //Color of the menu option titles
	promptColor: 'color_string'        //Essentially everything else
}
```

**NOTE: Cannot change the default "red" color for error messages!!**

###--*System Notifications*
**NOTE: System Notications work for both Mac and Windows(pre and post 8)**

* System Notifications are displayed whenever changes are made to the config file AND if a menu "message" option is provided

**System Notification Setup is as follows:**

```Javascript
//All of the following options are optional
options:{
	useNotifier: boolean,                        //Turns system notifications on/off
	notificationIcon: 'image location string',   //Overrides default icon image
	notificationTitle: 'string',                 //Overrides notification title (order of overrides: notificationTitle -> application name -> static default title)
	notificationTimeout: number,                 //Overrides default notification timeout in seconds (default is 5 seconds)
}
```


##Step 2: Define a menu model
The model object is made up of many key value pairs in the root structure where each pair represents a user-defined menu with a custom title and a custom list of options to pick from defined in the model.

To create a new menu you must give it a key name with an object as its value:

```Javascript
model:{
	"myMenuName":{}
}
```

The key name does nothing more than aid in navigation and as such will not be displayed anywhere within the program.  So to customize our menu we can add a title:

```Javascript
model:{
	"myMenuName":{
		title: "This is the title of my new menu....Hurray!!"
	}
}
```

So we have a title to our menu, but it doesn't do anything.  Now we start adding our list of options each with its own title:

```Javascript
model:{
	"myMenuName":{
		title: "This is the title of my new menu",
		options:[
			{
				title: "Pick me to do something"
			},
			{
				title: "Pick me, I'm cooler than that first option"
			}
		]
	}
}
```

Finally we have our menu structure, but as you can tell there is no functionality other than displaying a title.

##Step: 3 - Add functionality to our menu items(options)
###Basic Navigation
* To Navigate to another menu we add the key name of our next menu to a "pointer" option:

```Javascript
model:{
	"main":{
		title: "This is my primary menu",
		options: [
			{
				title: "Go to another menu",
				pointer: "anotherMenu"	
			}
		]
	},
	"anotherMenu":{
		title: "This is another menu",
		options: [
			.
			.
			.
		]
	}
}
```

In the above example, if we select the option from the first menu titled "Go to another menu", the menu with the key "anotherMenu" will be displayed.

***
###Modifying the config file
* Now that we have basic navigation down, we can start interacting with the configuration file and setting values to our specific config model.

####Location
* Before moving into creating or inserting items, we need to understand how to specify the location to save them to in our configuration file.  This is where the keyword ***"loc"*** comes into play.
* The value of ***"Loc"*** is a key mapping using dot notation to lead to the specified location in the config file.  It always starts with a key in the root structure of config.

**Example**

```Javascript
//Config file structure
{
	"searchIdentifier": "cli-tool",
	"appName": "myApp",
	"user":{
		"address":{
			"city":""
		}
	}
}

//Location string to identify location of user city
loc: "user.address.city"
```

####Create
* To create or edit values in the config file, we use the key name ***"create"*** and assign a value associated with the new value's type.
* You can create a ***"string"***, ***"integer"***, ***"float"***, ***"boolean"***, ***"array"***, or ***"object"***.  These are the only options available right now.

```Javascript
//Creating basic string assigned to given location
options:[
	{
		title: "Add your email address",
		create: "string",
		loc: "user.email" 
	}
]

//Creating basic number assigned to given location
options:[
	{
		title: "Add your annual income",
		create: "float",
		loc: "user.income"
	}
]
```

####Insert
* To insert a value into an array, we use the key name ***"insert"*** and assign a value associated with the new values's type.
* ***Same types*** available ***as*** with the ***create*** key name.
* We can also specify the index of our inserted value by providing an ***"index"*** number

```Javascript
//Inserting a basic string into assigned array location
options:[
	{
		title: "Add to the common baby name list",
		insert: "string",
		loc: "commonNames.babies"
	}
]

//Inserting a basic string at a specified index (ex. add to beggining of array instead of end)
options:[
	{
		title: "Add new subscriber email",
		insert: "string",
		loc: "subscribers",
		index: 0      // index of 0 indicates inserting new email at the beginning of the array
	}
]
```

####Custom Prompt
* All user prompts have default strings that will be displayed **but** we may decide to customize those.
* To customize this we use the key name ***"prompt"*** to signify a custom value prompt.

```Javascript
//Option to insert amount record into list of leisure expenses
{
	title: "Add to leisure expenses",
	insert: "float",
	loc: "expenses.leisure",
	prompt: "Enter the dollar amount of your expense: $"  //custom prompt
}
```

####Custom Regex
* All user prompts of type "string" or "number" have default regular expressions associated with them.
* We can customize these regular expressions to better suite our custom input if necessary.
* To do this we simply use the ***"regex"*** key name

```Javascript
//Option to insert a standard U.S. zip code
{
	title: "Edit my zipcode",
	create: "string",
	loc: "user.zip",
	prompt: "Enter a 5 digit U.S. zip code: ",
	regex: /^[0-9]{5}$/        //Basic example of a zip code regular expression
}
```

####Custom Error
* All user prompts have a default error message if the user prompt fails or if the given value does not match the default or custom regular expression.
* Customize the error message with the ***"error"*** key name

```Javascript
//Option to insert a standard U.S. zip code
{
	title: "Edit my zipcode",
	create: "string",
	loc: "user.zip",
	prompt: "Enter a 5 digit U.S. zip code: ",
	regex: /^[0-9]{5}$/,
	error: "Seriously! Is it that hard to enter a 5 digit zip code? Do it again."
}
```
***
###Utilizing the config file
* In certain situations we may want to use values from our config file to help build our command line interface even further.

####Inserting a config value into a string
* This project uses a custom parsing syntax to locate and potentially insert values into a string that is displayed as part of the command line interface.
* The syntax is as follows: "(***success_string***|***failure_string***){***location_string***}"
* The **success_string** is a string output that is displayed whenever the config variable is found and valid
* The **failure_string** is an ***optional*** string value that can be displayed on failure to retrieve or locate a value.
* Inserting a value works just like a regular expression back reference where the number of the value corresponds to the order of the values retrieved. (Ex. "$1") ***Note: If multiple values are retrieve in one parse, the success string will only display if all value locations are valid. Be careful when using multiple locations.***

```Javascript
//****Example 1: Custom menu title including the application name
menu1: {
	title: "($1|My Application){appName}: menu 1"
}
//if appName is found it will display "app_name: menu 1"
//otherwise it will display "My Application: menu 1"

//****Example 2: Inserting two found values into success string (no failure string)
menu1: {
	title: "Customize user(: $1 $2){user.firstName,user.lastName}"
}
//Note: if lastname is missing for example no name will be displayed at all

//****Example 2: Two seperate inserts each with one value  (Preferred solution to example 2)
menu1: {
	title: "Customize user: ($1 ){user.firstName}($1){user.lastName}"
}
```

* ***What about currency?*** We use the "$" symbol to indicate a back reference string insert, but what if we want to use the explicitly display the "$" symbol as part of our string.  To do this we use **"$$"** which will be displayed as "$" in the final string (***Note: only applies to success string***).

####Additional Modifiers:
* These modifiers help with retrieving values in the above parsing syntax and are added to the location string.

***Following examples will use this config file structure***

```Javascript
config:{
	"searchIdentifier": "cli-tool",
	"appName": "Profile Manager",
	"user":{
		"firstName": "John",
		"lastName": "Smith",
		"hobbies": [
			"Biking",
			"Swimming",
			"Hiking",
			"Eating",
			"Watching Netflix"
		],
		"siblings":[
		],
		"expenses":[
			1,
			4.69,
			5.30
		]
	}
}
```

#####Exists
* If we are not performaing a string insert we can still check to see if something simply exists in order to trigger a success string
* Use the keyword ***"$EXISTS"*** at the end of your location string

```Javascript
title: "The user (has|has not){user.expenses.$EXISTS} spent money"

//user.expenses exists in our config file so "The user has spent money" will be displayed
```

#####Size/Length of
* If we want to check to make sure an object or an array has elements in it, we can use the ***"$SIZE"*** keyword.
* This modifier will also return the size number for use in string inserts.
* ***Note: A size of 0 will result in the failure string***

```Javascript
title: "The user (has $1|does not have){user.siblings.$SIZE} siblings"

//user.siblings is an array of size 0, so "The user does not have siblings" will be displayed
```

#####Array/Object List
* In order to list out the contents of an array or the key names of an object in string form we can use the ***"$LIST_AND"*** or the ***"$LIST_OR"*** keywords.
* This will take the elements of an array of the keynames of an object and list them in the form "item1, item2, item3, or item4".
* ***NOTE: The difference between $LIST\_AND and $LIST\_OR is whether or not it prints the word "and" or the word "or" between the last two items in the list***

```Javascript
//And List
title: "The user (enjoys $1|does not have any hobbies){user.hobbies.$LIST_AND}"
//***prints: "The user enjoys Biking, Swimming, Hiking, Eating, and Wathing Netflix"

//Or List
title: "I'm (either $1|never doing anything fun){user.hobbies.$LIST_OR}"
//***prints: "I'm either Biking, Swimming, Hiking, Eating, or Watching Netflix"
```

###Creating menu options using a configuration array/object
* We may have an array of objects or an object that we want to turn into a new menu after that changes as the array changes.
* In order to create a dynamic menu we simply substitute the menu options array for a location string
* To assign options to each item, simply add options

####Additional Options
#####Title Key
* When we have an array of objects the key name ***"titleKey"*** defines which key to display its value as the menu option title

***
####Custom Key Names
* We may easily encounter a situation where we want to create custom key value pairs where the user has control over both parts and up till now we've only let the user enter the value.
* To specify using a custom key name we use the keyword ***"$USER_KEY"*** and add this as part of our location string
* We can also customize all aspects of our custom key prompt just like with our value prompt by using the key names ***"keyPrompt"***, ***"keyRegex"***, and ***"keyError"***.

```Javascript
options: [
	{
		title: "Add a new enviornment variable",
		create: "string",
		loc: "envVars.$USER_KEY",         //key name for environment variable is user-created
		keyPrompt: "Enter the name of your env variable: ",
		keyRegex: /^[a-z][a-zA-Z0-9]*$/,  //Simple camelcase support regex for key
		keyError: "Invalid variable name (alphanumeric with no spaces only).",
		prompt: "Enter the value or your enviornment variable: "
	}
]
```

####Custom 
