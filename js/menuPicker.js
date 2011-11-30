SOTE.namespace("SOTE.widget.MenuPicker");

SOTE.widget.MenuPicker.prototype = new SOTE.widget.Component;

/**
  * Instantiate the menuPicker  
  *
  * @class A selection device with similar functionality to a drop-down selection list, but built with HTML
  *     elements for maximum styling and flexibility.
  * @constructor
  * @this {menuPicker}
  * @param {String} containerId is the container id of the div in which to render the object 
  * @param {Object} [config] is a hash allowing configuration of this component
  *   @config {Object[]} [items] a JS Array of JS Objects: items[i..n].label, items[i..n].value pairs
  *     representing the available options. Each object can also contain an optional disabled: true
  *   @config {String} [selected] the key of the initially selected option
  * @augments SOTE.widget.Component
  * 
*/
SOTE.widget.MenuPicker = function(containerId, config){
	//Get the ID of the container element
	this.container = document.getElementById(containerId);

	if (this.container == null){
		this.setStatus("Error: element '" + containerId + "' not found!");
		return;
	}
	this.id = containerId;
	
	//Define an object for holding configuration 
	if (config === undefined)
		config = {};
	if (config.items === undefined)
		config.items = [];
	if (config.selected === undefined)
		config.selected = null;
	if (config.isCollapsible === undefined)
		config.isCollapsible = false;
	if (config.dataSourceUrl === undefined)
	    config.dataSourceUrl = null;
	
	this.menuItems = config.items;
	this.menuItemSelected = config.selected;
	this.menuIsCollapsible = config.isCollapsible;
	this.dataSourceUrl = config.dataSourceUrl;
	this.statusStr = "";
	this.init();
};

/**
  * Displays all options in HTML with the selected option indicated with styles.
  * All callbacks should be set.  The component UI should be rendered with controllers to call the events.
  * 
  * @this {menuPicker}
  * 
*/
SOTE.widget.MenuPicker.prototype.init = function(){
	this.render();
	
	if(REGISTRY){
		REGISTRY.register(this.id,this);
	}
	else{
		alert("No REGISTRY so could not register MenuPicker");
	}
};

/*
 * Renders the UI menu
 */
SOTE.widget.MenuPicker.prototype.render = function(){
	// Get rid of previously defined stuff
	this.container.innerHTML = "";
	$('#' + this.id).undelegate("click");
	
	var menuUL = document.createElement('ul');
	var ulClass = "menuPicker";
	if (this.menuIsCollapsible === true)
		ulClass += " collapsible";
	menuUL.setAttribute('class', ulClass);

	for (var i=0; i < this.menuItems.length; i++) {
		var liID = this.id + "_" + "item" + i;
		var menuLI = document.createElement('li');
		menuLI.setAttribute('id',liID);
		menuLI.innerHTML = "<div>" + this.menuItems[i].label + "</div>";
		
		if (this.menuItems[i].value === this.menuItemSelected){
			this.setValue(this.menuItems[i].value);
			menuLI.setAttribute('class', "selected");
		}
		
		menuUL.appendChild(menuLI);
		
		if (!(this.menuItems[i].disabled === true))
			$('#' + this.id).delegate("#" + liID, "click", {val:this.menuItems[i].value, self:this}, SOTE.widget.MenuPicker.bindClick);
			// Use when we change to JQuery 1.7
			//$('#' + this.id).on("click", "#" + liID, {val:this.menuItems[i].value, self:this}, SOTE.widget.MenuPicker.bindClick);
		else
			menuLI.setAttribute('class', "disabled");
	}

	this.container.appendChild(menuUL);
};

/**
 * Handler for clicking on an li
 */
SOTE.widget.MenuPicker.bindClick = function(event){
	event.data.self.setValue(event.data.val);
};

/**
 * Fires an event in the registry when the component value is changed
 * 
 * @this {SOTE.widget.MenuPicker}
 */
SOTE.widget.MenuPicker.prototype.fire = function(){
	if(REGISTRY){
		REGISTRY.fire(this);
	}
	else{
		alert("No REGISTRY so no event REGISTRY event to fire");
	}
};

/**
  * Sets the selected option in the menuPicker to the passed in value, if valid ([containerId]=[key])
  *
  * @this {menuPicker}
  * @param {String} value is the key of the option to be set as selected ([containerId]=[key])
  * @returns {boolean} true or false depending on if the value validates
  *
*/
SOTE.widget.MenuPicker.prototype.setValue = function(value){
	var oldValue = this.value;
	this.value = value;
	var validation = this.validate();
	
	if (validation) {
		$('#' + this.value).removeClass('selected');
		$('#' + value).addClass('selected');
	}
	else {
		this.value = oldValue;
	}
	return validation;
};

/**
  * Gets the currently selected option ([containerId]=[key])
  *
  * @this {menuPicker}
  * @returns {String} a string representing the key of the currently selected option ([containerId]=[key])
  *
*/
SOTE.widget.MenuPicker.prototype.getValue = function(){
	return this.value;
};

/**
  * Change the component based on dependencies (i.e. Available Options, Selected)
  * 
  * @this {menuPicker}
  * @param {String} querystring contains all values of dependencies (from registry)
  * @returns {boolean} true or false depending on if the selected value still validates with modified criteria
  * 
*/
SOTE.widget.MenuPicker.prototype.updateComponent = function(querystring){
	var qs = (querystring === undefined) ? "" : querystring;
	SOTE.util.getJSON(
		this.dataSourceUrl + qs,
		{self:this},
		SOTE.widget.MenuPicker.handleUpdateSuccess,
		SOTE.widget.MenuPicker.handleUpdateFailure
	);
};

/**
  * Static function to handle a successful retrieval from the data accessor
  * 
  * @this {AccordionPicker}
  * @param {Object,String,Object,Object} data is the data passed back from the call, status is the response status, xhr is the applicable xmlhttprequest object, args are the custom arguments passed
  * 
*/
SOTE.widget.MenuPicker.handleUpdateSuccess = function(data,status,xhr,args){
	var value = args.self.getValue();
	args.self.menuItems = data.items;
	
	// If the old selected LI no longer exists, set selected val to null 
	if (!args.self.setValue(value))
		args.self.value = null;
	args.self.render();
};

/**
  * Static function to handle a failed retrieval from the data accessor
  * 
  * @this {AccordionPicker}
  * @param {Object,String,String,Object} xhr is the applicable xmlhttprequest object, status is the response status, error is the thrown error, args are the custom arguments passed
  * 
*/
SOTE.widget.MenuPicker.handleUpdateFailure = function(xhr,status,error,args){
	alert("Failed to load data accessor: " + error);
};

/**
  * Sets the selection option from the query string ([containerId]=[key])
  * 
  * @this {menuPicker}
  * @param {String} qs contains the querystring ([containerId]=[key])
  *
*/
SOTE.widget.MenuPicker.prototype.loadFromQuery = function(qs){
	return this.setValue(SOTE.util.extractFromQuery(this.id,qs));
};

/**
  * Validates that the selected option is not null and  is one of the available options
  * 
  * @this {menuPicker}
  * @returns {boolean} true or false depending on whether the selected option is not null and
  *    is one of the available options
*/
SOTE.widget.MenuPicker.prototype.validate = function(){
	var valid = false;
	var matcheditem = false;
	
	for (var i=0; i < this.menuItems.length; i++) {
		if ((this.menuItems[i].value === this.value) && !(this.menuItems[i].disabled === true)) {
			valid = true;
			matcheditem = true;
			break;
		}
		else if (this.menuItems[i].value === this.value) {
			this.setStatus("List item with value = " + this.menuItems[i].value + " is disabled");
			matcheditem = true;
			break;
		}
	}
	if (matcheditem == false)
		this.setStatus("List item value = " + this.value + " is not valid");

	return valid;
};

/**
  * Sets the data accessor that provides state change instructions given dependencies
  *
  * @this {menuPicker}
  * @param {String} datasourceurl is the relative location of the data accessor 
  *
*/
SOTE.widget.MenuPicker.prototype.setDataSourceUrl = function(datasourceurl){
	this.dataSourceUrl = datasourceurl;
};

/**
  * Gets the data accessor
  * 
  * @this {menuPicker}
  * @returns {String} the relative location of the accessor
  *
*/
SOTE.widget.MenuPicker.prototype.getDataSourceUrl = function(){
	return this.dataSourceUrl;
};

/**
  * Sets the status of the component
  *
  * @this {menuPicker}
  * @param {String} s the current status of the component (user prompts, error messages)
  *
*/
SOTE.widget.MenuPicker.prototype.setStatus = function(s){
	this.statusStr = s;
};

/**
  * Gets the status of the component
  *
  * @this {menuPicker}
  * @returns {String} the current status of the component (user prompts, error messages)
  *
*/
SOTE.widget.MenuPicker.prototype.getStatus = function(){
	return this.statusStr;
};

/**
  * Add an item to the options list
  *
  * @this {menuPicker}
  * @param {Object} item is a key/value pair 
  * @returns {boolean} true or false depending on if the item was successfully added
  *
*/
SOTE.widget.MenuPicker.prototype.addItem = function(item){
  // Content
};

/**
  * Remove an item from the options list
  *
  * @this {menuPicker}
  * @param {String} the key of the item to be removed 
  * @returns {boolean} true or false depending on if the operation was successful
  *
*/
SOTE.widget.MenuPicker.prototype.removeItem = function(item){
  // Content
};

/**
  * Returns the total number of items currently in the options list
  *
  * @this {menuPicker}
  * @returns {Number} the number of items currently in the options list
  *
*/
SOTE.widget.MenuPicker.prototype.length = function(){
  // Content
};