const BaseEvent = function(body, context){
	this.context = context;
	this.eventType = body.type
	this.response = {
		'isBase64Encoded': false,
		'headers': {}
	};
	
};

exports = BaseEvent;
