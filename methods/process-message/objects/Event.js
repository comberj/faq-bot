'use strict';
const UrlVerificationEvent = require('./events/UrlVerificationEvent');
const BotJoinedEvent = require('./events/BotJoinedEvent');
const QuestionEvent = require('./events/QuestionEvent');

const Event = function(event, context) {
	const body = JSON.parse(event.body);
    if(body.type === 'url_verification'){
		return new UrlVerificationEvent(body, context);
	} else if (body.type === 'event_callback') {		
		if (body.event.subtype && body.event.subtype === 'channel_join' && body.event.user === process.env.SLACK_BOT_USER_ID) {
			return new BotJoinedEvent(body, context);
		} else if (typeof body.event.thread_ts === 'undefined') {
			return new QuestionEvent(body, context);
		} else {
			console.log("that's something I've not been programmed to handle!")
			console.log(body.event.subtype);
		}
	} else {
		throw new Error('Invalid message type');
	}
}

module.exports = Event;
