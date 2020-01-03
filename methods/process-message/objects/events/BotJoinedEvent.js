const axios = require('axios');
var AWS = require('aws-sdk');
var sqs = new AWS.SQS({apiVersion: '2012-11-05'});

const BotJoinedEvent = function(body, context) {
	this.body = body;
	this.context = context;
	this.response = {
		'isBase64Encoded': false,
		'headers': {}
	};
}

BotJoinedEvent.prototype.process = async function(){
	// var getChannelHistory = function(family, value, callback) {
	const channel = this.body.event.channel;
	const url = `https://${process.env.SLACK_WORKSPACE}.slack.com/api/channels.history?token=${process.env.SLACK_TOKEN}&channel=${channel}`;
	const response = await axios.get(url);
	const messages = response.data.messages;
	const queueUrl = process.env.HISTORY_QUEUE_URL;
	
	console.log('all messages', messages);
	let count = 0;
	
	const params = {
		Entries: [],
		QueueUrl: queueUrl
	};
	
	for(message of messages){
		
		if(isHumanQuestion(message)){
			let messageData = {
				'text': message.text,
				'ts': message.ts,
				'channel': channel
			};

			let sqsMessageData = {
				Id: uuidv4(),
				MessageAttributes: {
					'text': {
						DataType: 'String',
						StringValue: messageData.text
					},
					'ts': {
						DataType: 'String',
						StringValue: messageData.ts
					},
					'channel': {
						DataType: 'String',
						StringValue: messageData.channel
					}
				},
				MessageBody: JSON.stringify(messageData),
			};
			
			params.Entries.push(sqsMessageData);
		};
		
		if(params.Entries.length && params.Entries.length % 10 === 0){
			await sendMessageToQueue(params);
			params.Entries = [];
			count += 10;
		};
		
	};
	
	if(params.Entries.length) {
		await sendMessageToQueue(params);
		count += params.Entries.length;
	};
	
	
	Object.assign(this.response, {
		'statusCode': 200,
		'body': JSON.stringify({messagesQueued: count})
	});
	
	console.log('Messages Queued: ', count);

	return this.response;
};

function isHumanQuestion(message){
	return !isBotUser(message) && !isThreadReply(message) && !isChannelMessage(message);
};

function isBotUser(message){
	return message.user === process.env.SLACK_BOT_USER_ID;
};

function isChannelMessage(message){
	return message.subtype && (message.subtype === 'channel_join' || message.subtype === 'channel_leave');
}

function isThreadReply(message){
	return typeof message.parent_user_id !== 'undefined';
}

async function sendMessageToQueue(params){
	return await sqs.sendMessageBatch(params).promise();
}

function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

module.exports = BotJoinedEvent;
