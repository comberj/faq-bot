const UrlVerificationEvent = function(body, context) {
	this.body = body;
	this.context = context;
	this.response = {
		'isBase64Encoded': false,
		'headers': {}
	};
}

UrlVerificationEvent.prototype.process = async function(){
	Object.assign(this.response, {
		'statusCode': 200,
		'body': JSON.stringify({ challenge: this.body.challenge })
	});

	return this.response;
}

module.exports = UrlVerificationEvent;
