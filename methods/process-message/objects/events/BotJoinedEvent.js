const BotJoinedEvent = function(body, context) {
	this.body = body;
	this.context = context;
	this.response = {
		'isBase64Encoded': false,
		'headers': {}
	};
}

BotJoinedEvent.prototype.process = async function(){
	Object.assign(this.response, {
		'statusCode': 200,
		'body': JSON.stringify(this.body)
	});

	return this.response;
}

module.exports = BotJoinedEvent;
